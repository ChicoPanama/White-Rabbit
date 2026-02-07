/**
 * Tests for the multi-agent architecture.
 * Uses Node.js built-in test runner (node:test + node:assert).
 *
 * Run with: npx tsx --test src/tests/agents.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Agent Registry Tests ───

describe('AgentRegistry', () => {
  it('should have no duplicate agent IDs', async () => {
    const { getAgentRegistry } = await import('../agents/agent-registry.js');
    const agents = getAgentRegistry();
    const ids = agents.map(a => a.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, `Duplicate IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });

  it('should have at least 18 agents', async () => {
    const { getAgentRegistry } = await import('../agents/agent-registry.js');
    const agents = getAgentRegistry();
    assert.ok(agents.length >= 18, `Expected at least 18 agents, got ${agents.length}`);
  });

  it('should have agents for all 5 phases', async () => {
    const { getAgentsByPhase } = await import('../agents/agent-registry.js');
    const phases = ['discovery', 'static-analysis', 'vulnerability-hypothesis', 'verification', 'report'] as const;
    for (const phase of phases) {
      const agents = getAgentsByPhase(phase);
      assert.ok(agents.length > 0, `Phase ${phase} should have at least one agent`);
    }
  });

  it('should have valid agent definitions', async () => {
    const { getAgentRegistry } = await import('../agents/agent-registry.js');
    const agents = getAgentRegistry();
    for (const agent of agents) {
      assert.ok(agent.id, `Agent must have an ID`);
      assert.ok(agent.name, `Agent ${agent.id} must have a name`);
      assert.ok(agent.phase, `Agent ${agent.id} must have a phase`);
      assert.ok(agent.parallelGroup, `Agent ${agent.id} must have a parallelGroup`);
      assert.ok(agent.promptTemplate, `Agent ${agent.id} must have a promptTemplate`);
      assert.ok(Array.isArray(agent.outputDeliverables), `Agent ${agent.id} must have outputDeliverables array`);
      assert.ok(agent.outputDeliverables.length > 0, `Agent ${agent.id} must produce at least one deliverable`);
      assert.ok(agent.maxTurns > 0, `Agent ${agent.id} maxTurns must be positive`);
      assert.ok(agent.timeoutMinutes > 0, `Agent ${agent.id} timeoutMinutes must be positive`);
      assert.ok(typeof agent.priority === 'number', `Agent ${agent.id} must have a numeric priority`);
    }
  });

  it('should look up agents by ID', async () => {
    const { getAgentById } = await import('../agents/agent-registry.js');
    const agent = getAgentById('vuln-reentrancy');
    assert.equal(agent.id, 'vuln-reentrancy');
    assert.equal(agent.name, 'Reentrancy Scanner');
    assert.equal(agent.phase, 'vulnerability-hypothesis');
  });

  it('should throw for unknown agent ID', async () => {
    const { getAgentById } = await import('../agents/agent-registry.js');
    assert.throws(
      () => getAgentById('nonexistent-agent'),
      /Agent not found/,
    );
  });

  it('should filter agents by config enabled_vuln_types', async () => {
    const { getEnabledAgents } = await import('../agents/agent-registry.js');
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const config = loadScanConfig();
    // Override enabled vuln types to just reentrancy and oracle
    config.scanner.enabled_vuln_types = ['reentrancy', 'oracle'];

    const enabled = getEnabledAgents(config);

    // Should include all discovery, static, and report agents
    assert.ok(enabled.some(a => a.id === 'discovery-source'), 'Should include discovery-source');
    assert.ok(enabled.some(a => a.id === 'static-slither'), 'Should include static-slither');
    assert.ok(enabled.some(a => a.id === 'report-immunefi'), 'Should include report-immunefi');

    // Should include only reentrancy and oracle vuln agents
    assert.ok(enabled.some(a => a.id === 'vuln-reentrancy'), 'Should include vuln-reentrancy');
    assert.ok(enabled.some(a => a.id === 'vuln-oracle'), 'Should include vuln-oracle');
    assert.ok(!enabled.some(a => a.id === 'vuln-arithmetic'), 'Should NOT include vuln-arithmetic');
    assert.ok(!enabled.some(a => a.id === 'vuln-flash-loan'), 'Should NOT include vuln-flash-loan');

    // Should include only reentrancy and oracle verify agents
    assert.ok(enabled.some(a => a.id === 'verify-reentrancy'), 'Should include verify-reentrancy');
    assert.ok(enabled.some(a => a.id === 'verify-oracle'), 'Should include verify-oracle');
    assert.ok(!enabled.some(a => a.id === 'verify-arithmetic'), 'Should NOT include verify-arithmetic');
  });

  it('should include all vuln agents when enabled_vuln_types is empty', async () => {
    const { getEnabledAgents } = await import('../agents/agent-registry.js');
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const config = loadScanConfig();
    config.scanner.enabled_vuln_types = [];

    const enabled = getEnabledAgents(config);
    assert.ok(enabled.some(a => a.id === 'vuln-arithmetic'), 'Should include vuln-arithmetic when no filter');
    assert.ok(enabled.some(a => a.id === 'vuln-reentrancy'), 'Should include vuln-reentrancy when no filter');
    assert.ok(enabled.some(a => a.id === 'vuln-logic'), 'Should include vuln-logic when no filter');
  });
});

// ─── Session Manager Tests ───

describe('SessionManager', () => {
  it('should create an execution plan', async () => {
    const { createExecutionPlan } = await import('../agents/session-manager.js');
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const config = loadScanConfig();
    const plan = createExecutionPlan({ sessionId: 'test-plan-1' }, config);

    assert.ok(plan.sessionId === 'test-plan-1');
    assert.ok(plan.totalAgents > 0, 'Plan should have agents');
    assert.ok(plan.phases.length === 5, 'Plan should have 5 phases');
    assert.ok(plan.estimatedDuration > 0, 'Plan should have estimated duration');
  });

  it('should respect max_concurrent_scans from config', async () => {
    const { createExecutionPlan } = await import('../agents/session-manager.js');
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const config = loadScanConfig();
    config.scanner.max_concurrent_scans = 2;

    const plan = createExecutionPlan({ sessionId: 'test-concurrency' }, config);

    for (const phase of plan.phases) {
      for (const group of phase.parallelGroups) {
        assert.ok(
          group.maxConcurrency <= 2,
          `Group ${group.groupId} maxConcurrency (${group.maxConcurrency}) should be <= 2`,
        );
      }
    }
  });

  it('should sort agents by priority within parallel groups', async () => {
    const { createExecutionPlan } = await import('../agents/session-manager.js');
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const config = loadScanConfig();
    const plan = createExecutionPlan({ sessionId: 'test-priority' }, config);

    for (const phase of plan.phases) {
      for (const group of phase.parallelGroups) {
        for (let i = 1; i < group.agents.length; i++) {
          assert.ok(
            group.agents[i].priority >= group.agents[i - 1].priority,
            `Agent ${group.agents[i].id} (priority ${group.agents[i].priority}) should come after ${group.agents[i - 1].id} (priority ${group.agents[i - 1].priority})`,
          );
        }
      }
    }
  });

  it('should correctly determine agents to skip', async () => {
    const { shouldSkipAgent } = await import('../agents/session-manager.js');
    const { getAgentById } = await import('../agents/agent-registry.js');

    const verifyAgent = getAgentById('verify-arithmetic');
    const reportAgent = getAgentById('report-immunefi');

    // Verification should skip when hypothesis found no findings
    const noFindingsResult = {
      agentId: 'vuln-arithmetic',
      status: 'success' as const,
      findings: [],
      deliverables: [],
      duration: 100,
      tokensUsed: 0,
      errors: [],
      metadata: {},
    };

    assert.equal(
      shouldSkipAgent(verifyAgent, [noFindingsResult]),
      true,
      'Should skip verification when hypothesis has no findings',
    );

    // Verification should NOT skip when hypothesis found findings
    const withFindingsResult = {
      agentId: 'vuln-arithmetic',
      status: 'success' as const,
      findings: [{
        id: '1', agentId: 'vuln-arithmetic', vulnType: 'arithmetic',
        severity: 'high' as const, title: 'test', description: 'test',
        location: '', verified: false,
      }],
      deliverables: [],
      duration: 100,
      tokensUsed: 0,
      errors: [],
      metadata: {},
    };

    assert.equal(
      shouldSkipAgent(verifyAgent, [withFindingsResult]),
      false,
      'Should NOT skip verification when hypothesis has findings',
    );

    // Report agent never skips
    assert.equal(
      shouldSkipAgent(reportAgent, [noFindingsResult]),
      false,
      'Report agent should never skip',
    );
  });

  it('should respect agent dependencies (required deliverables)', async () => {
    const { getNextAgents, createExecutionPlan } = await import('../agents/session-manager.js');
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const config = loadScanConfig();
    const plan = createExecutionPlan({ sessionId: 'test-deps' }, config);

    // With no completed agents, only discovery agents should be ready
    const firstReady = getNextAgents(plan, new Set(), []);
    const firstReadyIds = firstReady.map(a => a.id);
    assert.ok(firstReadyIds.includes('discovery-source'), 'discovery-source should be ready first');
    assert.ok(firstReadyIds.includes('discovery-metadata'), 'discovery-metadata should be ready first');
    assert.ok(!firstReadyIds.includes('static-slither'), 'static-slither should NOT be ready without discovery');
    assert.ok(!firstReadyIds.includes('vuln-arithmetic'), 'vuln-arithmetic should NOT be ready without static');
  });
});

// ─── Agent Executor Tests ───

describe('AgentExecutor', () => {
  it('should handle DRY_RUN mode', async () => {
    const { executeAgent } = await import('../agents/agent-executor.js');
    const { getAgentById } = await import('../agents/agent-registry.js');
    const { loadScanConfig } = await import('../config-parser.js');
    const { createSession } = await import('../deliverables-manager.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const sessionId = createSession();
    const config = loadScanConfig();
    const agent = getAgentById('discovery-source');

    const result = await executeAgent({
      sessionId,
      config,
      agent,
      inputDeliverables: {},
      dryRun: true,
    });

    assert.ok(result.agentId === 'discovery-source');
    assert.ok(['success', 'skipped'].includes(result.status), `Status should be success or skipped, got ${result.status}`);
    assert.ok(result.duration >= 0);
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.deliverables));

    // Cleanup
    const { getSessionDir } = await import('../deliverables-manager.js');
    fs.rmSync(getSessionDir(sessionId), { recursive: true, force: true });
  });

  it('should report available tools', async () => {
    const { getAvailableTools } = await import('../agents/agent-executor.js');
    const available = getAvailableTools();
    assert.ok(Array.isArray(available), 'Should return array');
    // Etherscan depends on ETHERSCAN_API_KEY
    // Slither/Foundry depend on CLI availability
  });
});

// ─── Findings Consolidator Tests ───

describe('FindingsConsolidator', () => {
  it('should deduplicate findings by location', async () => {
    const { consolidateFindings } = await import('../agents/findings-consolidator.js');

    const results = [
      {
        agentId: 'vuln-reentrancy',
        status: 'success' as const,
        findings: [{
          id: '1', agentId: 'vuln-reentrancy', vulnType: 'reentrancy',
          severity: 'high' as const, title: 'Reentrancy in withdraw',
          description: 'Found reentrancy', location: 'Vault:withdraw:42',
          verified: false,
        }],
        deliverables: [], duration: 100, tokensUsed: 0, errors: [], metadata: {},
      },
      {
        agentId: 'vuln-logic',
        status: 'success' as const,
        findings: [{
          id: '2', agentId: 'vuln-logic', vulnType: 'logic',
          severity: 'critical' as const, title: 'Critical withdraw bug',
          description: 'State not updated before call', location: 'Vault:withdraw:42',
          verified: false,
        }],
        deliverables: [], duration: 100, tokensUsed: 0, errors: [], metadata: {},
      },
    ];

    const consolidated = consolidateFindings(results);

    // Should deduplicate — same location
    assert.equal(consolidated.length, 1, 'Should deduplicate to 1 finding');
    // Should keep the higher severity (critical > high)
    assert.equal(consolidated[0].severity, 'critical', 'Should keep critical severity');
    // Should include corroborating evidence
    assert.ok(consolidated[0].description.includes('Corroborated'), 'Should include corroborating evidence');
  });

  it('should not deduplicate findings with different locations', async () => {
    const { consolidateFindings } = await import('../agents/findings-consolidator.js');

    const results = [
      {
        agentId: 'vuln-reentrancy',
        status: 'success' as const,
        findings: [
          {
            id: '1', agentId: 'vuln-reentrancy', vulnType: 'reentrancy',
            severity: 'high' as const, title: 'Reentrancy A',
            description: 'Found reentrancy in A', location: 'Vault:withdraw:42',
            verified: false,
          },
          {
            id: '2', agentId: 'vuln-reentrancy', vulnType: 'reentrancy',
            severity: 'medium' as const, title: 'Reentrancy B',
            description: 'Found reentrancy in B', location: 'Vault:deposit:100',
            verified: false,
          },
        ],
        deliverables: [], duration: 100, tokensUsed: 0, errors: [], metadata: {},
      },
    ];

    const consolidated = consolidateFindings(results);
    assert.equal(consolidated.length, 2, 'Should keep both findings with different locations');
  });

  it('should sort by severity (critical first)', async () => {
    const { consolidateFindings } = await import('../agents/findings-consolidator.js');

    const results = [
      {
        agentId: 'vuln-logic',
        status: 'success' as const,
        findings: [
          { id: '1', agentId: 'a', vulnType: 'logic', severity: 'low' as const, title: 'Low', description: '', location: 'A:a:1', verified: false },
          { id: '2', agentId: 'a', vulnType: 'logic', severity: 'critical' as const, title: 'Critical', description: '', location: 'B:b:2', verified: false },
          { id: '3', agentId: 'a', vulnType: 'logic', severity: 'high' as const, title: 'High', description: '', location: 'C:c:3', verified: false },
        ],
        deliverables: [], duration: 100, tokensUsed: 0, errors: [], metadata: {},
      },
    ];

    const consolidated = consolidateFindings(results);
    assert.equal(consolidated[0].severity, 'critical');
    assert.equal(consolidated[1].severity, 'high');
    assert.equal(consolidated[2].severity, 'low');
  });

  it('should filter findings by severity config', async () => {
    const { filterFindings } = await import('../agents/findings-consolidator.js');
    const { loadScanConfig } = await import('../config-parser.js');

    if (!process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    }

    const config = loadScanConfig();
    config.reporting.min_severity = 'high';

    const findings = [
      { id: '1', agentId: 'a', vulnType: 'logic', severity: 'critical' as const, title: 'C', description: '', location: '', verified: false },
      { id: '2', agentId: 'a', vulnType: 'logic', severity: 'high' as const, title: 'H', description: '', location: '', verified: false },
      { id: '3', agentId: 'a', vulnType: 'logic', severity: 'medium' as const, title: 'M', description: '', location: '', verified: false },
      { id: '4', agentId: 'a', vulnType: 'logic', severity: 'low' as const, title: 'L', description: '', location: '', verified: false },
    ];

    const filtered = filterFindings(findings, config);
    assert.equal(filtered.length, 2, 'Should keep only critical and high');
    assert.ok(filtered.every(f => f.severity === 'critical' || f.severity === 'high'));
  });

  it('should generate findings summary', async () => {
    const { generateFindingsSummary } = await import('../agents/findings-consolidator.js');

    const findings = [
      { id: '1', agentId: 'a', vulnType: 'reentrancy', severity: 'critical' as const, title: 'C', description: '', location: '', verified: true },
      { id: '2', agentId: 'a', vulnType: 'arithmetic', severity: 'high' as const, title: 'H', description: '', location: '', verified: false },
      { id: '3', agentId: 'a', vulnType: 'reentrancy', severity: 'medium' as const, title: 'M', description: '', location: '', verified: false },
    ];

    const summary = generateFindingsSummary(findings);
    assert.ok(summary.includes('Total: 3'), 'Should show total count');
    assert.ok(summary.includes('CRITICAL: 1'), 'Should show critical count');
    assert.ok(summary.includes('reentrancy: 2'), 'Should show reentrancy count');
    assert.ok(summary.includes('Verified: 1'), 'Should show verified count');
  });

  it('should handle empty findings', async () => {
    const { generateFindingsSummary } = await import('../agents/findings-consolidator.js');
    const summary = generateFindingsSummary([]);
    assert.ok(summary.includes('No findings'), 'Should handle empty findings');
  });
});

// ─── Agent Logger Tests ───

describe('AgentLogger', () => {
  let testSessionId: string;

  before(async () => {
    const { createSession } = await import('../deliverables-manager.js');
    testSessionId = createSession();
  });

  after(async () => {
    const { getSessionDir } = await import('../deliverables-manager.js');
    fs.rmSync(getSessionDir(testSessionId), { recursive: true, force: true });
  });

  it('should build session metrics', async () => {
    const { buildSessionMetrics } = await import('../agents/agent-logger.js');

    const results = [
      {
        agentId: 'discovery-source', status: 'success' as const,
        findings: [], deliverables: ['d/contract-source.json'],
        duration: 1000, tokensUsed: 0, errors: [], metadata: {},
      },
      {
        agentId: 'vuln-reentrancy', status: 'success' as const,
        findings: [{ id: '1', agentId: 'vuln-reentrancy', vulnType: 'reentrancy', severity: 'high' as const, title: 'test', description: '', location: '', verified: false }],
        deliverables: ['vh/vuln-reentrancy-report.json'],
        duration: 5000, tokensUsed: 500, errors: [], metadata: {},
      },
      {
        agentId: 'vuln-arithmetic', status: 'failed' as const,
        findings: [], deliverables: [],
        duration: 2000, tokensUsed: 100, errors: ['AI timeout'], metadata: {},
      },
    ];

    const start = new Date(Date.now() - 10000);
    const end = new Date();
    const metrics = buildSessionMetrics(testSessionId, start, end, results);

    assert.equal(metrics.agentsRun, 3);
    assert.equal(metrics.agentsSucceeded, 2);
    assert.equal(metrics.agentsFailed, 1);
    assert.equal(metrics.totalFindings, 1);
    assert.equal(metrics.totalTokensUsed, 600);
    assert.ok(metrics.phases['discovery'], 'Should have discovery phase');
    assert.ok(metrics.phases['vulnerability-hypothesis'], 'Should have vuln-hypothesis phase');
  });

  it('should write execution plan to session directory', async () => {
    const { logExecutionPlan } = await import('../agents/agent-logger.js');
    const { getSessionDir } = await import('../deliverables-manager.js');

    const mockPlan = {
      sessionId: testSessionId,
      totalAgents: 5,
      estimatedDuration: 30,
      phases: [{
        phase: 'discovery' as const,
        parallelGroups: [{
          groupId: 'discovery',
          agents: [{ id: 'discovery-source', name: 'Source Fetcher', phase: 'discovery' as const, parallelGroup: 'discovery', promptTemplate: 'recon-contract', requiredDeliverables: [], outputDeliverables: ['contract-source.json'], maxTurns: 5, timeoutMinutes: 5, retryable: true, maxRetries: 3, tools: ['etherscan'], enabled: true, priority: 1 }],
          maxConcurrency: 2,
        }],
      }],
    };

    logExecutionPlan(testSessionId, mockPlan);

    const filePath = path.join(getSessionDir(testSessionId), '_execution-plan.json');
    assert.ok(fs.existsSync(filePath), 'Should write _execution-plan.json');

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(content.totalAgents, 5);
  });

  it('should write agent execution log', async () => {
    const { logAgentExecution } = await import('../agents/agent-logger.js');
    const { getSessionDir } = await import('../deliverables-manager.js');

    logAgentExecution(testSessionId, {
      agentId: 'vuln-test',
      status: 'success',
      findings: [],
      deliverables: [],
      duration: 1234,
      tokensUsed: 100,
      errors: [],
      metadata: { test: true },
    });

    const filePath = path.join(getSessionDir(testSessionId), '_agent-vuln-test.log');
    assert.ok(fs.existsSync(filePath), 'Should write _agent-vuln-test.log');

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(content.agentId, 'vuln-test');
    assert.equal(content.duration, 1234);
  });
});

// ─── Agent Types Tests ───

describe('AgentTypes', () => {
  it('should define all required interfaces', async () => {
    // Type-level test: ensure imports work and types are compatible
    const types = await import('../agents/agent-types.js');
    // Verify we can construct valid objects
    const finding: import('../agents/agent-types.js').Finding = {
      id: '1', agentId: 'test', vulnType: 'reentrancy',
      severity: 'high', title: 'Test', description: 'Test finding',
      location: 'Contract:fn:42', verified: false,
    };
    assert.equal(finding.severity, 'high');

    const result: import('../agents/agent-types.js').AgentResult = {
      agentId: 'test', status: 'success', findings: [finding],
      deliverables: [], duration: 100, tokensUsed: 0, errors: [], metadata: {},
    };
    assert.equal(result.status, 'success');
    assert.equal(result.findings.length, 1);
  });
});
