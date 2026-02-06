/**
 * Error taxonomy for the White-Rabbit scanner.
 *
 * Provides a structured hierarchy of error types that the retry engine,
 * error classifier, and provider rotation can reason about.
 *
 * Hierarchy:
 *   ScannerError (base)
 *   ├── NetworkError         — connectivity, DNS, timeout
 *   ├── RateLimitError       — 429s, API quota exhaustion
 *   ├── ProviderError        — AI/RPC provider failures (5xx, model not found)
 *   ├── AuthenticationError  — invalid API keys, expired tokens
 *   ├── ValidationError      — bad input, malformed config
 *   ├── AnalysisError        — Slither/AI analysis failures
 *   ├── TimeoutError         — operation exceeded deadline
 *   ├── ResourceError        — disk full, OOM, process limits
 *   └── ContractError        — Solidity compile failures, missing source
 */

// ── Error Categories (for classifier) ──

export type ErrorCategory =
  | 'network'
  | 'rate-limit'
  | 'provider'
  | 'authentication'
  | 'validation'
  | 'analysis'
  | 'timeout'
  | 'resource'
  | 'contract'
  | 'unknown';

// ── Retry Disposition ──

export type RetryDisposition =
  | 'retry'           // Retry with same provider
  | 'retry-other'     // Retry with a different provider
  | 'backoff'         // Retry after exponential backoff
  | 'no-retry';       // Do not retry (permanent failure)

// ── Error Severity ──

export type ErrorSeverity = 'fatal' | 'degraded' | 'transient' | 'info';

// ── Base Error ──

export class ScannerError extends Error {
  /** Error category for classification and routing. */
  readonly category: ErrorCategory;

  /** Whether and how to retry this operation. */
  readonly retryDisposition: RetryDisposition;

  /** Severity for reporting. */
  readonly severity: ErrorSeverity;

  /** HTTP status code if from an HTTP response. */
  readonly statusCode?: number;

  /** Which provider/service triggered this error. */
  readonly provider?: string;

  /** The original underlying error. */
  readonly cause?: Error;

  /** Timestamp when the error was created. */
  readonly timestamp: number;

  constructor(
    message: string,
    options: {
      category: ErrorCategory;
      retryDisposition: RetryDisposition;
      severity: ErrorSeverity;
      statusCode?: number;
      provider?: string;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'ScannerError';
    this.category = options.category;
    this.retryDisposition = options.retryDisposition;
    this.severity = options.severity;
    this.statusCode = options.statusCode;
    this.provider = options.provider;
    this.cause = options.cause;
    this.timestamp = Date.now();
  }

  /** Serialize for logging/reporting. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      retryDisposition: this.retryDisposition,
      severity: this.severity,
      statusCode: this.statusCode,
      provider: this.provider,
      cause: this.cause?.message,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// ── Subclasses ──

/**
 * Network-level failures: DNS resolution, connection refused, socket hang up.
 */
export class NetworkError extends ScannerError {
  constructor(message: string, options?: { provider?: string; cause?: Error }) {
    super(message, {
      category: 'network',
      retryDisposition: 'retry',
      severity: 'transient',
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Rate limit responses (HTTP 429) or API quota exhaustion.
 */
export class RateLimitError extends ScannerError {
  /** Seconds to wait before retrying (from Retry-After header or provider docs). */
  readonly retryAfterSeconds?: number;

  constructor(message: string, options?: {
    provider?: string;
    retryAfterSeconds?: number;
    cause?: Error;
  }) {
    super(message, {
      category: 'rate-limit',
      retryDisposition: 'backoff',
      severity: 'transient',
      statusCode: 429,
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'RateLimitError';
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

/**
 * Provider-level failures: 5xx errors, model not found, service unavailable.
 * These warrant trying a different provider.
 */
export class ProviderError extends ScannerError {
  constructor(message: string, options?: {
    provider?: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(message, {
      category: 'provider',
      retryDisposition: 'retry-other',
      severity: 'degraded',
      statusCode: options?.statusCode,
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'ProviderError';
  }
}

/**
 * Authentication failures: invalid API key, expired token, forbidden.
 * Not retryable — the credentials need fixing.
 */
export class AuthenticationError extends ScannerError {
  constructor(message: string, options?: {
    provider?: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(message, {
      category: 'authentication',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      statusCode: options?.statusCode ?? 401,
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Validation failures: malformed input, bad config, schema violations.
 * Not retryable — the input needs fixing.
 */
export class ValidationError extends ScannerError {
  /** Which field or parameter was invalid. */
  readonly field?: string;

  constructor(message: string, options?: {
    field?: string;
    cause?: Error;
  }) {
    super(message, {
      category: 'validation',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      cause: options?.cause,
    });
    this.name = 'ValidationError';
    this.field = options?.field;
  }
}

/**
 * Analysis tool failures: Slither crash, AI response parsing failure, etc.
 */
export class AnalysisError extends ScannerError {
  /** Which analysis tool failed. */
  readonly tool?: string;

  constructor(message: string, options?: {
    tool?: string;
    provider?: string;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(message, {
      category: 'analysis',
      retryDisposition: options?.retryable !== false ? 'retry' : 'no-retry',
      severity: options?.retryable !== false ? 'degraded' : 'fatal',
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'AnalysisError';
    this.tool = options?.tool;
  }
}

/**
 * Operation exceeded its time budget.
 */
export class TimeoutError extends ScannerError {
  /** The timeout duration in milliseconds. */
  readonly timeoutMs: number;

  constructor(message: string, options: {
    timeoutMs: number;
    provider?: string;
    cause?: Error;
  }) {
    super(message, {
      category: 'timeout',
      retryDisposition: 'retry',
      severity: 'transient',
      provider: options.provider,
      cause: options.cause,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = options.timeoutMs;
  }
}

/**
 * System resource exhaustion: disk full, OOM, too many open files.
 */
export class ResourceError extends ScannerError {
  /** Which resource is exhausted. */
  readonly resource?: string;

  constructor(message: string, options?: {
    resource?: string;
    cause?: Error;
  }) {
    super(message, {
      category: 'resource',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      cause: options?.cause,
    });
    this.name = 'ResourceError';
    this.resource = options?.resource;
  }
}

/**
 * Smart contract-specific failures: compile errors, missing source, unsupported pragma.
 */
export class ContractError extends ScannerError {
  /** The contract address, if known. */
  readonly contractAddress?: string;

  constructor(message: string, options?: {
    contractAddress?: string;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(message, {
      category: 'contract',
      retryDisposition: options?.retryable ? 'retry' : 'no-retry',
      severity: 'degraded',
      cause: options?.cause,
    });
    this.name = 'ContractError';
    this.contractAddress = options?.contractAddress;
  }
}

// ── Utility ──

/**
 * Wrap an unknown thrown value into a ScannerError.
 * If it's already a ScannerError, return as-is.
 * Otherwise, wrap in a generic ScannerError with category 'unknown'.
 */
export function toScannerError(err: unknown, provider?: string): ScannerError {
  if (err instanceof ScannerError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? err : undefined;

  return new ScannerError(message, {
    category: 'unknown',
    retryDisposition: 'retry',
    severity: 'transient',
    provider,
    cause,
  });
}

/**
 * Check if an error is retryable.
 */
export function isRetryable(err: ScannerError): boolean {
  return err.retryDisposition !== 'no-retry';
}

/**
 * Check if an error should trigger provider rotation.
 */
export function shouldRotateProvider(err: ScannerError): boolean {
  return err.retryDisposition === 'retry-other';
}
