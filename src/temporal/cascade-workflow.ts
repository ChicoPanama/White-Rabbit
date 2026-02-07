/**
 * Temporal workflow — orchestrates the cascade hunt pipeline.
 *
 * IMPORTANT: This file runs inside a sandboxed V8 isolate.
 * It CANNOT import Node.js built-ins (fs, path, crypto, etc.).
 * Only Temporal workflow APIs and pure-TS modules are allowed.
 */

import {
  proxyActivities,
  defineQuery,
  setHandler,
  sleep,
  ApplicationFailure,
} from '@temporalio/workflow';

import type {
  CascadeWorkflowInput,
  CascadeWorkflowResult,
  CascadePhaseResult,
  CascadeProgress,
} from './cascade-shared.js';
import {
  CASCADE_PHASES,
  CASCADE_PROGRESS_QUERY,
} from './cascade-shared.js';
import { NON_RETRYABLE_ERROR_TYPES } from './shared.js';

// ── Activity Proxies ──

const {
  bytecodeExtractionActivity,
  forkDiscoveryActivity,
  cascadeVerificationActivity,
  pocAdaptationActivity,
  cascadeReportActivity,
} = proxyActivities<{
  bytecodeExtractionActivity: (input: CascadeWorkflowInput) => Promise<CascadePhaseResult>;
  forkDiscoveryActivity: (input: CascadeWorkflowInput) => Promise<CascadePhaseResult>;
  cascadeVerificationActivity: (input: CascadeWorkflowInput) => Promise<CascadePhaseResult>;
  pocAdaptationActivity: (input: CascadeWorkflowInput) => Promise<CascadePhaseResult>;
  cascadeReportActivity: (input: CascadeWorkflowInput, phaseResults: CascadePhaseResult[]) => Promise<CascadePhaseResult>;
}>({
  startToCloseTimeout: '15 minutes',
  heartbeatTimeout: '60 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5 seconds',
    backoffCoefficient: 2,
    maximumInterval: '2 minutes',
    nonRetryableErrorTypes: [...NON_RETRYABLE_ERROR_TYPES],
  },
});

// ── Query Handler ──

const progressQuery = defineQuery<CascadeProgress>(CASCADE_PROGRESS_QUERY);

// ── Main Workflow ──

/**
 * Cascade hunt workflow — finds and verifies forks across chains.
 *
 * Phases:
 * 1. Bytecode extraction — fetch original contract bytecode
 * 2. Fork discovery — search all target chains for similar bytecode
 * 3. Cascade verification — verify each fork for the original vuln
 * 4. PoC adaptation — adapt PoC for each vulnerable fork
 * 5. Report generation — create cross-chain report
 */
export async function cascadeHuntWorkflow(
  input: CascadeWorkflowInput,
): Promise<CascadeWorkflowResult> {
  const startTime = Date.now();

  // Mutable progress state (queryable)
  const progress: CascadeProgress = {
    currentPhase: CASCADE_PHASES[0],
    completedPhases: [],
    startedAt: startTime,
    lastUpdate: startTime,
    forksFound: 0,
    vulnerableForksFound: 0,
    chainsSearched: 0,
    errors: [],
  };

  // Register query handler
  setHandler(progressQuery, () => progress);

  const phaseResults: CascadePhaseResult[] = [];
  const phasesCompleted: string[] = [];
  const phasesFailed: string[] = [];
  let deliverables: string[] = [];

  // Phase 1: Bytecode extraction
  progress.currentPhase = 'bytecode-extraction';
  progress.lastUpdate = Date.now();

  let bytecodeResult: CascadePhaseResult;
  try {
    bytecodeResult = await bytecodeExtractionActivity(input);
    phaseResults.push(bytecodeResult);

    if (bytecodeResult.status === 'success') {
      phasesCompleted.push('bytecode-extraction');
      progress.completedPhases.push('bytecode-extraction');
      deliverables.push(...bytecodeResult.deliverables);
    } else {
      phasesFailed.push('bytecode-extraction');
      progress.errors.push(...bytecodeResult.errors);
      // Can't continue without bytecode
      return buildResult(input, phasesCompleted, phasesFailed, progress, deliverables, startTime);
    }
  } catch (err) {
    phasesFailed.push('bytecode-extraction');
    const errMsg = err instanceof Error ? err.message : String(err);
    progress.errors.push(`Bytecode extraction failed: ${errMsg}`);
    return buildResult(input, phasesCompleted, phasesFailed, progress, deliverables, startTime);
  }

  // Phase 2: Fork discovery
  progress.currentPhase = 'fork-discovery';
  progress.lastUpdate = Date.now();

  let discoveryResult: CascadePhaseResult;
  try {
    discoveryResult = await forkDiscoveryActivity(input);
    phaseResults.push(discoveryResult);

    if (discoveryResult.status === 'success') {
      phasesCompleted.push('fork-discovery');
      progress.completedPhases.push('fork-discovery');
      progress.forksFound = (discoveryResult.metadata.totalMatches as number) ?? 0;
      progress.chainsSearched = (discoveryResult.metadata.chainsSearched as number) ?? 0;
      deliverables.push(...discoveryResult.deliverables);
    } else {
      phasesFailed.push('fork-discovery');
      progress.errors.push(...discoveryResult.errors);
    }
  } catch (err) {
    phasesFailed.push('fork-discovery');
    const errMsg = err instanceof Error ? err.message : String(err);
    progress.errors.push(`Fork discovery failed: ${errMsg}`);
  }

  // Short delay to avoid rate limiting between phases
  await sleep('2 seconds');

  // Phase 3: Cascade verification (only if forks were found)
  if (progress.forksFound > 0) {
    progress.currentPhase = 'cascade-verification';
    progress.lastUpdate = Date.now();

    try {
      const verifyResult = await cascadeVerificationActivity(input);
      phaseResults.push(verifyResult);

      if (verifyResult.status === 'success') {
        phasesCompleted.push('cascade-verification');
        progress.completedPhases.push('cascade-verification');
        progress.vulnerableForksFound = (verifyResult.metadata.vulnerableCount as number) ?? 0;
        deliverables.push(...verifyResult.deliverables);
      } else {
        phasesFailed.push('cascade-verification');
        progress.errors.push(...verifyResult.errors);
      }
    } catch (err) {
      phasesFailed.push('cascade-verification');
      const errMsg = err instanceof Error ? err.message : String(err);
      progress.errors.push(`Cascade verification failed: ${errMsg}`);
    }

    // Phase 4: PoC adaptation (only if vulnerable forks were found)
    if (progress.vulnerableForksFound > 0) {
      progress.currentPhase = 'poc-adaptation';
      progress.lastUpdate = Date.now();

      try {
        const pocResult = await pocAdaptationActivity(input);
        phaseResults.push(pocResult);

        if (pocResult.status === 'success') {
          phasesCompleted.push('poc-adaptation');
          progress.completedPhases.push('poc-adaptation');
          deliverables.push(...pocResult.deliverables);
        } else {
          phasesFailed.push('poc-adaptation');
          progress.errors.push(...pocResult.errors);
        }
      } catch (err) {
        phasesFailed.push('poc-adaptation');
        const errMsg = err instanceof Error ? err.message : String(err);
        progress.errors.push(`PoC adaptation failed: ${errMsg}`);
      }
    }
  }

  // Phase 5: Report generation (always runs if we have any results)
  progress.currentPhase = 'report-generation';
  progress.lastUpdate = Date.now();

  try {
    const reportResult = await cascadeReportActivity(input, phaseResults);
    phaseResults.push(reportResult);

    if (reportResult.status === 'success') {
      phasesCompleted.push('report-generation');
      progress.completedPhases.push('report-generation');
      deliverables.push(...reportResult.deliverables);
    } else {
      phasesFailed.push('report-generation');
      progress.errors.push(...reportResult.errors);
    }
  } catch (err) {
    phasesFailed.push('report-generation');
    const errMsg = err instanceof Error ? err.message : String(err);
    progress.errors.push(`Report generation failed: ${errMsg}`);
  }

  return buildResult(input, phasesCompleted, phasesFailed, progress, deliverables, startTime);
}

// ── Helpers ──

function buildResult(
  input: CascadeWorkflowInput,
  phasesCompleted: string[],
  phasesFailed: string[],
  progress: CascadeProgress,
  deliverables: string[],
  startTime: number,
): CascadeWorkflowResult {
  const status = phasesFailed.length === 0
    ? 'completed'
    : phasesCompleted.length > 0
      ? 'partial'
      : 'failed';

  return {
    sessionId: input.sessionId,
    status,
    phasesCompleted,
    phasesFailed,
    totalForksFound: progress.forksFound,
    vulnerableForksFound: progress.vulnerableForksFound,
    chainsSearched: progress.chainsSearched,
    chainsAffected: 0, // Filled by report phase
    duration: Date.now() - startTime,
    deliverables,
  };
}
