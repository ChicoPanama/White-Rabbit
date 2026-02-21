// ═══════════════════════════════════════════════════════════════════════════════
// WhiteRabbit - High-level API
// Main entry point for @whiteclaws/white-rabbit npm package
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Contract,
  Finding,
  VerifiedFinding,
  ScanResult,
  ScanStats,
  ScannerConfig,
  ChainConfig,
  PipelineOptions,
  Severity,
  ScannerError,
  ContractNotVerifiedError,
  TimeoutError,
  WhiteClawsCredentials,
  ScanRequest,
  ScanResponse,
  getChainConfig,
} from '../types.js';

import { AnalysisPipeline } from '../engines/analysis-pipeline.js';
import { ContractResolver } from '../utils/contract-resolver.js';
import { WhiteClawsClient } from '../connectors/whiteclaws-client.js';
import { TelemetryEmitter } from '../telemetry/emitter.js';
import { EventEmitter } from 'events';

export interface ScanProgress {
  stage: 'resolving' | 'analyzing' | 'verifying' | 'complete';
  message: string;
  percentComplete: number;
  findingsFound: number;
}

export interface ScanOptions {
  /** Chain name or ID */
  chain?: string | number;
  /** Enable deep analysis with all tools */
  deep?: boolean;
  /** Enable specific engines */
  engines?: {
    slither?: boolean;
    pattern?: boolean;
    mythril?: boolean;
    securify?: boolean;
    maian?: boolean;
    ai?: boolean;
  };
  /** Timeout in milliseconds */
  timeout?: number;
  /** Minimum severity to report */
  minSeverity?: Severity;
  /** Callback for progress updates */
  onProgress?: (progress: ScanProgress) => void;
}

/**
 * WhiteRabbit - Smart Contract Security Scanner
 * 
 * High-level API for scanning Ethereum smart contracts for vulnerabilities.
 * Can run locally with available analysis tools or connect to whiteclaws.app API.
 * 
 * @example
 * ```typescript
 * import { WhiteRabbit } from '@whiteclaws/white-rabbit';
 * 
 * const scanner = new WhiteRabbit({
 *   etherscanApiKey: process.env.ETHERSCAN_API_KEY,
 *   enableDeepAnalysis: true
 * });
 * 
 * const findings = await scanner.scan('0x1234...', { chain: 'base' });
 * console.log(`Found ${findings.length} issues`);
 * ```
 */
export class WhiteRabbit extends EventEmitter {
  private config: ScannerConfig;
  private pipeline: AnalysisPipeline;
  private resolver: ContractResolver;
  private whiteclaws?: WhiteClawsClient;
  private telemetry: TelemetryEmitter;
  private isShuttingDown = false;

  constructor(config: ScannerConfig = {}) {
    super();
    this.config = {
      enableDeepAnalysis: false,
      enableAI: false,
      timeoutMs: 300000, // 5 minutes default
      ...config,
    };

    this.pipeline = new AnalysisPipeline(this.config);
    this.resolver = new ContractResolver({
      etherscanApiKey: config.etherscanApiKey,
    });

    if (config.whiteclawsApiKey) {
      this.whiteclaws = new WhiteClawsClient({
        apiKey: config.whiteclawsApiKey,
        baseUrl: config.whiteclawsApiUrl,
      });
    }

    this.telemetry = new TelemetryEmitter({
      enabled: config.enableTelemetry !== false && process.env.WR_TELEMETRY !== 'false',
      apiKey: config.whiteclawsApiKey,
      apiUrl: config.telemetryUrl,
      agentType: config.agentType || 'white-rabbit-skill',
    });
  }

  /**
   * Scan a contract for vulnerabilities
   * 
   * @param address - Contract address to scan
   * @param options - Scan options
   * @returns Array of verified findings
   */
  async scan(
    address: string,
    options: ScanOptions = {}
  ): Promise<VerifiedFinding[]> {
    if (this.isShuttingDown) {
      throw new ScannerError('Scanner is shutting down', 'SHUTDOWN');
    }

    const startTime = Date.now();
    
    // Resolve chain
    const chainId = this.resolveChain(options.chain);
    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new ScannerError(`Unknown chain: ${options.chain}`, 'INVALID_CHAIN');
    }

    // Report progress
    this.reportProgress(options, {
      stage: 'resolving',
      message: `Resolving contract ${address} on ${chain.name}...`,
      percentComplete: 10,
      findingsFound: 0,
    });

    // Resolve contract
    const contract = await this.resolver.resolve(address, chainId);
    if (!contract) {
      throw new ContractNotVerifiedError(address, chainId);
    }

    this.telemetry.emit({
      action: 'scan_started',
      target: {
        protocol_slug: contract.protocolName ? this.toSlug(contract.protocolName) : undefined,
        contract_address: contract.address,
        chain: chain.name,
      },
    });

    let intel = null;
    if (this.whiteclaws && contract.protocolName) {
      try {
        intel = await this.whiteclaws.getProtocolIntel(this.toSlug(contract.protocolName));
        if (intel) {
          this.emit('intelLoaded', {
            protocol: intel.name,
            patterns: intel.vulnerabilitySurface?.totalMatchingPatterns || 0,
          });
          this.telemetry.emit({
            action: 'patterns_loaded',
            target: {
              protocol_slug: intel.slug,
              contract_address: contract.address,
              contract_type: intel.vulnerabilitySurface?.contractType,
              chain: chain.name,
            },
            patterns: {
              loaded: intel.vulnerabilitySurface?.evmbenchPatternMatches?.length || 0,
              evmbench_matched: intel.vulnerabilitySurface?.totalMatchingPatterns || 0,
            },
          });
        }
      } catch {
        // Optional intel lookup. Scanning continues even if unavailable.
      }
    }

    this.emit('contractResolved', { contract, duration: Date.now() - startTime });

    // Run analysis
    this.reportProgress(options, {
      stage: 'analyzing',
      message: 'Running security analysis...',
      percentComplete: 30,
      findingsFound: 0,
    });

    const pipelineOptions = this.buildPipelineOptions(options);
    const result = await this.pipeline.analyze(contract, {
      ...pipelineOptions,
      intelContext: intel?.vulnerabilitySurface,
    });

    this.emit('analysisComplete', {
      contract,
      findings: result.findings,
      duration: Date.now() - startTime,
    });

    for (const finding of result.findings) {
      this.telemetry.emit({
        action: 'vulnerability_detected',
        target: {
          protocol_slug: contract.protocolName ? this.toSlug(contract.protocolName) : undefined,
          contract_address: contract.address,
          chain: chain.name,
          contract_type: intel?.vulnerabilitySurface?.contractType,
        },
        finding: {
          severity: finding.severity,
          category: finding.detectorName,
        },
      });
    }

    // Verify findings
    this.reportProgress(options, {
      stage: 'verifying',
      message: `Verifying ${result.findings.length} findings...`,
      percentComplete: 80,
      findingsFound: result.findings.length,
    });

    const verifiedFindings = await this.verifyFindings(
      result.findings,
      contract
    );

    this.reportProgress(options, {
      stage: 'complete',
      message: `Scan complete. Found ${verifiedFindings.length} verified issues.`,
      percentComplete: 100,
      findingsFound: verifiedFindings.length,
    });

    this.emit('scanComplete', {
      contract,
      findings: verifiedFindings,
      duration: Date.now() - startTime,
    });

    this.telemetry.emit({
      action: 'scan_complete',
      target: {
        protocol_slug: contract.protocolName ? this.toSlug(contract.protocolName) : undefined,
        contract_address: contract.address,
        chain: chain.name,
        contract_type: intel?.vulnerabilitySurface?.contractType,
      },
      patterns: {
        loaded: result.stats.total,
        matched: result.findings.length,
        evmbench_matched: intel?.vulnerabilitySurface?.totalMatchingPatterns || 0,
      },
      performance: {
        stage_duration_ms: Date.now() - startTime,
      },
    });
    await this.telemetry.flush();

    return verifiedFindings;
  }

  /**
   * Quick scan using only Slither + Pattern matching
   * Fast but less thorough than full scan.
   */
  async quickScan(
    address: string,
    chain?: string | number
  ): Promise<VerifiedFinding[]> {
    return this.scan(address, {
      chain,
      deep: false,
      engines: { slither: true, pattern: true },
    });
  }

  /**
   * Deep scan using all available analysis tools
   * Most thorough but slower.
   */
  async deepScan(
    address: string,
    chain?: string | number
  ): Promise<VerifiedFinding[]> {
    return this.scan(address, {
      chain,
      deep: true,
      engines: {
        slither: true,
        pattern: true,
        mythril: true,
        securify: true,
        maian: true,
      },
    });
  }

  /**
   * Scan via whiteclaws.app API (queued)
   * Returns immediately with scan ID. Results available via API.
   */
  async scanQueued(
    address: string,
    options: ScanOptions = {}
  ): Promise<ScanResponse> {
    if (!this.whiteclaws) {
      throw new ScannerError(
        'WhiteClaws API key required for queued scans',
        'MISSING_API_KEY'
      );
    }

    const chainId = this.resolveChain(options.chain);
    const pipelineOptions = this.buildPipelineOptions(options);

    return this.whiteclaws.queueScan({
      address,
      chain: chainId,
      options: pipelineOptions,
    });
  }

  /**
   * Get scan results from whiteclaws.app API
   */
  async getScanResults(scanId: string): Promise<ScanResult | null> {
    if (!this.whiteclaws) {
      throw new ScannerError(
        'WhiteClaws API key required',
        'MISSING_API_KEY'
      );
    }

    return this.whiteclaws.getScanResults(scanId);
  }

  /**
   * Check which analysis engines are available
   */
  async checkEngines(): Promise<Record<string, boolean>> {
    return this.pipeline.checkEngines();
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): ChainConfig[] {
    return Object.values(this.config.chains || getChainConfig('ethereum') ? 
      [getChainConfig('ethereum')!] : []);
  }

  /**
   * Configure the scanner after initialization
   */
  configure(config: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.etherscanApiKey) {
      this.resolver = new ContractResolver({
        etherscanApiKey: config.etherscanApiKey,
      });
    }

    if (config.whiteclawsApiKey && !this.whiteclaws) {
      this.whiteclaws = new WhiteClawsClient({
        apiKey: config.whiteclawsApiKey,
        baseUrl: config.whiteclawsApiUrl || this.config.whiteclawsApiUrl,
      });
    }
  }

  /**
   * Shutdown the scanner gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.emit('shutdown');
    await this.pipeline.shutdown();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private resolveChain(chain?: string | number): number {
    if (chain === undefined) {
      return 1; // Default to Ethereum
    }

    if (typeof chain === 'number') {
      return chain;
    }

    const config = getChainConfig(chain);
    return config?.id ?? 1;
  }

  private buildPipelineOptions(options: ScanOptions): PipelineOptions {
    const engines = options.engines || {};
    
    if (options.deep) {
      return {
        enableSlither: true,
        enablePattern: true,
        enableMythril: engines.mythril !== false,
        enableSecurify: engines.securify !== false,
        enableMaian: engines.maian !== false,
        enableAI: engines.ai !== false,
        timeoutMs: options.timeout || this.config.timeoutMs,
      };
    }

    return {
      enableSlither: engines.slither !== false,
      enablePattern: engines.pattern !== false,
      enableMythril: engines.mythril === true,
      enableSecurify: engines.securify === true,
      enableMaian: engines.maian === true,
      enableAI: engines.ai === true,
      timeoutMs: options.timeout || this.config.timeoutMs,
    };
  }

  private async verifyFindings(
    findings: Finding[],
    contract: Contract
  ): Promise<VerifiedFinding[]> {
    // Apply severity filter
    const minSeverity = this.config.minSeverity;
    let filtered = findings;
    
    if (minSeverity) {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, informational: 0 };
      const minLevel = severityOrder[minSeverity];
      filtered = findings.filter(f => severityOrder[f.severity] >= minLevel);
    }

    // Convert to verified findings with default verification
    return filtered.map(finding => ({
      ...finding,
      verificationStatus: this.determineVerificationStatus(finding),
      confidenceScore: this.calculateConfidenceScore(finding),
      pocResult: null,
      contextInfo: null,
      toolsAgreeing: finding.corroboratedBy || [finding.tool],
      exploitEstimate: null,
    }));
  }

  private determineVerificationStatus(finding: Finding): VerifiedFinding['verificationStatus'] {
    if (finding.aiIsFalsePositive) return 'false_positive';
    if (finding.corroboratedBy && finding.corroboratedBy.length >= 2) return 'likely_real';
    if (finding.confidence === 'high') return 'likely_real';
    if (finding.confidence === 'low') return 'needs_review';
    return 'needs_review';
  }

  private calculateConfidenceScore(finding: Finding): number {
    let score = 50;

    // Confidence from tool
    if (finding.confidence === 'high') score += 20;
    else if (finding.confidence === 'medium') score += 10;
    else if (finding.confidence === 'low') score -= 10;

    // Corroboration bonus
    if (finding.corroboratedBy) {
      score += finding.corroboratedBy.length * 15;
    }

    // AI assessment
    if (finding.aiIsFalsePositive === false) score += 15;
    if (finding.aiIsFalsePositive === true) score = 0;

    return Math.min(100, Math.max(0, score));
  }

  private reportProgress(
    options: ScanOptions,
    progress: ScanProgress
  ): void {
    if (options.onProgress) {
      options.onProgress(progress);
    }
    this.emit('progress', progress);
  }

  private toSlug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
}
