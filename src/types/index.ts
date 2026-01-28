// ── Chain Configuration ──
// Import comprehensive chain configuration
import { CHAIN_CONFIGS, ChainConfig, getChainConfig, getHighValueChains } from '../config/chains.js';

export { ChainConfig, getChainConfig, getHighValueChains };
export const CHAINS = CHAIN_CONFIGS;

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
  exploitEstimate: ExploitEstimate | null;
}

export interface PoCResult {
  attempted: boolean;
  succeeded: boolean;
  exploitContract: string | null;
  forkBlockNumber: number | null;
  errorMessage: string | null;
  gasUsed: string | null;
  extractedValue: PoCValueResult | null;
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
  bsc: 'BSC_RPC_URL',
  arbitrum: 'ARBITRUM_RPC_URL',
  base: 'BASE_RPC_URL',
  polygon: 'POLYGON_RPC_URL',
  optimism: 'OPTIMISM_RPC_URL',
  avalanche: 'AVALANCHE_RPC_URL',
  fantom: 'FANTOM_RPC_URL',
  linea: 'LINEA_RPC_URL',
  scroll: 'SCROLL_RPC_URL',
  blast: 'BLAST_RPC_URL',
  gnosis: 'GNOSIS_RPC_URL',
};

// ── Exploit Value Estimation ──

export interface TokenBalance {
  symbol: string;
  address: string;
  amount: number;
  valueUsd: number;
}

export interface ContractBalances {
  eth: number;
  ethUsd: number;
  tokens: TokenBalance[];
  total: number; // Total USD value
}

export interface AtRiskAnalysis {
  atRiskFunds: number;      // USD at risk
  lockedFunds: number;      // USD detected as timelocked/locked
  safeFunds: number;        // USD not reachable via this vuln
  methodology: string;      // Explanation of how we calculated
}

export interface ExploitEstimate {
  protocolTvl: number;            // Total protocol TVL
  contractBalance: number;         // ETH + token balance in vulnerable contract (USD)
  estimatedExploitable: number;    // Our estimate of what could be drained (USD)
  exploitablePercentage: number;   // % of contract balance that's at risk
  confidence: 'high' | 'medium' | 'low';
  methodology: string;             // How we calculated this
  breakdown: {
    ethBalance: number;            // USD
    tokenBalances: TokenBalance[];
    lockedFunds: number;           // USD detected as timelocked/locked
    atRiskFunds: number;           // USD directly at risk
  };
  maxSingleTx: number;            // Max extractable in single tx (USD)
  requiredCapital: number;         // Capital needed to execute (for flash loan attacks, USD)
}

export interface PoCValueResult {
  succeeded: boolean;
  extractedEth: number;
  extractedTokensUsd: number;
  extractedValueUsd: number;
  gasUsed: string | null;
  gasCostUsd: number;
  netProfit: number;
}

export interface FlashLoanEfficiency {
  requiredCapital: number;   // USD
  extractable: number;       // USD
  efficiency: number;        // extractable / requiredCapital (0-1)
}

export const EXPLOIT_VALUE_THRESHOLDS = {
  critical: { minExploitable: 100_000 },  // $100K+ = immediate alert
  high:     { minExploitable: 25_000 },    // $25K+ = alert during active hours
  logged:   { minExploitable: 1_000 },     // $1K+ = log only
  ignore:   { maxExploitable: 1_000 },     // <$1K = ignore completely
} as const;

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

// ── Wallet & Enhanced Verification ──

export type EnhancedConfidence = 'definitive' | 'high' | 'medium' | 'low';

export interface WalletStatusInfo {
  address: string;
  chainCount: number;
  totalValueUsd: number;
  lowBalanceChains: string[];
  isUnlocked: boolean;
}

// ── Intelligence Layer: Pattern Cache & Fork Hunting ──

export interface CodeSignatures {
  exactMatch: string[];
  regexPatterns: string[];
  functionSignatures: string[];   // Function selectors found in vulnerable code
  eventSignatures: string[];      // Event signatures near vulnerable code
}

export interface VulnerabilityPattern {
  id: string;
  patternHash: string;
  patternType: string;            // e.g., 'reentrancy', 'access-control', 'oracle'
  codeSignatures: CodeSignatures;
  firstSeenContract: string;
  firstSeenChain: number;
  firstSeenDate: string;
  falsePositiveSignatures: string[];
  truePositiveRate: number;
  totalValueAtRisk: number;
  exploitTemplate: ExploitTemplate | null;
  evolutionHistory: PatternEvolutionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExploitTemplate {
  soliditySnippet: string;        // Key exploit logic
  detectorName: string;           // Which detector found it
  attackVector: string;           // e.g., 'reentrancy', 'flash-loan'
  requiredSetup: string[];        // e.g., ['flash-loan-provider', 'token-approval']
}

export interface PatternEvolutionEntry {
  date: string;
  change: string;
  reason: string;
}

export interface PatternInstance {
  patternId: string;
  contractAddress: string;
  chainId: number;
  exploitableValue: number;
  verified: boolean;
  verifiedDate: string | null;
  verificationMethod: string | null;
}

export interface ContractFingerprint {
  contractAddress: string;
  chainId: number;
  contractName: string;
  codeHash: string;
  normalizedHash: string;
  structureHash: string;
  interfaceHash: string;
  functionSignatures: string[];
  eventSignatures: string[];
  bytecodeHash: string | null;
  createdAt: string;
}

export interface ForkMatch {
  address: string;
  chainId: number;
  chainName: string;
  contractName: string;
  matchMethod: 'exact_code' | 'normalized_code' | 'structure' | 'interface' | 'name_search';
  confidence: number;            // 0.0 - 1.0
  protocolName?: string;
  protocolTvl?: number;
}

export interface VerifiedFork {
  isVulnerable: boolean;
  address?: string;
  chainId?: number;
  chainName?: string;
  contractName?: string;
  exploitableValue?: number;
  reason?: string;               // Why it was/wasn't vulnerable
  patchDetails?: string;         // What patch was applied
}

export interface ForkHuntResult {
  originalAddress: string;
  originalChain: number;
  patternId: string;
  forksSearched: number;
  verifiedVulnerable: VerifiedFork[];
  totalValueAtRisk: number;
  chainsAffected: number;
  duration: number;              // ms
}

export interface LearningStats {
  totalPatterns: number;
  totalInstances: number;
  totalFingerprints: number;
  totalValueTracked: number;
  averageTruePositiveRate: number;
  patternsByType: Array<{ patternType: string; count: number; value: number }>;
  recentLearningEvents: Array<{ eventType: string; count: number }>;
}

export interface EvolutionReport {
  patternsRefined: number;
  newPatternsLearned: number;
  falsePositivesIdentified: number;
  accuracyImprovement: number;
  insights: string[];
  summary: string;
}
