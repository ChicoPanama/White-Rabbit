/**
 * Shared types and interfaces for Temporal workflows and activities.
 *
 * IMPORTANT: This file must remain free of Node.js runtime imports.
 * It is imported by both workflow code (sandboxed V8 isolate) and
 * activity code (regular Node.js). Only pure type definitions and
 * constants are allowed here.
 */

// ── Workflow Input/Output ──

export interface ScanWorkflowInput {
  /** Deliverables session ID (UUID) */
  sessionId: string;
  /** Path to YAML config file (optional) */
  configPath?: string;
  /** Specific contract address to scan */
  contractAddress?: string;
  /** Target chain name */
  chain?: string;
  /** Protocol name for context enrichment */
  protocolName?: string;
  /** Skip external calls (API, RPC, AI) */
  dryRun?: boolean;
}

export interface ScanWorkflowResult {
  sessionId: string;
  status: 'completed' | 'failed' | 'partial';
  phasesCompleted: string[];
  phasesFailed: string[];
  findingsCount: number;
  verifiedCount: number;
  /** Total workflow duration in ms */
  duration: number;
  /** Deliverable file paths produced */
  deliverables: string[];
}

// ── Phase Results ──

export interface PhaseResult {
  phase: string;
  status: 'success' | 'failed' | 'skipped';
  /** Duration in ms */
  duration: number;
  /** Deliverable files written (relative paths) */
  deliverables: string[];
  errors: string[];
  metadata: Record<string, unknown>;
}

// ── Query Types ──

export interface WorkflowProgress {
  currentPhase: string;
  completedPhases: string[];
  currentAgent?: string;
  startedAt: number;
  lastUpdate: number;
  findings: number;
  errors: string[];
}

// ── Phase Definitions ──

export const SCAN_PHASES = [
  'discovery',
  'static-analysis',
  'vulnerability-hypothesis',
  'verification',
  'report',
] as const;

export type ScanPhaseName = typeof SCAN_PHASES[number];

// ── Vulnerability Types ──

export const VULN_TYPES = [
  'arithmetic',
  'reentrancy',
  'access-control',
  'oracle',
  'flash-loan',
  'logic',
] as const;

export type VulnType = typeof VULN_TYPES[number];

// ── Error Classification ──

/** Errors that should NOT be retried by Temporal */
export const NON_RETRYABLE_ERROR_TYPES = [
  'ConfigError',
  'ValidationError',
  'TemplateNotFoundError',
] as const;

// ── Temporal Constants ──

export const TASK_QUEUE = 'scanner-queue';
export const WORKFLOW_ID_PREFIX = 'scan';

/** Query name for retrieving workflow progress */
export const PROGRESS_QUERY = 'progress';
