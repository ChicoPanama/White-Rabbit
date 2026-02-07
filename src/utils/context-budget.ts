/**
 * Context Budget Manager
 * Ensures LLM calls stay within token limits
 */

export interface ContextBudget {
  limit: number;
  safetyMargin: number;
  maxOutput: number;
}

export const BUDGETS = {
  interactive: {
    limit: 200000,
    safetyMargin: 10000,
    maxOutput: 2048
  },
  report: {
    limit: 200000,
    safetyMargin: 5000,
    maxOutput: 8192
  },
  minimal: {
    limit: 200000,
    safetyMargin: 20000,
    maxOutput: 1024
  }
} as const;

/**
 * Estimate token count from text
 * Claude tokenizer approximation: ~4 chars per token for English
 * JSON/code tends to be ~3.5 chars per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * Check if a request fits within budget
 */
export function checkBudget(
  inputTokens: number,
  requestedOutput: number,
  budget: ContextBudget = BUDGETS.interactive
): { allowed: boolean; maxOutput: number; reason?: string } {
  const available = budget.limit - inputTokens - budget.safetyMargin;

  if (available < 256) {
    return {
      allowed: false,
      maxOutput: 0,
      reason: `Context budget exceeded. Input: ${inputTokens}, Available: ${available}. Need to reduce input.`
    };
  }

  const cappedOutput = Math.min(requestedOutput, available, budget.maxOutput);

  return {
    allowed: true,
    maxOutput: cappedOutput
  };
}

/**
 * Format a warning message if context usage is high
 */
export function formatBudgetWarning(inputTokens: number, budget: ContextBudget = BUDGETS.interactive): string {
  const usage = (inputTokens / budget.limit) * 100;
  if (usage > 80) {
    return `⚠️ Context usage: ${usage.toFixed(0)}% (${inputTokens}/${budget.limit} tokens)`;
  }
  return '';
}

/**
 * Truncate a response object to fit within token budget
 */
export function truncateResponse(
  data: Record<string, unknown>,
  maxTokens: number = 5000
): Record<string, unknown> & { _truncated?: boolean } {
  const json = JSON.stringify(data);
  const estimated = estimateTokens(json);

  if (estimated <= maxTokens) {
    return data;
  }

  // Progressively reduce content
  const truncated: Record<string, unknown> & { _truncated?: boolean } = { ...data };

  // 1. Limit findings array
  if (Array.isArray(truncated.findings) && truncated.findings.length > 5) {
    truncated.findings = truncated.findings.slice(0, 5);
    truncated._truncated = true;
  }

  // 2. Limit similar contracts
  if (Array.isArray(truncated.similar) && truncated.similar.length > 3) {
    truncated.similar = truncated.similar.slice(0, 3);
    truncated._truncated = true;
  }

  // 3. Truncate summaries text
  if (Array.isArray(truncated.summaries)) {
    truncated.summaries = truncated.summaries.map((s: Record<string, unknown>) => ({
      ...s,
      text: typeof s.text === 'string' && s.text.length > 500
        ? s.text.slice(0, 500) + '...[truncated]'
        : s.text
    }));
    truncated._truncated = true;
  }

  // 4. Remove scans if still too large
  if (estimateTokens(JSON.stringify(truncated)) > maxTokens && Array.isArray(truncated.scans)) {
    truncated.scans = truncated.scans.slice(0, 2);
    truncated._truncated = true;
  }

  // 5. If still too large, truncate description fields
  if (estimateTokens(JSON.stringify(truncated)) > maxTokens) {
    if (Array.isArray(truncated.findings)) {
      truncated.findings = truncated.findings.map((f: Record<string, unknown>) => ({
        ...f,
        description: typeof f.description === 'string' && f.description.length > 200
          ? f.description.slice(0, 200) + '...'
          : f.description
      }));
    }
    truncated._truncated = true;
  }

  return truncated;
}

/**
 * Get recommended max tokens for different operation types
 */
export function getRecommendedMaxTokens(operationType: 'interactive' | 'report' | 'minimal' = 'interactive'): number {
  return BUDGETS[operationType].maxOutput;
}
