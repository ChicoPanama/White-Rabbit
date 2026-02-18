#!/usr/bin/env tsx
/**
 * WHITE RABBIT - Config Unit Tests
 * 
 * Tests for configuration loading and validation.
 */

import { strict as assert } from 'assert';
import { loadConfig, getHuntingRangeDescription, Config } from '../../src/config.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error, duration: Date.now() - start });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error}`);
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(title);
  console.log('='.repeat(70));
}

// Store original env vars
const ORIGINAL_ENV = { ...process.env };

function setTestEnv(vars: Record<string, string | undefined>) {
  // Clear relevant env vars first
  delete process.env.ETHERSCAN_API_KEY;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
  delete process.env.SCAN_CHAINS;
  delete process.env.ALERT_MIN_SEVERITY;
  delete process.env.WR_ENABLE_DEEP_ANALYSIS;
  delete process.env.WR_ENABLE_MYTHRIL;
  delete process.env.WR_ENABLE_SECURIFY;
  delete process.env.WR_ENABLE_MAIAN;
  
  // Set test vars
  Object.entries(vars).forEach(([key, value]) => {
    if (value !== undefined) {
      process.env[key] = value;
    }
  });
}

function restoreEnv() {
  Object.keys(process.env).forEach(key => {
    delete process.env[key];
  });
  Object.entries(ORIGINAL_ENV).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

async function main() {
  section('CONFIG UNIT TESTS');

  // =============================================================================
  // SECTION 1: Required Environment Variables
  // =============================================================================

  section('SECTION 1: Required Environment Variables');

  await runTest('should throw when ETHERSCAN_API_KEY is missing', () => {
    setTestEnv({
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    assert.throws(() => loadConfig(), /ETHERSCAN_API_KEY/);
  });

  await runTest('should throw when TELEGRAM_BOT_TOKEN is missing', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    assert.throws(() => loadConfig(), /TELEGRAM_BOT_TOKEN/);
  });

  await runTest('should throw when TELEGRAM_CHAT_ID is missing', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    assert.throws(() => loadConfig(), /TELEGRAM_CHAT_ID/);
  });

  await runTest('should throw when DATABASE_URL is missing', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    assert.throws(() => loadConfig(), /DATABASE_URL/);
  });

  await runTest('should throw when REDIS_URL is missing', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
    });
    
    assert.throws(() => loadConfig(), /REDIS_URL/);
  });

  // =============================================================================
  // SECTION 2: Default Configuration
  // =============================================================================

  section('SECTION 2: Default Configuration');

  await runTest('should load with all required vars', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.ok(config);
    assert.strictEqual(config.etherscanApiKey, 'test-key');
    assert.strictEqual(config.telegramBotToken, 'test-token');
    assert.strictEqual(config.telegramChatId, 'test-chat');
    assert.strictEqual(config.databaseUrl, 'postgres://localhost/test');
    assert.strictEqual(config.redisUrl, 'redis://localhost:6379');
  });

  await runTest('should default scan chains to ethereum,base,arbitrum', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.scanChains.length, 3);
    assert.ok(config.scanChains.some(c => c.name === 'Ethereum'));
    assert.ok(config.scanChains.some(c => c.name === 'Base'));
    assert.ok(config.scanChains.some(c => c.name === 'Arbitrum One'));
  });

  await runTest('should parse SCAN_CHAINS correctly', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      SCAN_CHAINS: 'ethereum,polygon',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.scanChains.length, 2);
    assert.ok(config.scanChains.some(c => c.name === 'Ethereum'));
    assert.ok(config.scanChains.some(c => c.name === 'Polygon'));
  });

  await runTest('should throw on invalid chain name', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      SCAN_CHAINS: 'invalidchain',
    });
    
    assert.throws(() => loadConfig(), /Unknown chain/);
  });

  await runTest('should default alert severity to medium', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.alertMinSeverity, 'medium');
  });

  await runTest('should parse ALERT_MIN_SEVERITY correctly', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      ALERT_MIN_SEVERITY: 'high',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.alertMinSeverity, 'high');
  });

  await runTest('should throw on invalid severity', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      ALERT_MIN_SEVERITY: 'invalid',
    });
    
    assert.throws(() => loadConfig(), /Invalid ALERT_MIN_SEVERITY/);
  });

  // =============================================================================
  // SECTION 3: AI Configuration
  // =============================================================================

  section('SECTION 3: AI Configuration');

  await runTest('should have default AI config', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.ok(config.ai);
    assert.ok(config.ai.modelHaiku);
    assert.ok(config.ai.modelSonnet);
    assert.strictEqual(typeof config.ai.maxCallsPerHour, 'number');
    assert.strictEqual(typeof config.ai.maxSpendPerDay, 'number');
  });

  await runTest('should parse AI environment variables', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      MAX_AI_CALLS_PER_HOUR: '50',
      MAX_AI_SPEND_PER_DAY: '5.00',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.ai.maxCallsPerHour, 50);
    assert.strictEqual(config.ai.maxSpendPerDay, 5.00);
  });

  await runTest('should handle DISABLE_AI_ANALYSIS', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      DISABLE_AI_ANALYSIS: 'true',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.ai.disableAiAnalysis, true);
  });

  // =============================================================================
  // SECTION 4: Pipeline Configuration
  // =============================================================================

  section('SECTION 4: Pipeline Configuration');

  await runTest('should default enableDeepAnalysis to false', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.enableDeepAnalysis, false);
  });

  await runTest('should parse WR_ENABLE_DEEP_ANALYSIS', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      WR_ENABLE_DEEP_ANALYSIS: 'true',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.enableDeepAnalysis, true);
  });

  await runTest('should default pipeline tool flags to false', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.enableMythril, false);
    assert.strictEqual(config.enableSecurify, false);
    assert.strictEqual(config.enableMaian, false);
  });

  await runTest('should parse pipeline tool flags', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      WR_ENABLE_MYTHRIL: 'true',
      WR_ENABLE_SECURIFY: 'true',
      WR_ENABLE_MAIAN: 'true',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.enableMythril, true);
    assert.strictEqual(config.enableSecurify, true);
    assert.strictEqual(config.enableMaian, true);
  });

  // =============================================================================
  // SECTION 5: Micro-Protocol Configuration
  // =============================================================================

  section('SECTION 5: Micro-Protocol Configuration');

  await runTest('should have microProtocol config', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.ok(config.microProtocol);
    assert.strictEqual(typeof config.microProtocol.enabled, 'boolean');
  });

  await runTest('should enable microProtocol with env var', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      WR_MICRO_PROTOCOL_ENABLED: 'true',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.microProtocol.enabled, true);
  });

  await runTest('should use microProtocol TVL thresholds when enabled', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      WR_MICRO_PROTOCOL_ENABLED: 'true',
      WR_MICRO_MIN_TVL: '5000',
      WR_MICRO_MAX_TVL: '500000',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.minTvlThreshold, 5000);
    assert.strictEqual(config.maxTvlThreshold, 500000);
  });

  // =============================================================================
  // SECTION 6: Hunting Range Description
  // =============================================================================

  section('SECTION 6: Hunting Range Description');

  await runTest('should format hunting range correctly', () => {
    const config: Config = {
      minTvlThreshold: 10_000_000,
      maxTvlThreshold: Number.MAX_SAFE_INTEGER,
    } as Config;
    
    const desc = getHuntingRangeDescription(config);
    assert.ok(desc.includes('$10.0M'));
    assert.ok(desc.includes('unlimited'));
  });

  await runTest('should format micro-protocol range correctly', () => {
    const config: Config = {
      minTvlThreshold: 10_000,
      maxTvlThreshold: 1_000_000,
    } as Config;
    
    const desc = getHuntingRangeDescription(config);
    assert.ok(desc.includes('$10K'));
    assert.ok(desc.includes('$1.0M'));
  });

  // =============================================================================
  // SECTION 7: Worker Mode
  // =============================================================================

  section('SECTION 7: Worker Mode');

  await runTest('should default worker mode to scanner', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.workerMode, 'scanner');
  });

  await runTest('should parse WR_MODE', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      WR_MODE: 'ai_worker',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.workerMode, 'ai_worker');
  });

  await runTest('should default useAiQueue to true', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.useAiQueue, true);
  });

  await runTest('should parse WR_USE_AI_QUEUE', () => {
    setTestEnv({
      ETHERSCAN_API_KEY: 'test-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat',
      DATABASE_URL: 'postgres://localhost/test',
      REDIS_URL: 'redis://localhost:6379',
      WR_USE_AI_QUEUE: 'false',
    });
    
    const config = loadConfig();
    assert.strictEqual(config.useAiQueue, false);
  });

  // =============================================================================
  // TEST SUMMARY
  // =============================================================================

  section('TEST SUMMARY');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal: ${results.length} tests`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Duration: ${totalDuration}ms`);

  restoreEnv();

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL CONFIG UNIT TESTS PASSED! 🎉');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  restoreEnv();
  process.exit(1);
});
