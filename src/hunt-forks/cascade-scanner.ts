/**
 * Cascade Scanner — Automatic fork verification pipeline.
 *
 * Takes fork matches from the fork hunter and runs a lightweight
 * verification pipeline on each: fetch source → static analysis →
 * check if the original vulnerability exists → classify.
 */

import type { Finding } from '../agents/agent-types.js';
import type { ForkMatch, VulnerableContract } from './fork-hunter.js';
import type { HuntChainConfig } from './chain-registry.js';
import { getHuntChainById } from './chain-registry.js';
import { fetchWithTimeout } from '../utils/helpers.js';

// ── Types ──

export interface CascadeInput {
  originalContract: VulnerableContract;
  originalFinding: Finding;
  forkMatches: ForkMatch[];
  options?: CascadeOptions;
}

export interface CascadeOptions {
  concurrency?: number;               // Parallel verifications (default: 3)
  fetchSource?: boolean;              // Attempt to fetch source code (default: true)
  runStaticAnalysis?: boolean;        // Run pattern matching on source (default: true)
  timeoutPerFork?: number;            // Per-fork verification timeout ms (default: 20000)
}

export interface CascadeForkResult {
  fork: ForkMatch;
  status: 'vulnerable' | 'patched' | 'uncertain' | 'error';
  confidence: number;                  // 0-100
  sourceCode?: string;
  sourceAvailable: boolean;
  patchIndicators: string[];           // Patterns that suggest the vuln was patched
  vulnIndicators: string[];            // Patterns that suggest the vuln still exists
  verificationMethod: 'source_analysis' | 'bytecode_only' | 'none';
  error?: string;
}

export interface CascadeResult {
  originalContract: VulnerableContract;
  originalFinding: Finding;
  forkResults: CascadeForkResult[];
  summary: CascadeSummary;
  duration: number;                    // Total ms
}

export interface CascadeSummary {
  totalForksChecked: number;
  vulnerableCount: number;
  patchedCount: number;
  uncertainCount: number;
  errorCount: number;
  highestConfidence: number;
  chainsAffected: string[];
}

// ── Constants ──

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_PER_FORK = 20_000;
const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';

/**
 * Security patterns that indicate a vulnerability was patched.
 * Keyed by vulnerability type.
 */
const PATCH_PATTERNS: Record<string, PatchPattern[]> = {
  reentrancy: [
    { pattern: /ReentrancyGuard/i, description: 'Uses ReentrancyGuard' },
    { pattern: /nonReentrant/i, description: 'Has nonReentrant modifier' },
    { pattern: /_status\s*=\s*_ENTERED/i, description: 'Manual reentrancy lock' },
    { pattern: /checks-effects-interactions/i, description: 'Documents CEI pattern' },
  ],
  'access-control': [
    { pattern: /onlyOwner/i, description: 'Has onlyOwner modifier' },
    { pattern: /AccessControl/i, description: 'Uses AccessControl' },
    { pattern: /onlyRole/i, description: 'Has role-based access' },
    { pattern: /Ownable/i, description: 'Uses Ownable' },
  ],
  oracle: [
    { pattern: /TWAP/i, description: 'Uses TWAP oracle' },
    { pattern: /twapPeriod/i, description: 'Has TWAP period config' },
    { pattern: /AggregatorV3Interface/i, description: 'Uses Chainlink oracle' },
    { pattern: /latestRoundData/i, description: 'Uses Chainlink latestRoundData' },
    { pattern: /stalePeriod|maxDelay|heartbeat/i, description: 'Has staleness check' },
  ],
  'flash-loan': [
    { pattern: /flashLoanGuard/i, description: 'Has flash loan guard' },
    { pattern: /block\.number.*==.*lastBlock/i, description: 'Same-block restriction' },
    { pattern: /require.*block\.timestamp/i, description: 'Timestamp-based guard' },
  ],
  arithmetic: [
    { pattern: /SafeMath/i, description: 'Uses SafeMath library' },
    { pattern: /pragma solidity\s*\^?\s*0\.8/i, description: 'Solidity 0.8+ (built-in overflow)' },
    { pattern: /unchecked\s*\{/i, description: 'Uses unchecked blocks (intentional)' },
  ],
  logic: [
    // Generic — harder to detect patches for logic bugs
    { pattern: /invariant/i, description: 'Has invariant checks' },
    { pattern: /require.*!=\s*address\(0\)/i, description: 'Has zero-address check' },
  ],
};

/**
 * Patterns that indicate a vulnerability likely still exists (not patched).
 */
const VULN_INDICATORS: Record<string, VulnPattern[]> = {
  reentrancy: [
    { pattern: /\.call\{value:/, description: 'External call with value before state update' },
    { pattern: /\.transfer\(/, description: 'Uses transfer (potential reentrancy vector)' },
    { pattern: /\.send\(/, description: 'Uses send (potential reentrancy vector)' },
  ],
  'access-control': [
    { pattern: /tx\.origin/, description: 'Uses tx.origin for auth' },
    { pattern: /function.*external(?!.*onlyOwner)(?!.*onlyRole)/i, description: 'Unprotected external function' },
  ],
  oracle: [
    { pattern: /getReserves\(\)/, description: 'Uses AMM reserves for pricing' },
    { pattern: /slot0\(\)/, description: 'Uses Uniswap V3 slot0 (manipulable)' },
  ],
  'flash-loan': [
    { pattern: /flashLoan|flashBorrow/i, description: 'Accepts flash loans' },
  ],
  arithmetic: [
    { pattern: /pragma solidity\s*\^?\s*0\.[4-7]/i, description: 'Pre-0.8 Solidity (no overflow protection)' },
  ],
  logic: [],
};

interface PatchPattern {
  pattern: RegExp;
  description: string;
}

interface VulnPattern {
  pattern: RegExp;
  description: string;
}

// ── Main Cascade Function ──

/**
 * Run the cascade verification pipeline on fork matches.
 *
 * For each fork:
 * 1. Fetch source code from chain explorer
 * 2. Check for patch indicators (suggesting vuln was fixed)
 * 3. Check for vulnerability indicators (suggesting vuln still exists)
 * 4. Classify as vulnerable, patched, or uncertain
 */
export async function runCascade(input: CascadeInput): Promise<CascadeResult> {
  const startTime = Date.now();
  const {
    originalContract,
    originalFinding,
    forkMatches,
    options = {},
  } = input;

  const {
    concurrency = DEFAULT_CONCURRENCY,
    fetchSource = true,
    runStaticAnalysis = true,
    timeoutPerFork = DEFAULT_TIMEOUT_PER_FORK,
  } = options;

  // Process forks in parallel batches
  const forkResults: CascadeForkResult[] = [];
  for (let i = 0; i < forkMatches.length; i += concurrency) {
    const batch = forkMatches.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(fork =>
        verifyFork(fork, originalFinding, {
          fetchSource,
          runStaticAnalysis,
          timeout: timeoutPerFork,
        }),
      ),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        forkResults.push(result.value);
      } else {
        forkResults.push({
          fork: batch[j],
          status: 'error',
          confidence: 0,
          sourceAvailable: false,
          patchIndicators: [],
          vulnIndicators: [],
          verificationMethod: 'none',
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  // Build summary
  const summary = buildSummary(forkResults);

  return {
    originalContract,
    originalFinding,
    forkResults,
    summary,
    duration: Date.now() - startTime,
  };
}

// ── Per-Fork Verification ──

interface VerifyOptions {
  fetchSource: boolean;
  runStaticAnalysis: boolean;
  timeout: number;
}

/**
 * Verify whether a single fork is vulnerable.
 */
async function verifyFork(
  fork: ForkMatch,
  originalFinding: Finding,
  options: VerifyOptions,
): Promise<CascadeForkResult> {
  const patchIndicators: string[] = [];
  const vulnIndicators: string[] = [];
  let sourceCode: string | undefined;
  let verificationMethod: CascadeForkResult['verificationMethod'] = 'none';

  // Step 1: Fetch source code if available
  if (options.fetchSource && fork.sourceAvailable) {
    sourceCode = await fetchSourceCode(fork.address, fork.chainId, options.timeout);
  }

  if (sourceCode) {
    verificationMethod = 'source_analysis';

    // Step 2: Check for patch indicators
    if (options.runStaticAnalysis) {
      const patches = PATCH_PATTERNS[originalFinding.vulnType] ?? [];
      for (const p of patches) {
        if (p.pattern.test(sourceCode)) {
          patchIndicators.push(p.description);
        }
      }

      // Step 3: Check for vulnerability indicators
      const vulns = VULN_INDICATORS[originalFinding.vulnType] ?? [];
      for (const v of vulns) {
        if (v.pattern.test(sourceCode)) {
          vulnIndicators.push(v.description);
        }
      }
    }
  } else {
    // No source — rely on bytecode similarity only
    verificationMethod = 'bytecode_only';
  }

  // Step 4: Classify
  const { status, confidence } = classifyFork(
    fork,
    patchIndicators,
    vulnIndicators,
    verificationMethod,
  );

  return {
    fork,
    status,
    confidence,
    sourceCode,
    sourceAvailable: !!sourceCode,
    patchIndicators,
    vulnIndicators,
    verificationMethod,
  };
}

// ── Classification Logic ──

/**
 * Classify a fork as vulnerable, patched, or uncertain.
 *
 * Scoring:
 * - Exact bytecode match + no patches → vulnerable (high confidence)
 * - Source analysis with no patches and vuln indicators → vulnerable
 * - Patch indicators found → patched
 * - Bytecode-only with high similarity → uncertain (medium confidence)
 */
function classifyFork(
  fork: ForkMatch,
  patchIndicators: string[],
  vulnIndicators: string[],
  verificationMethod: CascadeForkResult['verificationMethod'],
): { status: CascadeForkResult['status']; confidence: number } {
  const similarity = fork.similarity.overall;
  const isExact = fork.similarity.exactMatch;

  // If patches found → patched
  if (patchIndicators.length > 0 && vulnIndicators.length === 0) {
    return {
      status: 'patched',
      confidence: Math.min(90, 60 + patchIndicators.length * 10),
    };
  }

  // Exact bytecode match with no patches → vulnerable
  if (isExact && patchIndicators.length === 0) {
    return {
      status: 'vulnerable',
      confidence: 95,
    };
  }

  // Source analysis: vuln indicators + no patches → vulnerable
  if (verificationMethod === 'source_analysis' && vulnIndicators.length > 0 && patchIndicators.length === 0) {
    const baseConfidence = Math.min(85, 50 + vulnIndicators.length * 10 + (similarity - 70));
    return {
      status: 'vulnerable',
      confidence: baseConfidence,
    };
  }

  // Mixed signals: patches + vuln indicators → uncertain
  if (patchIndicators.length > 0 && vulnIndicators.length > 0) {
    return {
      status: 'uncertain',
      confidence: 40,
    };
  }

  // Bytecode-only: high similarity → likely vulnerable but uncertain
  if (verificationMethod === 'bytecode_only' && similarity >= 90) {
    return {
      status: 'vulnerable',
      confidence: Math.min(75, similarity - 20),
    };
  }

  if (verificationMethod === 'bytecode_only' && similarity >= 80) {
    return {
      status: 'uncertain',
      confidence: Math.min(60, similarity - 30),
    };
  }

  // Default: uncertain
  return {
    status: 'uncertain',
    confidence: Math.max(20, similarity / 3),
  };
}

// ── Source Code Fetching ──

/**
 * Fetch source code from Etherscan V2 by chain ID.
 */
async function fetchSourceCode(
  address: string,
  chainId: number,
  timeout: number,
): Promise<string | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      chainid: chainId.toString(),
      module: 'contract',
      action: 'getsourcecode',
      address,
      apikey: apiKey,
    });

    const response = await fetchWithTimeout(`${ETHERSCAN_V2_BASE}?${params}`, {
      timeoutMs: timeout,
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      result?: Array<{ SourceCode: string; ABI: string }>;
    };

    const result = data.result?.[0];
    if (!result || result.ABI === 'Contract source code not verified') return null;

    return result.SourceCode;
  } catch {
    return null;
  }
}

// ── Summary Builder ──

function buildSummary(results: CascadeForkResult[]): CascadeSummary {
  const vulnerableCount = results.filter(r => r.status === 'vulnerable').length;
  const patchedCount = results.filter(r => r.status === 'patched').length;
  const uncertainCount = results.filter(r => r.status === 'uncertain').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  const highestConfidence = results.length > 0
    ? Math.max(...results.map(r => r.confidence))
    : 0;

  const chainsAffected = [...new Set(
    results
      .filter(r => r.status === 'vulnerable')
      .map(r => r.fork.chain),
  )];

  return {
    totalForksChecked: results.length,
    vulnerableCount,
    patchedCount,
    uncertainCount,
    errorCount,
    highestConfidence,
    chainsAffected,
  };
}

// ── Exported helpers for tests ──

export { classifyFork, fetchSourceCode, buildSummary };
