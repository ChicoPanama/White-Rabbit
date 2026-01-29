/**
 * Target Prioritization Service for Micro-Protocol Hunting
 *
 * Scores and ranks protocols based on risk factors to optimize hunting efficiency.
 * Higher scores = higher priority for scanning.
 */

import type { DeFiLlamaProtocol } from '../types/index.js';

export interface RiskFactors {
  deployAge: number;              // Days since deployment
  auditStatus: 'none' | 'old' | 'recent';
  codeComplexity: number;         // 0-100 complexity score
  adminKeyRisk: number;           // 0-1 centralization score
  forkSimilarity: number;         // 0-1 match to known hacked code
  tvlGrowthRate: number;          // Rapid growth = risk indicator
  tvlInRange: boolean;            // Within target TVL range
}

export interface ProtocolRiskScore {
  protocol: DeFiLlamaProtocol;
  tvl: number;
  riskScore: number;              // 0-100 priority score
  factors: Partial<RiskFactors>;
  reasons: string[];
}

export interface PrioritizationConfig {
  minTvl: number;
  maxTvl: number;
  prioritizeNewDeployments: boolean;
  maxDeployAgeDays: number;
  targetChain?: string;
}

const DEFAULT_CONFIG: PrioritizationConfig = {
  minTvl: 10_000,
  maxTvl: 1_000_000,
  prioritizeNewDeployments: true,
  maxDeployAgeDays: 30,
};

/**
 * Calculate priority score for a protocol (0-100)
 * Higher score = should scan first
 */
export function calculatePriorityScore(
  protocol: DeFiLlamaProtocol,
  factors: Partial<RiskFactors>,
  config: PrioritizationConfig = DEFAULT_CONFIG
): { score: number; reasons: string[] } {
  let score = 50; // Base score
  const reasons: string[] = [];
  const tvl = protocol.tvl || 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // TVL RANGE SCORING (most important for micro-protocol hunting)
  // ═══════════════════════════════════════════════════════════════════════════

  if (tvl < config.minTvl) {
    score -= 30;
    reasons.push(`TVL too low ($${formatTvl(tvl)} < $${formatTvl(config.minTvl)})`);
  } else if (tvl > config.maxTvl) {
    score -= 20;
    reasons.push(`TVL too high ($${formatTvl(tvl)} > $${formatTvl(config.maxTvl)})`);
  } else {
    // Sweet spot: $50K-$500K is ideal for micro-protocol hunting
    const sweetSpotMin = Math.max(config.minTvl, 50_000);
    const sweetSpotMax = Math.min(config.maxTvl, 500_000);

    if (tvl >= sweetSpotMin && tvl <= sweetSpotMax) {
      score += 20;
      reasons.push(`TVL in sweet spot ($${formatTvl(tvl)})`);
    } else {
      score += 10;
      reasons.push(`TVL in target range ($${formatTvl(tvl)})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPLOYMENT AGE
  // ═══════════════════════════════════════════════════════════════════════════

  if (factors.deployAge !== undefined) {
    if (factors.deployAge < 7) {
      score += 25;
      reasons.push(`Very new (${factors.deployAge} days old)`);
    } else if (factors.deployAge < 30) {
      score += 15;
      reasons.push(`New deployment (${factors.deployAge} days old)`);
    } else if (factors.deployAge < 90) {
      score += 5;
      reasons.push(`Recently deployed (${factors.deployAge} days old)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  if (factors.auditStatus === 'none') {
    score += 20;
    reasons.push('No audit');
  } else if (factors.auditStatus === 'old') {
    score += 10;
    reasons.push('Outdated audit');
  } else if (factors.auditStatus === 'recent') {
    score -= 10;
    reasons.push('Recently audited');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORK SIMILARITY (match to known vulnerable code)
  // ═══════════════════════════════════════════════════════════════════════════

  if (factors.forkSimilarity !== undefined) {
    if (factors.forkSimilarity > 0.9) {
      score += 25;
      reasons.push(`Very high fork similarity (${(factors.forkSimilarity * 100).toFixed(0)}%)`);
    } else if (factors.forkSimilarity > 0.8) {
      score += 15;
      reasons.push(`High fork similarity (${(factors.forkSimilarity * 100).toFixed(0)}%)`);
    } else if (factors.forkSimilarity > 0.6) {
      score += 5;
      reasons.push(`Moderate fork similarity (${(factors.forkSimilarity * 100).toFixed(0)}%)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN KEY RISK (centralization)
  // ═══════════════════════════════════════════════════════════════════════════

  if (factors.adminKeyRisk !== undefined && factors.adminKeyRisk > 0.7) {
    score += 10;
    reasons.push(`High admin key risk (${(factors.adminKeyRisk * 100).toFixed(0)}%)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CODE COMPLEXITY
  // ═══════════════════════════════════════════════════════════════════════════

  if (factors.codeComplexity !== undefined) {
    if (factors.codeComplexity > 70) {
      score += 10;
      reasons.push(`Complex code (${factors.codeComplexity}/100)`);
    } else if (factors.codeComplexity < 20) {
      score -= 5;
      reasons.push(`Simple code (${factors.codeComplexity}/100)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TVL GROWTH RATE (rapid growth can indicate risk)
  // ═══════════════════════════════════════════════════════════════════════════

  if (factors.tvlGrowthRate !== undefined && factors.tvlGrowthRate > 2) {
    score += 5;
    reasons.push(`Rapid TVL growth (${factors.tvlGrowthRate.toFixed(1)}x)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROTOCOL CATEGORY BONUSES
  // ═══════════════════════════════════════════════════════════════════════════

  const category = protocol.category?.toLowerCase() || '';
  const highRiskCategories = ['dex', 'lending', 'yield', 'yield farming', 'bridge', 'staking'];

  if (highRiskCategories.includes(category)) {
    score += 5;
    reasons.push(`High-risk category: ${category}`);
  }

  // Clamp score to [0, 100]
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}

/**
 * Prioritize and sort protocols for scanning
 */
export function prioritizeTargets(
  protocols: DeFiLlamaProtocol[],
  factorsMap: Map<string, Partial<RiskFactors>> = new Map(),
  config: PrioritizationConfig = DEFAULT_CONFIG
): ProtocolRiskScore[] {
  const scored: ProtocolRiskScore[] = protocols.map(protocol => {
    const factors = factorsMap.get(protocol.id) || {};
    const { score, reasons } = calculatePriorityScore(protocol, factors, config);

    return {
      protocol,
      tvl: protocol.tvl || 0,
      riskScore: score,
      factors,
      reasons,
    };
  });

  // Sort by risk score descending (highest priority first)
  return scored.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Filter protocols to target TVL range
 */
export function filterByTvlRange(
  protocols: DeFiLlamaProtocol[],
  minTvl: number,
  maxTvl: number
): DeFiLlamaProtocol[] {
  return protocols.filter(p => {
    const tvl = p.tvl || 0;
    return tvl >= minTvl && tvl <= maxTvl;
  });
}

/**
 * Get protocols for a specific chain within TVL range
 */
export function getChainProtocols(
  protocols: DeFiLlamaProtocol[],
  chain: string,
  minTvl: number,
  maxTvl: number
): DeFiLlamaProtocol[] {
  const chainLower = chain.toLowerCase();

  return protocols.filter(p => {
    const tvl = p.chainTvls?.[chainLower] || p.chainTvls?.[chain] || 0;
    return tvl >= minTvl && tvl <= maxTvl;
  });
}

/**
 * Format TVL for display
 */
function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000) {
    return `${(tvl / 1_000_000).toFixed(1)}M`;
  } else if (tvl >= 1_000) {
    return `${(tvl / 1_000).toFixed(0)}K`;
  }
  return tvl.toFixed(0);
}

/**
 * Create a hunting plan for micro-protocols
 */
export function createHuntingPlan(
  protocols: DeFiLlamaProtocol[],
  config: PrioritizationConfig
): {
  tier1: ProtocolRiskScore[];  // Score >= 70 (scan immediately)
  tier2: ProtocolRiskScore[];  // Score 50-69 (scan next)
  tier3: ProtocolRiskScore[];  // Score 30-49 (scan if time permits)
  skipped: ProtocolRiskScore[]; // Score < 30 (skip)
  summary: {
    total: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    skippedCount: number;
    totalTvl: number;
  };
} {
  const filtered = filterByTvlRange(protocols, config.minTvl, config.maxTvl);
  const scored = prioritizeTargets(filtered, new Map(), config);

  const tier1 = scored.filter(s => s.riskScore >= 70);
  const tier2 = scored.filter(s => s.riskScore >= 50 && s.riskScore < 70);
  const tier3 = scored.filter(s => s.riskScore >= 30 && s.riskScore < 50);
  const skipped = scored.filter(s => s.riskScore < 30);

  const totalTvl = scored.reduce((sum, s) => sum + s.tvl, 0);

  return {
    tier1,
    tier2,
    tier3,
    skipped,
    summary: {
      total: scored.length,
      tier1Count: tier1.length,
      tier2Count: tier2.length,
      tier3Count: tier3.length,
      skippedCount: skipped.length,
      totalTvl,
    },
  };
}

// Export singleton-like functions for easy use
export const targetPrioritizer = {
  calculatePriorityScore,
  prioritizeTargets,
  filterByTvlRange,
  getChainProtocols,
  createHuntingPlan,
};
