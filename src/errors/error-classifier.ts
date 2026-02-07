/**
 * Error classifier — maps raw errors to the scanner error taxonomy.
 *
 * Uses HTTP status codes, error message pattern matching, and provider
 * context to classify unknown errors into the correct ScannerError subclass.
 */

import {
  ScannerError,
  NetworkError,
  RPCError,
  RateLimitError,
  ProviderError,
  AuthError,
  ValidationError,
  DeliverableError,
  ToolError,
  TimeoutError,
  ParseError,
  BudgetError,
  ResourceError,
  ContractError,
  toScannerError,
} from './error-types.js';

// ── Classification Context ──

export interface ClassificationContext {
  /** The source that generated this error. */
  source?: 'rpc' | 'ai-provider' | 'tool' | 'network' | 'internal';

  /** The provider or service name. */
  provider?: string;

  /** The HTTP status code if from an HTTP response. */
  statusCode?: number;

  /** The operation being performed. */
  operation?: string;

  /** Contract address if relevant. */
  contractAddress?: string;

  /** Agent ID if inside an agent context. */
  agentId?: string;

  /** Pipeline phase name. */
  phase?: string;

  /** Endpoint URL. */
  endpoint?: string;

  /** AI model string. */
  model?: string;

  /** Blockchain chain identifier. */
  chain?: string;

  /** Current retry attempt number. */
  attemptNumber?: number;
}

// ── Classification Rules ──

interface ClassificationRule {
  name: string;
  match(err: Error, context?: ClassificationContext): ScannerError | null;
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

const RPC_PATTERNS = [
  /execution reverted/i,
  /nonce too low/i,
  /insufficient funds/i,
  /gas required exceeds/i,
  /replacement transaction underpriced/i,
  /already known/i,
  /block not found/i,
  /header not found/i,
  /missing trie node/i,
  /transaction underpriced/i,
  /intrinsic gas too low/i,
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

const BUDGET_PATTERNS = [
  /context length/i,
  /token limit/i,
  /max tokens/i,
  /context window/i,
  /maximum context/i,
  /budget exceeded/i,
  /cost limit/i,
  /spending limit/i,
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

const TOOL_MISSING_PATTERNS = [
  /command not found/i,
  /ENOENT/,
  /not found.*command/i,
  /not installed/i,
];

const TOOL_CRASH_PATTERNS = [
  /slither.*failed/i,
  /slither.*error/i,
  /slither.*crash/i,
  /foundry.*failed/i,
  /forge.*failed/i,
  /analysis.*failed/i,
];

const PARSE_PATTERNS = [
  /JSON\.parse/i,
  /unexpected token/i,
  /malformed.*response/i,
  /invalid.*json/i,
  /response.*parse/i,
  /unexpected.*format/i,
  /SyntaxError.*JSON/i,
];

const CONTRACT_PATTERNS = [
  /solc.*error/i,
  /compilation.*failed/i,
  /pragma solidity/i,
  /contract source.*not (found|verified)/i,
  /not verified/i,
  /invalid bytecode/i,
  /Source code not verified/i,
  /missing source/i,
];

const DELIVERABLE_PATTERNS = [
  /deliverable.*not found/i,
  /deliverable.*missing/i,
  /phase.*prerequisite/i,
  /required.*deliverable/i,
];

// ── Classification Rules ──

const rules: ClassificationRule[] = [
  // Rule 0: Already a ScannerError → pass through
  {
    name: 'already-classified',
    match(err) {
      return err instanceof ScannerError ? err : null;
    },
  },

  // Rule 1: Context-based source classification (highest priority after pass-through)
  {
    name: 'context-source',
    match(err, ctx) {
      if (!ctx?.source) return null;

      if (ctx.source === 'rpc') {
        return new RPCError(err.message, {
          chain: ctx.chain,
          endpoint: ctx.endpoint,
          cause: err,
        });
      }

      if (ctx.source === 'ai-provider') {
        // Still check for specific subtypes before defaulting to ProviderError
        return null; // Fall through to more specific rules
      }

      return null;
    },
  },

  // Rule 2: HTTP status codes
  {
    name: 'http-status',
    match(err, ctx) {
      const status = ctx?.statusCode ?? extractStatusCode(err);
      if (!status) return null;

      if (status === 401 || status === 403) {
        return new AuthError(err.message, {
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

      if (status === 408 || status === 504) {
        return new TimeoutError(err.message, {
          timeoutMs: 0,
          provider: ctx?.provider,
          cause: err,
        });
      }

      if (status >= 500 && status < 600) {
        // Differentiate between RPC and AI provider based on context
        if (ctx?.source === 'rpc') {
          return new RPCError(err.message, {
            chain: ctx.chain,
            endpoint: ctx.endpoint,
            cause: err,
          });
        }
        return new ProviderError(err.message, {
          provider: ctx?.provider,
          model: ctx?.model,
          endpoint: ctx?.endpoint,
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

  // Rule 3: Budget patterns (before rate limit to avoid false matches)
  {
    name: 'budget-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, BUDGET_PATTERNS)) {
        return new BudgetError(err.message, {
          budgetType: 'tokens',
          provider: ctx?.provider,
          cause: err,
        });
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
        return new AuthError(err.message, {
          provider: ctx?.provider,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 6: RPC patterns
  {
    name: 'rpc-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, RPC_PATTERNS)) {
        return new RPCError(err.message, {
          chain: ctx?.chain,
          endpoint: ctx?.endpoint,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 7: Network patterns
  {
    name: 'network-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, NETWORK_PATTERNS)) {
        return new NetworkError(err.message, { provider: ctx?.provider, cause: err });
      }
      return null;
    },
  },

  // Rule 8: Timeout patterns
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

  // Rule 9: Resource patterns
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

  // Rule 10: Deliverable patterns
  {
    name: 'deliverable-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, DELIVERABLE_PATTERNS)) {
        return new DeliverableError(err.message, {
          phase: ctx?.phase,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 11: Tool missing patterns (non-retryable)
  {
    name: 'tool-missing-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, TOOL_MISSING_PATTERNS)) {
        return new ToolError(err.message, {
          tool: ctx?.operation,
          retryable: false,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 12: Tool crash patterns (retryable)
  {
    name: 'tool-crash-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, TOOL_CRASH_PATTERNS)) {
        return new ToolError(err.message, {
          tool: ctx?.operation,
          retryable: true,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 13: Parse errors
  {
    name: 'parse-pattern',
    match(err, ctx) {
      if (matchesAny(err.message, PARSE_PATTERNS)) {
        return new ParseError(err.message, {
          provider: ctx?.provider,
          cause: err,
        });
      }
      return null;
    },
  },

  // Rule 14: Contract-specific patterns
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

  // Rule 15: Context-based fallback for AI provider errors
  {
    name: 'ai-provider-fallback',
    match(err, ctx) {
      if (ctx?.source === 'ai-provider') {
        return new ProviderError(err.message, {
          provider: ctx.provider,
          model: ctx.model,
          endpoint: ctx.endpoint,
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
  const error = err instanceof Error ? err : new Error(String(err));

  for (const rule of rules) {
    const result = rule.match(error, context);
    if (result) return result;
  }

  return toScannerError(error, context?.provider);
}

/**
 * Classify and enrich with provider context.
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

function extractStatusCode(err: Error): number | undefined {
  const anyErr = err as Record<string, unknown>;
  if (typeof anyErr.status === 'number') return anyErr.status;
  if (typeof anyErr.statusCode === 'number') return anyErr.statusCode;
  if (typeof anyErr.response === 'object' && anyErr.response !== null) {
    const resp = anyErr.response as Record<string, unknown>;
    if (typeof resp.status === 'number') return resp.status;
    if (typeof resp.statusCode === 'number') return resp.statusCode;
  }

  const match = err.message.match(/status[:\s]+(\d{3})/i);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

function extractRetryAfter(err: Error): number | undefined {
  const anyErr = err as Record<string, unknown>;

  if (typeof anyErr.headers === 'object' && anyErr.headers !== null) {
    const headers = anyErr.headers as Record<string, string>;
    const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds;
    }
  }

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

  const match = err.message.match(/retry.*?(\d+)\s*s/i);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

function identifyResource(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('disk') || lower.includes('nospc') || lower.includes('space')) return 'disk';
  if (lower.includes('memory') || lower.includes('oom') || lower.includes('heap')) return 'memory';
  if (lower.includes('emfile') || lower.includes('open files')) return 'file-descriptors';
  return 'unknown';
}
