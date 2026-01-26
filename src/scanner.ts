import type { Config } from './config.js';
import { EtherscanClient } from './clients/etherscan.js';
import { DeFiLlamaClient } from './clients/defillama.js';
import { SlitherAnalyzer } from './analyzers/slither.js';
import { AIAnalyzer } from './analyzers/ai-analyzer.js';
import { FindingDeduplicator } from './analyzers/deduplicator.js';
import { TelegramAlertService } from './alerts/telegram.js';
import { Database } from './database.js';
import { CHAINS, SEVERITY_ORDER } from './types/index.js';
import type { Finding } from './types/index.js';

/**
 * Main scanner orchestrator. Runs the full pipeline:
 * 1. Discover protocols via DeFiLlama
 * 2. Fetch contract source via Etherscan V2
 * 3. Run Slither static analysis
 * 4. AI-augmented review of high-severity findings
 * 5. Deduplicate across tools
 * 6. Send Telegram alerts
 * 7. Persist to PostgreSQL
 */
export class Scanner {
  private readonly etherscan: EtherscanClient;
  private readonly defillama: DeFiLlamaClient;
  private readonly slither: SlitherAnalyzer;
  private readonly ai: AIAnalyzer;
  private readonly deduplicator: FindingDeduplicator;
  private readonly telegram: TelegramAlertService;
  private readonly db: Database;
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
    this.etherscan = new EtherscanClient(config.etherscanApiKey, config.etherscanRequestIntervalMs);
    this.defillama = new DeFiLlamaClient(config.defiLlamaCacheTtlMs);
    this.slither = new SlitherAnalyzer();
    this.ai = new AIAnalyzer(config.anthropicApiKey);
    this.deduplicator = new FindingDeduplicator();
    this.telegram = new TelegramAlertService(config.telegramBotToken, config.telegramChatId);
    this.db = new Database(config.databaseUrl);
  }

  /**
   * Run a full scan cycle across all configured chains.
   */
  async runFullScan(): Promise<ScanSummary> {
    console.log('=== Starting full scan cycle ===');
    const summary: ScanSummary = {
      chainsScanned: 0,
      protocolsDiscovered: 0,
      contractsAnalyzed: 0,
      totalFindings: 0,
      alertsSent: 0,
      errors: [],
    };

    for (const chain of this.config.scanChains) {
      try {
        const chainSummary = await this.scanChain(chain.name);
        summary.chainsScanned++;
        summary.protocolsDiscovered += chainSummary.protocols;
        summary.contractsAnalyzed += chainSummary.contracts;
        summary.totalFindings += chainSummary.findings;
        summary.alertsSent += chainSummary.alerts;
      } catch (err) {
        const msg = `Chain ${chain.name}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[Scanner] Error scanning chain: ${msg}`);
        summary.errors.push(msg);
      }
    }

    console.log('=== Scan cycle complete ===');
    console.log(`  Chains: ${summary.chainsScanned}, Protocols: ${summary.protocolsDiscovered}, Contracts: ${summary.contractsAnalyzed}`);
    console.log(`  Findings: ${summary.totalFindings}, Alerts: ${summary.alertsSent}, Errors: ${summary.errors.length}`);

    return summary;
  }

  /**
   * Scan a specific contract address on a given chain.
   */
  async scanContract(address: string, chainId: number): Promise<Finding[]> {
    const chainName = Object.values(CHAINS).find(c => c.chainId === chainId)?.name ?? `Chain ${chainId}`;
    console.log(`[Scanner] Scanning contract ${address} on ${chainName}`);

    // Fetch source code
    const source = await this.etherscan.getContractSource(chainId, address);
    if (!source) {
      console.log(`[Scanner] Contract ${address} source not verified, skipping`);
      return [];
    }

    // Upsert contract
    const contractId = await this.db.upsertContract({
      address,
      chainId,
      name: source.name,
      sourceCode: source.sourceCode,
      compilerVersion: source.compilerVersion,
      isProxy: source.isProxy,
      implementationAddress: source.implementationAddress,
    });

    // Create scan record
    const scan = await this.db.createScan(contractId, ['slither']);

    try {
      // Run Slither
      const findings = await this.slither.analyze(address, chainId, source.sourceCode, source.compilerVersion);
      console.log(`[Scanner] Slither: ${findings.length} findings for ${address}`);

      // AI enrichment for high/critical
      if (this.ai.isAvailable) {
        const significant = findings.filter(f => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER['high']);
        if (significant.length > 0) {
          console.log(`[Scanner] Running AI analysis on ${significant.length} significant findings`);
          const assessments = await this.ai.analyzeFindingsBatch(significant, source.sourceCode, null);
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
      const deduplicated = this.deduplicator.deduplicate(findings);

      // Save all findings
      for (const finding of findings) {
        finding.scanId = scan.id;
        finding.contractId = contractId;
        await this.db.saveFinding(finding);
      }

      await this.db.updateScanStatus(scan.id, 'completed');

      // Alert on significant findings
      const alertable = this.telegram.filterBySeverity(deduplicated, this.config.alertMinSeverity);
      if (alertable.length > 0) {
        await this.telegram.sendBatchSummary(alertable, address, chainName, source.name);
        for (const finding of alertable.filter(f => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER['high'])) {
          await this.telegram.sendFindingAlert(finding, address, chainName);
        }
      }

      return deduplicated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.db.updateScanStatus(scan.id, 'failed', msg);
      throw err;
    }
  }

  private async scanChain(chainName: string): Promise<ChainScanResult> {
    const chainConfig = CHAINS[chainName.toLowerCase()];
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chainName}`);
    }

    console.log(`[Scanner] Discovering protocols on ${chainName} (min TVL: $${this.config.minTvlThreshold})`);

    const protocols = await this.defillama.getTopProtocols(
      chainName.toLowerCase(),
      this.config.minTvlThreshold,
      50,
    );

    console.log(`[Scanner] Found ${protocols.length} protocols on ${chainName}`);

    const result: ChainScanResult = {
      protocols: protocols.length,
      contracts: 0,
      findings: 0,
      alerts: 0,
    };

    // In a production system, you'd resolve protocol -> contract addresses
    // via DeFiLlama adapters, Etherscan token lists, or a maintained mapping.
    // For now we log the discovered protocols.
    for (const protocol of protocols.slice(0, 10)) {
      const tvl = protocol.chainTvls?.[capitalize(chainName)] ?? protocol.tvl ?? 0;
      console.log(`  - ${protocol.name}: $${(tvl / 1e6).toFixed(1)}M TVL`);
    }

    return result;
  }

  async shutdown(): Promise<void> {
    await this.db.close();
  }
}

interface ScanSummary {
  chainsScanned: number;
  protocolsDiscovered: number;
  contractsAnalyzed: number;
  totalFindings: number;
  alertsSent: number;
  errors: string[];
}

interface ChainScanResult {
  protocols: number;
  contracts: number;
  findings: number;
  alerts: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
