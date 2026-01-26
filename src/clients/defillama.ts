import type { DeFiLlamaProtocol } from '../types/index.js';

const BASE_URL = 'https://api.llama.fi';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class DeFiLlamaClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly cacheTtlMs: number;

  constructor(cacheTtlMs = 5 * 60 * 1000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async getAllProtocols(): Promise<DeFiLlamaProtocol[]> {
    return this.fetchCached<DeFiLlamaProtocol[]>('/protocols');
  }

  async getProtocolsByChain(chain: string, minTvl: number): Promise<DeFiLlamaProtocol[]> {
    const protocols = await this.getAllProtocols();
    // DeFiLlama uses title-case chain names (e.g., "Ethereum", "Arbitrum")
    const chainKey = capitalizeFirst(chain);

    return protocols
      .filter(p => {
        const inChain = p.chains?.includes(chainKey);
        const chainTvl = p.chainTvls?.[chainKey] ?? 0;
        return inChain && chainTvl >= minTvl;
      })
      .sort((a, b) => {
        const tvlA = a.chainTvls?.[chainKey] ?? 0;
        const tvlB = b.chainTvls?.[chainKey] ?? 0;
        return tvlB - tvlA;
      });
  }

  async getProtocolDetail(slug: string): Promise<{
    name: string;
    chains: string[];
    tvl: number;
    chainTvls: Record<string, number>;
    currentChainTvls: Record<string, number>;
    tokens: unknown[];
  }> {
    return this.fetchCached(`/protocol/${slug}`);
  }

  async getTopProtocols(chain: string, minTvl: number, limit = 50): Promise<DeFiLlamaProtocol[]> {
    const protocols = await this.getProtocolsByChain(chain, minTvl);
    return protocols.slice(0, limit);
  }

  private async fetchCached<T>(path: string): Promise<T> {
    const cached = this.cache.get(path) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const data = await this.fetchWithRetry<T>(`${BASE_URL}${path}`);
    this.cache.set(path, { data, timestamp: Date.now() });
    return data;
  }

  private async fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`DeFiLlama HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          await sleep(backoffMs);
        }
      }
    }

    throw lastError ?? new Error('DeFiLlama request failed');
  }

  clearCache(): void {
    this.cache.clear();
  }
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
