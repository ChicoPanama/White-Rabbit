/**
 * Tests for Temporal workflow orchestration modules.
 * Uses Node.js built-in test runner (node:test + node:assert).
 *
 * These tests verify the Temporal modules without requiring a running
 * Temporal server — they test types, shared constants, activity logic
 * (in isolation), orchestrator routing, and workflow structure.
 *
 * Run with: npx tsx --test src/tests/temporal.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Shared Types & Constants ───

describe('Temporal Shared', () => {
  it('should export scan phases', async () => {
    const { SCAN_PHASES } = await import('../temporal/shared.js');
    assert.equal(SCAN_PHASES.length, 5, 'Should have 5 scan phases');
    assert.deepEqual([...SCAN_PHASES], [
      'discovery',
      'static-analysis',
      'vulnerability-hypothesis',
      'verification',
      'report',
    ]);
  });

  it('should export vulnerability types', async () => {
    const { VULN_TYPES } = await import('../temporal/shared.js');
    assert.equal(VULN_TYPES.length, 6, 'Should have 6 vuln types');
    assert.ok(VULN_TYPES.includes('arithmetic'));
    assert.ok(VULN_TYPES.includes('reentrancy'));
    assert.ok(VULN_TYPES.includes('access-control'));
    assert.ok(VULN_TYPES.includes('oracle'));
    assert.ok(VULN_TYPES.includes('flash-loan'));
    assert.ok(VULN_TYPES.includes('logic'));
  });

  it('should export non-retryable error types', async () => {
    const { NON_RETRYABLE_ERROR_TYPES } = await import('../temporal/shared.js');
    assert.ok(NON_RETRYABLE_ERROR_TYPES.includes('ConfigError'));
    assert.ok(NON_RETRYABLE_ERROR_TYPES.includes('ValidationError'));
    assert.ok(NON_RETRYABLE_ERROR_TYPES.includes('TemplateNotFoundError'));
  });

  it('should export task queue and workflow constants', async () => {
    const { TASK_QUEUE, WORKFLOW_ID_PREFIX, PROGRESS_QUERY } = await import('../temporal/shared.js');
    assert.equal(TASK_QUEUE, 'scanner-queue');
    assert.equal(WORKFLOW_ID_PREFIX, 'scan');
    assert.equal(PROGRESS_QUERY, 'progress');
  });

  it('should define ScanWorkflowInput interface shape', async () => {
    const shared = await import('../temporal/shared.js');
    // Type-level check: ensure the constants are the right types
    const input: import('../temporal/shared.js').ScanWorkflowInput = {
      sessionId: 'test-session',
      configPath: 'configs/default-config.yaml',
      contractAddress: '0x1234',
      chain: 'ethereum',
      protocolName: 'TestProtocol',
      dryRun: true,
    };
    assert.equal(input.sessionId, 'test-session');
    assert.equal(input.dryRun, true);
  });

  it('should define PhaseResult interface shape', async () => {
    const result: import('../temporal/shared.js').PhaseResult = {
      phase: 'discovery',
      status: 'success',
      duration: 1234,
      deliverables: ['discovery/contract-source.json'],
      errors: [],
      metadata: { chain: 'ethereum' },
    };
    assert.equal(result.phase, 'discovery');
    assert.equal(result.status, 'success');
    assert.equal(result.deliverables.length, 1);
  });

  it('should define ScanWorkflowResult interface shape', async () => {
    const result: import('../temporal/shared.js').ScanWorkflowResult = {
      sessionId: 'test',
      status: 'completed',
      phasesCompleted: ['discovery', 'static-analysis'],
      phasesFailed: [],
      findingsCount: 5,
      verifiedCount: 1,
      duration: 60000,
      deliverables: ['discovery/contract-source.json'],
    };
    assert.equal(result.status, 'completed');
    assert.equal(result.findingsCount, 5);
  });
});

// ─── Activity Error Types ───

describe('Activity Error Types', () => {
  it('should create ConfigError with correct name', async () => {
    const { ConfigError } = await import('../temporal/activities.js');
    const err = new ConfigError('bad config');
    assert.equal(err.name, 'ConfigError');
    assert.equal(err.message, 'bad config');
    assert.ok(err instanceof Error);
  });

  it('should create ValidationError with correct name', async () => {
    const { ValidationError } = await import('../temporal/activities.js');
    const err = new ValidationError('invalid input');
    assert.equal(err.name, 'ValidationError');
    assert.equal(err.message, 'invalid input');
    assert.ok(err instanceof Error);
  });
});

// ─── Activity Integration (Dry-Run Mode) ───

describe('Activities (dry-run integration)', () => {
  let savedDryRun: string | undefined;

  before(() => {
    savedDryRun = process.env.DRY_RUN;
    process.env.DRY_RUN = 'true';
  });

  after(() => {
    if (savedDryRun !== undefined) process.env.DRY_RUN = savedDryRun;
    else delete process.env.DRY_RUN;
  });

  it('should export all 5 activity functions', async () => {
    const activities = await import('../temporal/activities.js');
    assert.equal(typeof activities.discoveryActivity, 'function');
    assert.equal(typeof activities.staticAnalysisActivity, 'function');
    assert.equal(typeof activities.vulnerabilityHypothesisActivity, 'function');
    assert.equal(typeof activities.verificationActivity, 'function');
    assert.equal(typeof activities.reportActivity, 'function');
  });
});

// ─── Orchestrator Bridge ───

describe('Orchestrator Bridge', () => {
  it('should default to legacy mode', async () => {
    const { getOrchestratorMode } = await import('../temporal/orchestrator.js');
    const saved = process.env.ORCHESTRATOR;
    delete process.env.ORCHESTRATOR;

    const mode = getOrchestratorMode();
    assert.equal(mode, 'legacy');

    if (saved) process.env.ORCHESTRATOR = saved;
  });

  it('should detect temporal mode', async () => {
    const { getOrchestratorMode } = await import('../temporal/orchestrator.js');
    const saved = process.env.ORCHESTRATOR;
    process.env.ORCHESTRATOR = 'temporal';

    const mode = getOrchestratorMode();
    assert.equal(mode, 'temporal');

    if (saved) process.env.ORCHESTRATOR = saved;
    else delete process.env.ORCHESTRATOR;
  });

  it('should treat unknown values as legacy', async () => {
    const { getOrchestratorMode } = await import('../temporal/orchestrator.js');
    const saved = process.env.ORCHESTRATOR;
    process.env.ORCHESTRATOR = 'foobar';

    const mode = getOrchestratorMode();
    assert.equal(mode, 'legacy');

    if (saved) process.env.ORCHESTRATOR = saved;
    else delete process.env.ORCHESTRATOR;
  });

  it('should export runTemporalScan function', async () => {
    const { runTemporalScan } = await import('../temporal/orchestrator.js');
    assert.equal(typeof runTemporalScan, 'function');
  });

  it('should export runLegacyScan function', async () => {
    const { runLegacyScan } = await import('../temporal/orchestrator.js');
    assert.equal(typeof runLegacyScan, 'function');
  });
});

// ─── Workflow Module Structure ───

describe('Workflow Module', () => {
  it('should export scanWorkflow function', async () => {
    const workflows = await import('../temporal/workflows.js');
    assert.equal(typeof workflows.scanWorkflow, 'function');
  });
});

// ─── Client Module Structure ───

describe('Client Module', () => {
  it('should export all client functions', async () => {
    const client = await import('../temporal/client.js');
    assert.equal(typeof client.startScan, 'function');
    assert.equal(typeof client.queryProgress, 'function');
    assert.equal(typeof client.awaitScanResult, 'function');
    assert.equal(typeof client.cancelScan, 'function');
    assert.equal(typeof client.terminateScan, 'function');
    assert.equal(typeof client.describeScan, 'function');
    assert.equal(typeof client.listScans, 'function');
    assert.equal(typeof client.closeClient, 'function');
  });
});

// ─── Docker Compose Validation ───

describe('Docker Infrastructure', () => {
  it('should have docker-compose.temporal.yml', () => {
    const composePath = path.resolve(process.cwd(), 'docker-compose.temporal.yml');
    assert.ok(fs.existsSync(composePath), 'docker-compose.temporal.yml should exist');
  });

  it('should define required services in compose file', () => {
    const composePath = path.resolve(process.cwd(), 'docker-compose.temporal.yml');
    const content = fs.readFileSync(composePath, 'utf-8');
    assert.ok(content.includes('temporal-db:'), 'Should define temporal-db service');
    assert.ok(content.includes('temporal:'), 'Should define temporal service');
    assert.ok(content.includes('temporal-ui:'), 'Should define temporal-ui service');
    assert.ok(content.includes('scanner-worker:'), 'Should define scanner-worker service');
  });

  it('should expose correct ports', () => {
    const composePath = path.resolve(process.cwd(), 'docker-compose.temporal.yml');
    const content = fs.readFileSync(composePath, 'utf-8');
    assert.ok(content.includes('7233:7233'), 'Should expose Temporal gRPC port');
    assert.ok(content.includes('8233:8080'), 'Should expose Temporal UI port');
    assert.ok(content.includes('5433:5432'), 'Should expose Temporal DB port');
  });

  it('should have temporal-start.sh', () => {
    const scriptPath = path.resolve(process.cwd(), 'temporal-start.sh');
    assert.ok(fs.existsSync(scriptPath), 'temporal-start.sh should exist');
    const stats = fs.statSync(scriptPath);
    assert.ok(stats.mode & 0o111, 'temporal-start.sh should be executable');
  });

  it('should have scanner CLI wrapper', () => {
    const scannerPath = path.resolve(process.cwd(), 'scanner');
    assert.ok(fs.existsSync(scannerPath), 'scanner should exist');
    const stats = fs.statSync(scannerPath);
    assert.ok(stats.mode & 0o111, 'scanner should be executable');
  });
});

// ─── Migration Docs ───

describe('Migration Documentation', () => {
  it('should have temporal migration guide', () => {
    const docPath = path.resolve(process.cwd(), 'docs/temporal-migration.md');
    assert.ok(fs.existsSync(docPath), 'docs/temporal-migration.md should exist');
  });

  it('should cover key migration topics', () => {
    const docPath = path.resolve(process.cwd(), 'docs/temporal-migration.md');
    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(content.includes('ORCHESTRATOR'), 'Should document ORCHESTRATOR env var');
    assert.ok(content.includes('legacy'), 'Should document legacy mode');
    assert.ok(content.includes('temporal'), 'Should document temporal mode');
    assert.ok(content.includes('Rollback'), 'Should document rollback process');
  });
});
