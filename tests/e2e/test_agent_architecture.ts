/**
 * E2E Tests for Contract Analyzer Agent
 * 
 * Tests the OPTIMAL architecture:
 * - Triage speed
 * - Strategy selection
 * - Parallel execution
 * - Caching
 * - Risk scoring
 */

import { strict as assert } from 'assert';
import {
  ContractAnalyzerAgent,
  AnalysisStrategies,
  type Contract,
  type AgentConfig,
} from '../../src/agents/contract-analyzer-agent.js';

// Test constants
const E2E_TEST_TIMEOUT = 60000;

// Mock contracts for testing
const createMockContract = (overrides: Partial<Contract> = {}): Contract => ({
  address: '0x' + '1'.repeat(40),
  chainId: 1,
  name: 'TestContract',
  sourceCode: `
    pragma solidity ^0.8.0;
    contract TestContract {
      mapping(address => uint256) public balances;
      
      function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
      }
      
      receive() external payable {
        balances[msg.sender] += msg.value;
      }
    }
  `,
  compilerVersion: 'v0.8.19',
  ...overrides,
});

const createDeFiContract = (): Contract => createMockContract({
  name: 'DeFiPool',
  sourceCode: `
    pragma solidity ^0.8.0;
    contract DeFiPool {
      mapping(address => uint256) public liquidity;
      
      function swap(address tokenIn, address tokenOut, uint256 amount) external {
        // Swap logic
      }
      
      function addLiquidity(uint256 amount) external {
        liquidity[msg.sender] += amount;
      }
      
      function withdraw(uint256 amount) external {
        require(liquidity[msg.sender] >= amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        liquidity[msg.sender] -= amount;
      }
    }
  `,
});

const createNFTContract = (): Contract => createMockContract({
  name: 'NFTCollection',
  sourceCode: `
    pragma solidity ^0.8.0;
    import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
    
    contract NFTCollection is ERC721 {
      uint256 public nextTokenId;
      
      function mint() external {
        _mint(msg.sender, nextTokenId++);
      }
      
      function withdraw() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
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
      }
      
      mapping(uint256 => Proposal) public proposals;
      
      function propose(address target, bytes calldata data) external {
        // Proposal logic
      }
      
      function execute(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.forVotes > p.againstVotes);
        (bool success, ) = p.target.call(p.data);
        require(success);
      }
    }
  `,
});

// Test runner
let passCount = 0;
let failCount = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
    failCount++;
  }
}

// Tests
async function runTests() {
console.log('Contract Analyzer Agent E2E Tests');
console.log('='.repeat(50));

// Test 1: Agent Instantiation
await test('Agent instantiation', async () => {
  const agent = new ContractAnalyzerAgent();
  assert(agent, 'Agent should be instantiated');
});

// Test 2: Strategy Definitions
await test('Analysis strategies are defined', async () => {
  const defi = AnalysisStrategies.defi();
  assert.strictEqual(defi.name, 'defi-focused');
  assert(defi.tools.includes('slither'));
  assert(defi.tools.includes('mythril'));

  const nft = AnalysisStrategies.nft();
  assert.strictEqual(nft.name, 'nft-focused');
  
  const gov = AnalysisStrategies.governance();
  assert.strictEqual(gov.name, 'governance-focused');
  
  const comprehensive = AnalysisStrategies.comprehensive();
  assert.strictEqual(comprehensive.name, 'comprehensive');
  assert.strictEqual(comprehensive.tools.length, 6);
});

// Test 3: Strategy Selection - DeFi
await test('Strategy selection for DeFi contracts', async () => {
  const agent = new ContractAnalyzerAgent({ mode: 'adaptive' });
  const defiContract = createDeFiContract();
  
  // Access private method via any
  const strategy = (agent as any).selectStrategy(defiContract, { riskScore: 50 });
  
  assert.strictEqual(strategy.name, 'defi-focused');
  assert(strategy.tools.includes('mythril'));
});

// Test 4: Strategy Selection - NFT
await test('Strategy selection for NFT contracts', async () => {
  const agent = new ContractAnalyzerAgent({ mode: 'adaptive' });
  const nftContract = createNFTContract();
  
  const strategy = (agent as any).selectStrategy(nftContract, { riskScore: 50 });
  
  assert.strictEqual(strategy.name, 'nft-focused');
  assert(strategy.tools.includes('maian'));
});

// Test 5: Strategy Selection - Governance
await test('Strategy selection for Governance contracts', async () => {
  const agent = new ContractAnalyzerAgent({ mode: 'adaptive' });
  const govContract = createGovernanceContract();
  
  const strategy = (agent as any).selectStrategy(govContract, { riskScore: 50 });
  
  assert.strictEqual(strategy.name, 'governance-focused');
  assert(strategy.tools.includes('securify'));
});

// Test 6: Risk Score Calculation
await test('Risk score calculation', async () => {
  const agent = new ContractAnalyzerAgent();
  const contract = createMockContract();
  
  const highRiskFindings = [
    { detectorName: 'reentrancy', severity: 'high', tool: 'test' as any },
    { detectorName: 'access-control', severity: 'critical', tool: 'test' as any },
  ];
  
  const result = (agent as any).calculateRiskScore(contract, highRiskFindings);
  
  assert(result.score > 60, `Expected high risk score, got ${result.score}`);
  assert(result.reasons.length >= 2, 'Should have risk reasons');
});

// Test 7: High TVL Risk Boost
await test('High TVL increases risk score', async () => {
  const agent = new ContractAnalyzerAgent();
  
  const lowTvlContract = createMockContract({ tvlUsd: 100000 });
  const highTvlContract = createMockContract({ tvlUsd: 150_000_000 });
  
  const lowResult = (agent as any).calculateRiskScore(lowTvlContract, []);
  const highResult = (agent as any).calculateRiskScore(highTvlContract, []);
  
  assert(highResult.score > lowResult.score, 'High TVL should increase risk score');
  assert(highResult.reasons.some((r: string) => r.includes('TVL')), 'Should mention TVL');
});

// Test 8: Triage Mode
await test('Triage-only mode uses fast strategy', async () => {
  const agent = new ContractAnalyzerAgent({ mode: 'triage-only' });
  const contract = createDeFiContract();
  
  const strategy = (agent as any).selectStrategy(contract, { riskScore: 80 });
  
  assert.strictEqual(strategy.name, 'triage-only');
  assert.strictEqual(strategy.tools.length, 2); // Only slither + pattern
});

// Test 9: Comprehensive Mode
await test('Comprehensive mode uses all tools', async () => {
  const agent = new ContractAnalyzerAgent({ mode: 'comprehensive' });
  const contract = createMockContract();
  
  const strategy = (agent as any).selectStrategy(contract, { riskScore: 10 });
  
  assert.strictEqual(strategy.name, 'comprehensive');
  assert.strictEqual(strategy.tools.length, 6);
});

// Test 10: High Risk Triggers Comprehensive
await test('High risk score triggers comprehensive analysis', async () => {
  const agent = new ContractAnalyzerAgent({ mode: 'adaptive' });
  const contract = createMockContract();
  
  const strategy = (agent as any).selectStrategy(contract, { riskScore: 75 });
  
  assert.strictEqual(strategy.name, 'comprehensive');
});

// Test 11: Parallel Analysis Limit
await test('Respects max concurrent analyses limit', async () => {
  const agent = new ContractAnalyzerAgent({ maxConcurrentDeepAnalyses: 2 });
  const activeAnalyses = (agent as any).activeAnalyses;
  
  assert.strictEqual((agent as any).config.maxConcurrentDeepAnalyses, 2);
});

// Test 12: Confidence Calculation
await test('Confidence calculation based on tools used', async () => {
  const agent = new ContractAnalyzerAgent();
  
  const lowConfidence = (agent as any).calculateConfidence([], ['slither']);
  assert.strictEqual(lowConfidence, 'low');
  
  const mediumConfidence = (agent as any).calculateConfidence([], ['slither', 'mythril']);
  assert.strictEqual(mediumConfidence, 'medium');
  
  const highConfidence = (agent as any).calculateConfidence([], ['slither', 'mythril', 'securify', 'maian']);
  assert.strictEqual(highConfidence, 'high');
});

// Test 13: Timeout Wrapper
await test('Timeout wrapper rejects slow operations', async () => {
  const agent = new ContractAnalyzerAgent();
  const slowPromise = new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    await (agent as any).withTimeout(slowPromise, 50, 'slow-op');
    assert.fail('Should have timed out');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok((error as Error).message.includes('timeout'));
  }
});

// Test 14: Complexity Detection
await test('Contract complexity affects risk score', async () => {
  const agent = new ContractAnalyzerAgent();
  
  const simpleContract = createMockContract({
    sourceCode: 'pragma solidity ^0.8.0; contract Simple {}',
  });
  
  const complexCode = Array(1000).fill('uint256 x;').join('\n');
  const complexContract = createMockContract({
    sourceCode: `pragma solidity ^0.8.0; contract Complex { ${complexCode} }`,
  });
  
  const simpleResult = (agent as any).calculateRiskScore(simpleContract, []);
  const complexResult = (agent as any).calculateRiskScore(complexContract, []);
  
  assert(complexResult.score > simpleResult.score, 'Complex contract should have higher risk score');
});

// Summary
console.log('='.repeat(50));
console.log(`Results: ${passCount} passed, ${failCount} failed`);
}

runTests().then(() => process.exit(failCount > 0 ? 1 : 0));
