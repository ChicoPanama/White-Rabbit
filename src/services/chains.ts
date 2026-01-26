/**
 * Dynamic chain discovery service.
 * Fetches chain TVL rankings from DeFiLlama and maps them to
 * Etherscan-compatible explorer API endpoints for scanning.
 */

export interface DynamicChainConfig {
  slug: string;
  chainId: number;
  name: string;
  apiUrl: string;
  tvl: number;
  isEvm: boolean;
}

interface DeFiLlamaChainResponse {
  gecko_id: string | null;
  tvl: number;
  tokenSymbol: string;
  cmcId: string | null;
  name: string;
  chainId: number | null;
}

/**
 * Map of chain slugs (lowercase DeFiLlama names) to explorer API endpoints.
 * Covers 20+ EVM chains with block explorer APIs.
 */
const CHAIN_EXPLORERS: Record<string, { chainId: number; apiUrl: string; name: string }> = {
  'ethereum':  { chainId: 1, apiUrl: 'https://api.etherscan.io/v2/api', name: 'Ethereum' },
  'bsc':       { chainId: 56, apiUrl: 'https://api.bscscan.com/api', name: 'BNB Chain' },
  'arbitrum':  { chainId: 42161, apiUrl: 'https://api.arbiscan.io/api', name: 'Arbitrum' },
  'base':      { chainId: 8453, apiUrl: 'https://api.basescan.org/api', name: 'Base' },
  'polygon':   { chainId: 137, apiUrl: 'https://api.polygonscan.com/api', name: 'Polygon' },
  'optimism':  { chainId: 10, apiUrl: 'https://api-optimistic.etherscan.io/api', name: 'Optimism' },
  'avalanche': { chainId: 43114, apiUrl: 'https://api.snowtrace.io/api', name: 'Avalanche' },
  'fantom':    { chainId: 250, apiUrl: 'https://api.ftmscan.com/api', name: 'Fantom' },
  'cronos':    { chainId: 25, apiUrl: 'https://api.cronoscan.com/api', name: 'Cronos' },
  'gnosis':    { chainId: 100, apiUrl: 'https://api.gnosisscan.io/api', name: 'Gnosis' },
  'linea':     { chainId: 59144, apiUrl: 'https://api.lineascan.build/api', name: 'Linea' },
  'scroll':    { chainId: 534352, apiUrl: 'https://api.scrollscan.com/api', name: 'Scroll' },
  'zksync era': { chainId: 324, apiUrl: 'https://api-era.zksync.network/api', name: 'zkSync Era' },
  'mantle':    { chainId: 5000, apiUrl: 'https://api.mantlescan.xyz/api', name: 'Mantle' },
  'blast':     { chainId: 81457, apiUrl: 'https://api.blastscan.io/api', name: 'Blast' },
  'manta':     { chainId: 169, apiUrl: 'https://api.mantascan.io/api', name: 'Manta Pacific' },
  'mode':      { chainId: 34443, apiUrl: 'https://api.modescan.io/api', name: 'Mode' },
  'celo':      { chainId: 42220, apiUrl: 'https://api.celoscan.io/api', name: 'Celo' },
  'moonbeam':  { chainId: 1284, apiUrl: 'https://api-moonbeam.moonscan.io/api', name: 'Moonbeam' },
  'moonriver': { chainId: 1285, apiUrl: 'https://api-moonriver.moonscan.io/api', name: 'Moonriver' },
};

/**
 * Non-EVM chains that show up in DeFiLlama but can't be scanned with Etherscan/Slither.
 */
const NON_EVM_CHAINS = new Set([
  'solana', 'bitcoin', 'sui', 'aptos', 'cardano', 'tron',
  'ton', 'near', 'cosmos', 'polkadot', 'stacks', 'algorand',
  'stellar', 'icp', 'hedera', 'tezos', 'flow', 'waves',
  'elrond', 'osmosis', 'injective', 'sei',
]);

const DEFILLAMA_CHAINS_URL = 'https://api.llama.fi/v2/chains';

/**
 * Hardcoded fallback: top 10 EVM chains by typical TVL ordering.
 */
const FALLBACK_TOP_CHAINS: DynamicChainConfig[] = [
  { slug: 'ethereum', chainId: 1, name: 'Ethereum', apiUrl: 'https://api.etherscan.io/v2/api', tvl: 50_000_000_000, isEvm: true },
  { slug: 'bsc', chainId: 56, name: 'BNB Chain', apiUrl: 'https://api.bscscan.com/api', tvl: 5_000_000_000, isEvm: true },
  { slug: 'arbitrum', chainId: 42161, name: 'Arbitrum', apiUrl: 'https://api.arbiscan.io/api', tvl: 3_000_000_000, isEvm: true },
  { slug: 'base', chainId: 8453, name: 'Base', apiUrl: 'https://api.basescan.org/api', tvl: 2_500_000_000, isEvm: true },
  { slug: 'polygon', chainId: 137, name: 'Polygon', apiUrl: 'https://api.polygonscan.com/api', tvl: 1_200_000_000, isEvm: true },
  { slug: 'optimism', chainId: 10, name: 'Optimism', apiUrl: 'https://api-optimistic.etherscan.io/api', tvl: 900_000_000, isEvm: true },
  { slug: 'avalanche', chainId: 43114, name: 'Avalanche', apiUrl: 'https://api.snowtrace.io/api', tvl: 800_000_000, isEvm: true },
  { slug: 'blast', chainId: 81457, name: 'Blast', apiUrl: 'https://api.blastscan.io/api', tvl: 400_000_000, isEvm: true },
  { slug: 'linea', chainId: 59144, name: 'Linea', apiUrl: 'https://api.lineascan.build/api', tvl: 350_000_000, isEvm: true },
  { slug: 'scroll', chainId: 534352, name: 'Scroll', apiUrl: 'https://api.scrollscan.com/api', tvl: 300_000_000, isEvm: true },
];

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class ChainDiscoveryService {
  private cache: { chains: DynamicChainConfig[]; timestamp: number } | null = null;
  private allChains: DeFiLlamaChainResponse[] = [];

  /**
   * Get top N chains by TVL that we can actually scan (have explorer API).
   */
  async getTopChainsByTvl(n = 10): Promise<DynamicChainConfig[]> {
    const all = await this.getRankedChains();
    return all.filter(c => c.isEvm).slice(0, n);
  }

  /**
   * Get ALL chains ranked by TVL, including non-scannable ones.
   * Non-EVM chains have isEvm=false.
   */
  async getAllChainsByTvl(n = 20): Promise<Array<{ name: string; slug: string; tvl: number; isEvm: boolean; scannable: boolean }>> {
    await this.refreshRankings();
    return this.allChains
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, n)
      .map(c => {
        const slug = c.name.toLowerCase();
        const isEvm = !NON_EVM_CHAINS.has(slug);
        const scannable = isEvm && slug in CHAIN_EXPLORERS;
        return {
          name: c.name,
          slug,
          tvl: c.tvl,
          isEvm,
          scannable,
        };
      });
  }

  /**
   * Get chain config by name or slug.
   */
  getChainConfig(nameOrSlug: string): DynamicChainConfig | undefined {
    const key = nameOrSlug.toLowerCase();
    const explorer = CHAIN_EXPLORERS[key];
    if (!explorer) return undefined;

    // Check cache for live TVL
    const cached = this.cache?.chains.find(c => c.slug === key);
    return {
      slug: key,
      chainId: explorer.chainId,
      name: explorer.name,
      apiUrl: explorer.apiUrl,
      tvl: cached?.tvl ?? 0,
      isEvm: true,
    };
  }

  /**
   * Check if we support scanning a chain.
   */
  canScanChain(nameOrSlug: string): boolean {
    return nameOrSlug.toLowerCase() in CHAIN_EXPLORERS;
  }

  /**
   * Get all supported chains (those with explorer APIs).
   */
  getSupportedChains(): DynamicChainConfig[] {
    return Object.entries(CHAIN_EXPLORERS).map(([slug, config]) => ({
      slug,
      chainId: config.chainId,
      name: config.name,
      apiUrl: config.apiUrl,
      tvl: 0,
      isEvm: true,
    }));
  }

  /**
   * Force refresh TVL rankings from DeFiLlama.
   */
  async refreshRankings(): Promise<void> {
    try {
      const response = await fetch(DEFILLAMA_CHAINS_URL);
      if (!response.ok) {
        throw new Error(`DeFiLlama HTTP ${response.status}`);
      }
      this.allChains = await response.json() as DeFiLlamaChainResponse[];
      const ranked = this.buildRankedChains(this.allChains);
      this.cache = { chains: ranked, timestamp: Date.now() };
    } catch (err) {
      console.error(`[ChainDiscovery] Failed to refresh rankings: ${err instanceof Error ? err.message : String(err)}`);
      // Keep existing cache if available
    }
  }

  /**
   * Get ranked chains, using cache when fresh.
   */
  private async getRankedChains(): Promise<DynamicChainConfig[]> {
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_TTL_MS) {
      return this.cache.chains;
    }

    try {
      await this.refreshRankings();
    } catch {
      // Refresh failed
    }

    if (this.cache) {
      return this.cache.chains;
    }

    // Fallback to hardcoded list
    console.warn('[ChainDiscovery] Using fallback chain rankings');
    return FALLBACK_TOP_CHAINS;
  }

  /**
   * Build ranked list from DeFiLlama chain data.
   */
  private buildRankedChains(llamaChains: DeFiLlamaChainResponse[]): DynamicChainConfig[] {
    const result: DynamicChainConfig[] = [];

    for (const chain of llamaChains) {
      const slug = chain.name.toLowerCase();
      const explorer = CHAIN_EXPLORERS[slug];

      if (explorer && !NON_EVM_CHAINS.has(slug)) {
        result.push({
          slug,
          chainId: explorer.chainId,
          name: explorer.name,
          apiUrl: explorer.apiUrl,
          tvl: chain.tvl ?? 0,
          isEvm: true,
        });
      }
    }

    // Sort by TVL descending
    result.sort((a, b) => b.tvl - a.tvl);
    return result;
  }

  /**
   * Format chain list for display. Shows TVL, scannable status.
   */
  formatChainRankings(chains: Array<{ name: string; slug: string; tvl: number; isEvm: boolean; scannable: boolean }>, limit = 10): string {
    const medal = (i: number) => {
      if (i === 0) return '\u{1F947}';
      if (i === 1) return '\u{1F948}';
      if (i === 2) return '\u{1F949}';
      return `${i + 1}.`;
    };

    const lines = [
      `Top ${Math.min(limit, chains.length)} Chains by TVL (DeFiLlama)`,
      '',
    ];

    for (let i = 0; i < Math.min(limit, chains.length); i++) {
      const c = chains[i];
      const tvlStr = formatTvl(c.tvl);
      const status = c.scannable ? '\u2705' : (c.isEvm ? '\u26A0\uFE0F' : '\u274C');
      const note = !c.isEvm ? ' (not EVM)' : (!c.scannable ? ' (no API)' : '');
      lines.push(`${medal(i).padStart(4)} ${c.name} - ${tvlStr} ${status}${note}`);
    }

    lines.push('');
    lines.push('\u2705 = Scannable  \u26A0\uFE0F = EVM but no API  \u274C = Not supported');

    return lines.join('\n');
  }

  /**
   * Format for Telegram (HTML).
   */
  formatChainRankingsTelegram(chains: Array<{ name: string; slug: string; tvl: number; isEvm: boolean; scannable: boolean }>, limit = 10): string {
    const medal = (i: number) => {
      if (i === 0) return '\u{1F947}';
      if (i === 1) return '\u{1F948}';
      if (i === 2) return '\u{1F949}';
      return `${i + 1}.`;
    };

    const lines = [
      `\u{1F4CA} <b>Top ${Math.min(limit, chains.length)} Chains by TVL</b> (DeFiLlama)`,
      '',
    ];

    for (let i = 0; i < Math.min(limit, chains.length); i++) {
      const c = chains[i];
      const tvlStr = formatTvl(c.tvl);
      const status = c.scannable ? '\u2705' : (c.isEvm ? '\u26A0\uFE0F' : '\u274C');
      const note = !c.isEvm ? ' <i>(not EVM)</i>' : (!c.scannable ? ' <i>(no API)</i>' : '');
      lines.push(`${medal(i)} <b>${escapeHtml(c.name)}</b> - ${tvlStr} ${status}${note}`);
    }

    const scannable = chains.filter(c => c.scannable).length;
    lines.push('');
    lines.push(`\u2705 = Scannable (${scannable} chains)  \u274C = Not supported`);
    lines.push('');
    lines.push('<i>Reply "scan top10" to hunt all supported chains</i>');

    return lines.join('\n');
  }
}

function formatTvl(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
