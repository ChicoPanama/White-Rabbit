/**
 * TVL Lookup — DeFiLlama integration for fork prioritization.
 *
 * Fetches TVL data for protocols/contracts and uses it to prioritize
 * which forks to verify first (higher TVL = higher priority = more at risk).
 */

import { fetchWithTimeout } from '../utils/helpers.js';
import type { ForkMatch } from './fork-hunter.js';
import type { CascadeForkResult } from './cascade-scanner.js';

// ── Types ──

export interface TVLData {
  protocolName?: string;
  protocolSlug?: string;
  totalTvl: number;                    // Total protocol TVL in USD
  chainTvl: number;                    // TVL on the specific chain in USD
  category?: string;                   // Protocol category (DEX, Lending, etc.)
  lastUpdated: string;
}

export interface PrioritizedFork {
  fork: ForkMatch;
  tvl: TVLData | null;
  priority: number;                    // 1 = highest priority
  priorityScore: number;               // Raw score (higher = more important)
  reason: string;
}

export interface TVLLookupResult {
  results: Map<string, TVLData>;       // Keyed by address
  lookupDuration: number;
  errors: string[];
}

// ── Constants ──

const DEFILLAMA_BASE = 'https://api.llama.fi';
const DEFILLAMA_TIMEOUT = 15_000;

// Protocol cache (address → protocol slug)
const protocolCache = new Map<string, TVLData>();

// ── TVL Fetching ──

/**
 * Get TVL data for a protocol by searching DeFiLlama.
 *
 * Uses the /protocols endpoint to find matching protocols
 * and returns chain-specific TVL when available.
 */
export async function getProtocolTVL(
  protocolNameOrSlug: string,
  chain?: string,
): Promise<TVLData | null> {
  try {
    const response = await fetchWithTimeout(`${DEFILLAMA_BASE}/protocols`, {
      timeoutMs: DEFILLAMA_TIMEOUT,
    });

    if (!response.ok) return null;

    const protocols = await response.json() as Array<{
      name: string;
      slug: string;
      tvl: number;
      chainTvls: Record<string, number>;
      category: string;
      chains: string[];
    }>;

    const normalized = protocolNameOrSlug.toLowerCase();

    // Find matching protocol
    const match = protocols.find(p =>
      p.slug === normalized ||
      p.name.toLowerCase() === normalized ||
      p.name.toLowerCase().includes(normalized) ||
      normalized.includes(p.name.toLowerCase()),
    );

    if (!match) return null;

    const chainKey = chain ? capitalizeFirst(chain) : undefined;
    const chainTvl = chainKey ? (match.chainTvls[chainKey] ?? 0) : 0;

    return {
      protocolName: match.name,
      protocolSlug: match.slug,
      totalTvl: match.tvl ?? 0,
      chainTvl,
      category: match.category,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Get detailed TVL for a specific protocol by slug.
 */
export async function getProtocolDetail(
  slug: string,
): Promise<TVLData | null> {
  try {
    const response = await fetchWithTimeout(`${DEFILLAMA_BASE}/protocol/${slug}`, {
      timeoutMs: DEFILLAMA_TIMEOUT,
    });

    if (!response.ok) return null;

    const detail = await response.json() as {
      name: string;
      slug: string;
      tvl: number;
      currentChainTvls: Record<string, number>;
      category: string;
    };

    return {
      protocolName: detail.name,
      protocolSlug: detail.slug,
      totalTvl: detail.tvl ?? 0,
      chainTvl: 0,
      category: detail.category,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Batch-lookup TVL for multiple protocol names.
 * Returns a map of protocol name → TVL data.
 */
export async function batchTVLLookup(
  protocols: Array<{ name: string; chain?: string }>,
): Promise<TVLLookupResult> {
  const start = Date.now();
  const results = new Map<string, TVLData>();
  const errors: string[] = [];

  // Fetch all protocols once
  let allProtocols: Array<{
    name: string;
    slug: string;
    tvl: number;
    chainTvls: Record<string, number>;
    category: string;
  }> = [];

  try {
    const response = await fetchWithTimeout(`${DEFILLAMA_BASE}/protocols`, {
      timeoutMs: DEFILLAMA_TIMEOUT,
    });

    if (response.ok) {
      allProtocols = await response.json() as typeof allProtocols;
    }
  } catch (err) {
    errors.push(`Failed to fetch protocols: ${err instanceof Error ? err.message : String(err)}`);
    return { results, lookupDuration: Date.now() - start, errors };
  }

  // Match each requested protocol
  for (const { name, chain } of protocols) {
    const normalized = name.toLowerCase();
    const match = allProtocols.find(p =>
      p.slug === normalized ||
      p.name.toLowerCase() === normalized ||
      p.name.toLowerCase().includes(normalized),
    );

    if (match) {
      const chainKey = chain ? capitalizeFirst(chain) : undefined;
      results.set(name, {
        protocolName: match.name,
        protocolSlug: match.slug,
        totalTvl: match.tvl ?? 0,
        chainTvl: chainKey ? (match.chainTvls[chainKey] ?? 0) : 0,
        category: match.category,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  return { results, lookupDuration: Date.now() - start, errors };
}

// ── Fork Prioritization ──

/**
 * Sort forks by TVL-weighted priority.
 *
 * Priority factors:
 * - Bytecode similarity (30%)
 * - Verification confidence (30%)
 * - Protocol TVL (40%)
 */
export function sortByTVL(
  forks: CascadeForkResult[],
  tvlData: Map<string, TVLData>,
): PrioritizedFork[] {
  const prioritized = forks.map(fr => {
    const tvl = tvlData.get(fr.fork.address) ?? tvlData.get(fr.fork.name) ?? null;

    // Compute priority score
    const similarityScore = fr.fork.similarity.overall / 100; // 0-1
    const confidenceScore = fr.confidence / 100;               // 0-1
    const tvlScore = tvl ? Math.min(1, Math.log10(tvl.totalTvl + 1) / 10) : 0; // Log-scale TVL

    const priorityScore =
      similarityScore * 0.3 +
      confidenceScore * 0.3 +
      tvlScore * 0.4;

    const reasons: string[] = [];
    if (fr.fork.similarity.overall >= 95) reasons.push('exact fork');
    if (fr.confidence >= 80) reasons.push('high confidence');
    if (tvl && tvl.totalTvl >= 1_000_000) reasons.push(`$${formatUsd(tvl.totalTvl)} TVL`);
    if (fr.status === 'vulnerable') reasons.push('confirmed vulnerable');

    return {
      fork: fr.fork,
      tvl,
      priority: 0, // Set after sorting
      priorityScore,
      reason: reasons.join(', ') || 'low-priority match',
    };
  });

  // Sort by priority score (descending)
  prioritized.sort((a, b) => b.priorityScore - a.priorityScore);

  // Assign priority numbers
  for (let i = 0; i < prioritized.length; i++) {
    prioritized[i].priority = i + 1;
  }

  return prioritized;
}

/**
 * Sort fork matches by estimated TVL before verification.
 * Uses protocol name matching against DeFiLlama data.
 */
export function prioritizeForkMatches(
  forks: ForkMatch[],
  tvlData: Map<string, TVLData>,
): ForkMatch[] {
  return [...forks].sort((a, b) => {
    const tvlA = tvlData.get(a.name)?.totalTvl ?? tvlData.get(a.address)?.totalTvl ?? 0;
    const tvlB = tvlData.get(b.name)?.totalTvl ?? tvlData.get(b.address)?.totalTvl ?? 0;

    // Primary: TVL (descending)
    if (tvlA !== tvlB) return tvlB - tvlA;

    // Secondary: similarity (descending)
    return b.similarity.overall - a.similarity.overall;
  });
}

// ── Utility ──

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}
