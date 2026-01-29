/**
 * Memory HTTP Server - Provides REST API for memory bundle lookups.
 *
 * Endpoints:
 * - GET /healthz - Health check
 * - GET /memory/contract/:chain/:address - Get memory bundle for a contract
 *
 * Start with: WR_MEMORY_HTTP_ENABLED=true node dist/memory-server.js
 */

import http from 'http';
import { URL } from 'url';
import { loadConfig } from './config.js';
import { Database } from './database.js';
import { RedisCache, CacheKeys, initRedisCache } from './services/redis-cache.js';
import { computeConfidence } from './memory/confidence.js';
import { estimateTokens, truncateResponse } from './utils/context-budget.js';
import type { MemoryBundle } from './types/index.js';

const MEMORY_HTTP_ENABLED = process.env.WR_MEMORY_HTTP_ENABLED === 'true';
const MEMORY_HTTP_PORT = Number(process.env.WR_MEMORY_HTTP_PORT) || 8787;
const MEMORY_BUNDLE_CACHE_TTL = 120; // 2 minutes

interface RequestMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  avgDurationMs: number;
}

class MemoryServer {
  private server: http.Server | null = null;
  private db: Database;
  private redis: RedisCache;
  private metrics: RequestMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    avgDurationMs: 0,
  };

  constructor(db: Database, redis: RedisCache) {
    this.db = db;
    this.redis = redis;
  }

  async start(port: number = MEMORY_HTTP_PORT): Promise<void> {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    return new Promise((resolve, reject) => {
      this.server!.listen(port, () => {
        console.log(`[MemoryServer] Listening on port ${port}`);
        console.log(`[MemoryServer] Endpoints:`);
        console.log(`  GET /healthz`);
        console.log(`  GET /memory/contract/:chain/:address`);
        console.log(`  GET /memory/stats`);
        resolve();
      });

      this.server!.on('error', (err) => {
        console.error('[MemoryServer] Server error:', err);
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('[MemoryServer] Stopped');
          resolve();
        });
      });
    }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Parse URL
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Route handling
      if (path === '/healthz' || path === '/health') {
        this.sendJson(res, 200, {
          ok: true,
          service: 'white-rabbit-memory',
          uptime: Math.floor(process.uptime()),
          database: true,
          redis: this.redis.isAvailable(),
        });
      } else if (path === '/memory/stats') {
        this.sendJson(res, 200, {
          ...this.metrics,
          redisAvailable: this.redis.isAvailable(),
        });
      } else if (path.startsWith('/memory/contract/')) {
        await this.handleMemoryRequest(req, res, path, url);
      } else {
        this.sendJson(res, 404, { error: 'Not found' });
      }
    } catch (err) {
      this.metrics.errors++;
      console.error('[MemoryServer] Request error:', err);
      this.sendJson(res, 500, {
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Update metrics
    const duration = Date.now() - startTime;
    this.metrics.avgDurationMs =
      (this.metrics.avgDurationMs * (this.metrics.totalRequests - 1) + duration) /
      this.metrics.totalRequests;
  }

  private async handleMemoryRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    path: string,
    url: URL
  ): Promise<void> {
    // Parse path: /memory/contract/:chain/:address
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 4) {
      this.sendJson(res, 400, { error: 'Missing chain or address parameter' });
      return;
    }

    const chain = parts[2];
    const address = parts[3];

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      this.sendJson(res, 400, { error: 'Invalid address format. Expected 0x + 40 hex chars' });
      return;
    }

    // Parse query params
    const scans = Math.min(Number(url.searchParams.get('scans')) || 5, 50);
    const findings = Math.min(Number(url.searchParams.get('findings')) || 10, 50);
    const includeSummaries = url.searchParams.get('includeSummaries') === 'true';
    const includeSimilar = url.searchParams.get('includeSimilar') === 'true';
    const maxResponseTokens = Math.min(Number(url.searchParams.get('maxResponseTokens')) || 5000, 20000);

    console.log(`[MemoryServer] GET /memory/contract/${chain}/${address} (scans=${scans}, findings=${findings}, summaries=${includeSummaries}, similar=${includeSimilar}, maxTokens=${maxResponseTokens})`);

    // Check Redis cache first
    const cacheKey = CacheKeys.memoryBundle(chain, address, scans, findings, includeSummaries, includeSimilar);
    let bundle: MemoryBundle | null = null;

    if (this.redis.isAvailable()) {
      bundle = await this.redis.getJson<MemoryBundle>(cacheKey);
      if (bundle) {
        this.metrics.cacheHits++;
        bundle.cached = true;
        // Always compute fresh confidence
        bundle.confidence = computeConfidence(bundle);
        console.log(`[MemoryServer] Cache HIT: ${chain}/${address}`);
        // Apply response truncation
        const truncatedBundle = truncateResponse(bundle as unknown as Record<string, unknown>, maxResponseTokens) as unknown as MemoryBundle;
        const tokenEstimate = estimateTokens(JSON.stringify(truncatedBundle));
        console.log(`[MemoryServer] Response tokens: ~${tokenEstimate} (limit: ${maxResponseTokens})`);
        this.sendJson(res, 200, truncatedBundle);
        return;
      }
    }

    this.metrics.cacheMisses++;
    bundle = await this.db.getContractMemoryBundle({
      chain,
      address,
      limitScans: scans,
      limitFindings: findings,
      includeSummaries,
      includeSimilar,
    });

    if (!bundle) {
      // Return empty bundle for unknown contract (instead of 404)
      const emptyBundle: MemoryBundle = {
        chain,
        address: address.toLowerCase(),
        tags: [],
        scans: [],
        findings: [],
        stats: {
          totalScans: 0,
          totalFindings: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          aiAnalyzedCount: 0,
        },
        generatedAt: new Date().toISOString(),
        cached: false,
      };
      emptyBundle.confidence = computeConfidence(emptyBundle);
      this.sendJson(res, 200, emptyBundle);
      return;
    }

    // Compute confidence score
    bundle.confidence = computeConfidence(bundle);

    // Cache the result (before truncation for completeness)
    if (this.redis.isAvailable()) {
      await this.redis.setJson(cacheKey, bundle, MEMORY_BUNDLE_CACHE_TTL);
      console.log(`[MemoryServer] Cache MISS, stored: ${chain}/${address}`);
    }

    // Apply response truncation
    const truncatedBundle = truncateResponse(bundle as unknown as Record<string, unknown>, maxResponseTokens) as unknown as MemoryBundle;
    const tokenEstimate = estimateTokens(JSON.stringify(truncatedBundle));
    console.log(`[MemoryServer] Response tokens: ~${tokenEstimate} (limit: ${maxResponseTokens})`);

    this.sendJson(res, 200, truncatedBundle);
  }

  private sendJson(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }
}

// ── Main Entry Point ──
async function main(): Promise<void> {
  if (!MEMORY_HTTP_ENABLED) {
    console.log('[MemoryServer] HTTP server disabled (set WR_MEMORY_HTTP_ENABLED=true to enable)');
    return;
  }

  console.log('White-Rabbit Memory Server');
  console.log('==========================\n');

  const config = loadConfig();
  const db = new Database(config.databaseUrl);
  const redis = await initRedisCache();

  // Run migrations
  try {
    await db.runMigrations('./migrations');
  } catch (err) {
    console.warn('[MemoryServer] Migration warning:', err instanceof Error ? err.message : err);
  }

  const server = new MemoryServer(db, redis);
  await server.start(MEMORY_HTTP_PORT);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    await server.stop();
    await redis.close();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Export for use as module
export { MemoryServer };

// Run if executed directly
main().catch((err) => {
  console.error('Fatal memory server error:', err);
  process.exit(1);
});
