
/**
 * Fork Hunter Utilities
 * Helper functions for advanced fork detection and analysis
 */

import { Database } from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(__dirname, 'fork-hunter.db');

export class ForkHunterDB {
  private db: Database;
  
  constructor() {
    const Database = require('better-sqlite3');
    this.db = new Database(DB_PATH);
  }
  
  // Get high-priority hunt targets
  getHighPriorityTargets(limit = 20): any[] {
    return this.db.prepare(`
      SELECT * FROM hunt_targets 
      WHERE hunt_status = 'queued' AND priority_score >= 70
      ORDER BY priority_score DESC, estimated_exploit_value DESC
      LIMIT ?
    `).all(limit);
  }
  
  // Get fork statistics by original protocol
  getForkStatsByProtocol(): any[] {
    return this.db.prepare(`
      SELECT 
        suspected_original,
        COUNT(*) as fork_count,
        AVG(target_tvl) as avg_tvl,
        SUM(estimated_exploit_value) as total_exploit_value,
        AVG(priority_score) as avg_priority
      FROM hunt_targets
      GROUP BY suspected_original
      ORDER BY total_exploit_value DESC
    `).all();
  }
  
  // Get unpatched vulnerabilities summary
  getUnpatchedVulns(): any[] {
    return this.db.prepare(`
      SELECT 
        original_vulnerability,
        original_protocol,
        COUNT(*) as affected_forks,
        AVG(confidence) as avg_confidence,
        SUM(exploitable_value) as total_value
      FROM vulnerability_inheritance
      WHERE patch_status = 'unpatched'
      GROUP BY original_vulnerability, original_protocol
      ORDER BY total_value DESC
    `).all();
  }
  
  // Mark target as analyzed
  markTargetAnalyzed(address: string, chain: string, findings: number): void {
    this.db.prepare(`
      UPDATE hunt_targets 
      SET hunt_status = 'analyzed', analysis_completed = ?, findings_count = ?
      WHERE target_address = ? AND target_chain = ?
    `).run(Math.floor(Date.now() / 1000), findings, address, chain);
  }
  
  // Get detection patterns for a protocol
  getDetectionPatterns(protocol: string): any[] {
    return this.db.prepare(`
      SELECT * FROM fork_patterns 
      WHERE original_protocol = ?
      ORDER BY confidence_weight DESC
    `).all(protocol);
  }
  
  close(): void {
    this.db.close();
  }
}

export default new ForkHunterDB();
