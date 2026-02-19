// ═══════════════════════════════════════════════════════════════════════════════
// Performance Benchmarks for WhiteRabbit
// ═══════════════════════════════════════════════════════════════════════════════

import { PatternEngine } from '../src/engines/pattern.js';
import { AnalysisPipeline } from '../src/engines/analysis-pipeline.js';
import { WhiteRabbit } from '../src/core/white-rabbit.js';
import { Contract } from '../src/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Benchmark Utilities
// ═══════════════════════════════════════════════════════════════════════════════

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];
  
  // Warmup
  for (let i = 0; i < 5; i++) {
    await fn();
  }
  
  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const total = times.reduce((a, b) => a + b, 0);
  const avg = total / iterations;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return {
    name,
    iterations,
    totalTime: total,
    avgTime: avg,
    minTime: min,
    maxTime: max,
    opsPerSecond: 1000 / avg,
  };
}

function printResult(result: BenchmarkResult): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Benchmark: ${result.name}`);
  console.log(`${'-'.repeat(60)}`);
  console.log(`Iterations:    ${result.iterations.toLocaleString()}`);
  console.log(`Total Time:    ${result.totalTime.toFixed(2)}ms`);
  console.log(`Average:       ${result.avgTime.toFixed(3)}ms`);
  console.log(`Min:           ${result.minTime.toFixed(3)}ms`);
  console.log(`Max:           ${result.maxTime.toFixed(3)}ms`);
  console.log(`Ops/Second:    ${result.opsPerSecond.toFixed(1)}`);
  console.log(`${'='.repeat(60)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Contracts
// ═══════════════════════════════════════════════════════════════════════════════

const SMALL_CONTRACT = `
contract Small {
  uint256 public value;
  function set(uint256 v) public { value = v; }
}
`;

const MEDIUM_CONTRACT = `
pragma solidity ^0.8.0;

contract Bank {
  mapping(address => uint256) public balances;
  
  function deposit() public payable {
    balances[msg.sender] += msg.value;
  }
  
  function withdraw() public {
    uint256 amount = balances[msg.sender];
    require(amount > 0);
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
    balances[msg.sender] = 0;
  }
}
`;

const LARGE_CONTRACT = `
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ComplexToken is ERC20, ReentrancyGuard, Ownable {
  mapping(address => bool) public blacklist;
  mapping(address => uint256) public lastTransfer;
  uint256 public constant MAX_SUPPLY = 1000000000 * 10**18;
  uint256 public transferCooldown = 1 minutes;
  
  constructor() ERC20("Complex Token", "COMP") {
    _mint(msg.sender, MAX_SUPPLY);
  }
  
  function transfer(address to, uint256 amount) public override returns (bool) {
    require(!blacklist[msg.sender], "Blacklisted");
    require(!blacklist[to], "Blacklisted recipient");
    require(block.timestamp >= lastTransfer[msg.sender] + transferCooldown, "Cooldown");
    
    lastTransfer[msg.sender] = block.timestamp;
    return super.transfer(to, amount);
  }
  
  function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
    require(!blacklist[from], "Blacklisted sender");
    require(!blacklist[to], "Blacklisted recipient");
    return super.transferFrom(from, to, amount);
  }
  
  function addToBlacklist(address account) public onlyOwner {
    blacklist[account] = true;
  }
  
  function removeFromBlacklist(address account) public onlyOwner {
    blacklist[account] = false;
  }
  
  function setCooldown(uint256 newCooldown) public onlyOwner {
    transferCooldown = newCooldown;
  }
  
  function emergencyWithdraw() public onlyOwner {
    payable(owner()).transfer(address(this).balance);
  }
  
  receive() external payable {}
}
`;

function createContract(name: string, source: string): Contract {
  return {
    id: `bench-${name}`,
    name,
    address: '0x0000000000000000000000000000000000000000',
    chainId: 1,
    sourceCode: source,
    abi: [],
    compilerVersion: '0.8.19',
    isProxy: false,
    implementationAddress: null,
    tvlUsd: null,
    protocolName: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Benchmark Suites
// ═══════════════════════════════════════════════════════════════════════════════

async function runPatternEngineBenchmarks(): Promise<void> {
  console.log('\n🏃 PatternEngine Benchmarks\n');
  
  const engine = new PatternEngine();
  
  // Small contract benchmark
  const small = await benchmark(
    'PatternEngine - Small Contract',
    async () => {
      await engine.analyze(createContract('Small', SMALL_CONTRACT));
    },
    100
  );
  printResult(small);
  
  // Medium contract benchmark
  const medium = await benchmark(
    'PatternEngine - Medium Contract',
    async () => {
      await engine.analyze(createContract('Medium', MEDIUM_CONTRACT));
    },
    50
  );
  printResult(medium);
  
  // Large contract benchmark
  const large = await benchmark(
    'PatternEngine - Large Contract',
    async () => {
      await engine.analyze(createContract('Large', LARGE_CONTRACT));
    },
    20
  );
  printResult(large);
}

async function runPipelineBenchmarks(): Promise<void> {
  console.log('\n🏃 AnalysisPipeline Benchmarks\n');
  
  const pipeline = new AnalysisPipeline({
    enabledEngines: ['pattern'],
    parallel: false,
  });
  
  const result = await benchmark(
    'Pipeline - Single Engine (Pattern)',
    async () => {
      await pipeline.analyze(createContract('Medium', MEDIUM_CONTRACT));
    },
    30
  );
  printResult(result);
}

async function runWhiteRabbitBenchmarks(): Promise<void> {
  console.log('\n🏃 WhiteRabbit Scanner Benchmarks\n');
  
  const scanner = new WhiteRabbit();
  
  // Source analysis benchmark
  const source = await benchmark(
    'WhiteRabbit - Source Analysis',
    async () => {
      await scanner.analyzeSource({
        sourceCode: MEDIUM_CONTRACT,
        filename: 'test.sol',
      });
    },
    30
  );
  printResult(source);
}

async function runScalabilityBenchmarks(): Promise<void> {
  console.log('\n🏃 Scalability Benchmarks\n');
  
  const engine = new PatternEngine();
  
  // Test with increasingly larger contracts
  const sizes = [100, 500, 1000, 2000];
  
  for (const size of sizes) {
    const source = `
      contract Test {
        ${Array(size).fill('uint256 public var;').join('\n')}
        function test() public { tx.origin; }
      }
    `;
    
    const result = await benchmark(
      `PatternEngine - ${size} lines`,
      async () => {
        await engine.analyze(createContract(`Size${size}`, source));
      },
      10
    );
    
    console.log(`${size.toString().padStart(4)} lines: ${result.avgTime.toFixed(2)}ms avg`);
  }
}

async function runMemoryBenchmarks(): Promise<void> {
  console.log('\n🏃 Memory Usage Benchmarks\n');
  
  if (global.gc) {
    global.gc();
  }
  
  const engine = new PatternEngine();
  const memBefore = process.memoryUsage();
  
  // Run many analyses
  for (let i = 0; i < 100; i++) {
    await engine.analyze(createContract('Test', MEDIUM_CONTRACT));
  }
  
  if (global.gc) {
    global.gc();
  }
  
  const memAfter = process.memoryUsage();
  
  console.log(`Heap Used Before: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Used After:  ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Delta:       ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         WhiteRabbit Performance Benchmarks                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    await runPatternEngineBenchmarks();
    await runPipelineBenchmarks();
    await runWhiteRabbitBenchmarks();
    await runScalabilityBenchmarks();
    await runMemoryBenchmarks();
    
    console.log('\n✅ All benchmarks completed');
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

main();
