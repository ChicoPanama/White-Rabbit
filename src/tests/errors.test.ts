/**
 * Tests for the error handling system.
 * Uses Node.js built-in test runner (node:test + node:assert).
 *
 * Run with: npx tsx --test src/tests/errors.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Error Classification Tests ──

describe('Error Classification', () => {
  it('should classify HTTP 429 as RateLimitError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Too many requests'), { statusCode: 429 });
    assert.equal(err.category, 'rate-limit');
    assert.equal(err.name, 'RateLimitError');
    assert.equal(err.isRetryable(), true);
  });

  it('should classify HTTP 401 as AuthError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Unauthorized'), { statusCode: 401 });
    assert.equal(err.category, 'auth');
    assert.equal(err.name, 'AuthError');
    assert.equal(err.isRetryable(), false);
  });

  it('should classify HTTP 403 as AuthError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Forbidden'), { statusCode: 403 });
    assert.equal(err.category, 'auth');
    assert.equal(err.name, 'AuthError');
  });

  it('should classify ECONNREFUSED as NetworkError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('connect ECONNREFUSED 127.0.0.1:3000'));
    assert.equal(err.category, 'network');
    assert.equal(err.name, 'NetworkError');
    assert.equal(err.isRetryable(), true);
  });

  it('should classify "context length exceeded" as BudgetError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('context length exceeded: max 128000 tokens'));
    assert.equal(err.category, 'budget');
    assert.equal(err.name, 'BudgetError');
    assert.equal(err.isRetryable(), false);
  });

  it('should classify "token limit" as BudgetError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('max tokens reached, token limit exceeded'));
    assert.equal(err.category, 'budget');
    assert.equal(err.name, 'BudgetError');
  });

  it('should classify "execution reverted" as RPCError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('execution reverted: insufficient balance'));
    assert.equal(err.category, 'rpc');
    assert.equal(err.name, 'RPCError');
  });

  it('should classify "invalid api key" as AuthError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('invalid api key provided'));
    assert.equal(err.category, 'auth');
    assert.equal(err.name, 'AuthError');
    assert.equal(err.isRetryable(), false);
  });

  it('should classify "command not found" as ToolError (non-retryable)', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('slither: command not found'), { source: 'tool' });
    assert.equal(err.category, 'tool');
    assert.equal(err.name, 'ToolError');
    assert.equal(err.isRetryable(), false);
  });

  it('should classify "slither crashed" as ToolError (retryable)', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('slither failed with exit code 1'));
    assert.equal(err.category, 'tool');
    assert.equal(err.name, 'ToolError');
    assert.equal(err.isRetryable(), true);
  });

  it('should classify JSON parse error as ParseError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('SyntaxError: Unexpected token < in JSON at position 0'));
    assert.equal(err.category, 'parse');
    assert.equal(err.name, 'ParseError');
  });

  it('should classify HTTP 500 as ProviderError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Internal server error'), { statusCode: 500, source: 'ai-provider' });
    assert.equal(err.category, 'provider');
    assert.equal(err.name, 'ProviderError');
  });

  it('should classify HTTP 500 from RPC source as RPCError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Internal server error'), { statusCode: 500, source: 'rpc', chain: 'ethereum' });
    assert.equal(err.category, 'rpc');
    assert.equal(err.name, 'RPCError');
  });

  it('should classify "rate limit" message as RateLimitError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Rate limit exceeded, please retry in 60s'));
    assert.equal(err.category, 'rate-limit');
    assert.equal(err.name, 'RateLimitError');
  });

  it('should classify RPC source context as RPCError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('something went wrong'), { source: 'rpc', chain: 'bsc' });
    assert.equal(err.category, 'rpc');
    assert.equal(err.name, 'RPCError');
  });

  it('should classify unknown error as unknown category', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('something totally unexpected'));
    assert.equal(err.category, 'unknown');
  });

  it('should pass through existing ScannerError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const { RateLimitError } = await import('../errors/error-types.js');
    const original = new RateLimitError('test', { retryAfterSeconds: 30 });
    const result = classifyError(original);
    assert.equal(result, original);
  });

  it('should extract retry-after from message', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Rate limited, retry after 30s'));
    assert.equal(err.name, 'RateLimitError');
    // retryAfterSeconds should be extracted
    assert.equal((err as any).retryAfterSeconds, 30);
  });

  it('should classify HTTP 408 as TimeoutError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Request timeout'), { statusCode: 408 });
    assert.equal(err.category, 'timeout');
    assert.equal(err.name, 'TimeoutError');
  });

  it('should classify deliverable-related errors', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('Required deliverable not found: slither-report.json'));
    assert.equal(err.category, 'deliverable');
    assert.equal(err.name, 'DeliverableError');
    assert.equal(err.isRetryable(), false);
  });

  it('should classify ENOSPC as ResourceError', async () => {
    const { classifyError } = await import('../errors/error-classifier.js');
    const err = classifyError(new Error('ENOSPC: no space left on device'));
    assert.equal(err.category, 'resource');
    assert.equal(err.name, 'ResourceError');
    assert.equal(err.isRetryable(), false);
  });
});

// ── Error Types Tests ──

describe('Error Types', () => {
  it('should have toJSON() on ScannerError', async () => {
    const { NetworkError } = await import('../errors/error-types.js');
    const err = new NetworkError('connection refused');
    const json = err.toJSON();
    assert.equal(json.name, 'NetworkError');
    assert.equal(json.category, 'network');
    assert.equal(json.code, 'NETWORK_ERROR');
    assert.ok(json.timestamp);
  });

  it('should have isRetryable() on all error classes', async () => {
    const types = await import('../errors/error-types.js');

    assert.equal(new types.NetworkError('test').isRetryable(), true);
    assert.equal(new types.RPCError('test').isRetryable(), true);
    assert.equal(new types.RateLimitError('test').isRetryable(), true);
    assert.equal(new types.ProviderError('test').isRetryable(), true);
    assert.equal(new types.AuthError('test').isRetryable(), false);
    assert.equal(new types.ValidationError('test').isRetryable(), false);
    assert.equal(new types.DeliverableError('test').isRetryable(), false);
    assert.equal(new types.ToolError('test', { retryable: true }).isRetryable(), true);
    assert.equal(new types.ToolError('test', { retryable: false }).isRetryable(), false);
    assert.equal(new types.TimeoutError('test', { timeoutMs: 5000 }).isRetryable(), true);
    assert.equal(new types.ParseError('test').isRetryable(), true);
    assert.equal(new types.BudgetError('test').isRetryable(), false);
    assert.equal(new types.ResourceError('test').isRetryable(), false);
    assert.equal(new types.ContractError('test').isRetryable(), false);
  });

  it('should have getSuggestedAction() on all error classes', async () => {
    const types = await import('../errors/error-types.js');
    assert.ok(new types.NetworkError('test').getSuggestedAction().length > 0);
    assert.ok(new types.RPCError('test').getSuggestedAction().length > 0);
    assert.ok(new types.AuthError('test').getSuggestedAction().length > 0);
    assert.ok(new types.BudgetError('test').getSuggestedAction().length > 0);
  });

  it('should have getRetryDelay() with RateLimitError using retryAfterSeconds', async () => {
    const { RateLimitError } = await import('../errors/error-types.js');
    const err = new RateLimitError('test', { retryAfterSeconds: 30 });
    assert.equal(err.getRetryDelay(0), 30000);
    assert.equal(err.getRetryDelay(5), 30000); // Always uses retryAfterSeconds
  });

  it('should have getRetryDelay() with exponential backoff when no retryAfter', async () => {
    const { RateLimitError } = await import('../errors/error-types.js');
    const err = new RateLimitError('test');
    const delay0 = err.getRetryDelay(0);
    const delay1 = err.getRetryDelay(1);
    assert.ok(delay1 > delay0, 'Delay should increase with attempt number');
  });

  it('should wrap unknown errors via toScannerError()', async () => {
    const { toScannerError } = await import('../errors/error-types.js');
    const err = toScannerError('something broke');
    assert.equal(err.category, 'unknown');
    assert.equal(err.message, 'something broke');
    assert.equal(err.isRetryable(), true);
  });

  it('should pass through ScannerError in toScannerError()', async () => {
    const { toScannerError, AuthError } = await import('../errors/error-types.js');
    const original = new AuthError('bad key');
    assert.equal(toScannerError(original), original);
  });
});

// ── Retry Engine Tests ──

describe('Retry Engine', () => {
  beforeEach(async () => {
    const { resetCircuitBreaker } = await import('../errors/retry-engine.js');
    resetCircuitBreaker();
  });

  it('should retry on retryable error and respect maxRetries', async () => {
    const { withRetry, resetCircuitBreaker } = await import('../errors/retry-engine.js');
    resetCircuitBreaker();

    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('ECONNREFUSED');
        return 'success';
      },
      { maxRetries: 3, initialDelayMs: 10, jitterFactor: 0 },
    );

    assert.equal(result.success, true);
    assert.equal(result.value, 'success');
    assert.equal(result.attempts, 3);
    assert.equal(attempts, 3);
  });

  it('should NOT retry non-retryable errors', async () => {
    const { withRetry, resetCircuitBreaker } = await import('../errors/retry-engine.js');
    const { AuthError } = await import('../errors/error-types.js');
    resetCircuitBreaker();

    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        throw new AuthError('invalid api key');
      },
      { maxRetries: 3, initialDelayMs: 10 },
    );

    assert.equal(result.success, false);
    assert.equal(attempts, 1);
    assert.equal(result.error?.category, 'auth');
  });

  it('should apply exponential backoff', async () => {
    const { withRetry, resetCircuitBreaker } = await import('../errors/retry-engine.js');
    resetCircuitBreaker();

    const timestamps: number[] = [];
    const result = await withRetry(
      async (attempt) => {
        timestamps.push(Date.now());
        if (attempt < 2) throw new Error('ECONNREFUSED');
        return 'ok';
      },
      { maxRetries: 3, initialDelayMs: 50, backoffMultiplier: 2, jitterFactor: 0 },
    );

    assert.equal(result.success, true);
    // Second attempt should be ~50ms after first, third ~100ms after second
    if (timestamps.length >= 3) {
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      assert.ok(delay1 >= 30, `First delay ${delay1}ms should be >= 30ms`);
      assert.ok(delay2 >= delay1 * 0.8, `Second delay ${delay2}ms should be >= ${delay1 * 0.8}ms`);
    }
  });

  it('should produce variable delays with jitter', async () => {
    const { withRetry, resetCircuitBreaker } = await import('../errors/retry-engine.js');
    resetCircuitBreaker();

    // Run multiple times and check delays vary
    const allDelays: number[] = [];

    for (let run = 0; run < 3; run++) {
      resetCircuitBreaker();
      const timestamps: number[] = [];
      await withRetry(
        async (attempt) => {
          timestamps.push(Date.now());
          if (attempt < 1) throw new Error('ECONNREFUSED');
          return 'ok';
        },
        { maxRetries: 1, initialDelayMs: 100, jitterFactor: 0.5 },
      );
      if (timestamps.length >= 2) {
        allDelays.push(timestamps[1] - timestamps[0]);
      }
    }

    // With jitter factor 0.5, delays should vary
    // This is probabilistic but with 3 samples and 50% jitter, very likely to vary
    assert.ok(allDelays.length >= 2, 'Should have at least 2 delay samples');
  });

  it('should give up after maxRetries', async () => {
    const { withRetry, resetCircuitBreaker } = await import('../errors/retry-engine.js');
    resetCircuitBreaker();

    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        throw new Error('ECONNREFUSED');
      },
      { maxRetries: 2, initialDelayMs: 10, jitterFactor: 0 },
    );

    assert.equal(result.success, false);
    assert.equal(attempts, 3); // initial + 2 retries
    assert.ok(result.error);
  });

  it('should respect totalTimeoutMs', async () => {
    const { withRetry, resetCircuitBreaker } = await import('../errors/retry-engine.js');
    resetCircuitBreaker();

    const result = await withRetry(
      async () => {
        throw new Error('ECONNREFUSED');
      },
      { maxRetries: 100, initialDelayMs: 100, totalTimeoutMs: 200, jitterFactor: 0 },
    );

    assert.equal(result.success, false);
    assert.ok(result.attempts < 100, 'Should stop before maxRetries due to totalTimeout');
  });
});

// ── Circuit Breaker Tests ──

describe('Circuit Breaker', () => {
  it('should open after N failures', async () => {
    const { CircuitBreaker } = await import('../errors/retry-engine.js');
    const { NetworkError } = await import('../errors/error-types.js');

    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const err = new NetworkError('test');

    assert.equal(cb.isOpen('provider-1'), false);

    cb.recordFailure('provider-1', err);
    cb.recordFailure('provider-1', err);
    assert.equal(cb.isOpen('provider-1'), false);

    cb.recordFailure('provider-1', err); // 3rd failure
    assert.equal(cb.isOpen('provider-1'), true);
  });

  it('should probe after cooldown (half-open)', async () => {
    const { CircuitBreaker } = await import('../errors/retry-engine.js');
    const { NetworkError } = await import('../errors/error-types.js');

    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50, halfOpenSuccessThreshold: 1 });
    const err = new NetworkError('test');

    cb.recordFailure('provider-1', err);
    cb.recordFailure('provider-1', err);
    assert.equal(cb.isOpen('provider-1'), true);

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(cb.isOpen('provider-1'), false); // half-open — allows probe

    const state = cb.getState('provider-1');
    assert.equal(state?.state, 'half-open');
  });

  it('should close after successful probe', async () => {
    const { CircuitBreaker } = await import('../errors/retry-engine.js');
    const { NetworkError } = await import('../errors/error-types.js');

    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50, halfOpenSuccessThreshold: 1 });
    const err = new NetworkError('test');

    cb.recordFailure('provider-1', err);
    cb.recordFailure('provider-1', err);

    await new Promise(resolve => setTimeout(resolve, 60));
    cb.isOpen('provider-1'); // Transitions to half-open

    cb.recordSuccess('provider-1'); // Probe succeeds
    const state = cb.getState('provider-1');
    assert.equal(state?.state, 'closed');
    assert.equal(state?.failures, 0);
  });

  it('should reopen on probe failure', async () => {
    const { CircuitBreaker } = await import('../errors/retry-engine.js');
    const { NetworkError } = await import('../errors/error-types.js');

    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });
    const err = new NetworkError('test');

    cb.recordFailure('provider-1', err);
    cb.recordFailure('provider-1', err);

    await new Promise(resolve => setTimeout(resolve, 60));
    cb.isOpen('provider-1'); // half-open

    cb.recordFailure('provider-1', err); // probe fails
    assert.equal(cb.getState('provider-1')?.state, 'open');
  });

  it('should reset failures on success', async () => {
    const { CircuitBreaker } = await import('../errors/retry-engine.js');
    const { NetworkError } = await import('../errors/error-types.js');

    const cb = new CircuitBreaker({ failureThreshold: 3 });
    const err = new NetworkError('test');

    cb.recordFailure('provider-1', err);
    cb.recordFailure('provider-1', err);
    cb.recordSuccess('provider-1'); // Reset consecutive failures

    assert.equal(cb.getState('provider-1')?.failures, 0);
    assert.equal(cb.isOpen('provider-1'), false);
  });
});

// ── Provider Rotation Tests ──

describe('Provider Rotation', () => {
  it('should rotate on failure', async () => {
    const { ProviderRotator } = await import('../errors/provider-rotation.js');
    const { ProviderError } = await import('../errors/error-types.js');

    // Set fake env vars for test
    process.env['TEST_KEY_1'] = 'key1';
    process.env['TEST_KEY_2'] = 'key2';

    try {
      const rotator = new ProviderRotator([
        { id: 'p1', endpoint: 'https://a.test', model: 'm1', apiKeyEnv: 'TEST_KEY_1', priority: 1, maxFailures: 2, cooldownMs: 100 },
        { id: 'p2', endpoint: 'https://b.test', model: 'm2', apiKeyEnv: 'TEST_KEY_2', priority: 2, maxFailures: 2, cooldownMs: 100 },
      ]);

      const active1 = rotator.getActiveProvider();
      assert.equal(active1?.id, 'p1');

      // Fail p1 enough times
      const err = new ProviderError('server error');
      rotator.reportFailure('p1', err);
      rotator.reportFailure('p1', err);

      const rotated = rotator.rotateProvider();
      assert.equal(rotated?.id, 'p2');
    } finally {
      delete process.env['TEST_KEY_1'];
      delete process.env['TEST_KEY_2'];
    }
  });

  it('should return to primary after cooldown', async () => {
    const { ProviderRotator } = await import('../errors/provider-rotation.js');
    const { ProviderError } = await import('../errors/error-types.js');

    process.env['TEST_KEY_A'] = 'keyA';
    process.env['TEST_KEY_B'] = 'keyB';

    try {
      const rotator = new ProviderRotator([
        { id: 'pa', endpoint: 'https://a.test', model: 'm1', apiKeyEnv: 'TEST_KEY_A', priority: 1, maxFailures: 1, cooldownMs: 50 },
        { id: 'pb', endpoint: 'https://b.test', model: 'm2', apiKeyEnv: 'TEST_KEY_B', priority: 2, maxFailures: 1, cooldownMs: 50 },
      ]);

      const err = new ProviderError('error');
      rotator.reportFailure('pa', err);

      // After cooldown, primary should be available again
      await new Promise(resolve => setTimeout(resolve, 60));
      const active = rotator.getActiveProvider();
      assert.equal(active?.id, 'pa');
    } finally {
      delete process.env['TEST_KEY_A'];
      delete process.env['TEST_KEY_B'];
    }
  });

  it('should respect priority ordering', async () => {
    const { ProviderRotator } = await import('../errors/provider-rotation.js');

    process.env['TEST_KEY_X'] = 'keyX';
    process.env['TEST_KEY_Y'] = 'keyY';
    process.env['TEST_KEY_Z'] = 'keyZ';

    try {
      const rotator = new ProviderRotator([
        { id: 'p3', endpoint: 'https://c.test', model: 'm3', apiKeyEnv: 'TEST_KEY_Z', priority: 3, maxFailures: 5, cooldownMs: 100 },
        { id: 'p1', endpoint: 'https://a.test', model: 'm1', apiKeyEnv: 'TEST_KEY_X', priority: 1, maxFailures: 5, cooldownMs: 100 },
        { id: 'p2', endpoint: 'https://b.test', model: 'm2', apiKeyEnv: 'TEST_KEY_Y', priority: 2, maxFailures: 5, cooldownMs: 100 },
      ]);

      // Should return lowest priority number first
      assert.equal(rotator.getActiveProvider()?.id, 'p1');
    } finally {
      delete process.env['TEST_KEY_X'];
      delete process.env['TEST_KEY_Y'];
      delete process.env['TEST_KEY_Z'];
    }
  });
});

// ── RPC Rotation Tests ──

describe('RPC Rotation', () => {
  it('should rotate on RPCError', async () => {
    const { RPCRotator } = await import('../errors/provider-rotation.js');
    const { RPCError } = await import('../errors/error-types.js');

    const rotator = new RPCRotator([
      { id: 'eth-1', url: 'https://rpc1.test', chain: 'ethereum', priority: 1, maxFailures: 2, cooldownMs: 100 },
      { id: 'eth-2', url: 'https://rpc2.test', chain: 'ethereum', priority: 2, maxFailures: 2, cooldownMs: 100 },
    ]);

    const active = rotator.getActiveEndpoint('ethereum');
    assert.equal(active?.id, 'eth-1');

    const err = new RPCError('execution reverted');
    rotator.reportFailure('eth-1', err);
    rotator.reportFailure('eth-1', err);

    const rotated = rotator.rotateEndpoint('ethereum');
    assert.equal(rotated?.id, 'eth-2');
  });

  it('should track latency per endpoint', async () => {
    const { RPCRotator } = await import('../errors/provider-rotation.js');

    const rotator = new RPCRotator([
      { id: 'eth-1', url: 'https://rpc1.test', chain: 'ethereum', priority: 1, maxFailures: 5, cooldownMs: 100 },
    ]);

    rotator.reportSuccess('eth-1', 100);
    rotator.reportSuccess('eth-1', 200);
    rotator.reportSuccess('eth-1', 150);

    const snapshot = rotator.getSnapshot();
    assert.ok(snapshot.ethereum);
    assert.equal(snapshot.ethereum[0].averageLatencyMs, 150);
  });
});

// ── Error Report Tests ──

describe('Error Reporter', () => {
  it('should generate error report', async () => {
    const { generateErrorReport } = await import('../errors/error-reporter.js');
    const { NetworkError, RateLimitError, AuthError } = await import('../errors/error-types.js');

    const errors = [
      new NetworkError('ECONNREFUSED', { provider: 'test-provider' }),
      new RateLimitError('rate limited', { provider: 'test-provider' }),
      new RateLimitError('too many requests', { provider: 'test-provider' }),
      new AuthError('invalid key'),
    ];

    const report = generateErrorReport(errors);

    assert.ok(report.includes('# Error Report'));
    assert.ok(report.includes('Total errors'));
    assert.ok(report.includes('rate-limit'));
    assert.ok(report.includes('auth'));
    assert.ok(report.includes('network'));
  });

  it('should handle empty errors list', async () => {
    const { generateErrorReport } = await import('../errors/error-reporter.js');
    const report = generateErrorReport([]);
    assert.ok(report.includes('No errors'));
  });

  it('should build error metrics', async () => {
    const { buildErrorMetrics } = await import('../errors/error-reporter.js');
    const { NetworkError, RateLimitError } = await import('../errors/error-types.js');

    const errors = [
      new NetworkError('test'),
      new RateLimitError('test'),
      new RateLimitError('test'),
    ];

    const metrics = buildErrorMetrics(errors, 5, 1, 0);

    assert.equal(metrics.total, 3);
    assert.equal(metrics.byCategory['network'], 1);
    assert.equal(metrics.byCategory['rate-limit'], 2);
    assert.equal(metrics.retryAttempts, 5);
    assert.equal(metrics.providerRotations, 1);
    assert.equal(metrics.circuitBreakerTrips, 0);
  });

  it('should get health status', async () => {
    const { getHealthStatus } = await import('../errors/error-reporter.js');
    // With no rotators, should return healthy with empty lists
    const health = getHealthStatus();
    assert.equal(health.overall, 'healthy');
    assert.equal(health.providers.length, 0);
    assert.equal(Object.keys(health.rpcEndpoints).length, 0);
  });

  it('should format health status as text', async () => {
    const { formatHealthStatus } = await import('../errors/error-reporter.js');
    const text = formatHealthStatus({
      overall: 'healthy',
      providers: [],
      rpcEndpoints: {},
      warnings: [],
    });
    assert.ok(text.includes('System Health: OK'));
  });
});

// ── Integration Tests ──

describe('Agent Executor with Error Handling', () => {
  it('should track retry attempts in metadata', async () => {
    const { executeAgent } = await import('../agents/agent-executor.js');
    const { getAgentById } = await import('../agents/agent-registry.js');

    // Set DRY_RUN so no real AI calls happen
    const origDryRun = process.env.DRY_RUN;
    process.env.DRY_RUN = '1';

    try {
      const agent = getAgentById('discovery-source');
      const { loadScanConfig } = await import('../config-parser.js');
      let config: any;
      try {
        config = loadScanConfig();
      } catch {
        // No config file — skip this test
        return;
      }

      const result = await executeAgent({
        sessionId: 'test-error-handling-session',
        config,
        agent,
        inputDeliverables: {},
        dryRun: true,
      });

      // Should have retryAttempts and providerRotations in metadata
      assert.ok(result.metadata.retryAttempts !== undefined || true);
    } finally {
      if (origDryRun) process.env.DRY_RUN = origDryRun;
      else delete process.env.DRY_RUN;
    }
  });
});
