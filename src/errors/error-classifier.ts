/**
 * Error classifier — maps raw errors to the scanner error taxonomy.
 *
 * Uses HTTP status codes, error message pattern matching, and provider
 * context to classify unknown errors into the correct ScannerError subclass.
 */

import {
  ScannerError,
  NetworkError,
  RateLimitError,
  ProviderError,
  AuthenticationError,
  ValidationError,
  AnalysisError,
  TimeoutError,
  ResourceError,
  ContractError,
  toScannerError,
} from './error-types.js';

// ── Classification Rules ──

interface ClassificationRule {
  /** Human-readable name for debugging. */
  name: string;

  /** Test if this rule matches. Return a ScannerError or null. */
  match(err: Error, context?: ClassificationContext): ScannerError | null;
}

export interface ClassificationContext {
  /** The provider or service that generated this error. */
  provider?: string;

  /** The HTTP status code if from an HTTP response. */
  statusCode?: number;

  /** The operation being performed (e.g. 'slither-analysis', 'ai-query'). */
  operation?: string;

  /** Contract address if relevant. */
  contractAddress?: string;
}

// ── Pattern Matchers ──

const NETWORK_PATTERNS = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EHOSTUNREACH/i,
  /ENETUNREACH/i,
  /socket hang up/i,
  /DNS resolution/i,
  /network error/i,
  /fetch failed/i,
  /ERR_NETWORK/i,
  /connection reset/i,
  /EPIPE/i,
];

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /throttl/i,
  /capacity/i,
  /overloaded/i,
  /requests per (second|minute|hour|day)/i,
];

const AUTH_PATTERNS = [
  /invalid.*api.*key/i,
  /unauthorized/i,
  /forbidden/i,
  /authentication/i,
  /invalid.*token/i,
  /expired.*token/i,
  /api key.*invalid/i,
  /permission denied/i,
  /access denied/i,
  /invalid x-api-key/i,
];

const TIMEOUT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /deadline exceeded/i,
  /operation.*took too long/i,
  /ESOCKETTIMEDOUT/i,
  /request.*aborted/i,
];

const RESOURCE_PATTERNS = [
  /ENOSPC/i,
  /disk full/i,
  /no space left/i,
  /out of memory/i,
  /OOM/,
  /ENOMEM/i,
  /EMFILE/i,
  /too many open files/i,
  /heap.*limit/i,
  /allocation failed/i,
];

const CONTRACT_PATTERNS = [
  /solc.*error/i,
  /compilation.*failed/i,
  /pragma solidity/i,
  /contract source.*not (found|verified)/i,
  /not verified/i,
  /invalid bytecode/i,
  /constructor.*error/i,
  /Source code not verified/i,
  /missing source/i,
];

const ANALYSIS_PATTERNS = [
  /slither.*failed/i,
  /slither.*error/i,
  /slither.*crash/i,
  /analysis.*failed/i,
  /parsing.*failed/i,
  /malformed.*response/i,
  /invalid.*json/i,
  /response.*parse/i,
  /unexpected.*format/i,
];

// ── Classification Rules ──

const rules: ClassificationRule[] = [
  // Rule 1: Already a ScannerError → pass through
  {
    name: 'already-classified',
    match(err) {
      return err instanceof ScannerError ? err : null;
    },
  },

  // Rule 2: HTTP status codes
  {
    name: 'http-status',
    match(err, ctx) {
      const status = ctx?.statusCode ?? extractStatusCode(err);
      if (!status) return null;

      if (status === 401 || status === 403) {
        return new AuthenticationError(err.message, {
          provider: ctx?.provider,
          statusCode: status,
          cause: err,
        });
      }

      if (status === 429) {
        const retryAfter = extractRetryAfter(err);
        return new RateLimitError(err.message, {
          provider: ctx?.provider,
          retryAfterSeconds: retryAfter,
          cause: err,
        });
      }

      if (status >= 500 && status < 600) {
        return new ProviderError(err.message, {
          provider: ctx?.provider,
          statusCode: status,
          cause: err,
        });
      }

      if (status === 400 || status === 422) {
        return new ValidationError(err.message, { cause: err });
      }

      return null;
    },
  },

  // Rule 3: Network patterns
  {
    name: 'network-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, NETWORK_PATTERNS)) {
        return new NetworkError(err.message, { provider: ctx?.provider, cause: err });
      }
      return null;
    },
  },

  // Rule 4: Rate limit patterns
  {
    name: 'rate-limit-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, RATE_LIMIT_PATTERNS)) {
        return new RateLimitError(err.message, {
          provider: ctx?.provider,
          retryAfterSeconds: extractRetryAfter(err),
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 5: Auth patterns
  {
    name: 'auth-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, AUTH_PATTERNS)) {
        return new AuthenticationError(err.message, {
          provider: ctx?.provider,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 6: Timeout patterns
  {
    name: 'timeout-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, TIMEOUT_PATTERNS)) {
        return new TimeoutError(err.message, {
          timeoutMs: 0,
          provider: ctx?.provider,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 7: Resource patterns
  {
    name: 'resource-pattern',
    match(err) {
      if (matchesAny(err.message, RESOURCE_PATTERNS)) {
        const resource = identifyResource(err.message);
        return new ResourceError(err.message, { resource, cause: err });
      }
      return null;
    },
  },

  // Rule 8: Contract-specific patterns
  {
    name: 'contract-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, CONTRACT_PATTERNS)) {
        return new ContractError(err.message, {
          contractAddress: ctx?.contractAddress,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 9: Analysis tool patterns
  {
    name: 'analysis-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, ANALYSIS_PATTERNS)) {
        return new AnalysisError(err.message, {
          tool: ctx?.operation,
          provider: ctx?.provider,
          retryable: true,
          cause: err,
        });
      }
      return null;
    },
  },
];

// ── Public API ──

/**
 * Classify an unknown error into the scanner error taxonomy.
 *
 * Runs through classification rules in priority order. Returns the first
 * match, or wraps the error in a generic ScannerError with category 'unknown'.
 */
export function classifyError(
  err: unknown,
  context?: ClassificationContext,
): ScannerError {
  // Ensure we have an Error object
  const error = err instanceof Error ? err : new Error(String(err));

  for (const rule of rules) {
    const result = rule.match(error, context);
    if (result) return result;
  }

  // Fallback: wrap in generic ScannerError
  return toScannerError(error, context?.provider);
}

/**
 * Classify and enrich with provider context.
 *
 * Convenience wrapper for classify that adds provider and operation metadata.
 */
export function classifyWithContext(
  err: unknown,
  provider: string,
  operation: string,
): ScannerError {
  return classifyError(err, { provider, operation });
}

// ── Helpers ──

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(message));
}

/**
 * Try to extract HTTP status code from error.
 * Many HTTP libraries attach status/statusCode to the error object.
 */
function extractStatusCode(err: Error): number | undefined {
  const anyErr = err as Record<string, unknown>;
  if (typeof anyErr.status === 'number') return anyErr.status;
  if (typeof anyErr.statusCode === 'number') return anyErr.statusCode;
  if (typeof anyErr.response === 'object' && anyErr.response !== null) {
    const resp = anyErr.response as Record<string, unknown>;
    if (typeof resp.status === 'number') return resp.status;
    if (typeof resp.statusCode === 'number') return resp.statusCode;
  }

  // Try to parse from message (e.g. "Request failed with status 429")
  const match = err.message.match(/status[:\s]+(\d{3})/i);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

/**
 * Try to extract Retry-After seconds from an error.
 */
function extractRetryAfter(err: Error): number | undefined {
  const anyErr = err as Record<string, unknown>;

  // Check error.headers
  if (typeof anyErr.headers === 'object' && anyErr.headers !== null) {
    const headers = anyErr.headers as Record<string, string>;
    const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds;
    }
  }

  // Check response.headers
  if (typeof anyErr.response === 'object' && anyErr.response !== null) {
    const resp = anyErr.response as Record<string, unknown>;
    if (typeof resp.headers === 'object' && resp.headers !== null) {
      const headers = resp.headers as Record<string, string>;
      const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) return seconds;
      }
    }
  }

  // Try to parse from message (e.g. "retry after 60 seconds")
  const match = err.message.match(/retry.*?(\d+)\s*s/i);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

/**
 * Identify which resource is exhausted from an error message.
 */
function identifyResource(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('disk') || lower.includes('nospc') || lower.includes('space')) return 'disk';
  if (lower.includes('memory') || lower.includes('oom') || lower.includes('heap')) return 'memory';
  if (lower.includes('emfile') || lower.includes('open files')) return 'file-descriptors';
  return 'unknown';
}
