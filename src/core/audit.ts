/**
 * WHITE RABBIT - Immutable Audit Trail
 * 
 * Automaton Pattern: Append-only audit log for all decisions and changes
 * Creator has full audit rights
 */

import { ulid } from 'ulid';
import { LocalDatabase, getLocalDatabase } from './database-sqlite.js';
import { serviceLogger } from './logger.js';

export type AuditEventType = 
  | 'decision'
  | 'blocker'
  | 'achievement'
  | 'tool_call'
  | 'tier_change'
  | 'code_change'
  | 'config_change'
  | 'security_event'
  | 'session_start'
  | 'session_end';

export interface AuditEntry {
  id: string;
  timestamp: string;
  type: AuditEventType;
  description: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionContext {
  context: string;
  options: string[];
  selected: string;
  rationale: string;
  [key: string]: unknown;
}

export interface BlockerContext {
  blocker: string;
  attemptedSolutions: string[];
  resolution?: string;
  [key: string]: unknown;
}

export interface AchievementContext {
  achievement: string;
  value?: string;
  relatedFindings?: string[];
  [key: string]: unknown;
}

/**
 * Immutable Audit Logger
 * 
 * All entries are append-only and permanent.
 * Creator has full audit rights.
 */
export class AuditLogger {
  private db: LocalDatabase;

  constructor(db?: LocalDatabase) {
    this.db = db || getLocalDatabase();
  }

  /**
   * Log a generic audit entry
   */
  log(type: AuditEventType, description: string, metadata?: Record<string, unknown>, sessionId?: string): string {
    const id = this.db.logAudit({
      timestamp: new Date().toISOString(),
      type,
      description,
      sessionId,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    serviceLogger.debug('Audit entry created', { type, description, id });
    return id;
  }

  /**
   * Log a decision with full context
   */
  logDecision(description: string, context: DecisionContext, sessionId?: string): string {
    return this.log('decision', description, context, sessionId);
  }

  /**
   * Log a blocker (something that stopped progress)
   */
  logBlocker(description: string, context: BlockerContext, sessionId?: string): string {
    return this.log('blocker', description, context, sessionId);
  }

  /**
   * Log an achievement
   */
  logAchievement(description: string, context: AchievementContext, sessionId?: string): string {
    return this.log('achievement', description, context, sessionId);
  }

  /**
   * Log a tool call
   */
  logToolCall(toolName: string, result: string, metadata?: Record<string, unknown>, sessionId?: string): string {
    return this.log('tool_call', `${toolName}: ${result}`, metadata, sessionId);
  }

  /**
   * Log a tier change (survival economics)
   */
  logTierChange(fromTier: string, toTier: string, reason: string, sessionId?: string): string {
    return this.log('tier_change', `Tier changed: ${fromTier} -> ${toTier} (${reason})`, { fromTier, toTier, reason }, sessionId);
  }

  /**
   * Log a code change
   */
  logCodeChange(description: string, filePath?: string, diff?: string, sessionId?: string): string {
    return this.log('code_change', description, { filePath, diffLength: diff?.length }, sessionId);
  }

  /**
   * Log a config change
   */
  logConfigChange(key: string, oldValue: string, newValue: string, sessionId?: string): string {
    return this.log('config_change', `Config ${key} changed`, { key, oldValue, newValue }, sessionId);
  }

  /**
   * Log a security event
   */
  logSecurityEvent(event: string, details?: Record<string, unknown>, sessionId?: string): string {
    return this.log('security_event', event, details, sessionId);
  }

  /**
   * Log session start
   */
  logSessionStart(sessionId: string, metadata?: Record<string, unknown>): string {
    return this.log('session_start', 'Session began', metadata, sessionId);
  }

  /**
   * Log session end
   */
  logSessionEnd(sessionId: string, summary?: string): string {
    return this.log('session_end', summary || 'Session ended', undefined, sessionId);
  }

  /**
   * Get recent audit entries
   */
  getRecent(limit: number = 100, type?: AuditEventType): AuditEntry[] {
    const rows = this.db.getAuditLog(type, limit);
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Get audit statistics
   */
  getStats(): Record<string, number> {
    return this.db.getAuditStats();
  }

  /**
   * Generate audit report
   */
  generateReport(sessionId?: string): string {
    const entries = this.getRecent(1000);
    const stats = this.getStats();
    
    let report = `## AUDIT REPORT\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    if (sessionId) report += `Session: ${sessionId}\n`;
    report += `\n### Statistics\n\n`;
    
    for (const [type, count] of Object.entries(stats)) {
      report += `- ${type.toUpperCase()}: ${count}\n`;
    }
    
    report += `\n### Recent Entries\n\n`;
    
    for (const entry of entries.slice(0, 50)) {
      if (sessionId && entry.sessionId !== sessionId) continue;
      
      const time = entry.timestamp.split('T')[1].split('.')[0];
      report += `[${time}] ${entry.type.toUpperCase()}: ${entry.description}\n`;
      
      if (entry.metadata) {
        report += `  Metadata: ${JSON.stringify(entry.metadata)}\n`;
      }
    }
    
    return report;
  }
}

// Global instance
let globalAuditLogger: AuditLogger | null = null;

export function getAuditLogger(db?: LocalDatabase): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger(db);
  }
  return globalAuditLogger;
}

export function resetAuditLogger(): void {
  globalAuditLogger = null;
}

export default AuditLogger;
