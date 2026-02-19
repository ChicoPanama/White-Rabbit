// ═══════════════════════════════════════════════════════════════════════════════
// Smoke Test - Basic sanity checks for @whiteclaws/white-rabbit
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  WhiteRabbit, 
  AnalysisPipeline, 
  PatternEngine,
  ContractResolver,
  WhiteClawsClient,
} from '../index.js';
import { 
  CHAIN_CONFIGS, 
  getChainConfig, 
  getHighValueChains,
  SEVERITY_ORDER,
} from '../types.js';

describe('Package Exports', () => {
  it('should export WhiteRabbit class', () => {
    assert.ok(WhiteRabbit, 'WhiteRabbit should be exported');
    assert.strictEqual(typeof WhiteRabbit, 'function');
  });

  it('should export AnalysisPipeline', () => {
    assert.ok(AnalysisPipeline, 'AnalysisPipeline should be exported');
  });

  it('should export PatternEngine', () => {
    assert.ok(PatternEngine, 'PatternEngine should be exported');
  });

  it('should export ContractResolver', () => {
    assert.ok(ContractResolver, 'ContractResolver should be exported');
  });

  it('should export WhiteClawsClient', () => {
    assert.ok(WhiteClawsClient, 'WhiteClawsClient should be exported');
  });
});

describe('Chain Configuration', () => {
  it('should have Ethereum config', () => {
    const eth = CHAIN_CONFIGS.ethereum;
    assert.ok(eth, 'Ethereum config should exist');
    assert.strictEqual(eth.id, 1);
    assert.strictEqual(eth.name, 'ethereum');
  });

  it('should have Base config', () => {
    const base = CHAIN_CONFIGS.base;
    assert.ok(base, 'Base config should exist');
    assert.strictEqual(base.id, 8453);
  });

  it('should get chain by name', () => {
    const eth = getChainConfig('ethereum');
    assert.ok(eth);
    assert.strictEqual(eth.id, 1);
  });

  it('should get chain by ID', () => {
    const eth = getChainConfig(1);
    assert.ok(eth);
    assert.strictEqual(eth?.name, 'ethereum');
  });

  it('should get high value chains', () => {
    const chains = getHighValueChains();
    assert.ok(chains.length > 0);
    assert.ok(chains.some(c => c.name === 'ethereum'));
    assert.ok(chains.some(c => c.name === 'base'));
  });
});

describe('Severity Ordering', () => {
  it('should have correct severity order', () => {
    assert.strictEqual(SEVERITY_ORDER.critical, 5);
    assert.strictEqual(SEVERITY_ORDER.high, 4);
    assert.strictEqual(SEVERITY_ORDER.medium, 3);
    assert.strictEqual(SEVERITY_ORDER.low, 2);
    assert.strictEqual(SEVERITY_ORDER.informational, 1);
  });
});

describe('WhiteRabbit Instantiation', () => {
  it('should create scanner with default config', () => {
    const scanner = new WhiteRabbit();
    assert.ok(scanner);
  });

  it('should create scanner with custom config', () => {
    const scanner = new WhiteRabbit({
      etherscanApiKey: 'test-key',
      enableDeepAnalysis: true,
      minSeverity: 'high',
    });
    assert.ok(scanner);
  });

  it('should check engines', async () => {
    const scanner = new WhiteRabbit();
    const engines = await scanner.checkEngines();
    assert.ok(typeof engines === 'object');
    assert.ok('slither' in engines);
    assert.ok('pattern' in engines);
  });
});

describe('Pattern Engine', () => {
  it('should always be available', async () => {
    const engine = new PatternEngine();
    const available = await engine.isAvailable();
    assert.strictEqual(available, true);
  });

  it('should analyze contract', async () => {
    const engine = new PatternEngine();
    const mockContract = {
      id: 'test-123',
      address: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      name: 'TestContract',
      sourceCode: `
        contract Test {
          function withdraw() external {
            msg.sender.call{value: 1 ether}("");
          }
        }
      `,
      abi: [],
      compilerVersion: '0.8.19',
      isProxy: false,
      implementationAddress: null,
      tvlUsd: null,
      protocolName: null,
    };

    const result = await engine.analyze(mockContract);
    assert.ok(result.success);
    assert.ok(Array.isArray(result.findings));
    assert.ok(result.duration >= 0);
  });
});

describe('Analysis Pipeline', () => {
  it('should instantiate with default config', () => {
    const pipeline = new AnalysisPipeline();
    assert.ok(pipeline);
  });

  it('should check engines', async () => {
    const pipeline = new AnalysisPipeline();
    const engines = await pipeline.checkEngines();
    assert.ok(typeof engines === 'object');
    assert.ok('pattern' in engines);
  });
});

console.log('✅ All smoke tests passed!');
