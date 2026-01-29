/**
 * Deterministic Confidence Scoring for Memory Bundles
 *
 * Computes a confidence score (0-1) that determines whether an LLM call is needed.
 * If confidence >= threshold (default 0.75), the agent should NOT call an LLM
 * and instead rely on cached memory for its decision.
 *
 * The scoring is purely deterministic - same bundle produces same score.
 */

import type { MemoryBundle } from '../types/index.js';

export interface ConfidenceResult {
  score: number;                        // 0.0 - 1.0
  reasons: string[];                    // Human-readable explanations
  signals: Record<string, number>;      // Individual signal contributions
  recommendation: 'use_memory' | 'call_llm';
  threshold: number;
}

export interface ConfidenceConfig {
  threshold?: number;                   // Default: 0.75
  maxFindingsUsed?: number;             // Default: 5
  maxSummaryChars?: number;             // Default: 3000
}

// ── High-risk tags that indicate definitive outcomes ──
const DEFINITIVE_RISK_TAGS = new Set([
  'honeypot',
  'rug',
  'rugpull',
  'rug_pull',
  'scam',
  'malicious',
  'blacklisted',
  'blacklist',
  'high_tax',
  'drain',
  'exploit',
  'exploited',
  'hacked',
  'compromised',
]);

// ── Benign tags that indicate safe contracts ──
const DEFINITIVE_SAFE_TAGS = new Set([
  'audited',
  'verified',
  'safe',
  'trusted',
  'whitelisted',
  'blue_chip',
  'established',
]);

// ── Severity weights for findings ──
const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.2,
  informational: 0.05,
};

// ── Default configuration ──
const DEFAULT_CONFIG: Required<ConfidenceConfig> = {
  threshold: 0.75,
  maxFindingsUsed: 5,
  maxSummaryChars: 3000,
};

/**
 * Compute deterministic confidence score for a memory bundle.
 *
 * Scoring logic:
 * - Strong risk tags (honeypot, rug, etc.) → high confidence (we know the answer)
 * - Strong safe tags (audited, verified) → high confidence
 * - High similarity to known outcomes → confidence boost
 * - Consistent findings (all same severity) → confidence boost
 * - Contradictory findings (both benign and critical) → confidence drop
 * - Rich summaries with final determinations → confidence boost
 * - No data / very recent with limited info → low confidence
 */
export function computeConfidence(
  bundle: MemoryBundle,
  config: ConfidenceConfig = {}
): ConfidenceResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const signals: Record<string, number> = {};
  const reasons: string[] = [];

  let score = 0.0;

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNAL 1: Definitive Tags (0.0 - 0.4)
  // ════════════════════════════════════════════════════════════════════════════
  const tagNames = bundle.tags.map(t => t.tag.toLowerCase());

  const hasRiskTag = tagNames.some(t => DEFINITIVE_RISK_TAGS.has(t));
  const hasSafeTag = tagNames.some(t => DEFINITIVE_SAFE_TAGS.has(t));

  if (hasRiskTag) {
    signals.definitiveRiskTag = 0.35;
    score += 0.35;
    const riskTags = tagNames.filter(t => DEFINITIVE_RISK_TAGS.has(t));
    reasons.push(`High-risk tags detected: ${riskTags.join(', ')}`);
  } else if (hasSafeTag) {
    signals.definitiveSafeTag = 0.30;
    score += 0.30;
    const safeTags = tagNames.filter(t => DEFINITIVE_SAFE_TAGS.has(t));
    reasons.push(`Safe tags detected: ${safeTags.join(', ')}`);
  } else if (bundle.tags.length > 0) {
    signals.hasTags = 0.10;
    score += 0.10;
    reasons.push(`Has ${bundle.tags.length} metadata tag(s)`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNAL 2: Finding Consistency (0.0 - 0.25)
  // ════════════════════════════════════════════════════════════════════════════
  const findings = bundle.findings.slice(0, cfg.maxFindingsUsed);

  if (findings.length > 0) {
    const severities = findings.map(f => f.severity.toLowerCase());
    const uniqueSeverities = new Set(severities);

    // Check for AI false positive consistency
    const aiAnalyzed = findings.filter(f => f.ai !== undefined);
    const falsePositives = findings.filter(f => f.aiIsFalsePositive === true);

    if (falsePositives.length === findings.length && findings.length >= 2) {
      // All findings marked as false positives
      signals.allFalsePositives = 0.25;
      score += 0.25;
      reasons.push(`All ${findings.length} findings marked as false positives by AI`);
    } else if (uniqueSeverities.size === 1) {
      // Consistent severity across all findings
      const sev = severities[0];
      const weight = SEVERITY_WEIGHTS[sev] ?? 0.3;
      signals.consistentSeverity = 0.15 * weight;
      score += signals.consistentSeverity;
      reasons.push(`Consistent ${sev} severity across ${findings.length} finding(s)`);
    } else if (severities.includes('critical') && (severities.includes('low') || severities.includes('informational'))) {
      // Contradictory findings - reduce confidence
      signals.contradictoryFindings = -0.15;
      score += -0.15;
      reasons.push('Contradictory findings (critical + low/informational) - needs review');
    }

    // AI coverage bonus
    if (aiAnalyzed.length > 0) {
      const aiCoverage = aiAnalyzed.length / findings.length;
      signals.aiCoverage = 0.10 * aiCoverage;
      score += signals.aiCoverage;
      reasons.push(`${aiAnalyzed.length}/${findings.length} findings have AI analysis`);
    }
  } else {
    // No findings at all
    signals.noFindings = -0.10;
    score += -0.10;
    reasons.push('No findings in memory - limited data');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNAL 3: Scan History (0.0 - 0.15)
  // ════════════════════════════════════════════════════════════════════════════
  const completedScans = bundle.scans.filter(s => s.status === 'completed');

  if (completedScans.length >= 3) {
    signals.multipleScans = 0.15;
    score += 0.15;
    reasons.push(`${completedScans.length} completed scans - good coverage`);
  } else if (completedScans.length >= 1) {
    signals.hasScans = 0.08;
    score += 0.08;
    reasons.push(`${completedScans.length} completed scan(s)`);
  } else {
    signals.noScans = -0.05;
    score += -0.05;
    reasons.push('No completed scans in history');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNAL 4: Summaries (0.0 - 0.20)
  // ════════════════════════════════════════════════════════════════════════════
  if (bundle.summaries && bundle.summaries.length > 0) {
    const summaryText = bundle.summaries.map(s => s.text).join(' ').toLowerCase();
    const totalChars = summaryText.length;

    // Check for definitive language in summaries
    const hasFinalDetermination =
      summaryText.includes('confirmed') ||
      summaryText.includes('verified') ||
      summaryText.includes('definitively') ||
      summaryText.includes('conclusively') ||
      summaryText.includes('false positive') ||
      summaryText.includes('true positive');

    if (hasFinalDetermination) {
      signals.definiteSummary = 0.20;
      score += 0.20;
      reasons.push('Summaries contain definitive determination');
    } else if (totalChars >= 500) {
      signals.richSummaries = 0.12;
      score += 0.12;
      reasons.push(`Rich summaries available (${totalChars} chars)`);
    } else {
      signals.hasSummaries = 0.06;
      score += 0.06;
      reasons.push('Has summary data');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNAL 5: Similar Entities (0.0 - 0.15)
  // ════════════════════════════════════════════════════════════════════════════
  if (bundle.similar && bundle.similar.length > 0) {
    const highSimilarity = bundle.similar.filter(s => s.score >= 0.85);
    const mediumSimilarity = bundle.similar.filter(s => s.score >= 0.70 && s.score < 0.85);

    if (highSimilarity.length > 0) {
      signals.highSimilarity = 0.15;
      score += 0.15;
      reasons.push(`${highSimilarity.length} highly similar contract(s) (≥85% match)`);
    } else if (mediumSimilarity.length > 0) {
      signals.mediumSimilarity = 0.08;
      score += 0.08;
      reasons.push(`${mediumSimilarity.length} similar contract(s) (70-85% match)`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNAL 6: Data Freshness (bonus/penalty)
  // ════════════════════════════════════════════════════════════════════════════
  if (bundle.lastSeen?.ts) {
    const lastSeenDate = new Date(bundle.lastSeen.ts);
    const ageHours = (Date.now() - lastSeenDate.getTime()) / (1000 * 60 * 60);

    if (ageHours < 24 && bundle.stats.totalScans < 2) {
      // Very recent with limited scans - might need more analysis
      signals.recentLimitedData = -0.08;
      score += -0.08;
      reasons.push('Recently seen but limited scan history - may need fresh analysis');
    } else if (ageHours < 168) { // Within a week
      signals.fresh = 0.05;
      score += 0.05;
      reasons.push('Data is fresh (within 7 days)');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNAL 7: Statistics Quality
  // ════════════════════════════════════════════════════════════════════════════
  const stats = bundle.stats;
  if (stats.aiAnalyzedCount >= 3) {
    signals.goodAiCoverage = 0.08;
    score += 0.08;
    reasons.push(`${stats.aiAnalyzedCount} AI-analyzed findings`);
  }

  if (stats.criticalCount > 0 || stats.highCount > 0) {
    signals.significantFindings = 0.05;
    score += 0.05;
    reasons.push(`Has ${stats.criticalCount} critical, ${stats.highCount} high findings`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NORMALIZE AND CLAMP
  // ════════════════════════════════════════════════════════════════════════════

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(1, score));

  // Round to 3 decimal places for stability
  score = Math.round(score * 1000) / 1000;

  const recommendation: 'use_memory' | 'call_llm' =
    score >= cfg.threshold ? 'use_memory' : 'call_llm';

  if (recommendation === 'use_memory') {
    reasons.push(`Confidence ${(score * 100).toFixed(1)}% >= threshold ${(cfg.threshold * 100).toFixed(0)}% → use cached memory`);
  } else {
    reasons.push(`Confidence ${(score * 100).toFixed(1)}% < threshold ${(cfg.threshold * 100).toFixed(0)}% → LLM call allowed`);
  }

  return {
    score,
    reasons,
    signals,
    recommendation,
    threshold: cfg.threshold,
  };
}

/**
 * Quick check: should we call an LLM for this bundle?
 */
export function shouldCallLLM(bundle: MemoryBundle, threshold = 0.75): boolean {
  const result = computeConfidence(bundle, { threshold });
  return result.recommendation === 'call_llm';
}

/**
 * Get compressed context for LLM when confidence is low.
 * Returns only the minimal data needed for analysis.
 */
export function getCompressedContext(
  bundle: MemoryBundle,
  config: ConfidenceConfig = {}
): {
  chain: string;
  address: string;
  summaryText: string;
  topFindings: Array<{ title: string; severity: string; summary: string }>;
  tags: string[];
  stats: { total: number; critical: number; high: number };
} {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Compress summaries
  let summaryText = '';
  if (bundle.summaries && bundle.summaries.length > 0) {
    summaryText = bundle.summaries
      .map(s => `[${s.scope}] ${s.text}`)
      .join('\n')
      .slice(0, cfg.maxSummaryChars);
  }

  // Get top findings (by severity)
  const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];
  const sortedFindings = [...bundle.findings]
    .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))
    .slice(0, cfg.maxFindingsUsed);

  const topFindings = sortedFindings.map(f => ({
    title: f.title,
    severity: f.severity,
    summary: f.summary.slice(0, 150),
  }));

  return {
    chain: bundle.chain,
    address: bundle.address,
    summaryText,
    topFindings,
    tags: bundle.tags.map(t => t.tag),
    stats: {
      total: bundle.stats.totalFindings,
      critical: bundle.stats.criticalCount,
      high: bundle.stats.highCount,
    },
  };
}

// ── Test helper for determinism verification ──
export function verifyDeterminism(bundle: MemoryBundle, iterations = 10): boolean {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    results.push(computeConfidence(bundle).score);
  }
  return results.every(r => r === results[0]);
}
