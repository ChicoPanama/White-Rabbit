/**
 * AI Cost Tracker - Enforces hourly/daily budget limits for AI API calls.
 *
 * Tracks per-model call counts and estimated spend. Provides a gate
 * (canMakeAiCall) that the AI analyzer checks before each request.
 */

export interface CostRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  timestamp: number;
}

export interface CostSummary {
  hourCalls: number;
  hourSpend: number;
  dayCalls: number;
  daySpend: number;
  totalCalls: number;
  totalSpend: number;
}

// Approximate per-token costs (USD) as of 2025
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-20250414': { input: 0.80 / 1_000_000, output: 4.0 / 1_000_000 },
  'claude-sonnet-4-20250514': { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
};

const DEFAULT_COST = { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 };

export class CostTracker {
  private records: CostRecord[] = [];
  private maxCallsPerHour: number;
  private maxSpendPerDay: number;

  constructor(maxCallsPerHour: number, maxSpendPerDay: number) {
    this.maxCallsPerHour = maxCallsPerHour;
    this.maxSpendPerDay = maxSpendPerDay;
  }

  /**
   * Check whether we're within budget for another AI call.
   */
  canMakeAiCall(): { allowed: boolean; reason?: string } {
    this.pruneOldRecords();

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const hourRecords = this.records.filter(r => r.timestamp >= oneHourAgo);
    const dayRecords = this.records.filter(r => r.timestamp >= oneDayAgo);

    const hourCalls = hourRecords.length;
    const daySpend = dayRecords.reduce((sum, r) => sum + r.estimatedCost, 0);

    if (hourCalls >= this.maxCallsPerHour) {
      return { allowed: false, reason: `Hourly call limit reached (${hourCalls}/${this.maxCallsPerHour})` };
    }

    if (daySpend >= this.maxSpendPerDay) {
      return { allowed: false, reason: `Daily spend limit reached ($${daySpend.toFixed(4)}/$${this.maxSpendPerDay.toFixed(2)})` };
    }

    return { allowed: true };
  }

  /**
   * Record a completed AI call for tracking.
   */
  recordCall(model: string, inputTokens: number, outputTokens: number): void {
    const costs = MODEL_COSTS[model] ?? DEFAULT_COST;
    const estimatedCost = (inputTokens * costs.input) + (outputTokens * costs.output);

    this.records.push({
      model,
      inputTokens,
      outputTokens,
      estimatedCost,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current cost summary.
   */
  getSummary(): CostSummary {
    this.pruneOldRecords();

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const hourRecords = this.records.filter(r => r.timestamp >= oneHourAgo);
    const dayRecords = this.records.filter(r => r.timestamp >= oneDayAgo);

    return {
      hourCalls: hourRecords.length,
      hourSpend: hourRecords.reduce((sum, r) => sum + r.estimatedCost, 0),
      dayCalls: dayRecords.length,
      daySpend: dayRecords.reduce((sum, r) => sum + r.estimatedCost, 0),
      totalCalls: this.records.length,
      totalSpend: this.records.reduce((sum, r) => sum + r.estimatedCost, 0),
    };
  }

  /**
   * Estimate cost for a given model and token counts.
   */
  static estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs = MODEL_COSTS[model] ?? DEFAULT_COST;
    return (inputTokens * costs.input) + (outputTokens * costs.output);
  }

  /**
   * Drop records older than 24 hours to prevent unbounded growth.
   */
  private pruneOldRecords(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.records = this.records.filter(r => r.timestamp >= oneDayAgo);
  }
}
