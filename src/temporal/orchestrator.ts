/**
 * Orchestrator bridge — routes scan execution to either the legacy PM2/BullMQ
 * pipeline or the new Temporal workflow pipeline.
 *
 * Controlled by the ORCHESTRATOR env var:
 *   'legacy'   — use existing Scanner class (PM2 + BullMQ)
 *   'temporal'  — use Temporal workflow orchestration
 *
 * Default: 'legacy' (backward compatible)
 */

import { v4 as uuidv4 } from 'uuid';
import type { ScanWorkflowInput, ScanWorkflowResult } from './shared.js';

export type OrchestratorMode = 'legacy' | 'temporal';

/**
 * Detect which orchestrator to use.
 */
export function getOrchestratorMode(): OrchestratorMode {
  const mode = (process.env.ORCHESTRATOR ?? 'legacy').toLowerCase();
  if (mode === 'temporal') return 'temporal';
  return 'legacy';
}

/**
 * Run a scan through the Temporal orchestrator.
 * Starts the workflow and waits for the result.
 */
export async function runTemporalScan(opts: {
  contractAddress?: string;
  chain?: string;
  protocolName?: string;
  configPath?: string;
  dryRun?: boolean;
  sessionId?: string;
}): Promise<ScanWorkflowResult> {
  // Dynamic import to avoid loading Temporal SDK when in legacy mode
  const { startScan, awaitScanResult, closeClient } = await import('./client.js');

  const input: ScanWorkflowInput = {
    sessionId: opts.sessionId ?? uuidv4(),
    contractAddress: opts.contractAddress,
    chain: opts.chain,
    protocolName: opts.protocolName,
    configPath: opts.configPath,
    dryRun: opts.dryRun,
  };

  try {
    await startScan(input);
    return await awaitScanResult(input.sessionId);
  } finally {
    await closeClient();
  }
}

/**
 * Run a scan through the legacy PM2/BullMQ pipeline.
 * Uses the existing Scanner class from scanner.ts.
 */
export async function runLegacyScan(opts: {
  contractAddress?: string;
  chainId?: number;
  configPath?: string;
}): Promise<{ findingsCount: number; verifiedCount: number; errors: string[] }> {
  const { loadConfig } = await import('../config.js');
  const { Scanner } = await import('../scanner.js');

  const config = loadConfig();
  const scanner = new Scanner(config);

  try {
    if (opts.contractAddress) {
      const findings = await scanner.scanContract(opts.contractAddress, opts.chainId ?? 1);
      const verified = findings.filter(f => f.verificationStatus === 'verified').length;
      const likelyReal = findings.filter(f => f.verificationStatus === 'likely_real').length;
      return { findingsCount: findings.length, verifiedCount: verified + likelyReal, errors: [] };
    } else {
      const summary = await scanner.runFullScan();
      return {
        findingsCount: summary.totalFindings ?? 0,
        verifiedCount: summary.verifiedFindings ?? 0,
        errors: summary.errors ?? [],
      };
    }
  } finally {
    await scanner.shutdown();
  }
}
