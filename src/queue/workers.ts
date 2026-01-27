import { Worker } from 'bullmq';
import type { AnalysisJobData, AlertJobData, DiscoveryJobData, Finding, Severity } from '../types/index.js';
import type { Config } from '../config.js';
import { EtherscanClient } from '../clients/etherscan.js';
import { DeFiLlamaClient } from '../clients/defillama.js';
import { SlitherAnalyzer } from '../analyzers/slither.js';
import { AIAnalyzer } from '../analyzers/ai-analyzer.js';
import { FindingDeduplicator } from '../analyzers/deduplicator.js';
import { TelegramAlertService } from '../alerts/telegram.js';
import { CHAINS, SEVERITY_ORDER } from '../types/index.js';
import { Database } from '../database.js';

export function createWorkers(config: Config) {
  const connection = parseRedisUrl(config.redisUrl);
  const db = new Database(config.databaseUrl);
  const etherscan = new EtherscanClient(config.etherscanApiKey, config.etherscanRequestIntervalMs);
  const defillama = new DeFiLlamaClient(config.defiLlamaCacheTtlMs);
  const slither = new SlitherAnalyzer();
  const ai = new AIAnalyzer(config.anthropicApiKey, config.ai);
  const deduplicator = new FindingDeduplicator();
  const telegram = new TelegramAlertService(config.telegramBotToken, config.telegramChatId);

  // ── Discovery Worker ──
  const discoveryWorker = new Worker<DiscoveryJobData>(
    'discovery',
    async (job) => {
      const { chain, minTvl } = job.data;
      console.log(`[Discovery] Scanning ${chain} for protocols with TVL >= $${minTvl}`);

      const chainConfig = CHAINS[chain];
      if (!chainConfig) {
        throw new Error(`Unknown chain: ${chain}`);
      }

      const protocols = await defillama.getTopProtocols(chain, minTvl, 50);
      console.log(`[Discovery] Found ${protocols.length} protocols on ${chain}`);

      // For each protocol, we'd ideally resolve contract addresses.
      // DeFiLlama doesn't directly provide contract addresses in the free API,
      // so in production you'd maintain a mapping or use their adapters repo.
      // For now, log the discovered protocols for manual address resolution.
      for (const protocol of protocols.slice(0, 10)) {
        const chainTvl = protocol.chainTvls?.[capitalize(chain)] ?? 0;
        console.log(`  - ${protocol.name}: $${(chainTvl / 1e6).toFixed(1)}M TVL`);
      }

      return { protocolCount: protocols.length };
    },
    { connection, concurrency: 2 },
  );

  // ── Analysis Worker ──
  const analysisWorker = new Worker<AnalysisJobData>(
    'analysis',
    async (job) => {
      const { contractId, address, chainId, sourcePath } = job.data;
      const chainName = Object.values(CHAINS).find(c => c.chainId === chainId)?.name ?? `Chain ${chainId}`;
      console.log(`[Analysis] Scanning ${address} on ${chainName}`);

      // Create scan record
      const scan = await db.createScan(contractId, ['slither']);

      try {
        // Fetch source if not cached
        let contract = await db.getContract(contractId);
        if (!contract?.sourceCode) {
          const source = await etherscan.getContractSource(chainId, address);
          if (!source) {
            await db.updateScanStatus(scan.id, 'failed', 'Source code not verified');
            return { findings: 0 };
          }
          await db.updateContractSource(contractId, source.sourceCode, source.compilerVersion);
          contract = await db.getContract(contractId);
        }

        // Run Slither
        const findings = await slither.analyze(
          address,
          chainId,
          contract!.sourceCode,
          contract!.compilerVersion,
        );

        console.log(`[Analysis] Slither found ${findings.length} issues for ${address}`);

        // AI enrichment for high/critical findings
        if (ai.isAvailable) {
          const significant = findings.filter(
            f => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER['high']
          );
          if (significant.length > 0) {
            const assessments = await ai.analyzeFindingsBatch(
              significant,
              contract!.sourceCode,
              contract!.protocolName,
            );
            for (const assessment of assessments) {
              const finding = significant.find(f => f.id === assessment.findingId);
              if (finding) {
                finding.aiAssessment = assessment.assessment;
                finding.aiIsFalsePositive = assessment.isFalsePositive;
              }
            }
          }
        }

        // Deduplicate
        const deduplicated = deduplicator.deduplicate(findings);

        // Save findings
        for (const finding of findings) {
          finding.scanId = scan.id;
          finding.contractId = contractId;
          await db.saveFinding(finding);
        }

        await db.updateScanStatus(scan.id, 'completed');

        // Queue alerts for significant deduplicated findings
        const alertable = telegram.filterBySeverity(deduplicated, config.alertMinSeverity);
        if (alertable.length > 0) {
          // Send batch summary
          await telegram.sendBatchSummary(
            alertable,
            address,
            chainName,
            contract!.protocolName,
          );

          // Send individual alerts for critical/high
          for (const finding of alertable.filter(f => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER['high'])) {
            await telegram.sendFindingAlert(finding, address, chainName);
          }
        }

        return { findings: findings.length, deduplicated: deduplicated.length, alerted: alertable.length };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.updateScanStatus(scan.id, 'failed', msg);
        throw err;
      }
    },
    {
      connection,
      concurrency: 3,
      limiter: { max: 10, duration: 60_000 },
    },
  );

  // ── Alert Worker ──
  const alertWorker = new Worker<AlertJobData>(
    'alerts',
    async (job) => {
      const { findingId } = job.data;
      const finding = await db.getFinding(findingId);
      if (!finding) {
        console.warn(`[Alert] Finding ${findingId} not found`);
        return;
      }

      const contract = await db.getContract(finding.contractId);
      if (!contract) return;

      const chainName = Object.values(CHAINS).find(c => c.chainId === contract.chainId)?.name ?? 'Unknown';
      await telegram.sendFindingAlert(finding, contract.address, chainName);
    },
    { connection, concurrency: 1 },
  );

  return {
    discoveryWorker,
    analysisWorker,
    alertWorker,
    shutdown: async () => {
      await Promise.all([
        discoveryWorker.close(),
        analysisWorker.close(),
        alertWorker.close(),
        db.close(),
      ]);
    },
  };
}

function parseRedisUrl(url: string): { host: string; port: number; password?: string; username?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
