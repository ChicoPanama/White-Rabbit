import Anthropic from '@anthropic-ai/sdk';
import type { Finding, AIAnalysisResult, Severity } from '../types/index.js';
import type { AIConfig, AIRateLimitConfig } from '../config.js';
import { CostTracker } from '../services/cost-tracker.js';
import { AIQueueManager, type AIJobFinding } from '../queue/ai-queue.js';
import { AiCacheService, type AiPromptInput } from '../services/ai-cache.js';
import { Database } from '../database.js';
import { getRedisCache } from '../services/redis-cache.js';

export type AnalysisTier = 'none' | 'haiku' | 'sonnet';

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

export class AIAnalyzer {
  private client: Anthropic | null;
  private costTracker: CostTracker;
  private aiConfig: AIConfig;
  private queueManager: AIQueueManager | null = null;
  private useQueue: boolean = false;
  private cacheService: AiCacheService | null = null;

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
    }
  ) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
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
    return (this.client !== null || this.useQueue) && !this.aiConfig.disableAiAnalysis;
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
   */
  async analyzeFindingsBatch(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
    tier?: AnalysisTier,
  ): Promise<AIAnalysisResult[]> {
    if (!this.client || findings.length === 0) {
      return [];
    }

    const model = this.resolveModel(tier ?? 'sonnet');

    const results: AIAnalysisResult[] = [];

    // Process findings in groups to stay within context limits
    const batchSize = 5;
    for (let i = 0; i < findings.length; i += batchSize) {
      const batch = findings.slice(i, i + batchSize);
      const batchResults = await this.analyzeBatch(batch, contractSource, protocolType, model);
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

  private async analyzeBatch(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
    model: string,
    findingContext?: { chain: string; address: string },
  ): Promise<AIAnalysisResult[]> {
    if (!this.client) return [];

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
      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Record usage for cost tracking
      const tokensIn = response.usage?.input_tokens ?? 0;
      const tokensOut = response.usage?.output_tokens ?? 0;
      this.costTracker.recordCall(model, tokensIn, tokensOut);

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

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
