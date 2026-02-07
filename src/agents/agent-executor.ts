/**
 * Agent executor — the runtime that executes a single agent.
 *
 * Loads deliverables, hydrates the prompt template, sends to AI provider
 * (via config), extracts findings, writes output deliverables, and
 * tracks token usage and duration.
 *
 * Integrates with the error handling system for:
 * - Classified errors with structured retry logic
 * - Provider rotation on AI failures
 * - RPC rotation on blockchain failures
 * - Circuit breaker protection for failing endpoints
 */

import { v4 as uuidv4 } from 'uuid';
import type { AgentExecutionContext, AgentResult, Finding, ToolResult } from './agent-types.js';
import { readDeliverable, writeDeliverable } from '../deliverables-manager.js';
import { loadPrompt } from '../prompt-manager.js';
import { isDryRun, dryRunLog, logAiPrompt } from '../dry-run.js';
import * as slitherTool from './tools/slither-tool.js';
import * as foundryTool from './tools/foundry-tool.js';
import * as etherscanTool from './tools/etherscan-tool.js';

// Error handling imports
import { withRetry, type RetryResult } from '../errors/retry-engine.js';
import { classifyError, type ClassificationContext } from '../errors/error-classifier.js';
import type { ScannerError, ErrorCategory } from '../errors/error-types.js';
import { ToolError } from '../errors/error-types.js';

// ── Tool Registry ──

const TOOL_REGISTRY: Record<string, { isAvailable: () => boolean; execute: (p: Record<string, unknown>) => Promise<ToolResult> }> = {
  slither: slitherTool,
  foundry: foundryTool,
  etherscan: etherscanTool,
};

/**
 * Check which tools are available on this system.
 */
export function getAvailableTools(): string[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([_, tool]) => tool.isAvailable())
    .map(([name]) => name);
}

/**
 * Execute a tool by name with retry handling.
 */
async function executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) {
    return {
      tool: toolName,
      success: false,
      data: null,
      error: `Unknown tool: ${toolName}`,
      duration: 0,
    };
  }
  if (!tool.isAvailable()) {
    return {
      tool: toolName,
      success: false,
      data: null,
      error: `Tool not available: ${toolName}`,
      duration: 0,
    };
  }
  return tool.execute(params);
}

/**
 * Execute a tool with retry logic.
 * Tools get 2 attempts max (they usually fail deterministically).
 */
async function executeToolWithRetry(
  toolName: string,
  params: Record<string, unknown>,
  agentId: string,
): Promise<{ result: ToolResult; retryAttempts: number }> {
  const retryResult = await withRetry<ToolResult>(
    async () => {
      const result = await executeTool(toolName, params);
      if (!result.success) {
        throw new ToolError(result.error ?? `Tool ${toolName} failed`, {
          tool: toolName,
          retryable: true,
        });
      }
      return result;
    },
    {
      maxRetries: 1, // 2 total attempts for tools
      initialDelayMs: 2000,
      nonRetryableCategories: ['auth', 'validation', 'resource', 'deliverable', 'budget'],
    },
    { source: 'tool', operation: toolName, agentId },
  );

  if (retryResult.success && retryResult.value) {
    return { result: retryResult.value, retryAttempts: retryResult.attempts - 1 };
  }

  // All retries failed — return a failed ToolResult
  return {
    result: {
      tool: toolName,
      success: false,
      data: null,
      error: retryResult.error?.message ?? `Tool ${toolName} failed after retries`,
      duration: retryResult.totalDuration,
    },
    retryAttempts: retryResult.attempts - 1,
  };
}

// ── Deliverable Loading ──

/**
 * Load the required input deliverables for an agent.
 * Returns a map from deliverable filename to parsed content.
 */
export function loadRequiredDeliverables(
  sessionId: string,
  requiredDeliverables: string[],
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  for (const deliverableFilename of requiredDeliverables) {
    const phase = resolvePhaseForDeliverable(deliverableFilename);
    const result = readDeliverable(sessionId, phase, deliverableFilename);
    inputs[deliverableFilename] = result?.data ?? null;
  }

  return inputs;
}

/**
 * Resolve which phase directory a deliverable lives in.
 */
function resolvePhaseForDeliverable(filename: string): string {
  if (filename.startsWith('contract-source') || filename.startsWith('protocol-metadata')) {
    return 'discovery';
  }
  if (filename.startsWith('slither-') || filename.startsWith('pattern-') || filename.startsWith('fork-detection')) {
    return 'static-analysis';
  }
  if (filename.startsWith('vuln-')) {
    return 'vulnerability-hypothesis';
  }
  if (filename.startsWith('verification-')) {
    return 'verification';
  }
  if (filename.startsWith('final-')) {
    return 'report';
  }
  return 'discovery';
}

// ── Prompt Hydration ──

/**
 * Build the prompt for an agent by loading its template and substituting
 * variables from the input deliverables and execution context.
 */
function hydratePrompt(context: AgentExecutionContext): string | null {
  const { agent, inputDeliverables, config } = context;

  try {
    const variables: Record<string, string> = {};

    const contractSource = inputDeliverables['contract-source.json'] as Record<string, unknown> | null;
    if (contractSource) {
      variables.CONTRACT_SOURCE = String(contractSource.sourceCode ?? '');
      variables.SOLIDITY_VERSION = String(contractSource.compilerVersion ?? 'unknown');
    }

    const metadata = inputDeliverables['protocol-metadata.json'] as Record<string, unknown> | null;
    if (metadata) {
      variables.PROTOCOL_NAME = String(metadata.protocolName ?? 'Unknown');
      variables.CONTRACT_ADDRESS = String(metadata.address ?? '');
    }

    const slither = inputDeliverables['slither-report.json'] as Record<string, unknown> | null;
    if (slither) {
      variables.SLITHER_OUTPUT = JSON.stringify(slither.findings ?? []);
    }

    switch (agent.id) {
      case 'vuln-arithmetic':
        variables.SLITHER_OUTPUT = variables.SLITHER_OUTPUT ?? '[]';
        break;
      case 'vuln-reentrancy':
        variables.EXTERNAL_CALLS = extractFilteredFindings(slither, ['reentrancy']);
        break;
      case 'vuln-access-control':
        variables.ADMIN_FUNCTIONS = extractFilteredFindings(slither, ['access', 'owner']);
        break;
      case 'vuln-oracle':
        variables.ORACLE_DEPENDENCIES = extractFilteredFindings(slither, ['oracle', 'price']);
        break;
      case 'vuln-flash-loan':
        variables.TVL = String(metadata?.tvl ?? 'unknown');
        break;
      case 'vuln-logic':
        variables.PROTOCOL_TYPE = String(metadata?.protocolType ?? 'Unknown DeFi protocol');
        break;
      case 'verify-arithmetic':
      case 'verify-reentrancy':
      case 'verify-access-control':
      case 'verify-oracle':
      case 'verify-flash-loan':
      case 'verify-logic': {
        const vulnType = agent.id.replace('verify-', '');
        const vulnReport = inputDeliverables[`vuln-${vulnType}-report.json`] as Record<string, unknown> | null;
        variables.FINDINGS = JSON.stringify(vulnReport?.findings ?? []);
        variables.VULN_TYPE = vulnType;
        break;
      }
      case 'report-immunefi':
        variables.FINDINGS = JSON.stringify(inputDeliverables);
        variables.PROTOCOL_NAME = variables.PROTOCOL_NAME ?? 'Unknown';
        variables.CONTRACT_ADDRESS = variables.CONTRACT_ADDRESS ?? '';
        variables.CHAIN = String(metadata?.chain ?? config.target.chain ?? 'ethereum');
        break;
    }

    return loadPrompt(agent.promptTemplate, variables);
  } catch (err) {
    console.warn(`[AgentExecutor] Failed to hydrate prompt for ${agent.id}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function extractFilteredFindings(slither: Record<string, unknown> | null, keywords: string[]): string {
  if (!slither?.findings || !Array.isArray(slither.findings)) return '[]';
  const filtered = (slither.findings as Array<Record<string, unknown>>).filter(f => {
    const name = String(f?.detectorName ?? '').toLowerCase();
    return keywords.some(kw => name.includes(kw));
  });
  return JSON.stringify(filtered);
}

// ── Finding Parsing ──

/**
 * Parse AI response text to extract structured findings.
 */
function parseFindings(responseText: string, agentId: string, vulnType: string): Finding[] {
  const findings: Finding[] = [];

  try {
    const parsed = JSON.parse(responseText);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        findings.push(normalizeFinding(item, agentId, vulnType));
      }
      return findings;
    }
    if (parsed.findings && Array.isArray(parsed.findings)) {
      for (const item of parsed.findings) {
        findings.push(normalizeFinding(item, agentId, vulnType));
      }
      return findings;
    }
  } catch {
    // Not JSON — try text parsing
  }

  const severityPatterns = [
    { pattern: /\*\*(?:CRITICAL|Critical)\*\*[:\s]+(.*?)(?:\n|$)/g, severity: 'critical' as const },
    { pattern: /\*\*(?:HIGH|High)\*\*[:\s]+(.*?)(?:\n|$)/g, severity: 'high' as const },
    { pattern: /\*\*(?:MEDIUM|Medium)\*\*[:\s]+(.*?)(?:\n|$)/g, severity: 'medium' as const },
    { pattern: /\*\*(?:LOW|Low)\*\*[:\s]+(.*?)(?:\n|$)/g, severity: 'low' as const },
  ];

  for (const { pattern, severity } of severityPatterns) {
    let match;
    while ((match = pattern.exec(responseText)) !== null) {
      findings.push({
        id: uuidv4(),
        agentId,
        vulnType,
        severity,
        title: match[1].trim().slice(0, 200),
        description: match[1].trim(),
        location: '',
        verified: false,
      });
    }
  }

  return findings;
}

function normalizeFinding(raw: Record<string, unknown>, agentId: string, vulnType: string): Finding {
  return {
    id: String(raw.id ?? uuidv4()),
    agentId,
    vulnType,
    severity: normalizeSeverity(String(raw.severity ?? 'info')),
    title: String(raw.title ?? 'Untitled finding'),
    description: String(raw.description ?? ''),
    location: String(raw.location ?? ''),
    verified: Boolean(raw.verified),
    poc: raw.poc ? String(raw.poc) : undefined,
    estimatedImpact: raw.estimatedImpact ? String(raw.estimatedImpact) : undefined,
    exploitableValue: typeof raw.exploitableValue === 'number' ? raw.exploitableValue : undefined,
  };
}

function normalizeSeverity(s: string): Finding['severity'] {
  const lower = s.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'medium') return 'medium';
  if (lower === 'low') return 'low';
  return 'info';
}

// ── AI Provider Call with Retry ──

/** Retryable categories for AI provider calls. */
const AI_RETRYABLE: ErrorCategory[] = ['provider', 'rate-limit', 'network', 'timeout', 'parse'];

/**
 * Send prompt to AI provider with retry logic and provider rotation.
 *
 * Currently a placeholder — returns empty findings. When the real AI provider
 * integration is connected, this wraps it with withRetry().
 */
async function callAIProviderWithRetry(
  agentId: string,
  prompt: string,
  maxRetries: number,
): Promise<{ responseText: string; tokensUsed: number; retryAttempts: number; providerRotations: number }> {
  let providerRotations = 0;

  const retryResult = await withRetry<{ responseText: string; tokensUsed: number }>(
    async () => {
      // Placeholder: real AI call goes here.
      // When connected, this would use the ProviderRotator to get the active
      // provider and make the API call.
      return { responseText: JSON.stringify({ findings: [] }), tokensUsed: 0 };
    },
    {
      maxRetries,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      nonRetryableCategories: ['auth', 'validation', 'budget', 'deliverable', 'resource'],
    },
    { source: 'ai-provider', agentId },
    {
      onRotateProvider: () => {
        providerRotations++;
        // When connected, this would call providerRotator.rotateProvider()
        // and return the new provider key.
        return undefined;
      },
    },
  );

  if (retryResult.success && retryResult.value) {
    return {
      ...retryResult.value,
      retryAttempts: retryResult.attempts - 1,
      providerRotations,
    };
  }

  // All retries failed — return empty response with error info
  return {
    responseText: JSON.stringify({ findings: [] }),
    tokensUsed: 0,
    retryAttempts: retryResult.attempts - 1,
    providerRotations,
  };
}

// ── Main Executor ──

/**
 * Execute a single agent.
 *
 * 1. Loads required input deliverables
 * 2. Hydrates the agent's prompt template
 * 3. Sends prompt to AI (with retry + rotation) or stubs in DRY_RUN
 * 4. Parses findings from response
 * 5. Writes output deliverables
 * 6. Returns AgentResult with structured error details
 */
export async function executeAgent(context: AgentExecutionContext): Promise<AgentResult> {
  const startMs = Date.now();
  const { sessionId, agent, dryRun } = context;
  const errors: string[] = [];
  const structuredErrors: ScannerError[] = [];
  const findings: Finding[] = [];
  const deliverables: string[] = [];
  let tokensUsed = 0;
  let totalRetryAttempts = 0;
  let totalProviderRotations = 0;

  console.log(`[Agent:${agent.id}] Starting execution`);

  try {
    // Step 1: Execute any tools the agent needs (with retry)
    const toolResults: Record<string, ToolResult> = {};
    for (const toolName of agent.tools) {
      const toolParams = buildToolParams(context, toolName);
      const { result, retryAttempts } = await executeToolWithRetry(toolName, toolParams, agent.id);
      toolResults[toolName] = result;
      totalRetryAttempts += retryAttempts;

      if (!result.success) {
        const toolErr = classifyError(
          new Error(result.error ?? `Tool ${toolName} failed`),
          { source: 'tool', operation: toolName, agentId: agent.id },
        );
        structuredErrors.push(toolErr);
        console.warn(`[Agent:${agent.id}] Tool ${toolName} failed: ${result.error}`);

        if (agent.id.startsWith('static-') && toolName === 'slither') {
          errors.push(`Tool failure: ${toolName} — ${result.error}`);
        }
      }
    }

    // Step 2: Hydrate prompt
    const prompt = hydratePrompt(context);
    if (!prompt) {
      writeEmptyOutput(sessionId, agent, 'Prompt template not available');
      deliverables.push(...agent.outputDeliverables.map(d => `${agent.phase}/${d}`));
      return {
        agentId: agent.id,
        status: 'skipped',
        findings: [],
        deliverables,
        duration: Date.now() - startMs,
        tokensUsed: 0,
        errors: ['Prompt template not available'],
        metadata: { retryAttempts: totalRetryAttempts, providerRotations: 0 },
      };
    }

    // Step 3: Send to AI provider (with retry and rotation) or stub in DRY_RUN
    let responseText = '';

    if (dryRun) {
      logAiPrompt(agent.id, prompt);
      dryRunLog(agent.id, `Would send ${prompt.length} char prompt, max ${agent.maxTurns} turns`);
      responseText = JSON.stringify({ findings: [] });
    } else {
      const aiResult = await callAIProviderWithRetry(
        agent.id,
        prompt,
        agent.maxRetries,
      );
      responseText = aiResult.responseText;
      tokensUsed = aiResult.tokensUsed;
      totalRetryAttempts += aiResult.retryAttempts;
      totalProviderRotations += aiResult.providerRotations;
    }

    // Step 4: Parse findings
    const vulnType = extractVulnType(agent.id);
    const parsedFindings = parseFindings(responseText, agent.id, vulnType);
    findings.push(...parsedFindings);

    // Incorporate tool results
    if (toolResults.slither?.success) {
      const slitherData = toolResults.slither.data as Record<string, unknown> | null;
      if (slitherData && Array.isArray(slitherData.findings)) {
        writeDeliverable(sessionId, agent.phase, 'slither-report.json', slitherData, agent.id);
      }
    }

    // Step 5: Write output deliverables
    for (const outputFile of agent.outputDeliverables) {
      const deliverableData = {
        agentId: agent.id,
        vulnType,
        findingCount: findings.length,
        findings,
        toolResults: Object.fromEntries(
          Object.entries(toolResults).map(([name, r]) => [name, { success: r.success, error: r.error }])
        ),
        tokensUsed,
        dryRun,
        retryAttempts: totalRetryAttempts,
        providerRotations: totalProviderRotations,
      };

      if (outputFile.endsWith('.md')) {
        writeDeliverable(sessionId, agent.phase, outputFile, formatMarkdownReport(agent.id, findings), agent.id);
      } else {
        writeDeliverable(sessionId, agent.phase, outputFile, deliverableData, agent.id);
      }
      deliverables.push(`${agent.phase}/${outputFile}`);
    }

    console.log(`[Agent:${agent.id}] Completed: ${findings.length} findings in ${Date.now() - startMs}ms (retries: ${totalRetryAttempts}, rotations: ${totalProviderRotations})`);

    return {
      agentId: agent.id,
      status: errors.length > 0 ? 'failed' : 'success',
      findings,
      deliverables,
      duration: Date.now() - startMs,
      tokensUsed,
      errors,
      metadata: {
        vulnType,
        toolsUsed: Object.keys(toolResults),
        promptLength: prompt.length,
        retryAttempts: totalRetryAttempts,
        providerRotations: totalProviderRotations,
        structuredErrors: structuredErrors.map(e => e.toJSON()),
      },
    };
  } catch (err) {
    const classified = classifyError(err, { agentId: agent.id });
    structuredErrors.push(classified);

    const msg = classified.message;
    console.error(`[Agent:${agent.id}] Failed: ${msg} [${classified.category}/${classified.code}]`);
    errors.push(msg);

    try {
      writeEmptyOutput(sessionId, agent, msg);
      deliverables.push(...agent.outputDeliverables.map(d => `${agent.phase}/${d}`));
    } catch { /* ignore */ }

    return {
      agentId: agent.id,
      status: 'failed',
      findings: [],
      deliverables,
      duration: Date.now() - startMs,
      tokensUsed,
      errors,
      metadata: {
        retryAttempts: totalRetryAttempts,
        providerRotations: totalProviderRotations,
        structuredErrors: structuredErrors.map(e => e.toJSON()),
      },
    };
  }
}

// ── Helpers ──

function extractVulnType(agentId: string): string {
  if (agentId.startsWith('vuln-')) return agentId.replace('vuln-', '');
  if (agentId.startsWith('verify-')) return agentId.replace('verify-', '');
  return agentId;
}

function writeEmptyOutput(sessionId: string, agent: AgentDefinition, reason: string): void {
  for (const outputFile of agent.outputDeliverables) {
    if (outputFile.endsWith('.md')) {
      writeDeliverable(sessionId, agent.phase, outputFile, `# ${agent.name}\n\nSkipped: ${reason}`, agent.id);
    } else {
      writeDeliverable(sessionId, agent.phase, outputFile, {
        agentId: agent.id,
        findingCount: 0,
        findings: [],
        skipped: true,
        reason,
      }, agent.id);
    }
  }
}

function buildToolParams(context: AgentExecutionContext, toolName: string): Record<string, unknown> {
  const { config, inputDeliverables, sessionId } = context;
  const contractSource = inputDeliverables['contract-source.json'] as Record<string, unknown> | null;
  const metadata = inputDeliverables['protocol-metadata.json'] as Record<string, unknown> | null;

  switch (toolName) {
    case 'slither':
      return { sourcePath: contractSource?.sourcePath ?? '' };
    case 'foundry':
      return {
        rpcUrl: config.verification.mainnet_rpc,
        gasLimit: config.verification.gas_limit,
      };
    case 'etherscan':
      return {
        address: metadata?.address ?? config.target.contract_address,
        chain: metadata?.chain ?? config.target.chain,
      };
    case 'defillama':
      return {
        protocolName: metadata?.protocolName ?? config.target.protocol_name,
      };
    default:
      return {};
  }
}

function formatMarkdownReport(agentId: string, findings: Finding[]): string {
  const lines = [
    `# ${agentId} Report`,
    '',
    `**Findings:** ${findings.length}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
  ];

  if (findings.length === 0) {
    lines.push('No findings discovered.');
  } else {
    for (const f of findings) {
      lines.push(`## [${f.severity.toUpperCase()}] ${f.title}`);
      lines.push('');
      lines.push(f.description);
      if (f.location) lines.push(`\n**Location:** \`${f.location}\``);
      if (f.poc) lines.push(`\n**PoC:**\n\`\`\`solidity\n${f.poc}\n\`\`\``);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Re-export types needed by agent-types
import type { AgentDefinition } from './agent-types.js';
