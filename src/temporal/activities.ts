/**
 * Temporal activities — each maps to a scanner pipeline phase.
 *
 * Activities run in the normal Node.js environment (not sandboxed).
 * They can import any module, do I/O, and make network calls.
 * Each activity calls heartbeat() periodically during long operations
 * so Temporal knows the activity is still alive.
 */

import { heartbeat, activityInfo } from '@temporalio/activity';
import type { ScanWorkflowInput, PhaseResult, VulnType } from './shared.js';
import { VULN_TYPES } from './shared.js';
import { loadScanConfig, type ScanConfig } from '../config-parser.js';
import { createSession, writeDeliverable, readDeliverable, listDeliverables, getSessionDir } from '../deliverables-manager.js';
import { setDeliverableBaseDir, validatePhasePrerequisites } from '../queue-validation.js';
import { loadPrompt } from '../prompt-manager.js';
import { isDryRun, dryRunLog, logAiPrompt, logApiCall, loadJsonFixture } from '../dry-run.js';

// ── Error Types ──

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ── Helpers ──

function resolveSessionDir(sessionId: string): void {
  const dir = getSessionDir(sessionId);
  setDeliverableBaseDir(dir);
}

function loadConfig(input: ScanWorkflowInput): ScanConfig {
  try {
    return loadScanConfig(input.configPath);
  } catch (err) {
    throw new ConfigError(
      `Failed to load config: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

// ── Activity 1: Discovery ──

/**
 * Discovery phase — fetches contract source and gathers protocol metadata.
 */
export async function discoveryActivity(input: ScanWorkflowInput): Promise<PhaseResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  const deliverables: string[] = [];

  console.log(`[Activity:discovery] Starting for session ${input.sessionId}`);
  resolveSessionDir(input.sessionId);

  try {
    const config = loadConfig(input);
    heartbeat();

    const chain = input.chain ?? config.target.chain ?? 'ethereum';
    const address = input.contractAddress ?? config.target.contract_address;

    if (!address) {
      throw new ValidationError('No contract address specified in input or config');
    }

    // Fetch contract source
    let contractSource: Record<string, unknown>;
    if (input.dryRun) {
      logApiCall('Etherscan', 'getContractSource', { chain, address });
      contractSource = loadJsonFixture('sample-contract-source.json') ?? {
        name: 'DryRunContract', sourceCode: '// dry run', compilerVersion: '0.8.19',
        isProxy: false, implementationAddress: null,
      };
    } else {
      // In production, this would call EtherscanClient
      // For now we write a placeholder — the real scanner integration happens in Task 7
      contractSource = {
        name: input.protocolName ?? 'Unknown',
        sourceCode: '', compilerVersion: '', isProxy: false,
        implementationAddress: null,
      };
    }

    heartbeat();

    // Write discovery deliverables
    writeDeliverable(input.sessionId, 'discovery', 'contract-source.json', {
      address, chain, ...contractSource,
      sourceLength: (contractSource.sourceCode as string)?.length ?? 0,
    }, 'discovery-activity');
    deliverables.push('discovery/contract-source.json');

    writeDeliverable(input.sessionId, 'discovery', 'protocol-metadata.json', {
      address, chain,
      protocolName: input.protocolName ?? contractSource.name ?? 'Unknown',
      configPath: input.configPath,
    }, 'discovery-activity');
    deliverables.push('discovery/protocol-metadata.json');

    heartbeat();

    console.log(`[Activity:discovery] Completed in ${elapsed(startMs)}ms`);

    return {
      phase: 'discovery',
      status: 'success',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: { chain, address, contractName: contractSource.name },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Activity:discovery] Failed: ${msg}`);
    errors.push(msg);
    // Re-throw ConfigError/ValidationError as non-retryable
    if (err instanceof ConfigError || err instanceof ValidationError) throw err;
    return {
      phase: 'discovery',
      status: 'failed',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: {},
    };
  }
}

// ── Activity 2: Static Analysis ──

/**
 * Static analysis phase — runs Slither and pattern matching.
 */
export async function staticAnalysisActivity(input: ScanWorkflowInput): Promise<PhaseResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  const deliverables: string[] = [];

  console.log(`[Activity:static-analysis] Starting for session ${input.sessionId}`);
  resolveSessionDir(input.sessionId);

  try {
    // Validate prerequisites
    const validation = validatePhasePrerequisites('static-analysis');
    if (!validation.valid) {
      throw new ValidationError(
        `Missing discovery deliverables: ${validation.missingDeliverables.join(', ')}`
      );
    }
    heartbeat();

    // Read contract source from discovery phase
    const contractDeliverable = readDeliverable<Record<string, unknown>>(
      input.sessionId, 'discovery', 'contract-source.json'
    );
    const contractData = contractDeliverable?.data ?? {};

    let slitherFindings: unknown[];
    if (input.dryRun) {
      dryRunLog('Slither', 'Would run static analysis on contract');
      const fixture = loadJsonFixture<{ findings: unknown[] }>('sample-slither-output.json');
      slitherFindings = fixture?.findings ?? [];
    } else {
      // Placeholder — real Slither integration is in scanner.ts
      slitherFindings = [];
    }

    heartbeat();

    // Write Slither report deliverable
    writeDeliverable(input.sessionId, 'static-analysis', 'slither-report.json', {
      findingCount: slitherFindings.length,
      findings: slitherFindings,
      contractName: contractData.name,
    }, 'slither');
    deliverables.push('static-analysis/slither-report.json');

    // Write pattern matches deliverable
    writeDeliverable(input.sessionId, 'static-analysis', 'pattern-matches.json', {
      totalPatterns: 0,
      matches: [],
    }, 'pattern-matcher');
    deliverables.push('static-analysis/pattern-matches.json');

    heartbeat();

    console.log(`[Activity:static-analysis] Found ${slitherFindings.length} raw findings in ${elapsed(startMs)}ms`);

    return {
      phase: 'static-analysis',
      status: 'success',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: { findingCount: slitherFindings.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Activity:static-analysis] Failed: ${msg}`);
    errors.push(msg);
    if (err instanceof ConfigError || err instanceof ValidationError) throw err;
    return {
      phase: 'static-analysis',
      status: 'failed',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: {},
    };
  }
}

// ── Activity 3: Vulnerability Hypothesis ──

/**
 * Vulnerability hypothesis phase — runs AI analysis for a specific vulnerability type.
 * Called once per vuln type (parallel execution from workflow).
 */
export async function vulnerabilityHypothesisActivity(
  input: ScanWorkflowInput,
  vulnType: string,
): Promise<PhaseResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  const deliverables: string[] = [];
  const filename = `vuln-${vulnType}-report.json`;

  console.log(`[Activity:vuln-${vulnType}] Starting for session ${input.sessionId}`);
  resolveSessionDir(input.sessionId);

  try {
    // Validate static analysis exists
    const validation = validatePhasePrerequisites('vulnerability-hypothesis');
    if (!validation.valid) {
      throw new ValidationError(
        `Missing static analysis deliverables: ${validation.missingDeliverables.join(', ')}`
      );
    }
    heartbeat();

    // Read contract source and slither output
    const contractDeliverable = readDeliverable<Record<string, unknown>>(
      input.sessionId, 'discovery', 'contract-source.json'
    );
    const slitherDeliverable = readDeliverable<{ findings: unknown[] }>(
      input.sessionId, 'static-analysis', 'slither-report.json'
    );

    const sourceCode = String(contractDeliverable?.data?.sourceCode ?? '');
    const slitherFindings = slitherDeliverable?.data?.findings ?? [];

    // Load the appropriate prompt template
    const templateName = `vuln-${vulnType}`;
    let prompt: string;
    try {
      const vars: Record<string, string> = { CONTRACT_SOURCE: sourceCode };

      // Each vuln type has different required variables
      switch (vulnType) {
        case 'arithmetic':
          vars.SOLIDITY_VERSION = String(contractDeliverable?.data?.compilerVersion ?? 'unknown');
          vars.SLITHER_OUTPUT = JSON.stringify(slitherFindings.slice(0, 20));
          break;
        case 'reentrancy':
          vars.EXTERNAL_CALLS = JSON.stringify(
            slitherFindings.filter((f: any) => f?.detectorName?.includes('reentrancy'))
          );
          break;
        case 'access-control':
          vars.ADMIN_FUNCTIONS = JSON.stringify(
            slitherFindings.filter((f: any) => f?.detectorName?.includes('access') || f?.detectorName?.includes('owner'))
          );
          break;
        case 'oracle':
          vars.ORACLE_DEPENDENCIES = JSON.stringify(
            slitherFindings.filter((f: any) => f?.detectorName?.includes('oracle') || f?.detectorName?.includes('price'))
          );
          break;
        case 'flash-loan':
          vars.TVL = String(contractDeliverable?.data?.tvl ?? 'unknown');
          break;
        case 'logic':
          vars.PROTOCOL_TYPE = String(contractDeliverable?.data?.protocolType ?? 'Unknown DeFi protocol');
          break;
      }

      prompt = loadPrompt(templateName, vars);
    } catch {
      // Template missing — not fatal, skip this vuln type
      console.log(`[Activity:vuln-${vulnType}] Template ${templateName} not found, skipping`);
      writeDeliverable(input.sessionId, 'vulnerability-hypothesis', filename, {
        vulnType, findingCount: 0, findings: [], skipped: true, reason: 'template not found',
      }, `vuln-${vulnType}`);
      deliverables.push(`vulnerability-hypothesis/${filename}`);
      return {
        phase: `vulnerability-hypothesis:${vulnType}`,
        status: 'skipped',
        duration: elapsed(startMs),
        deliverables,
        errors: [],
        metadata: { vulnType, reason: 'template not found' },
      };
    }

    heartbeat();

    // Send to AI for analysis
    let aiFindings: unknown[] = [];
    if (input.dryRun) {
      logAiPrompt(vulnType, prompt);
    } else {
      // Placeholder — real AI integration connects via config's provider
      // The AI call would use loadConfig(input).ai settings
      aiFindings = [];
    }

    heartbeat();

    // Write vuln report deliverable
    writeDeliverable(input.sessionId, 'vulnerability-hypothesis', filename, {
      vulnType,
      findingCount: aiFindings.length,
      findings: aiFindings,
      promptLength: prompt.length,
    }, `vuln-${vulnType}`);
    deliverables.push(`vulnerability-hypothesis/${filename}`);

    console.log(`[Activity:vuln-${vulnType}] Completed with ${aiFindings.length} findings in ${elapsed(startMs)}ms`);

    return {
      phase: `vulnerability-hypothesis:${vulnType}`,
      status: 'success',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: { vulnType, findingCount: aiFindings.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Activity:vuln-${vulnType}] Failed: ${msg}`);
    errors.push(msg);
    if (err instanceof ConfigError || err instanceof ValidationError) throw err;

    // Write empty report so downstream phases don't block
    try {
      writeDeliverable(input.sessionId, 'vulnerability-hypothesis', filename, {
        vulnType, findingCount: 0, findings: [], error: msg,
      }, `vuln-${vulnType}`);
      deliverables.push(`vulnerability-hypothesis/${filename}`);
    } catch { /* ignore write failures */ }

    return {
      phase: `vulnerability-hypothesis:${vulnType}`,
      status: 'failed',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: { vulnType },
    };
  }
}

// ── Activity 4: Verification ──

/**
 * Verification phase — runs PoC verification for a specific vulnerability type.
 * Called once per vuln type that had findings in Phase 3.
 */
export async function verificationActivity(
  input: ScanWorkflowInput,
  vulnType: string,
): Promise<PhaseResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  const deliverables: string[] = [];
  const inputFile = `vuln-${vulnType}-report.json`;
  const outputFile = `verification-${vulnType}-result.json`;

  console.log(`[Activity:verify-${vulnType}] Starting for session ${input.sessionId}`);
  resolveSessionDir(input.sessionId);

  try {
    // Read vuln hypothesis report
    const vulnReport = readDeliverable<{ findingCount: number; findings: unknown[]; skipped?: boolean }>(
      input.sessionId, 'vulnerability-hypothesis', inputFile
    );

    // Skip if no findings or hypothesis was skipped
    if (!vulnReport?.data || vulnReport.data.findingCount === 0 || vulnReport.data.skipped) {
      console.log(`[Activity:verify-${vulnType}] No findings to verify, skipping`);
      writeDeliverable(input.sessionId, 'verification', outputFile, {
        vulnType, verified: 0, findings: [], skipped: true,
      }, `verify-${vulnType}`);
      deliverables.push(`verification/${outputFile}`);
      return {
        phase: `verification:${vulnType}`,
        status: 'skipped',
        duration: elapsed(startMs),
        deliverables,
        errors: [],
        metadata: { vulnType, reason: 'no findings to verify' },
      };
    }

    heartbeat();

    const config = loadConfig(input);
    const findings = vulnReport.data.findings ?? [];
    let verifiedFindings: unknown[] = [];

    if (input.dryRun) {
      dryRunLog('Foundry', `Would verify ${findings.length} ${vulnType} findings`);
      dryRunLog('Foundry', `RPC: ${config.verification.mainnet_rpc || 'not configured'}`);
      dryRunLog('Foundry', `Gas limit: ${config.verification.gas_limit}`);
    } else if (config.verification.foundry_fork && config.verification.mainnet_rpc) {
      // Placeholder — real Foundry verification connects through verifier.ts
      verifiedFindings = [];
    }

    heartbeat();

    // Write verification result
    writeDeliverable(input.sessionId, 'verification', outputFile, {
      vulnType,
      verified: verifiedFindings.length,
      totalChecked: findings.length,
      findings: verifiedFindings,
      foundryEnabled: config.verification.foundry_fork,
      rpcConfigured: !!config.verification.mainnet_rpc,
    }, `verify-${vulnType}`);
    deliverables.push(`verification/${outputFile}`);

    console.log(`[Activity:verify-${vulnType}] Verified ${verifiedFindings.length}/${findings.length} in ${elapsed(startMs)}ms`);

    return {
      phase: `verification:${vulnType}`,
      status: 'success',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: { vulnType, verified: verifiedFindings.length, checked: findings.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Activity:verify-${vulnType}] Failed: ${msg}`);
    errors.push(msg);
    if (err instanceof ConfigError || err instanceof ValidationError) throw err;

    // Write empty result so report phase doesn't block
    try {
      writeDeliverable(input.sessionId, 'verification', outputFile, {
        vulnType, verified: 0, findings: [], error: msg,
      }, `verify-${vulnType}`);
      deliverables.push(`verification/${outputFile}`);
    } catch { /* ignore write failures */ }

    return {
      phase: `verification:${vulnType}`,
      status: 'failed',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: { vulnType },
    };
  }
}

// ── Activity 5: Report ──

/**
 * Report phase — collects all verified findings and generates the final report.
 */
export async function reportActivity(
  input: ScanWorkflowInput,
  phaseResults: PhaseResult[],
): Promise<PhaseResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  const deliverables: string[] = [];

  console.log(`[Activity:report] Starting for session ${input.sessionId}`);
  resolveSessionDir(input.sessionId);

  try {
    // Collect findings from all verification deliverables
    const allVerified: Array<{ vulnType: string; findings: unknown[] }> = [];
    let totalVerified = 0;

    for (const vulnType of VULN_TYPES) {
      const result = readDeliverable<{ vulnType: string; verified: number; findings: unknown[] }>(
        input.sessionId, 'verification', `verification-${vulnType}-result.json`
      );
      if (result?.data?.verified && result.data.verified > 0) {
        allVerified.push({ vulnType, findings: result.data.findings });
        totalVerified += result.data.verified;
      }
    }

    heartbeat();

    // Load report template
    let reportContent: string;
    if (totalVerified > 0 && !input.dryRun) {
      try {
        const prompt = loadPrompt('report-immunefi', {
          FINDINGS: JSON.stringify(allVerified),
          PROTOCOL_NAME: input.protocolName ?? 'Unknown',
          CONTRACT_ADDRESS: input.contractAddress ?? '',
        });
        // AI call would go here to format report
        reportContent = prompt; // Placeholder — use raw prompt as report draft
      } catch {
        reportContent = '# Scan Report\n\nReport template not available.';
      }
    } else {
      // Build summary report
      const completedPhases = phaseResults.filter(r => r.status === 'success').map(r => r.phase);
      const failedPhases = phaseResults.filter(r => r.status === 'failed').map(r => r.phase);

      reportContent = [
        `# Scan Report`,
        ``,
        `**Session:** ${input.sessionId}`,
        `**Contract:** ${input.contractAddress ?? 'N/A'}`,
        `**Chain:** ${input.chain ?? 'N/A'}`,
        `**Dry Run:** ${input.dryRun ? 'Yes' : 'No'}`,
        `**Timestamp:** ${new Date().toISOString()}`,
        ``,
        `## Pipeline Summary`,
        `- Phases completed: ${completedPhases.length}`,
        `- Phases failed: ${failedPhases.length}`,
        `- Verified findings: ${totalVerified}`,
        ``,
        `## Phase Results`,
        ...phaseResults.map(r =>
          `- **${r.phase}**: ${r.status} (${r.duration}ms)${r.errors.length > 0 ? ` — ${r.errors[0]}` : ''}`
        ),
        ``,
        totalVerified > 0
          ? `## Verified Findings\n${allVerified.map(v => `### ${v.vulnType}\n${JSON.stringify(v.findings, null, 2)}`).join('\n')}`
          : `## No Verified Findings\nNo exploitable vulnerabilities were confirmed in this scan.`,
      ].join('\n');
    }

    heartbeat();

    // Write final report
    writeDeliverable(input.sessionId, 'report', 'final-report.md', reportContent, 'report-agent');
    deliverables.push('report/final-report.md');

    console.log(`[Activity:report] Generated report with ${totalVerified} verified findings in ${elapsed(startMs)}ms`);

    return {
      phase: 'report',
      status: 'success',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: { totalVerified, vulnTypes: allVerified.map(v => v.vulnType) },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Activity:report] Failed: ${msg}`);
    errors.push(msg);
    return {
      phase: 'report',
      status: 'failed',
      duration: elapsed(startMs),
      deliverables,
      errors,
      metadata: {},
    };
  }
}
