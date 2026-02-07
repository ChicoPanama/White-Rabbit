/**
 * Smoke tests for the new Shannon-inspired modules.
 * Uses Node.js built-in test runner (node:test + node:assert).
 *
 * Run with: npx tsx src/tests/smoke.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Prompt Manager Tests ───

describe('PromptManager', () => {
  it('should load a prompt template and substitute variables', async () => {
    const { loadPrompt, clearTemplateCache } = await import('../prompt-manager.js');
    clearTemplateCache();

    const prompt = loadPrompt('vuln-arithmetic', {
      CONTRACT_SOURCE: 'pragma solidity ^0.8.19; contract Test {}',
      SOLIDITY_VERSION: '0.8.19',
      SLITHER_OUTPUT: '[]',
    });

    assert.ok(prompt.length > 0, 'Prompt should not be empty');
    assert.ok(prompt.includes('pragma solidity ^0.8.19'), 'Should substitute CONTRACT_SOURCE');
    assert.ok(prompt.includes('0.8.19'), 'Should substitute SOLIDITY_VERSION');
    assert.ok(!prompt.includes('{{CONTRACT_SOURCE}}'), 'Should not contain unresolved CONTRACT_SOURCE');
    assert.ok(!prompt.includes('{{SLITHER_OUTPUT}}'), 'Should not contain unresolved SLITHER_OUTPUT');
  });

  it('should expand shared partials', async () => {
    const { loadPrompt, clearTemplateCache } = await import('../prompt-manager.js');
    clearTemplateCache();

    const prompt = loadPrompt('vuln-oracle', {
      CONTRACT_SOURCE: 'contract Oracle {}',
      ORACLE_DEPENDENCIES: 'Chainlink ETH/USD',
    });

    // vuln-oracle.txt includes {{>shared/defi-primitives}}
    assert.ok(prompt.includes('Automated Market Maker'), 'Should expand defi-primitives partial');
    assert.ok(!prompt.includes('{{>shared/defi-primitives}}'), 'Partial reference should be replaced');
  });

  it('should list all available templates', async () => {
    const { listTemplates } = await import('../prompt-manager.js');
    const templates = listTemplates();

    assert.ok(templates.length >= 9, `Should have at least 9 templates, got ${templates.length}`);
    assert.ok(templates.includes('vuln-arithmetic'), 'Should include vuln-arithmetic');
    assert.ok(templates.includes('vuln-reentrancy'), 'Should include vuln-reentrancy');
    assert.ok(templates.includes('recon-contract'), 'Should include recon-contract');
    assert.ok(templates.includes('report-immunefi'), 'Should include report-immunefi');
  });

  it('should get template variables', async () => {
    const { getTemplateVariables, clearTemplateCache } = await import('../prompt-manager.js');
    clearTemplateCache();

    const vars = getTemplateVariables('vuln-arithmetic');
    assert.ok(vars.includes('CONTRACT_SOURCE'), 'Should list CONTRACT_SOURCE variable');
    assert.ok(vars.includes('SOLIDITY_VERSION'), 'Should list SOLIDITY_VERSION variable');
    assert.ok(vars.includes('SLITHER_OUTPUT'), 'Should list SLITHER_OUTPUT variable');
  });

  it('should throw on missing template', async () => {
    const { loadPrompt, clearTemplateCache } = await import('../prompt-manager.js');
    clearTemplateCache();

    assert.throws(
      () => loadPrompt('nonexistent-template-xyz'),
      /not found/,
      'Should throw for missing template',
    );
  });
});

// ─── Queue Validation Tests ───

describe('QueueValidation', () => {
  const testDir = path.resolve(process.cwd(), 'test-deliverables-temp');

  before(() => {
    // Create test deliverable directory structure
    fs.mkdirSync(path.join(testDir, 'discovery'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'static-analysis'), { recursive: true });
  });

  after(() => {
    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should allow discovery phase (no prerequisites)', async () => {
    const { validatePhasePrerequisites, setDeliverableBaseDir } = await import('../queue-validation.js');
    setDeliverableBaseDir(testDir);

    const result = validatePhasePrerequisites('discovery');
    assert.equal(result.valid, true, 'Discovery phase should have no prerequisites');
    assert.equal(result.missingDeliverables.length, 0);
  });

  it('should block static-analysis when discovery deliverables missing', async () => {
    const { validatePhasePrerequisites, setDeliverableBaseDir } = await import('../queue-validation.js');
    setDeliverableBaseDir(testDir);

    const result = validatePhasePrerequisites('static-analysis');
    assert.equal(result.valid, false, 'Should fail without discovery deliverables');
    assert.ok(result.missingDeliverables.length > 0, 'Should list missing deliverables');
    assert.ok(
      result.missingDeliverables.some(d => d.includes('contract-source')),
      'Should require contract-source.json',
    );
  });

  it('should allow static-analysis when prerequisites exist', async () => {
    const { validatePhasePrerequisites, setDeliverableBaseDir } = await import('../queue-validation.js');
    setDeliverableBaseDir(testDir);

    // Create prerequisite files
    fs.writeFileSync(path.join(testDir, 'discovery', 'contract-source.json'), '{}');
    fs.writeFileSync(path.join(testDir, 'discovery', 'protocol-metadata.json'), '{}');

    const result = validatePhasePrerequisites('static-analysis');
    assert.equal(result.valid, true, 'Should pass with all prerequisites present');
  });

  it('should throw on assertPhaseReady when missing prerequisites', async () => {
    const { assertPhaseReady, setDeliverableBaseDir } = await import('../queue-validation.js');
    setDeliverableBaseDir(testDir);

    // verification requires vulnerability-hypothesis deliverables which don't exist
    assert.throws(
      () => assertPhaseReady('verification'),
      /cannot start/,
      'Should throw with clear error message',
    );
  });

  it('should return pipeline status for all phases', async () => {
    const { getPipelineStatus, setDeliverableBaseDir } = await import('../queue-validation.js');
    setDeliverableBaseDir(testDir);

    const status = getPipelineStatus();
    assert.equal(status.length, 5, 'Should have 5 phases');
    assert.equal(status[0].phase, 'discovery');
    assert.equal(status[0].ready, true, 'Discovery should always be ready');
  });
});

// ─── Deliverables Manager Tests ───

describe('DeliverablesManager', () => {
  let testSessionId: string;

  it('should create a session', async () => {
    const { createSession } = await import('../deliverables-manager.js');
    testSessionId = createSession();
    assert.ok(testSessionId, 'Should return a session ID');
    assert.ok(testSessionId.length > 10, 'Session ID should be a UUID');
  });

  it('should write and read JSON deliverables', async () => {
    const { writeDeliverable, readDeliverable } = await import('../deliverables-manager.js');

    const testData = { foo: 'bar', count: 42 };
    writeDeliverable(testSessionId, 'test-phase', 'test-output.json', testData, 'test-agent');

    const result = readDeliverable(testSessionId, 'test-phase', 'test-output.json');
    assert.ok(result, 'Should read back the deliverable');
    assert.ok(result!.metadata.timestamp, 'Should have timestamp');
    assert.equal(result!.metadata.phase, 'test-phase');
    assert.equal(result!.metadata.agent, 'test-agent');
    assert.deepEqual(result!.data, testData);
  });

  it('should write markdown deliverables with front matter', async () => {
    const { writeDeliverable, readDeliverable, getSessionDir } = await import('../deliverables-manager.js');

    writeDeliverable(testSessionId, 'report', 'test-report.md', '# Test Report\n\nContent here.');

    const filePath = path.join(getSessionDir(testSessionId), 'report', 'test-report.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.startsWith('---'), 'Should have YAML front matter');
    assert.ok(content.includes('# Test Report'), 'Should contain markdown content');
  });

  it('should list deliverables for a session', async () => {
    const { listDeliverables } = await import('../deliverables-manager.js');

    const deliverables = listDeliverables(testSessionId);
    assert.ok(deliverables.length >= 2, 'Should list at least 2 deliverables');
    assert.ok(deliverables.some(d => d.filename === 'test-output.json'));
    assert.ok(deliverables.some(d => d.filename === 'test-report.md'));
  });

  it('should return null for non-existent deliverable', async () => {
    const { readDeliverable } = await import('../deliverables-manager.js');

    const result = readDeliverable(testSessionId, 'fake-phase', 'nonexistent.json');
    assert.equal(result, null);
  });

  after(async () => {
    // Clean up test session
    const { getSessionDir } = await import('../deliverables-manager.js');
    const dir = getSessionDir(testSessionId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── Config Parser Tests ───

describe('ConfigParser', () => {
  it('should fail when AI provider is not configured and no env keys set', async () => {
    const { loadScanConfig } = await import('../config-parser.js');

    // Save and clear relevant env vars
    const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
    const savedOpenRouterKey = process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
      assert.throws(
        () => loadScanConfig(),
        /AI provider is not configured/,
        'Should throw when AI provider is missing',
      );
    } finally {
      // Restore env vars
      if (savedAnthropicKey) process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
      if (savedOpenRouterKey) process.env.OPENROUTER_API_KEY = savedOpenRouterKey;
    }
  });

  it('should load default config when ANTHROPIC_API_KEY is set', async () => {
    const { loadScanConfig } = await import('../config-parser.js');

    // Ensure ANTHROPIC_API_KEY is set (it should be in .env)
    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key-for-validation';
    }

    const config = loadScanConfig();
    assert.ok(config.target, 'Should have target section');
    assert.ok(config.scanner, 'Should have scanner section');
    assert.ok(config.verification, 'Should have verification section');
    assert.ok(config.reporting, 'Should have reporting section');
    assert.ok(config.filtering, 'Should have filtering section');
  });

  it('should load a specific config file', async () => {
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key-for-validation';
    }

    const config = loadScanConfig('configs/example-micro-protocol.yaml');
    assert.equal(config.target.chain, 'base', 'Micro config should target base chain');
    assert.deepEqual(config.target.tvl_range, [10000, 1000000], 'Should have micro TVL range');
  });

  it('should throw for non-existent config file', async () => {
    const { loadScanConfig } = await import('../config-parser.js');

    assert.throws(
      () => loadScanConfig('configs/nonexistent.yaml'),
      /not found/,
      'Should throw for missing config file',
    );
  });

  it('should list available configs', async () => {
    const { listConfigs } = await import('../config-parser.js');

    const configs = listConfigs();
    assert.ok(configs.length >= 2, 'Should have at least 2 config files');
    assert.ok(configs.includes('default-config.yaml'), 'Should include default config');
    assert.ok(configs.includes('example-micro-protocol.yaml'), 'Should include micro protocol example');
  });
});

// ─── DRY_RUN Tests ───

describe('DryRun', () => {
  it('should detect DRY_RUN mode from env', async () => {
    const { isDryRun } = await import('../dry-run.js');

    const saved = process.env.DRY_RUN;
    process.env.DRY_RUN = 'true';
    assert.equal(isDryRun(), true, 'Should be true when DRY_RUN=true');

    process.env.DRY_RUN = '';
    delete process.env.PIPELINE_TESTING;
    assert.equal(isDryRun(), false, 'Should be false when DRY_RUN is unset');

    if (saved) process.env.DRY_RUN = saved;
    else delete process.env.DRY_RUN;
  });

  it('should detect PIPELINE_TESTING mode from env', async () => {
    const { isDryRun } = await import('../dry-run.js');

    const savedDR = process.env.DRY_RUN;
    const savedPT = process.env.PIPELINE_TESTING;
    delete process.env.DRY_RUN;
    process.env.PIPELINE_TESTING = 'true';

    assert.equal(isDryRun(), true, 'Should be true when PIPELINE_TESTING=true');

    if (savedDR) process.env.DRY_RUN = savedDR;
    else delete process.env.DRY_RUN;
    if (savedPT) process.env.PIPELINE_TESTING = savedPT;
    else delete process.env.PIPELINE_TESTING;
  });

  it('should track phase timings', async () => {
    const { phaseStart, phaseEnd, getPhaseTimings, resetTimings } = await import('../dry-run.js');
    resetTimings();

    phaseStart('test-phase');
    // Small delay to get measurable timing
    await new Promise(resolve => setTimeout(resolve, 5));
    phaseEnd();

    const timings = getPhaseTimings();
    assert.equal(timings.length, 1, 'Should have 1 timing entry');
    assert.equal(timings[0].phase, 'test-phase');
    assert.ok(timings[0].durationMs >= 0, 'Duration should be non-negative');
  });

  it('should load fixtures', async () => {
    const { loadFixture, loadJsonFixture } = await import('../dry-run.js');

    const contractFixture = loadJsonFixture<{ name: string }>('sample-contract-source.json');
    assert.ok(contractFixture, 'Should load sample contract fixture');
    assert.equal(contractFixture!.name, 'SampleVault', 'Should have correct contract name');

    const slitherFixture = loadJsonFixture<{ findings: unknown[] }>('sample-slither-output.json');
    assert.ok(slitherFixture, 'Should load sample slither fixture');
    assert.ok(slitherFixture!.findings.length > 0, 'Should have findings');

    const missing = loadFixture('nonexistent-file.json');
    assert.equal(missing, null, 'Should return null for missing fixture');
  });

  it('should stub async calls in dry-run mode', async () => {
    const { dryRunWrap } = await import('../dry-run.js');

    const saved = process.env.DRY_RUN;
    process.env.DRY_RUN = 'true';

    let apiCalled = false;
    const result = await dryRunWrap(
      'test-api-call',
      async () => { apiCalled = true; return 'real-value'; },
      'stub-value',
    );

    assert.equal(result, 'stub-value', 'Should return stub value in dry-run mode');
    assert.equal(apiCalled, false, 'Should NOT call the real function');

    if (saved) process.env.DRY_RUN = saved;
    else delete process.env.DRY_RUN;
  });
});
