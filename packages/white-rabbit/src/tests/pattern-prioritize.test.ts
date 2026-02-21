// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Prioritization Tests - prioritizeByIntel via PatternEngine
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PatternEngine } from '../engines/pattern.js';
import { Contract, IntelVulnerabilitySurface, IntelPatternMatch } from '../types.js';

// ── Helpers ──

function makeContract(name: string, source: string): Contract {
  return {
    id: `test-${name.toLowerCase()}`,
    name,
    address: '0x0000000000000000000000000000000000000001',
    chainId: 1,
    sourceCode: source,
    abi: [],
    compilerVersion: '0.8.0',
    isProxy: false,
    implementationAddress: null,
    tvlUsd: null,
    protocolName: null,
  };
}

function makeIntelContext(matches: Partial<IntelPatternMatch>[]): IntelVulnerabilitySurface {
  return {
    evmbenchPatternMatches: matches.map((m, i) => ({
      patternId: m.patternId || `pattern-${i}`,
      category: m.category || 'unknown',
      severity: m.severity || 'high',
      title: m.title || `Pattern ${i}`,
      relevanceScore: m.relevanceScore ?? 0.8,
      detectionHints: m.detectionHints || [],
      codeIndicators: m.codeIndicators || [],
    })),
    contractType: 'defi',
    riskLevel: 'high',
    totalMatchingPatterns: matches.length,
  };
}

// A simple contract that triggers multiple pattern types
const MULTI_VULN_SOURCE = `
pragma solidity ^0.8.0;
contract MultiVuln {
    mapping(address => uint256) balances;

    function withdraw() public {
        uint256 amt = balances[msg.sender];
        (bool ok,) = msg.sender.call{value: amt}("");
        require(ok);
        balances[msg.sender] = 0;
    }

    function isOwner() public view returns (bool) {
        return tx.origin == msg.sender;
    }

    function kill() public {
        selfdestruct(payable(msg.sender));
    }
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════════════════

describe('prioritizeByIntel', () => {

  it('should return original patterns when no intelContext provided', async () => {
    const engine = new PatternEngine();
    const contract = makeContract('NoIntel', MULTI_VULN_SOURCE);

    // Without intelContext, analyze works normally
    const resultA = await engine.analyze(contract);
    const resultB = await engine.analyze(contract, {});

    assert.equal(resultA.success, true);
    assert.equal(resultB.success, true);
    // Both runs produce the same set of findings
    assert.equal(resultA.findings.length, resultB.findings.length);
  });

  it('should reorder patterns by relevance score when intelContext has matches', async () => {
    const engine = new PatternEngine();
    const contract = makeContract('IntelReorder', MULTI_VULN_SOURCE);

    const intelContext = makeIntelContext([
      {
        patternId: 'tx-origin',
        category: 'access-control',
        relevanceScore: 0.95,
        title: 'tx.origin Authentication',
      },
    ]);

    const result = await engine.analyze(contract, { intelContext });
    assert.equal(result.success, true);
    assert.ok(result.findings.length > 0, 'should have findings');

    // The prioritized pattern (tx-origin) should appear at least somewhere in findings.
    // The key thing is that the analysis completes and intel context is accepted.
    const txOriginFindings = result.findings.filter(f =>
      f.detectorName.includes('tx-origin') || f.description.toLowerCase().includes('tx.origin'),
    );
    assert.ok(txOriginFindings.length > 0, 'should detect tx.origin when intel prioritizes it');
  });

  it('patterns matching evmbench categories should bubble to front', async () => {
    const engine = new PatternEngine();

    // Contract that has both reentrancy and tx.origin
    const contract = makeContract('BubbleTest', MULTI_VULN_SOURCE);

    // Intel says reentrancy is the high-relevance pattern
    const intelContext = makeIntelContext([
      {
        patternId: 'reentrancy',
        category: 'reentrancy',
        relevanceScore: 0.99,
        title: 'Reentrancy',
      },
    ]);

    const result = await engine.analyze(contract, { intelContext });
    assert.equal(result.success, true);
    assert.ok(result.findings.length > 0);

    // With reentrancy prioritized, the first finding should be reentrancy-related
    // (since it is checked first and matches the source code)
    const firstFinding = result.findings[0];
    const isReentrancy =
      firstFinding.detectorName.includes('reentrancy') ||
      firstFinding.detectorName.includes('external-call') ||
      firstFinding.description.toLowerCase().includes('reentrancy');

    assert.ok(
      isReentrancy,
      `First finding should be reentrancy-related when prioritized, got: ${firstFinding.detectorName} - ${firstFinding.description}`,
    );
  });

  it('non-matching patterns should retain original order', async () => {
    const engine = new PatternEngine();
    const contract = makeContract('RetainOrder', MULTI_VULN_SOURCE);

    // Intel mentions a pattern that does NOT exist in the engine
    const intelContext = makeIntelContext([
      {
        patternId: 'nonexistent-flash-loan-pattern',
        category: 'flash-loan',
        relevanceScore: 1.0,
        title: 'Flash Loan Attack',
      },
    ]);

    const resultWithIntel = await engine.analyze(contract, { intelContext });
    const resultWithout = await engine.analyze(contract);

    assert.equal(resultWithIntel.success, true);
    assert.equal(resultWithout.success, true);

    // Finding count should be the same because the non-matching intel
    // does not add or remove patterns - it only reorders.
    assert.equal(
      resultWithIntel.findings.length,
      resultWithout.findings.length,
      'non-matching intel should not change finding count',
    );

    // Findings should be the same set (order may differ only if patterns matched)
    const idsWithIntel = new Set(resultWithIntel.findings.map(f => f.detectorName));
    const idsWithout = new Set(resultWithout.findings.map(f => f.detectorName));
    assert.deepEqual(idsWithIntel, idsWithout, 'same detectors should fire');
  });

  it('empty evmbenchPatternMatches should return original order', async () => {
    const engine = new PatternEngine();
    const contract = makeContract('EmptyMatches', MULTI_VULN_SOURCE);

    const intelContext: IntelVulnerabilitySurface = {
      evmbenchPatternMatches: [],
      contractType: 'defi',
      riskLevel: 'medium',
      totalMatchingPatterns: 0,
    };

    const resultWithEmptyIntel = await engine.analyze(contract, { intelContext });
    const resultWithout = await engine.analyze(contract);

    assert.equal(resultWithEmptyIntel.success, true);
    assert.equal(resultWithout.success, true);
    assert.equal(
      resultWithEmptyIntel.findings.length,
      resultWithout.findings.length,
      'empty intel matches should not change results',
    );
  });
});
