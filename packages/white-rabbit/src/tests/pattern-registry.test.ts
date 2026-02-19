// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Registry Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  PatternRegistryLoader, 
  getPatternRegistry,
} from '../engines/pattern-registry-compat.js';
import { PatternEngine } from '../engines/pattern.js';
import { Contract } from '../types.js';

describe('Pattern Registry', async () => {
  test('should instantiate with default directory', () => {
    const registry = new PatternRegistryLoader();
    assert.ok(registry);
  });

  test('should return singleton from getPatternRegistry', () => {
    const r1 = getPatternRegistry();
    const r2 = getPatternRegistry();
    assert.strictEqual(r1, r2);
  });

  test('should handle non-existent directory gracefully', () => {
    const registry = new PatternRegistryLoader('/nonexistent/path');
    const info = registry.getRegistryInfo();
    // Should return null but not throw
    assert.strictEqual(info, null);
  });

  test('should search patterns', () => {
    const registry = new PatternRegistryLoader();
    const results = registry.search('reentrancy');
    assert.ok(Array.isArray(results));
  });

  test('should return pattern IDs array', () => {
    const registry = new PatternRegistryLoader();
    const ids = registry.getPatternIds();
    assert.ok(Array.isArray(ids));
  });

  test('should return categories array', () => {
    const registry = new PatternRegistryLoader();
    const categories = registry.getCategories();
    assert.ok(Array.isArray(categories));
  });

  test('PatternEngine should work with fallback patterns', async () => {
    const engine = new PatternEngine();
    const isAvailable = await engine.isAvailable();
    assert.strictEqual(isAvailable, true);

    const contract: Contract = {
      id: 'test-1',
      name: 'Test',
      address: '0x123',
      chainId: 1,
      abi: [],
      sourceCode: `
        contract Test {
          function withdraw() public {
            msg.sender.call{value: 1 ether}("");
          }
        }
      `,
      compilerVersion: '0.8.0',
      isProxy: false,
      implementationAddress: null,
      tvlUsd: null,
      protocolName: null,
    };

    const result = await engine.analyze(contract);
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.findings));
  });

  test('PatternEngine should detect tx.origin vulnerability', async () => {
    const engine = new PatternEngine();
    
    const contract: Contract = {
      id: 'test-2',
      name: 'Auth',
      address: '0x456',
      chainId: 1,
      abi: [],
      sourceCode: `
        contract Auth {
          address owner;
          
          function isOwner() public view returns (bool) {
            return tx.origin == owner;
          }
        }
      `,
      compilerVersion: '0.8.0',
      isProxy: false,
      implementationAddress: null,
      tvlUsd: null,
      protocolName: null,
    };

    const result = await engine.analyze(contract);
    assert.strictEqual(result.success, true);
    
    const txOriginFinding = result.findings.find(
      f => f.title.toLowerCase().includes('tx.origin') || 
           f.description.toLowerCase().includes('tx.origin')
    );
    
    assert.ok(txOriginFinding, `Should detect tx.origin usage. Findings: ${JSON.stringify(result.findings.map(f => f.title))}`);
  });

  test('PatternEngine should get pattern count', () => {
    const engine = new PatternEngine();
    const count = engine.getPatternCount();
    assert.ok(count > 0, 'Should have at least fallback patterns');
  });
});
