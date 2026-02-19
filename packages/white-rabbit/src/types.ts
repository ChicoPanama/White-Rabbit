// ═══════════════════════════════════════════════════════════════════════════════
// White-Rabbit v2.0 - Core Types
// Portable smart contract security scanner types for @whiteclaws/white-rabbit
// ═══════════════════════════════════════════════════════════════════════════════

// ── Severity & Confidence ──

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type Confidence = 'high' | 'medium' | 'low';
export type EnhancedConfidence = 'definitive' | 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[b] - SEVERITY_ORDER[a];
}

// ── Chain Configuration ──

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  etherscanApiUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    id: 1,
    name: 'ethereum',
    rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    etherscanApiUrl: 'https://api.etherscan.io/api',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  base: {
    id: 8453,
    name: 'base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
    explorerUrl: 'https://basescan.org',
    etherscanApiUrl: 'https://api.basescan.org/api',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  arbitrum: {
    id: 42161,
    name: 'arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    etherscanApiUrl: 'https://api.arbiscan.io/api',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  optimism: {
    id: 10,
    name: 'optimism',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    etherscanApiUrl: 'https://api-optimistic.etherscan.io/api',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  polygon: {
    id: 137,
    name: 'polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
    explorerUrl: 'https://polygonscan.com',
    etherscanApiUrl: 'https://api.polygonscan.com/api',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  },
  bsc: {
    id: 56,
    name: 'bsc',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    etherscanApiUrl: 'https://api.bscscan.com/api',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  avalanche: {
    id: 43114,
    name: 'avalanche',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    etherscanApiUrl: 'https://api.snowtrace.io/api',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  },
  fantom: {
    id: 250,
    name: 'fantom',
    rpcUrl: process.env.FANTOM_RPC_URL || 'https://rpc.ftm.tools',
    explorerUrl: 'https://ftmscan.com',
    etherscanApiUrl: 'https://api.ftmscan.com/api',
    nativeCurrency: { name: 'FTM', symbol: 'FTM', decimals: 18 },
  },
  linea: {
    id: 59144,
    name: 'linea',
    rpcUrl: process.env.LINEA_RPC_URL || 'https://rpc.linea.build',
    explorerUrl: 'https://lineascan.build',
    etherscanApiUrl: 'https://api.lineascan.build/api',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  scroll: {
    id: 534352,
    name: 'scroll',
    rpcUrl: process.env.SCROLL_RPC_URL || 'https://rpc.scroll.io',
    explorerUrl: 'https://scrollscan.com',
    etherscanApiUrl: 'https://api.scrollscan.com/api',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  blast: {
    id: 81457,
    name: 'blast',
    rpcUrl: process.env.BLAST_RPC_URL || 'https://rpc.blast.io',
    explorerUrl: 'https://blastscan.io',
    etherscanApiUrl: 'https://api.blastscan.io/api',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  gnosis: {
    id: 100,
    name: 'gnosis',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    explorerUrl: 'https://gnosisscan.io',
    etherscanApiUrl: 'https://api.gnosisscan.io/api',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  },
};

export function getChainConfig(nameOrId: string | number): ChainConfig | undefined {
  if (typeof nameOrId === 'number') {
    return Object.values(CHAIN_CONFIGS).find(c => c.id === nameOrId);
  }
  return CHAIN_CONFIGS[nameOrId.toLowerCase()];
}

export function getHighValueChains(): ChainConfig[] {
  return [
    CHAIN_CONFIGS.ethereum,
    CHAIN_CONFIGS.base,
    CHAIN_CONFIGS.arbitrum,
    CHAIN_CONFIGS.optimism,
    CHAIN_CONFIGS.polygon,
    CHAIN_CONFIGS.bsc,
    CHAIN_CONFIGS.avalanche,
  ];
}

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
  bytecode?: string;
  deployedBlock?: number;
  deployerAddress?: string;
}

export interface ContractMetadata {
  name: string;
  symbol?: string;
  isProxy: boolean;
  implementationAddress?: string;
  compilerVersion: string;
  optimizationEnabled?: boolean;
  runs?: number;
  evmVersion?: string;
  library?: string;
  licenseType?: string;
}

// ── Findings ──

/** Base finding properties - common across all finding types */
export interface BaseFinding {
  detectorName: string;
  tool: string;
  severity: Severity;
  confidence?: Confidence;
  title?: string;
  description: string;
  codeSnippet?: string | null;
  filePath?: string | null;
  lineStart?: number | null;
  lineEnd?: number | null;
}

/** Full Finding type with database identifiers */
export interface Finding extends BaseFinding {
  id: string;
  scanId: string;
  contractId: string;
  confidence: Confidence;
  title: string;
  codeSnippet: string | null;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  aiAssessment: string | null;
  aiIsFalsePositive: boolean | null;
  deduplicatedGroupId: string | null;
  /** Optional metadata for tool-specific findings (e.g., MAIAN, Mythril, Securify) */
  metadata?: Record<string, unknown>;
  /** Tools that corroborated this finding */
  corroboratedBy?: string[];
}

/** Finding before database insertion */
export interface NewFinding extends BaseFinding {
  confidence: Confidence;
  title: string;
  codeSnippet: string | null;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
}

// ── Verification ──

export type VerificationStatus =
  | 'verified'       // PoC exploit succeeded on fork
  | 'likely_real'    // 2+ tools agree, high confidence
  | 'needs_review'   // Single tool, medium confidence
  | 'likely_false'   // PoC failed or low confidence
  | 'false_positive'; // Matches known FP pattern

export interface PoCResult {
  attempted: boolean;
  succeeded: boolean;
  exploitContract: string | null;
  forkBlockNumber: number | null;
  errorMessage: string | null;
  gasUsed: string | null;
  extractedValue: PoCValueResult | null;
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

export interface ExploitEstimate {
  protocolTvl: number;
  contractBalance: number;
  estimatedExploitable: number;
  exploitablePercentage: number;
  confidence: 'high' | 'medium' | 'low';
  methodology: string;
  breakdown: {
    ethBalance: number;
    tokenBalances: TokenBalance[];
    lockedFunds: number;
    atRiskFunds: number;
  };
  maxSingleTx: number;
  requiredCapital: number;
}

export interface TokenBalance {
  symbol: string;
  address: string;
  amount: number;
  valueUsd: number;
}

export interface VerifiedFinding extends Finding {
  verificationStatus: VerificationStatus;
  confidenceScore: number; // 0-100
  pocResult: PoCResult | null;
  contextInfo: ContractContext | null;
  toolsAgreeing: string[];
  exploitEstimate: ExploitEstimate | null;
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

export interface ScanResult {
  scan: Scan;
  findings: Finding[];
  verifiedFindings: VerifiedFinding[];
  stats: ScanStats;
  duration: number;
}

export interface ScanStats {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byTool: Record<string, number>;
  verifiedCount: number;
  falsePositiveCount: number;
  needsReviewCount: number;
}

// ── Analysis Engine Types ──

export interface AnalysisEngine {
  name: string;
  version: string;
  isAvailable(): Promise<boolean>;
  analyze(contract: Contract, options?: EngineOptions): Promise<EngineResult>;
}

export interface EngineOptions {
  timeoutMs?: number;
  maxMemoryMb?: number;
  includeAiAnalysis?: boolean;
  continueOnError?: boolean;
}

export interface EngineResult {
  success: boolean;
  findings: Finding[];
  errors: string[];
  duration: number;
  metadata?: Record<string, unknown>;
}

// ── Pipeline Types ──

export interface PipelineOptions {
  enableSlither?: boolean;
  enablePattern?: boolean;
  enableMythril?: boolean;
  enableSecurify?: boolean;
  enableMaian?: boolean;
  enableAI?: boolean;
  continueOnError?: boolean;
  timeoutMs?: number;
}

export interface PipelineResult {
  contract: Contract;
  findings: Finding[];
  stats: PipelineStats;
  errors: PipelineError[];
}

export interface PipelineStats {
  total: number;
  byTool: Record<string, number>;
  bySeverity: Record<Severity, number>;
  duration: number;
}

export interface PipelineError {
  tool: string;
  error: string;
  fatal: boolean;
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

export interface AIConfig {
  model: string;
  apiKey: string;
  maxCallsPerHour?: number;
  maxSpendPerDay?: number;
  minTvlForAi?: number;
  enabled?: boolean;
}

// ── WhiteClaws API Types ──

export interface WhiteClawsCredentials {
  apiKey: string;
  baseUrl?: string;
}

export interface ScanRequest {
  address: string;
  chain: string | number;
  options?: PipelineOptions;
  callbackUrl?: string;
}

export interface ScanResponse {
  scanId: string;
  status: ScanStatus;
  estimatedDuration: number;
  resultsUrl?: string;
}

export interface ProtocolInfo {
  id: string;
  name: string;
  slug: string;
  chains: string[];
  tvl: number;
  category: string;
  url: string;
}

// ── Configuration ──

export interface ScannerConfig {
  // API Keys
  etherscanApiKey?: string;
  whiteclawsApiKey?: string;
  anthropicApiKey?: string;
  
  // Chain Configuration
  chains?: ChainConfig[];
  defaultChain?: string;
  
  // Analysis Options
  enableDeepAnalysis?: boolean;
  enableMythril?: boolean;
  enableSecurify?: boolean;
  enableMaian?: boolean;
  enableAI?: boolean;
  
  // Filtering
  minSeverity?: Severity;
  minConfidence?: Confidence;
  
  // Timeouts
  timeoutMs?: number;
  slitherTimeoutMs?: number;
  mythrilTimeoutMs?: number;
  
  // Output
  outputFormat?: 'json' | 'sarif' | 'markdown';
  outputPath?: string;
}

// ── Output Formats ──

export interface SarifOutput {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: {
    text: string;
  };
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note';
  };
}

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: {
    text: string;
  };
  locations: SarifLocation[];
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
    };
    region: {
      startLine: number;
      endLine?: number;
    };
  };
}

// ── Error Types ──

export class ScannerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}

export class EngineNotAvailableError extends ScannerError {
  constructor(engine: string) {
    super(
      `Analysis engine '${engine}' is not available`,
      'ENGINE_NOT_AVAILABLE',
      { engine }
    );
    this.name = 'EngineNotAvailableError';
  }
}

export class ContractNotVerifiedError extends ScannerError {
  constructor(address: string, chainId: number) {
    super(
      `Contract ${address} on chain ${chainId} is not verified`,
      'CONTRACT_NOT_VERIFIED',
      { address, chainId }
    );
    this.name = 'ContractNotVerifiedError';
  }
}

export class TimeoutError extends ScannerError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      { operation, timeoutMs }
    );
    this.name = 'TimeoutError';
  }
}
