
/**
 * WhiteRabbit Cache Utilities
 * High-performance caching layer for vulnerability scanning
 */

import { Database } from 'better-sqlite3';
import * as crypto from 'crypto';
import * as path from 'path';

const DB_PATH = path.join(__dirname, 'whitrabbit-cache.db');

export class CacheManager {
  private db: Database;
  
  constructor() {
    const Database = require('better-sqlite3');
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
  }
  
  // Protocol Discovery Cache
  async getCachedProtocols(chain: string, minTvl: number = 0): Promise<any[]> {
    const query = this.db.prepare(`
      SELECT * FROM protocols 
      WHERE chain = ? AND tvl >= ? AND last_updated > ?
      ORDER BY tvl DESC
    `);
    
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    return query.all(chain, minTvl, oneHourAgo);
  }
  
  async cacheProtocol(protocol: any): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO protocols 
      (chain, name, address, tvl, category, website, last_updated, scan_count, first_discovered)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT scan_count FROM protocols WHERE chain = ? AND name = ?), 0) + 1, ?)
    `);
    
    const now = Math.floor(Date.now() / 1000);
    insert.run(
      protocol.chain, protocol.name, protocol.address, protocol.tvl,
      protocol.category, protocol.website, now, protocol.chain, protocol.name, now
    );
  }
  
  // Contract Analysis Cache
  async getCachedContract(address: string, chain: string): Promise<any | null> {
    const query = this.db.prepare(`
      SELECT * FROM contracts 
      WHERE address = ? AND chain = ? AND last_analyzed > ?
    `);
    
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    return query.get(address, chain, oneDayAgo);
  }
  
  async cacheContractAnalysis(address: string, chain: string, analysis: any): Promise<void> {
    const bytecodeHash = crypto.createHash('sha256').update(analysis.bytecode || '').digest('hex');
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO contracts
      (address, chain, bytecode_hash, source_verified, source_code, compiler_version,
       last_analyzed, analysis_results, vulnerability_count, risk_score, exploitable_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = Math.floor(Date.now() / 1000);
    insert.run(
      address, chain, bytecodeHash, analysis.sourceVerified || false,
      analysis.sourceCode || null, analysis.compilerVersion || null,
      now, JSON.stringify(analysis.results), analysis.vulnCount || 0,
      analysis.riskScore || 0, analysis.exploitableValue || 0
    );
  }
  
  // RPC Response Cache
  async getCachedRPCResponse(chain: string, method: string, params: any): Promise<any | null> {
    const paramsHash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex');
    
    const query = this.db.prepare(`
      SELECT response FROM rpc_cache 
      WHERE chain = ? AND method = ? AND params_hash = ? AND ttl > ?
    `);
    
    const now = Math.floor(Date.now() / 1000);
    const result = query.get(chain, method, paramsHash, now);
    
    if (result) {
      // Update hit count
      const updateHits = this.db.prepare(`
        UPDATE rpc_cache SET hit_count = hit_count + 1, last_hit = ?
        WHERE chain = ? AND method = ? AND params_hash = ?
      `);
      updateHits.run(now, chain, method, paramsHash);
      
      return JSON.parse(result.response);
    }
    
    return null;
  }
  
  async cacheRPCResponse(chain: string, method: string, params: any, response: any, ttlSeconds: number = 900): Promise<void> {
    const paramsHash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex');
    const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO rpc_cache
      (chain, endpoint, method, params_hash, response, ttl, last_hit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = Math.floor(Date.now() / 1000);
    insert.run(chain, 'default', method, paramsHash, JSON.stringify(response), ttl, now);
  }
  
  // Pattern Learning
  async learnFalsePositive(pattern: any): Promise<void> {
    const patternHash = crypto.createHash('md5').update(JSON.stringify(pattern)).digest('hex');
    
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO patterns
      (pattern_hash, detector_name, pattern_type, confidence, false_positive_rate,
       severity, description, examples, created_at, last_seen)
      VALUES (?, ?, 'false_positive', ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = Math.floor(Date.now() / 1000);
    insert.run(
      patternHash, pattern.detector, 0.1, 0.95, 'low',
      pattern.description, JSON.stringify([pattern.contract]), now, now
    );
  }
  
  // Performance Tracking
  recordCacheHit(cacheType: string, responseTime: number): void {
    const update = this.db.prepare(`
      INSERT OR IGNORE INTO cache_metrics (timestamp, cache_type, hits, misses, avg_response_time)
      VALUES (?, ?, 1, 0, ?)
      ON CONFLICT(timestamp, cache_type) DO UPDATE SET
        hits = hits + 1,
        avg_response_time = (avg_response_time * (hits - 1) + ?) / hits
    `);
    
    const hourTimestamp = Math.floor(Date.now() / 3600000) * 3600;
    update.run(hourTimestamp, cacheType, responseTime, responseTime);
  }
  
  recordCacheMiss(cacheType: string): void {
    const update = this.db.prepare(`
      INSERT OR IGNORE INTO cache_metrics (timestamp, cache_type, hits, misses, avg_response_time)
      VALUES (?, ?, 0, 1, 0)
      ON CONFLICT(timestamp, cache_type) DO UPDATE SET misses = misses + 1
    `);
    
    const hourTimestamp = Math.floor(Date.now() / 3600000) * 3600;
    update.run(hourTimestamp, cacheType);
  }
  
  // Cleanup expired entries
  cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    
    // Clean expired RPC cache
    const cleanRPC = this.db.prepare('DELETE FROM rpc_cache WHERE ttl < ?');
    const deletedRPC = cleanRPC.run(now).changes;
    
    // Clean old metrics (keep 30 days)
    const thirtyDaysAgo = now - (30 * 86400);
    const cleanMetrics = this.db.prepare('DELETE FROM cache_metrics WHERE timestamp < ?');
    const deletedMetrics = cleanMetrics.run(thirtyDaysAgo).changes;
    
    console.log(`🧹 Cache cleanup: ${deletedRPC} RPC entries, ${deletedMetrics} metric entries removed`);
  }
  
  // Stats
  getCacheStats(): any {
    const stats = this.db.prepare(`
      SELECT 
        cache_type,
        SUM(hits) as total_hits,
        SUM(misses) as total_misses,
        ROUND(AVG(hit_rate) * 100, 2) as hit_rate_percent
      FROM cache_metrics
      WHERE timestamp > ? 
      GROUP BY cache_type
    `).all(Math.floor(Date.now() / 1000) - 86400);
    
    const protocolCount = this.db.prepare('SELECT COUNT(*) as count FROM protocols').get();
    const contractCount = this.db.prepare('SELECT COUNT(*) as count FROM contracts').get();
    const patternCount = this.db.prepare('SELECT COUNT(*) as count FROM patterns').get();
    
    return {
      cacheHitRates: stats,
      cachedProtocols: protocolCount.count,
      cachedContracts: contractCount.count,
      learnedPatterns: patternCount.count
    };
  }
}

export default new CacheManager();
