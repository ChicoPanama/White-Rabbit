/**
 * Fork Hunter — Systematic Fork Detection Across Chains
 *
 * When a vulnerability is found in one contract, hunt for ALL forks/clones
 * across all 20+ EVM chains. One finding → dozens of verified vulnerabilities.
 */

import { EtherscanClient } from '../clients/etherscan.js';
import { DeFiLlamaClient } from '../clients/defillama.js';
import { ChainDiscoveryService } from './chains.js';
import type { DynamicChainConfig } from './chains.js';
import { PatternCache } from './patternCache.js';
import { PoCVerifier } from './verifier.js';
import { ExploitEstimator } from './exploitEstimator.js';
import type {
  VerifiedFinding,
  ForkMatch,
  VerifiedFork,
  ForkHuntResult,
  VulnerabilityPattern,
  ContractFingerprint,
  Contract,
} from '../types/index.js';
import { SEVERITY_ORDER } from '../types/index.js';

const MAX_PROTOCOLS_PER_CHAIN = 30;
const MIN_SIMILARITY_SCORE = 0.6;

/**
 * Security pattern strings that indicate a vulnerability was patched.
 */
const PATCH_INDICATORS: Record<string, string[]> = {
  reentrancy: ['ReentrancyGuard', 'nonReentrant', '_nonReentrant', 'reentrancyGuard'],
  'access-control': ['Ownable', 'AccessControl', 'onlyOwner', 'onlyRole', 'auth'],
  'oracle-manipulation': ['TWAP', 'twapPeriod', 'Chainlink', 'AggregatorV3Interface'],
  'proxy-vulnerability': ['UUPSUpgradeable', 'TransparentUpgradeableProxy', 'onlyProxy'],
};

export class ForkHunter {
  private readonly patternCache: PatternCache;
  private readonly etherscan: EtherscanClient;
  private readonly defillama: DeFiLlamaClient;
  private readonly chainDiscovery: ChainDiscoveryService;
  private readonly verifier: PoCVerifier;
  private readonly estimator: ExploitEstimator;

  constructor(
    patternCache: PatternCache,
    etherscan: EtherscanClient,
    defillama: DeFiLlamaClient,
    chainDiscovery: ChainDiscoveryService,
    verifier: PoCVerifier,
    estimator: ExploitEstimator,
  ) {
    this.patternCache = patternCache;
    this.etherscan = etherscan;
    this.defillama = defillama;
    this.chainDiscovery = chainDiscovery;
    this.verifier = verifier;
    this.estimator = estimator;
  }

  /**
   * Hunt for all forks of a vulnerable contract across all chains.
   * This is the main entry point — one finding cascades into many.
   */
  async huntForks(
    finding: VerifiedFinding,
    contractAddress: string,
    chainId: number,
    sourceCode: string,
    contractName: string,
  ): Promise<ForkHuntResult> {
    const startTime = Date.now();
    console.log(`\n[ForkHunter] Starting fork hunt for ${contractName} (${contractAddress.slice(0, 10)}...)`);

    // Step 1: Learn the pattern
    const pattern = this.patternCache.learnPattern(finding, contractAddress, chainId, sourceCode);
    console.log(`[ForkHunter] Pattern ${pattern.id.slice(0, 8)} learned/updated (type: ${pattern.patternType})`);

    // Step 2: Generate and store fingerprint
    const fingerprint = this.patternCache.generateFingerprint(contractAddress, chainId, contractName, sourceCode);
    this.patternCache.saveFingerprint(fingerprint);
    console.log(`[ForkHunter] Fingerprint stored (code: ${fingerprint.codeHash.slice(0, 8)}, structure: ${fingerprint.structureHash.slice(0, 8)})`);

    // Step 3: Get all chains to search
    const chains = await this.chainDiscovery.getTopChainsByTvl(20);
    console.log(`[ForkHunter] Searching ${chains.length} chains for forks...`);

    // Step 4: Search each chain
    const allMatches: ForkMatch[] = [];
    for (const chain of chains) {
      if (chain.chainId === chainId) continue; // Skip the origin chain

      try {
        const matches = await this.searchChainForForks(chain, fingerprint, pattern, contractName);
        if (matches.length > 0) {
          console.log(`[ForkHunter]   ${chain.name}: ${matches.length} potential matches`);
          allMatches.push(...matches);
        }
      } catch (err) {
        console.warn(`[ForkHunter]   ${chain.name}: search failed — ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Also search local fingerprint cache
    const cachedMatches = this.patternCache.findSimilarFingerprints(fingerprint);
    for (const cm of cachedMatches) {
      if (!allMatches.some(m => m.address === cm.contractAddress && m.chainId === cm.chainId)) {
        const chainConfig = chains.find(c => c.chainId === cm.chainId);
        allMatches.push({
          address: cm.contractAddress,
          chainId: cm.chainId,
          chainName: chainConfig?.name ?? `Chain ${cm.chainId}`,
          contractName: cm.contractName,
          matchMethod: cm.matchType as ForkMatch['matchMethod'],
          confidence: cm.similarityScore,
        });
      }
    }

    console.log(`[ForkHunter] Found ${allMatches.length} total potential forks. Verifying...`);

    // Step 5: Verify each match
    const verifiedForks: VerifiedFork[] = [];
    for (const match of allMatches) {
      try {
        const verification = await this.verifyFork(match, pattern, finding);
        verifiedForks.push(verification);

        if (verification.isVulnerable) {
          console.log(`[ForkHunter]   VULNERABLE: ${match.contractName} on ${match.chainName} — $${(verification.exploitableValue ?? 0).toLocaleString()}`);
        } else {
          const reason = verification.reason ?? 'unknown';
          console.log(`[ForkHunter]   Safe: ${match.contractName} on ${match.chainName} (${reason})`);
        }
      } catch (err) {
        console.warn(`[ForkHunter]   Failed to verify ${match.address} on ${match.chainName}: ${err instanceof Error ? err.message : String(err)}`);
        verifiedForks.push({
          isVulnerable: false,
          address: match.address,
          chainId: match.chainId,
          chainName: match.chainName,
          contractName: match.contractName,
          reason: `verification error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // Step 6: Calculate totals
    const vulnerableForks = verifiedForks.filter(f => f.isVulnerable);
    const totalValue = vulnerableForks.reduce((sum, f) => sum + (f.exploitableValue ?? 0), 0)
      + (finding.exploitEstimate?.estimatedExploitable ?? 0);
    const chainsAffected = new Set([chainId, ...vulnerableForks.map(f => f.chainId!).filter(Boolean)]).size;

    const duration = Date.now() - startTime;
    console.log(`[ForkHunter] Hunt complete: ${vulnerableForks.length} vulnerable forks, $${totalValue.toLocaleString()} total value, ${chainsAffected} chains affected (${(duration / 1000).toFixed(1)}s)`);

    return {
      originalAddress: contractAddress,
      originalChain: chainId,
      patternId: pattern.id,
      forksSearched: allMatches.length,
      verifiedVulnerable: vulnerableForks,
      totalValueAtRisk: totalValue,
      chainsAffected,
      duration,
    };
  }

  /**
   * Search a single chain for contracts matching the fingerprint or pattern.
   */
  private async searchChainForForks(
    chain: DynamicChainConfig,
    fingerprint: ContractFingerprint,
    pattern: VulnerabilityPattern,
    contractName: string,
  ): Promise<ForkMatch[]> {
    const matches: ForkMatch[] = [];

    // Method 1: Search by contract name via DeFiLlama protocols
    try {
      const protocols = await this.defillama.getTopProtocols(chain.slug, 100_000, MAX_PROTOCOLS_PER_CHAIN);
      for (const protocol of protocols) {
        // Check if protocol name is similar to the original contract
        const nameSimilarity = this.computeNameSimilarity(contractName, protocol.name);
        if (nameSimilarity > 0.5) {
          // This protocol might be a fork — we'd need contract addresses
          // For now, flag it as a potential match via name
          matches.push({
            address: '', // Unknown address — will need resolution
            chainId: chain.chainId,
            chainName: chain.name,
            contractName: protocol.name,
            matchMethod: 'name_search',
            confidence: nameSimilarity * 0.7,
            protocolName: protocol.name,
            protocolTvl: protocol.tvl,
          });
        }
      }
    } catch {
      // Protocol search failed for this chain
    }

    // Method 2: Search fingerprint cache for this chain
    const cachedOnChain = this.patternCache.findSimilarFingerprints(fingerprint, chain.chainId);
    // Invert the exclusion — we WANT this chain's results
    // Actually findSimilarFingerprints excludes the reference, so we just check all
    for (const cached of cachedOnChain) {
      if (cached.chainId === chain.chainId) {
        matches.push({
          address: cached.contractAddress,
          chainId: cached.chainId,
          chainName: chain.name,
          contractName: cached.contractName,
          matchMethod: cached.matchType as ForkMatch['matchMethod'],
          confidence: cached.similarityScore,
        });
      }
    }

    // Method 3: Check pattern code signatures against known contracts
    const patternInstances = this.patternCache.getPatternInstances(pattern.id);
    for (const instance of patternInstances) {
      if (instance.chainId === chain.chainId && !matches.some(m => m.address === instance.contractAddress)) {
        matches.push({
          address: instance.contractAddress,
          chainId: instance.chainId,
          chainName: chain.name,
          contractName: 'Known instance',
          matchMethod: 'exact_code',
          confidence: 1.0,
        });
      }
    }

    // Deduplicate by address
    const seen = new Set<string>();
    return matches.filter(m => {
      if (!m.address) return true; // Name-only matches kept
      const key = `${m.address}-${m.chainId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Verify if a matched contract is actually vulnerable.
   */
  private async verifyFork(
    match: ForkMatch,
    pattern: VulnerabilityPattern,
    originalFinding: VerifiedFinding,
  ): Promise<VerifiedFork> {
    // Skip matches without addresses (name-only matches need address resolution)
    if (!match.address) {
      return {
        isVulnerable: false,
        chainId: match.chainId,
        chainName: match.chainName,
        contractName: match.contractName,
        reason: 'no_address',
      };
    }

    // Skip low-confidence matches
    if (match.confidence < MIN_SIMILARITY_SCORE) {
      return {
        isVulnerable: false,
        address: match.address,
        chainId: match.chainId,
        chainName: match.chainName,
        contractName: match.contractName,
        reason: `low_confidence (${(match.confidence * 100).toFixed(0)}%)`,
      };
    }

    // Get the contract source
    let source: { name: string; sourceCode: string } | null = null;
    try {
      source = await this.etherscan.getContractSource(match.chainId, match.address);
    } catch {
      return {
        isVulnerable: false,
        address: match.address,
        chainId: match.chainId,
        chainName: match.chainName,
        contractName: match.contractName,
        reason: 'source_fetch_failed',
      };
    }

    if (!source) {
      return {
        isVulnerable: false,
        address: match.address,
        chainId: match.chainId,
        chainName: match.chainName,
        contractName: match.contractName,
        reason: 'unverified_source',
      };
    }

    // Check 1: Does the code match the vulnerability pattern?
    const codeCheck = this.checkCodePattern(source.sourceCode, pattern);
    if (!codeCheck.matches) {
      // Record learning event if patched
      if (codeCheck.reason === 'patched') {
        this.patternCache.logEvent('patch_detected', pattern.id, match.address, match.chainId, {
          patchDetails: codeCheck.patchDetails,
        });
      }
      return {
        isVulnerable: false,
        address: match.address,
        chainId: match.chainId,
        chainName: match.chainName,
        contractName: source.name || match.contractName,
        reason: codeCheck.reason,
        patchDetails: codeCheck.patchDetails,
      };
    }

    // Check 2: Estimate exploitable value
    let exploitableValue = 0;
    try {
      const contract: Contract = {
        id: `fork-${match.address}`,
        address: match.address,
        chainId: match.chainId,
        name: source.name || match.contractName,
        sourceCode: source.sourceCode,
        abi: [],
        compilerVersion: '',
        isProxy: false,
        implementationAddress: null,
        tvlUsd: match.protocolTvl ?? null,
        protocolName: match.protocolName ?? null,
      };
      const estimate = await this.estimator.estimate(originalFinding, contract, match.chainId);
      exploitableValue = estimate.estimatedExploitable;
    } catch {
      // Estimation failed — use protocol TVL as rough estimate
      exploitableValue = (match.protocolTvl ?? 0) * 0.05; // 5% of TVL
    }

    if (exploitableValue < 1000) {
      return {
        isVulnerable: false,
        address: match.address,
        chainId: match.chainId,
        chainName: match.chainName,
        contractName: source.name || match.contractName,
        reason: 'no_value',
        exploitableValue,
      };
    }

    // Check 3: Optionally verify PoC (for high-value forks)
    let pocVerified = false;
    if (exploitableValue >= 25_000 && this.verifier.isAvailable) {
      try {
        const pocResult = await this.verifier.verify(originalFinding, match.address, match.chainId);
        pocVerified = pocResult?.succeeded ?? false;
      } catch {
        // PoC failed — still report based on code match
      }
    }

    // Store fingerprint for this fork
    const fp = this.patternCache.generateFingerprint(match.address, match.chainId, source.name, source.sourceCode);
    this.patternCache.saveFingerprint(fp);

    return {
      isVulnerable: true,
      address: match.address,
      chainId: match.chainId,
      chainName: match.chainName,
      contractName: source.name || match.contractName,
      exploitableValue,
      reason: pocVerified ? 'poc_verified' : 'code_match',
    };
  }

  /**
   * Check if source code matches the vulnerability pattern.
   */
  private checkCodePattern(
    sourceCode: string,
    pattern: VulnerabilityPattern,
  ): { matches: boolean; reason?: string; patchDetails?: string } {
    const sigs = pattern.codeSignatures;

    // Check for known false positive signatures first
    for (const fpSig of pattern.falsePositiveSignatures) {
      if (sourceCode.includes(fpSig)) {
        return { matches: false, reason: 'known_false_positive', patchDetails: fpSig };
      }
    }

    // Check for patch indicators specific to this vulnerability type
    const patchSigs = PATCH_INDICATORS[pattern.patternType];
    if (patchSigs) {
      for (const patch of patchSigs) {
        if (sourceCode.includes(patch)) {
          return { matches: false, reason: 'patched', patchDetails: `Uses ${patch}` };
        }
      }
    }

    // Check exact code matches
    for (const exact of sigs.exactMatch) {
      if (exact && sourceCode.includes(exact)) {
        return { matches: true };
      }
    }

    // Check regex patterns
    for (const regex of sigs.regexPatterns) {
      try {
        if (new RegExp(regex, 's').test(sourceCode)) {
          return { matches: true };
        }
      } catch {
        // Invalid regex
      }
    }

    // Check function signature overlap
    if (sigs.functionSignatures.length > 0) {
      const sourceFunctions = this.patternCache.extractFunctionSignatures(sourceCode);
      const overlap = sigs.functionSignatures.filter(s => sourceFunctions.includes(s));
      const overlapRatio = overlap.length / sigs.functionSignatures.length;
      if (overlapRatio > 0.7) {
        // High function overlap — likely same contract
        return { matches: true };
      }
    }

    return { matches: false, reason: 'no_pattern_match' };
  }

  /**
   * Compute simple name similarity between two strings.
   */
  private computeNameSimilarity(a: string, b: string): number {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    if (la === lb) return 1.0;
    if (la.includes(lb) || lb.includes(la)) return 0.8;

    // Jaccard similarity of character bigrams
    const bigramsA = this.getBigrams(la);
    const bigramsB = this.getBigrams(lb);
    if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

    let intersection = 0;
    for (const bg of bigramsA) {
      if (bigramsB.has(bg)) intersection++;
    }
    return intersection / (bigramsA.size + bigramsB.size - intersection);
  }

  private getBigrams(s: string): Set<string> {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.slice(i, i + 2));
    }
    return bigrams;
  }
}
