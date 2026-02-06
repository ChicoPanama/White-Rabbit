/**
 * Error taxonomy for the White-Rabbit scanner.
 *
 * Provides a structured hierarchy of error types that the retry engine,
 * error classifier, and provider rotation can reason about.
 *
 * Hierarchy:
 *   ScannerError (base)
 *   ├── NetworkError         — connectivity, DNS, socket hang up
 *   ├── RPCError             — blockchain RPC failures, triggers endpoint rotation
 *   ├── RateLimitError       — 429s, API quota exhaustion, mandatory backoff
 *   ├── ProviderError        — AI provider failures (5xx, model not found)
 *   ├── AuthError            — invalid API keys, expired tokens
 *   ├── ValidationError      — bad input, malformed config
 *   ├── DeliverableError     — missing/corrupt deliverables, phase gating failure
 *   ├── ToolError            — external tool failures (Slither, Foundry)
 *   ├── TimeoutError         — operation exceeded deadline
 *   ├── ParseError           — response parsing failures (AI, JSON)
 *   ├── BudgetError          — token/cost budget exceeded
 *   ├── ResourceError        — disk full, OOM, process limits
 *   └── ContractError        — Solidity compile failures, missing source
 */

// ── Error Categories (for classifier) ──

export type ErrorCategory =
  | 'rpc'           // Blockchain RPC failures
  | 'provider'      // AI provider failures
  | 'rate-limit'    // API rate limiting
  | 'tool'          // External tool failures (Slither, Foundry)
  | 'validation'    // Config/input validation errors
  | 'deliverable'   // Missing/corrupt deliverables
  | 'network'       // General network failures
  | 'timeout'       // Operation timeouts
  | 'parse'         // Response parsing failures
  | 'auth'          // Authentication/API key errors
  | 'budget'        // Token/cost budget exceeded
  | 'resource'      // System resource exhaustion
  | 'contract'      // Smart contract compile/source failures
  | 'unknown';      // Unclassified errors

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
  /** Structured error code (e.g. 'RATE_LIMIT', 'RPC_FAILED'). */
  readonly code: string;

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

  /** Additional context for logging. */
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code?: string;
      category: ErrorCategory;
      retryDisposition: RetryDisposition;
      severity: ErrorSeverity;
      statusCode?: number;
      provider?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'ScannerError';
    this.code = options.code ?? 'SCANNER_ERROR';
    this.category = options.category;
    this.retryDisposition = options.retryDisposition;
    this.severity = options.severity;
    this.statusCode = options.statusCode;
    this.provider = options.provider;
    this.cause = options.cause;
    this.timestamp = Date.now();
    this.context = options.context ?? {};
  }

  /** Whether this error can be retried. */
  isRetryable(): boolean {
    return this.retryDisposition !== 'no-retry';
  }

  /** Suggested delay before retry in ms. Override in subclasses. */
  getRetryDelay(attempt: number): number {
    if (!this.isRetryable()) return 0;
    return Math.min(1000 * Math.pow(2, attempt), 60_000);
  }

  /** Human-readable suggestion for fixing this error. */
  getSuggestedAction(): string {
    return 'Check logs for details and retry the operation.';
  }

  /** Serialize for structured logging. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      retryDisposition: this.retryDisposition,
      severity: this.severity,
      statusCode: this.statusCode,
      provider: this.provider,
      cause: this.cause?.message,
      timestamp: this.timestamp,
      context: this.context,
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
      code: 'NETWORK_ERROR',
      category: 'network',
      retryDisposition: 'retry',
      severity: 'transient',
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'NetworkError';
  }

  getSuggestedAction(): string {
    return 'Check network connectivity and DNS resolution. The operation will be retried automatically.';
  }
}

/**
 * Blockchain RPC failures: execution reverted, nonce too low, chain errors.
 * Triggers RPC endpoint rotation.
 */
export class RPCError extends ScannerError {
  readonly chain?: string;
  readonly endpoint?: string;

  constructor(message: string, options?: {
    chain?: string;
    endpoint?: string;
    cause?: Error;
  }) {
    super(message, {
      code: 'RPC_ERROR',
      category: 'rpc',
      retryDisposition: 'retry-other',
      severity: 'transient',
      cause: options?.cause,
      context: {
        chain: options?.chain,
        endpoint: options?.endpoint,
      },
    });
    this.name = 'RPCError';
    this.chain = options?.chain;
    this.endpoint = options?.endpoint;
  }

  getSuggestedAction(): string {
    return `RPC endpoint failed${this.chain ? ` for ${this.chain}` : ''}. Rotating to next available endpoint.`;
  }
}

/**
 * Rate limit responses (HTTP 429) or API quota exhaustion.
 * Retryable with mandatory backoff.
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
      code: 'RATE_LIMIT',
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

  getRetryDelay(attempt: number): number {
    if (this.retryAfterSeconds) {
      return this.retryAfterSeconds * 1000;
    }
    // Aggressive backoff for rate limits
    return Math.min(2000 * Math.pow(2, attempt), 120_000);
  }

  getSuggestedAction(): string {
    if (this.retryAfterSeconds) {
      return `Rate limited. Waiting ${this.retryAfterSeconds}s before retry (from Retry-After header).`;
    }
    return 'Rate limited. Backing off with exponential delay before retry.';
  }
}

/**
 * AI provider failures: 5xx errors, model not found, service unavailable.
 * Triggers fallback to alternate provider.
 */
export class ProviderError extends ScannerError {
  readonly model?: string;
  readonly endpoint?: string;

  constructor(message: string, options?: {
    provider?: string;
    model?: string;
    endpoint?: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(message, {
      code: 'PROVIDER_ERROR',
      category: 'provider',
      retryDisposition: 'retry-other',
      severity: 'degraded',
      statusCode: options?.statusCode,
      provider: options?.provider,
      cause: options?.cause,
      context: {
        model: options?.model,
        endpoint: options?.endpoint,
      },
    });
    this.name = 'ProviderError';
    this.model = options?.model;
    this.endpoint = options?.endpoint;
  }

  getSuggestedAction(): string {
    return `AI provider${this.provider ? ` (${this.provider})` : ''} failed. Rotating to fallback provider.`;
  }
}

/**
 * Authentication failures: invalid API key, expired token, forbidden.
 * Never retryable — the credentials need fixing.
 */
export class AuthError extends ScannerError {
  constructor(message: string, options?: {
    provider?: string;
    statusCode?: number;
    cause?: Error;
  }) {
    super(message, {
      code: 'AUTH_ERROR',
      category: 'auth',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      statusCode: options?.statusCode ?? 401,
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'AuthError';
  }

  getSuggestedAction(): string {
    return `Authentication failed${this.provider ? ` for ${this.provider}` : ''}. Check API key configuration.`;
  }
}

/** @deprecated Use AuthError instead. */
export const AuthenticationError = AuthError;

/**
 * Validation failures: malformed input, bad config, schema violations.
 * Never retryable — the input needs fixing.
 */
export class ValidationError extends ScannerError {
  readonly field?: string;

  constructor(message: string, options?: {
    field?: string;
    cause?: Error;
  }) {
    super(message, {
      code: 'VALIDATION_ERROR',
      category: 'validation',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      cause: options?.cause,
      context: { field: options?.field },
    });
    this.name = 'ValidationError';
    this.field = options?.field;
  }

  getSuggestedAction(): string {
    return `Validation failed${this.field ? ` for field '${this.field}'` : ''}. Check config and input parameters.`;
  }
}

/**
 * Missing or corrupt deliverables — phase gating failure.
 * Never retryable — a prior phase must complete first.
 */
export class DeliverableError extends ScannerError {
  readonly deliverable?: string;
  readonly phase?: string;

  constructor(message: string, options?: {
    deliverable?: string;
    phase?: string;
    cause?: Error;
  }) {
    super(message, {
      code: 'DELIVERABLE_ERROR',
      category: 'deliverable',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      cause: options?.cause,
      context: {
        deliverable: options?.deliverable,
        phase: options?.phase,
      },
    });
    this.name = 'DeliverableError';
    this.deliverable = options?.deliverable;
    this.phase = options?.phase;
  }

  getSuggestedAction(): string {
    return `Required deliverable '${this.deliverable ?? 'unknown'}' is missing. Ensure the ${this.phase ?? 'prerequisite'} phase completed successfully.`;
  }
}

/**
 * External tool failures: Slither crash, Foundry not installed, etc.
 * Retryable for transient crashes; non-retryable for missing tools.
 */
export class ToolError extends ScannerError {
  readonly tool?: string;

  constructor(message: string, options?: {
    tool?: string;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(message, {
      code: 'TOOL_ERROR',
      category: 'tool',
      retryDisposition: options?.retryable !== false ? 'retry' : 'no-retry',
      severity: options?.retryable !== false ? 'degraded' : 'fatal',
      cause: options?.cause,
      context: { tool: options?.tool },
    });
    this.name = 'ToolError';
    this.tool = options?.tool;
  }

  getSuggestedAction(): string {
    if (!this.isRetryable()) {
      return `Tool '${this.tool ?? 'unknown'}' is not available. Install it or skip this analysis step.`;
    }
    return `Tool '${this.tool ?? 'unknown'}' crashed. Retrying.`;
  }
}

/** @deprecated Use ToolError instead. */
export const AnalysisError = ToolError;

/**
 * Operation exceeded its time budget.
 * Retryable with extended timeout on retry.
 */
export class TimeoutError extends ScannerError {
  readonly timeoutMs: number;

  constructor(message: string, options: {
    timeoutMs: number;
    provider?: string;
    cause?: Error;
  }) {
    super(message, {
      code: 'TIMEOUT_ERROR',
      category: 'timeout',
      retryDisposition: 'retry',
      severity: 'transient',
      provider: options.provider,
      cause: options.cause,
      context: { timeoutMs: options.timeoutMs },
    });
    this.name = 'TimeoutError';
    this.timeoutMs = options.timeoutMs;
  }

  getRetryDelay(_attempt: number): number {
    // Brief delay then retry with (hopefully) extended timeout
    return 2000;
  }

  getSuggestedAction(): string {
    return `Operation timed out after ${this.timeoutMs}ms. Consider increasing timeout or simplifying input.`;
  }
}

/**
 * Response parsing failures: malformed JSON, unexpected AI response format.
 * Retryable once (AI may return better format), then permanent.
 */
export class ParseError extends ScannerError {
  constructor(message: string, options?: {
    provider?: string;
    cause?: Error;
  }) {
    super(message, {
      code: 'PARSE_ERROR',
      category: 'parse',
      retryDisposition: 'retry',
      severity: 'degraded',
      provider: options?.provider,
      cause: options?.cause,
    });
    this.name = 'ParseError';
  }

  getRetryDelay(_attempt: number): number {
    return 1000; // Quick retry — different response may parse fine
  }

  getSuggestedAction(): string {
    return 'Failed to parse response. Retrying once in case of transient formatting issue.';
  }
}

/**
 * Token or cost budget exceeded.
 * Never retryable — spending more won't help.
 */
export class BudgetError extends ScannerError {
  readonly budgetType?: 'tokens' | 'cost';
  readonly limit?: number;
  readonly used?: number;

  constructor(message: string, options?: {
    budgetType?: 'tokens' | 'cost';
    limit?: number;
    used?: number;
    provider?: string;
    cause?: Error;
  }) {
    super(message, {
      code: 'BUDGET_ERROR',
      category: 'budget',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      provider: options?.provider,
      cause: options?.cause,
      context: {
        budgetType: options?.budgetType,
        limit: options?.limit,
        used: options?.used,
      },
    });
    this.name = 'BudgetError';
    this.budgetType = options?.budgetType;
    this.limit = options?.limit;
    this.used = options?.used;
  }

  getSuggestedAction(): string {
    if (this.budgetType === 'cost') {
      return `Cost budget exceeded ($${this.used ?? '?'} / $${this.limit ?? '?'}). Increase budget or reduce scope.`;
    }
    return `Token budget exceeded (${this.used ?? '?'} / ${this.limit ?? '?'}). Reduce input size or increase limit.`;
  }
}

/**
 * System resource exhaustion: disk full, OOM, too many open files.
 * Never retryable.
 */
export class ResourceError extends ScannerError {
  readonly resource?: string;

  constructor(message: string, options?: {
    resource?: string;
    cause?: Error;
  }) {
    super(message, {
      code: 'RESOURCE_ERROR',
      category: 'resource',
      retryDisposition: 'no-retry',
      severity: 'fatal',
      cause: options?.cause,
      context: { resource: options?.resource },
    });
    this.name = 'ResourceError';
    this.resource = options?.resource;
  }

  getSuggestedAction(): string {
    return `System resource exhausted: ${this.resource ?? 'unknown'}. Free up resources before retrying.`;
  }
}

/**
 * Smart contract-specific failures: compile errors, missing source.
 */
export class ContractError extends ScannerError {
  readonly contractAddress?: string;

  constructor(message: string, options?: {
    contractAddress?: string;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(message, {
      code: 'CONTRACT_ERROR',
      category: 'contract',
      retryDisposition: options?.retryable ? 'retry' : 'no-retry',
      severity: 'degraded',
      cause: options?.cause,
      context: { contractAddress: options?.contractAddress },
    });
    this.name = 'ContractError';
    this.contractAddress = options?.contractAddress;
  }

  getSuggestedAction(): string {
    return `Contract${this.contractAddress ? ` ${this.contractAddress}` : ''} source issue. Check if contract is verified on Etherscan.`;
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
    code: 'UNKNOWN_ERROR',
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
  return err.isRetryable();
}

/**
 * Check if an error should trigger provider rotation.
 */
export function shouldRotateProvider(err: ScannerError): boolean {
  return err.retryDisposition === 'retry-other';
}
