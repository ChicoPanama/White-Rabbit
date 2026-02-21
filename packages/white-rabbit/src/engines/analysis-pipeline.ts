// ═══════════════════════════════════════════════════════════════════════════════
// AnalysisPipeline - Orchestrates multiple analysis engines
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Contract,
  Finding,
  PipelineOptions,
  PipelineResult,
  PipelineStats,
  PipelineError,
  Severity,
  AnalysisEngine,
  EngineResult,
  ScannerConfig,
} from '../types.js';

import { SlitherEngine } from './slither.js';
import { PatternEngine } from './pattern.js';
import { MythrilEngine } from './mythril.js';
import { SecurifyEngine } from './securify.js';
import { MaianEngine } from './maian.js';

export class AnalysisPipeline {
  private engines: Map<string, AnalysisEngine> = new Map();
  private config: ScannerConfig;

  constructor(config: ScannerConfig = {}) {
    this.config = config;
    this.initializeEngines();
  }

  /**
   * Run full analysis with configured engines
   */
  async analyze(
    contract: Contract,
    options: PipelineOptions = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const allFindings: Finding[] = [];
    const errors: PipelineError[] = [];

    const enginesToRun = this.selectEngines(options);

    for (const engineName of enginesToRun) {
      const engine = this.engines.get(engineName);
      if (!engine) continue;

      // Check if engine is available
      const isAvailable = await engine.isAvailable();
      if (!isAvailable) {
        if (!options.continueOnError) {
          errors.push({
            tool: engineName,
            error: `${engineName} is not available`,
            fatal: true,
          });
          continue;
        }
        console.warn(`[Pipeline] ${engineName} not available, skipping...`);
        continue;
      }

      try {
        const result = await this.runWithTimeout(
          engine.analyze(contract, {
            timeoutMs: options.timeoutMs,
            continueOnError: options.continueOnError,
            intelContext: options.intelContext,
          }),
          options.timeoutMs || 300000,
          engineName
        );

        if (result.success) {
          allFindings.push(...result.findings);
        } else {
          errors.push({
            tool: engineName,
            error: result.errors.join(', '),
            fatal: false,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          tool: engineName,
          error: message,
          fatal: !options.continueOnError,
        });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    // Deduplicate and correlate findings
    const deduplicated = this.deduplicateFindings(allFindings);
    const correlated = this.correlateFindings(deduplicated);

    const duration = Date.now() - startTime;

    return {
      contract,
      findings: correlated,
      stats: this.calculateStats(correlated, duration),
      errors,
    };
  }

  /**
   * Quick analysis (Slither + Pattern only)
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
   * Deep analysis (all available tools)
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

  /**
   * Check which engines are available
   */
  async checkEngines(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, engine] of this.engines) {
      try {
        results[name] = await engine.isAvailable();
      } catch {
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Shutdown all engines
   */
  async shutdown(): Promise<void> {
    // Cleanup if needed
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private initializeEngines(): void {
    this.engines.set('slither', new SlitherEngine());
    this.engines.set('pattern', new PatternEngine());
    this.engines.set('mythril', new MythrilEngine());
    this.engines.set('securify', new SecurifyEngine());
    this.engines.set('maian', new MaianEngine());
  }

  private selectEngines(options: PipelineOptions): string[] {
    const engines: string[] = [];

    // Always include slither and pattern by default
    if (options.enableSlither !== false) engines.push('slither');
    if (options.enablePattern !== false) engines.push('pattern');

    // Optional engines
    if (options.enableMythril) engines.push('mythril');
    if (options.enableSecurify) engines.push('securify');
    if (options.enableMaian) engines.push('maian');

    return engines;
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    engineName: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${engineName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  private deduplicateFindings(findings: Finding[]): Finding[] {
    const seen = new Map<string, Finding>();

    for (const finding of findings) {
      // Create a deduplication key based on detector + location
      const key = this.createDedupKey(finding);
      
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, finding);
      } else {
        // Keep the higher severity one
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, informational: 0 };
        if (severityOrder[finding.severity] > severityOrder[existing.severity]) {
          seen.set(key, finding);
        }
      }
    }

    return Array.from(seen.values());
  }

  private createDedupKey(finding: Finding): string {
    const parts = [
      finding.detectorName,
      finding.tool,
      finding.filePath || '',
      finding.lineStart || 0,
    ];
    return parts.join(':');
  }

  private correlateFindings(findings: Finding[]): Finding[] {
    // Group similar findings and add corroboratedBy
    const groups = new Map<string, Finding[]>();

    for (const finding of findings) {
      const key = this.createCorrelationKey(finding);
      const group = groups.get(key) || [];
      group.push(finding);
      groups.set(key, group);
    }

    const correlated: Finding[] = [];

    for (const group of groups.values()) {
      if (group.length === 1) {
        correlated.push(group[0]);
      } else {
        // Merge findings from multiple tools
        const primary = group[0];
        const tools = group.map(f => f.tool);
        
        correlated.push({
          ...primary,
          corroboratedBy: tools,
          confidence: this.boostConfidence(primary.confidence, tools.length),
        });
      }
    }

    return correlated;
  }

  private createCorrelationKey(finding: Finding): string {
    // Normalize detector name for correlation
    const normalizedDetector = finding.detectorName
      .toLowerCase()
      .replace(/-/g, '_')
      .replace(/\s+/g, '_');
    
    return `${normalizedDetector}:${finding.filePath || ''}:${finding.lineStart || 0}`;
  }

  private boostConfidence(
    confidence: Finding['confidence'],
    toolCount: number
  ): Finding['confidence'] {
    if (toolCount >= 3) return 'high';
    if (toolCount >= 2 && confidence === 'medium') return 'high';
    if (toolCount >= 2 && confidence === 'low') return 'medium';
    return confidence;
  }

  private calculateStats(findings: Finding[], duration: number): PipelineStats {
    const byTool: Record<string, number> = {};
    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };

    for (const finding of findings) {
      byTool[finding.tool] = (byTool[finding.tool] || 0) + 1;
      bySeverity[finding.severity]++;
    }

    return {
      total: findings.length,
      byTool,
      bySeverity,
      duration,
    };
  }
}
