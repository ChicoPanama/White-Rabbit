# WHITE RABBIT - PicoClaw & Automaton Optimizations

## Executive Summary

**Analysis:** Comprehensive comparison of WHITE RABBIT against PicoClaw (Go patterns) and Automaton (TypeScript patterns) architectural standards.

**Finding:** WHITE RABBIT implements ~40% of advanced patterns. Major gaps in atomic persistence, structured logging, survival economics, and audit trails.

**Impact:** With these optimizations, WHITE RABBIT would achieve enterprise-grade reliability, observability, and autonomous operation.

---

## 🎯 Missing PicoClaw Patterns

### 1. Structured Logging ❌ MISSING

**Current State:** 1,094 scattered `console.log` statements

**PicoClaw Standard:**
```typescript
// JSON structured, component-contextual, machine-parseable
{"level":"INFO","timestamp":"2026-02-16T02:30:00Z","component":"scanner","message":"Scan started","fields":{"chain":"ethereum","address":"0x1234"}}
```

**Implementation:** ✅ CREATED `src/core/logger.ts`

---

### 2. Atomic State Persistence ⚠️ PARTIAL

**Current State:** 
- `walletManager.ts` has atomic wallet writes
- `patternCache.ts` uses SQLite but NOT atomic for all operations
- No atomic snapshot pattern for scanner state

**PicoClaw Standard:**
```typescript
class StateManager {
  saveAtomic(key: string, data: any): void {
    const tempPath = `${key}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data));
    fs.renameSync(tempPath, key); // Atomic on POSIX
  }
}
```

**Gap:** Scanner state, hunting memory, and configuration writes are not atomic

---

### 3. Tool Registry ❌ MISSING

**Current State:** Hardcoded function calls

**PicoClaw Standard:**
```typescript
interface Tool {
  name: string;
  description: string;
  execute(args: any): ToolResult;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();
  
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
  
  execute(name: string, args: any): ToolResult {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.execute(args);
  }
}
```

**Gap:** No plugin architecture for scanners, analyzers, or alerts

---

### 4. Config + Environment ✅ EXISTS

**Current State:** `src/config.ts` - Well implemented
- JSON config file support
- Environment variable override
- Validation and defaults

**Status:** ✅ Already at PicoClaw standard

---

## 🎯 Missing Automaton Patterns

### 1. Comprehensive SQLite Database ⚠️ PARTIAL

**Current State:**
- `src/database.ts` - PostgreSQL only
- `src/services/patternCache.ts` - SQLite for patterns only

**Automaton Standard:**
```typescript
// Single SQLite with 10+ tables, WAL mode
const db = createDatabase("~/.white-rabbit/state.db");

// Schema includes:
// - turns (reasoning/action log)
// - tool_calls (execution history)
// - heartbeat_entries (scheduled tasks)
// - transactions (financial tracking)
// - skills (installed capabilities)
// - modifications (audit trail)
// - children (spawned agents)
// - inbox_messages (agent communication)
// - kv (generic key-value store)

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
```

**Gap:** No local SQLite for autonomous operation without PostgreSQL

---

### 2. Immutable Audit Trail ❌ MISSING

**Current State:** No audit logging

**Automaton Standard:**
```typescript
interface AuditEntry {
  id: string;          // ULID
  timestamp: string;
  type: 'decision' | 'blocker' | 'achievement' | 'tool_call' | 'code_change';
  description: string;
  metadata: Record<string, any>;
}

class AuditLogger {
  log(entry: AuditEntry): void {
    // Append-only, never delete
    this.db.append(entry);
  }
}
```

**Gap:** No tracking of decisions, blockers, or system changes

---

### 3. Survival Economics (4-Tier System) ⚠️ PARTIAL

**Current State:** `src/services/cost-tracker.ts`
- Tracks AI costs
- Enforces hourly/daily limits
- No tier-based degradation

**Automaton Standard:**
```typescript
type SurvivalTier = 'normal' | 'low_compute' | 'critical' | 'dead';

interface TierConfig {
  tier: SurvivalTier;
  model: string;           // Downgrade model on low budget
  heartbeatInterval: number; // Slow down when critical
  disableFeatures: string[]; // Disable non-essential
}

// Automatic tier switching based on credits remaining
// normal: >$5, low_compute: $1-5, critical: $0-1, dead: $0
```

**Gap:** No automatic degradation when API credits low

---

### 4. Heartbeat Daemon ❌ MISSING

**Current State:** PM2 restarts processes, no internal heartbeat

**Automaton Standard:**
```typescript
interface HeartbeatEntry {
  name: string;
  schedule: string;  // Cron expression
  task: string;
  enabled: boolean;
  lastRun: Date;
  nextRun: Date;
}

class HeartbeatDaemon {
  // Runs scheduled tasks even when agent "sleeps"
  // Cron-based scheduling
  // Database-backed persistence
}
```

**Gap:** No scheduled task system for maintenance, self-evolution

---

### 5. Skills System (YAML Frontmatter) ❌ MISSING

**Current State:** Hardcoded capabilities

**Automaton Standard:**
```typescript
// skills/contract-scanner/SKILL.md
---
name: contract-scanner
description: Scan smart contracts for vulnerabilities
autoActivate: true
requires:
  bins: [slither, solc]
  env: [ETHERSCAN_API_KEY]
---

# Contract Scanner Skill

## Instructions
Scan contracts using static analysis...
```

**Gap:** No dynamic skill loading based on requirements

---

### 6. Security Layer (Unix Permissions) ⚠️ PARTIAL

**Current State:** `walletManager.ts` has 0o600 for wallet files

**Automaton Standard:**
```typescript
class SecureFile {
  static writeAtomic(path: string, content: string, mode: number = 0o644): void {
    const temp = `${path}.tmp`;
    fs.writeFileSync(temp, content, { mode });
    fs.renameSync(temp, path);
  }
  
  static secureMkdir(path: string, mode: number = 0o700): void {
    fs.mkdirSync(path, { recursive: true, mode });
  }
}

class SecretStore {
  // 0o700 directory, 0o600 files
  // Encrypted at rest
}
```

**Gap:** Not applied consistently across all file operations

---

## 📊 Pattern Implementation Matrix

| Pattern | PicoClaw | Automaton | WHITE RABBIT | Priority |
|---------|----------|-----------|--------------|----------|
| **Structured Logging** | ✅ | ✅ | ⚠️ (1,094 console.logs) | 🔴 HIGH |
| **Atomic Persistence** | ✅ | ✅ | ⚠️ (partial) | 🔴 HIGH |
| **Tool Registry** | ✅ | ❌ | ❌ | 🟡 MEDIUM |
| **Config+Env** | ✅ | ✅ | ✅ | ✅ DONE |
| **SQLite Database** | ❌ | ✅ | ⚠️ (patterns only) | 🔴 HIGH |
| **Audit Trail** | ❌ | ✅ | ❌ | 🟡 MEDIUM |
| **Survival Economics** | ❌ | ✅ | ⚠️ (cost tracker) | 🟡 MEDIUM |
| **Heartbeat Daemon** | ❌ | ✅ | ❌ | 🟡 MEDIUM |
| **Skills System** | ❌ | ✅ | ❌ | 🟢 LOW |
| **Security Layer** | ✅ | ✅ | ⚠️ (partial) | 🟡 MEDIUM |

---

## 🚀 Implementation Plan

### Phase 1: Critical (Week 1)

#### 1.1 Replace Console Logs with Structured Logger
```typescript
// src/core/logger.ts ✅ CREATED

// Migration: Replace 1,094 console.log statements
// src/scanner.ts:70 statements
// src/cli.ts:338 statements
// src/cached-scanner.ts:36 statements
```

#### 1.2 Atomic State Persistence
```typescript
// src/core/state.ts - NEW FILE
export class AtomicStateManager {
  private stateDir: string;
  
  save<T>(key: string, data: T): void {
    const tempPath = path.join(this.stateDir, `${key}.tmp`);
    const finalPath = path.join(this.stateDir, `${key}.json`);
    
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, finalPath); // Atomic
  }
  
  load<T>(key: string): T | null {
    const filePath = path.join(this.stateDir, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}
```

#### 1.3 Local SQLite Database
```typescript
// src/core/database-sqlite.ts - NEW FILE
export class LocalDatabase {
  private db: Database;
  
  constructor(dbPath: string = '~/.white-rabbit/state.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }
  
  private migrate(): void {
    // Tables: scans, findings, decisions, audits, kv
  }
}
```

### Phase 2: Important (Week 2)

#### 2.1 Survival Economics Enhancement
```typescript
// src/core/survival.ts - NEW FILE
export type SurvivalTier = 'normal' | 'low_compute' | 'critical' | 'dead';

export class SurvivalManager {
  private currentTier: SurvivalTier = 'normal';
  
  checkAndApply(): SurvivalTier {
    const credits = this.getRemainingCredits();
    
    if (credits > 5) return this.setTier('normal');
    if (credits > 1) return this.setTier('low_compute');
    if (credits > 0) return this.setTier('critical');
    return this.setTier('dead');
  }
  
  private setTier(tier: SurvivalTier): SurvivalTier {
    if (tier === this.currentTier) return tier;
    
    // Apply restrictions
    switch (tier) {
      case 'low_compute':
        // Switch to cheaper AI models
        // Increase scan intervals
        break;
      case 'critical':
        // Disable non-essential features
        // Only scan high-value contracts
        break;
      case 'dead':
        // Pause all operations
        break;
    }
    
    this.currentTier = tier;
    return tier;
  }
}
```

#### 2.2 Audit Trail System
```typescript
// src/core/audit.ts - NEW FILE
export type AuditType = 'decision' | 'blocker' | 'achievement' | 'tool_call' | 'tier_change';

export interface AuditEntry {
  id: string;           // ULID
  timestamp: string;
  type: AuditType;
  description: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private db: LocalDatabase;
  
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    const fullEntry: AuditEntry = {
      id: generateULID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    
    this.db.insert('audit_log', fullEntry);
  }
  
  getRecent(limit: number = 100): AuditEntry[] {
    return this.db.query('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?', limit);
  }
}
```

#### 2.3 Security Layer Standardization
```typescript
// src/core/security.ts - NEW FILE
export class SecureFile {
  static write(path: string, content: string, mode: number = 0o644): void {
    const dir = path.dirname(path);
    this.secureMkdir(dir, 0o700);
    
    const tempPath = `${path}.tmp`;
    fs.writeFileSync(tempPath, content, { mode });
    fs.renameSync(tempPath, path);
  }
  
  static secureMkdir(path: string, mode: number = 0o700): void {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true, mode });
    }
  }
}

export class SecretStore {
  private secretsDir: string;
  
  constructor(secretsDir: string = '~/.white-rabbit/secrets') {
    this.secretsDir = secretsDir;
    SecureFile.secureMkdir(this.secretsDir, 0o700);
  }
  
  set(name: string, value: string): void {
    const path = path.join(this.secretsDir, name);
    SecureFile.write(path, value, 0o600);
  }
  
  get(name: string): string | null {
    const path = path.join(this.secretsDir, name);
    if (!fs.existsSync(path)) return null;
    return fs.readFileSync(path, 'utf8');
  }
}
```

### Phase 3: Nice to Have (Week 3)

#### 3.1 Heartbeat Daemon
```typescript
// src/core/heartbeat.ts - NEW FILE
export interface HeartbeatTask {
  name: string;
  schedule: string;  // Cron
  handler: () => Promise<void>;
  enabled: boolean;
}

export class HeartbeatDaemon {
  private tasks: Map<string, HeartbeatTask> = new Map();
  private running: boolean = false;
  
  register(task: HeartbeatTask): void {
    this.tasks.set(task.name, task);
  }
  
  start(): void {
    this.running = true;
    this.loop();
  }
  
  private async loop(): Promise<void> {
    while (this.running) {
      for (const task of this.tasks.values()) {
        if (task.enabled && this.isDue(task)) {
          await task.handler();
        }
      }
      await sleep(60000); // Check every minute
    }
  }
}
```

#### 3.2 Skills System
```typescript
// src/core/skills.ts - NEW FILE
export interface Skill {
  name: string;
  description: string;
  autoActivate: boolean;
  requirements: {
    bins?: string[];
    env?: string[];
    packages?: string[];
  };
  instructions: string;
}

export class SkillsLoader {
  loadFromDir(skillsDir: string): Skill[] {
    // Parse SKILL.md files with YAML frontmatter
  }
  
  checkRequirements(skill: Skill): boolean {
    // Check binaries, env vars, packages
  }
}
```

---

## 📈 Expected Impact

### Before Optimizations
- 1,094 unstructured logs
- No atomic state guarantees
- No audit trail
- Basic cost tracking only
- PM2-dependent scheduling

### After Optimizations
- JSON structured logs (machine-parseable)
- Atomic state persistence (crash-safe)
- Complete audit trail (decisions tracked)
- 4-tier survival economics (auto-degradation)
- Internal heartbeat (autonomous scheduling)
- Plugin architecture (extensible tools)

### Reliability Improvement
| Metric | Before | After |
|--------|--------|-------|
| State corruption risk | Medium | Near zero |
| Log parseability | Manual | Automatic |
| Recovery from crashes | PM2 restart | Atomic recovery |
| Budget exhaustion | Hard stop | Graceful degradation |
| Decision tracking | None | Complete |

---

## ✅ Implementation Status

| Component | Status | File |
|-----------|--------|------|
| Structured Logger | ✅ CREATED | `src/core/logger.ts` |
| Enhanced Kimi Client | ✅ CREATED | `src/core/kimi-client.ts` |
| Atomic State Manager | 📝 PLANNED | `src/core/state.ts` |
| Local SQLite DB | 📝 PLANNED | `src/core/database-sqlite.ts` |
| Audit Logger | 📝 PLANNED | `src/core/audit.ts` |
| Survival Manager | 📝 PLANNED | `src/core/survival.ts` |
| Security Layer | 📝 PLANNED | `src/core/security.ts` |
| Heartbeat Daemon | 📝 PLANNED | `src/core/heartbeat.ts` |
| Skills Loader | 📝 PLANNED | `src/core/skills.ts` |

---

## 🎓 Conclusion

**WHITE RABBIT + PicoClaw/Automaton Patterns = Enterprise-Grade Autonomous Scanner**

The optimizations would transform White Rabbit from a "script collection" to a "self-healing, observable, auditable autonomous agent."

**Priority Order:**
1. 🔴 **Structured Logging** - Immediate observability gain
2. 🔴 **Atomic State** - Crash safety
3. 🔴 **Local SQLite** - Autonomous operation
4. 🟡 **Survival Economics** - Budget-aware degradation
5. 🟡 **Audit Trail** - Decision tracking
6. 🟢 **Heartbeat/Skills** - Nice to have

**Estimated Effort:** 2-3 weeks for full implementation

**Result:** The fucking best autonomous vulnerability scanner ever built. 🐇🔥
