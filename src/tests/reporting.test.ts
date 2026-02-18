/**
 * Tests for the Immunefi reporting system.
 * Uses Node.js built-in test runner (node:test + node:assert).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from '../agents/agent-types.js';

// ── Test Helpers ──

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'test-finding-1',
    agentId: 'vuln-reentrancy',
    vulnType: 'reentrancy',
    severity: 'critical',
    title: 'Reentrancy in withdraw()',
    description: 'The withdraw function makes an external call before updating balances, allowing re-entry.',
    location: 'Vault:withdraw:42',
    verified: true,
    poc: 'function testExploit() public { target.withdraw(1 ether); }',
    estimatedImpact: 'Drain all funds from the vault',
    exploitableValue: 500_000,
    ...overrides,
  };
}

// ── Severity Mapper Tests ──

describe('Severity Mapper', () => {
  it('should map reentrancy with funds transfer to Critical', async () => {
    const { mapToImmunefiSeverity } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'reentrancy', verified: true, exploitableValue: 100_000 });
    assert.equal(mapToImmunefiSeverity(finding), 'Critical');
  });

  it('should map DoS vector to Medium or Low', async () => {
    const { mapToImmunefiSeverity } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'dos', severity: 'medium', verified: false, exploitableValue: 0 });
    assert.equal(mapToImmunefiSeverity(finding), 'Medium');
  });

  it('should map low severity to Low', async () => {
    const { mapToImmunefiSeverity } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'logic', severity: 'low', verified: false, exploitableValue: 0 });
    assert.equal(mapToImmunefiSeverity(finding), 'Low');
  });

  it('should escalate high severity reentrancy with high value to Critical', async () => {
    const { mapToImmunefiSeverity } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'reentrancy', severity: 'high', exploitableValue: 150_000 });
    assert.equal(mapToImmunefiSeverity(finding), 'Critical');
  });

  it('should map access control to privilege_escalation', async () => {
    const { mapToVulnCategory } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'access-control', description: 'Missing access control on admin function' });
    assert.equal(mapToVulnCategory(finding), 'privilege_escalation');
  });

  it('should map access control with withdrawal to theft_of_funds', async () => {
    const { mapToVulnCategory } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'access-control', description: 'Anyone can call withdraw() to drain funds' });
    assert.equal(mapToVulnCategory(finding), 'theft_of_funds');
  });

  it('should map reentrancy to theft_of_funds', async () => {
    const { mapToVulnCategory } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'reentrancy' });
    assert.equal(mapToVulnCategory(finding), 'theft_of_funds');
  });

  it('should map flash-loan to theft_of_funds', async () => {
    const { mapToVulnCategory } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'flash-loan' });
    assert.equal(mapToVulnCategory(finding), 'theft_of_funds');
  });

  it('should map dos to denial_of_service', async () => {
    const { mapToVulnCategory } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'dos' });
    assert.equal(mapToVulnCategory(finding), 'denial_of_service');
  });

  it('should map logic with drain to theft_of_funds', async () => {
    const { mapToVulnCategory } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'logic', description: 'Logic error allows attacker to drain pool funds' });
    assert.equal(mapToVulnCategory(finding), 'theft_of_funds');
  });

  it('should map governance to manipulation_of_governance', async () => {
    const { mapToVulnCategory } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'governance' });
    assert.equal(mapToVulnCategory(finding), 'manipulation_of_governance');
  });
});

describe('Exploitable Value Estimation', () => {
  it('should use existing exploitableValue if present', async () => {
    const { estimateExploitableValue } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ exploitableValue: 100_000 });
    assert.equal(estimateExploitableValue(finding), 100_000);
  });

  it('should estimate conservatively from TVL', async () => {
    const { estimateExploitableValue } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'reentrancy', exploitableValue: undefined });
    const value = estimateExploitableValue(finding, { tvl: 1_000_000 });
    // reentrancy factor 0.8, then 50% conservative → 400_000
    assert.ok(value > 0, 'Should produce a positive estimate');
    assert.ok(value <= 1_000_000, 'Should not exceed TVL');
  });

  it('should return 0 when no TVL available', async () => {
    const { estimateExploitableValue } = await import('../reporting/severity-mapper.js');
    const finding = makeFinding({ vulnType: 'reentrancy', exploitableValue: undefined });
    assert.equal(estimateExploitableValue(finding), 0);
  });
});

describe('CWE Mapping', () => {
  it('should map reentrancy to CWE-841', async () => {
    const { mapCWE } = await import('../reporting/severity-mapper.js');
    assert.equal(mapCWE('reentrancy'), 'CWE-841');
  });

  it('should map arithmetic to CWE-190', async () => {
    const { mapCWE } = await import('../reporting/severity-mapper.js');
    assert.equal(mapCWE('arithmetic'), 'CWE-190');
  });

  it('should map access-control to CWE-284', async () => {
    const { mapCWE } = await import('../reporting/severity-mapper.js');
    assert.equal(mapCWE('access-control'), 'CWE-284');
  });

  it('should map oracle to CWE-20', async () => {
    const { mapCWE } = await import('../reporting/severity-mapper.js');
    assert.equal(mapCWE('oracle'), 'CWE-20');
  });

  it('should map flash-loan to CWE-362', async () => {
    const { mapCWE } = await import('../reporting/severity-mapper.js');
    assert.equal(mapCWE('flash-loan'), 'CWE-362');
  });

  it('should map logic to CWE-840', async () => {
    const { mapCWE } = await import('../reporting/severity-mapper.js');
    assert.equal(mapCWE('logic'), 'CWE-840');
  });

  it('should return undefined for unknown vuln type', async () => {
    const { mapCWE } = await import('../reporting/severity-mapper.js');
    assert.equal(mapCWE('totally-unknown-type'), undefined);
  });
});

// ── PoC Formatter Tests ──

describe('PoC Formatter', () => {
  it('should generate valid exploit steps from Foundry test', async () => {
    const { generateExploitSteps } = await import('../reporting/poc-formatter.js');
    const finding = makeFinding();
    const foundryTest = [
      'function testExploit() public {',
      '    // Step 1: Deploy attacker contract',
      '    Attacker attacker = new Attacker(address(vault));',
      '    // Step 2: Trigger reentrancy',
      '    attacker.attack();',
      '    // Step 3: Verify funds drained',
      '    assertGt(address(attacker).balance, 0);',
      '}',
    ].join('\n');

    const steps = generateExploitSteps(finding, foundryTest);
    assert.ok(steps.length >= 2, `Should have at least 2 steps, got ${steps.length}`);
    assert.equal(steps[0].stepNumber, 1);
    assert.ok(steps[0].description.length > 0);
  });

  it('should generate description-based steps when no Foundry test', async () => {
    const { generateExploitSteps } = await import('../reporting/poc-formatter.js');
    const finding = makeFinding({ poc: undefined });
    const steps = generateExploitSteps(finding, '');
    assert.ok(steps.length >= 2, 'Should have at least 2 steps');
    assert.ok(steps[0].description.includes('reentrancy'));
  });

  it('should sanitize sensitive data from PoC', async () => {
    const { sanitizePoC } = await import('../reporting/poc-formatter.js');
    const poc = {
      summary: 'Test exploit',
      environment: 'Foundry fork',
      steps: [{
        stepNumber: 1,
        description: 'Use key 0xaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd',
        code: 'vm.startPrank(0xaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd);',
        expectedResult: 'Done',
      }],
      verifiedOnFork: true,
      forkRpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/mySecretKey123456789',
    };

    const sanitized = sanitizePoC(poc);
    assert.ok(!sanitized.steps[0].description.includes('aabbccdd'), 'Should redact private key from description');
    assert.ok(!sanitized.steps[0].code?.includes('aabbccdd'), 'Should redact private key from code');
    assert.equal(sanitized.forkRpcUrl, undefined, 'Should remove private RPC URL');
  });

  it('should format Foundry PoC from verification result', async () => {
    const { formatFoundryPoC } = await import('../reporting/poc-formatter.js');
    const finding = makeFinding();
    const verResult = {
      success: true,
      foundryTest: 'function testExploit() public {\n// Attack\nvault.withdraw(1 ether);\n}',
      testOutput: 'Test passed',
      forkBlockNumber: 18_500_000,
    };

    const poc = formatFoundryPoC(verResult, finding);
    assert.equal(poc.verifiedOnFork, true);
    assert.equal(poc.forkBlockNumber, 18_500_000);
    assert.ok(poc.environment.includes('18500000'));
    assert.ok(poc.foundryTest);
  });
});

// ── Report Generator Tests ──

describe('Report Generator', () => {
  it('should render valid markdown with all fields', async () => {
    const { generateImmunefiReport, renderMarkdown } = await import('../reporting/report-generator.js');
    const findings = [
      makeFinding(),
      makeFinding({
        id: 'test-finding-2',
        vulnType: 'access-control',
        severity: 'high',
        title: 'Missing access control on pause()',
        description: 'Any address can call pause() to freeze the contract.',
        location: 'Vault:pause:88',
        verified: false,
        exploitableValue: 10_000,
      }),
    ];

    const report = generateImmunefiReport({
      sessionId: 'test-session',
      protocolName: 'TestProtocol',
      chain: 'ethereum',
      contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
      findings,
    });

    const markdown = renderMarkdown(report);

    assert.ok(markdown.includes('# Security Assessment: TestProtocol'));
    assert.ok(markdown.includes('White-Rabbit'));
    assert.ok(markdown.includes('Ethereum'));
    assert.ok(markdown.includes('Finding #1'));
    assert.ok(markdown.includes('Finding #2'));
    assert.ok(markdown.includes('Reentrancy'));
    assert.ok(markdown.includes('0x1234567890abcdef1234567890abcdef12345678'));
  });

  it('should render valid JSON output', async () => {
    const { generateImmunefiReport, renderJSON } = await import('../reporting/report-generator.js');
    const findings = [makeFinding()];

    const report = generateImmunefiReport({
      sessionId: 'test-session',
      protocolName: 'TestProtocol',
      chain: 'ethereum',
      contractAddress: '0x1234',
      findings,
    });

    const json = renderJSON(report);
    const parsed = JSON.parse(json);

    assert.equal(parsed.protocolName, 'TestProtocol');
    assert.equal(parsed.submissions.length, 1);
    assert.ok(parsed.generatedAt);
  });

  it('should render per-finding reports', async () => {
    const { generateImmunefiReport, renderPerFinding } = await import('../reporting/report-generator.js');
    const findings = [
      makeFinding(),
      makeFinding({ id: 'f2', title: 'Second Finding', vulnType: 'arithmetic', severity: 'high' }),
    ];

    const report = generateImmunefiReport({
      sessionId: 'test-session',
      protocolName: 'TestProtocol',
      chain: 'ethereum',
      contractAddress: '0x1234',
      findings,
    });

    const perFinding = renderPerFinding(report);
    assert.equal(perFinding.size, 2);
    assert.ok(perFinding.has('finding-1'));
    assert.ok(perFinding.has('finding-2'));
  });

  it('should handle empty findings', async () => {
    const { generateImmunefiReport, renderMarkdown } = await import('../reporting/report-generator.js');

    const report = generateImmunefiReport({
      sessionId: 'test-session',
      protocolName: 'TestProtocol',
      chain: 'ethereum',
      contractAddress: '0x1234',
      findings: [],
    });

    assert.equal(report.submissions.length, 0);
    assert.ok(report.executiveSummary.includes('No verified'));

    const markdown = renderMarkdown(report);
    assert.ok(markdown.includes('No verified'));
  });

  it('should compute correct severity counts', async () => {
    const { generateImmunefiReport } = await import('../reporting/report-generator.js');
    const findings = [
      makeFinding({ severity: 'critical', exploitableValue: 200_000 }),
      makeFinding({ id: 'f2', severity: 'high', vulnType: 'oracle', exploitableValue: 50_000 }),
      makeFinding({ id: 'f3', severity: 'medium', vulnType: 'dos' }),
    ];

    const report = generateImmunefiReport({
      sessionId: 'test-session',
      protocolName: 'Test',
      chain: 'ethereum',
      contractAddress: '0x1234',
      findings,
    });

    // The exact counts depend on severity mapping logic
    const total = Object.values(report.severityCounts).reduce((a, b) => a + b, 0);
    assert.equal(total, report.submissions.length);
  });
});

// ── Recommendation Engine Tests ──

describe('Recommendation Engine', () => {
  it('should generate correct fix for reentrancy', async () => {
    const { generateRecommendation } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'reentrancy' });
    const rec = generateRecommendation(finding);
    assert.ok(rec.includes('ReentrancyGuard'), 'Should mention ReentrancyGuard');
    assert.ok(rec.includes('checks-effects-interactions'), 'Should mention CEI pattern');
  });

  it('should generate correct fix for arithmetic', async () => {
    const { generateRecommendation } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'arithmetic' });
    const rec = generateRecommendation(finding);
    assert.ok(rec.includes('0.8') || rec.includes('SafeMath'), 'Should mention Solidity 0.8 or SafeMath');
  });

  it('should generate correct fix for access-control', async () => {
    const { generateRecommendation } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'access-control' });
    const rec = generateRecommendation(finding);
    assert.ok(rec.includes('AccessControl') || rec.includes('Ownable'));
  });

  it('should generate correct fix for oracle', async () => {
    const { generateRecommendation } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'oracle' });
    const rec = generateRecommendation(finding);
    assert.ok(rec.includes('TWAP'));
  });

  it('should generate correct fix for flash-loan', async () => {
    const { generateRecommendation } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'flash-loan' });
    const rec = generateRecommendation(finding);
    assert.ok(rec.includes('same-block') || rec.includes('lock period'));
  });

  it('should generate code fix for reentrancy', async () => {
    const { generateCodeFix } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'reentrancy' });
    const code = generateCodeFix(finding);
    assert.ok(code !== undefined, 'Should produce code fix');
    assert.ok(code!.includes('nonReentrant'));
  });

  it('should return undefined code fix for unknown type', async () => {
    const { generateCodeFix } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'totally-unknown-pattern' });
    const code = generateCodeFix(finding);
    assert.equal(code, undefined);
  });

  it('should generate full recommendation with code', async () => {
    const { generateFullRecommendation } = await import('../reporting/recommendation-engine.js');
    const finding = makeFinding({ vulnType: 'reentrancy' });
    const full = generateFullRecommendation(finding);
    assert.ok(full.includes('ReentrancyGuard'));
    assert.ok(full.includes('```solidity'));
  });
});

// ── Submission Checklist Tests ──

describe('Submission Checklist', () => {
  it('should generate valid checklist', async () => {
    const { generateImmunefiReport } = await import('../reporting/report-generator.js');
    const { generateSubmissionChecklist } = await import('../reporting/report-pipeline.js');

    const findings = [makeFinding()];
    const report = generateImmunefiReport({
      sessionId: 'test',
      protocolName: 'Test',
      chain: 'ethereum',
      contractAddress: '0x1234',
      findings,
    });

    const checklist = generateSubmissionChecklist(report, findings);
    assert.ok(checklist.includes('Pre-Submission Checklist'));
    assert.ok(checklist.includes('Finding #1'));
    assert.ok(checklist.includes('[ ]'));
  });

  it('should build structured checklist items', async () => {
    const { buildChecklistItems } = await import('../reporting/report-pipeline.js');
    const finding = makeFinding();
    const items = buildChecklistItems(finding, true);

    assert.equal(items.findingId, finding.id);
    assert.ok(items.checks.length >= 5, 'Should have at least 5 checklist items');
    // PoC check should be checked since finding.verified = true
    const pocCheck = items.checks.find(c => c.label.includes('PoC'));
    assert.ok(pocCheck?.checked, 'PoC check should be true for verified finding');
  });
});

// ── Program Lookup Tests ──

describe('Program Lookup', () => {
  const testProgramsPath = path.resolve(process.cwd(), 'data', 'immunefi-programs.json');
  let originalContent: string | null = null;

  beforeEach(() => {
    // Save original content if exists
    try {
      originalContent = fs.readFileSync(testProgramsPath, 'utf-8');
    } catch {
      originalContent = null;
    }
  });

  it('should match by address and chain', async () => {
    const { lookupProgram, clearProgramCache, saveProgramCache } = await import('../reporting/program-lookup.js');
    clearProgramCache();

    const testPrograms = [
      {
        name: 'TestProtocol',
        slug: 'testprotocol',
        url: 'https://immunefi.com/bug-bounty/testprotocol',
        maxBounty: 100_000,
        assets: [
          { address: '0xaabbccdd11223344aabbccdd11223344aabbccdd', chain: 'ethereum', type: 'smart_contract' as const },
        ],
        launchDate: '2024-01-01',
        updatedDate: '2024-06-01',
      },
    ];
    saveProgramCache(testPrograms);
    clearProgramCache(); // Force reload from disk

    const result = lookupProgram('0xaabbccdd11223344aabbccdd11223344aabbccdd', 'ethereum');
    assert.ok(result !== null, 'Should find the program');
    assert.equal(result!.name, 'TestProtocol');

    // Restore original
    if (originalContent) {
      fs.writeFileSync(testProgramsPath, originalContent, 'utf-8');
    }
    clearProgramCache();
  });

  it('should return null for unmatched address', async () => {
    const { lookupProgram, clearProgramCache } = await import('../reporting/program-lookup.js');
    clearProgramCache();

    const result = lookupProgram('0x0000000000000000000000000000000000000000', 'ethereum');
    assert.equal(result, null);
  });

  it('should validate in-scope correctly', async () => {
    const { validateInScope } = await import('../reporting/program-lookup.js');
    const finding = makeFinding();
    const program = {
      name: 'TestProtocol',
      slug: 'testprotocol',
      url: 'https://immunefi.com/bug-bounty/testprotocol',
      maxBounty: 100_000,
      assets: [
        { address: '0x1234', chain: 'ethereum', type: 'smart_contract' as const },
      ],
      launchDate: '2024-01-01',
      updatedDate: '2024-06-01',
    };

    assert.equal(validateInScope(finding, program, '0x1234', 'ethereum'), true);
    assert.equal(validateInScope(finding, program, '0x5678', 'ethereum'), false);
    assert.equal(validateInScope(finding, program, '0x1234', 'bsc'), false);
  });

  it('should estimate bounty in reasonable range', async () => {
    const { estimateBounty } = await import('../reporting/program-lookup.js');
    const program = {
      name: 'TestProtocol',
      slug: 'testprotocol',
      url: 'https://immunefi.com/bug-bounty/testprotocol',
      maxBounty: 100_000,
      assets: [],
      launchDate: '2024-01-01',
      updatedDate: '2024-06-01',
    };

    const criticalBounty = estimateBounty('Critical', program);
    assert.ok(criticalBounty.includes('$'), 'Should include dollar sign');
    assert.ok(criticalBounty.includes(' - '), 'Should include range');

    const lowBounty = estimateBounty('Low', program);
    assert.ok(lowBounty.includes('$'));
  });
});

// ── Integration Test ──

describe('Report Pipeline Integration', () => {
  it('should generate report from findings end-to-end', async () => {
    const { generateImmunefiReport, renderMarkdown, renderJSON, renderPerFinding } = await import('../reporting/report-generator.js');
    const { mapToImmunefiSeverity, mapToVulnCategory, mapCWE } = await import('../reporting/severity-mapper.js');
    const { generateRecommendation } = await import('../reporting/recommendation-engine.js');

    const finding = makeFinding();

    // Step 1: Map severity
    const severity = mapToImmunefiSeverity(finding);
    assert.ok(['Critical', 'High', 'Medium', 'Low'].includes(severity));

    // Step 2: Map category
    const category = mapToVulnCategory(finding);
    assert.ok(category.length > 0);

    // Step 3: Map CWE
    const cwe = mapCWE(finding.vulnType);
    assert.ok(cwe);

    // Step 4: Generate recommendation
    const rec = generateRecommendation(finding);
    assert.ok(rec.length > 0);

    // Step 5: Generate full report
    const report = generateImmunefiReport({
      sessionId: 'integration-test',
      protocolName: 'IntegrationTest',
      chain: 'ethereum',
      contractAddress: '0x1234',
      findings: [finding],
    });

    assert.equal(report.submissions.length, 1);
    assert.ok(report.executiveSummary.length > 0);

    // Step 6: Render all formats
    const md = renderMarkdown(report);
    assert.ok(md.includes('IntegrationTest'));

    const json = renderJSON(report);
    const parsed = JSON.parse(json);
    assert.equal(parsed.protocolName, 'IntegrationTest');

    const perFinding = renderPerFinding(report);
    assert.equal(perFinding.size, 1);
  });
});
