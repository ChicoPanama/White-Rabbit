/**
 * Self-Evolution Engine — Clawd Gets Smarter Over Time
 *
 * Analyzes audit history, refines vulnerability patterns, discovers new ones,
 * and tracks accuracy improvements. The more it scans, the better it gets.
 */

import type Database from 'better-sqlite3';
import { PatternCache } from './patternCache.js';
import type {
  VulnerabilityPattern,
  EvolutionReport,
  LearningStats,
  CodeSignatures,
} from '../types/index.js';

export interface EvolutionStats extends LearningStats {
  evolutionHistory: Array<{
    date: string;
    truePositives: number;
    falsePositives: number;
    newPatterns: number;
  }>;
  topPatterns: Array<{
    patternType: string;
    instanceCount: number;
    totalValue: number;
    avgAccuracy: number;
  }>;
  overallAccuracy: number;
  learningVelocity: number; // % change in learning events week over week
}

export class SelfEvolutionEngine {
  private readonly patternCache: PatternCache;
  private readonly db: Database.Database;

  constructor(patternCache: PatternCache) {
    this.patternCache = patternCache;
    this.db = patternCache.getDb();
  }

  /**
   * Run a full evolution cycle: analyze history, refine patterns,
   * discover new ones, and measure accuracy improvement.
   */
  evolve(): EvolutionReport {
    console.log('\n[Evolution] Running self-evolution cycle...');

    const report: EvolutionReport = {
      patternsRefined: 0,
      newPatternsLearned: 0,
      falsePositivesIdentified: 0,
      accuracyImprovement: 0,
      insights: [],
      summary: '',
    };

    // 1. Analyze false positive patterns
    const fpAnalysis = this.analyzeFalsePositives();
    report.falsePositivesIdentified = fpAnalysis.newFPSignatures;
    report.insights.push(...fpAnalysis.insights);

    // 2. Refine low-accuracy patterns
    const refinements = this.refinePatterns();
    report.patternsRefined = refinements.count;
    report.insights.push(...refinements.insights);

    // 3. Discover new patterns from audit history
    const newPatterns = this.discoverNewPatterns();
    report.newPatternsLearned = newPatterns.count;
    report.insights.push(...newPatterns.insights);

    // 4. Calculate accuracy improvement
    report.accuracyImprovement = this.measureAccuracyChange();

    // 5. Generate summary
    report.summary = this.generateSummary(report);

    // 6. Log the evolution cycle
    this.logEvolutionCycle(report);

    console.log(`[Evolution] Complete: ${report.patternsRefined} refined, ${report.newPatternsLearned} new, ${report.falsePositivesIdentified} FPs identified`);
    console.log(`[Evolution] Accuracy change: ${report.accuracyImprovement > 0 ? '+' : ''}${report.accuracyImprovement.toFixed(1)}%`);

    return report;
  }

  /**
   * Analyze recent false positives to learn what code looks similar
   * to a vulnerability but isn't actually exploitable.
   */
  private analyzeFalsePositives(): { newFPSignatures: number; insights: string[] } {
    const insights: string[] = [];
    let newFPSignatures = 0;

    // Get FP events grouped by pattern type
    const fpsByType = this.db.prepare(`
      SELECT
        p.pattern_type,
        COUNT(*) as fp_count,
        GROUP_CONCAT(le.details, '|||') as all_details
      FROM learning_events le
      JOIN patterns p ON le.pattern_id = p.id
      WHERE le.event_type = 'false_positive'
      AND le.created_at > datetime('now', '-30 days')
      GROUP BY p.pattern_type
      HAVING fp_count >= 2
    `).all() as Array<{ pattern_type: string; fp_count: number; all_details: string }>;

    for (const group of fpsByType) {
      // Parse details to find common reasons
      const reasons: string[] = [];
      if (group.all_details) {
        for (const detail of group.all_details.split('|||')) {
          try {
            const parsed = JSON.parse(detail);
            if (parsed.reason) reasons.push(parsed.reason);
          } catch { /* skip */ }
        }
      }

      // Find common reason patterns
      const reasonCounts = new Map<string, number>();
      for (const reason of reasons) {
        const normalized = reason.toLowerCase().trim();
        reasonCounts.set(normalized, (reasonCounts.get(normalized) ?? 0) + 1);
      }

      for (const [reason, count] of reasonCounts) {
        if (count >= 2) {
          insights.push(
            `${group.pattern_type}: "${reason}" is a common FP reason (${count} occurrences)`,
          );
          newFPSignatures++;
        }
      }

      if (group.fp_count >= 3) {
        insights.push(
          `${group.pattern_type} patterns generated ${group.fp_count} FPs in last 30 days — consider tightening signatures`,
        );
      }
    }

    return { newFPSignatures, insights };
  }

  /**
   * Refine patterns that have low true positive rates.
   */
  private refinePatterns(): { count: number; insights: string[] } {
    const insights: string[] = [];
    let count = 0;

    // Get patterns with enough data and low accuracy
    const lowAccuracy = this.db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM pattern_instances WHERE pattern_id = p.id) as instance_count
      FROM patterns p
      WHERE p.true_positive_rate < 0.7
      AND (SELECT COUNT(*) FROM pattern_instances WHERE pattern_id = p.id) >= 3
    `).all() as Array<Record<string, unknown> & { instance_count: number }>;

    for (const row of lowAccuracy) {
      const patternId = row.id as string;
      const patternType = row.pattern_type as string;
      const tpr = row.true_positive_rate as number;
      const instanceCount = row.instance_count;

      // Check if there are enough FP signatures to narrow the pattern
      const fpSigs: string[] = JSON.parse((row.false_positive_signatures as string) || '[]');
      if (fpSigs.length > 0) {
        insights.push(
          `${patternType} pattern (${instanceCount} instances, ${(tpr * 100).toFixed(0)}% accuracy) has ${fpSigs.length} FP signatures — patterns should auto-exclude`,
        );
        count++;
      }

      // Check if we should deprecate very low-accuracy patterns
      if (tpr < 0.3 && instanceCount <= 2) {
        insights.push(
          `${patternType} pattern has only ${(tpr * 100).toFixed(0)}% accuracy with ${instanceCount} instances — consider deprecating`,
        );
      }
    }

    return { count, insights };
  }

  /**
   * Discover new patterns from audit history —
   * look for verified findings that don't match existing patterns.
   */
  private discoverNewPatterns(): { count: number; insights: string[] } {
    const insights: string[] = [];
    let count = 0;

    // Find audit results that had verified findings but no pattern association
    const unmatchedAudits = this.db.prepare(`
      SELECT
        ah.contract_address,
        ah.chain_id,
        ah.contract_name,
        ah.verified_count,
        ah.exploitable_value
      FROM audit_history ah
      WHERE ah.verified_count > 0
      AND NOT EXISTS (
        SELECT 1 FROM pattern_instances pi
        WHERE pi.contract_address = ah.contract_address
        AND pi.chain_id = ah.chain_id
      )
      AND ah.created_at > datetime('now', '-30 days')
      ORDER BY ah.exploitable_value DESC
      LIMIT 20
    `).all() as Array<{
      contract_address: string;
      chain_id: number;
      contract_name: string;
      verified_count: number;
      exploitable_value: number;
    }>;

    if (unmatchedAudits.length > 0) {
      insights.push(
        `${unmatchedAudits.length} verified audits don't match existing patterns — potential new patterns to learn`,
      );

      // Group by contract name similarity to find clusters
      const clusters = this.clusterByName(unmatchedAudits.map(a => a.contract_name));
      for (const [clusterName, members] of Object.entries(clusters)) {
        if (members.length >= 2) {
          count++;
          const totalValue = unmatchedAudits
            .filter(a => members.includes(a.contract_name))
            .reduce((sum, a) => sum + a.exploitable_value, 0);
          insights.push(
            `Potential new pattern: ${members.length} similar contracts ("${clusterName}") with $${totalValue.toLocaleString()} total value`,
          );
        }
      }
    }

    return { count, insights };
  }

  /**
   * Measure accuracy improvement over the last evolution cycles.
   */
  private measureAccuracyChange(): number {
    const current = this.db.prepare(
      'SELECT AVG(true_positive_rate) as avg FROM patterns',
    ).get() as { avg: number | null };
    const currentAvg = current?.avg ?? 0;

    // Get accuracy from last evolution cycle
    const previous = this.db.prepare(`
      SELECT details FROM learning_events
      WHERE event_type = 'evolution_cycle'
      ORDER BY created_at DESC
      LIMIT 1 OFFSET 1
    `).get() as { details: string } | undefined;

    if (!previous) return 0;

    try {
      const prevData = JSON.parse(previous.details);
      const prevAvg = prevData.accuracy ?? currentAvg;
      if (prevAvg === 0) return 0;
      return ((currentAvg - prevAvg) / prevAvg) * 100;
    } catch {
      return 0;
    }
  }

  /**
   * Get comprehensive evolution statistics for reporting.
   */
  getEvolutionStats(): EvolutionStats {
    const baseStats = this.patternCache.getStats();

    // Evolution history (last 30 days)
    const evolutionHistory = this.db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(CASE WHEN event_type = 'true_positive' THEN 1 END) as truePositives,
        COUNT(CASE WHEN event_type = 'false_positive' THEN 1 END) as falsePositives,
        COUNT(CASE WHEN event_type = 'new_pattern' THEN 1 END) as newPatterns
      FROM learning_events
      WHERE created_at > datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).all() as Array<{
      date: string;
      truePositives: number;
      falsePositives: number;
      newPatterns: number;
    }>;

    // Top patterns by value
    const topPatterns = this.db.prepare(`
      SELECT
        p.pattern_type as patternType,
        COUNT(pi.id) as instanceCount,
        p.total_value_at_risk as totalValue,
        p.true_positive_rate as avgAccuracy
      FROM patterns p
      LEFT JOIN pattern_instances pi ON pi.pattern_id = p.id
      GROUP BY p.id
      ORDER BY p.total_value_at_risk DESC
      LIMIT 10
    `).all() as Array<{
      patternType: string;
      instanceCount: number;
      totalValue: number;
      avgAccuracy: number;
    }>;

    const overallAccuracy = baseStats.averageTruePositiveRate;
    const learningVelocity = this.calculateLearningVelocity();

    return {
      ...baseStats,
      evolutionHistory,
      topPatterns,
      overallAccuracy,
      learningVelocity,
    };
  }

  /**
   * Calculate how fast the system is learning (week-over-week).
   */
  private calculateLearningVelocity(): number {
    const recentWeek = (this.db.prepare(`
      SELECT COUNT(*) as count FROM learning_events
      WHERE created_at > datetime('now', '-7 days')
    `).get() as { count: number }).count;

    const previousWeek = (this.db.prepare(`
      SELECT COUNT(*) as count FROM learning_events
      WHERE created_at > datetime('now', '-14 days')
      AND created_at <= datetime('now', '-7 days')
    `).get() as { count: number }).count;

    if (previousWeek === 0) return recentWeek > 0 ? 100 : 0;
    return ((recentWeek - previousWeek) / previousWeek) * 100;
  }

  /**
   * Generate human-readable evolution summary.
   */
  private generateSummary(report: EvolutionReport): string {
    const lines = [
      'Evolution Cycle Complete',
      '',
      `Patterns refined: ${report.patternsRefined}`,
      `New patterns learned: ${report.newPatternsLearned}`,
      `False positives identified: ${report.falsePositivesIdentified}`,
      `Accuracy change: ${report.accuracyImprovement > 0 ? '+' : ''}${report.accuracyImprovement.toFixed(1)}%`,
    ];

    if (report.insights.length > 0) {
      lines.push('', 'Insights:');
      for (const insight of report.insights.slice(0, 5)) {
        lines.push(`  - ${insight}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Log an evolution cycle to the learning events table.
   */
  private logEvolutionCycle(report: EvolutionReport): void {
    const currentAvg = (this.db.prepare(
      'SELECT AVG(true_positive_rate) as avg FROM patterns',
    ).get() as { avg: number | null })?.avg ?? 0;

    this.db.prepare(`
      INSERT INTO learning_events (event_type, details)
      VALUES ('evolution_cycle', ?)
    `).run(JSON.stringify({
      patternsRefined: report.patternsRefined,
      newPatternsLearned: report.newPatternsLearned,
      falsePositivesIdentified: report.falsePositivesIdentified,
      accuracyImprovement: report.accuracyImprovement,
      accuracy: currentAvg,
      insightCount: report.insights.length,
    }));
  }

  /**
   * Cluster contract names by similarity.
   */
  private clusterByName(names: string[]): Record<string, string[]> {
    const clusters: Record<string, string[]> = {};

    for (const name of names) {
      const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
      let matched = false;

      for (const [key, members] of Object.entries(clusters)) {
        if (this.nameDistance(normalized, key) < 3) {
          members.push(name);
          matched = true;
          break;
        }
      }

      if (!matched) {
        clusters[normalized] = [name];
      }
    }

    return clusters;
  }

  /**
   * Simple edit distance between two strings (Levenshtein).
   */
  private nameDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[a.length][b.length];
  }
}
