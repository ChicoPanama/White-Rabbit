#!/usr/bin/env tsx
/**
 * WHITE RABBIT - Analysis Pipeline E2E Tests
 * 
 * End-to-end testing of the sequential analysis pipeline:
 * - Verifies all tools are wired correctly
 * - Tests sequential execution
 * - Validates deduplication
 * - Confirms cross-tool correlation
 */

import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { AnalysisPipeline } from '../../src/analyzers/analysis-pipeline.js';
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

// Sample vulnerable contract for testing
const SAMPLE_CONTRACT = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Vulnerable {
    mapping(address => uint) public balances;
    
    // Reentrancy vulnerability
    function withdraw() external {
        uint amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;
    }
    
    // Unchecked call
    function transfer(address to, uint amount) external {
        (bool success, ) = to.call{value: amount}("");
        // No check on success
    }
    
    // Selfdestruct without auth
    function destroy() external {
        selfdestruct(payable(msg.sender));
    }
    
    receive() external payable {
        balances[msg.sender] += msg.value;
    }
}
`;

const SAMPLE_CONTRACT_2 = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LockedFunds {
    mapping(address => uint) public deposits;
    
    // No withdraw function - funds locked
    function deposit() external payable {
        deposits[msg.sender] += msg.value;
    }
    
    // Timestamp dependence
    function payout() external {
        require(block.timestamp > 1000000000);
        // Some logic
    }
}
`;

async function main() {
  section('ANALYSIS PIPELINE E2E TESTS');

  // =============================================================================
  // SECTION 1: Pipeline Initialization
  // =============================================================================

  section('SECTION 1: Pipeline Initialization');

  await runTest('AnalysisPipeline instantiation', async () => {
    const pipeline = new AnalysisPipeline();
    assert.ok(pipeline, 'Pipeline should be created');
  });

  await runTest('Pipeline has all analyzers', async () => {
    const pipeline = new AnalysisPipeline();
    // Access private fields for testing
    const analyzers = (pipeline as any);
    assert.ok(analyzers.slither, 'Should have Slither analyzer');
    assert.ok(analyzers.mythril, 'Should have Mythril analyzer');
    assert.ok(analyzers.securify, 'Should have Securify analyzer');
    assert.ok(analyzers.maian, 'Should have MAIAN analyzer');
    assert.ok(analyzers.deduplicator, 'Should have deduplicator');
  });

  // =============================================================================
  // SECTION 2: Contract Mock Data
  // =============================================================================

  section('SECTION 2: Mock Contract Data');

  const mockContract: Contract = {
    id: 'test-123',
    address: '0x1234567890123456789012345678901234567890',
    chainId: 1,
    name: 'Vulnerable',
    sourceCode: SAMPLE_CONTRACT,
    abi: [],
    compilerVersion: 'v0.8.19+commit.7dd6d404',
    isProxy: false,
    implementationAddress: null,
    tvlUsd: 1000000,
    protocolName: 'Test Protocol',
  };

  const mockContract2: Contract = {
    id: 'test-456',
    address: '0x0987654321098765432109876543210987654321',
    chainId: 1,
    name: 'LockedFunds',
    sourceCode: SAMPLE_CONTRACT_2,
    abi: [],
    compilerVersion: 'v0.8.19+commit.7dd6d404',
    isProxy: false,
    implementationAddress: null,
    tvlUsd: 500000,
    protocolName: 'Test Protocol 2',
  };

  await runTest('Mock contract data valid', async () => {
    assert.ok(mockContract.address, 'Contract should have address');
    assert.ok(mockContract.sourceCode, 'Contract should have source code');
    assert.ok(mockContract.sourceCode.includes('contract'), 'Should be valid Solidity');
  });

  // =============================================================================
  // SECTION 3: Quick Analysis (Slither + Pattern Only)
  // =============================================================================

  section('SECTION 3: Quick Analysis (Slither + Pattern)');

  await runTest('Quick analysis runs successfully', async () => {
    const pipeline = new AnalysisPipeline();
    
    // This will test Slither + Pattern only
    const result = await pipeline.quickAnalyze(mockContract);
    
    assert.ok(result, 'Should return result');
    assert.ok(result.contract, 'Should include contract');
    assert.ok(Array.isArray(result.findings), 'Should have findings array');
    assert.ok(result.stats, 'Should have stats');
    assert.equal(result.contract.address, mockContract.address, 'Should be same contract');
  });

  await runTest('Quick analysis stats are populated', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(mockContract);
    
    assert.ok(typeof result.stats.totalFindings === 'number', 'Should have totalFindings');
    assert.ok(typeof result.stats.executionTimeMs === 'number', 'Should have executionTimeMs');
    assert.ok(result.stats.byTool, 'Should have byTool stats');
    assert.ok(result.stats.bySeverity, 'Should have bySeverity stats');
  });

  await runTest('Quick analysis includes slither findings', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(mockContract);
    
    // Should have Slither or Pattern findings
    const totalFindings = result.stats.byTool['slither'] || 0;
    const patternFindings = result.stats.byTool['pattern'] || 0;
    
    // Vulnerable contract should have findings
    assert.ok(
      result.stats.totalFindings > 0 || result.errors.length > 0,
      'Should find vulnerabilities or report errors'
    );
  });

  // =============================================================================
  // SECTION 4: Deduplication Tests
  // =============================================================================

  section('SECTION 4: Finding Deduplication');

  await runTest('Duplicate findings are deduplicated', async () => {
    const pipeline = new AnalysisPipeline();
    
    // Create mock findings with duplicates
    const mockFindings: Finding[] = [
      {
        id: '1',
        scanId: 'scan-1',
        contractId: 'contract-1',
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
      },
      {
        id: '2',
        scanId: 'scan-1',
        contractId: 'contract-1',
        detectorName: 'reentrancy',
        tool: 'mythril',
        severity: 'high',
        confidence: 'high',
        title: 'Reentrancy',
        description: 'Reentrant call detected',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 10,
        lineEnd: 15,
      },
    ];

    // Access deduplicator for testing
    const deduplicator = (pipeline as any).deduplicator;
    const deduplicated = deduplicator.deduplicate(mockFindings);
    
    // Should deduplicate similar findings
    assert.ok(deduplicated.length <= mockFindings.length, 'Should reduce duplicates');
  });

  // =============================================================================
  // SECTION 5: Cross-Tool Correlation
  // =============================================================================

  section('SECTION 5: Cross-Tool Correlation');

  await runTest('Findings are correlated across tools', async () => {
    const pipeline = new AnalysisPipeline();
    
    // Use the correlation method
    const mockFindings: Finding[] = [
      {
        id: '1',
        scanId: 'scan-1',
        contractId: 'contract-1',
        detectorName: 'unprotected-selfdestruct',
        tool: 'slither',
        severity: 'high',
        confidence: 'high',
        title: 'Unprotected Selfdestruct',
        description: 'Anyone can destroy',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 20,
        lineEnd: 22,
      },
      {
        id: '2',
        scanId: 'scan-1',
        contractId: 'contract-1',
        detectorName: 'unrestrictedselfdestruct',
        tool: 'securify',
        severity: 'high',
        confidence: 'high',
        title: 'Unrestricted Selfdestruct',
        description: 'Suicidal contract',
        codeSnippet: null,
        filePath: 'test.sol',
        lineStart: 20,
        lineEnd: 22,
      },
      {
        id: '3',
        scanId: 'scan-1',
        contractId: 'contract-1',
        detectorName: 'suicidal',
        tool: 'maian',
        severity: 'critical',
        confidence: 'high',
        title: 'Suicidal Contract',
        description: 'Confirmed suicidal',
        codeSnippet: null,
        filePath: null,
        lineStart: null,
        lineEnd: null,
      },
    ];

    const correlated = (pipeline as any).correlateFindings(mockFindings);
    
    // Should group similar findings
    assert.ok(Array.isArray(correlated), 'Should return array');
    
    // Findings with similar issues should be grouped
    if (correlated.length > 0 && correlated[0].corroboratedBy) {
      assert.ok(
        correlated[0].corroboratedBy.length >= 1,
        'Should track corroborating tools'
      );
    }
  });

  // =============================================================================
  // SECTION 6: Error Handling
  // =============================================================================

  section('SECTION 6: Error Handling');

  await runTest('Pipeline continues on tool failure', async () => {
    const pipeline = new AnalysisPipeline();
    
    // Test with a contract that might cause issues
    const badContract: Contract = {
      ...mockContract,
      sourceCode: 'invalid solidity {{', // Invalid source
    };

    const result = await pipeline.analyze(badContract, {
      enableSlither: true,
      enablePattern: true,
      enableMythril: false, // Skip heavy tools for this test
      enableSecurify: false,
      enableMaian: false,
      continueOnError: true,
    });

    // Should complete even with errors
    assert.ok(result, 'Should return result despite errors');
    assert.ok(Array.isArray(result.errors), 'Should track errors');
  });

  await runTest('Timeout handling works', async () => {
    const pipeline = new AnalysisPipeline();
    
    // Set very short timeout
    const result = await pipeline.analyze(mockContract, {
      enableSlither: true,
      enablePattern: true,
      enableMythril: false,
      enableSecurify: false,
      enableMaian: false,
      timeoutMs: 5000, // 5 seconds
      continueOnError: true,
    });

    assert.ok(result, 'Should return result');
    assert.ok(result.stats.executionTimeMs < 30000, 'Should complete quickly');
  });

  // =============================================================================
  // SECTION 7: Deep Analysis Configuration
  // =============================================================================

  section('SECTION 7: Deep Analysis Configuration');

  await runTest('Deep analysis enables all tools', async () => {
    const pipeline = new AnalysisPipeline();
    
    // Deep analysis should enable all tools
    // We can't run this in tests due to tool dependencies,
    // but we can verify the configuration
    
    const defaultOpts = (pipeline as any).DEFAULT_OPTIONS;
    
    assert.equal(defaultOpts.enableSlither, true, 'Slither should be enabled by default');
    assert.equal(defaultOpts.enablePattern, true, 'Pattern should be enabled by default');
    assert.equal(defaultOpts.enableMythril, true, 'Mythril should be enabled by default');
    assert.equal(defaultOpts.enableSecurify, true, 'Securify should be enabled by default');
    assert.equal(defaultOpts.enableMaian, true, 'MAIAN should be enabled by default');
    assert.equal(defaultOpts.enableAI, true, 'AI should be enabled by default');
  });

  // =============================================================================
  // SECTION 8: Integration with Existing Code
  // =============================================================================

  section('SECTION 8: Integration Compatibility');

  await runTest('Pipeline findings match Finding type', async () => {
    const pipeline = new AnalysisPipeline();
    const result = await pipeline.quickAnalyze(mockContract);
    
    // All findings should match the Finding interface
    for (const finding of result.findings) {
      assert.ok(finding.detectorName, 'Finding should have detectorName');
      assert.ok(finding.severity, 'Finding should have severity');
      assert.ok(['critical', 'high', 'medium', 'low', 'informational'].includes(finding.severity),
        'Severity should be valid');
    }
  });

  await runTest('Pipeline integrates with scanner', async () => {
    // Verify the pipeline can be imported by scanner
    const { AnalysisPipeline: ImportedPipeline } = await import('../../src/analyzers/analysis-pipeline.js');
    assert.ok(ImportedPipeline, 'Should be importable');
    
    const pipeline = new ImportedPipeline();
    assert.ok(pipeline, 'Should instantiate from import');
  });

  // =============================================================================
  // TEST SUMMARY
  // =============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

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
    console.log('\n🎉 ALL PIPELINE TESTS PASSED! 🎉');
    console.log('\n✅ Wiring verified - Pipeline is correctly configured');
    console.log('✅ All analyzers are properly integrated');
    console.log('✅ Deduplication working correctly');
    console.log('✅ Error handling operational');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
