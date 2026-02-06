/**
 * Retry engine with exponential backoff, jitter, and circuit breaker.
 *
 * Provides a generic `withRetry` wrapper that handles transient failures
 * using the error taxonomy's retry dispositions. Includes per-provider
 * circuit breakers to avoid hammering failing services.
 */

import type { ScannerError, ErrorCategory } from './error-types.js';
import { isRetryable, shouldRotateProvider, toScannerError } from './error-types.js';
import { classifyError, type ClassificationContext } from './error-classifier.js';

// ── Retry Configuration ──

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries: number;

  /** Initial backoff delay in ms (default: 1000). */
  initialDelayMs: number;

  /** Backoff multiplier (default: 2). */
  backoffMultiplier: number;

  /** Maximum delay in ms (default: 60000). */
  maxDelayMs: number;

  /** Jitter factor 0-1, randomizes delay by this fraction (default: 0.2). */
  jitterFactor: number;

  /** Overall timeout for all attempts in ms (default: 300000 = 5 min). */
  totalTimeoutMs: number;

  /** Categories that should not be retried even if retryDisposition says so. */
  nonRetryableCategories: ErrorCategory[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 60_000,
  jitterFactor: 0.2,
  totalTimeoutMs: 300_000,
  nonRetryableCategories: ['authentication', 'validation', 'resource'],
};

// ── Circuit Breaker ──

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit (default: 5). */
  failureThreshold: number;

  /** Time in ms to keep circuit open before trying half-open (default: 60000). */
  resetTimeoutMs: number;

  /** Number of successes needed in half-open state to close (default: 2). */
  halfOpenSuccessThreshold: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenSuccessThreshold: 2,
};

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastError?: ScannerError;
}

/**
 * Per-provider circuit breaker.
 *
 * Tracks failure counts per provider key and opens the circuit when
 * failures exceed the threshold. After a cooldown, enters half-open
 * state to probe for recovery.
 */
export class CircuitBreaker {
  private readonly circuits = new Map<string, CircuitBreakerState>();
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /** Check if a provider circuit is allowing requests. */
  isOpen(providerKey: string): boolean {
    const circuit = this.circuits.get(providerKey);
    if (!circuit) return false;

    if (circuit.state === 'open') {
      // Check if cooldown has elapsed
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        circuit.state = 'half-open';
        circuit.successes = 0;
        return false; // Allow a probe request
      }
      return true; // Still open
    }

    return false;
  }

  /** Record a successful operation for a provider. */
  recordSuccess(providerKey: string): void {
    const circuit = this.circuits.get(providerKey);
    if (!circuit) return;

    if (circuit.state === 'half-open') {
      circuit.successes++;
      if (circuit.successes >= this.config.halfOpenSuccessThreshold) {
        // Recovered — close the circuit
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.successes = 0;
      }
    } else if (circuit.state === 'closed') {
      // Reset consecutive failures on success
      circuit.failures = 0;
    }
  }

  /** Record a failure for a provider. */
  recordFailure(providerKey: string, error: ScannerError): void {
    let circuit = this.circuits.get(providerKey);
    if (!circuit) {
      circuit = { state: 'closed', failures: 0, successes: 0, lastFailureTime: 0 };
      this.circuits.set(providerKey, circuit);
    }

    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    circuit.lastError = error;

    if (circuit.state === 'half-open') {
      // Failed during probe — reopen
      circuit.state = 'open';
      circuit.successes = 0;
    } else if (circuit.failures >= this.config.failureThreshold) {
      circuit.state = 'open';
    }
  }

  /** Get the current state of a provider's circuit. */
  getState(providerKey: string): CircuitBreakerState | undefined {
    return this.circuits.get(providerKey);
  }

  /** Reset a specific circuit. */
  reset(providerKey: string): void {
    this.circuits.delete(providerKey);
  }

  /** Reset all circuits. */
  resetAll(): void {
    this.circuits.clear();
  }

  /** Get a snapshot of all circuit states. */
  getSnapshot(): Record<string, { state: CircuitState; failures: number; lastError?: string }> {
    const snapshot: Record<string, { state: CircuitState; failures: number; lastError?: string }> = {};
    for (const [key, circuit] of this.circuits) {
      snapshot[key] = {
        state: circuit.state,
        failures: circuit.failures,
        lastError: circuit.lastError?.message,
      };
    }
    return snapshot;
  }
}

// ── Global Circuit Breaker ──

let globalCircuitBreaker: CircuitBreaker | undefined;

export function getCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new CircuitBreaker(config);
  }
  return globalCircuitBreaker;
}

export function resetCircuitBreaker(): void {
  globalCircuitBreaker?.resetAll();
  globalCircuitBreaker = undefined;
}

// ── Retry Result ──

export interface RetryResult<T> {
  /** Whether the operation succeeded. */
  success: boolean;

  /** The result value if succeeded. */
  value?: T;

  /** The final error if all retries failed. */
  error?: ScannerError;

  /** Number of attempts made. */
  attempts: number;

  /** Total time spent in ms. */
  totalDuration: number;

  /** Per-attempt details. */
  attemptLog: AttemptLog[];
}

interface AttemptLog {
  attempt: number;
  startedAt: number;
  duration: number;
  success: boolean;
  error?: string;
  delayBeforeMs?: number;
  provider?: string;
}

// ── Core Retry Logic ──

/**
 * Execute an operation with retry logic.
 *
 * Uses exponential backoff with jitter. Respects circuit breaker state.
 * Supports provider rotation via `onRotateProvider` callback.
 *
 * @param operation — The async function to retry.
 * @param config — Retry configuration overrides.
 * @param context — Error classification context.
 * @param options — Optional callbacks for provider rotation.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  config?: Partial<RetryConfig>,
  context?: ClassificationContext,
  options?: {
    /** Called when the error suggests trying a different provider. */
    onRotateProvider?: () => string | undefined;
    /** Provider key for circuit breaker tracking. */
    providerKey?: string;
  },
): Promise<RetryResult<T>> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  const attemptLog: AttemptLog[] = [];
  const startTime = Date.now();
  let currentProvider = options?.providerKey;

  const circuitBreaker = getCircuitBreaker();

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    // Check total timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= cfg.totalTimeoutMs) {
      return {
        success: false,
        error: toScannerError(
          new Error(`Total timeout exceeded after ${elapsed}ms (${attempt} attempts)`),
          currentProvider,
        ),
        attempts: attempt,
        totalDuration: elapsed,
        attemptLog,
      };
    }

    // Check circuit breaker
    if (currentProvider && circuitBreaker.isOpen(currentProvider)) {
      // Try to rotate provider
      if (options?.onRotateProvider) {
        const newProvider = options.onRotateProvider();
        if (newProvider && !circuitBreaker.isOpen(newProvider)) {
          currentProvider = newProvider;
        } else {
          return {
            success: false,
            error: toScannerError(
              new Error(`Circuit breaker open for ${currentProvider}, no healthy provider available`),
              currentProvider,
            ),
            attempts: attempt,
            totalDuration: Date.now() - startTime,
            attemptLog,
          };
        }
      } else {
        return {
          success: false,
          error: toScannerError(
            new Error(`Circuit breaker open for ${currentProvider}`),
            currentProvider,
          ),
          attempts: attempt,
          totalDuration: Date.now() - startTime,
          attemptLog,
        };
      }
    }

    // Calculate delay (skip for first attempt)
    let delayMs = 0;
    if (attempt > 0) {
      delayMs = calculateDelay(attempt, cfg);

      // If previous error was a RateLimitError with retryAfter, use that instead
      const lastLog = attemptLog[attemptLog.length - 1];
      if (lastLog?.error?.includes('rate limit') || lastLog?.error?.includes('429')) {
        // Use at least the calculated delay, possibly more
        delayMs = Math.max(delayMs, 5000);
      }

      await sleep(delayMs);
    }

    const attemptStart = Date.now();

    try {
      const value = await operation(attempt);

      // Success — update circuit breaker
      if (currentProvider) {
        circuitBreaker.recordSuccess(currentProvider);
      }

      attemptLog.push({
        attempt,
        startedAt: attemptStart,
        duration: Date.now() - attemptStart,
        success: true,
        delayBeforeMs: delayMs || undefined,
        provider: currentProvider,
      });

      return {
        success: true,
        value,
        attempts: attempt + 1,
        totalDuration: Date.now() - startTime,
        attemptLog,
      };
    } catch (rawErr) {
      const classified = classifyError(rawErr, {
        ...context,
        provider: currentProvider,
      });

      attemptLog.push({
        attempt,
        startedAt: attemptStart,
        duration: Date.now() - attemptStart,
        success: false,
        error: classified.message,
        delayBeforeMs: delayMs || undefined,
        provider: currentProvider,
      });

      // Update circuit breaker
      if (currentProvider) {
        circuitBreaker.recordFailure(currentProvider, classified);
      }

      // Check if this error category is non-retryable
      if (cfg.nonRetryableCategories.includes(classified.category)) {
        return {
          success: false,
          error: classified,
          attempts: attempt + 1,
          totalDuration: Date.now() - startTime,
          attemptLog,
        };
      }

      // Check retry disposition
      if (!isRetryable(classified)) {
        return {
          success: false,
          error: classified,
          attempts: attempt + 1,
          totalDuration: Date.now() - startTime,
          attemptLog,
        };
      }

      // Try provider rotation if indicated
      if (shouldRotateProvider(classified) && options?.onRotateProvider) {
        const newProvider = options.onRotateProvider();
        if (newProvider) {
          currentProvider = newProvider;
        }
      }

      // If this was the last attempt, return the error
      if (attempt >= cfg.maxRetries) {
        return {
          success: false,
          error: classified,
          attempts: attempt + 1,
          totalDuration: Date.now() - startTime,
          attemptLog,
        };
      }
    }
  }

  // Should not reach here, but satisfy TypeScript
  return {
    success: false,
    error: toScannerError(new Error('Unexpected retry loop exit')),
    attempts: cfg.maxRetries + 1,
    totalDuration: Date.now() - startTime,
    attemptLog,
  };
}

// ── Delay Calculation ──

/**
 * Calculate backoff delay with jitter.
 *
 * delay = min(initialDelay * multiplier^attempt, maxDelay) * (1 ± jitter)
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  // Apply jitter: uniform random between (1-jitter) and (1+jitter)
  const jitterRange = cappedDelay * config.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  return Math.max(0, Math.round(cappedDelay + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
