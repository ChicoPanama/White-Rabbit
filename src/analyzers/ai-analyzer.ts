import Anthropic from '@anthropic-ai/sdk';
import type { Finding, AIAnalysisResult, Severity } from '../types/index.js';
import type { AIConfig, AIRateLimitConfig } from '../config.js';
import { CostTracker } from '../services/cost-tracker.js';
import { AIQueueManager, type AIJobFinding } from '../queue/ai-queue.js';
import { AiCacheService, type AiPromptInput } from '../services/ai-cache.js';
import { Database } from '../database.js';
import { getRedisCache } from '../services/redis-cache.js';

export type AnalysisTier = 'none' | 'haiku' | 'sonnet';
export type AIProvider = 'anthropic' | 'openrouter' | 'gemini' | 'kimi';

// Provider priority for fallback (Kimi K2.5 is strongest free option)
// Kimi (free via OpenClaw) -> Gemini Flash (free) -> OpenRouter/Anthropic (paid)
const PROVIDER_FALLBACK_ORDER: AIProvider[] = ['kimi', 'gemini', 'openrouter', 'anthropic'];

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

// OpenRouter model mappings
const OPENROUTER_MODELS: Record<string, string> = {
  'claude-haiku-4-5-20251001': 'anthropic/claude-3.5-haiku',
  'claude-sonnet-4-20250514': 'anthropic/claude-sonnet-4',
  'claude-3-5-haiku-20241022': 'anthropic/claude-3.5-haiku',
  'claude-3-5-sonnet-20241022': 'anthropic/claude-3.5-sonnet',
};

export interface TierDecision {
  tier: AnalysisTier;
  reason: string;
}

/**
 * Determine the appropriate AI analysis tier for a finding based on
 * severity, contract TVL, and audit status.
 */
export function getAnalysisTier(
  severity: Severity,
  contractTvl: number | null,
  isAudited: boolean,
  aiConfig: AIConfig,
): TierDecision {
  if (aiConfig.disableAiAnalysis) {
    return { tier: 'none', reason: 'AI analysis disabled' };
  }

  // Audited, well-known protocols with low/medium findings: skip AI
  if (isAudited && (severity === 'low' || severity === 'informational')) {
    return { tier: 'none', reason: 'Low severity on audited protocol' };
  }

  // Critical findings always get Sonnet
  if (severity === 'critical') {
    return { tier: 'sonnet', reason: 'Critical severity' };
  }

  // High findings: Sonnet if high TVL, otherwise Haiku
  if (severity === 'high') {
    if (contractTvl !== null && contractTvl >= aiConfig.minTvlForSonnet) {
      return { tier: 'sonnet', reason: `High severity + high TVL ($${(contractTvl / 1e6).toFixed(1)}M)` };
    }
    return { tier: 'haiku', reason: 'High severity' };
  }

  // Medium findings: Haiku if TVL threshold met, otherwise skip
  if (severity === 'medium') {
    if (contractTvl !== null && contractTvl >= aiConfig.minTvlForAi) {
      return { tier: 'haiku', reason: 'Medium severity with sufficient TVL' };
    }
    if (isAudited) {
      return { tier: 'none', reason: 'Medium severity on audited protocol (below TVL threshold)' };
    }
    return { tier: 'haiku', reason: 'Medium severity on unaudited protocol' };
  }

  // Low/informational on unaudited: skip
  return { tier: 'none', reason: 'Low severity' };
}

/**
 * OpenRouter API client using fetch
 */
class OpenRouterClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createMessage(params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: string; content: string }>;
  }): Promise<{
    content: string;
    usage: { input_tokens: number; output_tokens: number };
  }> {
    // Map model name to OpenRouter format if needed
    const model = OPENROUTER_MODELS[params.model] || params.model;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/white-rabbit-scanner',
        'X-Title': 'White-Rabbit Security Scanner',
      },
      body: JSON.stringify({
        model,
        max_tokens: params.max_tokens,
        messages: [
          { role: 'system', content: params.system },
          ...params.messages,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

/**
 * Gemini API client (Google AI Studio - free tier: 1,500 req/day)
 */
class GeminiClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model = 'gemini-2.0-flash';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createMessage(params: {
    system: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
  }): Promise<{
    content: string;
    usage: { input_tokens: number; output_tokens: number };
  }> {
    // Gemini uses a different format - combine system prompt with first user message
    const contents = params.messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Prepend system instruction to first user message
    if (contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${params.system}\n\n${contents[0].parts[0].text}`;
    }

    const response = await fetch(
      `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: params.max_tokens || 4096,
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      const status = response.status;
      if (status === 429) {
        throw new Error(`RATE_LIMITED: Gemini rate limit exceeded`);
      }
      throw new Error(`Gemini API error: ${status} - ${error}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content: text,
      usage: {
        input_tokens: data.usageMetadata?.promptTokenCount || 0,
        output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }
}

/**
 * Kimi API client (via OpenClaw gateway or direct Moonshot API)
 * Free tier via OpenClaw gateway integration
 */
class KimiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    // Use Moonshot API key from environment or OpenClaw's configured key
    this.apiKey = apiKey || process.env.MOONSHOT_API_KEY || '';
    this.baseUrl = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
  }

  get isAvailable(): boolean {
    return !!this.apiKey;
  }

  async createMessage(params: {
    system: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
  }): Promise<{
    content: string;
    usage: { input_tokens: number; output_tokens: number };
  }> {
    if (!this.apiKey) {
      throw new Error('Kimi API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kimi-k2-0711-preview', // Kimi K2.5
        max_tokens: params.max_tokens || 4096,
        messages: [
          { role: 'system', content: params.system },
          ...params.messages,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      const status = response.status;
      if (status === 429) {
        throw new Error(`RATE_LIMITED: Kimi rate limit exceeded`);
      }
      throw new Error(`Kimi API error: ${status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

export class AIAnalyzer {
  private anthropicClient: Anthropic | null = null;
  private openRouterClient: OpenRouterClient | null = null;
  private geminiClient: GeminiClient | null = null;
  private kimiClient: KimiClient | null = null;
  private provider: AIProvider;
  private costTracker: CostTracker;
  private aiConfig: AIConfig;
  private queueManager: AIQueueManager | null = null;
  private useQueue: boolean = false;
  private cacheService: AiCacheService | null = null;
  private failedProviders: Set<AIProvider> = new Set(); // Track rate-limited providers

  constructor(
    apiKey: string | null,
    aiConfig: AIConfig,
    costTracker?: CostTracker,
    options?: {
      useQueue?: boolean;
      redisUrl?: string;
      rateLimitConfig?: AIRateLimitConfig;
      db?: Database;
      enableCache?: boolean;
      provider?: AIProvider;
      openRouterApiKey?: string;
      geminiApiKey?: string;
    }
  ) {
    // Determine primary provider
    this.provider = options?.provider || (process.env.AI_PROVIDER as AIProvider) || 'anthropic';

    // Initialize ALL clients for fallback support (free tiers first)
    // Gemini (free tier - 1,500 req/day)
    const geminiKey = options?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.geminiClient = new GeminiClient(geminiKey);
      console.log('[AIAnalyzer] Gemini client initialized (free tier)');
    }

    // Kimi (free via OpenClaw/Moonshot)
    this.kimiClient = new KimiClient();
    if (this.kimiClient.isAvailable) {
      console.log('[AIAnalyzer] Kimi client initialized (free tier)');
    }

    // OpenRouter (paid fallback)
    const orKey = options?.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (orKey) {
      this.openRouterClient = new OpenRouterClient(orKey);
      console.log('[AIAnalyzer] OpenRouter client initialized (paid fallback)');
    }

    // Anthropic (paid fallback)
    if (apiKey) {
      this.anthropicClient = new Anthropic({ apiKey });
      console.log('[AIAnalyzer] Anthropic client initialized (paid fallback)');
    }

    console.log(`[AIAnalyzer] Primary provider: ${this.provider}`);

    this.aiConfig = aiConfig;
    this.costTracker = costTracker ?? new CostTracker(
      aiConfig.maxCallsPerHour,
      aiConfig.maxSpendPerDay,
    );

    // Initialize queue manager if queue mode is enabled
    if (options?.useQueue && options?.redisUrl) {
      this.useQueue = true;
      this.queueManager = new AIQueueManager(options.redisUrl, options.rateLimitConfig);
      console.log('[AIAnalyzer] Queue mode enabled - AI jobs will be enqueued to Redis');
    }

    // Initialize AI cache service if database provided
    if (options?.db && options?.enableCache !== false) {
      this.cacheService = new AiCacheService(options.db, getRedisCache());
      console.log('[AIAnalyzer] Cache mode enabled - AI results will be cached');
    }
  }

  getCacheService(): AiCacheService | null {
    return this.cacheService;
  }

  get isAvailable(): boolean {
    const hasAnyClient =
      this.geminiClient !== null ||
      (this.kimiClient?.isAvailable ?? false) ||
      this.openRouterClient !== null ||
      this.anthropicClient !== null;
    return (hasAnyClient || this.useQueue) && !this.aiConfig.disableAiAnalysis;
  }

  /**
   * Get the next available provider in fallback order
   */
  private getNextProvider(excludeProviders: Set<AIProvider> = new Set()): AIProvider | null {
    for (const provider of PROVIDER_FALLBACK_ORDER) {
      if (excludeProviders.has(provider)) continue;

      switch (provider) {
        case 'gemini':
          if (this.geminiClient) return provider;
          break;
        case 'kimi':
          if (this.kimiClient?.isAvailable) return provider;
          break;
        case 'openrouter':
          if (this.openRouterClient) return provider;
          break;
        case 'anthropic':
          if (this.anthropicClient) return provider;
          break;
      }
    }
    return null;
  }

  /**
   * Reset failed providers (call periodically or after cooldown)
   */
  resetFailedProviders(): void {
    this.failedProviders.clear();
  }

  get isQueueMode(): boolean {
    return this.useQueue;
  }

  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  getQueueManager(): AIQueueManager | null {
    return this.queueManager;
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  /**
   * Enqueue AI analysis job to Redis queue (for async processing by AI worker).
   * Returns the job ID for tracking.
   */
  async enqueueAnalysis(
    findings: Finding[],
    contractSource: string,
    address: string,
    chain: string,
    chainId: number,
    tier: AnalysisTier,
    protocolName?: string,
    symbol?: string,
  ): Promise<string | null> {
    if (!this.queueManager || findings.length === 0) {
      return null;
    }

    // Convert findings to queue format
    const queueFindings: AIJobFinding[] = findings.map(f => ({
      id: f.id,
      detectorName: f.detectorName,
      severity: f.severity,
      confidence: f.confidence,
      description: f.description,
      filePath: f.filePath,
      lineStart: f.lineStart,
      lineEnd: f.lineEnd,
      codeSnippet: f.codeSnippet,
      tool: f.tool,
    }));

    const jobId = await this.queueManager.enqueue({
      chain,
      chainId,
      address,
      symbol,
      name: protocolName,
      sourceCode: contractSource,
      findings: queueFindings,
      tier: tier === 'none' ? 'haiku' : tier, // Default to haiku if none
      priority: tier === 'sonnet' ? 0 : 1,
      protocolName,
    });

    console.log(`[AIAnalyzer] Enqueued ${findings.length} findings for ${address} (job: ${jobId}, tier: ${tier})`);
    return jobId;
  }

  /**
   * Analyze a batch of findings for a single contract.
   * Returns AI assessments for each finding.
   * Uses tiered fallback: Gemini (free) -> Kimi (free) -> OpenRouter/Claude (paid)
   */
  async analyzeFindingsBatch(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
    tier?: AnalysisTier,
  ): Promise<AIAnalysisResult[]> {
    if (!this.isAvailable || findings.length === 0) {
      return [];
    }

    const model = this.resolveModel(tier ?? 'sonnet');

    const results: AIAnalysisResult[] = [];

    // Process findings in groups to stay within context limits
    const batchSize = 5;
    for (let i = 0; i < findings.length; i += batchSize) {
      const batch = findings.slice(i, i + batchSize);
      const batchResults = await this.analyzeBatchWithFallback(batch, contractSource, protocolType, model);
      results.push(...batchResults);
    }

    return results;
  }

  private resolveModel(tier: AnalysisTier): string {
    switch (tier) {
      case 'haiku':
        return this.aiConfig.modelHaiku;
      case 'sonnet':
        return this.aiConfig.modelSonnet;
      default:
        return this.aiConfig.modelSonnet;
    }
  }

  /**
   * Analyze batch with automatic fallback through provider tiers
   * Gemini (free) -> Kimi (free) -> OpenRouter -> Anthropic (paid)
   */
  private async analyzeBatchWithFallback(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
    model: string,
    findingContext?: { chain: string; address: string },
  ): Promise<AIAnalysisResult[]> {
    const triedProviders = new Set<AIProvider>();

    while (true) {
      const provider = this.getNextProvider(new Set([...triedProviders, ...this.failedProviders]));

      if (!provider) {
        console.warn('[AIAnalyzer] All providers exhausted or rate-limited');
        return [];
      }

      try {
        console.log(`[AIAnalyzer] Trying provider: ${provider}`);
        const results = await this.analyzeBatchWithProvider(
          findings,
          contractSource,
          protocolType,
          model,
          provider,
          findingContext
        );
        return results;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (errorMsg.includes('RATE_LIMITED')) {
          console.warn(`[AIAnalyzer] ${provider} rate limited, trying next provider...`);
          this.failedProviders.add(provider);
          // Schedule provider reset after 1 hour
          setTimeout(() => this.failedProviders.delete(provider), 60 * 60 * 1000);
        } else {
          console.error(`[AIAnalyzer] ${provider} failed: ${errorMsg}`);
        }

        triedProviders.add(provider);
      }
    }
  }

  /**
   * Make API call using a specific provider
   */
  private async callProviderAPI(
    provider: AIProvider,
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
    const messages = [{ role: 'user', content: userPrompt }];

    switch (provider) {
      case 'gemini': {
        if (!this.geminiClient) throw new Error('Gemini client not available');
        const response = await this.geminiClient.createMessage({
          system: systemPrompt,
          messages,
          max_tokens: 4096,
        });
        return {
          text: response.content,
          tokensIn: response.usage.input_tokens,
          tokensOut: response.usage.output_tokens,
        };
      }

      case 'kimi': {
        if (!this.kimiClient?.isAvailable) throw new Error('Kimi client not available');
        const response = await this.kimiClient.createMessage({
          system: systemPrompt,
          messages,
          max_tokens: 4096,
        });
        return {
          text: response.content,
          tokensIn: response.usage.input_tokens,
          tokensOut: response.usage.output_tokens,
        };
      }

      case 'openrouter': {
        if (!this.openRouterClient) throw new Error('OpenRouter client not available');
        const response = await this.openRouterClient.createMessage({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        });
        return {
          text: response.content,
          tokensIn: response.usage.input_tokens,
          tokensOut: response.usage.output_tokens,
        };
      }

      case 'anthropic': {
        if (!this.anthropicClient) throw new Error('Anthropic client not available');
        const response = await this.anthropicClient.messages.create({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');
        return {
          text,
          tokensIn: response.usage?.input_tokens ?? 0,
          tokensOut: response.usage?.output_tokens ?? 0,
        };
      }

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Analyze batch using a specific provider
   */
  private async analyzeBatchWithProvider(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
    model: string,
    provider: AIProvider,
    findingContext?: { chain: string; address: string },
  ): Promise<AIAnalysisResult[]> {
    // Check cost budget before making the call (skip for free providers)
    const isFreeProvider = provider === 'gemini' || provider === 'kimi';
    if (!isFreeProvider) {
      const budget = this.costTracker.canMakeAiCall();
      if (!budget.allowed) {
        console.warn(`[AIAnalyzer] Skipping paid provider ${provider}: ${budget.reason}`);
        throw new Error('BUDGET_EXCEEDED');
      }
    }

    const findingsSummary = findings.map((f, idx) => (
      `[Finding ${idx + 1}] ${f.detectorName} (${f.severity}/${f.confidence})
Tool: ${f.tool}
Description: ${f.description}
File: ${f.filePath ?? 'N/A'}, Lines: ${f.lineStart ?? '?'}-${f.lineEnd ?? '?'}
Code: ${f.codeSnippet ?? 'N/A'}`
    )).join('\n\n');

    // Truncate source to fit context window
    const maxSourceLen = 30_000;
    const truncatedSource = contractSource.length > maxSourceLen
      ? contractSource.slice(0, maxSourceLen) + '\n// ... (truncated)'
      : contractSource;

    const userPrompt = `## Context
Protocol type: ${protocolType ?? 'Unknown DeFi protocol'}

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

    // Build prompt input for caching
    const promptInput: AiPromptInput = {
      model: `${provider}:${model}`,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      findingContext: findingContext && findings[0] ? {
        chain: findingContext.chain,
        address: findingContext.address,
        detectorName: findings.map(f => f.detectorName).join(','),
        tool: findings.map(f => f.tool).join(','),
        severity: findings[0].severity,
        codeSnippet: findings[0].codeSnippet ?? undefined,
      } : undefined,
    };

    // Check cache first
    if (this.cacheService) {
      const promptHash = this.cacheService.computePromptHash(promptInput);
      const cacheResult = await this.cacheService.lookup(promptHash);

      if (cacheResult.hit && cacheResult.result) {
        console.log(`[AIAnalyzer] Cache HIT (${cacheResult.source}): ${promptHash.slice(0, 12)}...`);
        const cachedOutput = cacheResult.result.outputJson as { assessments?: unknown[] };
        if (cachedOutput.assessments && Array.isArray(cachedOutput.assessments)) {
          return this.parseResponseFromCached(cachedOutput.assessments, findings);
        }
      }
    }

    // Make the API call
    const { text, tokensIn, tokensOut } = await this.callProviderAPI(
      provider,
      SYSTEM_PROMPT,
      userPrompt,
      model
    );

    // Record usage for cost tracking (even free providers for stats)
    this.costTracker.recordCall(model, tokensIn, tokensOut);

    const results = this.parseResponse(text, findings);

    // Store in cache
    if (this.cacheService && results.length > 0) {
      const promptHash = this.cacheService.computePromptHash(promptInput);
      await this.cacheService.store({
        promptHash,
        input: promptInput,
        output: { assessments: results, rawText: text, provider },
        tokensIn,
        tokensOut,
        costUsd: isFreeProvider ? 0 : CostTracker.estimateCost(model, tokensIn, tokensOut),
        status: 'ok',
      });
    }

    console.log(`[AIAnalyzer] ${provider} returned ${results.length} assessments`);
    return results;
  }

  // Legacy method kept for compatibility
  private async analyzeBatch(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
    model: string,
    findingContext?: { chain: string; address: string },
  ): Promise<AIAnalysisResult[]> {
    const hasClient = this.provider === 'openrouter'
      ? this.openRouterClient !== null
      : this.anthropicClient !== null;

    if (!hasClient) return [];

    // Check cost budget before making the call
    const budget = this.costTracker.canMakeAiCall();
    if (!budget.allowed) {
      console.warn(`[AIAnalyzer] Skipping AI call: ${budget.reason}`);
      return [];
    }

    const findingsSummary = findings.map((f, idx) => (
      `[Finding ${idx + 1}] ${f.detectorName} (${f.severity}/${f.confidence})
Tool: ${f.tool}
Description: ${f.description}
File: ${f.filePath ?? 'N/A'}, Lines: ${f.lineStart ?? '?'}-${f.lineEnd ?? '?'}
Code: ${f.codeSnippet ?? 'N/A'}`
    )).join('\n\n');

    // Truncate source to fit context window
    const maxSourceLen = 30_000;
    const truncatedSource = contractSource.length > maxSourceLen
      ? contractSource.slice(0, maxSourceLen) + '\n// ... (truncated)'
      : contractSource;

    const userPrompt = `## Context
Protocol type: ${protocolType ?? 'Unknown DeFi protocol'}

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

    // Build prompt input for caching
    const promptInput: AiPromptInput = {
      model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      findingContext: findingContext && findings[0] ? {
        chain: findingContext.chain,
        address: findingContext.address,
        detectorName: findings.map(f => f.detectorName).join(','),
        tool: findings.map(f => f.tool).join(','),
        severity: findings[0].severity,
        codeSnippet: findings[0].codeSnippet ?? undefined,
      } : undefined,
    };

    // Check cache first
    if (this.cacheService) {
      const promptHash = this.cacheService.computePromptHash(promptInput);
      const cacheResult = await this.cacheService.lookup(promptHash);

      if (cacheResult.hit && cacheResult.result) {
        console.log(`[AIAnalyzer] Cache HIT (${cacheResult.source}): ${promptHash.slice(0, 12)}...`);
        // Parse cached output
        const cachedOutput = cacheResult.result.outputJson as { assessments?: unknown[] };
        if (cachedOutput.assessments && Array.isArray(cachedOutput.assessments)) {
          return this.parseResponseFromCached(cachedOutput.assessments, findings);
        }
      }
    }

    try {
      let text: string;
      let tokensIn: number;
      let tokensOut: number;

      if (this.provider === 'openrouter' && this.openRouterClient) {
        // Use OpenRouter
        const response = await this.openRouterClient.createMessage({
          model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        text = response.content;
        tokensIn = response.usage.input_tokens;
        tokensOut = response.usage.output_tokens;
      } else if (this.anthropicClient) {
        // Use Anthropic
        const response = await this.anthropicClient.messages.create({
          model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        tokensIn = response.usage?.input_tokens ?? 0;
        tokensOut = response.usage?.output_tokens ?? 0;

        text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');
      } else {
        return [];
      }

      // Record usage for cost tracking
      this.costTracker.recordCall(model, tokensIn, tokensOut);

      const results = this.parseResponse(text, findings);

      // Store in cache
      if (this.cacheService && results.length > 0) {
        const promptHash = this.cacheService.computePromptHash(promptInput);
        await this.cacheService.store({
          promptHash,
          input: promptInput,
          output: { assessments: results, rawText: text },
          tokensIn,
          tokensOut,
          costUsd: CostTracker.estimateCost(model, tokensIn, tokensOut),
          status: 'ok',
        });
      }

      return results;
    } catch (err) {
      console.error('AI analysis failed:', err);

      // Store error in cache to avoid retrying immediately
      if (this.cacheService) {
        const promptHash = this.cacheService.computePromptHash(promptInput);
        await this.cacheService.store({
          promptHash,
          input: promptInput,
          output: {},
          status: 'error',
          errorText: err instanceof Error ? err.message : String(err),
        });
      }

      return [];
    }
  }

  private parseResponseFromCached(assessments: unknown[], findings: Finding[]): AIAnalysisResult[] {
    const severityMap: Record<string, Severity> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
      informational: 'informational',
    };

    return (assessments as Array<{
      findingId?: string;
      isFalsePositive: boolean;
      assessment: string;
      attackPath: string | null;
      recommendedFix: string | null;
      adjustedSeverity: string | null;
    }>).map((result, idx) => {
      const finding = findings[idx];
      if (!finding) return null;

      return {
        findingId: result.findingId ?? finding.id,
        isFalsePositive: result.isFalsePositive,
        assessment: result.assessment,
        attackPath: result.attackPath ?? null,
        recommendedFix: result.recommendedFix ?? null,
        adjustedSeverity: result.adjustedSeverity
          ? (severityMap[result.adjustedSeverity.toLowerCase()] ?? null)
          : null,
      };
    }).filter((r): r is AIAnalysisResult => r !== null);
  }

  private parseResponse(text: string, findings: Finding[]): AIAnalysisResult[] {
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('AI response did not contain valid JSON array');
        return [];
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

        const severityMap: Record<string, Severity> = {
          critical: 'critical',
          high: 'high',
          medium: 'medium',
          low: 'low',
          informational: 'informational',
        };

        return {
          findingId: finding.id,
          isFalsePositive: result.isFalsePositive,
          assessment: result.assessment,
          attackPath: result.attackPath ?? null,
          recommendedFix: result.recommendedFix ?? null,
          adjustedSeverity: result.adjustedSeverity
            ? (severityMap[result.adjustedSeverity.toLowerCase()] ?? null)
            : null,
        };
      }).filter((r): r is AIAnalysisResult => r !== null);
    } catch (err) {
      console.error('Failed to parse AI response:', err);
      return [];
    }
  }

  /**
   * Close the queue manager connection (cleanup)
   */
  async close(): Promise<void> {
    if (this.queueManager) {
      await this.queueManager.close();
    }
  }
}
