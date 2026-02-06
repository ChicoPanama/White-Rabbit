/**
 * Error reporting and health diagnostics.
 *
 * Generates human-readable error reports from session errors,
 * and provides health status for providers and RPC endpoints.
 */

import type { ScannerError, ErrorCategory } from './error-types.js';
import type { ProviderRotator, RPCRotator, ProviderSnapshot, RPCSnapshot } from './provider-rotation.js';

// ── Error Report ──

/**
 * Generate a human-readable error report from session errors.
 *
 * Groups errors by category, shows timeline, highlights patterns,
 * and suggests fixes.
 */
export function generateErrorReport(sessionErrors: ScannerError[]): string {
  if (sessionErrors.length === 0) {
    return '# Error Report\n\nNo errors recorded during this session.';
  }

  const lines: string[] = [];
  lines.push('# Error Report');
  lines.push('');

  // ── Summary ──
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total errors:** ${sessionErrors.length}`);
  lines.push(`- **Retryable:** ${sessionErrors.filter(e => e.isRetryable()).length}`);
  lines.push(`- **Non-retryable:** ${sessionErrors.filter(e => !e.isRetryable()).length}`);
  lines.push('');

  // ── By Category ──
  const byCategory = groupBy(sessionErrors, e => e.category);
  lines.push('## Errors by Category');
  lines.push('');

  for (const [category, errors] of sortedEntries(byCategory)) {
    lines.push(`### ${category} (${errors.length})`);
    lines.push('');
    for (const err of errors) {
      const ts = new Date(err.timestamp).toISOString();
      const retryIcon = err.isRetryable() ? '[retryable]' : '[permanent]';
      lines.push(`- \`${ts}\` ${retryIcon} ${err.message}`);
      if (err.provider) lines.push(`  - Provider: ${err.provider}`);
      if (err.statusCode) lines.push(`  - Status: ${err.statusCode}`);
    }
    lines.push('');
  }

  // ── Timeline ──
  lines.push('## Error Timeline');
  lines.push('');

  const sorted = [...sessionErrors].sort((a, b) => a.timestamp - b.timestamp);
  for (const err of sorted) {
    const ts = new Date(err.timestamp).toISOString();
    lines.push(`- \`${ts}\` **${err.category}** — ${err.message.slice(0, 120)}`);
  }
  lines.push('');

  // ── Patterns ──
  const patterns = detectPatterns(sessionErrors);
  if (patterns.length > 0) {
    lines.push('## Detected Patterns');
    lines.push('');
    for (const pattern of patterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  // ── Suggestions ──
  const suggestions = generateSuggestions(sessionErrors);
  if (suggestions.length > 0) {
    lines.push('## Suggestions');
    lines.push('');
    for (const suggestion of suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Error Metrics ──

export interface ErrorMetrics {
  total: number;
  byCategory: Record<string, number>;
  retryAttempts: number;
  providerRotations: number;
  circuitBreakerTrips: number;
  nonRetryable: number;
  timeline: Array<{ timestamp: number; category: string; message: string }>;
}

/**
 * Build error metrics from session errors for inclusion in session-metrics.json.
 */
export function buildErrorMetrics(
  sessionErrors: ScannerError[],
  retryAttempts: number,
  providerRotations: number,
  circuitBreakerTrips: number,
): ErrorMetrics {
  const byCategory: Record<string, number> = {};
  for (const err of sessionErrors) {
    byCategory[err.category] = (byCategory[err.category] ?? 0) + 1;
  }

  return {
    total: sessionErrors.length,
    byCategory,
    retryAttempts,
    providerRotations,
    circuitBreakerTrips,
    nonRetryable: sessionErrors.filter(e => !e.isRetryable()).length,
    timeline: sessionErrors.map(e => ({
      timestamp: e.timestamp,
      category: e.category,
      message: e.message.slice(0, 200),
    })),
  };
}

// ── Health Status ──

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  providers: ProviderHealthEntry[];
  rpcEndpoints: Record<string, RPCHealthEntry[]>;
  warnings: string[];
}

interface ProviderHealthEntry {
  id: string;
  endpoint: string;
  model: string;
  status: 'healthy' | 'degraded' | 'down';
  failures: number;
  successes: number;
  averageLatencyMs: number;
  inCooldown: boolean;
  hasApiKey: boolean;
}

interface RPCHealthEntry {
  id: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  failures: number;
  successes: number;
  averageLatencyMs: number;
  inCooldown: boolean;
}

/**
 * Get health status of all providers and RPC endpoints.
 */
export function getHealthStatus(
  providerRotator?: ProviderRotator,
  rpcRotator?: RPCRotator,
): HealthStatus {
  const warnings: string[] = [];
  const providers: ProviderHealthEntry[] = [];
  const rpcEndpoints: Record<string, RPCHealthEntry[]> = {};

  // Provider health
  if (providerRotator) {
    for (const snap of providerRotator.getSnapshot()) {
      const status = getProviderStatus(snap);
      providers.push({
        id: snap.id,
        endpoint: snap.endpoint,
        model: snap.model,
        status,
        failures: snap.failures,
        successes: snap.successes,
        averageLatencyMs: snap.averageLatencyMs,
        inCooldown: snap.inCooldown,
        hasApiKey: snap.hasApiKey,
      });

      if (!snap.hasApiKey) {
        warnings.push(`Provider ${snap.id}: API key not configured (env: missing)`);
      }
      if (snap.inCooldown) {
        warnings.push(`Provider ${snap.id}: in cooldown (${snap.cooldownRemainingMs}ms remaining)`);
      }
      if (snap.circuitState === 'open') {
        warnings.push(`Provider ${snap.id}: circuit breaker OPEN`);
      }
    }
  }

  // RPC health
  if (rpcRotator) {
    const snapshot = rpcRotator.getSnapshot();
    for (const [chain, endpoints] of Object.entries(snapshot)) {
      rpcEndpoints[chain] = endpoints.map(snap => {
        const status = getRPCStatus(snap);

        if (snap.inCooldown) {
          warnings.push(`RPC ${chain}/${snap.id}: in cooldown`);
        }
        if (snap.circuitState === 'open') {
          warnings.push(`RPC ${chain}/${snap.id}: circuit breaker OPEN`);
        }

        return {
          id: snap.id,
          url: snap.url,
          status,
          failures: snap.failures,
          successes: snap.successes,
          averageLatencyMs: snap.averageLatencyMs,
          inCooldown: snap.inCooldown,
        };
      });
    }
  }

  // Overall health
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const downProviders = providers.filter(p => p.status === 'down');
  const degradedProviders = providers.filter(p => p.status === 'degraded');

  if (providers.length > 0 && downProviders.length === providers.length) {
    overall = 'unhealthy';
  } else if (downProviders.length > 0 || degradedProviders.length > 0) {
    overall = 'degraded';
  }

  // Check RPC chains
  for (const [chain, endpoints] of Object.entries(rpcEndpoints)) {
    const allDown = endpoints.every(e => e.status === 'down');
    if (allDown && endpoints.length > 0) {
      overall = 'unhealthy';
      warnings.push(`All RPC endpoints for ${chain} are down`);
    }
  }

  return { overall, providers, rpcEndpoints, warnings };
}

/**
 * Format health status as human-readable text (for CLI output).
 */
export function formatHealthStatus(health: HealthStatus): string {
  const lines: string[] = [];

  const statusIcon = health.overall === 'healthy' ? 'OK'
    : health.overall === 'degraded' ? 'DEGRADED'
    : 'UNHEALTHY';

  lines.push(`System Health: ${statusIcon}`);
  lines.push('');

  // Providers
  if (health.providers.length > 0) {
    lines.push('AI Providers:');
    for (const p of health.providers) {
      const status = p.status === 'healthy' ? 'OK'
        : p.status === 'degraded' ? 'DEGRADED'
        : 'DOWN';
      const apiKeyStatus = p.hasApiKey ? '' : ' [NO API KEY]';
      const cooldown = p.inCooldown ? ' [COOLDOWN]' : '';
      lines.push(`  ${p.id}: ${status}${apiKeyStatus}${cooldown} (${p.successes}/${p.successes + p.failures} success, ${p.averageLatencyMs}ms avg)`);
    }
    lines.push('');
  } else {
    lines.push('AI Providers: none configured');
    lines.push('');
  }

  // RPC Endpoints
  const chainCount = Object.keys(health.rpcEndpoints).length;
  if (chainCount > 0) {
    lines.push('RPC Endpoints:');
    for (const [chain, endpoints] of Object.entries(health.rpcEndpoints)) {
      lines.push(`  ${chain}:`);
      for (const e of endpoints) {
        const status = e.status === 'healthy' ? 'OK'
          : e.status === 'degraded' ? 'DEGRADED'
          : 'DOWN';
        const cooldown = e.inCooldown ? ' [COOLDOWN]' : '';
        const active = e.id.includes('active') ? ' *' : '';
        lines.push(`    ${e.id}: ${status}${cooldown}${active} (${e.averageLatencyMs}ms avg)`);
      }
    }
    lines.push('');
  } else {
    lines.push('RPC Endpoints: none configured');
    lines.push('');
  }

  // Warnings
  if (health.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of health.warnings) {
      lines.push(`  ! ${w}`);
    }
  }

  return lines.join('\n');
}

// ── Helpers ──

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

function sortedEntries<T>(map: Map<string, T[]>): [string, T[]][] {
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

function detectPatterns(errors: ScannerError[]): string[] {
  const patterns: string[] = [];

  // Pattern: repeated failures from the same provider
  const byProvider = groupBy(errors.filter(e => e.provider), e => e.provider!);
  for (const [provider, provErrors] of byProvider) {
    if (provErrors.length >= 3) {
      const recovered = provErrors.some((_, i) =>
        i > 0 && provErrors[i - 1].timestamp < provErrors[i].timestamp
      );
      if (recovered) {
        patterns.push(`Provider ${provider} failed ${provErrors.length} times then recovered`);
      } else {
        patterns.push(`Provider ${provider} failed ${provErrors.length} times consecutively`);
      }
    }
  }

  // Pattern: rate limiting spike
  const rateLimitErrors = errors.filter(e => e.category === 'rate-limit');
  if (rateLimitErrors.length >= 3) {
    const window = rateLimitErrors[rateLimitErrors.length - 1].timestamp - rateLimitErrors[0].timestamp;
    const windowSec = Math.round(window / 1000);
    patterns.push(`Rate limited ${rateLimitErrors.length} times within ${windowSec}s`);
  }

  // Pattern: timeout cascade
  const timeouts = errors.filter(e => e.category === 'timeout');
  if (timeouts.length >= 3) {
    patterns.push(`Timeout cascade: ${timeouts.length} timeouts detected`);
  }

  return patterns;
}

function generateSuggestions(errors: ScannerError[]): string[] {
  const suggestions = new Set<string>();
  const categories = new Set(errors.map(e => e.category));

  if (categories.has('auth')) {
    suggestions.add('Check API key configuration — authentication errors are permanent failures');
  }

  if (categories.has('budget')) {
    suggestions.add('Token/cost budget exceeded — increase budget or reduce scan scope');
  }

  if (categories.has('rate-limit')) {
    const count = errors.filter(e => e.category === 'rate-limit').length;
    if (count >= 5) {
      suggestions.add('Heavy rate limiting — consider adding a fallback AI provider');
    } else {
      suggestions.add('Rate limiting detected — backoff is being applied automatically');
    }
  }

  if (categories.has('provider')) {
    const providers = new Set(errors.filter(e => e.category === 'provider' && e.provider).map(e => e.provider));
    if (providers.size === 1) {
      suggestions.add('Single provider failing — configure fallback providers for resilience');
    }
  }

  if (categories.has('rpc')) {
    suggestions.add('RPC failures detected — ensure multiple RPC endpoints are configured per chain');
  }

  if (categories.has('tool')) {
    const toolErrors = errors.filter(e => e.category === 'tool');
    const nonRetryable = toolErrors.filter(e => !e.isRetryable());
    if (nonRetryable.length > 0) {
      suggestions.add('External tool not installed — install missing tools (Slither, Foundry) or disable dependent agents');
    }
  }

  if (categories.has('resource')) {
    suggestions.add('System resource exhaustion — check disk space and memory');
  }

  return [...suggestions];
}

function getProviderStatus(snap: ProviderSnapshot): 'healthy' | 'degraded' | 'down' {
  if (!snap.hasApiKey) return 'down';
  if (snap.circuitState === 'open') return 'down';
  if (snap.inCooldown) return 'down';
  if (snap.failures > 0 && snap.failures < snap.totalRequests / 2) return 'degraded';
  if (snap.circuitState === 'half-open') return 'degraded';
  return 'healthy';
}

function getRPCStatus(snap: RPCSnapshot): 'healthy' | 'degraded' | 'down' {
  if (snap.circuitState === 'open') return 'down';
  if (snap.inCooldown) return 'down';
  if (snap.failures > 0 && snap.failures < snap.totalRequests / 2) return 'degraded';
  if (snap.circuitState === 'half-open') return 'degraded';
  return 'healthy';
}
