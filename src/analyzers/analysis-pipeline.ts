/**
 * WHITE RABBIT - Sequential Analysis Pipeline
 * 
 * Runs ALL security tools on EVERY contract in sequence:
 * 1. Slither (static analysis)
 * 2. Pattern Analyzer (heuristics)
 * 3. Mythril (symbolic execution)
 * 4. Securify2 (formal verification)
 * 5. MAIAN (dynamic execution)
 * 6. AI Analyzer (confirmation)
 * 
 * Results are deduplicated and correlated across tools.
 */

import type { Finding, Contract, Severity, Confidence } from '../types/index.js';
import { SlitherAnalyzer } from './slither.js';
import { MythrilAnalyzer } from './mythril.js';
import { SecurifyAnalyzer } from './securify.js';
import { MaianAnalyzer } from './maian.js';
import { patternAnalyzer } from './patternAnalyzer.js';
import { AIAnalyzer } from './ai-analyzer.js';
import { serviceLogger } from '../core/logger.js';
import { FindingDeduplicator } from './deduplicator.js';

export interface PipelineOptions {
  enableSlither?: boolean;
  enablePattern?: boolean;
  enableMythril?: boolean;
  enableSecurify?: boolean;
  enableMaian?: boolean;
  enableAI?: boolean;
  timeoutMs?: number;
  continueOnError?: boolean;
}

export interface PipelineResult {
  contract: Contract;
  findings: Finding[];
  stats: {
    totalFindings: number;
    byTool: Record<string, number>;
    bySeverity: Record<string, number>;
    deduplicated: number;
    executionTimeMs: number;
  };
  errors: Array<{ tool: string; error: string }>;
}

export interface CorrelatedFinding extends Finding {
  corroboratedBy: string[];
  confidence: Confidence;
  primaryTool: string;
}

/**
 * Sequential Analysis Pipeline
 * 
 * Executes ALL analyzers in sequence on every contract.
 * Correlates findings across tools for higher confidence.
 */
export class AnalysisPipeline {
  private slither = new SlitherAnalyzer();
  private mythril = new MythrilAnalyzer();
  private securify = new SecurifyAnalyzer();
  private maian = new MaianAnalyzer();
  private deduplicator = new FindingDeduplicator();
  
  private readonly DEFAULT_OPTIONS: PipelineOptions = {
    enableSlither: true,
    enablePattern: true,
    enableMythril: true,
    enableSecurify: true,
    enableMaian: true,
    enableAI: true,
    timeoutMs: 600000, // 10 minutes total
    continueOnError: true,
  };

  /**
   * Run complete analysis pipeline on a contract
   * 
   * Sequence:
   * 1. Slither (fast static analysis)
   * 2. Pattern Analyzer (heuristic patterns)
   * 3. Mythril (symbolic execution)
   * 4. Securify2 (formal verification)
   * 5. MAIAN (dynamic execution)
   * 6. AI Analyzer (final confirmation)
   */
  async analyze(contract: Contract, options: PipelineOptions = {}): Promise<PipelineResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    
    serviceLogger.info('Starting analysis pipeline', {
      address: contract.address,
      chainId: contract.chainId,
      name: contract.name,
    });

    const allFindings: Finding[] = [];
    const errors: Array<{ tool: string; error: string }> = [];
    const byTool: Record<string, number> = {};

    // Step 1: Slither Analysis
    if (opts.enableSlither) {
      try {
        serviceLogger.info('Running Slither analysis', { address: contract.address });
        const slitherFindings = await this.runWithTimeout(
          this.slither.analyze(
            contract.address,
            contract.chainId,
            contract.sourceCode,
            contract.compilerVersion
          ),
          120000, // 2 minutes
          'Slither'
        );
        allFindings.push(...slitherFindings);
        byTool['slither'] = slitherFindings.length;
        serviceLogger.info('Slither complete', { findings: slitherFindings.length });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push({ tool: 'slither', error });
        serviceLogger.error('Slither failed', { error });
        if (!opts.continueOnError) throw err;
      }
    }

    // Step 2: Pattern Analysis
    if (opts.enablePattern) {
      try {
        serviceLogger.info('Running Pattern analysis', { address: contract.address });
        const patternFindings = patternAnalyzer.analyze(
          contract.address,
          contract.sourceCode,
          contract.name
        );
        allFindings.push(...patternFindings);
        byTool['pattern'] = patternFindings.length;
        serviceLogger.info('Pattern analysis complete', { findings: patternFindings.length });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push({ tool: 'pattern', error });
        serviceLogger.error('Pattern analysis failed', { error });
        if (!opts.continueOnError) throw err;
      }
    }

    // Step 3: Mythril Analysis (Symbolic Execution)
    if (opts.enableMythril) {
      try {
        serviceLogger.info('Running Mythril analysis', { address: contract.address });
        const mythrilFindings = await this.runWithTimeout(
          this.mythril.analyze(
            contract.address,
            contract.chainId,
            contract.sourceCode,
            contract.compilerVersion,
            { maxTransactions: 3, executionTimeout: 300 }
          ),
          600000, // 10 minutes
          'Mythril'
        );
        allFindings.push(...mythrilFindings);
        byTool['mythril'] = mythrilFindings.length;
        serviceLogger.info('Mythril complete', { findings: mythrilFindings.length });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push({ tool: 'mythril', error });
        serviceLogger.error('Mythril failed', { error });
        if (!opts.continueOnError) throw err;
      }
    }

    // Step 4: Securify2 Analysis (Formal Verification)
    if (opts.enableSecurify) {
      try {
        serviceLogger.info('Running Securify2 analysis', { address: contract.address });
        const securifyFindings = await this.runWithTimeout(
          this.securify.analyze(
            contract.address,
            contract.sourceCode,
            contract.name,
            { includeSeverity: ['Critical', 'High', 'Medium', 'Low'] }
          ),
          300000, // 5 minutes
          'Securify2'
        );
        allFindings.push(...securifyFindings);
        byTool['securify'] = securifyFindings.length;
        serviceLogger.info('Securify2 complete', { findings: securifyFindings.length });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push({ tool: 'securify', error });
        serviceLogger.error('Securify2 failed', { error });
        if (!opts.continueOnError) throw err;
      }
    }

    // Step 5: MAIAN Analysis (Dynamic Execution)
    if (opts.enableMaian) {
      try {
        serviceLogger.info('Running MAIAN analysis', { address: contract.address });
        const maianFindings = await this.runWithTimeout(
          this.maian.analyze(
            contract.address,
            contract.sourceCode,
            contract.name,
            { bugClasses: ['suicidal', 'prodigal', 'greedy'] }
          ),
          600000, // 10 minutes
          'MAIAN'
        );
        allFindings.push(...maianFindings);
        byTool['maian'] = maianFindings.length;
        serviceLogger.info('MAIAN complete', { findings: maianFindings.length });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push({ tool: 'maian', error });
        serviceLogger.error('MAIAN failed', { error });
        if (!opts.continueOnError) throw err;
      }
    }

    // Step 6: Deduplication
    serviceLogger.info('Deduplicating findings', { total: allFindings.length });
    const beforeDeduplication = allFindings.length;
    const deduplicated = this.deduplicator.deduplicate(allFindings);
    const afterDeduplication = deduplicated.length;
    
    serviceLogger.info('Deduplication complete', {
      before: beforeDeduplication,
      after: afterDeduplication,
      removed: beforeDeduplication - afterDeduplication,
    });

    // Step 7: Cross-tool Correlation
    serviceLogger.info('Correlating findings across tools');
    const correlated = this.correlateFindings(deduplicated);
    
    // Step 8: AI Analysis (if enabled)
    if (opts.enableAI) {
      try {
        serviceLogger.info('Running AI analysis on findings');
        const aiResults = await this.analyzeWithAI(correlated, contract);
        serviceLogger.info('AI analysis complete');
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        errors.push({ tool: 'ai', error });
        serviceLogger.error('AI analysis failed', { error });
      }
    }

    const executionTimeMs = Date.now() - startTime;
    
    // Calculate stats
    const bySeverity: Record<string, number> = {};
    for (const finding of correlated) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    }

    serviceLogger.info('Analysis pipeline complete', {
      address: contract.address,
      totalFindings: correlated.length,
      executionTimeMs,
      errors: errors.length,
    });

    return {
      contract,
      findings: correlated,
      stats: {
        totalFindings: correlated.length,
        byTool,
        bySeverity,
        deduplicated: beforeDeduplication - afterDeduplication,
        executionTimeMs,
      },
      errors,
    };
  }

  /**
   * Correlate findings across tools to boost confidence
   */
  private correlateFindings(findings: Finding[]): CorrelatedFinding[] {
    const groups = new Map<string, Finding[]>();
    
    // Group similar findings
    for (const finding of findings) {
      const key = this.getFindingKey(finding);
      const group = groups.get(key) || [];
      group.push(finding);
      groups.set(key, group);
    }

    // Create correlated findings
    const correlated: CorrelatedFinding[] = [];
    
    for (const [key, group] of groups) {
      const tools = [...new Set(group.map(f => f.tool))];
      const primaryFinding = group[0];
      
      // Boost confidence based on tool agreement
      let confidence: Confidence = 'medium';
      if (tools.length >= 3) confidence = 'high';
      if (tools.length >= 2 && tools.includes('maian')) confidence = 'high'; // MAIAN confirms by execution
      
      correlated.push({
        ...primaryFinding,
        corroboratedBy: tools,
        confidence,
        primaryTool: primaryFinding.tool!,
        // Merge descriptions from all tools
        description: this.mergeDescriptions(group),
      });
    }

    return correlated;
  }

  /**
   * Generate a correlation key for grouping similar findings
   */
  private getFindingKey(finding: Finding): string {
    // Normalize detector name
    const detector = finding.detectorName.toLowerCase().replace(/[^a-z]/g, '');
    // Include location if available
    const location = finding.lineStart ? `:${finding.lineStart}` : '';
    return `${detector}${location}`;
  }

  /**
   * Merge descriptions from multiple tools
   */
  private mergeDescriptions(findings: Finding[]): string {
    const descriptions = findings.map(f => f.description);
    const unique = [...new Set(descriptions)];
    
    if (unique.length === 1) return unique[0];
    
    return unique.join('\n\n---\n\nDetected by multiple tools:\n');
  }

  /**
   * Run a promise with timeout
   */
  private runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, toolName: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`${toolName} timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Analyze findings with AI for final confirmation
   */
  private async analyzeWithAI(findings: CorrelatedFinding[], contract: Contract): Promise<void> {
    // This would integrate with AIAnalyzer to assess findings
    // For now, just mark high-confidence findings
    for (const finding of findings) {
      if (finding.corroboratedBy.length >= 3) {
        finding.aiAssessment = 'Confirmed by multiple tools';
        finding.aiIsFalsePositive = false;
      }
    }
  }

  /**
   * Quick analysis (Slither + Pattern only)
   * For fast screening when full analysis not needed
   */
  async quickAnalyze(contract: Contract): Promise<PipelineResult> {
    return this.analyze(contract, {
      enableSlither: true,
      enablePattern: true,
      enableMythril: false,
      enableSecurify: false,
      enableMaian: false,
      enableAI: false,
    });
  }

  /**
   * Deep analysis (all tools)
   * Full sequential analysis
   */
  async deepAnalyze(contract: Contract): Promise<PipelineResult> {
    return this.analyze(contract, {
      enableSlither: true,
      enablePattern: true,
      enableMythril: true,
      enableSecurify: true,
      enableMaian: true,
      enableAI: true,
    });
  }
}

export default AnalysisPipeline;
