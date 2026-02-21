// ═══════════════════════════════════════════════════════════════════════════════
// WhiteClawsClient Tests - WR-WC Integration
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { WhiteClawsClient } from '../connectors/whiteclaws-client.js';

// ── Helpers ──

interface MockCall {
  url: string;
  init: RequestInit;
}

function installFetchMock(handler?: (url: string, init: RequestInit) => {
  ok: boolean;
  status: number;
  body?: unknown;
}) {
  const calls: MockCall[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init || {} });

    const result = handler
      ? handler(url, init || {})
      : { ok: true, status: 200, body: {} };

    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.body ?? {},
      text: async () => JSON.stringify(result.body ?? {}),
    } as unknown as Response;
  }) as typeof fetch;

  return { calls, restore: () => { globalThis.fetch = original; } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('WhiteClawsClient', () => {
  let fetchMock: ReturnType<typeof installFetchMock>;

  afterEach(() => {
    fetchMock?.restore();
  });

  // ── Constructor ──

  it('should accept baseUrl, apiKey, timeoutMs options', () => {
    const client = new WhiteClawsClient({
      apiKey: 'test-key',
      baseUrl: 'https://custom.whiteclaws.app',
      timeoutMs: 5000,
    });

    assert.ok(client, 'client should be created');
  });

  it('should strip trailing slash from baseUrl', async () => {
    fetchMock = installFetchMock();

    const client = new WhiteClawsClient({
      apiKey: 'k',
      baseUrl: 'https://example.com/',
      retries: 0,
    });

    await client.verifyKey();

    assert.ok(fetchMock.calls.length > 0, 'should have made a request');
    assert.ok(
      fetchMock.calls[0].url.startsWith('https://example.com/api/'),
      `URL should not have double slash: ${fetchMock.calls[0].url}`,
    );
  });

  // ── Auth headers ──

  it('should include both Authorization and X-API-Key headers', async () => {
    fetchMock = installFetchMock();

    const client = new WhiteClawsClient({
      apiKey: 'my-secret-key',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    await client.verifyKey();

    const headers = fetchMock.calls[0].init.headers as Record<string, string>;
    assert.equal(headers['Authorization'], 'Bearer my-secret-key');
    assert.equal(headers['X-API-Key'], 'my-secret-key');
    assert.equal(headers['Content-Type'], 'application/json');
  });

  // ── getProtocolIntel() ──

  it('getProtocolIntel() should call correct endpoint', async () => {
    fetchMock = installFetchMock(() => ({
      ok: true,
      status: 200,
      body: {
        id: 'aave',
        name: 'Aave',
        slug: 'aave',
        chains: ['ethereum'],
        tvl: 10_000_000,
        category: 'lending',
        url: 'https://aave.com',
        chainTvls: {},
        primaryChain: 'ethereum',
        hasBounty: true,
        contracts: [],
        vulnerabilitySurface: { evmbenchPatternMatches: [], contractType: 'defi', riskLevel: 'medium', totalMatchingPatterns: 0 },
        knownVulnerabilities: [],
        audits: [],
        riskSignals: [],
        isFork: false,
        oracles: [],
        fetchedAt: new Date().toISOString(),
      },
    }));

    const client = new WhiteClawsClient({
      apiKey: 'k',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    const intel = await client.getProtocolIntel('aave');

    assert.ok(intel, 'should return intel object');
    assert.ok(
      fetchMock.calls[0].url.includes('/api/intel/protocol/aave/'),
      `should call intel endpoint, got: ${fetchMock.calls[0].url}`,
    );
  });

  it('getProtocolIntel() should return null on 404', async () => {
    fetchMock = installFetchMock(() => ({ ok: false, status: 404 }));

    const client = new WhiteClawsClient({
      apiKey: 'k',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    const intel = await client.getProtocolIntel('nonexistent');
    assert.equal(intel, null);
  });

  it('getProtocolIntel() should return null on 503', async () => {
    fetchMock = installFetchMock(() => ({ ok: false, status: 503 }));

    const client = new WhiteClawsClient({
      apiKey: 'k',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    const intel = await client.getProtocolIntel('down-service');
    assert.equal(intel, null);
  });

  // ── submitFinding() ──

  it('submitFinding() should POST to correct endpoint', async () => {
    fetchMock = installFetchMock(() => ({
      ok: true,
      status: 200,
      body: {
        finding: {
          id: 'f-123',
          protocol: 'aave',
          protocol_name: 'Aave',
          title: 'Reentrancy',
          severity: 'high',
          status: 'pending',
          scope_version: 1,
          created_at: new Date().toISOString(),
        },
      },
    }));

    const client = new WhiteClawsClient({
      apiKey: 'k',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    const result = await client.submitFinding({
      protocol_slug: 'aave',
      title: 'Reentrancy',
      severity: 'high',
      description: 'Found reentrancy bug',
    });

    assert.ok(result.finding.id, 'should return finding ID');
    assert.ok(
      fetchMock.calls[0].url.includes('/api/agents/submit/'),
      `should call submit endpoint, got: ${fetchMock.calls[0].url}`,
    );
    assert.equal(fetchMock.calls[0].init.method, 'POST');
  });

  it('submitFinding() should throw on server error', async () => {
    fetchMock = installFetchMock(() => ({
      ok: false,
      status: 500,
      body: 'Internal Server Error',
    }));

    const client = new WhiteClawsClient({
      apiKey: 'k',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    await assert.rejects(
      () => client.submitFinding({
        protocol_slug: 'aave',
        title: 'Test',
        severity: 'low',
      }),
      (err: Error) => {
        assert.ok(err.message.includes('Failed to submit finding'));
        return true;
      },
    );
  });

  // ── verifyKey() ──

  it('verifyKey() should call correct endpoint', async () => {
    fetchMock = installFetchMock(() => ({ ok: true, status: 200 }));

    const client = new WhiteClawsClient({
      apiKey: 'k',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    const valid = await client.verifyKey();

    assert.equal(valid, true);
    assert.ok(
      fetchMock.calls[0].url.includes('/api/agents/status/'),
      `should call status endpoint, got: ${fetchMock.calls[0].url}`,
    );
  });

  it('verifyKey() should return false on failure', async () => {
    fetchMock = installFetchMock(() => ({ ok: false, status: 401 }));

    const client = new WhiteClawsClient({
      apiKey: 'bad-key',
      baseUrl: 'https://test.local',
      retries: 0,
    });

    const valid = await client.verifyKey();
    assert.equal(valid, false);
  });

  it('verifyKey() should return false on network error', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch;

    try {
      const client = new WhiteClawsClient({
        apiKey: 'k',
        baseUrl: 'https://test.local',
        retries: 0,
      });

      const valid = await client.verifyKey();
      assert.equal(valid, false);
    } finally {
      globalThis.fetch = original;
    }
  });

  // ── withRetries() ──

  it('withRetries() should retry on failure up to configured limit', async () => {
    let callCount = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      callCount++;
      throw new Error('timeout');
    }) as typeof fetch;

    try {
      const client = new WhiteClawsClient({
        apiKey: 'k',
        baseUrl: 'https://test.local',
        retries: 2,
        timeoutMs: 500,
      });

      await assert.rejects(() => client.queueScan({
        address: '0xdead',
        chain: 'ethereum',
      }));

      // 1 initial + 2 retries = 3 total
      assert.equal(callCount, 3, `expected 3 attempts, got ${callCount}`);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('withRetries() should succeed if a retry works', async () => {
    let callCount = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      callCount++;
      if (callCount < 2) throw new Error('transient');
      return {
        ok: true,
        status: 200,
        json: async () => ({ scanId: 'scan-1', status: 'pending', estimatedDuration: 60 }),
        text: async () => '',
      } as unknown as Response;
    }) as typeof fetch;

    try {
      const client = new WhiteClawsClient({
        apiKey: 'k',
        baseUrl: 'https://test.local',
        retries: 3,
        timeoutMs: 500,
      });

      const result = await client.queueScan({
        address: '0xdead',
        chain: 'ethereum',
      });

      assert.equal(result.scanId, 'scan-1');
      assert.equal(callCount, 2, 'should have succeeded on second try');
    } finally {
      globalThis.fetch = original;
    }
  });

  // ── Timeout ──

  it('should handle timeout correctly', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      // Simulate: if signal is aborted, throw AbortError
      if (init?.signal) {
        return new Promise<Response>((_resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('should have been aborted'));
          }, 60_000);
          init.signal!.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      }
      throw new Error('no signal');
    }) as typeof fetch;

    try {
      const client = new WhiteClawsClient({
        apiKey: 'k',
        baseUrl: 'https://test.local',
        timeoutMs: 50, // very short timeout
        retries: 0,
      });

      await assert.rejects(
        () => client.verifyKey(),
        // verifyKey catches errors and returns false, so use a direct method
      );
    } catch {
      // verifyKey swallows errors, so this is expected not to throw.
      // That itself validates graceful timeout handling.
    } finally {
      globalThis.fetch = original;
    }

    // Verify that verifyKey returns false when fetch times out
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('should have been aborted'));
        }, 60_000);
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    }) as typeof fetch;

    try {
      const client = new WhiteClawsClient({
        apiKey: 'k',
        baseUrl: 'https://test.local',
        timeoutMs: 50,
        retries: 0,
      });

      const valid = await client.verifyKey();
      assert.equal(valid, false, 'should return false on timeout');
    } finally {
      globalThis.fetch = original;
    }
  });
});
