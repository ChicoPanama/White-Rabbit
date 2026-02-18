/**
 * WHITE RABBIT - Comprehensive SQLite Database
 * 
 * Automaton Pattern: Single SQLite database with 10+ tables
 * Enables autonomous operation without PostgreSQL
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import { ulid } from 'ulid';
import { databaseLogger } from './logger.js';

// Schema version for migrations
const SCHEMA_VERSION = 1;

// =============================================================================
// TYPES
// =============================================================================

export interface Turn {
  id: string;
  timestamp: string;
  state: 'thinking' | 'acting' | 'observing';
  input?: string;
  thinking?: string;
  toolCalls: string;
  tokenUsage: string;
  costCents: number;
  sessionId?: string;
}

export interface ToolCall {
  id: string;
  turnId: string;
  name: string;
  arguments: string;
  result?: string;
  durationMs?: number;
  error?: string;
  timestamp: string;
}

export interface HeartbeatEntry {
  name: string;
  schedule: string;
  task: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  params: string;
}

export interface Transaction {
  id: string;
  timestamp: string;
  type: 'credit' | 'debit';
  amountCents: number;
  description: string;
  metadata: string;
}

export interface Skill {
  name: string;
  description: string;
  autoActivate: boolean;
  requirements: string;
  instructions: string;
  installedAt: string;
  updatedAt: string;
}

export interface Modification {
  id: string;
  timestamp: string;
  type: 'code_change' | 'config_change' | 'skill_install' | 'tool_install';
  description: string;
  filePath?: string;
  diff?: string;
  reversible: boolean;
  reversed: boolean;
  sessionId?: string;
}

export interface ChildAgent {
  id: string;
  name: string;
  createdAt: string;
  status: 'active' | 'paused' | 'terminated';
  config: string;
  lastHeartbeat?: string;
}

export interface InboxMessage {
  id: string;
  timestamp: string;
  fromAgent?: string;
  toAgent?: string;
  type: 'command' | 'response' | 'notification';
  content: string;
  read: boolean;
}

export interface Identity {
  key: string;
  value: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  type: 'decision' | 'blocker' | 'achievement' | 'tool_call' | 'tier_change' | 'code_change' | 'config_change' | 'security_event' | 'session_start' | 'session_end';
  description: string;
  sessionId?: string;
  metadata?: string;
}

// =============================================================================
// DATABASE CLASS
// =============================================================================

export class LocalDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.white-rabbit', 'state.db');
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!require('fs').existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    
    // Open database
    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for concurrent reads
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    // Run migrations
    this.migrate();
    
    databaseLogger.info('LocalDatabase initialized', { path: this.dbPath });
  }

  // ===========================================================================
  // MIGRATIONS
  // ===========================================================================

  private migrate(): void {
    // Create schema version table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get current version
    const versionRow = this.db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
    const currentVersion = versionRow?.version || 0;

    if (currentVersion < 1) {
      this.migrateV1();
      this.db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
    }
  }

  private migrateV1(): void {
    databaseLogger.info('Running migration V1');

    // Agent turns (reasoning/action log)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        state TEXT NOT NULL CHECK(state IN ('thinking', 'acting', 'observing')),
        input TEXT,
        thinking TEXT,
        tool_calls TEXT DEFAULT '[]',
        token_usage TEXT DEFAULT '{}',
        cost_cents INTEGER DEFAULT 0,
        session_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
      CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp);
    `);

    // Tool execution history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        turn_id TEXT REFERENCES turns(id),
        name TEXT NOT NULL,
        arguments TEXT DEFAULT '{}',
        result TEXT,
        duration_ms INTEGER,
        error TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tool_calls_turn ON tool_calls(turn_id);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_name ON tool_calls(name);
    `);

    // Heartbeat entries (cron-scheduled tasks)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS heartbeat_entries (
        name TEXT PRIMARY KEY,
        schedule TEXT NOT NULL,
        task TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_run TEXT,
        next_run TEXT,
        params TEXT DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_heartbeat_next ON heartbeat_entries(next_run);
    `);

    // Financial transactions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
        amount_cents INTEGER NOT NULL,
        description TEXT,
        metadata TEXT DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_time ON transactions(timestamp);
    `);

    // Skills registry
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        name TEXT PRIMARY KEY,
        description TEXT,
        auto_activate INTEGER DEFAULT 1,
        requirements TEXT DEFAULT '{}',
        instructions TEXT,
        installed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Modifications audit (immutable)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS modifications (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL CHECK(type IN ('code_change', 'config_change', 'skill_install', 'tool_install')),
        description TEXT NOT NULL,
        file_path TEXT,
        diff TEXT,
        reversible INTEGER DEFAULT 1,
        reversed INTEGER DEFAULT 0,
        session_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_modifications_time ON modifications(timestamp);
    `);

    // Child agents (spawned sub-agents)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'terminated')),
        config TEXT DEFAULT '{}',
        last_heartbeat TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_children_status ON children(status);
    `);

    // Inbox messages (agent communication)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        from_agent TEXT,
        to_agent TEXT,
        type TEXT CHECK(type IN ('command', 'response', 'notification')),
        content TEXT NOT NULL,
        read INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_inbox_to ON inbox_messages(to_agent, read);
    `);

    // Identity (key-value store for agent state)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS identity (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Audit log (append-only)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL CHECK(type IN ('decision', 'blocker', 'achievement', 'tool_call', 'tier_change', 'code_change')),
        description TEXT NOT NULL,
        session_id TEXT,
        metadata TEXT DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(type);
    `);

    databaseLogger.info('Migration V1 complete');
  }

  // ===========================================================================
  // TURNS
  // ===========================================================================

  insertTurn(turn: Omit<Turn, 'id'>): string {
    const id = ulid();
    this.db.prepare(`
      INSERT INTO turns (id, timestamp, state, input, thinking, tool_calls, token_usage, cost_cents, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, turn.timestamp, turn.state, turn.input, turn.thinking, turn.toolCalls, turn.tokenUsage, turn.costCents, turn.sessionId);
    return id;
  }

  getRecentTurns(limit: number = 100): Turn[] {
    return this.db.prepare('SELECT * FROM turns ORDER BY timestamp DESC LIMIT ?').all(limit) as Turn[];
  }

  // ===========================================================================
  // TOOL CALLS
  // ===========================================================================

  insertToolCall(call: Omit<ToolCall, 'id'>): string {
    const id = ulid();
    this.db.prepare(`
      INSERT INTO tool_calls (id, turn_id, name, arguments, result, duration_ms, error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, call.turnId, call.name, call.arguments, call.result, call.durationMs, call.error, call.timestamp);
    return id;
  }

  getToolCallsByTurn(turnId: string): ToolCall[] {
    return this.db.prepare('SELECT * FROM tool_calls WHERE turn_id = ? ORDER BY timestamp').all(turnId) as ToolCall[];
  }

  // ===========================================================================
  // HEARTBEAT
  // ===========================================================================

  upsertHeartbeatEntry(entry: HeartbeatEntry): void {
    this.db.prepare(`
      INSERT INTO heartbeat_entries (name, schedule, task, enabled, last_run, next_run, params)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        schedule = excluded.schedule,
        task = excluded.task,
        enabled = excluded.enabled,
        last_run = excluded.last_run,
        next_run = excluded.next_run,
        params = excluded.params
    `).run(entry.name, entry.schedule, entry.task, entry.enabled ? 1 : 0, entry.lastRun, entry.nextRun, entry.params);
  }

  getHeartbeatEntries(): HeartbeatEntry[] {
    return this.db.prepare('SELECT * FROM heartbeat_entries WHERE enabled = 1').all() as HeartbeatEntry[];
  }

  // ===========================================================================
  // TRANSACTIONS
  // ===========================================================================

  insertTransaction(tx: Omit<Transaction, 'id'>): string {
    const id = ulid();
    this.db.prepare(`
      INSERT INTO transactions (id, timestamp, type, amount_cents, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, tx.timestamp, tx.type, tx.amountCents, tx.description, tx.metadata);
    return id;
  }

  getBalanceCents(): number {
    const result = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'credit' THEN amount_cents ELSE -amount_cents END) as balance
      FROM transactions
    `).get() as { balance: number };
    return result.balance || 0;
  }

  // ===========================================================================
  // SKILLS
  // ===========================================================================

  upsertSkill(skill: Omit<Skill, 'installedAt' | 'updatedAt'>): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO skills (name, description, auto_activate, requirements, instructions, installed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        auto_activate = excluded.auto_activate,
        requirements = excluded.requirements,
        instructions = excluded.instructions,
        updated_at = ?
    `).run(skill.name, skill.description, skill.autoActivate ? 1 : 0, skill.requirements, skill.instructions, now, now, now);
  }

  getSkills(): Skill[] {
    return this.db.prepare('SELECT * FROM skills').all() as Skill[];
  }

  // ===========================================================================
  // MODIFICATIONS
  // ===========================================================================

  insertModification(mod: Omit<Modification, 'id'>): string {
    const id = ulid();
    this.db.prepare(`
      INSERT INTO modifications (id, timestamp, type, description, file_path, diff, reversible, reversed, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, mod.timestamp, mod.type, mod.description, mod.filePath, mod.diff, mod.reversible ? 1 : 0, mod.reversed ? 1 : 0, mod.sessionId);
    return id;
  }

  getRecentModifications(limit: number = 100): Modification[] {
    return this.db.prepare('SELECT * FROM modifications ORDER BY timestamp DESC LIMIT ?').all(limit) as Modification[];
  }

  // ===========================================================================
  // CHILDREN
  // ===========================================================================

  insertChild(child: Omit<ChildAgent, 'id' | 'createdAt'>): string {
    const id = ulid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO children (id, name, created_at, status, config, last_heartbeat)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, child.name, now, child.status, child.config, child.lastHeartbeat);
    return id;
  }

  getActiveChildren(): ChildAgent[] {
    return this.db.prepare("SELECT * FROM children WHERE status = 'active'").all() as ChildAgent[];
  }

  updateChildHeartbeat(id: string): void {
    this.db.prepare("UPDATE children SET last_heartbeat = ? WHERE id = ?").run(new Date().toISOString(), id);
  }

  // ===========================================================================
  // INBOX
  // ===========================================================================

  insertMessage(msg: Omit<InboxMessage, 'id'>): string {
    const id = ulid();
    this.db.prepare(`
      INSERT INTO inbox_messages (id, timestamp, from_agent, to_agent, type, content, read)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, msg.timestamp, msg.fromAgent, msg.toAgent, msg.type, msg.content, msg.read ? 1 : 0);
    return id;
  }

  getUnreadMessages(toAgent?: string): InboxMessage[] {
    if (toAgent) {
      return this.db.prepare('SELECT * FROM inbox_messages WHERE to_agent = ? AND read = 0 ORDER BY timestamp').all(toAgent) as InboxMessage[];
    }
    return this.db.prepare('SELECT * FROM inbox_messages WHERE read = 0 ORDER BY timestamp').all() as InboxMessage[];
  }

  markMessageRead(id: string): void {
    this.db.prepare('UPDATE inbox_messages SET read = 1 WHERE id = ?').run(id);
  }

  // ===========================================================================
  // IDENTITY (KV STORE)
  // ===========================================================================

  setIdentity(key: string, value: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO identity (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  getIdentity(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM identity WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  // ===========================================================================
  // AUDIT LOG
  // ===========================================================================

  logAudit(entry: Omit<AuditEntry, 'id'>): string {
    const id = ulid();
    this.db.prepare(`
      INSERT INTO audit_log (id, timestamp, type, description, session_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entry.timestamp, entry.type, entry.description, entry.sessionId, entry.metadata);
    return id;
  }

  getAuditLog(type?: string, limit: number = 100): AuditEntry[] {
    if (type) {
      return this.db.prepare('SELECT * FROM audit_log WHERE type = ? ORDER BY timestamp DESC LIMIT ?').all(type, limit) as AuditEntry[];
    }
    return this.db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?').all(limit) as AuditEntry[];
  }

  getAuditStats(): Record<string, number> {
    const rows = this.db.prepare('SELECT type, COUNT(*) as count FROM audit_log GROUP BY type').all() as Array<{ type: string; count: number }>;
    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.type] = row.count;
    }
    return stats;
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  close(): void {
    this.db.close();
    databaseLogger.info('LocalDatabase closed');
  }
}

// Global instance
let globalDb: LocalDatabase | null = null;

export function getLocalDatabase(dbPath?: string): LocalDatabase {
  if (!globalDb) {
    globalDb = new LocalDatabase(dbPath);
  }
  return globalDb;
}

export function resetLocalDatabase(): void {
  globalDb?.close();
  globalDb = null;
}

export default LocalDatabase;
