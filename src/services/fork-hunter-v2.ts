/**
 * ForkHunterV2 — Targeted hunt for unpatched forks of known hacked protocols.
 *
 * Strategy: For each known hack, search across all EVM chains for contracts
 * that match the vulnerable code pattern but NOT the patch pattern.
 * Then verify with Slither and estimate exploitable value.
 *
 * This has a much higher hit rate than general scanning because:
 *  1. Vulnerability is already confirmed exploitable (not theoretical)
 *  2. Many forks are lazy copies with zero security review
 *  3. Pattern matching is deterministic (no AI needed)
 *  4. Low false positive rate
 */

import type { KnownHack, VulnerabilityType } from '../data/known-hacks.js';
import { KNOWN_HACKS, getPriorityHacks, VULN_TYPE_FORK_SCORE } from '../data/known-hacks.js';
import { EtherscanClient } from '../clients/etherscan.js';
import { DeFiLlamaClient } from '../clients/defillama.js';
import { SlitherAnalyzer } from '../analyzers/slither.js';
import { ChainDiscoveryService } from './chains.js';
import type { DynamicChainConfig } from './chains.js';
import { capitalize } from '../utils/helpers.js';

export interface VulnerableFork {
  hack: KnownHack;
  chain: string;
  chainId: number;
  address: string;
  name: string;
  tvl: number;
  confidence: number; // 0-1
  /** How was the vulnerability confirmed */
  verificationMethod: 'code_pattern' | 'slither_confirmed' | 'code_and_slither';
  /** Is there an Immunefi bounty for this protocol? */
  immunefiBounty: boolean;
}

export interface ForkHuntSummary {
  hacksScanned: number;
  chainsSearched: number;
  contractsExamined: number;
  vulnerableForksFound: VulnerableFork[];
  patchedForksFound: number;
  totalValueAtRisk: number;
  duration: number;
}

/** Protocols known to have Immunefi bug bounties (lowercase name fragments) */
const IMMUNEFI_PROTOCOLS = new Set([
  'aave', 'compound', 'uniswap', 'sushiswap', 'curve', 'balancer',
  'yearn', 'maker', 'synthetix', 'lido', 'rocket', 'frax', 'gmx',
  'radiant', 'pendle', 'morpho', 'euler', 'benqi', 'trader', 'joe',
  'pangolin', 'quickswap', 'camelot', 'velo', 'aerodrome',
]);

export class ForkHunterV2 {
  private readonly etherscan: EtherscanClient;
  private readonly defillama: DeFiLlamaClient;
  private readonly slither: SlitherAnalyzer;
  private readonly chainDiscovery: ChainDiscoveryService;

  constructor(
    etherscan: EtherscanClient,
    defillama: DeFiLlamaClient,
    slither: SlitherAnalyzer,
    chainDiscovery: ChainDiscoveryService,
  ) {
    this.etherscan = etherscan;
    this.defillama = defillama;
    this.slither = slither;
    this.chainDiscovery = chainDiscovery;
  }

  /**
   * Hunt for vulnerable forks of a specific known hack across chains.
   */
  async findVulnerableForks(
    hack: KnownHack,
    chainSlugs: string[],
    minTvl = 10_000,
  ): Promise<VulnerableFork[]> {
    const results: VulnerableFork[] = [];

    for (const slug of chainSlugs) {
      const chainConfig = this.chainDiscovery.getChainConfig(slug);
      if (!chainConfig) continue;

      try {
        const forks = await this.searchChainForHackForks(hack, chainConfig, minTvl);
        results.push(...forks);
      } catch (err) {
        console.warn(`[ForkHunterV2] Error searching ${slug} for ${hack.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return results;
  }

  /**
   * Run a full fork hunt across all known hacks and chains.
   */
  async huntAll(
    chainSlugs: string[],
    minTvl = 10_000,
    hackFilter?: string,
  ): Promise<ForkHuntSummary> {
    const startTime = Date.now();

    const hacks = hackFilter && hackFilter !== 'all'
      ? KNOWN_HACKS.filter(h => h.id === hackFilter)
      : getPriorityHacks();

    if (hacks.length === 0) {
      return {
        hacksScanned: 0,
        chainsSearched: 0,
        contractsExamined: 0,
        vulnerableForksFound: [],
        patchedForksFound: 0,
        totalValueAtRisk: 0,
        duration: Date.now() - startTime,
      };
    }

    const allForks: VulnerableFork[] = [];
    let contractsExamined = 0;
    let patchedCount = 0;

    for (const hack of hacks) {
      console.log(`\n[ForkHunterV2] Hunting: ${hack.name} ($${(hack.amountLost / 1e6).toFixed(1)}M lost)`);
      console.log(`  Type: ${hack.vulnerability.type}, Detectors: ${hack.vulnerability.detectors.join(', ')}`);

      for (const slug of chainSlugs) {
        const chainConfig = this.chainDiscovery.getChainConfig(slug);
        if (!chainConfig) continue;

        try {
          const { forks, examined, patched } = await this.searchChainDetailed(hack, chainConfig, minTvl);
          allForks.push(...forks);
          contractsExamined += examined;
          patchedCount += patched;

          if (forks.length > 0) {
            console.log(`  [${chainConfig.name}] Found ${forks.length} vulnerable fork(s)!`);
            for (const f of forks) {
              console.log(`    - ${f.name} (${f.address.slice(0, 10)}...) TVL: $${f.tvl.toLocaleString()}`);
            }
          }
        } catch (err) {
          console.warn(`  [${chainConfig.name}] Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return {
      hacksScanned: hacks.length,
      chainsSearched: chainSlugs.length,
      contractsExamined,
      vulnerableForksFound: allForks,
      patchedForksFound: patchedCount,
      totalValueAtRisk: allForks.reduce((sum, f) => sum + f.tvl, 0),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Search a single chain for forks of a specific hack.
   */
  private async searchChainForHackForks(
    hack: KnownHack,
    chain: DynamicChainConfig,
    minTvl: number,
  ): Promise<VulnerableFork[]> {
    const { forks } = await this.searchChainDetailed(hack, chain, minTvl);
    return forks;
  }

  private async searchChainDetailed(
    hack: KnownHack,
    chain: DynamicChainConfig,
    minTvl: number,
  ): Promise<{ forks: VulnerableFork[]; examined: number; patched: number }> {
    const forks: VulnerableFork[] = [];
    let examined = 0;
    let patched = 0;

    // Strategy 1: Search DeFiLlama protocols by name keywords
    const candidates = await this.findCandidateProtocols(hack, chain.slug, minTvl);

    for (const candidate of candidates) {
      // Fetch contract source from Etherscan
      const source = await this.etherscan.getContractSource(chain.chainId, candidate.address);
      if (!source || !source.sourceCode) continue;
      examined++;

      // Check if code matches vulnerable pattern
      const isVulnerable = hack.vulnerability.codePatterns.some(p => p.test(source.sourceCode));
      if (!isVulnerable) continue;

      // Check if it's been patched
      const isPatched = hack.patch.codePatterns.some(p => p.test(source.sourceCode));
      if (isPatched) {
        patched++;
        continue;
      }

      // Optionally verify with Slither
      let verificationMethod: VulnerableFork['verificationMethod'] = 'code_pattern';
      try {
        const findings = await this.slither.analyze(
          candidate.address,
          chain.chainId,
          source.sourceCode,
          source.compilerVersion,
        );
        const hasDetector = findings.some(f =>
          hack.vulnerability.detectors.includes(f.detectorName),
        );
        if (hasDetector) {
          verificationMethod = 'code_and_slither';
        }
      } catch {
        // Slither may fail — code pattern match is still valid
      }

      const immunefi = this.checkImmunefiBounty(source.name, candidate.protocolName);

      forks.push({
        hack,
        chain: chain.slug,
        chainId: chain.chainId,
        address: candidate.address,
        name: source.name || candidate.protocolName || 'Unknown',
        tvl: candidate.tvl,
        confidence: verificationMethod === 'code_and_slither' ? 0.95 : 0.75,
        verificationMethod,
        immunefiBounty: immunefi,
      });
    }

    return { forks, examined, patched };
  }

  /**
   * Find candidate contracts that might be forks of a hacked protocol.
   * Uses DeFiLlama protocol names and keyword matching.
   */
  private async findCandidateProtocols(
    hack: KnownHack,
    chainSlug: string,
    minTvl: number,
  ): Promise<Array<{ address: string; protocolName: string; tvl: number }>> {
    const results: Array<{ address: string; protocolName: string; tvl: number }> = [];

    try {
      // Get all protocols on this chain
      const protocols = await this.defillama.getProtocolsByChain(chainSlug, Math.min(minTvl, 100_000));

      for (const protocol of protocols) {
        const nameLower = protocol.name.toLowerCase();
        const slugLower = protocol.slug.toLowerCase();

        // Check if protocol name matches any keyword from the hack
        const nameMatch = hack.vulnerability.nameKeywords.some(kw =>
          nameLower.includes(kw) || slugLower.includes(kw),
        );

        if (!nameMatch) continue;

        const tvl = protocol.chainTvls?.[capitalize(chainSlug)] ?? protocol.tvl ?? 0;
        if (tvl < minTvl) continue;

        // We don't have the contract address from DeFiLlama directly.
        // We'll need to look it up. For now, use newly verified contracts
        // or skip if we can't resolve.
        // DeFiLlama doesn't expose contract addresses, so we use
        // the Etherscan "newly verified" as a supplemental source.
        // For the initial version, we log the match for manual follow-up.
        results.push({
          address: '', // Will be resolved below
          protocolName: protocol.name,
          tvl,
        });
      }
    } catch (err) {
      console.warn(`[ForkHunterV2] Protocol search failed on ${chainSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Strategy 2: Check recently verified contracts on the chain
    try {
      const recent = await this.etherscan.getNewlyVerifiedContracts(
        this.chainDiscovery.getChainConfig(chainSlug)?.chainId ?? 0,
      );

      for (const contract of recent) {
        const nameLower = contract.contractName.toLowerCase();
        const nameMatch = hack.vulnerability.nameKeywords.some(kw =>
          nameLower.includes(kw),
        );
        if (!nameMatch) continue;

        // Check for duplicate (same protocol already found via DeFiLlama)
        const existing = results.find(r => r.protocolName.toLowerCase() === nameLower);
        if (existing && !existing.address) {
          existing.address = contract.address;
        } else if (!existing) {
          results.push({
            address: contract.address,
            protocolName: contract.contractName,
            tvl: 0, // Unknown TVL for newly verified
          });
        }
      }
    } catch {
      // Etherscan API may not support listcontracts on all chains
    }

    // Filter out candidates without addresses
    return results.filter(r => r.address !== '');
  }

  /**
   * Check if a protocol likely has an Immunefi bug bounty.
   */
  private checkImmunefiBounty(contractName: string, protocolName?: string): boolean {
    const check = (name: string) => {
      const lower = name.toLowerCase();
      return Array.from(IMMUNEFI_PROTOCOLS).some(p => lower.includes(p));
    };
    if (check(contractName)) return true;
    if (protocolName && check(protocolName)) return true;
    return false;
  }

  /**
   * Get a summary of all known hacks in the database.
   */
  static getHacksSummary(): Array<{
    id: string;
    name: string;
    type: VulnerabilityType;
    amountLost: number;
    forkScore: number;
    detectors: string[];
  }> {
    return KNOWN_HACKS.map(h => ({
      id: h.id,
      name: h.name,
      type: h.vulnerability.type,
      amountLost: h.amountLost,
      forkScore: VULN_TYPE_FORK_SCORE[h.vulnerability.type] ?? 5,
      detectors: h.vulnerability.detectors,
    }));
  }

  /**
   * Get a specific hack by ID.
   */
  static getHackById(id: string): KnownHack | undefined {
    return KNOWN_HACKS.find(h => h.id === id);
  }
}
