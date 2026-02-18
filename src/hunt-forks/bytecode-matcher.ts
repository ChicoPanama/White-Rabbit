/**
 * Bytecode similarity engine for fork detection.
 *
 * Extracts bytecode signatures, computes similarity scores, and
 * classifies contract relationships (exact fork, modified fork, related).
 */

import * as crypto from 'node:crypto';

// ── Types ──

export interface BytecodeSignature {
  functionSelectors: string[];      // 4-byte hex selectors
  normalizedHash: string;           // Hash of bytecode with stripped immutables
  codeSize: number;                 // Deployed bytecode length
  rawBytecodeHash: string;          // Full bytecode hash
}

export interface SimilarityScore {
  overall: number;                  // 0-100 composite score
  selectorOverlap: number;          // 0-100 Jaccard index of selectors
  codeSizeSimilarity: number;       // 0-100
  exactMatch: boolean;              // normalizedHash match
  classification: 'exact_fork' | 'modified_fork' | 'related' | 'unrelated';
}

export interface SimilarContract {
  chain: string;
  address: string;
  name?: string;
  similarityScore: number;
  matchType: 'exact_fork' | 'modified_fork' | 'related';
  functionOverlap: number;
  sourceAvailable: boolean;
}

export interface SearchOptions {
  maxResults: number;
  minSimilarity: number;
}

// ── Bytecode Signature Extraction ──

/**
 * Extract a signature from deployed bytecode for comparison.
 *
 * - Strips constructor args (appended after STOP opcode pattern)
 * - Extracts 4-byte function selectors from PUSH4 opcodes
 * - Computes normalized hash ignoring immutable slots
 */
export function extractBytecodeSignature(bytecode: string): BytecodeSignature {
  // Normalize: strip 0x prefix, lowercase
  let code = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
  code = code.toLowerCase();

  // Strip constructor arguments (metadata hash at end)
  // Solidity appends CBOR-encoded metadata; strip last 43+ bytes typically
  const strippedCode = stripConstructorArgs(code);

  // Extract function selectors
  const selectors = extractFunctionSelectors(strippedCode);

  // Normalize: zero out immutable value slots (32-byte PUSH32 values)
  const normalized = normalizeImmutables(strippedCode);

  const normalizedHash = crypto.createHash('sha256').update(normalized).digest('hex');
  const rawHash = crypto.createHash('sha256').update(code).digest('hex');

  return {
    functionSelectors: selectors,
    normalizedHash,
    codeSize: Math.floor(code.length / 2), // bytes
    rawBytecodeHash: rawHash,
  };
}

/**
 * Strip constructor args and Solidity metadata from deployed bytecode.
 */
function stripConstructorArgs(bytecode: string): string {
  // Solidity metadata starts with 0xa264 (CBOR prefix)
  // Find the last occurrence and strip from there
  const metadataIdx = bytecode.lastIndexOf('a264');
  if (metadataIdx > 0 && metadataIdx > bytecode.length * 0.8) {
    return bytecode.slice(0, metadataIdx);
  }

  // Fallback: strip last 86 chars (43 bytes = typical metadata length)
  if (bytecode.length > 172) {
    return bytecode.slice(0, -86);
  }

  return bytecode;
}

/**
 * Extract 4-byte function selectors from bytecode.
 * Looks for PUSH4 (0x63) opcodes which typically precede selector comparisons.
 */
function extractFunctionSelectors(bytecode: string): string[] {
  const selectors = new Set<string>();

  // PUSH4 opcode = 0x63, followed by 4 bytes (8 hex chars)
  for (let i = 0; i < bytecode.length - 9; i += 2) {
    if (bytecode.slice(i, i + 2) === '63') {
      const selector = '0x' + bytecode.slice(i + 2, i + 10);
      // Filter out common non-selector values
      if (!isLikelyNonSelector(selector)) {
        selectors.add(selector);
      }
    }
  }

  return [...selectors].sort();
}

/**
 * Filter out values that look like PUSH4 but aren't function selectors.
 */
function isLikelyNonSelector(selector: string): boolean {
  const hex = selector.slice(2);
  // All zeros or all F's are not selectors
  if (hex === '00000000' || hex === 'ffffffff') return true;
  // Sequential bytes are unlikely selectors
  if (hex === '01020304' || hex === '04030201') return true;
  return false;
}

/**
 * Normalize bytecode by zeroing out immutable value slots.
 * PUSH32 (0x7f) values are likely immutables or constants.
 */
function normalizeImmutables(bytecode: string): string {
  // Replace PUSH32 values with zeros (PUSH32 = 0x7f, followed by 32 bytes = 64 hex chars)
  return bytecode.replace(/7f[0-9a-f]{64}/g, '7f' + '0'.repeat(64));
}

// ── Bytecode Comparison ──

/**
 * Compare two bytecode signatures and compute a similarity score.
 */
export function compareBytecode(sig1: BytecodeSignature, sig2: BytecodeSignature): SimilarityScore {
  // Exact normalized hash match
  const exactMatch = sig1.normalizedHash === sig2.normalizedHash;

  // Function selector overlap (Jaccard index)
  const selectorOverlap = jaccardIndex(sig1.functionSelectors, sig2.functionSelectors);

  // Code size similarity
  const maxSize = Math.max(sig1.codeSize, sig2.codeSize);
  const minSize = Math.min(sig1.codeSize, sig2.codeSize);
  const codeSizeSimilarity = maxSize > 0 ? (minSize / maxSize) * 100 : 100;

  // Composite score
  let overall: number;
  if (exactMatch) {
    overall = 100;
  } else {
    // Weighted: 70% selector overlap, 30% code size
    overall = Math.round(selectorOverlap * 0.7 + codeSizeSimilarity * 0.3);
  }

  // Classification
  let classification: SimilarityScore['classification'];
  if (overall >= 95) {
    classification = 'exact_fork';
  } else if (overall >= 80) {
    classification = 'modified_fork';
  } else if (overall >= 60) {
    classification = 'related';
  } else {
    classification = 'unrelated';
  }

  return {
    overall,
    selectorOverlap: Math.round(selectorOverlap),
    codeSizeSimilarity: Math.round(codeSizeSimilarity),
    exactMatch,
    classification,
  };
}

/**
 * Jaccard similarity index for two sets of selectors.
 * Returns 0-100.
 */
function jaccardIndex(set1: string[], set2: string[]): number {
  if (set1.length === 0 && set2.length === 0) return 100;
  if (set1.length === 0 || set2.length === 0) return 0;

  const s1 = new Set(set1);
  const s2 = new Set(set2);

  let intersection = 0;
  for (const item of s1) {
    if (s2.has(item)) intersection++;
  }

  const union = s1.size + s2.size - intersection;
  return union > 0 ? (intersection / union) * 100 : 0;
}

// ── Similar Contract Search ──

/**
 * Search for similar contracts on a given chain.
 *
 * This is a signature-based search that compares bytecode signatures.
 * Actual RPC/explorer calls are handled by the fork hunter.
 */
export function matchAgainstCandidates(
  signature: BytecodeSignature,
  candidates: Array<{ address: string; bytecode: string; chain: string; name?: string; sourceAvailable?: boolean }>,
  options: SearchOptions = { maxResults: 20, minSimilarity: 80 },
): SimilarContract[] {
  const results: SimilarContract[] = [];

  for (const candidate of candidates) {
    try {
      const candidateSig = extractBytecodeSignature(candidate.bytecode);
      const score = compareBytecode(signature, candidateSig);

      if (score.overall >= options.minSimilarity && score.classification !== 'unrelated') {
        results.push({
          chain: candidate.chain,
          address: candidate.address,
          name: candidate.name,
          similarityScore: score.overall,
          matchType: score.classification as SimilarContract['matchType'],
          functionOverlap: score.selectorOverlap,
          sourceAvailable: candidate.sourceAvailable ?? false,
        });
      }
    } catch {
      // Skip invalid bytecode
    }
  }

  // Sort by similarity score descending
  results.sort((a, b) => b.similarityScore - a.similarityScore);

  return results.slice(0, options.maxResults);
}
