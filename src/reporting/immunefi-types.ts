/**
 * Immunefi bug bounty submission schema.
 *
 * Defines the structured data model for generating Immunefi-ready
 * vulnerability reports from scanner findings.
 */

// ── Submission ──

export interface ImmunefiSubmission {
  programName: string;
  programUrl: string;               // https://immunefi.com/bug-bounty/PROGRAM
  asset: AssetInfo;
  vulnerability: VulnerabilityInfo;
  impact: ImpactInfo;
  proofOfConcept: ProofOfConcept;
  additionalInfo: string;
  submissionDate: string;           // ISO 8601
  scannerVersion: string;
  sessionId: string;
}

// ── Asset ──

export interface AssetInfo {
  type: 'smart_contract';
  chain: string;                    // e.g. 'Ethereum', 'Base', 'Arbitrum'
  address: string;                  // contract address (checksummed)
  name: string;                     // contract name
  sourceVerified: boolean;
  compilerVersion: string;          // e.g. 'v0.8.19+commit.7dd6d404'
}

// ── Vulnerability ──

export interface VulnerabilityInfo {
  title: string;                    // clear, concise title
  type: VulnCategory;
  severity: ImmunefiSeverity;
  description: string;              // detailed technical description
  rootCause: string;                // why the vulnerability exists
  affectedFunctions: string[];      // function signatures
  affectedLines: string[];          // file:line references
  cweId?: string;                   // CWE identifier if applicable
}

export type VulnCategory =
  | 'theft_of_funds'
  | 'permanent_freezing_of_funds'
  | 'temporary_freezing_of_funds'
  | 'theft_of_yield'
  | 'theft_of_gas'
  | 'unauthorized_minting'
  | 'griefing'
  | 'denial_of_service'
  | 'manipulation_of_governance'
  | 'privilege_escalation'
  | 'other';

export type ImmunefiSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

// ── Impact ──

export interface ImpactInfo {
  description: string;              // what an attacker could achieve
  estimatedLoss: string;            // e.g. "Up to $500K in pool funds"
  exploitableValueUsd?: number;     // numeric estimate
  affectedUsers: string;            // e.g. "All depositors in the vault"
  prerequisites: string[];          // what attacker needs (e.g. "flash loan", "none")
  attackComplexity: 'Low' | 'Medium' | 'High';
}

// ── Proof of Concept ──

export interface ProofOfConcept {
  summary: string;                  // step-by-step exploit summary
  environment: string;              // e.g. "Foundry mainnet fork at block 12345678"
  steps: ExploitStep[];
  foundryTest?: string;             // complete Foundry test file content
  exploitOutput?: string;           // console output from running the test
  verifiedOnFork: boolean;
  forkBlockNumber?: number;
  forkRpcUrl?: string;              // public endpoint only, never private
}

export interface ExploitStep {
  stepNumber: number;
  description: string;
  code?: string;                    // code/command for this step
  expectedResult: string;
}

// ── Report (aggregated) ──

export interface ImmunefiReport {
  protocolName: string;
  chain: string;
  contractAddress: string;
  scannerVersion: string;
  sessionId: string;
  generatedAt: string;              // ISO 8601
  executiveSummary: string;
  submissions: ImmunefiSubmission[];
  severityCounts: Record<ImmunefiSeverity, number>;
  totalExploitableValueUsd: number;
}

// ── Program Lookup ──

export interface ProgramInfo {
  name: string;
  slug: string;
  url: string;                      // Immunefi program page URL
  maxBounty: number;                // max payout in USD
  assets: ProgramAsset[];
  launchDate: string;
  updatedDate: string;
}

export interface ProgramAsset {
  address: string;
  chain: string;
  type: 'smart_contract' | 'websites_and_applications' | 'blockchain_dlt';
}

// ── Checklist ──

export interface SubmissionChecklist {
  findingId: string;
  findingTitle: string;
  checks: ChecklistItem[];
}

export interface ChecklistItem {
  label: string;
  checked: boolean;
  note?: string;
}
