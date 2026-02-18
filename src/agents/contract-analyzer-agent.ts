/**
 * WHITE RABBIT - Contract Analyzer Agent
 * 
 * OPTIMAL Architecture for Autonomous Analysis:
 * 1. Fast Triage (Slither + Pattern) - 2-3 seconds
 * 2. Risk Scoring - Prioritize interesting contracts
 * 3. Parallel Deep Analysis - Run heavy tools concurrently
 * 4. Adaptive Strategy - Focus on specific vulnerability classes
 * 5. Caching - Never re-analyze same contract
 * 
 * This complements WhiteClaws by providing intelligent
 * contract selection and focused deep analysis.
 */

import { AnalysisPipeline } from '../analyzers/analysis-pipeline.js';
import { SlitherAnalyzer } from '../analyzers/slither.js';
import { MythrilAnalyzer } from '../analyzers/mythril.js';
import { SecurifyAnalyzer } from '../analyzers/securify.js';
import { MaianAnalyzer } from '../analyzers/maian.js';
import { patternAnalyzer } from '../analyzers/patternAnalyzer.js';
import { AIAnalyzer } from '../analyzers/ai-analyzer.js';
import { localFpFilter } from '../analyzers/local-fp-filter.js';
import { FindingDeduplicator } from '../analyzers/deduplicator.js';
import type { Contract, Finding, Severity } from '../types/index.js';
import { serviceLogger } from '../core/logger.js';
import { getLocalDatabase } from '../core/database-sqlite.js';

export interface AgentStrategy {
  name: string;
  targetVulnerabilities: string[];
  minSeverity: Severity;
  tools: ('slither' | 'pattern' | 'mythril' | 'securify' | 'maian' | 'ai')[];
  maxExecutionTimeMs: number;
}

export interface TriageResult {
  contract: Contract;
  riskScore: number;
  interesting: boolean;
  reasons: string[];
  quickFindings: Finding[];
}

export interface DeepAnalysisResult {
  contract: Contract;
  findings: Finding[];
  strategy: AgentStrategy;
  executionTimeMs: number;
  toolsUsed: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface AgentConfig {
  mode: 'triage-only' | 'focused' | 'comprehensive' | 'adaptive';
  maxConcurrentDeepAnalyses: number;
  enableCaching: boolean;
  cacheDurationHours: number;
  targetCategories?: string[];
  excludePatterns?: string[];
  minRiskScore: number;
}

/**
 * Predefined Analysis Strategies
 */
export const AnalysisStrategies = {
  /**
   * DeFi Protocol Strategy
   * Focus on financial vulnerabilities
   */
  defi: (): AgentStrategy => ({
    name: 'defi-focused',
    targetVulnerabilities: [
      'reentrancy', 'flash-loan', 'price-oracle-manipulation',
      'arithmetic-overflow', 'access-control', 'dao',
    ],
    minSeverity: 'medium',
    tools: ['slither', 'pattern', 'mythril', 'securify'],
    maxExecutionTimeMs: 600000, // 10 minutes
  }),

  /**
   * NFT/Gaming Strategy
   * Focus on access control and logic bugs
   */
  nft: (): AgentStrategy => ({
    name: 'nft-focused',
    targetVulnerabilities: [
      'access-control', 'reentrancy', 'randomness',
      'integer-overflow', 'unchecked-calls',
    ],
    minSeverity: 'medium',
    tools: ['slither', 'pattern', 'maian', 'ai'],
    maxExecutionTimeMs: 300000, // 5 minutes
  }),

  /**
   * Governance Strategy
   * Focus on privileged operations
   */
  governance: (): AgentStrategy => ({
    name: 'governance-focused',
    targetVulnerabilities: [
      'unrestricted-selfdestruct', 'access-control',
      'timestamp-dependence', 'unchecked-delegatecall',
    ],
    minSeverity: 'high',
    tools: ['slither', 'securify', 'maian'],
    maxExecutionTimeMs: 400000, // 4 minutes
  }),

  /**
   * Comprehensive Strategy
   * All tools, all vulnerabilities
   */
  comprehensive: (): AgentStrategy => ({
    name: 'comprehensive',
    targetVulnerabilities: ['*'],
    minSeverity: 'low',
    tools: ['slither', 'pattern', 'mythril', 'securify', 'maian', 'ai'],
    maxExecutionTimeMs: 1200000, // 20 minutes
  }),

  /**
   * Fast Triage Only
   * Just quick screening
   */
  triage: (): AgentStrategy => ({
    name: 'triage-only',
    targetVulnerabilities: ['*'],
    minSeverity: 'medium',
    tools: ['slither', 'pattern'],
    maxExecutionTimeMs: 30000, // 30 seconds
  }),
};

/**
 * Contract Analyzer Agent
 * 
 * Intelligent contract analysis with:
 * - Fast triage to identify interesting targets
 * - Risk-based prioritization
 * - Parallel deep analysis
 * - Adaptive strategy selection
 * - Result caching
 */
export class ContractAnalyzerAgent {
  private slither = new SlitherAnalyzer();
  private mythril = new MythrilAnalyzer();
  private securify = new SecurifyAnalyzer();
  private maian = new MaianAnalyzer();
  private deduplicator = new FindingDeduplicator();
  private db = getLocalDatabase();
  
  private config: AgentConfig;
  private activeAnalyses = new Map<string, Promise<DeepAnalysisResult>>();

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = {
      mode: 'adaptive',
      maxConcurrentDeepAnalyses: 3,
      enableCaching: true,
      cacheDurationHours: 24,
      minRiskScore: 30,
      ...config,
    };
  }

  /**
   * MAIN ENTRY POINT
   * 
   * Agent picks a contract and conducts optimal analysis:
   * 1. Check cache
   * 2. Fast triage
   * 3. Score risk
   * 4. Decide: skip, quick report, or deep analysis
   * 5. Execute chosen strategy
   */
  async analyze(contract: Contract): Promise<DeepAnalysisResult | null> {
    const address = contract.address;
    
    serviceLogger.info('Agent analyzing contract', {
      address,
      chainId: contract.chainId,
      name: contract.name,
      mode: this.config.mode,
    });

    // Step 1: Check cache
    if (this.config.enableCaching) {
      const cached = await this.getCachedAnalysis(address);
      if (cached) {
        serviceLogger.info('Using cached analysis', { address });
        return cached;
      }
    }

    // Step 2: Fast Triage (2-3 seconds)
    const triage = await this.triage(contract);
    
    if (!triage.interesting) {
      serviceLogger.info('Contract not interesting, skipping deep analysis', {
        address,
        riskScore: triage.riskScore,
        reasons: triage.reasons,
      });
      return null;
    }

    // Step 3: Select Strategy
    const strategy = this.selectStrategy(contract, triage);
    
    serviceLogger.info('Selected analysis strategy', {
      address,
      strategy: strategy.name,
      riskScore: triage.riskScore,
    });

    // Step 4: Deep Analysis
    const result = await this.executeStrategy(contract, strategy, triage.quickFindings);
    
    // Step 5: Cache result
    if (this.config.enableCaching) {
      await this.cacheAnalysis(address, result);
    }

    return result;
  }

  /**
   * FAST TRIAGE
   * 
   * Quick 2-3 second analysis to determine if contract is interesting
   */
  private async triage(contract: Contract): Promise<TriageResult> {
    const start = Date.now();
    
    // Quick Slither scan
    const slitherFindings = await this.slither.analyze(
      contract.address,
      contract.chainId,
      contract.sourceCode,
      contract.compilerVersion
    );

    // Pattern matching
    const patternFindings = patternAnalyzer.analyze(
      contract.address,
      contract.sourceCode,
      contract.name
    );

    const allFindings = [...slitherFindings, ...patternFindings];
    
    // Filter false positives
    const filtered = localFpFilter(allFindings, contract.sourceCode).passed;

    // Calculate risk score
    const { score, reasons } = this.calculateRiskScore(contract, filtered);

    const triageResult: TriageResult = {
      contract,
      riskScore: score,
      interesting: score >= this.config.minRiskScore,
      reasons,
      quickFindings: filtered,
    };

    serviceLogger.info('Triage complete', {
      address: contract.address,
      riskScore: score,
      interesting: triageResult.interesting,
      executionTimeMs: Date.now() - start,
    });

    return triageResult;
  }

  /**
   * Calculate Risk Score (0-100)
   */
  private calculateRiskScore(contract: Contract, findings: Finding[]): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Base score from findings
    for (const finding of findings) {
      switch (finding.severity) {
        case 'critical': score += 40; reasons.push(`Critical: ${finding.detectorName}`); break;
        case 'high': score += 25; reasons.push(`High: ${finding.detectorName}`); break;
        case 'medium': score += 10; reasons.push(`Medium: ${finding.detectorName}`); break;
        case 'low': score += 3; break;
      }
    }

    // TVL multiplier
    if (contract.tvlUsd) {
      if (contract.tvlUsd > 100_000_000) { score += 30; reasons.push('High TVL (>$100M)'); }
      else if (contract.tvlUsd > 10_000_000) { score += 20; reasons.push('Medium TVL (>$10M)'); }
      else if (contract.tvlUsd > 1_000_000) { score += 10; reasons.push('Low TVL (>$1M)'); }
    }

    // Contract complexity
    const lines = contract.sourceCode.split('\n').length;
    if (lines > 500) { score += 10; reasons.push('Complex contract (>500 lines)'); }
    else if (lines > 200) { score += 5; reasons.push('Moderate complexity (>200 lines)'); }

    // DeFi category bonus
    if (contract.protocolName?.toLowerCase().includes('defi') ||
        contract.sourceCode.includes('transfer') ||
        contract.sourceCode.includes('swap')) {
      score += 10;
      reasons.push('DeFi patterns detected');
    }

    // Cap at 100
    score = Math.min(100, score);

    return { score, reasons };
  }

  /**
   * Select Analysis Strategy based on contract type and triage
   */
  private selectStrategy(contract: Contract, triage: TriageResult): AgentStrategy {
    // Check if mode forces specific strategy
    if (this.config.mode === 'triage-only') {
      return AnalysisStrategies.triage();
    }
    if (this.config.mode === 'comprehensive') {
      return AnalysisStrategies.comprehensive();
    }

    // Adaptive strategy selection
    const sourceLower = contract.sourceCode.toLowerCase();

    // DeFi detection
    if (sourceLower.includes('erc20') ||
        sourceLower.includes('swap') ||
        sourceLower.includes('pool') ||
        sourceLower.includes('liquidity') ||
        sourceLower.includes('yield') ||
        sourceLower.includes('lending')) {
      return AnalysisStrategies.defi();
    }

    // NFT detection
    if (sourceLower.includes('erc721') ||
        sourceLower.includes('erc1155') ||
        sourceLower.includes('nft') ||
        sourceLower.includes('mint')) {
      return AnalysisStrategies.nft();
    }

    // Governance detection
    if (sourceLower.includes('governor') ||
        sourceLower.includes('proposal') ||
        sourceLower.includes('vote') ||
        sourceLower.includes('timelock')) {
      return AnalysisStrategies.governance();
    }

    // High risk = comprehensive
    if (triage.riskScore >= 70) {
      return AnalysisStrategies.comprehensive();
    }

    // Default
    return AnalysisStrategies.defi();
  }

  /**
   * Execute Selected Strategy
   * 
   * Runs tools in parallel for efficiency
   */
  private async executeStrategy(
    contract: Contract,
    strategy: AgentStrategy,
    triageFindings: Finding[]
  ): Promise<DeepAnalysisResult> {
    const start = Date.now();
    const toolPromises: Promise<Finding[]>[] = [];
    const toolsUsed: string[] = [];

    serviceLogger.info('Executing analysis strategy', {
      address: contract.address,
      strategy: strategy.name,
      tools: strategy.tools,
    });

    // Always include triage findings
    const allFindings: Finding[] = [...triageFindings];

    // Launch tools in parallel
    for (const tool of strategy.tools) {
      // Skip tools already run in triage
      if (tool === 'slither' || tool === 'pattern') continue;

      const promise = this.runTool(tool, contract, strategy);
      toolPromises.push(promise);
      toolsUsed.push(tool);
    }

    // Wait for all tools with timeout
    const timeout = strategy.maxExecutionTimeMs;
    const results = await Promise.allSettled(
      toolPromises.map(p => this.withTimeout(p, timeout, 'tool'))
    );

    // Collect findings
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allFindings.push(...result.value);
      } else {
        serviceLogger.warn('Tool failed', { error: result.reason });
      }
    }

    // Deduplicate
    const deduplicated = this.deduplicator.deduplicate(allFindings);

    // Calculate confidence
    const confidence = this.calculateConfidence(deduplicated, toolsUsed);

    const executionTimeMs = Date.now() - start;

    serviceLogger.info('Strategy execution complete', {
      address: contract.address,
      strategy: strategy.name,
      totalFindings: deduplicated.length,
      toolsUsed,
      executionTimeMs,
      confidence,
    });

    return {
      contract,
      findings: deduplicated,
      strategy,
      executionTimeMs,
      toolsUsed,
      confidence,
    };
  }

  /**
   * Run a specific analysis tool
   */
  private async runTool(
    tool: string,
    contract: Contract,
    strategy: AgentStrategy
  ): Promise<Finding[]> {
    switch (tool) {
      case 'mythril':
        return this.mythril.analyze(
          contract.address,
          contract.chainId,
          contract.sourceCode,
          contract.compilerVersion,
          { maxTransactions: 3, executionTimeout: 300 }
        );

      case 'securify':
        return this.securify.analyze(
          contract.address,
          contract.sourceCode,
          contract.name,
          { includeSeverity: ['Critical', 'High', 'Medium'] }
        );

      case 'maian':
        return this.maian.analyze(
          contract.address,
          contract.sourceCode,
          contract.name,
          { bugClasses: ['suicidal', 'prodigal', 'greedy'] }
        );

      case 'ai':
        // AI analysis would go here
        return [];

      default:
        return [];
    }
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(findings: Finding[], toolsUsed: string[]): 'low' | 'medium' | 'high' {
    if (toolsUsed.length >= 4) return 'high';
    if (toolsUsed.length >= 2) return 'medium';
    return 'low';
  }

  /**
   * Cache analysis result
   */
  private async cacheAnalysis(address: string, result: DeepAnalysisResult): Promise<void> {
    const key = `analysis:${address}`;
    const data = JSON.stringify({
      timestamp: Date.now(),
      result,
    });
    this.db.setIdentity(key, data);
  }

  /**
   * Get cached analysis
   */
  private async getCachedAnalysis(address: string): Promise<DeepAnalysisResult | null> {
    if (!this.config.enableCaching) return null;

    const key = `analysis:${address}`;
    const cached = this.db.getIdentity(key);
    if (!cached) return null;

    try {
      const { timestamp, result } = JSON.parse(cached);
      const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
      
      if (ageHours < this.config.cacheDurationHours) {
        return result;
      }
    } catch {
      // Invalid cache entry
    }

    return null;
  }

  /**
   * Timeout wrapper
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`${name} timeout`)), ms)
      ),
    ]);
  }

  /**
   * Batch analyze multiple contracts
   * 
   * Processes contracts in parallel with rate limiting
   */
  async analyzeBatch(contracts: Contract[]): Promise<(DeepAnalysisResult | null)[]> {
    serviceLogger.info('Batch analysis starting', { count: contracts.length });

    const results: (DeepAnalysisResult | null)[] = [];
    
    // Process in chunks to avoid overwhelming system
    const chunkSize = this.config.maxConcurrentDeepAnalyses;
    
    for (let i = 0; i < contracts.length; i += chunkSize) {
      const chunk = contracts.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(c => this.analyze(c));
      const chunkResults = await Promise.all(chunkPromises);
      
      results.push(...chunkResults);
      
      serviceLogger.info('Batch chunk complete', {
        processed: Math.min(i + chunkSize, contracts.length),
        total: contracts.length,
      });
    }

    return results;
  }
}

export default ContractAnalyzerAgent;
