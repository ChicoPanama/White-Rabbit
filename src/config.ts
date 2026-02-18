import 'dotenv/config';
import { CHAINS, type ChainConfig, type Severity, getChainConfig, getHighValueChains } from './types/index.js';

export interface AIConfig {
  modelHaiku: string;
  modelSonnet: string;
  maxCallsPerHour: number;
  maxSpendPerDay: number;
  minTvlForAi: number;
  minTvlForSonnet: number;
  disableAiAnalysis: boolean;
}

/** Micro-protocol hunting configuration */
export interface MicroProtocolConfig {
  enabled: boolean;
  minTvl: number;                    // Minimum TVL to scan (default: $10K)
  maxTvl: number;                    // Maximum TVL to scan (default: $1M)
  primaryChain: string;              // Focus chain (default: base)
  alertMinValue: number;             // Minimum finding value for alerts (default: $10K)
  prioritizeNewDeployments: boolean; // Scan new contracts first
  maxDeployAgeDays: number;          // Max age for "new" contracts (default: 30)
}

export interface AIRateLimitConfig {
  rpm: number;                    // Requests per minute (global across workers)
  minDelayMs: number;             // Minimum delay between API calls
  maxAttempts: number;            // Max retry attempts per job
  cooldownMs: number;             // Cooldown after consecutive 429s
  consecutive429Threshold: number; // Number of 429s before entering cooldown
}

export type WorkerMode = 'scanner' | 'ai_worker' | 'worker';

export interface Config {
  etherscanApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  anthropicApiKey: string | null;
  databaseUrl: string;
  redisUrl: string;
  minTvlThreshold: number;
  maxTvlThreshold: number;           // Added: cap for micro-protocol hunting
  scanChains: ChainConfig[];
  alertMinSeverity: Severity;
  alertMinValue: number;             // Added: minimum exploit value for alerts
  etherscanRequestIntervalMs: number;
  defiLlamaCacheTtlMs: number;
  ai: AIConfig;
  aiRateLimit: AIRateLimitConfig;
  workerMode: WorkerMode;
  useAiQueue: boolean; // If true, enqueue AI jobs instead of direct calls
  microProtocol: MicroProtocolConfig; // Added: micro-protocol hunting config
  // Analysis Pipeline Configuration
  enableDeepAnalysis: boolean;       // Enable full 6-tool pipeline (vs quick Slither+Pattern)
  enableMythril: boolean;            // Enable Mythril symbolic execution
  enableSecurify: boolean;           // Enable Securify2 formal verification
  enableMaian: boolean;              // Enable MAIAN dynamic analysis
}

export function loadConfig(): Config {
  const requiredVars = ['ETHERSCAN_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DATABASE_URL', 'REDIS_URL'];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      throw new Error(`Missing required environment variable: ${v}`);
    }
  }

  const chainNames = (process.env.SCAN_CHAINS || 'ethereum,base,arbitrum')
    .split(',')
    .map(c => c.trim().toLowerCase());

  const scanChains: ChainConfig[] = [];
  for (const name of chainNames) {
    const chain = CHAINS[name];
    if (!chain) {
      throw new Error(`Unknown chain: ${name}. Available: ${Object.keys(CHAINS).join(', ')}`);
    }
    scanChains.push(chain);
  }

  const severityMap: Record<string, Severity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    informational: 'informational',
  };
  const rawSeverity = (process.env.ALERT_MIN_SEVERITY || 'medium').toLowerCase();
  const alertMinSeverity = severityMap[rawSeverity];
  if (!alertMinSeverity) {
    throw new Error(`Invalid ALERT_MIN_SEVERITY: ${rawSeverity}`);
  }

  const ai: AIConfig = {
    modelHaiku: process.env.AI_MODEL_HAIKU || 'claude-haiku-4-5-20251001',
    modelSonnet: process.env.AI_MODEL_SONNET || 'claude-sonnet-4-20250514',
    maxCallsPerHour: Number(process.env.MAX_AI_CALLS_PER_HOUR) || 20,
    maxSpendPerDay: Number(process.env.MAX_AI_SPEND_PER_DAY) || 1.0,
    minTvlForAi: Number(process.env.MIN_TVL_FOR_AI) || 1_000_000,
    minTvlForSonnet: Number(process.env.MIN_TVL_FOR_SONNET) || 50_000_000,
    disableAiAnalysis: process.env.DISABLE_AI_ANALYSIS === 'true',
  };

  // Global AI rate limiting (Redis-backed, shared across all workers)
  const aiRateLimit: AIRateLimitConfig = {
    rpm: Number(process.env.WR_AI_RPM) || 2,
    minDelayMs: Number(process.env.WR_AI_MIN_DELAY_MS) || 12000,
    maxAttempts: Number(process.env.WR_AI_MAX_ATTEMPTS) || 5,
    cooldownMs: Number(process.env.WR_AI_COOLDOWN_MS) || 120000,
    consecutive429Threshold: Number(process.env.WR_AI_429_THRESHOLD) || 3,
  };

  // Worker mode: scanner (discovery + enqueue), ai_worker (process AI queue), worker (legacy BullMQ)
  const workerMode = (process.env.WR_MODE || 'scanner') as WorkerMode;

  // Use AI queue by default when running multiple replicas or explicit opt-in
  const useAiQueue = process.env.WR_USE_AI_QUEUE !== 'false';

  // Micro-protocol hunting configuration
  const microProtocolEnabled = process.env.WR_MICRO_PROTOCOL_ENABLED === 'true';
  const microProtocol: MicroProtocolConfig = {
    enabled: microProtocolEnabled,
    minTvl: Number(process.env.WR_MICRO_MIN_TVL) || 10_000,        // $10K default
    maxTvl: Number(process.env.WR_MICRO_MAX_TVL) || 1_000_000,     // $1M default
    primaryChain: process.env.WR_MICRO_PRIMARY_CHAIN || 'base',
    alertMinValue: Number(process.env.WR_MICRO_ALERT_MIN_VALUE) || 10_000,
    prioritizeNewDeployments: process.env.WR_MICRO_PRIORITIZE_NEW !== 'false',
    maxDeployAgeDays: Number(process.env.WR_MICRO_MAX_DEPLOY_AGE) || 30,
  };

  // If micro-protocol mode is enabled, adjust defaults
  const effectiveMinTvl = microProtocolEnabled
    ? microProtocol.minTvl
    : (Number(process.env.MIN_TVL_THRESHOLD) || 10_000_000);

  const effectiveMaxTvl = Number(process.env.MAX_TVL_THRESHOLD) || (microProtocolEnabled ? microProtocol.maxTvl : Number.MAX_SAFE_INTEGER);

  // Analysis pipeline configuration (deep analysis disabled by default)
  const enableDeepAnalysis = process.env.WR_ENABLE_DEEP_ANALYSIS === 'true';
  const enableMythril = process.env.WR_ENABLE_MYTHRIL === 'true';
  const enableSecurify = process.env.WR_ENABLE_SECURIFY === 'true';
  const enableMaian = process.env.WR_ENABLE_MAIAN === 'true';

  return {
    etherscanApiKey: process.env.ETHERSCAN_API_KEY!,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    telegramChatId: process.env.TELEGRAM_CHAT_ID!,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    databaseUrl: process.env.DATABASE_URL!,
    redisUrl: process.env.REDIS_URL!,
    minTvlThreshold: effectiveMinTvl,
    maxTvlThreshold: effectiveMaxTvl,
    scanChains,
    alertMinSeverity,
    alertMinValue: Number(process.env.ALERT_MIN_VALUE) || (microProtocolEnabled ? 10_000 : 25_000),
    etherscanRequestIntervalMs: 200,
    defiLlamaCacheTtlMs: 5 * 60 * 1000,
    ai,
    aiRateLimit,
    workerMode,
    useAiQueue,
    microProtocol,
    enableDeepAnalysis,
    enableMythril,
    enableSecurify,
    enableMaian,
  };
}

/**
 * Get hunting range description for logging
 */
export function getHuntingRangeDescription(config: Config): string {
  const minStr = config.minTvlThreshold >= 1_000_000
    ? `$${(config.minTvlThreshold / 1_000_000).toFixed(1)}M`
    : `$${(config.minTvlThreshold / 1_000).toFixed(0)}K`;

  const maxStr = config.maxTvlThreshold >= Number.MAX_SAFE_INTEGER
    ? 'unlimited'
    : config.maxTvlThreshold >= 1_000_000
      ? `$${(config.maxTvlThreshold / 1_000_000).toFixed(1)}M`
      : `$${(config.maxTvlThreshold / 1_000).toFixed(0)}K`;

  return `${minStr} - ${maxStr}`;
}
