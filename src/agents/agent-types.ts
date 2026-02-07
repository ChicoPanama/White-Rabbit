/**
 * Agent abstraction types for the multi-agent vulnerability scanning system.
 *
 * Each agent is an independent, specialized scanner unit with its own
 * configuration, prompt template, tooling, and deliverable output.
 */

import type { PhaseName } from '../queue-validation.js';
import type { ScanConfig } from '../config-parser.js';

// ── Agent Definition ──

export interface AgentDefinition {
  /** Unique agent identifier e.g. 'vuln-reentrancy' */
  id: string;
  /** Display name e.g. 'Reentrancy Scanner' */
  name: string;
  /** Which pipeline phase this agent belongs to */
  phase: PhaseName;
  /** Agents in the same group run concurrently */
  parallelGroup: string;
  /** Path to prompt file e.g. 'vuln-reentrancy' */
  promptTemplate: string;
  /** Deliverable filenames that must exist before this agent runs */
  requiredDeliverables: string[];
  /** Deliverable filenames this agent produces */
  outputDeliverables: string[];
  /** Max AI conversation turns allowed */
  maxTurns: number;
  /** Activity timeout in minutes */
  timeoutMinutes: number;
  /** Whether failures should be retried */
  retryable: boolean;
  /** Max retry attempts */
  maxRetries: number;
  /** Tools this agent can use e.g. ['slither', 'foundry', 'etherscan'] */
  tools: string[];
  /** Can be toggled via config */
  enabled: boolean;
  /** Execution priority within parallel group (lower = first) */
  priority: number;
}

// ── Execution Context ──

export interface AgentExecutionContext {
  /** Session ID for deliverables scope */
  sessionId: string;
  /** Resolved scan configuration */
  config: ScanConfig;
  /** The agent being executed */
  agent: AgentDefinition;
  /** Parsed content of required deliverables keyed by filename */
  inputDeliverables: Record<string, unknown>;
  /** Whether external calls should be stubbed */
  dryRun: boolean;
}

// ── Agent Result ──

export interface AgentResult {
  /** The agent that produced this result */
  agentId: string;
  /** Execution outcome */
  status: 'success' | 'failed' | 'skipped' | 'timeout';
  /** Findings discovered by this agent */
  findings: Finding[];
  /** Paths to output deliverables written */
  deliverables: string[];
  /** Execution duration in ms */
  duration: number;
  /** AI tokens consumed (prompt + completion) */
  tokensUsed: number;
  /** Error messages if any */
  errors: string[];
  /** Arbitrary metadata from execution */
  metadata: Record<string, unknown>;
}

// ── Finding ──

export interface Finding {
  /** Unique finding identifier */
  id: string;
  /** Agent that discovered this finding */
  agentId: string;
  /** Vulnerability category */
  vulnType: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Short title */
  title: string;
  /** Detailed description of the vulnerability */
  description: string;
  /** Location in source: contract:function:line */
  location: string;
  /** Whether this finding has been verified via PoC */
  verified: boolean;
  /** Proof of concept code */
  poc?: string;
  /** Human-readable impact description */
  estimatedImpact?: string;
  /** Estimated exploitable value in USD */
  exploitableValue?: number;
}

// ── Tool Types ──

export interface ToolResult {
  /** Tool that produced this result */
  tool: string;
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Tool output data */
  data: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  duration: number;
}

export interface ToolDefinition {
  /** Tool identifier */
  name: string;
  /** Check if the tool is available on this system */
  isAvailable(): boolean;
  /** Execute the tool with given params */
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}
