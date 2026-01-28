/**
 * Dedicated AI Worker - processes AI analysis jobs from Redis queue.
 *
 * This worker:
 * - Pulls jobs from wr:ai:queue one at a time
 * - Enforces global rate limiting via Redis
 * - Handles 429 errors with exponential backoff
 * - Implements circuit breaker for consecutive failures
 *
 * Run with: node dist/ai-worker.js
 * Or set WR_MODE=ai_worker when running the main process
 */

import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.js';
import {
  AIQueueManager,
  AIJobData,
  AIRateLimitConfig,
} from './queue/ai-queue.js';
import { CostTracker } from './services/cost-tracker.js';

// ── Types ──
interface AIWorkerConfig {
  redisUrl: string;
  anthropicApiKey: string | null;
  rateLimit: AIRateLimitConfig;
  modelHaiku: string;
  modelSonnet: string;
}

interface ProcessResult {
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
  retryable: boolean;
}

// ── System Prompt (same as ai-analyzer.ts) ──
const SYSTEM_PROMPT = `You are a senior smart contract security auditor specializing in DeFi protocols.
You review static analysis findings and assess whether they represent real vulnerabilities or false positives.
You focus on practical exploitability, not theoretical risks.

For each finding you MUST respond with valid JSON matching this schema:
{
  "isFalsePositive": boolean,
  "assessment": "string - 2-3 sentence explanation",
  "attackPath": "string or null - step-by-step exploit if real vulnerability",
  "recommendedFix": "string or null - specific code fix suggestion",
  "adjustedSeverity": "critical | high | medium | low | informational | null"
}`;

/**
 * AI Worker - processes AI jobs from queue with rate limiting
 */
class AIWorker {
  private queue: AIQueueManager;
  private client: Anthropic | null;
  private costTracker: CostTracker;
  private config: AIWorkerConfig;
  private running: boolean = false;
  private statusInterval: NodeJS.Timeout | null = null;

  constructor(config: AIWorkerConfig) {
    this.config = config;
    this.queue = new AIQueueManager(config.redisUrl, config.rateLimit);
    this.client = config.anthropicApiKey
      ? new Anthropic({ apiKey: config.anthropicApiKey })
      : null;
    this.costTracker = new CostTracker(
      config.rateLimit.rpm * 60, // Hourly limit based on RPM
      10.0 // Daily spend limit
    );

    if (!this.client) {
      console.warn('[AIWorker] No ANTHROPIC_API_KEY configured - will mark jobs as no_ai');
    }
  }

  /**
   * Start the worker loop
   */
  async start(): Promise<void> {
    console.log('[AIWorker] Starting AI worker...');
    console.log(`[AIWorker] Rate limits: ${this.config.rateLimit.rpm} RPM, ${this.config.rateLimit.minDelayMs}ms min delay`);
    console.log(`[AIWorker] Max attempts: ${this.config.rateLimit.maxAttempts}, Cooldown: ${this.config.rateLimit.cooldownMs}ms`);

    this.running = true;

    // Recover any stuck jobs from previous crashes
    await this.queue.recoverStuckJobs();

    // Log status every 30 seconds
    this.statusInterval = setInterval(() => {
      this.queue.logStatus();
    }, 30000);

    // Main processing loop
    while (this.running) {
      try {
        await this.processNextJob();
      } catch (err) {
        console.error('[AIWorker] Unexpected error in main loop:', err);
        await this.sleep(5000); // Back off on unexpected errors
      }
    }

    console.log('[AIWorker] Worker stopped');
  }

  /**
   * Process the next job from the queue
   */
  private async processNextJob(): Promise<void> {
    // Check rate limits before dequeuing
    const canCall = await this.queue.canMakeCall();
    if (!canCall.allowed) {
      const waitMs = canCall.waitMs || 1000;
      if (waitMs > 5000) {
        console.log(`[AIWorker] Rate limited: ${canCall.reason}, waiting ${Math.ceil(waitMs / 1000)}s`);
      }
      await this.sleep(Math.min(waitMs, 10000));
      return;
    }

    // Dequeue next job
    const job = await this.queue.dequeue(5);
    if (!job) {
      // No jobs available, wait a bit
      await this.sleep(1000);
      return;
    }

    console.log(`[AIWorker] Processing job ${job.id} (${job.address}, ${job.tier}, attempt ${job.attempts + 1})`);

    // Process the job
    const startTime = Date.now();
    const result = await this.processJob(job);
    const duration = Date.now() - startTime;

    if (result.success) {
      await this.queue.complete(job.id, {
        success: true,
        results: result.results,
        attempts: job.attempts + 1,
      });
      console.log(`[AIWorker] Job ${job.id} completed in ${duration}ms (${result.results?.length || 0} assessments)`);

      // Record successful call for rate limiting
      await this.queue.recordCall();
    } else {
      if (result.retryable) {
        await this.queue.requeue(job, result.error || 'Unknown error');
      } else {
        await this.queue.complete(job.id, {
          success: false,
          error: result.error,
          attempts: job.attempts + 1,
        });
        console.log(`[AIWorker] Job ${job.id} failed permanently: ${result.error}`);
      }
    }

    // Enforce minimum delay between calls
    const elapsed = Date.now() - startTime;
    if (elapsed < this.config.rateLimit.minDelayMs) {
      await this.sleep(this.config.rateLimit.minDelayMs - elapsed);
    }
  }

  /**
   * Process a single AI job
   */
  private async processJob(job: AIJobData): Promise<ProcessResult> {
    if (!this.client) {
      // No API key - mark as processed but without AI
      return {
        success: true,
        results: job.findings.map(f => ({
          findingId: f.id,
          isFalsePositive: false,
          assessment: 'AI analysis unavailable - no API key configured',
          attackPath: null,
          recommendedFix: null,
          adjustedSeverity: null,
        })),
        retryable: false,
      };
    }

    const model = job.tier === 'sonnet'
      ? this.config.modelSonnet
      : this.config.modelHaiku;

    // Build the prompt
    const findingsSummary = job.findings.map((f, idx) => (
      `[Finding ${idx + 1}] ${f.detectorName} (${f.severity}/${f.confidence})
Tool: ${f.tool}
Description: ${f.description}
File: ${f.filePath ?? 'N/A'}, Lines: ${f.lineStart ?? '?'}-${f.lineEnd ?? '?'}
Code: ${f.codeSnippet ?? 'N/A'}`
    )).join('\n\n');

    // Truncate source to fit context window
    const maxSourceLen = 30000;
    const truncatedSource = job.sourceCode.length > maxSourceLen
      ? job.sourceCode.slice(0, maxSourceLen) + '\n// ... (truncated)'
      : job.sourceCode;

    const userPrompt = `## Context
Protocol: ${job.protocolName ?? job.name ?? 'Unknown DeFi protocol'}
Chain: ${job.chain}
Address: ${job.address}

## Contract Source Code
\`\`\`solidity
${truncatedSource}
\`\`\`

## Static Analysis Findings
${findingsSummary}

## Task
For EACH finding above, assess if it is a true positive or false positive.
Focus on:
- Flash loan attack vectors
- Oracle manipulation opportunities
- MEV exposure (sandwich attacks, frontrunning)
- Cross-contract reentrancy
- Access control gaps

Respond with a JSON array of assessments, one per finding, in the same order.`;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Record usage for cost tracking
      this.costTracker.recordCall(
        model,
        response.usage?.input_tokens ?? 0,
        response.usage?.output_tokens ?? 0,
      );

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Parse the response
      const results = this.parseResponse(text, job.findings);
      return { success: true, results, retryable: false };

    } catch (err: unknown) {
      return this.handleApiError(err);
    }
  }

  /**
   * Handle API errors with appropriate retry logic
   */
  private async handleApiError(err: unknown): Promise<ProcessResult> {
    // Check if it's an Anthropic API error by duck typing
    const apiError = err as { status?: number; message?: string; headers?: Record<string, string> };

    if (apiError.status === 429) {
      // Rate limit error
      const retryAfter = this.extractRetryAfter(apiError);
      await this.queue.handle429(retryAfter);

      return {
        success: false,
        error: `Rate limited${retryAfter ? ` (retry after ${retryAfter}ms)` : ''}`,
        retryable: true,
      };
    }

    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      console.error('[AIWorker] API connection error:', err.message);
      return {
        success: false,
        error: `Connection error: ${err.message}`,
        retryable: true,
      };
    }

    if (apiError.status !== undefined) {
      const status = apiError.status;

      // 5xx errors are retryable
      if (status >= 500) {
        return {
          success: false,
          error: `Server error (${status}): ${apiError.message || 'Unknown'}`,
          retryable: true,
        };
      }

      // 4xx errors (except 429) are not retryable
      return {
        success: false,
        error: `API error (${status}): ${apiError.message || 'Unknown'}`,
        retryable: false,
      };
    }

    // Unknown errors - don't retry
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AIWorker] Unexpected API error:', message);
    return {
      success: false,
      error: `Unexpected error: ${message}`,
      retryable: false,
    };
  }

  /**
   * Extract retry-after header from rate limit error
   */
  private extractRetryAfter(err: { headers?: Record<string, string> }): number | undefined {
    // Try to extract from headers
    if (err.headers?.['retry-after']) {
      const seconds = parseInt(err.headers['retry-after'], 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
    return undefined;
  }

  /**
   * Parse the AI response JSON
   */
  private parseResponse(text: string, findings: AIJobData['findings']): ProcessResult['results'] {
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('[AIWorker] AI response did not contain valid JSON array');
        return findings.map(f => ({
          findingId: f.id,
          isFalsePositive: false,
          assessment: 'Failed to parse AI response',
          attackPath: null,
          recommendedFix: null,
          adjustedSeverity: null,
        }));
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        isFalsePositive: boolean;
        assessment: string;
        attackPath: string | null;
        recommendedFix: string | null;
        adjustedSeverity: string | null;
      }>;

      return parsed.map((result, idx) => {
        const finding = findings[idx];
        if (!finding) return null;

        return {
          findingId: finding.id,
          isFalsePositive: result.isFalsePositive,
          assessment: result.assessment,
          attackPath: result.attackPath ?? null,
          recommendedFix: result.recommendedFix ?? null,
          adjustedSeverity: result.adjustedSeverity ?? null,
        };
      }).filter((r): r is NonNullable<typeof r> => r !== null);

    } catch (err) {
      console.error('[AIWorker] Failed to parse AI response:', err);
      return findings.map(f => ({
        findingId: f.id,
        isFalsePositive: false,
        assessment: 'Failed to parse AI response',
        attackPath: null,
        recommendedFix: null,
        adjustedSeverity: null,
      }));
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    console.log('[AIWorker] Stopping...');
    this.running = false;

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    await this.queue.close();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ── Main Entry Point ──
async function main(): Promise<void> {
  console.log('White-Rabbit AI Worker');
  console.log('======================\n');

  const config = loadConfig();

  // Build rate limit config from environment
  const rateLimit: AIRateLimitConfig = {
    rpm: Number(process.env.WR_AI_RPM) || 2,
    minDelayMs: Number(process.env.WR_AI_MIN_DELAY_MS) || 12000,
    maxAttempts: Number(process.env.WR_AI_MAX_ATTEMPTS) || 5,
    cooldownMs: Number(process.env.WR_AI_COOLDOWN_MS) || 120000,
    consecutive429Threshold: Number(process.env.WR_AI_429_THRESHOLD) || 3,
  };

  const workerConfig: AIWorkerConfig = {
    redisUrl: config.redisUrl,
    anthropicApiKey: config.anthropicApiKey,
    rateLimit,
    modelHaiku: config.ai.modelHaiku,
    modelSonnet: config.ai.modelSonnet,
  };

  const worker = new AIWorker(workerConfig);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await worker.start();
}

main().catch((err) => {
  console.error('Fatal AI worker error:', err);
  process.exit(1);
});
