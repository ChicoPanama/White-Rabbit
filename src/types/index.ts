// ── Chain Configuration ──

export interface ChainConfig {
  chainId: number;
  name: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: { chainId: 1, name: 'Ethereum' },
  base: { chainId: 8453, name: 'Base' },
  arbitrum: { chainId: 42161, name: 'Arbitrum' },
  polygon: { chainId: 137, name: 'Polygon' },
  optimism: { chainId: 10, name: 'Optimism' },
};

// ── Severity & Confidence ──

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type Confidence = 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

// ── Contract ──

export interface Contract {
  id: string;
  address: string;
  chainId: number;
  name: string;
  sourceCode: string;
  abi: unknown[];
  compilerVersion: string;
  isProxy: boolean;
  implementationAddress: string | null;
  tvlUsd: number | null;
  protocolName: string | null;
}

// ── Etherscan ──

export interface EtherscanSourceResult {
  ContractName: string;
  SourceCode: string;
  ABI: string;
  CompilerVersion: string;
  Proxy: string;
  Implementation: string;
}

// ── DeFiLlama ──

export interface DeFiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  chains: string[];
  tvl: number;
  chainTvls: Record<string, number>;
  category: string;
  url: string;
}

// ── Slither ──

export interface SlitherOutput {
  success: boolean;
  error: string | null;
  results: {
    detectors: SlitherDetectorResult[];
  };
}

export interface SlitherDetectorResult {
  check: string;
  impact: string;
  confidence: string;
  description: string;
  elements: SlitherElement[];
  first_markdown_element: string;
  markdown: string;
}

export interface SlitherElement {
  type: string;
  name: string;
  source_mapping: {
    filename_relative: string;
    filename_absolute: string;
    lines: number[];
    starting_column: number;
    ending_column: number;
  };
  type_specific_fields?: Record<string, unknown>;
}

// ── Findings ──

export interface Finding {
  id: string;
  scanId: string;
  contractId: string;
  detectorName: string;
  tool: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  codeSnippet: string | null;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  aiAssessment: string | null;
  aiIsFalsePositive: boolean | null;
  deduplicatedGroupId: string | null;
}

// ── Scan ──

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Scan {
  id: string;
  contractId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: ScanStatus;
  toolsUsed: string[];
  errorMessage: string | null;
}

// ── AI Analysis ──

export interface AIAnalysisResult {
  findingId: string;
  isFalsePositive: boolean;
  assessment: string;
  attackPath: string | null;
  recommendedFix: string | null;
  adjustedSeverity: Severity | null;
}

// ── Telegram ──

export interface TelegramSendResult {
  ok: boolean;
  result?: {
    message_id: number;
  };
  description?: string;
}

// ── Verification Pipeline ──

export type VerificationStatus =
  | 'verified'       // PoC exploit succeeded on fork
  | 'likely_real'    // 2+ tools agree, high confidence
  | 'needs_review'   // Single tool, medium confidence
  | 'likely_false'   // PoC failed or low confidence
  | 'false_positive'; // Matches known FP pattern

export interface VerifiedFinding extends Finding {
  verificationStatus: VerificationStatus;
  confidenceScore: number; // 0-100
  pocResult: PoCResult | null;
  contextInfo: ContractContext | null;
  toolsAgreeing: string[];
}

export interface PoCResult {
  attempted: boolean;
  succeeded: boolean;
  exploitContract: string | null;
  forkBlockNumber: number | null;
  errorMessage: string | null;
  gasUsed: string | null;
}

export interface ContractContext {
  isAudited: boolean;
  auditedBy: string[];
  knownProtocol: string | null;
  contractAgeDays: number | null;
  hasReentrancyGuard: boolean;
  hasAccessControl: boolean;
  hasTimelocks: boolean;
  hasPauseability: boolean;
  usesOracle: boolean;
  usesTWAP: boolean;
}

export interface FalsePositivePattern {
  detector: string;
  codePattern: RegExp;
  reason: string;
}

// ── RPC Configuration ──

export const CHAIN_RPC_ENV: Record<string, string> = {
  ethereum: 'ETH_RPC_URL',
  base: 'BASE_RPC_URL',
  arbitrum: 'ARBITRUM_RPC_URL',
  polygon: 'POLYGON_RPC_URL',
  optimism: 'OPTIMISM_RPC_URL',
};

// ── Queue Jobs ──

export interface AnalysisJobData {
  contractId: string;
  address: string;
  chainId: number;
  sourcePath: string;
}

export interface AlertJobData {
  findingId: string;
}

export interface DiscoveryJobData {
  chain: string;
  minTvl: number;
}
