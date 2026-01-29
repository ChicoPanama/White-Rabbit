/**
 * Redis Cache Wrapper - Optional hot cache for AI results and memory bundles.
 * Falls back gracefully to Postgres-only if Redis is unavailable.
 */

import Redis from 'ioredis';

export interface RedisCacheConfig {
  url?: string;
  defaultTtlSeconds?: number;
  keyPrefix?: string;
}

export class RedisCache {
  private client: Redis | null = null;
  private connected: boolean = false;
  private config: Required<RedisCacheConfig>;

  constructor(config: RedisCacheConfig = {}) {
    this.config = {
      url: config.url || process.env.REDIS_URL || '',
      defaultTtlSeconds: config.defaultTtlSeconds || 7 * 24 * 60 * 60, // 7 days
      keyPrefix: config.keyPrefix || 'wr:cache:',
    };
  }

  /**
   * Connect to Redis. Returns false if Redis is unavailable.
   */
  async connect(): Promise<boolean> {
    if (!this.config.url) {
      console.log('[RedisCache] No REDIS_URL configured, operating in Postgres-only mode');
      return false;
    }

    try {
      this.client = new Redis(this.config.url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null; // Stop retrying
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      await this.client.connect();
      this.connected = true;
      console.log('[RedisCache] Connected to Redis');
      return true;
    } catch (err) {
      console.warn('[RedisCache] Failed to connect to Redis, falling back to Postgres-only:',
        err instanceof Error ? err.message : err);
      this.client = null;
      this.connected = false;
      return false;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Get JSON value from cache
   */
  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const fullKey = this.config.keyPrefix + key;
      const value = await this.client!.get(fullKey);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (err) {
      console.warn('[RedisCache] Get error:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Set JSON value in cache with TTL
   */
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const fullKey = this.config.keyPrefix + key;
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;

      await this.client!.setex(fullKey, ttl, serialized);
      return true;
    } catch (err) {
      console.warn('[RedisCache] Set error:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const fullKey = this.config.keyPrefix + key;
      await this.client!.del(fullKey);
      return true;
    } catch (err) {
      console.warn('[RedisCache] Delete error:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const fullKey = this.config.keyPrefix + key;
      const result = await this.client!.exists(fullKey);
      return result === 1;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ connected: boolean; keys?: number; memory?: string }> {
    if (!this.isAvailable()) {
      return { connected: false };
    }

    try {
      const info = await this.client!.info('memory');
      const dbSize = await this.client!.dbsize();
      const memMatch = info.match(/used_memory_human:(\S+)/);

      return {
        connected: true,
        keys: dbSize,
        memory: memMatch ? memMatch[1] : undefined,
      };
    } catch (err) {
      return { connected: false };
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }
}

// ── Cache Key Builders ──

export const CacheKeys = {
  /** AI run result by prompt hash */
  aiRun: (promptHash: string) => `ai:run:${promptHash}`,

  /** Memory bundle for a contract (with all options) */
  memoryBundle: (
    chain: string,
    address: string,
    scans: number,
    findings: number,
    includeSummaries = false,
    includeSimilar = false
  ) =>
    `memory:${chain}:${address.toLowerCase()}:s${scans}:f${findings}:sum${includeSummaries ? 1 : 0}:sim${includeSimilar ? 1 : 0}`,

  /** Contract metadata */
  contract: (chain: string, address: string) =>
    `contract:${chain}:${address.toLowerCase()}`,
};

// ── Singleton instance ──
let _instance: RedisCache | null = null;

export function getRedisCache(): RedisCache {
  if (!_instance) {
    _instance = new RedisCache();
  }
  return _instance;
}

export async function initRedisCache(): Promise<RedisCache> {
  const cache = getRedisCache();
  await cache.connect();
  return cache;
}
