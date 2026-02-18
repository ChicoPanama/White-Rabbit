#!/usr/bin/env tsx
/**
 * WHITE RABBIT - Types Unit Tests
 * 
 * Tests for type definitions and utilities.
 */

import { strict as assert } from 'assert';
import { 
  CHAINS, 
  SEVERITY_ORDER, 
  CHAIN_RPC_ENV,
  EXPLOIT_VALUE_THRESHOLDS,
  Severity,
} from '../../src/types/index.js';

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

async function main() {
  section('TYPES UNIT TESTS');

  // =============================================================================
  // SECTION 1: Chain Configurations
  // =============================================================================

  section('SECTION 1: Chain Configurations');

  await runTest('should have Ethereum chain config', () => {
    assert.ok(CHAINS.ethereum);
    assert.strictEqual(CHAINS.ethereum.name, 'Ethereum');
    assert.strictEqual(CHAINS.ethereum.chainId, 1);
  });

  await runTest('should have Base chain config', () => {
    assert.ok(CHAINS.base);
    assert.strictEqual(CHAINS.base.name, 'Base');
    assert.strictEqual(CHAINS.base.chainId, 8453);
  });

  await runTest('should have Arbitrum chain config', () => {
    assert.ok(CHAINS.arbitrum);
    assert.strictEqual(CHAINS.arbitrum.name, 'Arbitrum One');
    assert.strictEqual(CHAINS.arbitrum.chainId, 42161);
  });

  await runTest('should have Polygon chain config', () => {
    assert.ok(CHAINS.polygon);
    assert.strictEqual(CHAINS.polygon.name, 'Polygon');
    assert.strictEqual(CHAINS.polygon.chainId, 137);
  });

  await runTest('should have BSC chain config', () => {
    assert.ok(CHAINS.bsc);
    assert.ok(CHAINS.bsc.name.includes('BNB') || CHAINS.bsc.name.includes('BSC'), 
      'BSC name should include BNB or BSC');
    assert.strictEqual(CHAINS.bsc.chainId, 56);
  });

  await runTest('should have Optimism chain config', () => {
    assert.ok(CHAINS.optimism);
    assert.strictEqual(CHAINS.optimism.name, 'Optimism');
    assert.strictEqual(CHAINS.optimism.chainId, 10);
  });

  await runTest('should have all required chain properties', () => {
    Object.values(CHAINS).forEach(chain => {
      assert.ok(chain.name, 'Chain should have name');
      assert.ok(typeof chain.chainId === 'number', 'Chain should have numeric chainId');
      assert.ok(chain.blockExplorer, 'Chain should have blockExplorer');
      assert.ok(chain.nativeCurrency, 'Chain should have nativeCurrency');
      assert.ok(chain.tier, 'Chain should have tier');
    });
  });

  await runTest('should have unique chain IDs', () => {
    const chainIds = Object.values(CHAINS).map(c => c.chainId);
    const uniqueIds = new Set(chainIds);
    assert.strictEqual(uniqueIds.size, chainIds.length, 'All chain IDs should be unique');
  });

  // =============================================================================
  // SECTION 2: Severity Order
  // =============================================================================

  section('SECTION 2: Severity Order');

  await runTest('should have correct severity order values', () => {
    assert.strictEqual(SEVERITY_ORDER.critical, 5);
    assert.strictEqual(SEVERITY_ORDER.high, 4);
    assert.strictEqual(SEVERITY_ORDER.medium, 3);
    assert.strictEqual(SEVERITY_ORDER.low, 2);
    assert.strictEqual(SEVERITY_ORDER.informational, 1);
  });

  await runTest('should allow severity comparison', () => {
    assert.ok(SEVERITY_ORDER.critical > SEVERITY_ORDER.high);
    assert.ok(SEVERITY_ORDER.high > SEVERITY_ORDER.medium);
    assert.ok(SEVERITY_ORDER.medium > SEVERITY_ORDER.low);
    assert.ok(SEVERITY_ORDER.low > SEVERITY_ORDER.informational);
  });

  await runTest('should correctly identify highest severity', () => {
    const severities: Severity[] = ['high', 'critical', 'medium', 'low'];
    const highest = severities.reduce((max, s) => 
      SEVERITY_ORDER[s] > SEVERITY_ORDER[max] ? s : max
    );
    assert.strictEqual(highest, 'critical');
  });

  // =============================================================================
  // SECTION 3: Chain RPC Environment Variables
  // =============================================================================

  section('SECTION 3: Chain RPC Environment Variables');

  await runTest('should have RPC env for Ethereum', () => {
    assert.strictEqual(CHAIN_RPC_ENV.ethereum, 'ETH_RPC_URL');
  });

  await runTest('should have RPC env for major chains', () => {
    assert.ok(CHAIN_RPC_ENV.base, 'Base should have RPC env');
    assert.ok(CHAIN_RPC_ENV.arbitrum, 'Arbitrum should have RPC env');
    assert.ok(CHAIN_RPC_ENV.polygon, 'Polygon should have RPC env');
    assert.ok(CHAIN_RPC_ENV.bsc, 'BSC should have RPC env');
    assert.ok(CHAIN_RPC_ENV.optimism, 'Optimism should have RPC env');
  });

  await runTest('should have consistent naming pattern', () => {
    Object.entries(CHAIN_RPC_ENV).forEach(([chain, envVar]) => {
      assert.ok(envVar.endsWith('_RPC_URL'), `${chain} RPC env should end with _RPC_URL`);
    });
  });

  // =============================================================================
  // SECTION 4: Exploit Value Thresholds
  // =============================================================================

  section('SECTION 4: Exploit Value Thresholds');

  await runTest('should have correct critical threshold', () => {
    assert.strictEqual(EXPLOIT_VALUE_THRESHOLDS.critical.minExploitable, 100_000);
  });

  await runTest('should have correct high threshold', () => {
    assert.strictEqual(EXPLOIT_VALUE_THRESHOLDS.high.minExploitable, 25_000);
  });

  await runTest('should have correct logged threshold', () => {
    assert.strictEqual(EXPLOIT_VALUE_THRESHOLDS.logged.minExploitable, 1_000);
  });

  await runTest('should have correct ignore threshold', () => {
    assert.strictEqual(EXPLOIT_VALUE_THRESHOLDS.ignore.maxExploitable, 1_000);
  });

  await runTest('should have ascending threshold values', () => {
    assert.ok(EXPLOIT_VALUE_THRESHOLDS.critical.minExploitable > 
              EXPLOIT_VALUE_THRESHOLDS.high.minExploitable);
    assert.ok(EXPLOIT_VALUE_THRESHOLDS.high.minExploitable > 
              EXPLOIT_VALUE_THRESHOLDS.logged.minExploitable);
  });

  await runTest('should correctly categorize values', () => {
    const testValue = 50000; // $50K
    
    const isCritical = testValue >= EXPLOIT_VALUE_THRESHOLDS.critical.minExploitable;
    const isHigh = testValue >= EXPLOIT_VALUE_THRESHOLDS.high.minExploitable;
    const isLogged = testValue >= EXPLOIT_VALUE_THRESHOLDS.logged.minExploitable;
    
    assert.strictEqual(isCritical, false, '$50K should not be critical');
    assert.strictEqual(isHigh, true, '$50K should be high');
    assert.strictEqual(isLogged, true, '$50K should be logged');
  });

  // =============================================================================
  // SECTION 5: Type Validation
  // =============================================================================

  section('SECTION 5: Type Validation');

  await runTest('should validate severity type', () => {
    const validSeverities: Severity[] = ['critical', 'high', 'medium', 'low', 'informational'];
    validSeverities.forEach(s => {
      assert.ok(SEVERITY_ORDER[s] !== undefined, `${s} should be valid severity`);
    });
  });

  await runTest('should have numeric severity order for all levels', () => {
    Object.values(SEVERITY_ORDER).forEach(order => {
      assert.ok(typeof order === 'number', 'Severity order should be numeric');
      assert.ok(order > 0, 'Severity order should be positive');
    });
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

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TYPES UNIT TESTS PASSED! 🎉');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
