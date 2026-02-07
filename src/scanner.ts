import type { Config } from './config.js';
import { EtherscanClient } from './clients/etherscan.js';
import { DeFiLlamaClient } from './clients/defillama.js';
import { SlitherAnalyzer } from './analyzers/slither.js';
import { AIAnalyzer } from './analyzers/ai-analyzer.js';
import { FindingDeduplicator } from './analyzers/deduplicator.js';
import { LocalFPFilter } from './analyzers/local-fp-filter.js';
import { ContextService } from './services/context.js';
import { PoCVerifier } from './services/verifier.js';
import { ExploitEstimator, formatExploitValue, exploitValueIcon, estimateBounty } from './services/exploitEstimator.js';
import { EnhancedExploitVerifier } from './services/exploitVerifier.js';
import type { EnhancedVerificationResult } from './services/exploitVerifier.js';
import { WalletManager } from './services/walletManager.js';
import { PatternCache } from './services/patternCache.js';
import { ForkHunter } from './services/forkHunter.js';
import { SelfEvolutionEngine } from './services/selfEvolution.js';
import { ChainDiscoveryService } from './services/chains.js';
import type { DynamicChainConfig } from './services/chains.js';
import { TelegramAlertService } from './alerts/telegram.js';
import { Database } from './database.js';
import { CHAINS, SEVERITY_ORDER } from './types/index.js';
import type { Contract, Finding, VerifiedFinding, VerificationStatus, ExploitEstimate, ForkHuntResult } from './types/index.js';
import { EXPLOIT_VALUE_THRESHOLDS } from './types/index.js';
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
  private readonly localFpFilter: LocalFPFilter;
  private readonly context: ContextService;
  private readonly verifier: PoCVerifier;
  private readonly exploitEstimator: ExploitEstimator;
  private readonly enhancedVerifier: EnhancedExploitVerifier;
  private readonly walletManager: WalletManager | null;
  readonly patternCache: PatternCache;
  readonly forkHunter: ForkHunter;
  readonly evolutionEngine: SelfEvolutionEngine;
  readonly chainDiscovery: ChainDiscoveryService;
  private readonly telegram: TelegramAlertService;
  private readonly db: Database;
  private readonly config: Config;

  constructor(config: Config, walletManager?: WalletManager | null) {
    this.config = config;
    this.etherscan = new EtherscanClient(config.etherscanApiKey, config.etherscanRequestIntervalMs);
    this.defillama = new DeFiLlamaClient(config.defiLlamaCacheTtlMs);
    this.slither = new SlitherAnalyzer();
    this.ai = new AIAnalyzer(config.anthropicApiKey);
    this.deduplicator = new FindingDeduplicator();
    this.localFpFilter = new LocalFPFilter();
    this.context = new ContextService();
    this.verifier = new PoCVerifier();
    this.exploitEstimator = new ExploitEstimator();
    this.walletManager = walletManager ?? null;
    this.enhancedVerifier = new EnhancedExploitVerifier(this.walletManager);
    this.patternCache = new PatternCache();
    this.forkHunter = new ForkHunter(
      this.patternCache,
      this.etherscan,
      this.defillama,
      this.chainDiscovery = new ChainDiscoveryService(),
      this.verifier,
      this.exploitEstimator,
    );
    this.evolutionEngine = new SelfEvolutionEngine(this.patternCache);
    this.telegram = new TelegramAlertService(config.telegramBotToken, config.telegramChatId);
    this.db = new Database(config.databaseUrl);
  }

  /**
   * Run a full scan cycle across all configured chains.
   */
  async runFullScan(): Promise<ScanSummary> {
    console.log('=== Starting full scan cycle ===');
    console.log(`  PoC verification: ${this.verifier.isAvailable ? 'enabled' : 'disabled (no Foundry or RPC URLs)'}`);
    console.log(`  Wallet verification: ${this.walletManager?.isUnlocked() ? 'enabled (4-stage)' : 'disabled (no wallet)'}`);
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
      totalExploitableValue: 0,
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
      // Use per-function FP filter (checks if the SPECIFIC function has protection)
      console.log(`[Stage 3] Filtering false positives (per-function analysis)`);
      const { real, falsePositives } = this.localFpFilter.filterFindings(findings, source.sourceCode);
      if (falsePositives.length > 0) {
        console.log(`[Stage 3] Filtered ${falsePositives.length} false positives:`);
        for (const fp of falsePositives) {
          const protection = fp.protection ? ` [${fp.protection}]` : '';
          console.log(`  - ${fp.finding.detectorName}: ${fp.reason}${protection}`);
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

      // ── Stage 4: VERIFICATION (PoC on fork + optional wallet stages) ──
      const useEnhancedVerification = this.walletManager?.isUnlocked() === true;
      console.log(`[Stage 4] Verification & PoC testing${useEnhancedVerification ? ' (4-stage wallet pipeline)' : ''}`);
      const verifiedFindings: VerifiedFinding[] = [];
      const enhancedResults = new Map<string, EnhancedVerificationResult>();

      for (const finding of deduplicated) {
        // Attempt PoC for critical/high findings
        let pocResult = null;
        if (SEVERITY_ORDER[finding.severity] >= SEVERITY_ORDER['high']) {
          if (useEnhancedVerification) {
            // 4-stage wallet-based verification
            const enhanced = await this.enhancedVerifier.verify(finding, address, chainId, source.sourceCode);
            pocResult = enhanced.pocResult;
            enhancedResults.set(finding.id, enhanced);
            const stageLabel = enhanced.stage.replace(/_/g, ' ');
            console.log(`[Stage 4] Enhanced verification for ${finding.detectorName}: ${enhanced.verified ? 'VERIFIED' : 'failed'} (${stageLabel}, ${enhanced.confidence} confidence)`);
          } else {
            pocResult = await this.verifier.verify(finding, address, chainId);
            if (pocResult?.attempted) {
              console.log(`[Stage 4] PoC for ${finding.detectorName}: ${pocResult.succeeded ? 'SUCCEEDED' : 'failed'}`);
            }
          }
        }

        // ── Stage 5: RISK SCORING ──
        const isFPPattern = this.context.checkFalsePositive(finding, source.sourceCode) !== null;
        const toolsAgreeing = [finding.tool]; // Extend when more analysis tools added

        // If enhanced verification failed at wallet_sim stage, reduce confidence
        const enhancedResult = enhancedResults.get(finding.id);
        const pocSucceeded = enhancedResult
          ? enhancedResult.verified
          : (pocResult?.succeeded ?? null);

        const confidenceScore = this.context.computeConfidenceScore(
          finding,
          contextInfo,
          toolsAgreeing,
          pocSucceeded,
        );

        const verificationStatus = this.context.determineVerificationStatus(
          confidenceScore,
          pocSucceeded,
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
          exploitEstimate: null,
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

      // ── Stage 5b: EXPLOIT VALUE ESTIMATION ──
      const actionableFindings = verifiedFindings.filter(f =>
        f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real',
      );
      if (actionableFindings.length > 0) {
        console.log(`[Stage 5b] Estimating exploitable value for ${actionableFindings.length} actionable findings`);
        const contract: Contract = {
          id: contractId,
          address,
          chainId,
          name: source.name,
          sourceCode: source.sourceCode,
          abi: [],
          compilerVersion: source.compilerVersion,
          isProxy: source.isProxy,
          implementationAddress: source.implementationAddress,
          tvlUsd: null,
          protocolName: null,
        };

        for (const finding of actionableFindings) {
          try {
            finding.exploitEstimate = await this.exploitEstimator.estimate(finding, contract, chainId);
            const est = finding.exploitEstimate;
            const valueStr = formatExploitValue(est.estimatedExploitable, est.breakdown.atRiskFunds);
            console.log(`[Stage 5b] ${finding.detectorName}: ${valueStr} (${est.confidence} confidence)`);
          } catch (err) {
            console.warn(`[Stage 5b] Failed to estimate value for ${finding.detectorName}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        const totalExploitable = actionableFindings.reduce(
          (sum, f) => sum + (f.exploitEstimate?.estimatedExploitable ?? 0), 0,
        );
        if (totalExploitable > 0) {
          console.log(`[Stage 5b] Total exploitable value: $${totalExploitable.toLocaleString()}`);
        }
      }

      // ── Stage 5c: PATTERN LEARNING & FORK HUNTING ──
      const verifiedOrLikely = verifiedFindings.filter(
        f => f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real',
      );
      let forkHuntResults: ForkHuntResult[] = [];

      if (verifiedOrLikely.length > 0) {
        console.log(`[Stage 5c] Learning patterns from ${verifiedOrLikely.length} actionable findings`);

        // Learn patterns from each verified finding
        for (const vf of verifiedOrLikely) {
          try {
            const fingerprint = this.patternCache.generateFingerprint(address, chainId, source.name, source.sourceCode);
            this.patternCache.saveFingerprint(fingerprint);
            const pattern = this.patternCache.learnPattern(vf, address, chainId, source.sourceCode);
            console.log(`[Stage 5c] Pattern ${pattern.id.slice(0, 8)} learned (type: ${pattern.patternType}, instances: ${this.patternCache.getPatternInstances(pattern.id).length})`);
          } catch (err) {
            console.warn(`[Stage 5c] Pattern learning failed for ${vf.detectorName}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // Hunt for forks of verified findings (critical/high only to save API calls)
        const highValueVerified = verifiedOrLikely.filter(
          f => f.verificationStatus === 'verified' &&
               SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER['high'] &&
               (f.exploitEstimate?.estimatedExploitable ?? 0) >= 25_000,
        );

        if (highValueVerified.length > 0) {
          console.log(`[Stage 5c] Hunting forks for ${highValueVerified.length} high-value verified findings`);
          for (const vf of highValueVerified.slice(0, 3)) { // Max 3 fork hunts per scan
            try {
              const result = await this.forkHunter.huntForks(vf, address, chainId, source.sourceCode, source.name);
              forkHuntResults.push(result);
              if (result.verifiedVulnerable.length > 0) {
                console.log(`[Stage 5c] Fork hunt found ${result.verifiedVulnerable.length} vulnerable forks ($${result.totalValueAtRisk.toLocaleString()} total)`);
              }
            } catch (err) {
              console.warn(`[Stage 5c] Fork hunt failed for ${vf.detectorName}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

        // Record audit in pattern cache
        this.patternCache.recordAudit(
          address, chainId, source.name,
          findings.length, verifiedOrLikely.filter(f => f.verificationStatus === 'verified').length,
          falsePositives.length, verifiedOrLikely.reduce((s, f) => s + (f.exploitEstimate?.estimatedExploitable ?? 0), 0),
          Date.now(), ['slither'],
        );
      }

      // Save all findings
      for (const finding of findings) {
        finding.scanId = scan.id;
        finding.contractId = contractId;
        await this.db.saveFinding(finding);
      }
      await this.db.updateScanStatus(scan.id, 'completed');

      // ── Stage 6: SMART ALERTING ──
      // Alert based on verification status AND exploitable value thresholds
      const alertable = verifiedFindings.filter(f => {
        const isActionable = f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real';
        if (!isActionable) return false;
        if (SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[this.config.alertMinSeverity]) return false;

        // Value-based filtering: skip low-value findings
        const exploitable = f.exploitEstimate?.estimatedExploitable ?? 0;
        if (exploitable > 0 && exploitable < EXPLOIT_VALUE_THRESHOLDS.logged.minExploitable) {
          console.log(`[Stage 6] Skipping ${f.detectorName}: $${exploitable.toFixed(0)} below $1K threshold`);
          return false;
        }

        return true;
      });

      // Separate into high-value (immediate alert) vs standard
      const criticalValue = alertable.filter(f =>
        (f.exploitEstimate?.estimatedExploitable ?? 0) >= EXPLOIT_VALUE_THRESHOLDS.critical.minExploitable ||
        f.verificationStatus === 'verified',
      );
      const standardValue = alertable.filter(f =>
        !criticalValue.includes(f) &&
        (f.exploitEstimate?.estimatedExploitable ?? 0) >= EXPLOIT_VALUE_THRESHOLDS.high.minExploitable,
      );

      console.log(`[Stage 6] ${alertable.length} findings qualify for alerting (${criticalValue.length} critical value, ${standardValue.length} standard)`);

      if (alertable.length > 0) {
        // Send detailed alerts for critical-value and verified findings
        for (const finding of [...criticalValue, ...standardValue]) {
          const enhanced = enhancedResults.get(finding.id);
          if (enhanced && enhanced.verified) {
            // 4-stage wallet-verified alert
            await this.telegram.sendEnhancedVerificationAlert(
              finding,
              address,
              chainName,
              source.name,
              enhanced.verificationChain,
              enhanced.exploitableValue.confirmed,
              enhanced.confidence,
              this.walletManager?.getAddress(),
            );
          } else {
            await this.telegram.sendExploitValueAlert(finding, address, chainName, source.name);
          }
        }
        // Batch summary
        await this.telegram.sendVerifiedBatchSummary(verifiedFindings, address, chainName, source.name);
      }

      // Send fork hunt results if any forks were found
      for (const hunt of forkHuntResults) {
        if (hunt.verifiedVulnerable.length > 0) {
          await this.telegram.sendForkHuntResult(hunt, address, chainName, source.name);
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

  /**
   * Scan top N chains by TVL using dynamic chain discovery.
   */
  async scanTopChains(topN: number, minTvl?: number): Promise<ScanSummary> {
    console.log(`=== Scanning top ${topN} chains by TVL ===`);

    const chains = await this.chainDiscovery.getTopChainsByTvl(topN);
    console.log(`  Discovered ${chains.length} scannable chains\n`);

    const tvlThreshold = minTvl ?? this.config.minTvlThreshold;

    const summary: ScanSummary = {
      chainsScanned: 0,
      protocolsDiscovered: 0,
      contractsAnalyzed: 0,
      totalFindings: 0,
      verifiedFindings: 0,
      likelyRealFindings: 0,
      falsePositivesFiltered: 0,
      alertsSent: 0,
      totalExploitableValue: 0,
      errors: [],
    };

    for (const chain of chains) {
      try {
        console.log(`\n[Scanner] Scanning ${chain.name} (TVL: ${formatTvlShort(chain.tvl)}, chain ID: ${chain.chainId})`);
        const chainResult = await this.scanChainDynamic(chain, tvlThreshold);
        summary.chainsScanned++;
        summary.protocolsDiscovered += chainResult.protocols;
        summary.contractsAnalyzed += chainResult.contracts;
        summary.totalFindings += chainResult.findings;
        summary.verifiedFindings += chainResult.verified;
        summary.likelyRealFindings += chainResult.likelyReal;
        summary.falsePositivesFiltered += chainResult.falsePositives;
        summary.alertsSent += chainResult.alerts;
      } catch (err) {
        const msg = `Chain ${chain.name}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[Scanner] Error scanning chain: ${msg}`);
        summary.errors.push(msg);
      }
    }

    console.log('\n=== Top chain scan complete ===');
    console.log(`  Chains: ${summary.chainsScanned}/${chains.length}`);
    console.log(`  Protocols: ${summary.protocolsDiscovered}, Contracts: ${summary.contractsAnalyzed}`);
    console.log(`  Verified: ${summary.verifiedFindings}, Likely real: ${summary.likelyRealFindings}`);
    console.log(`  FPs filtered: ${summary.falsePositivesFiltered}, Alerts: ${summary.alertsSent}`);

    return summary;
  }

  /**
   * Scan a dynamic chain config (from chain discovery).
   */
  private async scanChainDynamic(chain: DynamicChainConfig, minTvl: number): Promise<ChainScanResult> {
    const protocols = await this.defillama.getTopProtocols(
      chain.slug,
      minTvl,
      50,
    );

    console.log(`[Scanner] Found ${protocols.length} protocols on ${chain.name} (min TVL: $${(minTvl / 1e6).toFixed(1)}M)`);

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
      const tvl = protocol.chainTvls?.[capitalize(chain.slug)] ?? protocol.tvl ?? 0;
      console.log(`  - ${protocol.name}: $${(tvl / 1e6).toFixed(1)}M TVL`);
    }

    return result;
  }

  private async scanChain(chainName: string): Promise<ChainScanResult> {
    const chainConfig = CHAINS[chainName.toLowerCase()];
    if (!chainConfig) {
      // Try dynamic chain discovery
      const dynChain = this.chainDiscovery.getChainConfig(chainName);
      if (dynChain) {
        return this.scanChainDynamic(dynChain, this.config.minTvlThreshold);
      }
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
    this.walletManager?.destroy();
    this.patternCache.close();
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
  totalExploitableValue: number; // USD
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

function formatTvlShort(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}
