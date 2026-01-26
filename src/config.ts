import { CHAINS, type ChainConfig, type Severity } from './types/index.js';

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
  };
}
