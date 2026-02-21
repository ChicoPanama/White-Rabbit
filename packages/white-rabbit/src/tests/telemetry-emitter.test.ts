// ═══════════════════════════════════════════════════════════════════════════════
// TelemetryEmitter Tests - WR-WC Integration
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryEmitter } from '../telemetry/emitter.js';

// ── Helpers ──

/** Capture calls to the global fetch so we can assert on request shape. */
function installFetchMock(response?: { ok: boolean; status: number }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init || {} });
    const res = response ?? { ok: true, status: 200 };
    return {
      ok: res.ok,
      status: res.status,
      json: async () => ({}),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;

  return { calls, restore: () => { globalThis.fetch = original; } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('TelemetryEmitter', () => {

  // ── Construction ──

  it('should create with session ID, skill version, and agent type', () => {
    const emitter = new TelemetryEmitter({
      sessionId: 'sess-abc',
      skillVersion: '2.1.0',
      agentType: 'test-agent',
    });

    assert.equal(emitter.getSessionId(), 'sess-abc');
  });

  it('should auto-generate session ID when not provided', () => {
    const emitter = new TelemetryEmitter();
    const sessionId = emitter.getSessionId();

    assert.ok(sessionId, 'session ID should be truthy');
    assert.ok(sessionId.length > 0, 'session ID should be non-empty');
    // UUID v4 pattern: 8-4-4-4-12
    assert.match(sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // ── emit() ──

  it('emit() should add events to internal buffer', async () => {
    const fetchMock = installFetchMock();
    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'sess-1',
        flushEvery: 100, // high threshold so auto-flush does not trigger
      });

      emitter.emit({
        action: 'scan_started',
        target: { protocol_slug: 'aave' },
      });

      emitter.emit({
        action: 'scan_complete',
        target: { protocol_slug: 'aave' },
      });

      // Flush manually to inspect the buffer content via the payload sent
      await emitter.flush('http://localhost:9999/telemetry');

      assert.equal(fetchMock.calls.length, 1);
      const body = JSON.parse(fetchMock.calls[0].init.body as string);
      assert.equal(body.events.length, 2);
    } finally {
      fetchMock.restore();
    }
  });

  it('emit() should create events with correct action types', async () => {
    const fetchMock = installFetchMock();
    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'sess-2',
        flushEvery: 100,
      });

      emitter.emit({
        action: 'vulnerability_detected',
        target: { contract_address: '0xdead' },
        finding: { severity: 'high', category: 'reentrancy' },
      });

      await emitter.flush('http://localhost:9999/telemetry');

      const body = JSON.parse(fetchMock.calls[0].init.body as string);
      assert.equal(body.events[0].action, 'vulnerability_detected');
      assert.equal(body.events[0].finding.severity, 'high');
    } finally {
      fetchMock.restore();
    }
  });

  it('events should have auto-generated event_id', async () => {
    const fetchMock = installFetchMock();
    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'sess-3',
        flushEvery: 100,
      });

      emitter.emit({
        action: 'scan_started',
        target: { chain: 'ethereum' },
      });

      await emitter.flush('http://localhost:9999/telemetry');

      const body = JSON.parse(fetchMock.calls[0].init.body as string);
      const event = body.events[0];
      assert.ok(event.event_id, 'event_id should be present');
      assert.match(event.event_id, /^[0-9a-f]{8}-/i, 'event_id should look like a UUID');
    } finally {
      fetchMock.restore();
    }
  });

  // ── Session consistency ──

  it('session ID should be consistent across all emitted events', async () => {
    const fetchMock = installFetchMock();
    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'consistent-session',
        flushEvery: 100,
      });

      emitter.emit({ action: 'scan_started', target: {} });
      emitter.emit({ action: 'patterns_loaded', target: {} });
      emitter.emit({ action: 'scan_complete', target: {} });

      await emitter.flush('http://localhost:9999/telemetry');

      const body = JSON.parse(fetchMock.calls[0].init.body as string);
      for (const event of body.events) {
        assert.equal(event.session_id, 'consistent-session');
      }
      assert.equal(body.session_id, 'consistent-session');
    } finally {
      fetchMock.restore();
    }
  });

  // ── flush() ──

  it('flush() should call the telemetry URL with correct payload structure', async () => {
    const fetchMock = installFetchMock();
    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'sess-payload',
        skillVersion: '2.0.0-test',
        agentType: 'test-agent',
        flushEvery: 100,
      });

      emitter.emit({ action: 'scan_started', target: { chain: 'base' } });
      await emitter.flush('http://localhost:9999/telemetry');

      assert.equal(fetchMock.calls.length, 1);
      assert.equal(fetchMock.calls[0].url, 'http://localhost:9999/telemetry');

      const body = JSON.parse(fetchMock.calls[0].init.body as string);
      // Top-level fields
      assert.equal(body.session_id, 'sess-payload');
      assert.equal(body.skill_version, '2.0.0-test');
      assert.equal(body.agent_type, 'test-agent');
      assert.ok(Array.isArray(body.events));
      assert.equal(body.events.length, 1);

      // Event fields
      const event = body.events[0];
      assert.ok(event.event_id);
      assert.ok(event.timestamp);
      assert.equal(event.skill_version, '2.0.0-test');
      assert.equal(event.agent_type, 'test-agent');
    } finally {
      fetchMock.restore();
    }
  });

  it('flush() should clear the buffer on success', async () => {
    const fetchMock = installFetchMock({ ok: true, status: 200 });
    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'sess-clear',
        flushEvery: 100,
      });

      emitter.emit({ action: 'scan_started', target: {} });
      await emitter.flush('http://localhost:9999/telemetry');

      // Second flush should be a no-op (buffer empty)
      await emitter.flush('http://localhost:9999/telemetry');
      assert.equal(fetchMock.calls.length, 1, 'second flush should not make a request');
    } finally {
      fetchMock.restore();
    }
  });

  it('flush() should handle failure gracefully (falls back to local file)', async () => {
    const fetchMock = installFetchMock({ ok: false, status: 500 });
    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'sess-fail',
        flushEvery: 100,
      });

      emitter.emit({ action: 'scan_started', target: {} });

      // Should not throw even when the API returns 500
      await assert.doesNotReject(
        () => emitter.flush('http://localhost:9999/telemetry'),
        'flush should not throw on server error',
      );
    } finally {
      fetchMock.restore();
    }
  });

  it('flush() should handle network error gracefully', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;

    try {
      const emitter = new TelemetryEmitter({
        sessionId: 'sess-net-err',
        flushEvery: 100,
      });

      emitter.emit({ action: 'scan_started', target: {} });

      await assert.doesNotReject(
        () => emitter.flush('http://localhost:9999/telemetry'),
        'flush should not throw on network error',
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it('should not emit events when disabled', async () => {
    const fetchMock = installFetchMock();
    try {
      const emitter = new TelemetryEmitter({
        enabled: false,
        sessionId: 'sess-disabled',
        flushEvery: 1,
      });

      emitter.emit({ action: 'scan_started', target: {} });

      await emitter.flush('http://localhost:9999/telemetry');
      assert.equal(fetchMock.calls.length, 0, 'should not call fetch when disabled');
    } finally {
      fetchMock.restore();
    }
  });
});
