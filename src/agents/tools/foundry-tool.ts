/**
 * Foundry tool — wraps the forge CLI for PoC verification on forked mainnet.
 */

import { execSync } from 'node:child_process';
import type { ToolResult } from '../agent-types.js';
import { isDryRun, dryRunLog } from '../../dry-run.js';

/**
 * Check if Foundry (forge) is installed and available.
 */
export function isAvailable(): boolean {
  try {
    execSync('forge --version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a Foundry fork test for PoC verification.
 */
export async function execute(params: Record<string, unknown>): Promise<ToolResult> {
  const startMs = Date.now();
  const testContract = String(params.testContract ?? '');
  const rpcUrl = String(params.rpcUrl ?? '');
  const gasLimit = Number(params.gasLimit ?? 8_000_000);

  if (isDryRun()) {
    dryRunLog('Foundry', `Would run fork test: ${testContract} against ${rpcUrl}`);
    return {
      tool: 'foundry',
      success: true,
      data: { testsPassed: 0, testsFailed: 0, output: 'DRY_RUN' },
      duration: Date.now() - startMs,
    };
  }

  if (!rpcUrl) {
    return {
      tool: 'foundry',
      success: false,
      data: null,
      error: 'No RPC URL configured for fork testing',
      duration: Date.now() - startMs,
    };
  }

  try {
    const output = execSync(
      `forge test --match-contract "${testContract}" --fork-url "${rpcUrl}" --gas-limit ${gasLimit} --json`,
      { timeout: 600_000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(output.toString());
    return {
      tool: 'foundry',
      success: true,
      data: parsed,
      duration: Date.now() - startMs,
    };
  } catch (err) {
    return {
      tool: 'foundry',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startMs,
    };
  }
}
