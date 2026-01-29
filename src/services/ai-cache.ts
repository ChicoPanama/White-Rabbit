/**
 * AI Cache Service - Implements prompt-hash caching for AI analysis results.
 *
 * Flow:
 * 1. Normalize prompt input -> compute SHA-256 hash
 * 2. Check Redis cache first (if available)
 * 3. Check Postgres ai_runs table
 * 4. If miss, call AI provider and store result
 */

import crypto from 'crypto';
import { Database } from '../database.js';
import { RedisCache, CacheKeys, getRedisCache } from './redis-cache.js';
import type { AiRun, InsertAiRun } from '../types/index.js';

export interface AiPromptInput {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  // Additional context that affects the output
  findingContext?: {
    chain: string;
    address: string;
    detectorName: string;
    tool: string;
    severity: string;
    codeSnippet?: string;
  };
}

export interface AiCacheResult {
  hit: boolean;
  source: 'redis' | 'postgres' | 'provider';
  promptHash: string;
  result: AiRun | null;
}

export interface AiCacheStats {
  redisHits: number;
  postgresHits: number;
  misses: number;
  errors: number;
}

const AI_CACHE_TTL_DAYS = Number(process.env.WR_AI_CACHE_TTL_DAYS) || 7;
const AI_CACHE_TTL_SECONDS = AI_CACHE_TTL_DAYS * 24 * 60 * 60;

export class AiCacheService {
  private db: Database;
  private redis: RedisCache;
  private stats: AiCacheStats = {
    redisHits: 0,
    postgresHits: 0,
    misses: 0,
    errors: 0,
  };

  constructor(db: Database, redis?: RedisCache) {
    this.db = db;
    this.redis = redis || getRedisCache();
  }

  /**
   * Normalize prompt input for stable hashing.
   * Ensures same semantic input produces same hash.
   */
  normalizePromptInput(input: AiPromptInput): Record<string, unknown> {
    const normalized: Record<string, unknown> = {
      model: input.model,
      systemPrompt: this.normalizeText(input.systemPrompt),
      userPrompt: this.normalizeText(input.userPrompt),
    };

    if (input.findingContext) {
      normalized.findingContext = {
        chain: input.findingContext.chain.toLowerCase(),
        address: input.findingContext.address.toLowerCase(),
        detectorName: input.findingContext.detectorName.toLowerCase(),
        tool: input.findingContext.tool.toLowerCase(),
        severity: input.findingContext.severity.toLowerCase(),
        codeSnippet: input.findingContext.codeSnippet
          ? this.normalizeText(input.findingContext.codeSnippet)
          : undefined,
      };
    }

    return normalized;
  }

  /**
   * Compute SHA-256 hash of normalized prompt input
   */
  computePromptHash(input: AiPromptInput): string {
    const normalized = this.normalizePromptInput(input);
    // Sort keys for stable JSON serialization
    const stableJson = JSON.stringify(normalized, Object.keys(normalized).sort());
    return crypto.createHash('sha256').update(stableJson).digest('hex');
  }

  /**
   * Compute a stable hash for finding context (for linking)
   */
  computeFindingHash(chain: string, address: string, detectorName: string, tool: string): string {
    const input = `${chain}:${address}:${detectorName}:${tool}`.toLowerCase();
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Look up cached AI result by prompt hash.
   * Checks Redis first, then Postgres.
   */
  async lookup(promptHash: string): Promise<AiCacheResult> {
    // 1. Try Redis first
    if (this.redis.isAvailable()) {
      try {
        const cached = await this.redis.getJson<AiRun>(CacheKeys.aiRun(promptHash));
        if (cached) {
          this.stats.redisHits++;
          console.log(`[AiCache] Redis HIT: ${promptHash.slice(0, 12)}...`);
          return { hit: true, source: 'redis', promptHash, result: cached };
        }
      } catch (err) {
        console.warn('[AiCache] Redis lookup error:', err instanceof Error ? err.message : err);
      }
    }

    // 2. Try Postgres
    try {
      const dbResult = await this.db.getAiRunByPromptHash(promptHash);
      if (dbResult) {
        this.stats.postgresHits++;
        console.log(`[AiCache] Postgres HIT: ${promptHash.slice(0, 12)}...`);

        // Backfill Redis cache
        if (this.redis.isAvailable()) {
          await this.redis.setJson(CacheKeys.aiRun(promptHash), dbResult, AI_CACHE_TTL_SECONDS);
        }

        return { hit: true, source: 'postgres', promptHash, result: dbResult };
      }
    } catch (err) {
      console.warn('[AiCache] Postgres lookup error:', err instanceof Error ? err.message : err);
      this.stats.errors++;
    }

    // 3. Cache miss
    this.stats.misses++;
    console.log(`[AiCache] MISS: ${promptHash.slice(0, 12)}...`);
    return { hit: false, source: 'provider', promptHash, result: null };
  }

  /**
   * Store AI result in cache (both Postgres and Redis)
   */
  async store(params: {
    promptHash: string;
    input: AiPromptInput;
    output: Record<string, unknown>;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    status?: 'ok' | 'error';
    errorText?: string;
  }): Promise<AiRun> {
    const { promptHash, input, output, tokensIn, tokensOut, costUsd, status, errorText } = params;

    const insertData: InsertAiRun = {
      promptHash,
      model: input.model,
      inputJson: this.normalizePromptInput(input),
      outputJson: output,
      tokensIn,
      tokensOut,
      costUsd,
      status: status ?? 'ok',
      errorText,
    };

    // Store in Postgres (source of truth)
    const aiRun = await this.db.insertAiRun(insertData);
    console.log(`[AiCache] Stored in Postgres: ${promptHash.slice(0, 12)}... (${input.model})`);

    // Cache in Redis
    if (this.redis.isAvailable()) {
      await this.redis.setJson(CacheKeys.aiRun(promptHash), aiRun, AI_CACHE_TTL_SECONDS);
      console.log(`[AiCache] Cached in Redis: ${promptHash.slice(0, 12)}... (TTL: ${AI_CACHE_TTL_DAYS}d)`);
    }

    // Link to finding if context provided
    if (input.findingContext) {
      const findingHash = this.computeFindingHash(
        input.findingContext.chain,
        input.findingContext.address,
        input.findingContext.detectorName,
        input.findingContext.tool,
      );

      await this.db.linkAiRunToFinding({
        aiRunId: aiRun.id,
        chain: input.findingContext.chain,
        address: input.findingContext.address,
        findingHash,
      });
    }

    return aiRun;
  }

  /**
   * Get cache statistics
   */
  getStats(): AiCacheStats & { hitRate: number } {
    const total = this.stats.redisHits + this.stats.postgresHits + this.stats.misses;
    const hitRate = total > 0
      ? ((this.stats.redisHits + this.stats.postgresHits) / total) * 100
      : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { redisHits: 0, postgresHits: 0, misses: 0, errors: 0 };
  }

  /**
   * Normalize text for stable comparison (trim, collapse whitespace)
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\r\n/g, '\n');
  }
}

// ── Singleton instance ──
let _instance: AiCacheService | null = null;

export function getAiCacheService(db: Database, redis?: RedisCache): AiCacheService {
  if (!_instance) {
    _instance = new AiCacheService(db, redis);
  }
  return _instance;
}
