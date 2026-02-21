// ═══════════════════════════════════════════════════════════════════════════════
// Types Validation Tests - Verify type interfaces have correct shapes
// ═══════════════════════════════════════════════════════════════════════════════
//
// These tests verify at runtime that the exported types from types.ts produce
// objects with the expected field structure. Since TypeScript types are erased
// at runtime, we construct conforming objects and assert their shapes.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  IntelPatternMatch,
  IntelVulnerabilitySurface,
  ProtocolIntel,
  ProtocolInfo,
  SubmitFindingRequest,
  SubmitFindingResponse,
  ScannerConfig,
} from '../types.js';

describe('Type Shape Validation', () => {

  // ── IntelPatternMatch ──

  describe('IntelPatternMatch', () => {
    it('should have all required fields', () => {
      const match: IntelPatternMatch = {
        patternId: 'reentrancy-001',
        category: 'reentrancy',
        severity: 'high',
        title: 'Reentrancy via external call',
        relevanceScore: 0.92,
        detectionHints: ['call before state change', 'no mutex'],
        codeIndicators: ['.call{value:', 'balances[msg.sender]'],
      };

      assert.equal(typeof match.patternId, 'string');
      assert.equal(typeof match.category, 'string');
      assert.equal(typeof match.severity, 'string');
      assert.equal(typeof match.title, 'string');
      assert.equal(typeof match.relevanceScore, 'number');
      assert.ok(Array.isArray(match.detectionHints));
      assert.ok(Array.isArray(match.codeIndicators));

      // Verify specific field names exist
      const keys = Object.keys(match);
      assert.ok(keys.includes('patternId'), 'should have patternId');
      assert.ok(keys.includes('category'), 'should have category');
      assert.ok(keys.includes('severity'), 'should have severity');
      assert.ok(keys.includes('title'), 'should have title');
      assert.ok(keys.includes('relevanceScore'), 'should have relevanceScore');
      assert.ok(keys.includes('detectionHints'), 'should have detectionHints');
      assert.ok(keys.includes('codeIndicators'), 'should have codeIndicators');
    });
  });

  // ── IntelVulnerabilitySurface ──

  describe('IntelVulnerabilitySurface', () => {
    it('should have evmbenchPatternMatches, contractType, riskLevel, totalMatchingPatterns', () => {
      const surface: IntelVulnerabilitySurface = {
        evmbenchPatternMatches: [
          {
            patternId: 'p1',
            category: 'reentrancy',
            severity: 'high',
            title: 'Reentrancy',
            relevanceScore: 0.9,
            detectionHints: [],
            codeIndicators: [],
          },
        ],
        contractType: 'vault',
        riskLevel: 'critical',
        totalMatchingPatterns: 1,
      };

      assert.ok(Array.isArray(surface.evmbenchPatternMatches));
      assert.equal(surface.evmbenchPatternMatches.length, 1);
      assert.equal(typeof surface.contractType, 'string');
      assert.equal(surface.contractType, 'vault');
      assert.ok(
        ['critical', 'high', 'medium', 'low'].includes(surface.riskLevel),
        `riskLevel should be a valid level, got: ${surface.riskLevel}`,
      );
      assert.equal(typeof surface.totalMatchingPatterns, 'number');
      assert.equal(surface.totalMatchingPatterns, 1);
    });

    it('should accept all risk levels', () => {
      const levels: IntelVulnerabilitySurface['riskLevel'][] = ['critical', 'high', 'medium', 'low'];
      for (const level of levels) {
        const surface: IntelVulnerabilitySurface = {
          evmbenchPatternMatches: [],
          contractType: 'defi',
          riskLevel: level,
          totalMatchingPatterns: 0,
        };
        assert.equal(surface.riskLevel, level);
      }
    });
  });

  // ── ProtocolIntel extends ProtocolInfo ──

  describe('ProtocolIntel extends ProtocolInfo', () => {
    it('should have all ProtocolInfo base fields', () => {
      const intel: ProtocolIntel = {
        // ProtocolInfo base fields
        id: 'aave-v3',
        name: 'Aave V3',
        slug: 'aave-v3',
        chains: ['ethereum', 'polygon', 'arbitrum'],
        tvl: 12_500_000_000,
        category: 'lending',
        url: 'https://aave.com',

        // ProtocolIntel extension fields
        description: 'Decentralized lending protocol',
        website: 'https://aave.com',
        chainTvls: { ethereum: 8_000_000_000, polygon: 2_000_000_000 },
        primaryChain: 'ethereum',
        hasBounty: true,
        maxBounty: 250_000,
        programId: 'immunefi-aave',
        contracts: [
          {
            address: '0x1234',
            chain: 'ethereum',
            name: 'Pool',
            type: 'core',
            tvl: 8_000_000_000,
            isVerified: true,
            inScope: true,
            criticality: 'critical',
          },
        ],
        vulnerabilitySurface: {
          evmbenchPatternMatches: [],
          contractType: 'lending',
          riskLevel: 'high',
          totalMatchingPatterns: 0,
        },
        knownVulnerabilities: [],
        audits: [
          {
            auditor: 'Trail of Bits',
            date: '2024-01-15',
            findings: 12,
            highFindings: 2,
            criticalFindings: 0,
          },
        ],
        riskSignals: [
          { type: 'positive', signal: 'Multiple audits', weight: 0.8 },
        ],
        isFork: false,
        oracles: ['chainlink'],
        fetchedAt: '2026-02-21T00:00:00Z',
      };

      // Verify ProtocolInfo base fields
      assert.equal(typeof intel.id, 'string');
      assert.equal(typeof intel.name, 'string');
      assert.equal(typeof intel.slug, 'string');
      assert.ok(Array.isArray(intel.chains));
      assert.equal(typeof intel.tvl, 'number');
      assert.equal(typeof intel.category, 'string');
      assert.equal(typeof intel.url, 'string');

      // Verify ProtocolIntel extension fields
      assert.equal(typeof intel.primaryChain, 'string');
      assert.equal(typeof intel.hasBounty, 'boolean');
      assert.ok(Array.isArray(intel.contracts));
      assert.ok(intel.vulnerabilitySurface);
      assert.ok(Array.isArray(intel.knownVulnerabilities));
      assert.ok(Array.isArray(intel.audits));
      assert.ok(Array.isArray(intel.riskSignals));
      assert.equal(typeof intel.isFork, 'boolean');
      assert.ok(Array.isArray(intel.oracles));
      assert.equal(typeof intel.fetchedAt, 'string');
    });

    it('ProtocolIntel should be assignable to ProtocolInfo', () => {
      const intel: ProtocolIntel = {
        id: 'test',
        name: 'Test',
        slug: 'test',
        chains: ['ethereum'],
        tvl: 1000,
        category: 'defi',
        url: 'https://test.com',
        chainTvls: {},
        primaryChain: 'ethereum',
        hasBounty: false,
        contracts: [],
        vulnerabilitySurface: {
          evmbenchPatternMatches: [],
          contractType: 'defi',
          riskLevel: 'low',
          totalMatchingPatterns: 0,
        },
        knownVulnerabilities: [],
        audits: [],
        riskSignals: [],
        isFork: false,
        oracles: [],
        fetchedAt: new Date().toISOString(),
      };

      // Assignable to ProtocolInfo (structural subtype)
      const info: ProtocolInfo = intel;
      assert.equal(info.id, 'test');
      assert.equal(info.name, 'Test');
      assert.equal(info.slug, 'test');
    });
  });

  // ── SubmitFindingRequest ──

  describe('SubmitFindingRequest', () => {
    it('should have protocol_slug, title, severity, description', () => {
      const req: SubmitFindingRequest = {
        protocol_slug: 'compound-v3',
        title: 'Oracle Manipulation in PriceFeed',
        severity: 'critical',
        description: 'The price feed can be manipulated via flash loan...',
      };

      assert.equal(typeof req.protocol_slug, 'string');
      assert.equal(typeof req.title, 'string');
      assert.ok(
        ['critical', 'high', 'medium', 'low'].includes(req.severity),
        `severity should be valid, got: ${req.severity}`,
      );
      assert.equal(typeof req.description, 'string');
    });

    it('should accept optional fields', () => {
      const req: SubmitFindingRequest = {
        protocol_slug: 'uniswap',
        title: 'Test Finding',
        severity: 'low',
        description: null,
        poc_url: 'https://gist.github.com/example',
        scope_version: 2,
        session_id: 'sess-abc',
        agent_type: 'white-rabbit-skill',
        skill_version: '2.0.0',
        encrypted_report: {
          ciphertext: 'abc123',
          nonce: 'nonce123',
          sender_pubkey: 'pubkey123',
        },
      };

      assert.equal(req.poc_url, 'https://gist.github.com/example');
      assert.equal(req.scope_version, 2);
      assert.equal(req.session_id, 'sess-abc');
      assert.equal(req.agent_type, 'white-rabbit-skill');
      assert.equal(req.skill_version, '2.0.0');
      assert.ok(req.encrypted_report);
      assert.equal(req.encrypted_report!.ciphertext, 'abc123');
    });

    it('should enforce severity as one of critical/high/medium/low', () => {
      const validSeverities: SubmitFindingRequest['severity'][] = ['critical', 'high', 'medium', 'low'];

      for (const sev of validSeverities) {
        const req: SubmitFindingRequest = {
          protocol_slug: 'test',
          title: 'Test',
          severity: sev,
        };
        assert.equal(req.severity, sev);
      }
    });
  });

  // ── SubmitFindingResponse ──

  describe('SubmitFindingResponse', () => {
    it('should have finding with id, status, created_at', () => {
      const res: SubmitFindingResponse = {
        finding: {
          id: 'finding-001',
          protocol: 'aave',
          protocol_name: 'Aave',
          title: 'Reentrancy in withdraw',
          severity: 'high',
          status: 'pending',
          scope_version: 1,
          created_at: '2026-02-21T12:00:00Z',
        },
      };

      assert.equal(typeof res.finding.id, 'string');
      assert.equal(typeof res.finding.status, 'string');
      assert.equal(typeof res.finding.created_at, 'string');
      assert.equal(typeof res.finding.protocol, 'string');
      assert.equal(typeof res.finding.protocol_name, 'string');
      assert.equal(typeof res.finding.title, 'string');
      assert.equal(typeof res.finding.severity, 'string');
      assert.equal(typeof res.finding.scope_version, 'number');
    });
  });

  // ── ScannerConfig ──

  describe('ScannerConfig', () => {
    it('should have whiteclawsApiUrl, enableTelemetry, telemetryUrl, agentType fields', () => {
      const config: ScannerConfig = {
        whiteclawsApiUrl: 'https://whiteclaws.app',
        enableTelemetry: true,
        telemetryUrl: 'https://whiteclaws.app/api/telemetry/ingest/',
        agentType: 'white-rabbit-skill',
      };

      assert.equal(config.whiteclawsApiUrl, 'https://whiteclaws.app');
      assert.equal(config.enableTelemetry, true);
      assert.equal(config.telemetryUrl, 'https://whiteclaws.app/api/telemetry/ingest/');
      assert.equal(config.agentType, 'white-rabbit-skill');
    });

    it('should accept all optional fields', () => {
      const config: ScannerConfig = {
        etherscanApiKey: 'ethkey',
        whiteclawsApiKey: 'wckey',
        whiteclawsApiUrl: 'https://whiteclaws.app',
        anthropicApiKey: 'anthropickey',
        enableDeepAnalysis: true,
        enableMythril: false,
        enableSecurify: false,
        enableMaian: false,
        enableAI: true,
        minSeverity: 'medium',
        minConfidence: 'medium',
        timeoutMs: 60000,
        slitherTimeoutMs: 120000,
        mythrilTimeoutMs: 300000,
        outputFormat: 'json',
        outputPath: '/tmp/output.json',
        enableTelemetry: true,
        telemetryUrl: 'https://whiteclaws.app/api/telemetry/ingest/',
        agentType: 'test-agent',
      };

      const keys = Object.keys(config);
      assert.ok(keys.includes('etherscanApiKey'));
      assert.ok(keys.includes('whiteclawsApiKey'));
      assert.ok(keys.includes('whiteclawsApiUrl'));
      assert.ok(keys.includes('enableDeepAnalysis'));
      assert.ok(keys.includes('enableTelemetry'));
      assert.ok(keys.includes('telemetryUrl'));
      assert.ok(keys.includes('agentType'));
      assert.ok(keys.includes('minSeverity'));
      assert.ok(keys.includes('timeoutMs'));
    });

    it('should allow empty config (all fields optional)', () => {
      const config: ScannerConfig = {};
      assert.ok(config !== null);
      assert.equal(Object.keys(config).length, 0);
    });
  });
});
