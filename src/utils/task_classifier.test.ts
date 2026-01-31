/**
 * Tests for Task Classifier
 *
 * Run with: npx tsx src/utils/task_classifier.test.ts
 */

import {
  isAuditOrResearchTask,
  isAuditPipelineEnabled,
  parseTaskContext,
  getClassificationReason,
  TaskContext,
  CONSTANTS,
} from './task_classifier.js';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`❌ ${name}`);
    console.log(`   ${error instanceof Error ? error.message : error}`);
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy, got ${actual}`);
      }
    },
    toContain(expected: string) {
      if (typeof actual !== 'string' || !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n🧪 Task Classifier Tests\n');

// Test 1: Feature flag disabled by default
test('isAuditPipelineEnabled returns false by default', () => {
  const original = process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED;
  delete process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED;
  expect(isAuditPipelineEnabled()).toBe(false);
  if (original) process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED = original;
});

// Test 2: Feature flag enabled when set to true
test('isAuditPipelineEnabled returns true when set', () => {
  const original = process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED;
  process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED = 'true';
  expect(isAuditPipelineEnabled()).toBe(true);
  if (original) {
    process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED = original;
  } else {
    delete process.env.OPENCLAW_AUDIT_PIPELINE_ENABLED;
  }
});

// Test 3: Audit command triggers pipeline
test('audit command is classified as audit task', () => {
  const task: TaskContext = { command: 'audit' };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 4: Research command triggers pipeline
test('research command is classified as audit task', () => {
  const task: TaskContext = { command: 'research' };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 5: Scan command does NOT trigger pipeline
test('scan command is NOT classified as audit task', () => {
  const task: TaskContext = { command: 'scan' };
  expect(isAuditOrResearchTask(task)).toBe(false);
});

// Test 6: Hunt command does NOT trigger pipeline
test('hunt command is NOT classified as audit task', () => {
  const task: TaskContext = { command: 'hunt' };
  expect(isAuditOrResearchTask(task)).toBe(false);
});

// Test 7: Task with audit mode triggers pipeline
test('task with mode=audit triggers pipeline', () => {
  const task: TaskContext = { command: 'analyze', mode: 'audit' };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 8: Task with research mode triggers pipeline
test('task with mode=research triggers pipeline', () => {
  const task: TaskContext = { command: 'analyze', mode: 'research' };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 9: Task with audit tag triggers pipeline
test('task with audit tag triggers pipeline', () => {
  const task: TaskContext = { command: 'scan', tags: ['audit'] };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 10: Task with research tag triggers pipeline
test('task with research tag triggers pipeline', () => {
  const task: TaskContext = { command: 'scan', tags: ['research'] };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 11: --research flag triggers pipeline
test('--research flag triggers pipeline', () => {
  const task: TaskContext = { command: 'audit', args: ['0x123', '--research'] };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 12: --deep-audit flag triggers pipeline
test('--deep-audit flag triggers pipeline', () => {
  const task: TaskContext = { command: 'audit', args: ['0x123', '--deep-audit'] };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 13: Message with "audit this" triggers pipeline
test('message with "audit this" triggers pipeline', () => {
  const task: TaskContext = { message: 'Please audit this contract 0x123' };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 14: Message with "deep dive" triggers pipeline
test('message with "deep dive" triggers pipeline', () => {
  const task: TaskContext = { message: 'Do a deep dive into this protocol' };
  expect(isAuditOrResearchTask(task)).toBe(true);
});

// Test 15: Normal message does NOT trigger pipeline
test('normal message does NOT trigger pipeline', () => {
  const task: TaskContext = { message: 'Show me the stats' };
  expect(isAuditOrResearchTask(task)).toBe(false);
});

// Test 16: Parse CLI args correctly
test('parseTaskContext parses CLI args correctly', () => {
  const context = parseTaskContext(['audit', '0x123', '--chain', 'ethereum']);
  expect(context.command).toBe('audit');
  expect(context.args?.length).toBe(3);
});

// Test 17: Parse Telegram message correctly
test('parseTaskContext parses Telegram message correctly', () => {
  const context = parseTaskContext('/audit 0x123');
  expect(context.command).toBe('audit');
  expect(context.message).toBe('/audit 0x123');
});

// Test 18: Classification reason for command
test('getClassificationReason returns command reason', () => {
  const task: TaskContext = { command: 'audit' };
  const reason = getClassificationReason(task);
  expect(reason).toContain('command:audit');
});

// Test 19: Classification reason for tag
test('getClassificationReason returns tag reason', () => {
  const task: TaskContext = { command: 'scan', tags: ['research'] };
  const reason = getClassificationReason(task);
  expect(reason).toContain('tag:research');
});

// Test 20: Classification reason for flag (use non-audit command to test flag detection)
test('getClassificationReason returns flag reason', () => {
  const task: TaskContext = { command: 'scan', args: ['--research'] };
  const reason = getClassificationReason(task);
  expect(reason).toContain('flag:--research');
});

// Test 21: Non-audit task returns 'none'
test('getClassificationReason returns none for non-audit task', () => {
  const task: TaskContext = { command: 'stats' };
  const reason = getClassificationReason(task);
  expect(reason).toBe('none');
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(50));
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
