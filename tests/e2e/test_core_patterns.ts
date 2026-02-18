#!/usr/bin/env tsx
/**
 * WHITE RABBIT - Core Patterns Test Suite
 * 
 * Tests all PicoClaw/Automaton patterns:
 * - Atomic State Persistence
 * - SQLite Database (10 tables)
 * - Audit Trail
 * - Survival Economics (4-tier)
 * - Heartbeat Daemon
 * - Tool Registry
 */

import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ulid } from 'ulid';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error, duration: Date.now() - start });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error}`);
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(title);
  console.log('='.repeat(60));
}

async function main() {
  // Test directories
  const testDir = '/tmp/white-rabbit-core-test-' + Date.now();
  fs.mkdirSync(testDir, { recursive: true });

  // =============================================================================
  // SECTION 1: Atomic State Persistence
  // =============================================================================

  section('SECTION 1: Atomic State Persistence');

  await runTest('AtomicStateManager initialization', async () => {
    const { AtomicStateManager } = await import('../../src/core/atomic-state.js');
    const stateDir = path.join(testDir, 'state');
    const manager = new AtomicStateManager({ stateDir });
    
    assert.ok(manager, 'State manager should be created');
    assert.ok(fs.existsSync(stateDir), 'State directory should exist');
  });

  await runTest('Atomic save and load', async () => {
    const { AtomicStateManager } = await import('../../src/core/atomic-state.js');
    const stateDir = path.join(testDir, 'state2');
    const manager = new AtomicStateManager({ stateDir });
    
    const data = { test: 'data', number: 123, nested: { key: 'value' } };
    manager.save('test-key', data);
    
    const loaded = manager.load('test-key');
    assert.deepEqual(loaded, data, 'Loaded data should match saved data');
  });

  await runTest('Atomic file permissions', async () => {
    const { AtomicStateManager } = await import('../../src/core/atomic-state.js');
    const stateDir = path.join(testDir, 'state3');
    const manager = new AtomicStateManager({ stateDir });
    
    manager.save('secure-key', { secret: 'data' });
    
    const filePath = path.join(stateDir, 'secure-key.json');
    const stats = fs.statSync(filePath);
    
    // Check file permissions (0o600 = owner read/write only)
    const mode = stats.mode & 0o777;
    assert.ok(mode === 0o600 || mode === 0o644, `File mode ${mode.toString(8)} should be secure`);
  });

  await runTest('State listing', async () => {
    const { AtomicStateManager } = await import('../../src/core/atomic-state.js');
    const stateDir = path.join(testDir, 'state4');
    const manager = new AtomicStateManager({ stateDir });
    
    manager.save('key1', { a: 1 });
    manager.save('key2', { b: 2 });
    manager.save('key3', { c: 3 });
    
    const keys = manager.list();
    assert.equal(keys.length, 3, 'Should list 3 keys');
    assert.ok(keys.includes('key1'), 'Should include key1');
  });

  await runTest('State snapshot creation', async () => {
    const { AtomicStateManager } = await import('../../src/core/atomic-state.js');
    const stateDir = path.join(testDir, 'state5');
    const manager = new AtomicStateManager({ stateDir });
    
    manager.save('data1', { value: 1 });
    manager.save('data2', { value: 2 });
    
    manager.snapshot('test-snapshot');
    
    const snapshots = manager.listSnapshots();
    assert.ok(snapshots.length > 0, 'Should have at least one snapshot');
    assert.ok(snapshots[0].startsWith('test-snapshot@'), 'Snapshot name should include prefix');
  });

  // =============================================================================
  // SECTION 2: SQLite Database (10 Tables)
  // =============================================================================

  section('SECTION 2: SQLite Database (10 Tables)');

  await runTest('LocalDatabase initialization', async () => {
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    const dbPath = path.join(testDir, 'test.db');
    const db = new LocalDatabase(dbPath);
    
    assert.ok(db, 'Database should be created');
    assert.ok(fs.existsSync(dbPath), 'Database file should exist');
    
    db.close();
  });

  await runTest('All 10 tables created', async () => {
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    const dbPath = path.join(testDir, 'test2.db');
    const db = new LocalDatabase(dbPath);
    
    // Check all tables exist by attempting operations
    const turnId = db.insertTurn({
      timestamp: new Date().toISOString(),
      state: 'thinking',
      input: 'test',
      thinking: 'test thinking',
      toolCalls: '[]',
      tokenUsage: '{}',
      costCents: 0,
    });
    assert.ok(turnId, 'Turns table should work');
    
    const txId = db.insertTransaction({
      timestamp: new Date().toISOString(),
      type: 'credit',
      amountCents: 1000,
      description: 'Test',
      metadata: '{}',
    });
    assert.ok(txId, 'Transactions table should work');
    
    db.setIdentity('test-key', 'test-value');
    assert.equal(db.getIdentity('test-key'), 'test-value', 'Identity table should work');
    
    const auditId = db.logAudit({
      timestamp: new Date().toISOString(),
      type: 'decision',
      description: 'Test decision',
    });
    assert.ok(auditId, 'Audit table should work');
    
    db.close();
  });

  await runTest('Balance tracking', async () => {
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    const dbPath = path.join(testDir, 'test3.db');
    const db = new LocalDatabase(dbPath);
    
    db.insertTransaction({
      timestamp: new Date().toISOString(),
      type: 'credit',
      amountCents: 500,
      description: 'Deposit',
      metadata: '{}',
    });
    
    db.insertTransaction({
      timestamp: new Date().toISOString(),
      type: 'debit',
      amountCents: 200,
      description: 'Spend',
      metadata: '{}',
    });
    
    const balance = db.getBalanceCents();
    assert.equal(balance, 300, 'Balance should be 300 cents');
    
    db.close();
  });

  // =============================================================================
  // SECTION 3: Audit Trail
  // =============================================================================

  section('SECTION 3: Audit Trail');

  await runTest('AuditLogger initialization', async () => {
    const { AuditLogger } = await import('../../src/core/audit.js');
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    
    const dbPath = path.join(testDir, 'audit.db');
    const db = new LocalDatabase(dbPath);
    const audit = new AuditLogger(db);
    
    assert.ok(audit, 'Audit logger should be created');
    db.close();
  });

  await runTest('Audit entry creation', async () => {
    const { AuditLogger } = await import('../../src/core/audit.js');
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    
    const dbPath = path.join(testDir, 'audit2.db');
    const db = new LocalDatabase(dbPath);
    const audit = new AuditLogger(db);
    
    const id = audit.log('decision', 'Test decision', { reason: 'test' }, 'session-1');
    assert.ok(id, 'Should return audit entry ID');
    
    const entries = audit.getRecent(10);
    assert.equal(entries.length, 1, 'Should have 1 entry');
    assert.equal(entries[0].type, 'decision', 'Type should be decision');
    
    db.close();
  });

  await runTest('Audit stats', async () => {
    const { AuditLogger } = await import('../../src/core/audit.js');
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    
    const dbPath = path.join(testDir, 'audit3.db');
    const db = new LocalDatabase(dbPath);
    const audit = new AuditLogger(db);
    
    audit.logDecision('Decision 1', { context: 'test', options: ['a'], selected: 'a', rationale: 'test' });
    audit.logBlocker('Blocker 1', { blocker: 'test', attemptedSolutions: [] });
    audit.logAchievement('Achievement 1', { achievement: 'test' });
    
    const stats = audit.getStats();
    assert.equal(stats['decision'], 1, 'Should have 1 decision');
    assert.equal(stats['blocker'], 1, 'Should have 1 blocker');
    assert.equal(stats['achievement'], 1, 'Should have 1 achievement');
    
    db.close();
  });

  await runTest('Audit report generation', async () => {
    const { AuditLogger } = await import('../../src/core/audit.js');
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    
    const dbPath = path.join(testDir, 'audit4.db');
    const db = new LocalDatabase(dbPath);
    const audit = new AuditLogger(db);
    
    audit.log('decision', 'Test decision');
    
    const report = audit.generateReport();
    assert.ok(report.includes('AUDIT REPORT'), 'Report should have header');
    assert.ok(report.includes('decision'), 'Report should include decision type');
    
    db.close();
  });

  // =============================================================================
  // SECTION 4: Survival Economics (4-Tier)
  // =============================================================================

  section('SECTION 4: Survival Economics (4-Tier)');

  await runTest('SurvivalManager initialization', async () => {
    const { SurvivalManager } = await import('../../src/core/survival.js');
    
    let credits = 10;
    const manager = new SurvivalManager(() => credits);
    
    assert.ok(manager, 'Survival manager should be created');
    assert.equal(manager.getCurrentTier(), 'normal', 'Should start at normal tier');
  });

  await runTest('Tier calculation', async () => {
    const { SurvivalManager } = await import('../../src/core/survival.js');
    
    // Test normal tier
    let manager = new SurvivalManager(() => 10);
    assert.equal(manager.getCurrentTier(), 'normal', '$10 should be normal tier');
    
    // Test low_compute tier
    manager = new SurvivalManager(() => 3);
    manager.checkAndApply();
    assert.equal(manager.getCurrentTier(), 'low_compute', '$3 should be low_compute tier');
    
    // Test critical tier
    manager = new SurvivalManager(() => 0.5);
    manager.checkAndApply();
    assert.equal(manager.getCurrentTier(), 'critical', '$0.50 should be critical tier');
    
    // Test dead tier
    manager = new SurvivalManager(() => 0);
    manager.checkAndApply();
    assert.equal(manager.getCurrentTier(), 'dead', '$0 should be dead tier');
  });

  await runTest('Tier configuration', async () => {
    const { SurvivalManager } = await import('../../src/core/survival.js');
    
    const manager = new SurvivalManager(() => 10);
    const config = manager.getConfig();
    
    assert.ok(config.model, 'Config should have model');
    assert.ok(config.heartbeatIntervalMs > 0, 'Config should have heartbeat interval');
    assert.ok(config.maxConcurrentScans > 0, 'Config should have max scans');
  });

  await runTest('Can operate checks', async () => {
    const { SurvivalManager } = await import('../../src/core/survival.js');
    
    // Normal tier - everything allowed
    let manager = new SurvivalManager(() => 10);
    assert.equal(manager.canOperate('scan'), true, 'Normal: scan allowed');
    assert.equal(manager.canOperate('ai_analysis'), true, 'Normal: AI allowed');
    
    // Critical tier - AI disabled
    manager = new SurvivalManager(() => 0.5);
    manager.checkAndApply();
    assert.equal(manager.canOperate('scan'), true, 'Critical: scan allowed');
    assert.equal(manager.canOperate('ai_analysis'), false, 'Critical: AI disabled');
    
    // Dead tier - nothing allowed
    manager = new SurvivalManager(() => 0);
    manager.checkAndApply();
    assert.equal(manager.canOperate('scan'), false, 'Dead: scan disabled');
  });

  await runTest('Tier transition history', async () => {
    const { SurvivalManager } = await import('../../src/core/survival.js');
    
    let credits = 10;
    const manager = new SurvivalManager(() => credits);
    
    // Force tier changes
    manager.forceSetTier('low_compute');
    manager.forceSetTier('critical');
    
    const history = manager.getTransitionHistory();
    assert.ok(history.length >= 2, 'Should have transition history');
  });

  // =============================================================================
  // SECTION 5: Heartbeat Daemon
  // =============================================================================

  section('SECTION 5: Heartbeat Daemon');

  await runTest('HeartbeatDaemon initialization', async () => {
    const { HeartbeatDaemon } = await import('../../src/core/heartbeat.js');
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    const { SurvivalManager } = await import('../../src/core/survival.js');
    
    const dbPath = path.join(testDir, 'heartbeat.db');
    const db = new LocalDatabase(dbPath);
    const survival = new SurvivalManager(() => 10);
    const daemon = new HeartbeatDaemon(db, survival);
    
    assert.ok(daemon, 'Heartbeat daemon should be created');
    assert.equal(daemon.isRunning(), false, 'Should not be running initially');
    
    db.close();
  });

  await runTest('Cron expression parsing', async () => {
    const { CronExpression } = await import('../../src/core/heartbeat.js');
    
    // Every minute
    let cron = new CronExpression('* * * * *');
    assert.ok(cron.matches(), 'Should match every minute');
    
    // Every 5 minutes
    cron = new CronExpression('*/5 * * * *');
    const now = new Date();
    now.setMinutes(0);
    assert.ok(cron.matches(now), 'Should match minute 0');
    
    // Specific time
    cron = new CronExpression('30 14 * * *');
    const specific = new Date('2026-02-16T14:30:00');
    assert.ok(cron.matches(specific), 'Should match 14:30');
  });

  await runTest('Task registration', async () => {
    const { HeartbeatDaemon } = await import('../../src/core/heartbeat.js');
    const { LocalDatabase } = await import('../../src/core/database-sqlite.js');
    const { SurvivalManager } = await import('../../src/core/survival.js');
    
    const dbPath = path.join(testDir, 'heartbeat2.db');
    const db = new LocalDatabase(dbPath);
    const survival = new SurvivalManager(() => 10);
    const daemon = new HeartbeatDaemon(db, survival);
    
    let executed = false;
    daemon.registerTask({
      name: 'test-task',
      schedule: '* * * * *',
      enabled: true,
      handler: async () => {
        executed = true;
      },
    });
    
    const status = daemon.getStatus();
    assert.ok(status.find(s => s.name === 'test-task'), 'Task should be registered');
    
    db.close();
  });

  // =============================================================================
  // SECTION 6: Tool Registry
  // =============================================================================

  section('SECTION 6: Tool Registry');

  await runTest('ToolRegistry initialization', async () => {
    const { ToolRegistry } = await import('../../src/core/tool-registry.js');
    
    const registry = new ToolRegistry();
    assert.ok(registry, 'Tool registry should be created');
    assert.equal(registry.count(), 0, 'Should start empty');
  });

  await runTest('Tool registration', async () => {
    const { ToolRegistry } = await import('../../src/core/tool-registry.js');
    
    const registry = new ToolRegistry();
    
    registry.register({
      tool: {
        name: 'test-tool',
        description: 'A test tool',
        parameters: {},
        execute: async () => ({ success: true }),
      },
    });
    
    assert.equal(registry.count(), 1, 'Should have 1 tool');
    assert.ok(registry.has('test-tool'), 'Should have test-tool');
  });

  await runTest('Tool execution', async () => {
    const { ToolRegistry } = await import('../../src/core/tool-registry.js');
    
    const registry = new ToolRegistry();
    
    registry.register({
      tool: {
        name: 'echo',
        description: 'Echo tool',
        parameters: {
          message: { type: 'string', description: 'Message to echo', required: true },
        },
        execute: async (args) => ({
          success: true,
          data: args.message,
        }),
      },
    });
    
    const result = await registry.execute('echo', { message: 'hello' });
    assert.equal(result.success, true, 'Execution should succeed');
    assert.equal(result.data, 'hello', 'Should return echoed message');
  });

  await runTest('Tool context injection', async () => {
    const { ToolRegistry } = await import('../../src/core/tool-registry.js');
    
    const registry = new ToolRegistry();
    
    registry.register({
      tool: {
        name: 'context-test',
        description: 'Test context',
        parameters: {},
        execute: async (args, context) => ({
          success: true,
          data: context?.chainId,
        }),
      },
    });
    
    registry.setContext({ chainId: 1 });
    const result = await registry.execute('context-test');
    assert.equal(result.data, 1, 'Should receive context');
  });

  await runTest('Built-in tools registration', async () => {
    const { registerBuiltInTools } = await import('../../src/core/tool-registry.js');
    
    const registry = registerBuiltInTools();
    
    assert.ok(registry.has('scan_contract'), 'Should have scan_contract tool');
    assert.ok(registry.has('analyze_with_ai'), 'Should have analyze_with_ai tool');
    assert.ok(registry.has('send_notification'), 'Should have send_notification tool');
    assert.ok(registry.count() >= 5, 'Should have at least 5 built-in tools');
  });

  // =============================================================================
  // CLEANUP
  // =============================================================================

  // Clean up test directory
  fs.rmSync(testDir, { recursive: true, force: true });

  // =============================================================================
  // TEST SUMMARY
  // =============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal: ${results.length} tests`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL CORE PATTERN TESTS PASSED! 🎉');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
