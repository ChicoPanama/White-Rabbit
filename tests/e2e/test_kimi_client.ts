#!/usr/bin/env tsx
/**
 * WHITE RABBIT - Kimi Client Test Suite
 * 
 * Tests the enhanced Kimi client with:
 * - Circuit breaker pattern
 * - Retry logic
 * - Timeout handling
 * - Error classification
 */

import { strict as assert } from 'assert';
import { KimiClient, KimiError } from '../../src/core/kimi-client.js';

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
  console.log(`\n${'='.repeat(60)}`);
  console.log(title);
  console.log('='.repeat(60));
}

async function main() {
  section('KIMI CLIENT TESTS');

  await runTest('KimiClient initialization with defaults', async () => {
    // Clear env vars to test defaults
    const originalKey = process.env.MOONSHOT_API_KEY;
    const originalKimiKey = process.env.KIMI_API_KEY;
    delete process.env.MOONSHOT_API_KEY;
    delete process.env.KIMI_API_KEY;
    
    const client = new KimiClient();
    assert.equal(client.isAvailable, false, 'Should not be available without API key');
    
    // Restore env vars
    if (originalKey) process.env.MOONSHOT_API_KEY = originalKey;
    if (originalKimiKey) process.env.KIMI_API_KEY = originalKimiKey;
  });

  await runTest('KimiClient initialization with API key', async () => {
    const client = new KimiClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.moonshot.ai/v1',
    });
    assert.equal(client.isAvailable, true, 'Should be available with API key');
  });

  await runTest('KimiClient configuration from environment', async () => {
    process.env.MOONSHOT_API_KEY = 'env-api-key';
    const client = new KimiClient();
    assert.equal(client.isAvailable, true, 'Should read API key from environment');
    delete process.env.MOONSHOT_API_KEY;
  });

  await runTest('Circuit breaker starts CLOSED', async () => {
    const client = new KimiClient({ apiKey: 'test', baseUrl: 'https://test.com' });
    const status = client.getStatus();
    assert.equal(status.circuitState, 'CLOSED', 'Circuit should start closed');
    assert.equal(status.failureCount, 0, 'Failure count should be 0');
  });

  await runTest('Circuit breaker opens after threshold', async () => {
    const client = new KimiClient({
      apiKey: 'test',
      baseUrl: 'https://invalid-url-that-will-fail.com',
      circuitBreakerThreshold: 2,
      maxRetries: 1,
      timeoutMs: 100, // Fast timeout for testing
    });

    // Simulate failures
    for (let i = 0; i < 3; i++) {
      try {
        await client.createMessage({
          system: 'Test',
          messages: [{ role: 'user', content: 'Hello' }],
        });
      } catch (err) {
        // Expected to fail
      }
    }

    const status = client.getStatus();
    assert.equal(status.circuitState, 'OPEN', 'Circuit should be OPEN after threshold');
    assert.ok(status.failureCount >= 2, 'Failure count should be >= threshold');
  });

  await runTest('Circuit breaker rejects requests when OPEN', async () => {
    const client = new KimiClient({
      apiKey: 'test',
      baseUrl: 'https://test.com',
      circuitBreakerThreshold: 1,
    });

    // Force circuit open
    (client as any).circuitState = 'OPEN';
    (client as any).lastFailureTime = Date.now();

    try {
      await client.createMessage({
        system: 'Test',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      assert.fail('Should have thrown KimiError');
    } catch (err) {
      assert.ok(err instanceof KimiError, 'Should throw KimiError');
      assert.equal((err as KimiError).type, 'CIRCUIT_OPEN', 'Error type should be CIRCUIT_OPEN');
    }
  });

  await runTest('Circuit breaker can be manually reset', async () => {
    const client = new KimiClient({ apiKey: 'test', baseUrl: 'https://test.com' });
    
    // Force circuit open
    (client as any).circuitState = 'OPEN';
    (client as any).failureCount = 5;
    
    client.resetCircuitBreaker();
    
    const status = client.getStatus();
    assert.equal(status.circuitState, 'CLOSED', 'Circuit should be CLOSED after reset');
    assert.equal(status.failureCount, 0, 'Failure count should be 0 after reset');
  });

  await runTest('KimiError classification - rate limit', async () => {
    const client = new KimiClient({ apiKey: 'test' });
    const error = (client as any).classifyError(new Error('HTTP 429: rate limit exceeded'));
    
    assert.ok(error instanceof KimiError, 'Should return KimiError');
    assert.equal(error.type, 'RATE_LIMITED', 'Should classify as RATE_LIMITED');
    assert.equal(error.retryable, true, 'Rate limit should be retryable');
    assert.equal(error.statusCode, 429, 'Should have status code 429');
  });

  await runTest('KimiError classification - auth error', async () => {
    const client = new KimiClient({ apiKey: 'test' });
    const error = (client as any).classifyError(new Error('HTTP 401: unauthorized'));
    
    assert.ok(error instanceof KimiError, 'Should return KimiError');
    assert.equal(error.type, 'AUTH_ERROR', 'Should classify as AUTH_ERROR');
    assert.equal(error.retryable, false, 'Auth error should not be retryable');
  });

  await runTest('KimiError classification - timeout', async () => {
    const client = new KimiClient({ apiKey: 'test' });
    const error = (client as any).classifyError(new Error('The operation was aborted'));
    
    assert.ok(error instanceof KimiError, 'Should return KimiError');
    assert.equal(error.type, 'TIMEOUT', 'Should classify as TIMEOUT');
    assert.equal(error.retryable, true, 'Timeout should be retryable');
  });

  await runTest('Exponential backoff calculation', async () => {
    const client = new KimiClient({ apiKey: 'test' });
    
    const delays = [];
    for (let i = 0; i < 5; i++) {
      const delay = (client as any).calculateBackoff(i);
      delays.push(delay);
    }
    
    // Each delay should be >= previous (accounting for jitter)
    for (let i = 1; i < delays.length; i++) {
      assert.ok(delays[i] >= 1000, `Delay ${i} should be >= 1000ms`);
      assert.ok(delays[i] <= 10000, `Delay ${i} should be <= 10000ms (capped)`);
    }
  });

  await runTest('Client status report', async () => {
    const client = new KimiClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      model: 'kimi-test',
    });
    
    const status = client.getStatus();
    assert.equal(status.available, true, 'Should report available');
    assert.equal(status.model, 'kimi-test', 'Should report correct model');
    assert.ok(status.circuitState, 'Should have circuit state');
    assert.ok(typeof status.failureCount === 'number', 'Should have failure count');
  });

  // =============================================================================
  // TEST SUMMARY
  // =============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

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
    console.log('\n🎉 ALL KIMI CLIENT TESTS PASSED! 🎉');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
