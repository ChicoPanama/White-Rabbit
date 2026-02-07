/**
 * Temporal activities for the cascade hunt pipeline.
 *
 * Activities run in normal Node.js (not sandboxed).
 * They can import any module, do I/O, and make network calls.
 */

import { heartbeat } from '@temporalio/activity';
import type { CascadeWorkflowInput, CascadePhaseResult } from './cascade-shared.js';
import { createSession, writeDeliverable, readDeliverable } from '../deliverables-manager.js';
import { isDryRun, dryRunLog } from '../dry-run.js';
import { huntForks } from '../hunt-forks/fork-hunter.js';
import type { VulnerableContract, ForkHuntResult } from '../hunt-forks/fork-hunter.js';
import { runCascade } from '../hunt-forks/cascade-scanner.js';
import type { CascadeResult } from '../hunt-forks/cascade-scanner.js';
import { adaptPoCForForks } from '../hunt-forks/poc-adapter.js';
import type { PoCTemplate } from '../hunt-forks/poc-adapter.js';
import { extractBytecodeSignature } from '../hunt-forks/bytecode-matcher.js';
import type { Finding } from '../agents/agent-types.js';

// ── Helpers ──

function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

// ── Activity: Bytecode Extraction ──

/**
 * Extract bytecode signature from the vulnerable contract.
 */
export async function bytecodeExtractionActivity(
  input: CascadeWorkflowInput,
): Promise<CascadePhaseResult> {
  const start = Date.now();
  const deliverables: string[] = [];
  const errors: string[] = [];

  try {
    heartbeat('Extracting bytecode signature');
    createSession(input.sessionId);

    if (isDryRun()) {
      dryRunLog('bytecodeExtraction', { address: input.contractAddress, chain: input.chain });
      const mockSignature = {
        functionSelectors: ['0x12345678', '0xabcdef01'],
        normalizedHash: 'mock-hash-' + input.contractAddress.slice(0, 10),
        codeSize: 5000,
        rawBytecodeHash: 'mock-raw-hash',
      };
      writeDeliverable(input.sessionId, 'cascade', 'bytecode-signature.json', mockSignature, 'cascade-hunt');
      deliverables.push('cascade/bytecode-signature.json');

      return { phase: 'bytecode-extraction', status: 'success', duration: elapsed(start), deliverables, errors, metadata: { dryRun: true } };
    }

    // Fetch bytecode from chain using the fork hunter's internal helper
    const { fetchBytecodeFromChain } = await import('../hunt-forks/fork-hunter.js');
    const bytecode = await fetchBytecodeFromChain(input.contractAddress, input.chainId);

    if (!bytecode) {
      errors.push(`Could not fetch bytecode for ${input.contractAddress} on chain ${input.chainId}`);
      return { phase: 'bytecode-extraction', status: 'failed', duration: elapsed(start), deliverables, errors, metadata: {} };
    }

    heartbeat('Computing signature');
    const signature = extractBytecodeSignature(bytecode);

    writeDeliverable(input.sessionId, 'cascade', 'bytecode-signature.json', signature, 'cascade-hunt');
    deliverables.push('cascade/bytecode-signature.json');

    writeDeliverable(input.sessionId, 'cascade', 'raw-bytecode.txt', bytecode, 'cascade-hunt');
    deliverables.push('cascade/raw-bytecode.txt');

    return {
      phase: 'bytecode-extraction',
      status: 'success',
      duration: elapsed(start),
      deliverables,
      errors,
      metadata: {
        codeSize: signature.codeSize,
        selectorCount: signature.functionSelectors.length,
      },
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { phase: 'bytecode-extraction', status: 'failed', duration: elapsed(start), deliverables, errors, metadata: {} };
  }
}

// ── Activity: Fork Discovery ──

/**
 * Search all target chains for bytecode-similar contracts.
 */
export async function forkDiscoveryActivity(
  input: CascadeWorkflowInput,
): Promise<CascadePhaseResult> {
  const start = Date.now();
  const deliverables: string[] = [];
  const errors: string[] = [];

  try {
    heartbeat('Starting fork discovery');

    if (isDryRun()) {
      dryRunLog('forkDiscovery', { chains: input.targetChains, contractName: input.contractName });
      const mockResult = {
        totalMatches: 3,
        totalChainsSearched: 5,
        totalChainsWithMatches: 2,
        topMatches: [],
        chainResults: [],
        duration: 100,
      };
      writeDeliverable(input.sessionId, 'cascade', 'fork-discovery.json', mockResult, 'cascade-hunt');
      deliverables.push('cascade/fork-discovery.json');

      return { phase: 'fork-discovery', status: 'success', duration: elapsed(start), deliverables, errors, metadata: { totalMatches: 3, chainsSearched: 5, dryRun: true } };
    }

    const contract: VulnerableContract = {
      address: input.contractAddress,
      chain: input.chain,
      chainId: input.chainId,
      name: input.contractName,
      vulnType: input.vulnType,
      vulnTitle: input.vulnTitle,
    };

    // Read bytecode if available from previous phase
    const bytecodeDeliverable = readDeliverable<string>(input.sessionId, 'cascade', 'raw-bytecode.txt');
    if (bytecodeDeliverable?.data) {
      contract.bytecode = bytecodeDeliverable.data;
    }

    heartbeat('Searching chains for forks');

    const result = await huntForks(contract, {
      chains: input.targetChains,
      minSimilarity: input.minSimilarity,
      maxResultsPerChain: input.maxResultsPerChain,
      concurrency: 5,
    });

    heartbeat('Fork discovery complete, saving results');

    writeDeliverable(input.sessionId, 'cascade', 'fork-discovery.json', result, 'cascade-hunt');
    deliverables.push('cascade/fork-discovery.json');

    return {
      phase: 'fork-discovery',
      status: 'success',
      duration: elapsed(start),
      deliverables,
      errors,
      metadata: {
        totalMatches: result.totalMatches,
        chainsSearched: result.totalChainsSearched,
        chainsWithMatches: result.totalChainsWithMatches,
      },
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { phase: 'fork-discovery', status: 'failed', duration: elapsed(start), deliverables, errors, metadata: {} };
  }
}

// ── Activity: Cascade Verification ──

/**
 * Verify each fork match for the original vulnerability.
 */
export async function cascadeVerificationActivity(
  input: CascadeWorkflowInput,
): Promise<CascadePhaseResult> {
  const start = Date.now();
  const deliverables: string[] = [];
  const errors: string[] = [];

  try {
    heartbeat('Starting cascade verification');

    // Load fork discovery results
    const discoveryDeliverable = readDeliverable<ForkHuntResult>(
      input.sessionId, 'cascade', 'fork-discovery.json',
    );

    if (!discoveryDeliverable?.data || discoveryDeliverable.data.totalMatches === 0) {
      return { phase: 'cascade-verification', status: 'skipped', duration: elapsed(start), deliverables, errors: ['No forks to verify'], metadata: {} };
    }

    const huntResult = discoveryDeliverable.data;

    if (isDryRun()) {
      dryRunLog('cascadeVerification', { forksToVerify: huntResult.totalMatches });
      const mockResult = {
        summary: { totalForksChecked: huntResult.totalMatches, vulnerableCount: 1, patchedCount: 1, uncertainCount: 1 },
        forkResults: [],
        duration: 200,
      };
      writeDeliverable(input.sessionId, 'cascade', 'cascade-verification.json', mockResult, 'cascade-hunt');
      deliverables.push('cascade/cascade-verification.json');

      return { phase: 'cascade-verification', status: 'success', duration: elapsed(start), deliverables, errors, metadata: { vulnerableCount: 1, dryRun: true } };
    }

    const originalFinding: Finding = {
      id: `cascade-${input.sessionId}-original`,
      agentId: 'cascade-scanner',
      vulnType: input.vulnType,
      severity: 'high',
      title: input.vulnTitle,
      description: `Original vulnerability: ${input.vulnTitle}`,
      location: `${input.contractName}:unknown`,
      verified: false,
    };

    heartbeat('Verifying forks');

    const cascadeResult = await runCascade({
      originalContract: huntResult.originalContract,
      originalFinding: originalFinding,
      forkMatches: huntResult.topMatches,
    });

    heartbeat('Cascade verification complete');

    writeDeliverable(input.sessionId, 'cascade', 'cascade-verification.json', cascadeResult, 'cascade-hunt');
    deliverables.push('cascade/cascade-verification.json');

    return {
      phase: 'cascade-verification',
      status: 'success',
      duration: elapsed(start),
      deliverables,
      errors,
      metadata: {
        vulnerableCount: cascadeResult.summary.vulnerableCount,
        patchedCount: cascadeResult.summary.patchedCount,
        uncertainCount: cascadeResult.summary.uncertainCount,
        chainsAffected: cascadeResult.summary.chainsAffected.length,
      },
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { phase: 'cascade-verification', status: 'failed', duration: elapsed(start), deliverables, errors, metadata: {} };
  }
}

// ── Activity: PoC Adaptation ──

/**
 * Adapt the original PoC for each vulnerable fork.
 */
export async function pocAdaptationActivity(
  input: CascadeWorkflowInput,
): Promise<CascadePhaseResult> {
  const start = Date.now();
  const deliverables: string[] = [];
  const errors: string[] = [];

  try {
    heartbeat('Starting PoC adaptation');

    // Load cascade verification results
    const verificationDeliverable = readDeliverable<CascadeResult>(
      input.sessionId, 'cascade', 'cascade-verification.json',
    );

    if (!verificationDeliverable?.data) {
      return { phase: 'poc-adaptation', status: 'skipped', duration: elapsed(start), deliverables, errors: ['No verification results'], metadata: {} };
    }

    const cascadeResult = verificationDeliverable.data;
    const vulnerableForks = cascadeResult.forkResults.filter(r => r.status === 'vulnerable');

    if (vulnerableForks.length === 0) {
      return { phase: 'poc-adaptation', status: 'skipped', duration: elapsed(start), deliverables, errors: ['No vulnerable forks to adapt PoC for'], metadata: {} };
    }

    if (isDryRun()) {
      dryRunLog('pocAdaptation', { vulnerableForks: vulnerableForks.length });
      writeDeliverable(input.sessionId, 'cascade', 'adapted-pocs.json', [], 'cascade-hunt');
      deliverables.push('cascade/adapted-pocs.json');
      return { phase: 'poc-adaptation', status: 'success', duration: elapsed(start), deliverables, errors, metadata: { adaptedCount: 0, dryRun: true } };
    }

    // Build PoC template from original finding
    const template: PoCTemplate = {
      code: `// Placeholder PoC for ${input.vulnType} vulnerability\n// Target: ${input.contractAddress}\n`,
      vulnType: input.vulnType,
      originalAddress: input.contractAddress,
      originalChain: input.chain,
    };

    heartbeat('Adapting PoC for vulnerable forks');

    const forkMatches = vulnerableForks.map(r => r.fork);
    const adaptedPoCs = adaptPoCForForks(template, forkMatches);

    writeDeliverable(input.sessionId, 'cascade', 'adapted-pocs.json', adaptedPoCs, 'cascade-hunt');
    deliverables.push('cascade/adapted-pocs.json');

    return {
      phase: 'poc-adaptation',
      status: 'success',
      duration: elapsed(start),
      deliverables,
      errors,
      metadata: {
        adaptedCount: adaptedPoCs.length,
        averageConfidence: adaptedPoCs.length > 0
          ? Math.round(adaptedPoCs.reduce((s, p) => s + p.confidence, 0) / adaptedPoCs.length)
          : 0,
      },
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { phase: 'poc-adaptation', status: 'failed', duration: elapsed(start), deliverables, errors, metadata: {} };
  }
}

// ── Activity: Report Generation ──

/**
 * Generate the cascade hunt report.
 */
export async function cascadeReportActivity(
  input: CascadeWorkflowInput,
  phaseResults: CascadePhaseResult[],
): Promise<CascadePhaseResult> {
  const start = Date.now();
  const deliverables: string[] = [];
  const errors: string[] = [];

  try {
    heartbeat('Generating cascade report');

    // Import cascade report generator dynamically (it may not be available yet)
    let generateCascadeReport: (typeof import('../hunt-forks/cascade-report.js'))['generateCascadeReport'] | undefined;
    try {
      const mod = await import('../hunt-forks/cascade-report.js');
      generateCascadeReport = mod.generateCascadeReport;
    } catch {
      // Module not yet available — generate simple summary
    }

    // Load verification results
    const verificationDeliverable = readDeliverable<CascadeResult>(
      input.sessionId, 'cascade', 'cascade-verification.json',
    );

    // Load fork discovery results
    const discoveryDeliverable = readDeliverable<ForkHuntResult>(
      input.sessionId, 'cascade', 'fork-discovery.json',
    );

    if (generateCascadeReport && discoveryDeliverable?.data) {
      const report = generateCascadeReport({
        input,
        huntResult: discoveryDeliverable.data,
        cascadeResult: verificationDeliverable?.data ?? undefined,
        phaseResults,
      });

      writeDeliverable(input.sessionId, 'cascade', 'cascade-report.md', report.markdown, 'cascade-hunt');
      deliverables.push('cascade/cascade-report.md');

      writeDeliverable(input.sessionId, 'cascade', 'cascade-report.json', report.json, 'cascade-hunt');
      deliverables.push('cascade/cascade-report.json');
    } else {
      // Simple fallback report
      const summary = {
        sessionId: input.sessionId,
        contract: input.contractAddress,
        chain: input.chain,
        vulnType: input.vulnType,
        phases: phaseResults.map(p => ({ phase: p.phase, status: p.status })),
        generatedAt: new Date().toISOString(),
      };

      writeDeliverable(input.sessionId, 'cascade', 'cascade-report.json', summary, 'cascade-hunt');
      deliverables.push('cascade/cascade-report.json');
    }

    return {
      phase: 'report-generation',
      status: 'success',
      duration: elapsed(start),
      deliverables,
      errors,
      metadata: {},
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { phase: 'report-generation', status: 'failed', duration: elapsed(start), deliverables, errors, metadata: {} };
  }
}
