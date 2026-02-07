/**
 * Slither tool — wraps the Slither static analyzer CLI.
 */

import { execSync } from 'node:child_process';
import type { ToolResult } from '../agent-types.js';
import { isDryRun, dryRunLog, loadJsonFixture } from '../../dry-run.js';

/**
 * Check if Slither is installed and available.
 */
export function isAvailable(): boolean {
  try {
    execSync('slither --version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Slither analysis on contract source.
 */
export async function execute(params: Record<string, unknown>): Promise<ToolResult> {
  const startMs = Date.now();
  const sourcePath = String(params.sourcePath ?? '');

  if (isDryRun()) {
    dryRunLog('Slither', `Would analyze: ${sourcePath}`);
    const fixture = loadJsonFixture('sample-slither-output.json');
    return {
      tool: 'slither',
      success: true,
      data: fixture ?? { findings: [] },
      duration: Date.now() - startMs,
    };
  }

  try {
    const output = execSync(
      `slither ${sourcePath} --json -`,
      { timeout: 300_000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(output.toString());
    return {
      tool: 'slither',
      success: true,
      data: parsed,
      duration: Date.now() - startMs,
    };
  } catch (err) {
    return {
      tool: 'slither',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startMs,
    };
  }
}
