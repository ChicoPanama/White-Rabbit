/**
 * Memory Bank Type Definitions
 * Hybrid structure supporting existing + new memory files
 */

export interface MemoryFile {
  name: string;
  path: string;
  content: string;
  lastUpdated: Date;
}

export interface MemoryBankState {
  // Core identity (existing)
  memory: MemoryFile;        // MEMORY.md
  identity: MemoryFile;      // IDENTITY.md
  soul: MemoryFile;          // SOUL.md

  // Session state (new)
  activeContext: MemoryFile; // activeContext.md
  operations: MemoryFile;    // operations.md
  findingsLog: MemoryFile;   // findingsLog.md

  // Intelligence (existing)
  attackVectors: MemoryFile; // memory/ATTACK_VECTOR_DATABASE.md
  huntingLog: MemoryFile;    // memory/hunting-log.json
}

export interface Finding {
  id: string;
  protocol: string;
  chain: string;
  contract: string;
  function?: string;
  vulnerabilityType: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  stage: 'Investigation' | 'Verification' | 'Submitted' | 'Accepted' | 'Rejected';
  description: string;
  trigger: string;
  impact: string;
  estimatedValue?: string;
  proofOfConcept?: string;
  reportUrl?: string;
  submissionPlatform?: string;
  submissionDate?: Date;
  status?: string;
  bountyAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScanTarget {
  protocol: string;
  chain: string;
  tvl: number;
  priority: number;
  status: 'Queued' | 'Scanning' | 'Complete' | 'Failed';
  lastScanned?: Date;
  notes?: string;
}

export interface OperationStatus {
  component: string;
  status: '🟢' | '🟡' | '🔴' | '⚠️' | '❌' | '⏳';
  lastCheck: Date;
  notes?: string;
}

export interface SessionContext {
  currentFocus: string;
  mode: 'Hunting' | 'Analyzing' | 'Verifying' | 'Submitting' | 'Learning' | 'Idle';
  lastAction: string;
  nextSteps: string[];
  learnings: string[];
  startedAt: Date;
}

export interface HuntingLogStats {
  totalScans: number;
  totalContracts: number;
  totalFindings: number;
  verifiedExploits: number;
  likelyReal: number;
  falsePositives: number;
  totalExploitableValue: number;
  forkMatches: number;
  patternsLearned: number;
}

export interface HuntingLog {
  version: string;
  lastUpdated: string;
  stats: HuntingLogStats;
  chainPriorities: Record<string, number>;
  scanQueue: ScanTarget[];
  recentHacks: any[];
  findings: any[];
  patterns: any[];
  lastScanByChain: Record<string, string>;
}
