// ═══════════════════════════════════════════════════════════════════════════════
// DeFi Llama Connector - TVL and protocol data
// ═══════════════════════════════════════════════════════════════════════════════

import { ScannerError } from '../types.js';

const DEFILLAMA_API_BASE = 'https://api.llama.fi';
const DEFILLAMA_COINS_API = 'https://coins.llama.fi';

export interface ProtocolData {
  id: string;
  name: string;
  slug: string;
  description: string;
  url: string;
  logo: string;
  chains: string[];
  tvl: number;
  chainTvls: Record<string, number>;
  category: string;
  twitter: string | null;
  audit_links: string[];
  forkedFrom: string[];
  oracles: string[];
  listedAt: number;
  mcaps?: Record<string, number>;
}

export interface ChainTvlData {
  date: number;
  tvl: number;
}

export interface TokenPrice {
  price: number;
  timestamp: number;
  confidence: number;
}

export interface CoinPriceData {
  decimals: number;
  symbol: string;
  price: number;
  timestamp: number;
  confidence: number;
}

/**
 * DeFi Llama API connector for TVL and protocol data
 */
export class DeFiLlamaConnector {
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  private defaultCacheTtl = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all protocols with TVL data
   */
  async getProtocols(): Promise<ProtocolData[]> {
    const cacheKey = 'protocols';
    const cached = this.getCached<ProtocolData[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${DEFILLAMA_API_BASE}/protocols`);
    if (!response.ok) {
      throw new ScannerError(
        `Failed to fetch protocols: ${response.status}`,
        'DEFILLAMA_API_ERROR'
      );
    }

    const data = await response.json() as ProtocolData[];
    this.setCached(cacheKey, data);
    return data;
  }

  /**
   * Get specific protocol data
   */
  async getProtocol(slug: string): Promise<ProtocolData> {
    const cacheKey = `protocol:${slug}`;
    const cached = this.getCached<ProtocolData>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${DEFILLAMA_API_BASE}/protocol/${slug}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new ScannerError(
          `Protocol '${slug}' not found on DeFi Llama`,
          'PROTOCOL_NOT_FOUND'
        );
      }
      throw new ScannerError(
        `Failed to fetch protocol: ${response.status}`,
        'DEFILLAMA_API_ERROR'
      );
    }

    const data = await response.json() as ProtocolData;
    this.setCached(cacheKey, data);
    return data;
  }

  /**
   * Get TVL for a specific chain
   */
  async getChainTvl(chain: string): Promise<number> {
    const cacheKey = `chain-tvl:${chain}`;
    const cached = this.getCached<number>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${DEFILLAMA_API_BASE}/tvl/${chain}`);
    if (!response.ok) {
      throw new ScannerError(
        `Failed to fetch chain TVL: ${response.status}`,
        'DEFILLAMA_API_ERROR'
      );
    }

    const data = await response.json() as number;
    this.setCached(cacheKey, data);
    return data;
  }

  /**
   * Get historical TVL data for a protocol
   */
  async getProtocolTvlHistory(slug: string): Promise<ChainTvlData[]> {
    const cacheKey = `protocol-tvl-history:${slug}`;
    const cached = this.getCached<ChainTvlData[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${DEFILLAMA_API_BASE}/protocol/${slug}`);
    if (!response.ok) {
      throw new ScannerError(
        `Failed to fetch TVL history: ${response.status}`,
        'DEFILLAMA_API_ERROR'
      );
    }

    const data = await response.json() as { chainTvls: Record<string, ChainTvlData[]> };
    // Return TVL data for the main chain or combined
    const mainChain = Object.keys(data.chainTvls || {})[0];
    const tvlData = mainChain ? data.chainTvls[mainChain] : [];
    this.setCached(cacheKey, tvlData);
    return tvlData;
  }

  /**
   * Get current token price
   */
  async getTokenPrice(
    chain: string,
    address: string
  ): Promise<TokenPrice> {
    const cacheKey = `price:${chain}:${address}`;
    const cached = this.getCached<TokenPrice>(cacheKey);
    if (cached) return cached;

    const coinId = `${chain}:${address}`;
    const response = await fetch(
      `${DEFILLAMA_COINS_API}/prices/current/${coinId}`
    );
    
    if (!response.ok) {
      throw new ScannerError(
        `Failed to fetch token price: ${response.status}`,
        'DEFILLAMA_API_ERROR'
      );
    }

    const data = await response.json() as { coins: Record<string, CoinPriceData> };
    const coin = data.coins?.[coinId];
    
    if (!coin) {
      throw new ScannerError(
        `Price not found for ${coinId}`,
        'PRICE_NOT_FOUND'
      );
    }

    const result = {
      price: coin.price,
      timestamp: coin.timestamp,
      confidence: coin.confidence,
    };
    
    this.setCached(cacheKey, result, 60000); // 1 minute cache for prices
    return result;
  }

  /**
   * Get multiple token prices at once
   */
  async getTokenPrices(
    tokens: Array<{ chain: string; address: string }>
  ): Promise<Map<string, TokenPrice>> {
    if (tokens.length === 0) return new Map();

    const coinIds = tokens.map(t => `${t.chain}:${t.address}`).join(',');
    const response = await fetch(
      `${DEFILLAMA_COINS_API}/prices/current/${coinIds}`
    );
    
    if (!response.ok) {
      throw new ScannerError(
        `Failed to fetch token prices: ${response.status}`,
        'DEFILLAMA_API_ERROR'
      );
    }

    const data = await response.json() as { coins: Record<string, CoinPriceData> };
    const results = new Map<string, TokenPrice>();

    for (const token of tokens) {
      const coinId = `${token.chain}:${token.address}`;
      const coin = data.coins?.[coinId];
      
      if (coin) {
        results.set(coinId, {
          price: coin.price,
          timestamp: coin.timestamp,
          confidence: coin.confidence,
        });
      }
    }

    return results;
  }

  /**
   * Search for a protocol by name
   */
  async searchProtocol(name: string): Promise<ProtocolData | null> {
    const protocols = await this.getProtocols();
    const searchTerm = name.toLowerCase();

    // Exact match first
    const exact = protocols.find(
      p => p.name.toLowerCase() === searchTerm || p.slug === searchTerm
    );
    if (exact) return exact;

    // Partial match
    const partial = protocols.find(
      p => p.name.toLowerCase().includes(searchTerm) ||
           p.slug.includes(searchTerm)
    );
    
    return partial || null;
  }

  /**
   * Get protocols sorted by TVL
   */
  async getTopProtocols(limit: number = 100): Promise<ProtocolData[]> {
    const protocols = await this.getProtocols();
    return protocols
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, limit);
  }

  /**
   * Get protocols on a specific chain
   */
  async getProtocolsOnChain(chain: string): Promise<ProtocolData[]> {
    const protocols = await this.getProtocols();
    const chainLower = chain.toLowerCase();
    
    return protocols.filter(p => 
      p.chains.some(c => c.toLowerCase() === chainLower)
    );
  }

  /**
   * Get protocols by category
   */
  async getProtocolsByCategory(category: string): Promise<ProtocolData[]> {
    const protocols = await this.getProtocols();
    const catLower = category.toLowerCase();
    
    return protocols.filter(p => 
      p.category?.toLowerCase() === catLower
    );
  }

  /**
   * Get total TVL across all chains
   */
  async getTotalTvl(): Promise<number> {
    const cacheKey = 'total-tvl';
    const cached = this.getCached<number>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${DEFILLAMA_API_BASE}/tvl`);
    if (!response.ok) {
      throw new ScannerError(
        `Failed to fetch total TVL: ${response.status}`,
        'DEFILLAMA_API_ERROR'
      );
    }

    const data = await response.json() as number;
    this.setCached(cacheKey, data);
    return data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════════════════════════

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  private setCached(key: string, data: unknown, ttl?: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl || this.defaultCacheTtl),
    });
  }
}

export default DeFiLlamaConnector;
