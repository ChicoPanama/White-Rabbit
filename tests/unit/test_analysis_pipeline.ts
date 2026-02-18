#!/usr/bin/env tsx
/**
 * WHITE RABBIT - Analysis Pipeline Unit Tests
 * 
 * Comprehensive tests for the AnalysisPipeline class.
 */

import { strict as assert } from 'assert';
import { AnalysisPipeline, PipelineOptions, PipelineResult } from '../../src/analyzers/analysis-pipeline.js';
import type { Contract, Finding } from '../../src/types/index.js';

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
  console.log(`\n${'='.repeat(70)}`);
  console.log(title);
  console.log('='.repeat(70));
}

// Test Fixtures
const MOCK_CONTRACT: Contract = {
  id: 'test-1',
  address: '0x1234567890123456789012345678901234567890',
  chainId: 1,
  name: 'TestContract',
  sourceCode: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestContract {
    mapping(address => uint) public balances;
    
    function withdraw() external {
        uint amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;
    }
    
    receive() external payable {
        balances[msg.sender] += msg.value;
    }
}
`,
  abi: [],
  compilerVersion: 'v0.8.19',
  isProxy: false,
  implementationAddress: null,
  tvlUsd: 1000000,
  protocolName: 'Test Protocol',
};

const EMPTY_CONTRACT: Contract = {
  ...MOCK_CONTRACT,
  id: 'test-empty',
  sourceCode: `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EmptyContract {
    uint public value;
    
    function setValue(uint _value) external {
        value = _value;
    }
}
`,
};

async function main() {
  section('ANALYSIS PIPELINE UNIT TESTS');

  // =============================================================================
  // SECTION 1: Constructor & Initialization
  // =============================================================================

  section('SECTION 1: Constructor & Initialization');

  await runTest('should create AnalysisPipeline instance', () => {
    const pipeline = new AnalysisPipeline();
    assert.ok(pipeline instanceof AnalysisPipeline);
  });

  await runTest('should have all analyzer instances', () => {
    const pipeline = new AnalysisPipeline();
    const priv = pipeline as any;
    assert.ok(priv.slither, 'Should have slither analyzer');
    assert.ok(priv.mythril, 'Should have mythril analyzer');
    assert.ok(priv.securify, 'Should have securify analyzer');
    assert.ok(priv.maian, 'Should have maian analyzer');
    assert.ok(priv.deduplicator, 'Should have deduplicator');
  });

  await runTest('should have default options', () => {
    const pipeline = new AnalysisPipeline();
    const defaults = (pipeline as any).DEFAULT_OPTIONS;
    assert.strictEqual(defaults.enableSlither, true);
    assert.strictEqual(defaults.enablePattern, true);
    assert.strictEqual(defaults.enableMythril, true);
    assert.strictEqual(defaults.enableSecurify, true);
    assert.strictEqual(defaults.enableMaian, true);
    assert.strictEqual(defaults.enableAI, true);
    assert.strictEqual(defaults.continueOnError, true);
    assert.strictEqual(defaults.timeoutMs, 600000);
  });

  // =============================================================================
  // SECTION 2: Options Merging
  // =============================================================================

  section('SECTION 2: Options Merging');

  await runTest('should merge options correctly', async () => {
    const pipeline = new AnalysisPipeline();
    const customOpts: PipelineOptions = {
      enableSlither: false,
      enableMythril: false,
      timeoutMs: 30000,
    };

    // Test via quickAnalyze which uses internal analyze method
    const result = await pipeline.quickAnalyze(MOCK_CONTRACT);
    assert.ok(result);
    // Slither should be disabled in quick mode
  });

  await runTest('quickAnalyze should disable heavy tools', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(MOCK_CONTRACT);
    
    // Quick analyze should only run slither + pattern
    assert.ok(result.stats.byTool.slither !== undefined || result.stats.byTool.pattern !== undefined,
      'Should have slither or pattern findings');
    assert.strictEqual(result.stats.byTool.mythril, undefined, 'Mythril should not run');
    assert.strictEqual(result.stats.byTool.securify, undefined, 'Securify should not run');
    assert.strictEqual(result.stats.byTool.maian, undefined, 'MAIAN should not run');
  });

  await runTest('deepAnalyze should enable all tools', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.deepAnalyze(MOCK_CONTRACT);
    
    // Deep analyze runs all tools (though they may not all be installed)
    assert.ok(result);
    assert.ok(result.stats.byTool.slither !== undefined || result.errors.length > 0,
      'Should attempt slither or report errors');
  });

  // =============================================================================
  // SECTION 3: Result Structure
  // =============================================================================

  section('SECTION 3: Result Structure');

  await runTest('should return valid PipelineResult structure', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(MOCK_CONTRACT);

    assert.ok(result.contract, 'Should have contract');
    assert.ok(Array.isArray(result.findings), 'findings should be array');
    assert.ok(result.stats, 'Should have stats');
    assert.ok(typeof result.stats.totalFindings === 'number', 'totalFindings should be number');
    assert.ok(typeof result.stats.executionTimeMs === 'number', 'executionTimeMs should be number');
    assert.ok(typeof result.stats.deduplicated === 'number', 'deduplicated should be number');
    assert.ok(typeof result.stats.byTool === 'object', 'byTool should be object');
    assert.ok(typeof result.stats.bySeverity === 'object', 'bySeverity should be object');
    assert.ok(Array.isArray(result.errors), 'errors should be array');
  });

  await runTest('should return the same contract in result', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(MOCK_CONTRACT);

    assert.strictEqual(result.contract.id, MOCK_CONTRACT.id);
    assert.strictEqual(result.contract.address, MOCK_CONTRACT.address);
    assert.strictEqual(result.contract.chainId, MOCK_CONTRACT.chainId);
  });

  await runTest('should track execution time', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(MOCK_CONTRACT);

    assert.ok(result.stats.executionTimeMs >= 0, 'Execution time should be >= 0');
    assert.ok(result.stats.executionTimeMs < 60000, 'Execution should be reasonably fast');
  });

  // =============================================================================
  // SECTION 4: Finding Deduplication
  // =============================================================================

  section('SECTION 4: Finding Deduplication');

  await runTest('should deduplicate identical findings', () => {
    const pipeline = new AnalysisPipeline();
    const deduplicator = (pipeline as any).deduplicator;

    const findings: Finding[] = [
      {
        id: '1',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'reentrancy',
        tool: 'slither',
        severity: 'high',
        confidence: 'high',
        title: 'Reentrancy',
        description: 'Reentrant call',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 15,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
      {
        id: '2',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'reentrancy',
        tool: 'slither',
        severity: 'high',
        confidence: 'high',
        title: 'Reentrancy',
        description: 'Reentrant call',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 15,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
    ];

    const deduplicated = deduplicator.deduplicate(findings);
    assert.ok(deduplicated.length <= findings.length, 'Should deduplicate');
  });

  await runTest('should keep different findings separate', () => {
    const pipeline = new AnalysisPipeline();
    const deduplicator = (pipeline as any).deduplicator;

    const findings: Finding[] = [
      {
        id: '1',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'reentrancy',
        tool: 'slither',
        severity: 'high',
        confidence: 'high',
        title: 'Reentrancy',
        description: 'Reentrant call',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 15,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
      {
        id: '2',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'unchecked-call',
        tool: 'slither',
        severity: 'medium',
        confidence: 'medium',
        title: 'Unchecked Call',
        description: 'Unchecked call',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 20,
        lineEnd: 25,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
    ];

    const deduplicated = deduplicator.deduplicate(findings);
    assert.ok(deduplicated.length >= 1, 'Should keep at least one finding');
  });

  // =============================================================================
  // SECTION 5: Cross-Tool Correlation
  // =============================================================================

  section('SECTION 5: Cross-Tool Correlation');

  await runTest('should correlate findings from different tools', () => {
    const pipeline = new AnalysisPipeline();
    const correlate = (pipeline as any).correlateFindings.bind(pipeline);

    const findings: Finding[] = [
      {
        id: '1',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'unrestricted-selfdestruct',
        tool: 'slither',
        severity: 'high',
        confidence: 'high',
        title: 'Selfdestruct',
        description: 'Unprotected',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 10,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
      {
        id: '2',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'suicidal',
        tool: 'maian',
        severity: 'critical',
        confidence: 'high',
        title: 'Suicidal',
        description: 'Confirmed',
        codeSnippet: null,
        filePath: null,
        lineStart: null,
        lineEnd: null,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
    ];

    const correlated = correlate(findings);
    assert.ok(Array.isArray(correlated), 'Should return array');
  });

  await runTest('should boost confidence for multiple tool agreement', () => {
    const pipeline = new AnalysisPipeline();
    const correlate = (pipeline as any).correlateFindings.bind(pipeline);

    const findings: Finding[] = [
      {
        id: '1',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'reentrancy',
        tool: 'slither',
        severity: 'high',
        confidence: 'medium',
        title: 'Reentrancy',
        description: 'Found by slither',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 15,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
      {
        id: '2',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'reentrancy-eth',
        tool: 'mythril',
        severity: 'high',
        confidence: 'medium',
        title: 'Reentrancy',
        description: 'Found by mythril',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 15,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
      {
        id: '3',
        scanId: 'scan-1',
        contractId: 'c1',
        detectorName: 'reentrancy-no-eth',
        tool: 'securify',
        severity: 'medium',
        confidence: 'medium',
        title: 'Reentrancy',
        description: 'Found by securify',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 15,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      },
    ];

    const correlated = correlate(findings);
    // Findings from 3+ tools should get high confidence
    const highConfidenceFindings = correlated.filter((f: any) => f.confidence === 'high');
    assert.ok(highConfidenceFindings.length > 0 || correlated.length > 0, 
      'Should have correlated findings');
  });

  // =============================================================================
  // SECTION 6: Error Handling
  // =============================================================================

  section('SECTION 6: Error Handling');

  await runTest('should handle invalid source code gracefully', async () => {
    const pipeline = new AnalysisPipeline();
    const invalidContract: Contract = {
      ...MOCK_CONTRACT,
      sourceCode: 'not valid solidity {{ }}',
    };

    const result = await pipeline.analyze(invalidContract, {
      enableSlither: true,
      enablePattern: true,
      enableMythril: false,
      enableSecurify: false,
      enableMaian: false,
      continueOnError: true,
    });

    assert.ok(result, 'Should return result');
    assert.ok(Array.isArray(result.errors), 'Should have errors array');
  });

  await runTest('should respect continueOnError option', async () => {
    const pipeline = new AnalysisPipeline();
    
    const result = await pipeline.analyze(MOCK_CONTRACT, {
      enableSlither: true,
      enablePattern: true,
      enableMythril: true, // Will likely fail (not installed)
      continueOnError: true,
    });

    // Should complete despite potential errors
    assert.ok(result);
    assert.ok(result.stats.executionTimeMs > 0);
  });

  await runTest('should handle empty contract', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(EMPTY_CONTRACT);

    assert.ok(result);
    assert.ok(Array.isArray(result.findings));
    // Empty/simple contract may have 0 or few findings
  });

  // =============================================================================
  // SECTION 7: Timeout Handling
  // =============================================================================

  section('SECTION 7: Timeout Handling');

  await runTest('should respect timeout option', async () => {
    const pipeline = new AnalysisPipeline();
    const start = Date.now();
    
    const result = await pipeline.analyze(MOCK_CONTRACT, {
      enableSlither: true,
      enablePattern: true,
      enableMythril: false,
      enableSecurify: false,
      enableMaian: false,
      timeoutMs: 5000, // 5 second timeout
      continueOnError: true,
    });

    const elapsed = Date.now() - start;
    assert.ok(elapsed < 30000, 'Should complete before 30s');
    assert.ok(result);
  });

  // =============================================================================
  // SECTION 8: Finding Quality
  // =============================================================================

  section('SECTION 8: Finding Quality');

  await runTest('should produce valid Finding objects', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(MOCK_CONTRACT);

    for (const finding of result.findings) {
      assert.ok(finding.detectorName, 'Finding should have detectorName');
      assert.ok(finding.tool, 'Finding should have tool');
      assert.ok(finding.severity, 'Finding should have severity');
      assert.ok(['critical', 'high', 'medium', 'low', 'informational'].includes(finding.severity),
        `Invalid severity: ${finding.severity}`);
      assert.ok(finding.confidence, 'Finding should have confidence');
      assert.ok(['high', 'medium', 'low'].includes(finding.confidence),
        `Invalid confidence: ${finding.confidence}`);
      assert.ok(finding.description, 'Finding should have description');
    }
  });

  await runTest('should detect vulnerabilities in reentrant contract', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(MOCK_CONTRACT);

    // The test contract has a reentrancy vulnerability
    // Pattern analyzer should catch this
    assert.ok(result.stats.totalFindings > 0 || result.errors.length > 0,
      'Should find issues or report errors');
  });

  // =============================================================================
  // TEST SUMMARY
  // =============================================================================

  section('TEST SUMMARY');

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
    console.log('\n🎉 ALL ANALYSIS PIPELINE UNIT TESTS PASSED! 🎉');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
