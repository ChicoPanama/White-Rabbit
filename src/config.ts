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
  scanChains: ChainConfig[];
  alertMinSeverity: Severity;
  etherscanRequestIntervalMs: number;
  defiLlamaCacheTtlMs: number;
  ai: AIConfig;
  aiRateLimit: AIRateLimitConfig;
  workerMode: WorkerMode;
  useAiQueue: boolean; // If true, enqueue AI jobs instead of direct calls
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

  return {
    etherscanApiKey: process.env.ETHERSCAN_API_KEY!,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    telegramChatId: process.env.TELEGRAM_CHAT_ID!,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    databaseUrl: process.env.DATABASE_URL!,
    redisUrl: process.env.REDIS_URL!,
    minTvlThreshold: Number(process.env.MIN_TVL_THRESHOLD) || 10_000_000,
    scanChains,
    alertMinSeverity,
    etherscanRequestIntervalMs: 200,
    defiLlamaCacheTtlMs: 5 * 60 * 1000,
    ai,
    aiRateLimit,
    workerMode,
    useAiQueue,
  };
}
