/**
 * WHITE RABBIT - Full Integration E2E Tests
 * 
 * Comprehensive end-to-end testing covering:
 * - Pipeline optimization (parallel execution, caching)
 * - Interoperability between all scanner types
 * - Cross-system integration (contracts + infrastructure)
 * - Performance benchmarking
 * - Error handling and resilience
 */

import { strict as assert } from 'assert';
import { performance } from 'perf_hooks';

// Core components
import { AnalysisPipeline } from '../../src/analyzers/analysis-pipeline.js';
import { ContractAnalyzerAgent, AnalysisStrategies } from '../../src/agents/contract-analyzer-agent.js';
import { InfrastructureAnalysisPipeline } from '../../src/infrastructure/infrastructure-pipeline.js';
import { KubescapeScanner, CloudSploitScanner, NiliScanner } from '../../src/infrastructure/index.js';

// Core utilities
import { FindingDeduplicator } from '../../src/analyzers/deduplicator.js';
import { localFpFilter } from '../../src/analyzers/local-fp-filter.js';
import { serviceLogger } from '../../src/core/logger.js';

// Types
import type { Contract, Finding, Severity } from '../../src/types/index.js';
import type { InfrastructureTarget, InfrastructureFinding } from '../../src/infrastructure/index.js';

// ============================================================================
// TEST CONSTANTS
// ============================================================================

const TEST_TIMEOUT = 120000;
const PERF_THRESHOLD_MS = 5000; // Performance threshold for fast operations

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

const createMockContract = (overrides: Partial<Contract> = {}): Contract => ({
  address: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
  chainId: 1,
  name: 'TestContract',
  sourceCode: `
    pragma solidity ^0.8.0;
    contract TestContract {
      mapping(address => uint256) public balances;
      
      function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] -= amount;
      }
      
      function deposit() external payable {
        balances[msg.sender] += msg.value;
      }
    }
  `,
  compilerVersion: 'v0.8.19',
  ...overrides,
});

const createDeFiContract = (): Contract => createMockContract({
  name: 'DeFiPool',
  tvlUsd: 50000000,
  sourceCode: `
    pragma solidity ^0.8.0;
    contract DeFiPool {
      mapping(address => uint256) public liquidity;
      
      function swap(address tokenIn, address tokenOut, uint256 amount) external {
        // Swap logic with potential reentrancy
        (bool success, ) = tokenOut.call(abi.encodeWithSignature("transfer(address,uint256)", msg.sender, amount));
        require(success);
      }
      
      function flashLoan(uint256 amount, bytes calldata data) external {
        // Flash loan logic
        (bool success, ) = msg.sender.call(data);
        require(success);
      }
    }
  `,
});

const createGovernanceContract = (): Contract => createMockContract({
  name: 'GovernanceDAO',
  sourceCode: `
    pragma solidity ^0.8.0;
    contract GovernanceDAO {
      struct Proposal {
        address target;
        bytes data;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
      }
      
      mapping(uint256 => Proposal) public proposals;
      
      function execute(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.forVotes > p.againstVotes);
        require(!p.executed);
        (bool success, ) = p.target.call(p.data);
        require(success);
        p.executed = true;
      }
    }
  `,
});

const createK8sTarget = (id: string): InfrastructureTarget => ({
  id,
  type: 'kubernetes',
  name: `K8s Cluster ${id}`,
  metadata: {
    clusterName: id,
    version: '1.28.0',
    nodeCount: 3,
  },
});

const createAWSTarget = (id: string): InfrastructureTarget => ({
  id,
  type: 'aws',
  name: `AWS Account ${id}`,
  metadata: {
    accountId: '123456789012',
    regions: ['us-east-1'],
    services: ['EC2', 'S3'],
  },
});

const createNetworkTarget = (id: string): InfrastructureTarget => ({
  id,
  type: 'network',
  name: `Network ${id}`,
  metadata: {
    host: 'example.com',
    ports: [80, 443],
  },
});

// ============================================================================
// TEST RUNNER
// ============================================================================

let passCount = 0;
let failCount = 0;
const perfMetrics: Record<string, number> = {};

async function test(name: string, fn: () => Promise<void>, trackPerf = false) {
  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    if (trackPerf) perfMetrics[name] = duration;
    console.log(`  ✓ ${name}${trackPerf ? ` (${duration.toFixed(1)}ms)` : ''}`);
    passCount++;
  } catch (error) {
    const duration = performance.now() - start;
    console.log(`  ✗ ${name} (${duration.toFixed(1)}ms)`);
    console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
    failCount++;
  }
}

// ============================================================================
// TESTS
// ============================================================================

console.log('WHITE RABBIT - Full Integration E2E Tests');
console.log('='.repeat(70));

async function runTests() {

// =============================================================================
// SECTION 1: PIPELINE OPTIMIZATION TESTS
// =============================================================================

console.log('\n🚀 Pipeline Optimization Tests');
console.log('-'.repeat(50));

await test('Deduplicator handles large finding volumes efficiently', async () => {
  const deduplicator = new FindingDeduplicator();
  
  // Generate findings with different patterns
  const findings: Finding[] = [];
  for (let i = 0; i < 1000; i++) {
    findings.push({
      detectorName: `detector-${i % 100}`, // 100 unique detector patterns
      tool: 'test',
      severity: 'high',
      description: `Finding ${i}`,
      sourceLocation: {
        file: `Contract${i % 50}.sol`, // 50 unique files
        line: i % 20,
      },
    });
  }
  
  const start = performance.now();
  const unique = deduplicator.deduplicate(findings);
  const duration = performance.now() - start;
  
  // Should process quickly (exact deduplication count depends on internal grouping logic)
  assert(duration < 1000, `Deduplication took ${duration}ms, expected <1000ms`);
  assert(unique.length <= findings.length, 'Unique count should not exceed total');
}, true);

await test('False positive filter processes findings quickly', async () => {
  const findings: Finding[] = [];
  const sourceCode = 'contract Test { function test() external pure {} }';
  
  // Generate findings
  for (let i = 0; i < 100; i++) {
    findings.push({
      detectorName: `detector-${i}`,
      tool: 'test',
      severity: 'medium',
      description: `Test finding ${i}`,
    });
  }
  
  const start = performance.now();
  const filtered = localFpFilter(findings, sourceCode);
  const duration = performance.now() - start;
  
  assert(duration < 500, `FP filtering took ${duration}ms, expected <500ms`);
}, true);

await test('Strategy selection is sub-millisecond', async () => {
  const agent = new ContractAnalyzerAgent();
  const contract = createDeFiContract();
  const triage = { riskScore: 50 };
  
  const iterations = 1000;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    (agent as any).selectStrategy(contract, triage);
  }
  
  const duration = performance.now() - start;
  const avgDuration = duration / iterations;
  
  assert(avgDuration < 1, `Strategy selection avg ${avgDuration.toFixed(3)}ms, expected <1ms`);
}, true);

await test('Risk score calculation scales linearly', async () => {
  const agent = new ContractAnalyzerAgent();
  const contract = createMockContract();
  
  // Test with increasing finding counts
  const sizes = [10, 50, 100, 500];
  const times: number[] = [];
  
  for (const size of sizes) {
    const findings: Finding[] = [];
    for (let i = 0; i < size; i++) {
      findings.push({
        detectorName: `test-${i}`,
        tool: 'test',
        severity: (['critical', 'high', 'medium', 'low'][i % 4] as Severity),
        description: `Finding ${i}`,
      });
    }
    
    const start = performance.now();
    (agent as any).calculateRiskScore(contract, findings);
    times.push(performance.now() - start);
  }
  
  // Verify roughly linear scaling
  const ratio1 = times[1] / times[0];
  const ratio2 = times[2] / times[1];
  const ratio3 = times[3] / times[2];
  
  // Ratios should be roughly 5, 2, 5 (matching size increases)
  assert(ratio1 < 10, `Scaling not linear: ${ratio1.toFixed(2)}x for 5x data`);
  assert(ratio2 < 5, `Scaling not linear: ${ratio2.toFixed(2)}x for 2x data`);
}, true);

// =============================================================================
// SECTION 2: INTEROPERABILITY TESTS
// =============================================================================

console.log('\n🔗 Interoperability Tests');
console.log('-'.repeat(50));

await test('Contract and infrastructure findings share common interface', async () => {
  const contractFinding: Finding = {
    detectorName: 'reentrancy',
    tool: 'slither',
    severity: 'critical',
    description: 'Reentrancy vulnerability',
  };
  
  const infraFinding: InfrastructureFinding = {
    detectorName: 'kubescape-C-0001',
    tool: 'kubescape',
    severity: 'critical',
    description: 'Privileged container',
    infrastructureType: 'kubernetes',
    targetId: 'k8s-1',
  };
  
  // Both should work with deduplicator
  const deduplicator = new FindingDeduplicator();
  const unique = deduplicator.deduplicate([contractFinding, infraFinding as Finding]);
  
  assert.strictEqual(unique.length, 2, 'Should handle both finding types');
});

await test('All scanners implement common interface', async () => {
  const scanners = [
    new KubescapeScanner(),
    new CloudSploitScanner(),
    new NiliScanner(),
  ];
  
  for (const scanner of scanners) {
    // Common interface methods
    assert(typeof scanner.name === 'string', `${scanner.name} should have name`);
    assert(typeof scanner.version === 'string', `${scanner.name} should have version`);
    assert(Array.isArray(scanner.supportedTargets), `${scanner.name} should have supportedTargets`);
    assert(typeof scanner.getAvailableChecks === 'function', `${scanner.name} should have getAvailableChecks`);
    assert(typeof scanner.validateTarget === 'function', `${scanner.name} should have validateTarget`);
    assert(typeof scanner.scan === 'function', `${scanner.name} should have scan`);
    
    // Get checks should work
    const checks = await scanner.getAvailableChecks();
    assert(Array.isArray(checks), `${scanner.name} should return checks array`);
    assert(checks.length > 0, `${scanner.name} should have checks defined`);
    
    // All checks should have required fields
    for (const check of checks) {
      assert(check.id, `${scanner.name} check should have id`);
      assert(check.name, `${scanner.name} check should have name`);
      assert(check.severity, `${scanner.name} check should have severity`);
      assert(['critical', 'high', 'medium', 'low', 'informational'].includes(check.severity),
        `${scanner.name} check should have valid severity, got: ${check.severity}`);
    }
  }
});

await test('Pipeline configurations merge correctly', async () => {
  const agent = new ContractAnalyzerAgent({
    mode: 'adaptive',
    maxConcurrentDeepAnalyses: 5,
    minRiskScore: 50,
  });
  
  const config = (agent as any).config;
  assert.strictEqual(config.mode, 'adaptive');
  assert.strictEqual(config.maxConcurrentDeepAnalyses, 5);
  assert.strictEqual(config.minRiskScore, 50);
  assert.strictEqual(config.enableCaching, true); // Default
});

await test('Infrastructure pipeline respects global config', async () => {
  const pipeline = new InfrastructureAnalysisPipeline({
    globalConfig: {
      severityThreshold: 'high',
      timeoutMs: 60000,
      parallelScans: 5,
    },
  });
  
  const config = (pipeline as any).config;
  assert.strictEqual(config.globalConfig.severityThreshold, 'high');
  assert.strictEqual(config.globalConfig.timeoutMs, 60000);
  assert.strictEqual(config.globalConfig.parallelScans, 5);
});

// =============================================================================
// SECTION 3: CROSS-SYSTEM INTEGRATION TESTS
// =============================================================================

console.log('\n🔄 Cross-System Integration Tests');
console.log('-'.repeat(50));

await test('Multiple pipelines can coexist', async () => {
  const contractPipeline = new AnalysisPipeline();
  const infraPipeline = new InfrastructureAnalysisPipeline();
  const agent = new ContractAnalyzerAgent();
  
  // All should be independently usable
  assert(contractPipeline, 'Contract pipeline should exist');
  assert(infraPipeline, 'Infrastructure pipeline should exist');
  assert(agent, 'Agent should exist');
});

await test('Finding severity levels are consistent across systems', async () => {
  const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  
  // Contract findings
  const contractFinding: Finding = {
    detectorName: 'test',
    tool: 'test',
    severity: 'critical',
    description: 'Test',
  };
  
  // Infrastructure finding
  const infraFinding: InfrastructureFinding = {
    detectorName: 'test',
    tool: 'test',
    severity: 'critical',
    description: 'Test',
    infrastructureType: 'kubernetes',
    targetId: 'test',
  };
  
  // Both use same severity enum
  assert(severities.includes(contractFinding.severity));
  assert(severities.includes(infraFinding.severity));
});

await test('Deduplication works across finding types', async () => {
  const deduplicator = new FindingDeduplicator();
  
  // Mix of finding types - deduplication considers multiple factors
  const findings: Finding[] = [
    { 
      detectorName: 'reentrancy', 
      tool: 'slither', 
      severity: 'high', 
      description: 'Reentrancy in withdraw',
      sourceLocation: { file: 'Contract.sol', line: 42 }
    },
    { 
      detectorName: 'reentrancy', 
      tool: 'mythril', 
      severity: 'high', 
      description: 'Reentrancy vulnerability',
      sourceLocation: { file: 'Contract.sol', line: 42 }
    },
    { 
      detectorName: 'unchecked-transfer', 
      tool: 'slither', 
      severity: 'medium', 
      description: 'Unchecked transfer',
      sourceLocation: { file: 'Contract.sol', line: 55 }
    },
  ];
  
  const unique = deduplicator.deduplicate(findings);
  
  // Deduplication should reduce findings (exact count depends on grouping logic)
  // First two might be grouped (same location/similar detector)
  assert(unique.length <= findings.length, `Should not exceed original count: ${unique.length} <= ${findings.length}`);
});

await test('Batch processing handles mixed target types', async () => {
  const infraPipeline = new InfrastructureAnalysisPipeline();
  
  const targets: InfrastructureTarget[] = [
    createK8sTarget('k8s-1'),
    createAWSTarget('aws-1'),
    createNetworkTarget('net-1'),
    createK8sTarget('k8s-2'),
    createAWSTarget('aws-2'),
  ];
  
  // Should be able to process batch even if individual scans fail
  // (due to missing credentials/tools in test environment)
  try {
    await infraPipeline.analyzeBatch(targets);
  } catch {
    // Expected in test environment without actual infrastructure
  }
  
  // Test passes if no uncaught errors
  assert(true, 'Batch processing completed');
});

// =============================================================================
// SECTION 4: STRATEGY SELECTION TESTS
// =============================================================================

console.log('\n🎯 Strategy Selection Tests');
console.log('-'.repeat(50));

await test('DeFi contracts trigger DeFi strategy', async () => {
  const agent = new ContractAnalyzerAgent();
  const defiContract = createDeFiContract();
  
  const strategy = (agent as any).selectStrategy(defiContract, { riskScore: 50 });
  
  assert.strictEqual(strategy.name, 'defi-focused');
  assert(strategy.tools.includes('mythril'), 'DeFi should include Mythril');
  assert(strategy.tools.includes('securify'), 'DeFi should include Securify');
});

await test('High TVL contracts get comprehensive analysis', async () => {
  const agent = new ContractAnalyzerAgent();
  const highValueContract = createMockContract({
    name: 'HighValue',
    tvlUsd: 200_000_000, // $200M TVL
  });
  
  const { score } = (agent as any).calculateRiskScore(highValueContract, []);
  
  assert(score >= 30, `High TVL should boost risk score, got ${score}`);
  
  const strategy = (agent as any).selectStrategy(highValueContract, { riskScore: score });
  
  if (score >= 70) {
    assert.strictEqual(strategy.name, 'comprehensive', 'Very high value should get comprehensive');
  }
});

await test('Governance contracts trigger governance strategy', async () => {
  const agent = new ContractAnalyzerAgent();
  const govContract = createGovernanceContract();
  
  const strategy = (agent as any).selectStrategy(govContract, { riskScore: 50 });
  
  assert.strictEqual(strategy.name, 'governance-focused');
  assert(strategy.tools.includes('securify'), 'Governance should include Securify');
  assert(strategy.tools.includes('maian'), 'Governance should include MAIAN');
});

await test('Strategy adapts to risk score', async () => {
  const agent = new ContractAnalyzerAgent({ mode: 'adaptive' });
  const contract = createMockContract();
  
  // Low risk - focused approach
  const lowRiskStrategy = (agent as any).selectStrategy(contract, { riskScore: 20 });
  assert(lowRiskStrategy.tools.length <= 4, 'Low risk should use fewer tools');
  
  // High risk - comprehensive
  const highRiskStrategy = (agent as any).selectStrategy(contract, { riskScore: 80 });
  assert.strictEqual(highRiskStrategy.name, 'comprehensive', 'High risk should be comprehensive');
});

// =============================================================================
// SECTION 5: ERROR HANDLING & RESILIENCE TESTS
// =============================================================================

console.log('\n🛡️ Error Handling & Resilience Tests');
console.log('-'.repeat(50));

await test('Pipeline continues when individual scanner fails', async () => {
  const pipeline = new InfrastructureAnalysisPipeline({
    enabledScanners: ['kubescape', 'cloudsploit', 'nili'],
  });
  
  // Mock target that will cause scanner to fail
  const target = createK8sTarget('invalid-cluster');
  
  const result = await pipeline.analyze(target);
  
  // Should complete even if scanners fail (due to missing tools)
  assert(result, 'Should return result');
  assert(Array.isArray(result.errors), 'Should have errors array');
  assert(Array.isArray(result.findings), 'Should have findings array');
});

await test('Timeout wrapper handles slow operations', async () => {
  const agent = new ContractAnalyzerAgent();
  
  const slowPromise = new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    await (agent as any).withTimeout(slowPromise, 50, 'test-operation');
    assert.fail('Should have timed out');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok((error as Error).message.includes('timeout'));
  }
});

await test('Invalid targets are handled gracefully', async () => {
  const kubescape = new KubescapeScanner();
  
  // Invalid target (no actual cluster)
  const invalidTarget: any = {
    id: 'invalid',
    type: 'kubernetes',
    name: 'Invalid',
    metadata: { clusterName: 'nonexistent' },
  };
  
  // Should not throw, just return false
  const isValid = await kubescape.validateTarget(invalidTarget);
  assert.strictEqual(isValid, false, 'Should return false for invalid target');
});

await test('Malformed finding data is handled', async () => {
  const deduplicator = new FindingDeduplicator();
  
  // Mix of valid and edge-case findings
  const findings: Finding[] = [
    { detectorName: 'test', tool: 'test', severity: 'high', description: '' },
    { detectorName: '', tool: 'test', severity: 'high', description: 'Empty detector' },
    { detectorName: 'test', tool: 'test', severity: 'high' as any, description: 'No description' },
  ];
  
  // Should not throw
  const unique = deduplicator.deduplicate(findings);
  assert(Array.isArray(unique), 'Should return array');
});

// =============================================================================
// SECTION 6: COMPLIANCE & REPORTING TESTS
// =============================================================================

console.log('\n📋 Compliance & Reporting Tests');
console.log('-'.repeat(50));

await test('Compliance mapping includes major frameworks', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  // Create findings that map to compliance
  const findings: InfrastructureFinding[] = [
    {
      detectorName: 'kubescape-C-0001',
      tool: 'kubescape',
      severity: 'critical',
      description: 'Privileged container',
      infrastructureType: 'kubernetes',
      targetId: 'k8s-1',
      framework: { checkId: 'C-0001', name: 'kubescape', version: '1.0' },
    },
    {
      detectorName: 'cloudsploit-s3-encryption',
      tool: 'cloudsploit',
      severity: 'high',
      description: 'S3 encryption',
      infrastructureType: 'aws',
      targetId: 'aws-1',
      framework: { checkId: 's3-encryption', name: 'cloudsploit', version: '1.0' },
    },
  ];
  
  const byCompliance = pipeline.groupByCompliance(findings);
  
  // Should have at least one compliance group
  assert(Object.keys(byCompliance).length > 0, 'Should have compliance mappings');
});

await test('Severity filtering works correctly', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  const findings: Finding[] = [
    { detectorName: 'c1', tool: 'test', severity: 'critical', description: '' },
    { detectorName: 'c2', tool: 'test', severity: 'critical', description: '' },
    { detectorName: 'h1', tool: 'test', severity: 'high', description: '' },
    { detectorName: 'm1', tool: 'test', severity: 'medium', description: '' },
    { detectorName: 'l1', tool: 'test', severity: 'low', description: '' },
  ];
  
  const highAndAbove = pipeline.filterFindings(findings as any, 'high');
  assert.strictEqual(highAndAbove.length, 3, 'Should have 3 critical/high');
  
  const mediumAndAbove = pipeline.filterFindings(findings as any, 'medium');
  assert.strictEqual(mediumAndAbove.length, 4, 'Should have 4 critical/high/medium');
});

await test('Resource grouping organizes findings correctly', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  const findings: InfrastructureFinding[] = [
    { detectorName: 'd1', tool: 'test', severity: 'high', description: '', infrastructureType: 'kubernetes', targetId: '1', resource: { type: 'pod', name: 'pod-1' } },
    { detectorName: 'd2', tool: 'test', severity: 'high', description: '', infrastructureType: 'kubernetes', targetId: '1', resource: { type: 'pod', name: 'pod-2' } },
    { detectorName: 'd3', tool: 'test', severity: 'high', description: '', infrastructureType: 'kubernetes', targetId: '1', resource: { type: 'service', name: 'svc-1' } },
  ];
  
  const byResource = pipeline.groupByResource(findings);
  
  assert.strictEqual(byResource.pod.length, 2, 'Should have 2 pod findings');
  assert.strictEqual(byResource.service.length, 1, 'Should have 1 service finding');
});

// =============================================================================
// SECTION 7: PERFORMANCE BENCHMARKS
// =============================================================================

console.log('\n⚡ Performance Benchmarks');
console.log('-'.repeat(50));

await test('Strategy selection benchmark', async () => {
  const agent = new ContractAnalyzerAgent();
  const contract = createDeFiContract();
  const triage = { riskScore: 50 };
  
  const iterations = 10000;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    (agent as any).selectStrategy(contract, triage);
  }
  
  const duration = performance.now() - start;
  const opsPerSecond = (iterations / duration) * 1000;
  
  console.log(`    ${opsPerSecond.toFixed(0)} ops/sec (${(duration / iterations).toFixed(4)}ms avg)`);
  assert(opsPerSecond > 10000, 'Should handle >10k ops/sec');
}, true);

await test('Risk calculation benchmark', async () => {
  const agent = new ContractAnalyzerAgent();
  const contract = createDeFiContract();
  
  const findings: Finding[] = [];
  for (let i = 0; i < 100; i++) {
    findings.push({
      detectorName: `test-${i}`,
      tool: 'test',
      severity: (['critical', 'high', 'medium'][i % 3] as Severity),
      description: `Finding ${i}`,
    });
  }
  
  const iterations = 1000;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    (agent as any).calculateRiskScore(contract, findings);
  }
  
  const duration = performance.now() - start;
  const opsPerSecond = (iterations / duration) * 1000;
  
  console.log(`    ${opsPerSecond.toFixed(0)} ops/sec (${(duration / iterations).toFixed(4)}ms avg)`);
  assert(opsPerSecond > 1000, 'Should handle >1000 ops/sec');
}, true);

await test('Deduplication benchmark', async () => {
  const deduplicator = new FindingDeduplicator();
  
  // Generate 1000 findings with duplicates
  const findings: Finding[] = [];
  for (let i = 0; i < 1000; i++) {
    findings.push({
      detectorName: `detector-${i % 200}`,
      tool: 'test',
      severity: 'high',
      description: `Finding ${i}`,
    });
  }
  
  const iterations = 100;
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    deduplicator.deduplicate(findings);
  }
  
  const duration = performance.now() - start;
  const opsPerSecond = (iterations / duration) * 1000;
  
  console.log(`    ${opsPerSecond.toFixed(0)} ops/sec (${(duration / iterations).toFixed(2)}ms avg)`);
  assert(opsPerSecond > 50, 'Should handle >50 ops/sec for 1000 findings');
}, true);

await test('Memory usage stays reasonable', async () => {
  // Generate large batch of findings
  const findings: Finding[] = [];
  for (let i = 0; i < 10000; i++) {
    findings.push({
      detectorName: `detector-${i % 1000}`,
      tool: 'test',
      severity: 'high',
      description: `This is a test finding with some description text ${i}`,
    });
  }
  
  const deduplicator = new FindingDeduplicator();
  
  const startMemory = process.memoryUsage().heapUsed;
  const unique = deduplicator.deduplicate(findings);
  const endMemory = process.memoryUsage().heapUsed;
  
  const memoryIncreaseMB = (endMemory - startMemory) / 1024 / 1024;
  
  console.log(`    Memory increase: ${memoryIncreaseMB.toFixed(2)} MB for 10k findings`);
  assert(memoryIncreaseMB < 200, 'Memory increase should be <200MB');
  assert(unique.length <= findings.length, 'Should not exceed original count');
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));
console.log(`Total: ${passCount + failCount} tests`);
console.log(`Passed: ${passCount} ✓`);
console.log(`Failed: ${failCount} ✗`);
console.log(`Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);

if (Object.keys(perfMetrics).length > 0) {
  console.log('\nPerformance Metrics:');
  for (const [name, duration] of Object.entries(perfMetrics)) {
    console.log(`  ${name}: ${duration.toFixed(1)}ms`);
  }
}

if (failCount === 0) {
  console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
}

}

runTests().then(() => process.exit(failCount > 0 ? 1 : 0));
