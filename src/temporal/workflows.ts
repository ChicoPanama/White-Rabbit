/**
 * Temporal workflow — orchestrates the full scan pipeline.
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

import type { PhaseResult, ScanWorkflowInput, ScanWorkflowResult, WorkflowProgress } from './shared.js';
import { SCAN_PHASES, VULN_TYPES, PROGRESS_QUERY, NON_RETRYABLE_ERROR_TYPES } from './shared.js';

// ── Activity Proxies ──

// Type-safe proxies for activities — Temporal serializes calls over the wire
const {
  discoveryActivity,
  staticAnalysisActivity,
  vulnerabilityHypothesisActivity,
  verificationActivity,
  reportActivity,
} = proxyActivities<{
  discoveryActivity: (input: ScanWorkflowInput) => Promise<PhaseResult>;
  staticAnalysisActivity: (input: ScanWorkflowInput) => Promise<PhaseResult>;
  vulnerabilityHypothesisActivity: (input: ScanWorkflowInput, vulnType: string) => Promise<PhaseResult>;
  verificationActivity: (input: ScanWorkflowInput, vulnType: string) => Promise<PhaseResult>;
  reportActivity: (input: ScanWorkflowInput, phaseResults: PhaseResult[]) => Promise<PhaseResult>;
}>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '60 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5 seconds',
    backoffCoefficient: 2,
    maximumInterval: '2 minutes',
    nonRetryableErrorTypes: [...NON_RETRYABLE_ERROR_TYPES],
  },
});

// ── Main Workflow ──

/**
 * scanWorkflow — runs the full 5-phase scanner pipeline.
 *
 * Phase 1 (discovery) → Phase 2 (static-analysis) → sequential
 * Phase 3 (vuln hypothesis per type) → parallel via Promise.allSettled
 * Phase 4 (verification per type with findings) → parallel via Promise.allSettled
 * Phase 5 (report) → sequential, collects all results
 */
export async function scanWorkflow(input: ScanWorkflowInput): Promise<ScanWorkflowResult> {
  const startMs = Date.now();
  const allResults: PhaseResult[] = [];

  // ── Progress state (queryable) ──

  const progress: WorkflowProgress = {
    currentPhase: 'initializing',
    completedPhases: [],
    startedAt: startMs,
    lastUpdate: startMs,
    findings: 0,
    errors: [],
  };

  // Register query handler
  setHandler(defineQuery<WorkflowProgress>(PROGRESS_QUERY), () => progress);

  function updateProgress(phase: string, agent?: string): void {
    progress.currentPhase = phase;
    progress.lastUpdate = Date.now();
    if (agent) progress.currentAgent = agent;
  }

  function phaseCompleted(result: PhaseResult): void {
    allResults.push(result);
    if (result.status === 'success' || result.status === 'skipped') {
      progress.completedPhases.push(result.phase);
    }
    if (result.errors.length > 0) {
      progress.errors.push(...result.errors);
    }
    const findingCount = (result.metadata.findingCount as number) ?? 0;
    progress.findings += findingCount;
    progress.lastUpdate = Date.now();
  }

  try {
    // ── Phase 1: Discovery (sequential) ──

    updateProgress('discovery', 'etherscan-client');
    const discoveryResult = await discoveryActivity(input);
    phaseCompleted(discoveryResult);

    if (discoveryResult.status === 'failed') {
      // Discovery failure is fatal — can't continue without contract source
      return buildResult(input, allResults, startMs);
    }

    // ── Phase 2: Static Analysis (sequential) ──

    updateProgress('static-analysis', 'slither');
    const staticResult = await staticAnalysisActivity(input);
    phaseCompleted(staticResult);

    if (staticResult.status === 'failed') {
      // Static analysis failure — still try report phase
      updateProgress('report', 'report-agent');
      const reportResult = await reportActivity(input, allResults);
      phaseCompleted(reportResult);
      return buildResult(input, allResults, startMs);
    }

    // ── Phase 3: Vulnerability Hypothesis (parallel per vuln type) ──

    updateProgress('vulnerability-hypothesis', 'ai-agents');
    const vulnTypes = [...VULN_TYPES];
    const hypothesisResults = await Promise.allSettled(
      vulnTypes.map(vt => vulnerabilityHypothesisActivity(input, vt))
    );

    const vulnResults: PhaseResult[] = [];
    const typesWithFindings: string[] = [];

    for (let i = 0; i < hypothesisResults.length; i++) {
      const settled = hypothesisResults[i];
      if (settled.status === 'fulfilled') {
        const result = settled.value;
        vulnResults.push(result);
        phaseCompleted(result);
        const count = (result.metadata.findingCount as number) ?? 0;
        if (count > 0) {
          typesWithFindings.push(vulnTypes[i]);
        }
      } else {
        // Activity threw a non-retryable error after all retries
        const errorMsg = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
        const failResult: PhaseResult = {
          phase: `vulnerability-hypothesis:${vulnTypes[i]}`,
          status: 'failed',
          duration: 0,
          deliverables: [],
          errors: [errorMsg],
          metadata: { vulnType: vulnTypes[i] },
        };
        vulnResults.push(failResult);
        phaseCompleted(failResult);
      }
    }

    // ── Phase 4: Verification (parallel, only types with findings) ──

    if (typesWithFindings.length > 0) {
      updateProgress('verification', 'foundry-verifier');
      const verificationResults = await Promise.allSettled(
        typesWithFindings.map(vt => verificationActivity(input, vt))
      );

      for (let i = 0; i < verificationResults.length; i++) {
        const settled = verificationResults[i];
        if (settled.status === 'fulfilled') {
          phaseCompleted(settled.value);
        } else {
          const errorMsg = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
          const failResult: PhaseResult = {
            phase: `verification:${typesWithFindings[i]}`,
            status: 'failed',
            duration: 0,
            deliverables: [],
            errors: [errorMsg],
            metadata: { vulnType: typesWithFindings[i] },
          };
          phaseCompleted(failResult);
        }
      }
    } else {
      // No findings — write skip results for verification phase
      for (const vt of vulnTypes) {
        phaseCompleted({
          phase: `verification:${vt}`,
          status: 'skipped',
          duration: 0,
          deliverables: [],
          errors: [],
          metadata: { vulnType: vt, reason: 'no findings to verify' },
        });
      }
    }

    // ── Phase 5: Report (sequential) ──

    updateProgress('report', 'report-agent');
    const reportResult = await reportActivity(input, allResults);
    phaseCompleted(reportResult);

    updateProgress('completed');
    return buildResult(input, allResults, startMs);

  } catch (err) {
    // Unexpected workflow-level error
    const msg = err instanceof Error ? err.message : String(err);
    progress.errors.push(`Workflow error: ${msg}`);
    updateProgress('failed');
    return buildResult(input, allResults, startMs);
  }
}

// ── Result Builder ──

function buildResult(
  input: ScanWorkflowInput,
  results: PhaseResult[],
  startMs: number,
): ScanWorkflowResult {
  const completedPhases = results
    .filter(r => r.status === 'success')
    .map(r => r.phase);

  const failedPhases = results
    .filter(r => r.status === 'failed')
    .map(r => r.phase);

  const totalFindings = results.reduce((sum, r) => {
    return sum + ((r.metadata.findingCount as number) ?? 0);
  }, 0);

  const totalVerified = results.reduce((sum, r) => {
    return sum + ((r.metadata.verified as number) ?? 0);
  }, 0);

  const allDeliverables = results.flatMap(r => r.deliverables);

  let status: 'completed' | 'failed' | 'partial';
  if (failedPhases.length === 0) {
    status = 'completed';
  } else if (completedPhases.length === 0) {
    status = 'failed';
  } else {
    status = 'partial';
  }

  return {
    sessionId: input.sessionId,
    status,
    phasesCompleted: completedPhases,
    phasesFailed: failedPhases,
    findingsCount: totalFindings,
    verifiedCount: totalVerified,
    duration: Date.now() - startMs,
    deliverables: allDeliverables,
  };
}
