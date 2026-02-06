/**
 * Provider and RPC endpoint rotation with failure tracking.
 *
 * ProviderRotator — manages AI provider failover (primary + fallbacks).
 * RPCRotator — manages blockchain RPC endpoint failover per chain.
 *
 * Both integrate with the circuit breaker from retry-engine to auto-rotate
 * when an endpoint exceeds its failure threshold.
 */

import type { ScannerError } from './error-types.js';
import { CircuitBreaker, type CircuitBreakerConfig } from './retry-engine.js';

// ── Provider Configuration ──

export interface ProviderConfig {
  /** Unique identifier for this provider entry. */
  id: string;

  /** Base URL or endpoint. */
  endpoint: string;

  /** Model identifier to use with this provider. */
  model: string;

  /** Environment variable name holding the API key. */
  apiKeyEnv: string;

  /** Priority — lower numbers are preferred. */
  priority: number;

  /** Max consecutive failures before rotating away. */
  maxFailures: number;

  /** Cooldown in ms after max failures. */
  cooldownMs: number;
}

interface ProviderState {
  config: ProviderConfig;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailure?: number;
  lastSuccess?: number;
  cooldownUntil?: number;
  averageLatencyMs: number;
  latencySamples: number[];
}

// ── ProviderRotator ──

/**
 * Manages AI provider rotation with failure tracking.
 *
 * Providers are configured via ProviderConfig[] (read from scan config).
 * The rotator tracks failures per provider and auto-rotates to the next
 * available provider when the current one exceeds its failure threshold.
 */
export class ProviderRotator {
  private readonly providers: ProviderState[];
  private activeIndex: number = 0;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rotationLog: RotationEvent[] = [];

  constructor(
    configs: ProviderConfig[],
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
  ) {
    // Sort by priority (lowest first)
    const sorted = [...configs].sort((a, b) => a.priority - b.priority);

    this.providers = sorted.map(config => ({
      config,
      failures: 0,
      successes: 0,
      totalRequests: 0,
      averageLatencyMs: 0,
      latencySamples: [],
    }));

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: sorted[0]?.maxFailures ?? 5,
      resetTimeoutMs: sorted[0]?.cooldownMs ?? 60_000,
      ...circuitBreakerConfig,
    });
  }

  /** Get the currently active provider. */
  getActiveProvider(): ProviderConfig | undefined {
    if (this.providers.length === 0) return undefined;

    // Skip providers in cooldown or with open circuits
    for (let i = 0; i < this.providers.length; i++) {
      const idx = (this.activeIndex + i) % this.providers.length;
      const state = this.providers[idx];

      if (state.cooldownUntil && Date.now() < state.cooldownUntil) continue;
      if (this.circuitBreaker.isOpen(state.config.id)) continue;

      // Check API key is present
      const apiKey = process.env[state.config.apiKeyEnv];
      if (!apiKey) continue;

      this.activeIndex = idx;
      return state.config;
    }

    // All providers in cooldown — return the one with shortest remaining cooldown
    const byExpiry = this.providers
      .filter(p => process.env[p.config.apiKeyEnv])
      .sort((a, b) => (a.cooldownUntil ?? 0) - (b.cooldownUntil ?? 0));

    if (byExpiry.length > 0) {
      const idx = this.providers.indexOf(byExpiry[0]);
      this.activeIndex = idx;
      return byExpiry[0].config;
    }

    return undefined;
  }

  /** Report a failure for a specific provider endpoint. */
  reportFailure(id: string, error: ScannerError): void {
    const state = this.providers.find(p => p.config.id === id);
    if (!state) return;

    state.failures++;
    state.totalRequests++;
    state.lastFailure = Date.now();

    this.circuitBreaker.recordFailure(id, error);

    if (state.failures >= state.config.maxFailures) {
      state.cooldownUntil = Date.now() + state.config.cooldownMs;
      console.log(`[ProviderRotator] Provider ${id} exceeded failure threshold (${state.failures}/${state.config.maxFailures}), cooling down for ${state.config.cooldownMs}ms`);
    }
  }

  /** Report a success for a specific provider endpoint. */
  reportSuccess(id: string, latencyMs?: number): void {
    const state = this.providers.find(p => p.config.id === id);
    if (!state) return;

    state.failures = 0;
    state.successes++;
    state.totalRequests++;
    state.lastSuccess = Date.now();
    state.cooldownUntil = undefined;

    this.circuitBreaker.recordSuccess(id);

    if (latencyMs !== undefined) {
      state.latencySamples.push(latencyMs);
      if (state.latencySamples.length > 20) state.latencySamples.shift();
      state.averageLatencyMs = state.latencySamples.reduce((a, b) => a + b, 0) / state.latencySamples.length;
    }
  }

  /** Rotate to the next available provider. Returns the new provider or undefined. */
  rotateProvider(): ProviderConfig | undefined {
    const current = this.providers[this.activeIndex]?.config;
    const oldIndex = this.activeIndex;

    // Try next providers in priority order
    for (let i = 1; i < this.providers.length; i++) {
      const idx = (this.activeIndex + i) % this.providers.length;
      const state = this.providers[idx];

      if (state.cooldownUntil && Date.now() < state.cooldownUntil) continue;
      if (this.circuitBreaker.isOpen(state.config.id)) continue;
      if (!process.env[state.config.apiKeyEnv]) continue;

      this.activeIndex = idx;

      this.rotationLog.push({
        timestamp: Date.now(),
        from: current?.id ?? 'none',
        to: state.config.id,
        reason: 'failure',
      });

      console.log(`[ProviderRotator] Rotated from ${current?.id ?? 'none'} to ${state.config.id}`);
      return state.config;
    }

    // No other providers available
    if (oldIndex === this.activeIndex) {
      console.log('[ProviderRotator] No alternative providers available');
    }
    return undefined;
  }

  /** Get snapshot of all provider states for health reporting. */
  getSnapshot(): ProviderSnapshot[] {
    return this.providers.map(s => ({
      id: s.config.id,
      endpoint: s.config.endpoint,
      model: s.config.model,
      priority: s.config.priority,
      failures: s.failures,
      successes: s.successes,
      totalRequests: s.totalRequests,
      averageLatencyMs: Math.round(s.averageLatencyMs),
      isActive: this.providers[this.activeIndex] === s,
      inCooldown: s.cooldownUntil ? Date.now() < s.cooldownUntil : false,
      cooldownRemainingMs: s.cooldownUntil ? Math.max(0, s.cooldownUntil - Date.now()) : 0,
      circuitState: this.circuitBreaker.getState(s.config.id)?.state ?? 'closed',
      hasApiKey: !!process.env[s.config.apiKeyEnv],
    }));
  }

  /** Get rotation event log. */
  getRotationLog(): RotationEvent[] {
    return [...this.rotationLog];
  }

  /** Reset all provider states. */
  reset(): void {
    for (const state of this.providers) {
      state.failures = 0;
      state.successes = 0;
      state.totalRequests = 0;
      state.cooldownUntil = undefined;
      state.latencySamples = [];
      state.averageLatencyMs = 0;
    }
    this.activeIndex = 0;
    this.circuitBreaker.resetAll();
    this.rotationLog.length = 0;
  }
}

// ── RPC Rotation ──

export interface RPCEndpointConfig {
  /** Unique identifier. */
  id: string;

  /** RPC URL. */
  url: string;

  /** Chain identifier (e.g. 'ethereum', 'bsc'). */
  chain: string;

  /** Priority — lower numbers are preferred. */
  priority: number;

  /** Max consecutive failures before rotating. */
  maxFailures: number;

  /** Cooldown in ms. */
  cooldownMs: number;
}

interface RPCEndpointState {
  config: RPCEndpointConfig;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailure?: number;
  lastSuccess?: number;
  cooldownUntil?: number;
  averageLatencyMs: number;
  latencySamples: number[];
}

/**
 * Manages RPC endpoint rotation per blockchain chain.
 *
 * Keeps a list of RPC endpoints per chain, tracks failures and latency,
 * and auto-rotates to the fastest healthy endpoint on failure.
 */
export class RPCRotator {
  private readonly chains = new Map<string, RPCEndpointState[]>();
  private readonly activeIndices = new Map<string, number>();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rotationLog: RotationEvent[] = [];

  constructor(
    configs: RPCEndpointConfig[],
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30_000,
      ...circuitBreakerConfig,
    });

    // Group by chain
    for (const config of configs) {
      const chain = config.chain;
      if (!this.chains.has(chain)) {
        this.chains.set(chain, []);
        this.activeIndices.set(chain, 0);
      }

      this.chains.get(chain)!.push({
        config,
        failures: 0,
        successes: 0,
        totalRequests: 0,
        averageLatencyMs: 0,
        latencySamples: [],
      });
    }

    // Sort each chain's endpoints by priority
    for (const [, endpoints] of this.chains) {
      endpoints.sort((a, b) => a.config.priority - b.config.priority);
    }
  }

  /** Get the active RPC URL for a chain. */
  getActiveEndpoint(chain: string): RPCEndpointConfig | undefined {
    const endpoints = this.chains.get(chain);
    if (!endpoints || endpoints.length === 0) return undefined;

    const startIdx = this.activeIndices.get(chain) ?? 0;

    for (let i = 0; i < endpoints.length; i++) {
      const idx = (startIdx + i) % endpoints.length;
      const state = endpoints[idx];

      if (state.cooldownUntil && Date.now() < state.cooldownUntil) continue;
      if (this.circuitBreaker.isOpen(state.config.id)) continue;

      this.activeIndices.set(chain, idx);
      return state.config;
    }

    // All in cooldown — return the one that expires soonest
    const byExpiry = endpoints
      .sort((a, b) => (a.cooldownUntil ?? 0) - (b.cooldownUntil ?? 0));
    return byExpiry[0]?.config;
  }

  /** Report a failure for a specific RPC endpoint. */
  reportFailure(id: string, error: ScannerError): void {
    const state = this.findState(id);
    if (!state) return;

    state.failures++;
    state.totalRequests++;
    state.lastFailure = Date.now();

    this.circuitBreaker.recordFailure(id, error);

    if (state.failures >= state.config.maxFailures) {
      state.cooldownUntil = Date.now() + state.config.cooldownMs;
      console.log(`[RPCRotator] Endpoint ${id} exceeded failure threshold, cooling down`);
    }
  }

  /** Report a success for a specific RPC endpoint. */
  reportSuccess(id: string, latencyMs?: number): void {
    const state = this.findState(id);
    if (!state) return;

    state.failures = 0;
    state.successes++;
    state.totalRequests++;
    state.lastSuccess = Date.now();
    state.cooldownUntil = undefined;

    this.circuitBreaker.recordSuccess(id);

    if (latencyMs !== undefined) {
      state.latencySamples.push(latencyMs);
      if (state.latencySamples.length > 20) state.latencySamples.shift();
      state.averageLatencyMs = state.latencySamples.reduce((a, b) => a + b, 0) / state.latencySamples.length;
    }
  }

  /** Rotate to next available RPC endpoint for a chain. */
  rotateEndpoint(chain: string): RPCEndpointConfig | undefined {
    const endpoints = this.chains.get(chain);
    if (!endpoints || endpoints.length <= 1) return undefined;

    const currentIdx = this.activeIndices.get(chain) ?? 0;
    const current = endpoints[currentIdx]?.config;

    for (let i = 1; i < endpoints.length; i++) {
      const idx = (currentIdx + i) % endpoints.length;
      const state = endpoints[idx];

      if (state.cooldownUntil && Date.now() < state.cooldownUntil) continue;
      if (this.circuitBreaker.isOpen(state.config.id)) continue;

      this.activeIndices.set(chain, idx);

      this.rotationLog.push({
        timestamp: Date.now(),
        from: current?.id ?? 'none',
        to: state.config.id,
        reason: 'rpc-failure',
      });

      console.log(`[RPCRotator] Rotated ${chain} from ${current?.id ?? 'none'} to ${state.config.id}`);
      return state.config;
    }

    return undefined;
  }

  /** Get the list of chains with configured RPC endpoints. */
  getChains(): string[] {
    return [...this.chains.keys()];
  }

  /** Get snapshot of all RPC endpoint states for health reporting. */
  getSnapshot(): Record<string, RPCSnapshot[]> {
    const result: Record<string, RPCSnapshot[]> = {};

    for (const [chain, endpoints] of this.chains) {
      const activeIdx = this.activeIndices.get(chain) ?? 0;
      result[chain] = endpoints.map((s, idx) => ({
        id: s.config.id,
        url: maskUrl(s.config.url),
        priority: s.config.priority,
        failures: s.failures,
        successes: s.successes,
        totalRequests: s.totalRequests,
        averageLatencyMs: Math.round(s.averageLatencyMs),
        isActive: idx === activeIdx,
        inCooldown: s.cooldownUntil ? Date.now() < s.cooldownUntil : false,
        circuitState: this.circuitBreaker.getState(s.config.id)?.state ?? 'closed',
      }));
    }

    return result;
  }

  /** Get rotation event log. */
  getRotationLog(): RotationEvent[] {
    return [...this.rotationLog];
  }

  /** Reset all state. */
  reset(): void {
    for (const [, endpoints] of this.chains) {
      for (const state of endpoints) {
        state.failures = 0;
        state.successes = 0;
        state.totalRequests = 0;
        state.cooldownUntil = undefined;
        state.latencySamples = [];
        state.averageLatencyMs = 0;
      }
    }
    for (const [chain] of this.chains) {
      this.activeIndices.set(chain, 0);
    }
    this.circuitBreaker.resetAll();
    this.rotationLog.length = 0;
  }

  private findState(id: string): RPCEndpointState | undefined {
    for (const [, endpoints] of this.chains) {
      const found = endpoints.find(e => e.config.id === id);
      if (found) return found;
    }
    return undefined;
  }
}

// ── Shared Types ──

export interface RotationEvent {
  timestamp: number;
  from: string;
  to: string;
  reason: string;
}

export interface ProviderSnapshot {
  id: string;
  endpoint: string;
  model: string;
  priority: number;
  failures: number;
  successes: number;
  totalRequests: number;
  averageLatencyMs: number;
  isActive: boolean;
  inCooldown: boolean;
  cooldownRemainingMs: number;
  circuitState: string;
  hasApiKey: boolean;
}

export interface RPCSnapshot {
  id: string;
  url: string;
  priority: number;
  failures: number;
  successes: number;
  totalRequests: number;
  averageLatencyMs: number;
  isActive: boolean;
  inCooldown: boolean;
  circuitState: string;
}

// ── Helpers ──

/** Mask the middle of a URL to avoid logging sensitive API keys in URLs. */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    // Mask API key params
    for (const [key] of u.searchParams) {
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
        u.searchParams.set(key, '***');
      }
    }
    return u.toString();
  } catch {
    return url.substring(0, 30) + '...';
  }
}
