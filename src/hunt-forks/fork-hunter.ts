/**
 * Fork Hunter — Multi-chain parallel search for contract forks.
 *
 * Given a vulnerable contract, searches across all configured chains
 * for bytecode-similar deployments using Etherscan APIs and bytecode
 * comparison. Parallelizes per-chain search with concurrency control.
 */

import { getEnabledHuntChains } from './chain-registry.js';
import type { HuntChainConfig } from './chain-registry.js';
import {
  extractBytecodeSignature,
  compareBytecode,
} from './bytecode-matcher.js';
import type { BytecodeSignature, SimilarityScore } from './bytecode-matcher.js';
import { fetchWithTimeout } from '../utils/helpers.js';

// ── Types ──

export interface VulnerableContract {
  address: string;
  chain: string;                      // Chain ID string (e.g. 'ethereum')
  chainId: number;                    // Numeric chain ID
  name: string;                       // Contract name
  bytecode?: string;                  // Deployed bytecode (hex)
  sourceCode?: string;                // Solidity source (optional)
  vulnType: string;                   // e.g. 'reentrancy', 'oracle'
  vulnTitle: string;                  // Finding title
  exploitableValue?: number;          // USD value at risk in original
}

export interface HuntOptions {
  chains?: string[] | 'all';          // Chains to search (default: all enabled)
  maxResultsPerChain?: number;        // Max matches per chain (default: 10)
  minSimilarity?: number;             // Min similarity 0-100 (default: 70)
  concurrency?: number;               // Parallel chain searches (default: 5)
  timeoutPerChain?: number;           // Per-chain timeout ms (default: 30000)
  includeUnverified?: boolean;        // Include unverified bytecode (default: false)
}

export interface ForkMatch {
  address: string;
  chain: string;
  chainId: number;
  name: string;
  similarity: SimilarityScore;
  matchType: 'exact_fork' | 'modified_fork' | 'related';
  sourceAvailable: boolean;
  bytecodeSignature: BytecodeSignature;
}

export interface ChainSearchResult {
  chain: string;
  chainId: number;
  matches: ForkMatch[];
  candidatesChecked: number;
  searchDuration: number;             // ms
  error?: string;
}

export interface ForkHuntResult {
  originalContract: VulnerableContract;
  signature: BytecodeSignature;
  chainResults: ChainSearchResult[];
  totalMatches: number;
  totalChainsSearched: number;
  totalChainsWithMatches: number;
  topMatches: ForkMatch[];            // Top matches across all chains, sorted by similarity
  duration: number;                    // Total ms
}

// ── Constants ──

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MIN_SIMILARITY = 70;
const DEFAULT_MAX_PER_CHAIN = 10;
const DEFAULT_TIMEOUT_PER_CHAIN = 30_000;
const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';

// ── Main Hunt Function ──

/**
 * Hunt for forks of a vulnerable contract across multiple chains.
 *
 * Strategy:
 * 1. Extract bytecode signature from the original contract
 * 2. For each target chain (in parallel batches):
 *    a. Use Etherscan to find contracts with similar names/deployers
 *    b. Fetch their bytecode
 *    c. Compare bytecode signatures
 * 3. Aggregate and rank results
 */
export async function huntForks(
  contract: VulnerableContract,
  options: HuntOptions = {},
): Promise<ForkHuntResult> {
  const startTime = Date.now();

  const {
    chains: chainFilter,
    maxResultsPerChain = DEFAULT_MAX_PER_CHAIN,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
    concurrency = DEFAULT_CONCURRENCY,
    timeoutPerChain = DEFAULT_TIMEOUT_PER_CHAIN,
    includeUnverified = false,
  } = options;

  // 1. Extract original signature
  let signature: BytecodeSignature;
  if (contract.bytecode) {
    signature = extractBytecodeSignature(contract.bytecode);
  } else {
    // Need to fetch bytecode from source chain
    const bytecode = await fetchBytecodeFromChain(contract.address, contract.chainId);
    if (!bytecode) {
      return emptyResult(contract, Date.now() - startTime);
    }
    signature = extractBytecodeSignature(bytecode);
  }

  // 2. Determine chains to search (exclude original chain)
  const targetChains = getEnabledHuntChains(chainFilter)
    .filter(c => c.id !== contract.chain);

  if (targetChains.length === 0) {
    return emptyResult(contract, Date.now() - startTime, signature);
  }

  // 3. Search chains in parallel batches
  const chainResults: ChainSearchResult[] = [];
  for (let i = 0; i < targetChains.length; i += concurrency) {
    const batch = targetChains.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(chain =>
        searchChainForForks(chain, contract, signature, {
          maxResults: maxResultsPerChain,
          minSimilarity,
          timeout: timeoutPerChain,
          includeUnverified,
        }),
      ),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        chainResults.push(result.value);
      } else {
        chainResults.push({
          chain: batch[j].id,
          chainId: batch[j].chainId,
          matches: [],
          candidatesChecked: 0,
          searchDuration: 0,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  // 4. Aggregate results
  const allMatches = chainResults.flatMap(r => r.matches);
  allMatches.sort((a, b) => b.similarity.overall - a.similarity.overall);

  const chainsWithMatches = chainResults.filter(r => r.matches.length > 0).length;

  return {
    originalContract: contract,
    signature,
    chainResults,
    totalMatches: allMatches.length,
    totalChainsSearched: chainResults.length,
    totalChainsWithMatches: chainsWithMatches,
    topMatches: allMatches.slice(0, 50),
    duration: Date.now() - startTime,
  };
}

// ── Per-Chain Search ──

interface ChainSearchOptions {
  maxResults: number;
  minSimilarity: number;
  timeout: number;
  includeUnverified: boolean;
}

/**
 * Search a single chain for contracts similar to the target.
 *
 * Strategy:
 * 1. Search by contract name on the target chain
 * 2. Fetch bytecode for each candidate
 * 3. Compare with target signature
 */
async function searchChainForForks(
  chain: HuntChainConfig,
  originalContract: VulnerableContract,
  targetSignature: BytecodeSignature,
  options: ChainSearchOptions,
): Promise<ChainSearchResult> {
  const searchStart = Date.now();
  const matches: ForkMatch[] = [];
  let candidatesChecked = 0;

  try {
    // Find candidate addresses on this chain
    const candidates = await findCandidates(
      chain,
      originalContract.name,
      options.timeout,
    );

    // Compare each candidate's bytecode to the target
    for (const candidate of candidates) {
      if (candidatesChecked >= options.maxResults * 3) break; // Limit API calls
      candidatesChecked++;

      try {
        const bytecode = await fetchBytecodeFromExplorer(
          chain,
          candidate.address,
          options.timeout,
        );
        if (!bytecode && !options.includeUnverified) continue;
        if (!bytecode) continue;

        const candidateSig = extractBytecodeSignature(bytecode);
        const score = compareBytecode(targetSignature, candidateSig);

        if (score.overall >= options.minSimilarity && score.classification !== 'unrelated') {
          matches.push({
            address: candidate.address,
            chain: chain.id,
            chainId: chain.chainId,
            name: candidate.name ?? 'Unknown',
            similarity: score,
            matchType: score.classification as ForkMatch['matchType'],
            sourceAvailable: candidate.sourceAvailable,
            bytecodeSignature: candidateSig,
          });
        }
      } catch {
        // Skip individual candidate failures
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity.overall - a.similarity.overall);

    return {
      chain: chain.id,
      chainId: chain.chainId,
      matches: matches.slice(0, options.maxResults),
      candidatesChecked,
      searchDuration: Date.now() - searchStart,
    };
  } catch (err) {
    return {
      chain: chain.id,
      chainId: chain.chainId,
      matches: [],
      candidatesChecked,
      searchDuration: Date.now() - searchStart,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Candidate Discovery ──

interface CandidateContract {
  address: string;
  name?: string;
  sourceAvailable: boolean;
}

/**
 * Find candidate contracts on a chain that might be forks.
 *
 * Uses multiple strategies:
 * 1. Etherscan contract search by name
 * 2. Per-chain explorer API if available
 */
async function findCandidates(
  chain: HuntChainConfig,
  contractName: string,
  timeout: number,
): Promise<CandidateContract[]> {
  const candidates: CandidateContract[] = [];
  const seen = new Set<string>();

  // Strategy 1: Search via Etherscan V2 (works for etherscan-type chains)
  if (chain.explorerType === 'etherscan') {
    const apiKey = chain.explorerApiKeyEnv ? process.env[chain.explorerApiKeyEnv] : undefined;
    const etherscanCandidates = await searchEtherscanByName(
      chain.chainId,
      contractName,
      apiKey,
      timeout,
    );

    for (const c of etherscanCandidates) {
      const addr = c.address.toLowerCase();
      if (!seen.has(addr)) {
        seen.add(addr);
        candidates.push(c);
      }
    }
  }

  // Strategy 2: Direct explorer API search
  if (chain.explorerApiUrl && chain.explorerType !== 'etherscan') {
    const explorerCandidates = await searchExplorerByName(
      chain.explorerApiUrl,
      contractName,
      chain.explorerApiKeyEnv ? process.env[chain.explorerApiKeyEnv] : undefined,
      timeout,
    );

    for (const c of explorerCandidates) {
      const addr = c.address.toLowerCase();
      if (!seen.has(addr)) {
        seen.add(addr);
        candidates.push(c);
      }
    }
  }

  return candidates;
}

// ── Etherscan API Helpers ──

/**
 * Search Etherscan V2 for contracts matching a name.
 */
async function searchEtherscanByName(
  chainId: number,
  contractName: string,
  apiKey: string | undefined,
  timeout: number,
): Promise<CandidateContract[]> {
  if (!apiKey) return [];

  try {
    // Use the contract list API to find similar contracts
    const params = new URLSearchParams({
      chainid: chainId.toString(),
      module: 'contract',
      action: 'listcontracts',
      page: '1',
      offset: '50',
      apikey: apiKey,
    });

    const response = await fetchWithTimeout(`${ETHERSCAN_V2_BASE}?${params}`, {
      timeoutMs: timeout,
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      result?: Array<{ Address: string; ContractName: string; ABI: string }>;
    };

    if (!data.result || !Array.isArray(data.result)) return [];

    // Filter by name similarity
    const normalizedName = contractName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return data.result
      .filter(c => {
        const cn = c.ContractName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cn.includes(normalizedName) ||
               normalizedName.includes(cn) ||
               levenshteinSimilarity(cn, normalizedName) > 0.6;
      })
      .map(c => ({
        address: c.Address,
        name: c.ContractName,
        sourceAvailable: c.ABI !== 'Contract source code not verified',
      }));
  } catch {
    return [];
  }
}

/**
 * Search a non-Etherscan explorer (Blockscout, etc.) by contract name.
 */
async function searchExplorerByName(
  explorerApiUrl: string,
  contractName: string,
  apiKey: string | undefined,
  timeout: number,
): Promise<CandidateContract[]> {
  try {
    const params = new URLSearchParams({
      module: 'contract',
      action: 'listcontracts',
      page: '1',
      offset: '50',
    });
    if (apiKey) params.set('apikey', apiKey);

    const response = await fetchWithTimeout(`${explorerApiUrl}?${params}`, {
      timeoutMs: timeout,
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      result?: Array<{ Address?: string; address?: string; ContractName?: string; contractName?: string }>;
    };

    if (!data.result || !Array.isArray(data.result)) return [];

    const normalizedName = contractName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return data.result
      .filter(c => {
        const name = (c.ContractName ?? c.contractName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return name.includes(normalizedName) || normalizedName.includes(name);
      })
      .map(c => ({
        address: (c.Address ?? c.address ?? '').toLowerCase(),
        name: c.ContractName ?? c.contractName,
        sourceAvailable: true,
      }))
      .filter(c => c.address.length === 42);
  } catch {
    return [];
  }
}

// ── Bytecode Fetching ──

/**
 * Fetch deployed bytecode from Etherscan V2 by chain ID.
 */
async function fetchBytecodeFromChain(
  address: string,
  chainId: number,
  timeout = DEFAULT_TIMEOUT_PER_CHAIN,
): Promise<string | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      chainid: chainId.toString(),
      module: 'proxy',
      action: 'eth_getCode',
      address,
      tag: 'latest',
      apikey: apiKey,
    });

    const response = await fetchWithTimeout(`${ETHERSCAN_V2_BASE}?${params}`, {
      timeoutMs: timeout,
    });
    if (!response.ok) return null;

    const data = await response.json() as { result?: string };
    const code = data.result;
    if (!code || code === '0x' || code === '0x0') return null;

    return code;
  } catch {
    return null;
  }
}

/**
 * Fetch deployed bytecode from a specific chain's explorer.
 */
async function fetchBytecodeFromExplorer(
  chain: HuntChainConfig,
  address: string,
  timeout: number,
): Promise<string | null> {
  // First try Etherscan V2 (works for most chains)
  const bytecode = await fetchBytecodeFromChain(address, chain.chainId, timeout);
  if (bytecode) return bytecode;

  // Fallback: try chain-specific explorer
  if (chain.explorerApiUrl) {
    try {
      const apiKey = chain.explorerApiKeyEnv ? process.env[chain.explorerApiKeyEnv] : undefined;
      const params = new URLSearchParams({
        module: 'proxy',
        action: 'eth_getCode',
        address,
        tag: 'latest',
      });
      if (apiKey) params.set('apikey', apiKey);

      const response = await fetchWithTimeout(`${chain.explorerApiUrl}?${params}`, {
        timeoutMs: timeout,
      });
      if (!response.ok) return null;

      const data = await response.json() as { result?: string };
      const code = data.result;
      if (!code || code === '0x' || code === '0x0') return null;

      return code;
    } catch {
      return null;
    }
  }

  return null;
}

// ── Utility ──

/**
 * Levenshtein-based string similarity (0-1).
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Build an empty ForkHuntResult.
 */
function emptyResult(
  contract: VulnerableContract,
  duration: number,
  signature?: BytecodeSignature,
): ForkHuntResult {
  return {
    originalContract: contract,
    signature: signature ?? {
      functionSelectors: [],
      normalizedHash: '',
      codeSize: 0,
      rawBytecodeHash: '',
    },
    chainResults: [],
    totalMatches: 0,
    totalChainsSearched: 0,
    totalChainsWithMatches: 0,
    topMatches: [],
    duration,
  };
}

// ── Exported Helpers (for cascade-scanner and tests) ──

export { fetchBytecodeFromChain, fetchBytecodeFromExplorer, levenshteinSimilarity };
