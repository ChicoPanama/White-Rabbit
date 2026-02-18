/**
 * Tests for hunt-forks cascade mode.
 *
 * Covers chain registry, bytecode matching, fork hunter types,
 * cascade scanner classification, PoC adapter, cascade report,
 * and TVL lookup prioritization.
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';

// ── Chain Registry Tests ──

import {
  getHuntChainRegistry,
  getHuntChainById,
  getHuntChainByChainId,
  getEnabledHuntChains,
  addCustomChains,
  resetCustomChains,
  getHuntChainCount,
  getHuntChainIds,
} from '../hunt-forks/chain-registry.js';

describe('Chain Registry', () => {
  beforeEach(() => {
    resetCustomChains();
  });

  it('should have at least 20 built-in chains', () => {
    const chains = getHuntChainRegistry();
    assert.ok(chains.length >= 20, `Expected >= 20 chains, got ${chains.length}`);
  });

  it('should get chain by string ID', () => {
    const eth = getHuntChainById('ethereum');
    assert.equal(eth.chainId, 1);
    assert.equal(eth.name, 'Ethereum');
    assert.ok(eth.rpcEndpoints.length > 0);
  });

  it('should throw for unknown chain ID', () => {
    assert.throws(() => getHuntChainById('nonexistent'), /Chain not found/);
  });

  it('should get chain by numeric chain ID', () => {
    const bsc = getHuntChainByChainId(56);
    assert.ok(bsc);
    assert.equal(bsc.id, 'bsc');
  });

  it('should return undefined for unknown numeric chain ID', () => {
    const result = getHuntChainByChainId(99999);
    assert.equal(result, undefined);
  });

  it('should filter enabled chains by list', () => {
    const filtered = getEnabledHuntChains(['ethereum', 'base']);
    assert.equal(filtered.length, 2);
    assert.ok(filtered.some(c => c.id === 'ethereum'));
    assert.ok(filtered.some(c => c.id === 'base'));
  });

  it('should return all enabled chains when filter is "all"', () => {
    const all = getEnabledHuntChains('all');
    assert.ok(all.length >= 20);
  });

  it('should add custom chains', () => {
    const before = getHuntChainCount();
    addCustomChains([{
      id: 'test-chain',
      name: 'Test Chain',
      chainId: 99999,
      rpc_endpoints: ['https://test.rpc.io'],
      explorer_api_url: 'https://test.explorer.io/api',
      explorer_type: 'etherscan',
    }]);
    assert.equal(getHuntChainCount(), before + 1);
    const custom = getHuntChainById('test-chain');
    assert.equal(custom.chainId, 99999);
  });

  it('should not add duplicate custom chains', () => {
    addCustomChains([{
      id: 'ethereum', // already exists
      name: 'Duplicate',
      chainId: 1,
      rpc_endpoints: ['https://dupe.rpc.io'],
      explorer_api_url: 'https://dupe.io/api',
    }]);
    // Count should not increase
    const ethChains = getHuntChainRegistry().filter(c => c.id === 'ethereum');
    assert.equal(ethChains.length, 1);
  });

  it('should reset custom chains', () => {
    addCustomChains([{
      id: 'temp-chain',
      name: 'Temp',
      chainId: 88888,
      rpc_endpoints: ['https://temp.rpc.io'],
      explorer_api_url: 'https://temp.io/api',
    }]);
    const countAfterAdd = getHuntChainCount();
    resetCustomChains();
    assert.ok(getHuntChainCount() < countAfterAdd);
  });

  it('should have required fields on all chains', () => {
    for (const chain of getHuntChainRegistry()) {
      assert.ok(chain.id, `Missing id`);
      assert.ok(chain.name, `Missing name for ${chain.id}`);
      assert.ok(chain.chainId > 0, `Invalid chainId for ${chain.id}`);
      assert.ok(chain.rpcEndpoints.length > 0, `No RPC endpoints for ${chain.id}`);
      assert.ok(chain.explorerApiUrl, `No explorer API URL for ${chain.id}`);
      assert.ok(['etherscan', 'blockscout', 'custom'].includes(chain.explorerType),
        `Invalid explorer type for ${chain.id}: ${chain.explorerType}`);
    }
  });

  it('should return all chain IDs', () => {
    const ids = getHuntChainIds();
    assert.ok(ids.includes('ethereum'));
    assert.ok(ids.includes('bsc'));
    assert.ok(ids.includes('arbitrum'));
  });
});

// ── Bytecode Matcher Tests ──

import {
  extractBytecodeSignature,
  compareBytecode,
  matchAgainstCandidates,
} from '../hunt-forks/bytecode-matcher.js';

describe('Bytecode Matcher', () => {
  // Sample bytecodes with PUSH4 selectors embedded
  const SAMPLE_BYTECODE_A = '0x' + '6080604052' +
    '63' + 'aabbccdd' + '14' +  // PUSH4 selector 1
    '63' + '11223344' + '14' +  // PUSH4 selector 2
    '63' + '55667788' + '14' +  // PUSH4 selector 3
    '00'.repeat(100) +
    'a264' + '00'.repeat(43);    // metadata

  const SAMPLE_BYTECODE_B = '0x' + '6080604052' +
    '63' + 'aabbccdd' + '14' +  // Same selector 1
    '63' + '11223344' + '14' +  // Same selector 2
    '63' + '55667788' + '14' +  // Same selector 3
    '00'.repeat(100) +
    'a264' + '00'.repeat(43);    // metadata

  const DIFFERENT_BYTECODE = '0x' + '6080604052' +
    '63' + 'aaaaaaaa' + '14' +  // Different selector
    '63' + 'bbbbbbbb' + '14' +  // Different selector
    '00'.repeat(100) +
    'a264' + '00'.repeat(43);

  it('should extract bytecode signature', () => {
    const sig = extractBytecodeSignature(SAMPLE_BYTECODE_A);
    assert.ok(sig.functionSelectors.length > 0);
    assert.ok(sig.normalizedHash.length > 0);
    assert.ok(sig.rawBytecodeHash.length > 0);
    assert.ok(sig.codeSize > 0);
  });

  it('should produce identical signatures for identical bytecode', () => {
    const sig1 = extractBytecodeSignature(SAMPLE_BYTECODE_A);
    const sig2 = extractBytecodeSignature(SAMPLE_BYTECODE_B);
    assert.equal(sig1.normalizedHash, sig2.normalizedHash);
    assert.deepEqual(sig1.functionSelectors, sig2.functionSelectors);
  });

  it('should compare identical bytecodes as exact match', () => {
    const sig1 = extractBytecodeSignature(SAMPLE_BYTECODE_A);
    const sig2 = extractBytecodeSignature(SAMPLE_BYTECODE_B);
    const score = compareBytecode(sig1, sig2);
    assert.equal(score.exactMatch, true);
    assert.equal(score.overall, 100);
    assert.equal(score.classification, 'exact_fork');
  });

  it('should compare different bytecodes as lower similarity', () => {
    const sig1 = extractBytecodeSignature(SAMPLE_BYTECODE_A);
    const sig2 = extractBytecodeSignature(DIFFERENT_BYTECODE);
    const score = compareBytecode(sig1, sig2);
    assert.equal(score.exactMatch, false);
    assert.ok(score.overall < 100);
  });

  it('should handle empty bytecode gracefully', () => {
    const sig = extractBytecodeSignature('0x');
    assert.equal(sig.codeSize, 0);
    assert.deepEqual(sig.functionSelectors, []);
  });

  it('should match against candidates', () => {
    const sig = extractBytecodeSignature(SAMPLE_BYTECODE_A);
    const candidates = [
      { address: '0x1111', bytecode: SAMPLE_BYTECODE_B, chain: 'bsc', name: 'Clone' },
      { address: '0x2222', bytecode: DIFFERENT_BYTECODE, chain: 'arbitrum', name: 'Unrelated' },
    ];
    const results = matchAgainstCandidates(sig, candidates, { maxResults: 10, minSimilarity: 95 });
    assert.ok(results.length >= 1);
    assert.equal(results[0].address, '0x1111');
    assert.equal(results[0].matchType, 'exact_fork');
  });

  it('should filter out low similarity matches', () => {
    const sig = extractBytecodeSignature(SAMPLE_BYTECODE_A);
    const candidates = [
      { address: '0x3333', bytecode: DIFFERENT_BYTECODE, chain: 'polygon', name: 'Diff' },
    ];
    const results = matchAgainstCandidates(sig, candidates, { maxResults: 10, minSimilarity: 99 });
    // Different bytecodes should be filtered out at 99% threshold
    assert.equal(results.length, 0);
  });

  it('should classify similarity scores correctly', () => {
    // Exact match → exact_fork
    const sig1 = extractBytecodeSignature(SAMPLE_BYTECODE_A);
    const score1 = compareBytecode(sig1, sig1);
    assert.equal(score1.classification, 'exact_fork');

    // Two empty signatures should be 100% similar
    const empty1 = extractBytecodeSignature('0x00');
    const empty2 = extractBytecodeSignature('0x00');
    const emptyScore = compareBytecode(empty1, empty2);
    assert.equal(emptyScore.exactMatch, true);
  });
});

// ── Fork Hunter Types Tests ──

import type {
  VulnerableContract,
  HuntOptions,
  ForkHuntResult,
} from '../hunt-forks/fork-hunter.js';
import { levenshteinSimilarity } from '../hunt-forks/fork-hunter.js';

describe('Fork Hunter', () => {
  it('should export VulnerableContract type with required fields', () => {
    const contract: VulnerableContract = {
      address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      chain: 'ethereum',
      chainId: 1,
      name: 'UniswapV2Router02',
      vulnType: 'reentrancy',
      vulnTitle: 'Reentrancy in swap',
    };
    assert.ok(contract.address);
    assert.ok(contract.chain);
    assert.ok(contract.name);
  });

  it('should export HuntOptions with defaults', () => {
    const options: HuntOptions = {};
    assert.equal(options.chains, undefined);
    assert.equal(options.concurrency, undefined);
  });

  it('should compute levenshtein similarity correctly', () => {
    assert.equal(levenshteinSimilarity('abc', 'abc'), 1);
    assert.equal(levenshteinSimilarity('', ''), 1); // Empty strings are identical
    assert.ok(levenshteinSimilarity('abc', 'abd') > 0.5);
    assert.ok(levenshteinSimilarity('abc', 'xyz') < 0.5);
    assert.ok(levenshteinSimilarity('UniswapV2Router', 'UniswapV2Router02') > 0.8);
  });
});

// ── Cascade Scanner Tests ──

import type { CascadeForkResult, CascadeResult } from '../hunt-forks/cascade-scanner.js';
import { classifyFork, buildSummary } from '../hunt-forks/cascade-scanner.js';
import type { SimilarityScore } from '../hunt-forks/bytecode-matcher.js';
import type { ForkMatch as HuntForkMatch } from '../hunt-forks/fork-hunter.js';

describe('Cascade Scanner', () => {
  function makeForkMatch(overrides: Partial<HuntForkMatch> = {}): HuntForkMatch {
    return {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chain: 'bsc',
      chainId: 56,
      name: 'TestFork',
      similarity: {
        overall: 90,
        selectorOverlap: 85,
        codeSizeSimilarity: 95,
        exactMatch: false,
        classification: 'modified_fork',
      },
      matchType: 'modified_fork',
      sourceAvailable: true,
      bytecodeSignature: {
        functionSelectors: [],
        normalizedHash: 'abc',
        codeSize: 1000,
        rawBytecodeHash: 'def',
      },
      ...overrides,
    };
  }

  it('should classify exact match with no patches as vulnerable', () => {
    const fork = makeForkMatch({
      similarity: {
        overall: 100,
        selectorOverlap: 100,
        codeSizeSimilarity: 100,
        exactMatch: true,
        classification: 'exact_fork',
      },
    });
    const result = classifyFork(fork, [], [], 'source_analysis');
    assert.equal(result.status, 'vulnerable');
    assert.ok(result.confidence >= 90);
  });

  it('should classify as patched when patch indicators found without vuln indicators', () => {
    const fork = makeForkMatch();
    const result = classifyFork(
      fork,
      ['Uses ReentrancyGuard', 'Has nonReentrant modifier'],
      [],
      'source_analysis',
    );
    assert.equal(result.status, 'patched');
    assert.ok(result.confidence >= 60);
  });

  it('should classify as uncertain with mixed signals', () => {
    const fork = makeForkMatch();
    const result = classifyFork(
      fork,
      ['Uses ReentrancyGuard'],
      ['External call with value before state update'],
      'source_analysis',
    );
    assert.equal(result.status, 'uncertain');
  });

  it('should classify as vulnerable with vuln indicators and no patches', () => {
    const fork = makeForkMatch();
    const result = classifyFork(
      fork,
      [],
      ['External call with value', 'Uses transfer'],
      'source_analysis',
    );
    assert.equal(result.status, 'vulnerable');
  });

  it('should classify bytecode-only high similarity as vulnerable', () => {
    const fork = makeForkMatch({
      similarity: { overall: 92, selectorOverlap: 90, codeSizeSimilarity: 95, exactMatch: false, classification: 'modified_fork' },
    });
    const result = classifyFork(fork, [], [], 'bytecode_only');
    assert.equal(result.status, 'vulnerable');
  });

  it('should classify bytecode-only medium similarity as uncertain', () => {
    const fork = makeForkMatch({
      similarity: { overall: 82, selectorOverlap: 80, codeSizeSimilarity: 85, exactMatch: false, classification: 'modified_fork' },
    });
    const result = classifyFork(fork, [], [], 'bytecode_only');
    assert.equal(result.status, 'uncertain');
  });

  it('should build summary from fork results', () => {
    const results: CascadeForkResult[] = [
      { fork: makeForkMatch(), status: 'vulnerable', confidence: 90, sourceAvailable: true, patchIndicators: [], vulnIndicators: ['test'], verificationMethod: 'source_analysis' },
      { fork: makeForkMatch({ chain: 'arbitrum' }), status: 'patched', confidence: 80, sourceAvailable: true, patchIndicators: ['guard'], vulnIndicators: [], verificationMethod: 'source_analysis' },
      { fork: makeForkMatch({ chain: 'polygon' }), status: 'vulnerable', confidence: 85, sourceAvailable: true, patchIndicators: [], vulnIndicators: ['test'], verificationMethod: 'source_analysis' },
      { fork: makeForkMatch({ chain: 'base' }), status: 'uncertain', confidence: 50, sourceAvailable: false, patchIndicators: [], vulnIndicators: [], verificationMethod: 'bytecode_only' },
    ];
    const summary = buildSummary(results);
    assert.equal(summary.totalForksChecked, 4);
    assert.equal(summary.vulnerableCount, 2);
    assert.equal(summary.patchedCount, 1);
    assert.equal(summary.uncertainCount, 1);
    assert.equal(summary.errorCount, 0);
    assert.equal(summary.highestConfidence, 90);
    assert.ok(summary.chainsAffected.includes('bsc'));
    assert.ok(summary.chainsAffected.includes('polygon'));
  });
});

// ── PoC Adapter Tests ──

import { adaptPoC, mapTokenAddress, getChainTokenAddresses, adaptPoCForForks } from '../hunt-forks/poc-adapter.js';
import type { PoCTemplate, AdaptedPoC } from '../hunt-forks/poc-adapter.js';

describe('PoC Adapter', () => {
  const makeTemplate = (): PoCTemplate => ({
    code: `
// Test PoC
address target = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
address weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
vm.createFork("https://eth-mainnet.example.com");
`,
    vulnType: 'reentrancy',
    originalAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    originalChain: 'ethereum',
    rpcUrl: 'https://eth-mainnet.example.com',
  });

  const makeFork = (overrides: Partial<HuntForkMatch> = {}): HuntForkMatch => ({
    address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    chain: 'bsc',
    chainId: 56,
    name: 'PancakeRouter',
    similarity: {
      overall: 95,
      selectorOverlap: 92,
      codeSizeSimilarity: 98,
      exactMatch: false,
      classification: 'exact_fork',
    },
    matchType: 'exact_fork',
    sourceAvailable: true,
    bytecodeSignature: {
      functionSelectors: [],
      normalizedHash: 'test',
      codeSize: 1000,
      rawBytecodeHash: 'test',
    },
    ...overrides,
  });

  it('should replace target contract address', () => {
    const template = makeTemplate();
    const fork = makeFork();
    const adapted = adaptPoC(template, fork);
    assert.ok(adapted.code.includes(fork.address));
    assert.ok(!adapted.code.includes(template.originalAddress));
  });

  it('should replace WETH with WBNB on BSC', () => {
    const template = makeTemplate();
    const fork = makeFork();
    const adapted = adaptPoC(template, fork);
    // Should have replaced WETH address with WBNB
    assert.ok(!adapted.code.includes('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'));
    assert.ok(adapted.replacements.some(r => r.reason.includes('wrapped_native')));
  });

  it('should replace RPC URL', () => {
    const template = makeTemplate();
    const fork = makeFork();
    const adapted = adaptPoC(template, fork);
    assert.ok(!adapted.code.includes('https://eth-mainnet.example.com'));
    assert.ok(adapted.rpcUrl.length > 0);
  });

  it('should track replacements', () => {
    const template = makeTemplate();
    const fork = makeFork();
    const adapted = adaptPoC(template, fork);
    assert.ok(adapted.replacements.length > 0);
    assert.ok(adapted.replacements.some(r => r.reason === 'Target contract address'));
  });

  it('should warn for modified forks', () => {
    const template = makeTemplate();
    const fork = makeFork({ matchType: 'modified_fork' });
    const adapted = adaptPoC(template, fork);
    assert.ok(adapted.warnings.some(w => w.includes('Modified fork')));
  });

  it('should have lower confidence for related contracts', () => {
    const template = makeTemplate();
    const exactFork = makeFork();
    const relatedFork = makeFork({ matchType: 'related', similarity: { overall: 65, selectorOverlap: 60, codeSizeSimilarity: 70, exactMatch: false, classification: 'related' } });

    const exactAdapted = adaptPoC(template, exactFork);
    const relatedAdapted = adaptPoC(template, relatedFork);
    assert.ok(relatedAdapted.confidence < exactAdapted.confidence);
  });

  it('should map token addresses across chains', () => {
    const wethOnBsc = mapTokenAddress(
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      'ethereum',
      'bsc',
    );
    assert.ok(wethOnBsc);
    assert.equal(wethOnBsc, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
  });

  it('should return null for unmapped token', () => {
    const result = mapTokenAddress('0x0000000000000000000000000000000000000001', 'ethereum', 'bsc');
    assert.equal(result, null);
  });

  it('should get chain token addresses', () => {
    const tokens = getChainTokenAddresses('ethereum');
    assert.ok(tokens.wrapped_native);
    assert.ok(tokens.usdc);
  });

  it('should batch adapt PoC for multiple forks', () => {
    const template = makeTemplate();
    const forks = [makeFork(), makeFork({ chain: 'arbitrum', chainId: 42161, address: '0xAAAA' })];
    const results = adaptPoCForForks(template, forks);
    assert.equal(results.length, 2);
  });
});

// ── Cascade Report Tests ──

import { generateCascadeReport } from '../hunt-forks/cascade-report.js';
import type { CascadeReportInput } from '../hunt-forks/cascade-report.js';

describe('Cascade Report Generator', () => {
  it('should generate markdown and JSON report', () => {
    const input: CascadeReportInput = {
      input: {
        sessionId: 'test-session',
        contractAddress: '0x1234',
        chain: 'ethereum',
        chainId: 1,
        contractName: 'TestContract',
        vulnType: 'reentrancy',
        vulnTitle: 'Reentrancy in withdraw',
      },
      huntResult: {
        originalContract: {
          address: '0x1234',
          chain: 'ethereum',
          chainId: 1,
          name: 'TestContract',
          vulnType: 'reentrancy',
          vulnTitle: 'Reentrancy in withdraw',
        },
        signature: { functionSelectors: [], normalizedHash: 'abc', codeSize: 1000, rawBytecodeHash: 'def' },
        chainResults: [
          { chain: 'bsc', chainId: 56, matches: [], candidatesChecked: 10, searchDuration: 5000 },
        ],
        totalMatches: 1,
        totalChainsSearched: 1,
        totalChainsWithMatches: 1,
        topMatches: [],
        duration: 10000,
      },
      cascadeResult: {
        originalContract: { address: '0x1234', chain: 'ethereum', chainId: 1, name: 'TestContract', vulnType: 'reentrancy', vulnTitle: 'Reentrancy in withdraw' },
        originalFinding: { id: 'f1', agentId: 'test', vulnType: 'reentrancy', severity: 'high', title: 'Reentrancy', description: 'test', location: 'test', verified: false },
        forkResults: [
          {
            fork: {
              address: '0xBBBB',
              chain: 'bsc',
              chainId: 56,
              name: 'ForkContract',
              similarity: { overall: 92, selectorOverlap: 90, codeSizeSimilarity: 95, exactMatch: false, classification: 'modified_fork' },
              matchType: 'modified_fork',
              sourceAvailable: true,
              bytecodeSignature: { functionSelectors: [], normalizedHash: 'x', codeSize: 1000, rawBytecodeHash: 'y' },
            },
            status: 'vulnerable',
            confidence: 85,
            sourceAvailable: true,
            patchIndicators: [],
            vulnIndicators: ['External call with value'],
            verificationMethod: 'source_analysis',
          },
        ],
        summary: { totalForksChecked: 1, vulnerableCount: 1, patchedCount: 0, uncertainCount: 0, errorCount: 0, highestConfidence: 85, chainsAffected: ['bsc'] },
        duration: 3000,
      },
      phaseResults: [
        { phase: 'bytecode-extraction', status: 'success', duration: 1000, deliverables: [], errors: [], metadata: {} },
        { phase: 'fork-discovery', status: 'success', duration: 5000, deliverables: [], errors: [], metadata: {} },
      ],
    };

    const report = generateCascadeReport(input);

    // Check markdown
    assert.ok(report.markdown.includes('Cascade Hunt Report'));
    assert.ok(report.markdown.includes('TestContract'));
    assert.ok(report.markdown.includes('Vulnerable Forks'));
    assert.ok(report.markdown.includes('Submission Plan'));

    // Check JSON
    assert.equal(report.json.originalContract.address, '0x1234');
    assert.equal(report.json.summary.vulnerableForksFound, 1);
    assert.equal(report.json.vulnerableForks.length, 1);
    assert.equal(report.json.submissionPlan.length, 1);
    assert.equal(report.json.submissionPlan[0].priority, 1);
  });

  it('should handle empty results', () => {
    const input: CascadeReportInput = {
      input: {
        sessionId: 'empty-session',
        contractAddress: '0x0000',
        chain: 'ethereum',
        chainId: 1,
        contractName: 'Empty',
        vulnType: 'logic',
        vulnTitle: 'No vulns found',
      },
      huntResult: {
        originalContract: { address: '0x0000', chain: 'ethereum', chainId: 1, name: 'Empty', vulnType: 'logic', vulnTitle: 'test' },
        signature: { functionSelectors: [], normalizedHash: '', codeSize: 0, rawBytecodeHash: '' },
        chainResults: [],
        totalMatches: 0,
        totalChainsSearched: 0,
        totalChainsWithMatches: 0,
        topMatches: [],
        duration: 100,
      },
      phaseResults: [],
    };

    const report = generateCascadeReport(input);
    assert.ok(report.markdown.includes('Cascade Hunt Report'));
    assert.equal(report.json.summary.totalForksFound, 0);
    assert.equal(report.json.vulnerableForks.length, 0);
    assert.equal(report.json.submissionPlan.length, 0);
  });
});

// ── TVL Lookup Tests ──

import { sortByTVL, prioritizeForkMatches } from '../hunt-forks/tvl-lookup.js';
import type { TVLData, PrioritizedFork } from '../hunt-forks/tvl-lookup.js';

describe('TVL Lookup', () => {
  const makeCascadeForkResult = (chain: string, name: string, confidence: number, similarity: number): CascadeForkResult => ({
    fork: {
      address: `0x${chain}${name}`.slice(0, 42).padEnd(42, '0'),
      chain,
      chainId: chain === 'bsc' ? 56 : chain === 'arbitrum' ? 42161 : 1,
      name,
      similarity: { overall: similarity, selectorOverlap: similarity, codeSizeSimilarity: similarity, exactMatch: false, classification: 'modified_fork' as const },
      matchType: 'modified_fork' as const,
      sourceAvailable: true,
      bytecodeSignature: { functionSelectors: [], normalizedHash: '', codeSize: 1000, rawBytecodeHash: '' },
    },
    status: 'vulnerable' as const,
    confidence,
    sourceAvailable: true,
    patchIndicators: [],
    vulnIndicators: [],
    verificationMethod: 'source_analysis' as const,
  });

  it('should prioritize forks by TVL', () => {
    const forks = [
      makeCascadeForkResult('bsc', 'LowTVL', 85, 90),
      makeCascadeForkResult('arbitrum', 'HighTVL', 85, 90),
    ];

    const tvlData = new Map<string, TVLData>([
      ['LowTVL', { totalTvl: 100_000, chainTvl: 50_000, lastUpdated: new Date().toISOString() }],
      ['HighTVL', { totalTvl: 50_000_000, chainTvl: 30_000_000, lastUpdated: new Date().toISOString() }],
    ]);

    const prioritized = sortByTVL(forks, tvlData);
    assert.equal(prioritized.length, 2);
    assert.equal(prioritized[0].fork.name, 'HighTVL');
    assert.equal(prioritized[0].priority, 1);
    assert.equal(prioritized[1].fork.name, 'LowTVL');
    assert.equal(prioritized[1].priority, 2);
  });

  it('should handle forks without TVL data', () => {
    const forks = [
      makeCascadeForkResult('polygon', 'NoTVL', 80, 85),
    ];

    const tvlData = new Map<string, TVLData>();
    const prioritized = sortByTVL(forks, tvlData);
    assert.equal(prioritized.length, 1);
    assert.equal(prioritized[0].tvl, null);
    assert.equal(prioritized[0].priority, 1);
  });

  it('should prioritize fork matches by TVL', () => {
    const forkA: HuntForkMatch = {
      address: '0xAAAA',
      chain: 'bsc',
      chainId: 56,
      name: 'Low',
      similarity: { overall: 90, selectorOverlap: 85, codeSizeSimilarity: 95, exactMatch: false, classification: 'modified_fork' },
      matchType: 'modified_fork',
      sourceAvailable: true,
      bytecodeSignature: { functionSelectors: [], normalizedHash: '', codeSize: 1000, rawBytecodeHash: '' },
    };
    const forkB: HuntForkMatch = {
      ...forkA,
      address: '0xBBBB',
      name: 'High',
    };

    const tvlData = new Map<string, TVLData>([
      ['Low', { totalTvl: 1000, chainTvl: 500, lastUpdated: '' }],
      ['High', { totalTvl: 10_000_000, chainTvl: 5_000_000, lastUpdated: '' }],
    ]);

    const sorted = prioritizeForkMatches([forkA, forkB], tvlData);
    assert.equal(sorted[0].name, 'High');
  });
});

// ── Cascade Shared Types Tests ──

import { CASCADE_PHASES, CASCADE_TASK_QUEUE, CASCADE_WORKFLOW_ID_PREFIX, CASCADE_PROGRESS_QUERY } from '../temporal/cascade-shared.js';

describe('Cascade Shared Types', () => {
  it('should define 5 cascade phases', () => {
    assert.equal(CASCADE_PHASES.length, 5);
    assert.ok(CASCADE_PHASES.includes('bytecode-extraction'));
    assert.ok(CASCADE_PHASES.includes('fork-discovery'));
    assert.ok(CASCADE_PHASES.includes('cascade-verification'));
    assert.ok(CASCADE_PHASES.includes('poc-adaptation'));
    assert.ok(CASCADE_PHASES.includes('report-generation'));
  });

  it('should define task queue constant', () => {
    assert.equal(CASCADE_TASK_QUEUE, 'cascade-queue');
  });

  it('should define workflow ID prefix', () => {
    assert.equal(CASCADE_WORKFLOW_ID_PREFIX, 'cascade-hunt');
  });

  it('should define progress query name', () => {
    assert.equal(CASCADE_PROGRESS_QUERY, 'cascade-progress');
  });
});
