/**
 * Redis-backed AI job queue for global rate limiting across multiple workers.
 *
 * Instead of calling Anthropic directly, scanner processes enqueue jobs here.
 * A dedicated AI worker pulls jobs and processes them with global rate limiting.
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// ── Redis Keys ──
export const AI_QUEUE_KEY = 'wr:ai:queue';
export const AI_PROCESSING_KEY = 'wr:ai:processing';
export const AI_TOKENS_KEY = 'wr:ai:tokens';
export const AI_WINDOW_KEY = 'wr:ai:window';
export const AI_LAST_CALL_KEY = 'wr:ai:last_call';
export const AI_CONSECUTIVE_429_KEY = 'wr:ai:consecutive_429';
export const AI_COOLDOWN_UNTIL_KEY = 'wr:ai:cooldown_until';
export const AI_STATS_KEY = 'wr:ai:stats';

// ── Job Types ──
export interface AIJobData {
  id: string;
  createdAt: number;
  chain: string;
  chainId: number;
  address: string;
  symbol?: string;
  name?: string;
  sourceCode: string;
  findings: AIJobFinding[];
  tier: 'haiku' | 'sonnet';
  priority: number; // Lower = higher priority
  attempts: number;
  lastError?: string;
  protocolName?: string;
}

export interface AIJobFinding {
  id: string;
  detectorName: string;
  severity: string;
  confidence: string;
  description: string;
  filePath?: string | null;
  lineStart?: number | null;
  lineEnd?: number | null;
  codeSnippet?: string | null;
  tool: string;
}

export interface AIJobResult {
  jobId: string;
  success: boolean;
  results?: Array<{
    findingId: string;
    isFalsePositive: boolean;
    assessment: string;
    attackPath?: string | null;
    recommendedFix?: string | null;
    adjustedSeverity?: string | null;
  }>;
  error?: string;
  attempts: number;
  processedAt: number;
}

// ── Rate Limit Config ──
export interface AIRateLimitConfig {
  rpm: number;              // Requests per minute
  minDelayMs: number;       // Minimum delay between calls
  maxAttempts: number;      // Max retry attempts
  cooldownMs: number;       // Cooldown after consecutive 429s
  consecutive429Threshold: number; // Number of 429s before cooldown
}

export const DEFAULT_RATE_LIMIT_CONFIG: AIRateLimitConfig = {
  rpm: 2,
  minDelayMs: 12000,
  maxAttempts: 5,
  cooldownMs: 120000,
  consecutive429Threshold: 3,
};

/**
 * AI Queue Manager - handles enqueuing and dequeuing AI analysis jobs
 */
export class AIQueueManager {
  private redis: Redis;
  private config: AIRateLimitConfig;

  constructor(redisUrl: string, config: Partial<AIRateLimitConfig> = {}) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * Enqueue an AI analysis job
   */
  async enqueue(job: Omit<AIJobData, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
    const fullJob: AIJobData = {
      ...job,
      id: uuidv4(),
      createdAt: Date.now(),
      attempts: 0,
      priority: job.priority ?? (job.tier === 'sonnet' ? 0 : 1), // Sonnet jobs get higher priority
    };

    const serialized = JSON.stringify(fullJob);

    // Use ZADD for priority queue (lower score = higher priority)
    // Score combines priority and timestamp for FIFO within same priority
    const score = fullJob.priority * 1e13 + fullJob.createdAt;
    await this.redis.zadd(AI_QUEUE_KEY, score, serialized);

    await this.incrementStat('enqueued');
    console.log(`[AIQueue] Enqueued job ${fullJob.id} for ${job.address} (${job.tier}, priority=${fullJob.priority})`);

    return fullJob.id;
  }

  /**
   * Dequeue the next job (blocking with timeout)
   */
  async dequeue(timeoutSec: number = 5): Promise<AIJobData | null> {
    // Check if we're in cooldown
    const cooldownUntil = await this.redis.get(AI_COOLDOWN_UNTIL_KEY);
    if (cooldownUntil && Date.now() < Number(cooldownUntil)) {
      const remaining = Math.ceil((Number(cooldownUntil) - Date.now()) / 1000);
      console.log(`[AIQueue] In cooldown, ${remaining}s remaining`);
      return null;
    }

    // Get highest priority job (lowest score)
    const result = await this.redis.zpopmin(AI_QUEUE_KEY);
    if (!result || result.length === 0) {
      return null;
    }

    const [serialized] = result;
    try {
      const job = JSON.parse(serialized) as AIJobData;

      // Move to processing set (for crash recovery)
      await this.redis.hset(AI_PROCESSING_KEY, job.id, serialized);

      return job;
    } catch (err) {
      console.error('[AIQueue] Failed to parse job:', err);
      await this.incrementStat('parse_errors');
      return null;
    }
  }

  /**
   * Mark job as completed and remove from processing
   */
  async complete(jobId: string, result: Omit<AIJobResult, 'jobId' | 'processedAt'>): Promise<void> {
    await this.redis.hdel(AI_PROCESSING_KEY, jobId);
    await this.incrementStat('completed');

    // Reset consecutive 429 counter on success
    if (result.success) {
      await this.redis.set(AI_CONSECUTIVE_429_KEY, '0');
    }

    console.log(`[AIQueue] Completed job ${jobId} (success=${result.success})`);
  }

  /**
   * Re-enqueue a failed job with incremented attempts
   */
  async requeue(job: AIJobData, error: string): Promise<boolean> {
    await this.redis.hdel(AI_PROCESSING_KEY, job.id);

    if (job.attempts >= this.config.maxAttempts) {
      console.log(`[AIQueue] Job ${job.id} exceeded max attempts (${this.config.maxAttempts}), dropping`);
      await this.incrementStat('dropped');
      return false;
    }

    const updatedJob: AIJobData = {
      ...job,
      attempts: job.attempts + 1,
      lastError: error,
    };

    // Exponential backoff: delay requeue by increasing the score
    const backoffMs = Math.min(1000 * Math.pow(2, updatedJob.attempts), 60000);
    const score = updatedJob.priority * 1e13 + Date.now() + backoffMs;

    await this.redis.zadd(AI_QUEUE_KEY, score, JSON.stringify(updatedJob));
    await this.incrementStat('requeued');

    console.log(`[AIQueue] Requeued job ${job.id} (attempt ${updatedJob.attempts}/${this.config.maxAttempts}, backoff=${backoffMs}ms)`);
    return true;
  }

  /**
   * Check if we can make an API call (rate limiting)
   */
  async canMakeCall(): Promise<{ allowed: boolean; waitMs?: number; reason?: string }> {
    // Check cooldown first
    const cooldownUntil = await this.redis.get(AI_COOLDOWN_UNTIL_KEY);
    if (cooldownUntil && Date.now() < Number(cooldownUntil)) {
      const waitMs = Number(cooldownUntil) - Date.now();
      return { allowed: false, waitMs, reason: 'In cooldown after consecutive 429s' };
    }

    // Check minimum delay since last call
    const lastCall = await this.redis.get(AI_LAST_CALL_KEY);
    if (lastCall) {
      const elapsed = Date.now() - Number(lastCall);
      if (elapsed < this.config.minDelayMs) {
        const waitMs = this.config.minDelayMs - elapsed;
        return { allowed: false, waitMs, reason: `Min delay not met (${waitMs}ms remaining)` };
      }
    }

    // Check RPM limit using sliding window
    const windowKey = Math.floor(Date.now() / 60000); // Current minute
    const storedWindow = await this.redis.get(AI_WINDOW_KEY);
    const tokens = await this.redis.get(AI_TOKENS_KEY);

    if (storedWindow && Number(storedWindow) === windowKey) {
      // Same minute - check tokens
      const remaining = Number(tokens) || 0;
      if (remaining <= 0) {
        const waitMs = 60000 - (Date.now() % 60000); // Wait until next minute
        return { allowed: false, waitMs, reason: `RPM limit reached (${this.config.rpm}/min)` };
      }
    }

    return { allowed: true };
  }

  /**
   * Record that an API call was made
   */
  async recordCall(): Promise<void> {
    await this.redis.set(AI_LAST_CALL_KEY, Date.now().toString());

    const windowKey = Math.floor(Date.now() / 60000);
    const storedWindow = await this.redis.get(AI_WINDOW_KEY);

    if (!storedWindow || Number(storedWindow) !== windowKey) {
      // New minute - reset tokens
      await this.redis.set(AI_WINDOW_KEY, windowKey.toString());
      await this.redis.set(AI_TOKENS_KEY, (this.config.rpm - 1).toString());
    } else {
      // Same minute - decrement tokens
      await this.redis.decr(AI_TOKENS_KEY);
    }
  }

  /**
   * Handle a 429 rate limit error
   */
  async handle429(retryAfterMs?: number): Promise<void> {
    const consecutive = await this.redis.incr(AI_CONSECUTIVE_429_KEY);
    await this.incrementStat('rate_limited');

    console.log(`[AIQueue] Received 429 (consecutive: ${consecutive}/${this.config.consecutive429Threshold})`);

    if (consecutive >= this.config.consecutive429Threshold) {
      // Enter cooldown
      const cooldownUntil = Date.now() + (retryAfterMs || this.config.cooldownMs);
      await this.redis.set(AI_COOLDOWN_UNTIL_KEY, cooldownUntil.toString());
      console.log(`[AIQueue] Entering cooldown for ${(retryAfterMs || this.config.cooldownMs) / 1000}s`);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    queueDepth: number;
    processing: number;
    enqueued: number;
    completed: number;
    requeued: number;
    dropped: number;
    rateLimit: number;
    parseErrors: number;
    inCooldown: boolean;
    cooldownRemaining?: number;
  }> {
    const [queueDepth, processing, stats, cooldownUntil] = await Promise.all([
      this.redis.zcard(AI_QUEUE_KEY),
      this.redis.hlen(AI_PROCESSING_KEY),
      this.redis.hgetall(AI_STATS_KEY),
      this.redis.get(AI_COOLDOWN_UNTIL_KEY),
    ]);

    const inCooldown = cooldownUntil ? Date.now() < Number(cooldownUntil) : false;
    const cooldownRemaining = inCooldown ? Number(cooldownUntil) - Date.now() : undefined;

    return {
      queueDepth,
      processing,
      enqueued: Number(stats?.enqueued) || 0,
      completed: Number(stats?.completed) || 0,
      requeued: Number(stats?.requeued) || 0,
      dropped: Number(stats?.dropped) || 0,
      rateLimit: Number(stats?.rate_limited) || 0,
      parseErrors: Number(stats?.parse_errors) || 0,
      inCooldown,
      cooldownRemaining,
    };
  }

  /**
   * Log queue status (for observability)
   */
  async logStatus(): Promise<void> {
    const stats = await this.getStats();
    console.log(`[AIQueue] Status: depth=${stats.queueDepth}, processing=${stats.processing}, completed=${stats.completed}, requeued=${stats.requeued}, dropped=${stats.dropped}${stats.inCooldown ? `, COOLDOWN ${Math.ceil(stats.cooldownRemaining! / 1000)}s` : ''}`);
  }

  private async incrementStat(field: string): Promise<void> {
    await this.redis.hincrby(AI_STATS_KEY, field, 1);
  }

  /**
   * Recover any jobs stuck in processing (crash recovery)
   */
  async recoverStuckJobs(): Promise<number> {
    const processing = await this.redis.hgetall(AI_PROCESSING_KEY);
    let recovered = 0;

    for (const [jobId, serialized] of Object.entries(processing)) {
      try {
        const job = JSON.parse(serialized) as AIJobData;
        // If job has been processing for > 5 minutes, assume it's stuck
        const stuckThreshold = 5 * 60 * 1000;
        if (Date.now() - job.createdAt > stuckThreshold) {
          await this.requeue(job, 'Recovered from stuck state');
          recovered++;
        }
      } catch (err) {
        // Remove invalid job
        await this.redis.hdel(AI_PROCESSING_KEY, jobId);
      }
    }

    if (recovered > 0) {
      console.log(`[AIQueue] Recovered ${recovered} stuck jobs`);
    }

    return recovered;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * Parse Redis URL for connection options
 */
export function parseRedisUrl(url: string): { host: string; port: number; password?: string; username?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
  };
}
