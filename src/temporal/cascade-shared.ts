/**
 * Shared types for cascade hunt Temporal workflows and activities.
 *
 * IMPORTANT: This file must remain free of Node.js runtime imports.
 * Only pure type definitions and constants are allowed here.
 */

// ── Cascade Workflow Input/Output ──

export interface CascadeWorkflowInput {
  /** Deliverables session ID (UUID) */
  sessionId: string;
  /** Path to YAML config file (optional) */
  configPath?: string;
  /** Address of the vulnerable contract */
  contractAddress: string;
  /** Chain the vulnerable contract is on */
  chain: string;
  /** Numeric chain ID */
  chainId: number;
  /** Contract name */
  contractName: string;
  /** Vulnerability type (e.g. 'reentrancy') */
  vulnType: string;
  /** Vulnerability title */
  vulnTitle: string;
  /** Chains to search for forks */
  targetChains?: string[] | 'all';
  /** Minimum similarity score (0-100) */
  minSimilarity?: number;
  /** Maximum results per chain */
  maxResultsPerChain?: number;
  /** Whether this is a dry run */
  dryRun?: boolean;
}

export interface CascadeWorkflowResult {
  sessionId: string;
  status: 'completed' | 'failed' | 'partial';
  phasesCompleted: string[];
  phasesFailed: string[];
  totalForksFound: number;
  vulnerableForksFound: number;
  chainsSearched: number;
  chainsAffected: number;
  duration: number;
  deliverables: string[];
}

// ── Phase Results ──

export interface CascadePhaseResult {
  phase: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  deliverables: string[];
  errors: string[];
  metadata: Record<string, unknown>;
}

// ── Query Types ──

export interface CascadeProgress {
  currentPhase: string;
  completedPhases: string[];
  startedAt: number;
  lastUpdate: number;
  forksFound: number;
  vulnerableForksFound: number;
  chainsSearched: number;
  errors: string[];
}

// ── Phase Definitions ──

export const CASCADE_PHASES = [
  'bytecode-extraction',
  'fork-discovery',
  'cascade-verification',
  'poc-adaptation',
  'report-generation',
] as const;

export type CascadePhaseName = typeof CASCADE_PHASES[number];

// ── Constants ──

export const CASCADE_TASK_QUEUE = 'cascade-queue';
export const CASCADE_WORKFLOW_ID_PREFIX = 'cascade-hunt';
export const CASCADE_PROGRESS_QUERY = 'cascade-progress';
