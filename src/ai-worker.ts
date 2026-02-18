/**
 * Dedicated AI Worker - processes AI analysis jobs from Redis queue.
 *
 * This worker:
 * - Pulls jobs from wr:ai:queue one at a time
 * - Enforces global rate limiting via Redis
 * - Handles 429 errors with exponential backoff
 * - Implements circuit breaker for consecutive failures
 * - Falls back to alternative API (DeepSeek/OpenAI-compatible) when Anthropic fails
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

// ── Fallback Provider (OpenAI-compatible API like DeepSeek) ──
interface FallbackConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

// ── Types ──
interface AIWorkerConfig {
  redisUrl: string;
  anthropicApiKey: string | null;
  rateLimit: AIRateLimitConfig;
  modelHaiku: string;
  modelSonnet: string;
  fallback: FallbackConfig | null;
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

// ── System Prompt (kept in sync with ai-analyzer.ts) ──
const SYSTEM_PROMPT = `You are an OFFENSIVE smart contract security researcher. Your goal is to find and exploit vulnerabilities in DeFi protocols for bug bounties.

You think like an ATTACKER, not a reviewer. For each finding, you must:

1. IDENTIFY THE PROTOCOL ARCHETYPE:
   - AMM/DEX: Look for price manipulation, sandwich attacks, LP token exploits
   - Lending: Look for oracle manipulation, liquidation bypass, interest rate attacks
   - Vault/Yield: Look for share inflation, deposit/withdraw imbalance, reward manipulation
   - Staking: Look for reward draining, stake timing attacks, slashing bypass
   - Bridge: Look for message replay, signature bypass, state sync issues
   - Governance: Look for flash loan voting, timelock bypass, proposal manipulation

2. TRACE THE COMPLETE EXPLOIT PATH:
   - What external call triggers the vulnerability?
   - What internal state changes occur?
   - How does the attacker profit?
   - What is the exact sequence of transactions?

3. CHECK PARAMETER BOUNDS (Critical for arithmetic issues):
   - What values are required to trigger overflow/underflow?
   - Can these values actually be achieved given protocol constraints?
   - Check setter functions for require() statements that limit values
   - If trigger values exceed protocol maximums → FALSE POSITIVE

4. ESTIMATE PROFITABILITY:
   - What capital is required? (flash loan availability?)
   - What is the expected profit in USD?
   - What are the gas costs?
   - Is MEV competition likely to front-run?

5. ASSESS REAL-WORLD EXPLOITABILITY:
   - Is the vulnerable function externally callable?
   - Are there access controls that block the attack?
   - Is the timing window realistic?
   - Has a similar exploit been used before?

KNOWN ATTACK PATTERNS BY PROTOCOL TYPE:

AMM/DEX Attacks:
- Flash loan + swap to manipulate spot price
- Sandwich attacks on large swaps
- LP token price manipulation
- Fee-on-transfer token edge cases

Lending Attacks:
- Oracle manipulation for bad debt creation
- Collateral factor manipulation via flash deposits
- Interest rate manipulation via utilization spikes
- Liquidation front-running

Vault Attacks:
- First depositor share inflation (1 wei attack)
- Donation attacks to manipulate share price
- Flash loan deposit/withdraw cycles
- Reward token manipulation

For each finding, respond with valid JSON:
{
  "isFalsePositive": boolean,
  "assessment": "2-3 sentences explaining your reasoning",
  "protocolArchetype": "amm | lending | vault | staking | bridge | governance | unknown",
  "exploitPath": {
    "trigger": "The function call that starts the exploit",
    "steps": ["Step 1: Flash loan X tokens", "Step 2: Call vulnerable function", ...],
    "profit": "How attacker extracts value"
  } | null,
  "parameterBoundsCheck": {
    "requiredValue": "Value needed to trigger (e.g., fee > 2^64)",
    "protocolMax": "Maximum allowed by protocol (e.g., fee capped at 1e10)",
    "achievable": boolean
  } | null,
  "profitEstimate": {
    "requiredCapital": "$X (or 'flash loan')",
    "expectedProfit": "$X",
    "gasCost": "$X",
    "mevRisk": "low | medium | high"
  } | null,
  "adjustedSeverity": "critical | high | medium | low | informational | null",
  "recommendedFix": "Specific code fix" | null
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
  private useAnthropicNext: boolean = true; // Toggle between providers on failure
  private anthropicFailures: number = 0;
  private fallbackFailures: number = 0;

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

    if (!this.client && !this.config.fallback) {
      console.warn('[AIWorker] No ANTHROPIC_API_KEY or fallback configured - will mark jobs as no_ai');
    } else {
      if (this.client) {
        console.log('[AIWorker] Primary: Anthropic API');
      }
      if (this.config.fallback) {
        console.log(`[AIWorker] Fallback: ${this.config.fallback.baseUrl} (${this.config.fallback.model})`);
      }
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
   * Process a single AI job - tries Anthropic first, falls back to alternative provider
   */
  private async processJob(job: AIJobData): Promise<ProcessResult> {
    if (!this.client && !this.config.fallback) {
      // No API keys - mark as processed but without AI
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

    // Build the prompt (shared between providers)
    const { userPrompt, systemPrompt } = this.buildPrompt(job);

    // Try primary provider first (Anthropic), then fallback
    let result: ProcessResult;

    // Decide which provider to try first based on recent failures
    const tryAnthropicFirst = this.client && (this.useAnthropicNext || !this.config.fallback);

    if (tryAnthropicFirst && this.client) {
      result = await this.callAnthropic(job, userPrompt, systemPrompt);

      if (result.success) {
        this.anthropicFailures = 0;
        return result;
      }

      // Anthropic failed - try fallback if available
      this.anthropicFailures++;
      console.log(`[AIWorker] Anthropic failed (${this.anthropicFailures} consecutive), trying fallback...`);

      if (this.config.fallback && this.anthropicFailures >= 2) {
        this.useAnthropicNext = false; // Switch to fallback for next job
      }

      if (this.config.fallback) {
        result = await this.callFallback(job, userPrompt, systemPrompt);
        if (result.success) {
          this.fallbackFailures = 0;
          return result;
        }
        this.fallbackFailures++;
      }
    } else if (this.config.fallback) {
      // Try fallback first
      result = await this.callFallback(job, userPrompt, systemPrompt);

      if (result.success) {
        this.fallbackFailures = 0;
        return result;
      }

      // Fallback failed - try Anthropic if available
      this.fallbackFailures++;
      console.log(`[AIWorker] Fallback failed (${this.fallbackFailures} consecutive), trying Anthropic...`);

      if (this.client && this.fallbackFailures >= 2) {
        this.useAnthropicNext = true; // Switch to Anthropic for next job
      }

      if (this.client) {
        result = await this.callAnthropic(job, userPrompt, systemPrompt);
        if (result.success) {
          this.anthropicFailures = 0;
          return result;
        }
        this.anthropicFailures++;
      }
    } else {
      // This shouldn't happen but handle it
      return {
        success: false,
        error: 'No AI provider available',
        retryable: false,
      };
    }

    return result!;
  }

  /**
   * Build the prompt for AI analysis
   */
  private buildPrompt(job: AIJobData): { userPrompt: string; systemPrompt: string } {
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

    return { userPrompt, systemPrompt: SYSTEM_PROMPT };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    job: AIJobData,
    userPrompt: string,
    systemPrompt: string
  ): Promise<ProcessResult> {
    if (!this.client) {
      return { success: false, error: 'Anthropic client not configured', retryable: false };
    }

    const model = job.tier === 'sonnet'
      ? this.config.modelSonnet
      : this.config.modelHaiku;

    try {
      console.log(`[AIWorker] Calling Anthropic (${model})...`);
      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
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
      console.log(`[AIWorker] Anthropic success (${results.length} assessments)`);
      return { success: true, results, retryable: false };

    } catch (err: unknown) {
      return this.handleApiError(err, 'Anthropic');
    }
  }

  /**
   * Call fallback API (OpenAI-compatible, e.g., DeepSeek)
   */
  private async callFallback(
    job: AIJobData,
    userPrompt: string,
    systemPrompt: string
  ): Promise<ProcessResult> {
    if (!this.config.fallback) {
      return { success: false, error: 'Fallback not configured', retryable: false };
    }

    const { apiKey, baseUrl, model } = this.config.fallback;

    try {
      console.log(`[AIWorker] Calling fallback (${model} via ${baseUrl})...`);

      // OpenAI-compatible API call
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 4096,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return this.handleApiError(
          { status: response.status, message: errorText },
          'Fallback'
        );
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const text = data.choices?.[0]?.message?.content || '';

      // Record usage (approximate cost tracking)
      if (data.usage) {
        this.costTracker.recordCall(
          model,
          data.usage.prompt_tokens ?? 0,
          data.usage.completion_tokens ?? 0,
        );
      }

      // Parse the response
      const results = this.parseResponse(text, job.findings);
      console.log(`[AIWorker] Fallback success (${results.length} assessments)`);
      return { success: true, results, retryable: false };

    } catch (err: unknown) {
      return this.handleApiError(err, 'Fallback');
    }
  }

  /**
   * Handle API errors with appropriate retry logic
   */
  private async handleApiError(err: unknown, provider: string = 'API'): Promise<ProcessResult> {
    // Check if it's an API error by duck typing
    const apiError = err as { status?: number; message?: string; headers?: Record<string, string> };

    if (apiError.status === 429) {
      // Rate limit error
      const retryAfter = this.extractRetryAfter(apiError);
      await this.queue.handle429(retryAfter);

      console.warn(`[AIWorker] ${provider} rate limited`);
      return {
        success: false,
        error: `${provider} rate limited${retryAfter ? ` (retry after ${retryAfter}ms)` : ''}`,
        retryable: true,
      };
    }

    if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
      console.error(`[AIWorker] ${provider} connection error:`, err.message);
      return {
        success: false,
        error: `${provider} connection error: ${err.message}`,
        retryable: true,
      };
    }

    if (apiError.status !== undefined) {
      const status = apiError.status;

      // 5xx errors are retryable
      if (status >= 500) {
        console.error(`[AIWorker] ${provider} server error (${status})`);
        return {
          success: false,
          error: `${provider} server error (${status}): ${apiError.message || 'Unknown'}`,
          retryable: true,
        };
      }

      // 4xx errors (except 429) are not retryable
      console.error(`[AIWorker] ${provider} API error (${status}): ${apiError.message}`);
      return {
        success: false,
        error: `${provider} API error (${status}): ${apiError.message || 'Unknown'}`,
        retryable: false,
      };
    }

    // Unknown errors - don't retry
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AIWorker] ${provider} unexpected error:`, message);
    return {
      success: false,
      error: `${provider} unexpected error: ${message}`,
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
  private parseResponse(text: string, findings: AIJobData['findings']): NonNullable<ProcessResult['results']> {
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

  // Build fallback config from environment (e.g., DeepSeek)
  const fallbackApiKey = process.env.WR_AI_FALLBACK_API_KEY;
  const fallback: FallbackConfig | null = fallbackApiKey
    ? {
        apiKey: fallbackApiKey,
        baseUrl: process.env.WR_AI_FALLBACK_BASE_URL || 'https://api.deepseek.com/v1',
        model: process.env.WR_AI_FALLBACK_MODEL || 'deepseek-chat',
      }
    : null;

  const workerConfig: AIWorkerConfig = {
    redisUrl: config.redisUrl,
    anthropicApiKey: config.anthropicApiKey,
    rateLimit,
    modelHaiku: config.ai.modelHaiku,
    modelSonnet: config.ai.modelSonnet,
    fallback,
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
