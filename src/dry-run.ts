import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * DRY_RUN mode support.
 *
 * When DRY_RUN=true, external calls are skipped and replaced with logged
 * stubs or local fixtures. Useful for testing pipeline logic without
 * consuming API quotas or requiring network access.
 */

/** Check if dry-run mode is active */
export function isDryRun(): boolean {
  return process.env.DRY_RUN === 'true' || process.env.PIPELINE_TESTING === 'true';
}

/** Phase timing tracker */
const phaseTimings: Array<{ phase: string; startMs: number; endMs: number; durationMs: number }> = [];
let currentPhase: { phase: string; startMs: number } | null = null;

/**
 * Log a dry-run action (only when DRY_RUN is active).
 */
export function dryRunLog(category: string, message: string): void {
  if (isDryRun()) {
    console.log(`[DRY_RUN][${category}] ${message}`);
  }
}

/**
 * Mark the start of a pipeline phase for timing.
 */
export function phaseStart(phaseName: string): void {
  if (currentPhase) {
    phaseEnd();
  }
  currentPhase = { phase: phaseName, startMs: Date.now() };
  if (isDryRun()) {
    console.log(`[DRY_RUN][PHASE] >>> Entering phase: ${phaseName}`);
  }
}

/**
 * Mark the end of the current pipeline phase.
 */
export function phaseEnd(): void {
  if (currentPhase) {
    const endMs = Date.now();
    const durationMs = endMs - currentPhase.startMs;
    phaseTimings.push({
      phase: currentPhase.phase,
      startMs: currentPhase.startMs,
      endMs,
      durationMs,
    });
    if (isDryRun()) {
      console.log(`[DRY_RUN][PHASE] <<< Exiting phase: ${currentPhase.phase} (${durationMs}ms)`);
    }
    currentPhase = null;
  }
}

/**
 * Get the collected phase timings.
 */
export function getPhaseTimings(): typeof phaseTimings {
  return [...phaseTimings];
}

/**
 * Reset phase timings (for fresh runs).
 */
export function resetTimings(): void {
  phaseTimings.length = 0;
  currentPhase = null;
}

/** Fixture directory */
const FIXTURES_DIR = path.resolve(process.cwd(), 'fixtures');

/**
 * Load a fixture file. Returns null if the fixture doesn't exist.
 */
export function loadFixture(filename: string): string | null {
  const filePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Load and parse a JSON fixture. Returns null if the fixture doesn't exist.
 */
export function loadJsonFixture<T = unknown>(filename: string): T | null {
  const content = loadFixture(filename);
  if (content === null) return null;
  return JSON.parse(content) as T;
}

/**
 * Wrap an async function to skip execution in dry-run mode.
 * Returns a mock/stub value instead.
 *
 * @param name - Description of the call being wrapped
 * @param fn - The actual async function to call
 * @param stubValue - Value to return in dry-run mode
 *
 * @example
 * ```ts
 * const source = await dryRunWrap(
 *   'Etherscan.getContractSource',
 *   () => etherscan.getContractSource(chainId, address),
 *   loadJsonFixture('sample-contract-source.json'),
 * );
 * ```
 */
export async function dryRunWrap<T>(
  name: string,
  fn: () => Promise<T>,
  stubValue: T,
): Promise<T> {
  if (isDryRun()) {
    dryRunLog('SKIP', `${name} — returning stub value`);
    return stubValue;
  }
  return fn();
}

/**
 * Wrap a sync function to skip execution in dry-run mode.
 */
export function dryRunWrapSync<T>(
  name: string,
  fn: () => T,
  stubValue: T,
): T {
  if (isDryRun()) {
    dryRunLog('SKIP', `${name} — returning stub value`);
    return stubValue;
  }
  return fn();
}

/**
 * Log an AI prompt that would be sent (dry-run only).
 */
export function logAiPrompt(model: string, prompt: string): void {
  if (isDryRun()) {
    const truncated = prompt.length > 500 ? prompt.slice(0, 500) + `... (${prompt.length} chars total)` : prompt;
    dryRunLog('AI', `Would send to ${model}:\n${truncated}`);
  }
}

/**
 * Log an RPC call that would be made (dry-run only).
 */
export function logRpcCall(chain: string, method: string, params: unknown[]): void {
  if (isDryRun()) {
    dryRunLog('RPC', `Would call ${chain} ${method}(${JSON.stringify(params).slice(0, 200)})`);
  }
}

/**
 * Log an API call that would be made (dry-run only).
 */
export function logApiCall(service: string, endpoint: string, params?: Record<string, unknown>): void {
  if (isDryRun()) {
    const paramStr = params ? ` with ${JSON.stringify(params).slice(0, 200)}` : '';
    dryRunLog('API', `Would call ${service} ${endpoint}${paramStr}`);
  }
}

/**
 * Print a summary of the dry-run execution.
 */
export function printDryRunSummary(deliverableCount: number): void {
  if (!isDryRun()) return;

  console.log('\n' + '='.repeat(60));
  console.log('DRY RUN SUMMARY');
  console.log('='.repeat(60));

  console.log('\nPhase Timings:');
  let totalMs = 0;
  for (const t of phaseTimings) {
    console.log(`  ${t.phase.padEnd(30)} ${t.durationMs}ms`);
    totalMs += t.durationMs;
  }
  console.log(`  ${'TOTAL'.padEnd(30)} ${totalMs}ms`);

  console.log(`\nDeliverables created: ${deliverableCount}`);
  console.log('External calls made: 0 (all stubbed)');
  console.log('AI API calls made: 0 (all logged)');
  console.log('RPC calls made: 0 (all logged)');
  console.log('='.repeat(60));
}
