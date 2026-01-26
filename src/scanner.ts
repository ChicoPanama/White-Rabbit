import type { Config } from './config.js';
import { EtherscanClient } from './clients/etherscan.js';
import { DeFiLlamaClient } from './clients/defillama.js';
import { SlitherAnalyzer } from './analyzers/slither.js';
import { AIAnalyzer } from './analyzers/ai-analyzer.js';
import { FindingDeduplicator } from './analyzers/deduplicator.js';
import { ContextService } from './services/context.js';
import { PoCVerifier } from './services/verifier.js';
import { TelegramAlertService } from './alerts/telegram.js';
import { Database } from './database.js';
import { CHAINS, SEVERITY_ORDER } from './types/index.js';
import type { Finding, VerifiedFinding, VerificationStatus } from './types/index.js';
import { capitalize } from './utils/helpers.js';

/**
 * Main scanner orchestrator. Runs the 6-stage verification pipeline:
 *
 * Stage 1: CONTEXT        - Audit history, contract age, security patterns
 * Stage 2: STATIC ANALYSIS - Slither + AI business logic detection
 * Stage 3: FP FILTERING   - Known false positive patterns, audit checks
 * Stage 4: VERIFICATION   - PoC on fork, tool consensus scoring
 * Stage 5: RISK SCORING   - Weighted confidence score (0-100)
 * Stage 6: SMART ALERTING - Only verified/likely-real findings alert
 */
export class Scanner {
  private readonly etherscan: EtherscanClient;
  private readonly defillama: DeFiLlamaClient;
  private readonly slither: SlitherAnalyzer;
  private readonly ai: AIAnalyzer;
  private readonly deduplicator: FindingDeduplicator;
  private readonly context: ContextService;
  private readonly verifier: PoCVerifier;
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
    this.context = new ContextService();
    this.verifier = new PoCVerifier();
    this.telegram = new TelegramAlertService(config.telegramBotToken, config.telegramChatId);
    this.db = new Database(config.databaseUrl);
  }

  /**
   * Run a full scan cycle across all configured chains.
   */
  async runFullScan(): Promise<ScanSummary> {
    console.log('=== Starting full scan cycle ===');
    console.log(`  PoC verification: ${this.verifier.isAvailable ? 'enabled' : 'disabled (no Foundry or RPC URLs)'}`);
    console.log(`  AI analysis: ${this.ai.isAvailable ? 'enabled' : 'disabled'}\n`);

    const summary: ScanSummary = {
      chainsScanned: 0,
      protocolsDiscovered: 0,
      contractsAnalyzed: 0,
      totalFindings: 0,
      verifiedFindings: 0,
      likelyRealFindings: 0,
      falsePositivesFiltered: 0,
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
        summary.verifiedFindings += chainSummary.verified;
        summary.likelyRealFindings += chainSummary.likelyReal;
        summary.falsePositivesFiltered += chainSummary.falsePositives;
        summary.alertsSent += chainSummary.alerts;
      } catch (err) {
        const msg = `Chain ${chain.name}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[Scanner] Error scanning chain: ${msg}`);
        summary.errors.push(msg);
      }
    }

    console.log('\n=== Scan cycle complete ===');
    console.log(`  Chains: ${summary.chainsScanned}, Protocols: ${summary.protocolsDiscovered}`);
    console.log(`  Contracts: ${summary.contractsAnalyzed}, Raw findings: ${summary.totalFindings}`);
    console.log(`  Verified: ${summary.verifiedFindings}, Likely real: ${summary.likelyRealFindings}`);
    console.log(`  False positives filtered: ${summary.falsePositivesFiltered}`);
    console.log(`  Alerts sent: ${summary.alertsSent}, Errors: ${summary.errors.length}`);

    return summary;
  }

  /**
   * Scan a specific contract address on a given chain.
   * Runs the full 6-stage verification pipeline.
   */
  async scanContract(address: string, chainId: number): Promise<VerifiedFinding[]> {
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
      // ── Stage 1: CONTEXT ──
      console.log(`[Stage 1] Gathering context for ${source.name || address}`);
      const contextInfo = this.context.analyzeContext(source.sourceCode, source.name, null);
      if (contextInfo.isAudited) {
        console.log(`[Stage 1] Known audited protocol: ${contextInfo.knownProtocol} (by ${contextInfo.auditedBy.join(', ')})`);
      }
      if (contextInfo.hasReentrancyGuard) console.log(`[Stage 1] ReentrancyGuard detected`);
      if (contextInfo.hasAccessControl) console.log(`[Stage 1] Access control detected`);

      // ── Stage 2: STATIC ANALYSIS ──
      console.log(`[Stage 2] Running Slither static analysis`);
      const findings = await this.slither.analyze(address, chainId, source.sourceCode, source.compilerVersion);
      console.log(`[Stage 2] Slither found ${findings.length} raw findings`);

      // AI enrichment for high/critical
      if (this.ai.isAvailable) {
        const significant = findings.filter(f => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER['high']);
        if (significant.length > 0) {
          console.log(`[Stage 2] Running AI analysis on ${significant.length} significant findings`);
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

      // ── Stage 3: FALSE POSITIVE FILTERING ──
      console.log(`[Stage 3] Filtering known false positive patterns`);
      const { real, falsePositives } = this.context.filterFalsePositives(findings, source.sourceCode);
      if (falsePositives.length > 0) {
        console.log(`[Stage 3] Filtered ${falsePositives.length} false positives:`);
        for (const fp of falsePositives) {
          console.log(`  - ${fp.finding.detectorName}: ${fp.reason}`);
        }
      }

      // Also filter out AI-identified false positives
      const afterAiFilter = real.filter(f => f.aiIsFalsePositive !== true);
      const aiFiltered = real.length - afterAiFilter.length;
      if (aiFiltered > 0) {
        console.log(`[Stage 3] AI filtered ${aiFiltered} additional false positives`);
      }

      // Deduplicate
      const deduplicated = this.deduplicator.deduplicate(afterAiFilter);
      console.log(`[Stage 3] ${deduplicated.length} findings after deduplication`);

      // ── Stage 4: VERIFICATION (PoC on fork) ──
      console.log(`[Stage 4] Verification & PoC testing`);
      const verifiedFindings: VerifiedFinding[] = [];

      for (const finding of deduplicated) {
        // Attempt PoC for critical/high findings
        let pocResult = null;
        if (SEVERITY_ORDER[finding.severity] >= SEVERITY_ORDER['high']) {
          pocResult = await this.verifier.verify(finding, address, chainId);
          if (pocResult?.attempted) {
            console.log(`[Stage 4] PoC for ${finding.detectorName}: ${pocResult.succeeded ? 'SUCCEEDED' : 'failed'}`);
          }
        }

        // ── Stage 5: RISK SCORING ──
        const isFPPattern = this.context.checkFalsePositive(finding, source.sourceCode) !== null;
        const toolsAgreeing = [finding.tool]; // Extend when more analysis tools added

        const confidenceScore = this.context.computeConfidenceScore(
          finding,
          contextInfo,
          toolsAgreeing,
          pocResult?.succeeded ?? null,
        );

        const verificationStatus = this.context.determineVerificationStatus(
          confidenceScore,
          pocResult?.succeeded ?? null,
          isFPPattern,
          toolsAgreeing.length,
        );

        const verified: VerifiedFinding = {
          ...finding,
          verificationStatus,
          confidenceScore,
          pocResult,
          contextInfo,
          toolsAgreeing,
        };

        verifiedFindings.push(verified);
      }

      // Log Stage 5 summary
      const statusCounts = verifiedFindings.reduce<Record<string, number>>((acc, f) => {
        acc[f.verificationStatus] = (acc[f.verificationStatus] ?? 0) + 1;
        return acc;
      }, {});
      console.log(`[Stage 5] Risk scoring complete:`);
      for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`  ${statusIcon(status as VerificationStatus)} ${status}: ${count}`);
      }

      // Save all findings
      for (const finding of findings) {
        finding.scanId = scan.id;
        finding.contractId = contractId;
        await this.db.saveFinding(finding);
      }
      await this.db.updateScanStatus(scan.id, 'completed');

      // ── Stage 6: SMART ALERTING ──
      // Only alert on verified or likely_real findings that meet severity threshold
      const alertable = verifiedFindings.filter(f =>
        (f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real') &&
        SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[this.config.alertMinSeverity]
      );

      console.log(`[Stage 6] ${alertable.length} findings qualify for alerting`);

      if (alertable.length > 0) {
        await this.telegram.sendBatchSummary(alertable, address, chainName, source.name);
        for (const finding of alertable.filter(f => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER['high'])) {
          await this.telegram.sendFindingAlert(finding, address, chainName);
        }
      }

      return verifiedFindings;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.db.updateScanStatus(scan.id, 'failed', msg);
      throw err;
    }
  }

  /**
   * List top protocols on a chain by TVL.
   */
  async listProtocols(chainName: string, minTvl: number, limit = 50): Promise<Array<{ name: string; tvl: number; slug: string }>> {
    const protocols = await this.defillama.getTopProtocols(
      chainName.toLowerCase(),
      minTvl,
      limit,
    );

    return protocols.map(p => ({
      name: p.name,
      tvl: p.chainTvls?.[capitalize(chainName)] ?? p.tvl ?? 0,
      slug: p.slug,
    }));
  }

  private async scanChain(chainName: string): Promise<ChainScanResult> {
    const chainConfig = CHAINS[chainName.toLowerCase()];
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chainName}`);
    }

    console.log(`\n[Scanner] Discovering protocols on ${chainName} (min TVL: $${this.config.minTvlThreshold})`);

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
      verified: 0,
      likelyReal: 0,
      falsePositives: 0,
      alerts: 0,
    };

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

export interface ScanSummary {
  chainsScanned: number;
  protocolsDiscovered: number;
  contractsAnalyzed: number;
  totalFindings: number;
  verifiedFindings: number;
  likelyRealFindings: number;
  falsePositivesFiltered: number;
  alertsSent: number;
  errors: string[];
}

interface ChainScanResult {
  protocols: number;
  contracts: number;
  findings: number;
  verified: number;
  likelyReal: number;
  falsePositives: number;
  alerts: number;
}

function statusIcon(status: VerificationStatus): string {
  switch (status) {
    case 'verified': return '\u2705';
    case 'likely_real': return '\u26A0\uFE0F';
    case 'needs_review': return '\u{1F50D}';
    case 'likely_false': return '\u274C';
    case 'false_positive': return '\u26AA';
  }
}
