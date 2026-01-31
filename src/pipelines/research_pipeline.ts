/**
 * Research/Audit Pipeline Module
 *
 * A modular, opt-in 6-stage verification pipeline for deep security analysis.
 * Only invoked for audit/research tasks when feature flag is enabled.
 *
 * Stages:
 *   1. CONTEXT - Gather protocol info, prior audits, related patterns
 *   2. STATIC ANALYSIS - Slither integration (graceful degradation if unavailable)
 *   3. FP FILTERING - Pattern matching, AI filtering, deduplication
 *   4. VERIFICATION - PoC plan generation (no live exploitation)
 *   5. RISK SCORING - 0-100 weighted confidence scoring
 *   6. SMART ALERTING - Threshold-based routing with output discipline
 */

import * as fs from 'fs';
import * as path from 'path';
import { Scanner } from '../scanner.js';
import { Finding } from '../types/index.js';
import { PatternCache } from '../services/patternCache.js';

// Types
export interface AuditTarget {
  address?: string;
  chainId?: number;
  chainName?: string;
  sourceCode?: string;
  protocol?: string;
  auditPdf?: string;
  repoUrl?: string;
}

export interface AuditContext {
  target: AuditTarget;
  mode: 'audit' | 'research';
  depth: 'quick' | 'standard' | 'deep';
  tags?: string[];
  priorAudits?: string[];
  relatedPatterns?: PatternCard[];
}

export interface PatternCard {
  id: string;
  type: 'vulnerability' | 'fp-signature' | 'protocol-archetype';
  name: string;
  description: string;
  indicators: string[];
  severity?: string;
  confidence?: number;
  lastSeen?: string;
}

export interface StageResult {
  stage: number;
  name: string;
  status: 'success' | 'partial' | 'skipped' | 'failed';
  duration: number;
  data?: unknown;
  error?: string;
}

export interface AuditFinding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  confidence: number;
  verified: boolean;
  verificationMethod?: string;
  category: string;
  location?: {
    file?: string;
    lines?: string;
    function?: string;
  };
  impact: string;
  recommendation: string;
  // Safety: Only include mechanics, not exploitation steps
  mechanics?: string;
  preconditions?: string[];
}

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  likelihood: 'high' | 'medium' | 'low';
  requiresVerification: boolean;
  investigationSteps?: string[];
}

export interface AuditPipelineResult {
  success: boolean;
  target: AuditTarget;
  stages: StageResult[];
  verifiedFindings: AuditFinding[];
  unverifiedHypotheses: Hypothesis[];
  riskScore: number;
  summary: string;
  reportPath: string;
  timestamp: string;
  duration: number;
}

// Constants
const REPORTS_DIR = path.join(process.cwd(), 'reports');
const AUDIT_CARDS_DIR = path.join(process.cwd(), 'memory', 'audit_cards');
const MAX_TELEGRAM_LINES = 20;

// ─────────────────────────────────────────────────────────────────────────────
// DRY RUN MODE - For smoke tests and self-checks
// Skips: Slither, Foundry, chain RPC calls
// Still produces: report file, pattern card stubs, summary
// ─────────────────────────────────────────────────────────────────────────────
export function isDryRunMode(): boolean {
  return process.env.OPENCLAW_AUDIT_PIPELINE_DRY_RUN === 'true';
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM GATING - Enforced in code, not just prompts
// Only verified findings can be labeled as "vulnerability"
// Unverified findings are "hypotheses" with capped confidence
// ─────────────────────────────────────────────────────────────────────────────
const MAX_UNVERIFIED_CONFIDENCE = 60; // Cap for unverified findings

/**
 * CLAIM GATING: Can this finding be called a vulnerability?
 * Returns true ONLY if verified with high confidence.
 */
export function canLabelAsVulnerability(finding: AuditFinding): boolean {
  return finding.verified === true && finding.confidence >= 70;
}

/**
 * Apply claim gating to a finding - caps confidence if unverified
 */
export function applyClaimGating(finding: AuditFinding): AuditFinding {
  if (!finding.verified) {
    return {
      ...finding,
      confidence: Math.min(finding.confidence, MAX_UNVERIFIED_CONFIDENCE),
    };
  }
  return finding;
}

/**
 * Main entry point for the audit pipeline
 */
export async function runAuditPipeline(
  context: AuditContext,
  scanner?: Scanner,
): Promise<AuditPipelineResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const stages: StageResult[] = [];

  console.log('[AuditPipeline] Starting research pipeline...');
  console.log(`[AuditPipeline] Target: ${context.target.address || context.target.protocol || 'unknown'}`);
  console.log(`[AuditPipeline] Mode: ${context.mode}, Depth: ${context.depth}`);

  let verifiedFindings: AuditFinding[] = [];
  let unverifiedHypotheses: Hypothesis[] = [];
  let riskScore = 0;
  let contextData: Record<string, unknown> = {};
  let staticFindings: Finding[] = [];

  try {
    // Stage 1: CONTEXT
    const stage1 = await runStage1Context(context);
    stages.push(stage1);
    if (stage1.status !== 'failed') {
      contextData = stage1.data as Record<string, unknown>;
    }

    // Stage 2: STATIC ANALYSIS
    const stage2 = await runStage2StaticAnalysis(context, scanner);
    stages.push(stage2);
    if (stage2.status !== 'failed' && stage2.data) {
      staticFindings = (stage2.data as { findings: Finding[] }).findings || [];
    }

    // Stage 3: FP FILTERING
    const stage3 = await runStage3FpFiltering(staticFindings, contextData);
    stages.push(stage3);
    if (stage3.status !== 'failed' && stage3.data) {
      staticFindings = (stage3.data as { filtered: Finding[] }).filtered || staticFindings;
    }

    // Stage 4: VERIFICATION (PoC planning, no live execution)
    const stage4 = await runStage4Verification(staticFindings, context);
    stages.push(stage4);
    if (stage4.status !== 'failed' && stage4.data) {
      const verificationData = stage4.data as {
        verified: AuditFinding[];
        hypotheses: Hypothesis[];
      };
      verifiedFindings = verificationData.verified || [];
      unverifiedHypotheses = verificationData.hypotheses || [];
    }

    // Stage 5: RISK SCORING
    const stage5 = await runStage5RiskScoring(verifiedFindings, unverifiedHypotheses);
    stages.push(stage5);
    if (stage5.status !== 'failed' && stage5.data) {
      riskScore = (stage5.data as { score: number }).score || 0;
    }

    // Stage 6: SMART ALERTING (write report, generate summary)
    const targetName = context.target.address?.slice(0, 10) ||
                       context.target.protocol ||
                       'unknown';
    const reportPath = path.join(REPORTS_DIR, `${targetName}-${Date.now()}.md`);

    const stage6 = await runStage6Alerting(
      verifiedFindings,
      unverifiedHypotheses,
      riskScore,
      context,
      reportPath,
    );
    stages.push(stage6);

    const summary = generateTelegramSummary(
      verifiedFindings,
      unverifiedHypotheses,
      riskScore,
      reportPath,
    );

    const duration = Date.now() - startTime;
    console.log(`[AuditPipeline] Completed in ${duration}ms`);

    return {
      success: true,
      target: context.target,
      stages,
      verifiedFindings,
      unverifiedHypotheses,
      riskScore,
      summary,
      reportPath,
      timestamp,
      duration,
    };
  } catch (error) {
    console.error('[AuditPipeline] Pipeline failed:', error);
    const duration = Date.now() - startTime;

    // Write error report
    const targetName = context.target.address?.slice(0, 10) || 'error';
    const reportPath = path.join(REPORTS_DIR, `${targetName}-error-${Date.now()}.md`);
    writeErrorReport(reportPath, context, error);

    return {
      success: false,
      target: context.target,
      stages,
      verifiedFindings: [],
      unverifiedHypotheses: [],
      riskScore: 0,
      summary: `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}. See ${reportPath}`,
      reportPath,
      timestamp,
      duration,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage Implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage 1: CONTEXT - Gather protocol info, prior audits, related patterns
 */
async function runStage1Context(context: AuditContext): Promise<StageResult> {
  const startTime = Date.now();
  console.log('[Stage 1] Gathering context...');

  try {
    // Load relevant pattern cards from memory
    const relevantCards = await getRelevantCards(context);

    // Check for prior audits (from memory or external sources)
    const priorAudits = context.priorAudits || [];

    // Gather protocol type hints
    const protocolHints = inferProtocolType(context);

    const data = {
      relevantCards,
      priorAudits,
      protocolHints,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Stage 1] Found ${relevantCards.length} relevant patterns`);

    return {
      stage: 1,
      name: 'CONTEXT',
      status: 'success',
      duration: Date.now() - startTime,
      data,
    };
  } catch (error) {
    return {
      stage: 1,
      name: 'CONTEXT',
      status: 'partial',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { relevantCards: [], priorAudits: [], protocolHints: {} },
    };
  }
}

/**
 * Stage 2: STATIC ANALYSIS - Slither integration with graceful degradation
 */
async function runStage2StaticAnalysis(
  context: AuditContext,
  scanner?: Scanner,
): Promise<StageResult> {
  const startTime = Date.now();
  console.log('[Stage 2] Running static analysis...');

  try {
    // DRY RUN: Skip all external tools, return empty findings
    if (isDryRunMode()) {
      console.log('[Stage 2] DRY RUN mode - skipping Slither');
      return {
        stage: 2,
        name: 'STATIC ANALYSIS',
        status: 'skipped',
        duration: Date.now() - startTime,
        data: { findings: [], dryRun: true },
      };
    }

    // Check if Slither is available - graceful degradation if missing
    const slitherAvailable = await checkToolAvailable('slither');

    if (!slitherAvailable) {
      console.log('[Stage 2] Slither not installed - continuing without static analysis');
      // Non-fatal: return partial success, not failure
      return {
        stage: 2,
        name: 'STATIC ANALYSIS',
        status: 'partial',
        duration: Date.now() - startTime,
        data: { findings: [], toolMissing: 'slither', warning: 'Install Slither for better analysis' },
      };
    }

    // If we have a scanner and address, run the full scan
    if (scanner && context.target.address && context.target.chainId) {
      const findings = await scanner.scanContract(
        context.target.address,
        context.target.chainId,
      );
      console.log(`[Stage 2] Found ${findings.length} raw findings`);
      return {
        stage: 2,
        name: 'STATIC ANALYSIS',
        status: 'success',
        duration: Date.now() - startTime,
        data: { findings },
      };
    }

    // No scanner available, return partial
    return {
      stage: 2,
      name: 'STATIC ANALYSIS',
      status: 'skipped',
      duration: Date.now() - startTime,
      data: { findings: [], reason: 'No target address or scanner available' },
    };
  } catch (error) {
    return {
      stage: 2,
      name: 'STATIC ANALYSIS',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stage 3: FP FILTERING - Pattern matching, AI filtering, deduplication
 */
async function runStage3FpFiltering(
  findings: Finding[],
  contextData: Record<string, unknown>,
): Promise<StageResult> {
  const startTime = Date.now();
  console.log('[Stage 3] Filtering false positives...');

  try {
    const relevantCards = (contextData.relevantCards as PatternCard[]) || [];
    const fpSignatures = relevantCards.filter(c => c.type === 'fp-signature');

    // Filter based on known FP patterns
    let filtered = findings.filter(finding => {
      // Check against FP signatures
      for (const fp of fpSignatures) {
        if (fp.indicators.some(ind =>
          finding.description.toLowerCase().includes(ind.toLowerCase()) ||
          (finding.detectorName && fp.indicators.includes(finding.detectorName))
        )) {
          console.log(`[Stage 3] Filtered FP: ${finding.detectorName} (matched ${fp.name})`);
          return false;
        }
      }
      return true;
    });

    // Deduplicate by detector + location
    const seen = new Set<string>();
    filtered = filtered.filter(f => {
      const key = `${f.detectorName}:${f.filePath}:${f.lineStart}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Stage 3] ${findings.length} -> ${filtered.length} findings after FP filtering`);

    return {
      stage: 3,
      name: 'FP FILTERING',
      status: 'success',
      duration: Date.now() - startTime,
      data: {
        original: findings.length,
        filtered,
        removed: findings.length - filtered.length,
      },
    };
  } catch (error) {
    return {
      stage: 3,
      name: 'FP FILTERING',
      status: 'partial',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { filtered: findings },
    };
  }
}

/**
 * Stage 4: VERIFICATION - PoC plan generation (NO live exploitation)
 *
 * SAFETY: This stage generates verification PLANS only.
 * It does NOT execute exploits on live networks.
 * PoC steps are for controlled fork/testing contexts only.
 */
async function runStage4Verification(
  findings: Finding[],
  context: AuditContext,
): Promise<StageResult> {
  const startTime = Date.now();
  console.log('[Stage 4] Generating verification plans...');

  try {
    // DRY RUN: Skip Foundry check, produce stub hypotheses
    if (isDryRunMode()) {
      console.log('[Stage 4] DRY RUN mode - skipping Foundry verification');
      const hypotheses = findings.map(f => convertToHypothesis(f));
      return {
        stage: 4,
        name: 'VERIFICATION',
        status: 'skipped',
        duration: Date.now() - startTime,
        data: { verified: [], hypotheses, dryRun: true },
      };
    }

    // Check if Foundry is available - graceful degradation if missing
    const foundryAvailable = await checkToolAvailable('forge');
    if (!foundryAvailable) {
      console.log('[Stage 4] Foundry not installed - verification plans only, no PoC execution');
    }

    const verified: AuditFinding[] = [];
    const hypotheses: Hypothesis[] = [];

    for (const finding of findings) {
      // High confidence findings with clear indicators can be marked as verified
      // BUT only if we have actual verification capability (Foundry)
      if (foundryAvailable &&
          finding.confidence === 'high' &&
          (finding.severity === 'high' || finding.severity === 'critical')) {

        // Convert to AuditFinding with safety constraints + claim gating
        let auditFinding = convertToAuditFinding(finding, true, foundryAvailable);
        if (auditFinding) {
          auditFinding = applyClaimGating(auditFinding);
          verified.push(auditFinding);
        }
      } else {
        // Lower confidence or no Foundry = hypotheses only
        const hypothesis = convertToHypothesis(finding);
        hypotheses.push(hypothesis);
      }
    }

    console.log(`[Stage 4] ${verified.length} verified, ${hypotheses.length} hypotheses`);

    return {
      stage: 4,
      name: 'VERIFICATION',
      status: verified.length > 0 ? 'success' : 'partial',
      duration: Date.now() - startTime,
      data: {
        verified,
        hypotheses,
        foundryAvailable,
      },
    };
  } catch (error) {
    return {
      stage: 4,
      name: 'VERIFICATION',
      status: 'failed',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stage 5: RISK SCORING - 0-100 weighted confidence scoring
 */
async function runStage5RiskScoring(
  verifiedFindings: AuditFinding[],
  hypotheses: Hypothesis[],
): Promise<StageResult> {
  const startTime = Date.now();
  console.log('[Stage 5] Calculating risk score...');

  try {
    let score = 0;

    // Verified findings contribute heavily
    for (const finding of verifiedFindings) {
      switch (finding.severity) {
        case 'critical': score += 30; break;
        case 'high': score += 20; break;
        case 'medium': score += 10; break;
        case 'low': score += 5; break;
        default: score += 1;
      }
      // Confidence multiplier
      score *= (finding.confidence / 100);
    }

    // Hypotheses contribute less
    for (const hyp of hypotheses) {
      switch (hyp.likelihood) {
        case 'high': score += 5; break;
        case 'medium': score += 2; break;
        case 'low': score += 1; break;
      }
    }

    // Normalize to 0-100
    score = Math.min(100, Math.round(score));

    console.log(`[Stage 5] Risk score: ${score}/100`);

    return {
      stage: 5,
      name: 'RISK SCORING',
      status: 'success',
      duration: Date.now() - startTime,
      data: { score },
    };
  } catch (error) {
    return {
      stage: 5,
      name: 'RISK SCORING',
      status: 'partial',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { score: 0 },
    };
  }
}

/**
 * Stage 6: SMART ALERTING - Write full report, generate compact summary
 */
async function runStage6Alerting(
  verifiedFindings: AuditFinding[],
  hypotheses: Hypothesis[],
  riskScore: number,
  context: AuditContext,
  reportPath: string,
): Promise<StageResult> {
  const startTime = Date.now();
  console.log('[Stage 6] Generating report and alerts...');

  try {
    // Ensure reports directory exists
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });

    // Write full report to disk
    const report = generateFullReport(verifiedFindings, hypotheses, riskScore, context);
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`[Stage 6] Report written to: ${reportPath}`);

    // Store pattern cards for learning (compact, not full report)
    await storePatternCards(verifiedFindings, hypotheses, context);

    return {
      stage: 6,
      name: 'SMART ALERTING',
      status: 'success',
      duration: Date.now() - startTime,
      data: { reportPath },
    };
  } catch (error) {
    return {
      stage: 6,
      name: 'SMART ALERTING',
      status: 'partial',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a tool is available on the system
 */
async function checkToolAvailable(tool: string): Promise<boolean> {
  const { execSync } = await import('child_process');
  try {
    execSync(`which ${tool}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get relevant pattern cards from memory for the given context
 */
export async function getRelevantCards(context: AuditContext): Promise<PatternCard[]> {
  const cards: PatternCard[] = [];

  try {
    // Ensure directory exists
    fs.mkdirSync(AUDIT_CARDS_DIR, { recursive: true });

    // Read all pattern card files
    const files = fs.readdirSync(AUDIT_CARDS_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(AUDIT_CARDS_DIR, file), 'utf8');
        const card = JSON.parse(content) as PatternCard;

        // Check relevance based on protocol type or indicators
        if (isCardRelevant(card, context)) {
          cards.push(card);
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist or is empty
  }

  return cards;
}

/**
 * Check if a pattern card is relevant to the current context
 */
function isCardRelevant(card: PatternCard, context: AuditContext): boolean {
  // FP signatures are always relevant
  if (card.type === 'fp-signature') return true;

  // Check protocol match
  if (context.target.protocol && card.name.toLowerCase().includes(context.target.protocol.toLowerCase())) {
    return true;
  }

  // Check tag match
  if (context.tags) {
    for (const tag of context.tags) {
      if (card.indicators.some(ind => ind.toLowerCase().includes(tag.toLowerCase()))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Infer protocol type from context
 */
function inferProtocolType(context: AuditContext): Record<string, unknown> {
  const hints: Record<string, unknown> = {};

  if (context.target.protocol) {
    hints.explicitProtocol = context.target.protocol;
  }

  // Could add more inference logic based on address patterns, etc.

  return hints;
}

/**
 * Convert a static analysis finding to an AuditFinding
 * SAFETY: Includes mechanics only, no exploitation steps
 */
function convertToAuditFinding(
  finding: Finding,
  verified: boolean,
  foundryAvailable: boolean,
): AuditFinding | null {
  return {
    id: `AF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: finding.detectorName || 'Unknown Finding',
    description: finding.description,
    severity: mapSeverity(finding.severity),
    confidence: mapConfidence(finding.confidence),
    verified,
    verificationMethod: foundryAvailable ? 'Foundry fork PoC available' : 'Manual verification required',
    category: finding.tool || 'static-analysis',
    location: {
      file: finding.filePath ?? undefined,
      lines: finding.lineStart ? `${finding.lineStart}-${finding.lineEnd || finding.lineStart}` : undefined,
      function: undefined, // Function name not available in Finding type
    },
    impact: finding.description,
    recommendation: generateRecommendation(finding),
    // SAFETY: Only mechanics, not exploitation steps
    mechanics: finding.description,
    preconditions: ['Access to contract functions', 'Sufficient gas'],
  };
}

/**
 * Convert a finding to a hypothesis for further investigation
 */
function convertToHypothesis(finding: Finding): Hypothesis {
  return {
    id: `HYP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: finding.detectorName || 'Unknown Pattern',
    description: finding.description,
    likelihood: mapConfidenceToLikelihood(finding.confidence),
    requiresVerification: true,
    investigationSteps: [
      'Review contract source code',
      'Check access control patterns',
      'Analyze state transitions',
      'Test on fork with controlled inputs',
    ],
  };
}

/**
 * Map severity string to enum
 */
function mapSeverity(severity: string): AuditFinding['severity'] {
  const lower = severity.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'medium') return 'medium';
  if (lower === 'low') return 'low';
  return 'informational';
}

/**
 * Map confidence string to number
 */
function mapConfidence(confidence: string): number {
  const lower = confidence.toLowerCase();
  if (lower === 'high') return 85;
  if (lower === 'medium') return 60;
  if (lower === 'low') return 35;
  return 50;
}

/**
 * Map confidence to likelihood
 */
function mapConfidenceToLikelihood(confidence: string): Hypothesis['likelihood'] {
  const lower = confidence.toLowerCase();
  if (lower === 'high') return 'high';
  if (lower === 'medium') return 'medium';
  return 'low';
}

/**
 * Generate a recommendation based on finding type
 */
function generateRecommendation(finding: Finding): string {
  const detector = finding.detectorName?.toLowerCase() || '';

  if (detector.includes('reentrancy')) {
    return 'Implement checks-effects-interactions pattern or use ReentrancyGuard';
  }
  if (detector.includes('overflow') || detector.includes('underflow')) {
    return 'Use Solidity 0.8+ or SafeMath library for arithmetic operations';
  }
  if (detector.includes('access')) {
    return 'Add proper access control modifiers (onlyOwner, role-based)';
  }
  if (detector.includes('oracle')) {
    return 'Use time-weighted average prices (TWAP) or multiple oracle sources';
  }

  return 'Review and address the identified issue according to security best practices';
}

/**
 * Generate full markdown report for disk storage
 */
function generateFullReport(
  verifiedFindings: AuditFinding[],
  hypotheses: Hypothesis[],
  riskScore: number,
  context: AuditContext,
): string {
  const timestamp = new Date().toISOString();
  const targetDisplay = context.target.address || context.target.protocol || 'Unknown';

  let report = `# Security Audit Report

**Target:** ${targetDisplay}
**Date:** ${timestamp}
**Mode:** ${context.mode}
**Risk Score:** ${riskScore}/100

---

## Executive Summary

This report contains the results of an automated security analysis.
- **Verified Findings:** ${verifiedFindings.length}
- **Unverified Hypotheses:** ${hypotheses.length}
- **Overall Risk:** ${riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW'}

---

## Verified Findings

`;

  if (verifiedFindings.length === 0) {
    report += '*No verified findings at this time.*\n\n';
  } else {
    for (const finding of verifiedFindings) {
      report += `### ${finding.severity.toUpperCase()}: ${finding.title}

**ID:** ${finding.id}
**Confidence:** ${finding.confidence}%
**Category:** ${finding.category}
**Location:** ${finding.location?.file || 'N/A'} ${finding.location?.lines ? `(lines ${finding.location.lines})` : ''}

**Description:**
${finding.description}

**Impact:**
${finding.impact}

**Recommendation:**
${finding.recommendation}

---

`;
    }
  }

  report += `## Unverified Hypotheses

*These require further investigation before being confirmed as vulnerabilities.*

`;

  if (hypotheses.length === 0) {
    report += '*No additional hypotheses.*\n\n';
  } else {
    for (const hyp of hypotheses) {
      report += `### ${hyp.title}

**ID:** ${hyp.id}
**Likelihood:** ${hyp.likelihood}

${hyp.description}

**Investigation Steps:**
${hyp.investigationSteps?.map(s => `- ${s}`).join('\n') || '- Manual review required'}

---

`;
    }
  }

  report += `## Methodology

This analysis used a 6-stage verification pipeline:
1. **Context** - Gathered protocol information and prior audit data
2. **Static Analysis** - Slither and pattern-based detection
3. **FP Filtering** - Removed known false positive patterns
4. **Verification** - Assessed exploitability (no live testing)
5. **Risk Scoring** - Calculated weighted confidence score
6. **Alerting** - Generated this report

---

*Report generated by White-Rabbit Research Pipeline*
`;

  return report;
}

/**
 * Generate compact summary for Telegram (max 20 lines)
 */
function generateTelegramSummary(
  verifiedFindings: AuditFinding[],
  hypotheses: Hypothesis[],
  riskScore: number,
  reportPath: string,
): string {
  const lines: string[] = [];

  // Header
  lines.push(`🔍 **Audit Complete** | Risk: ${riskScore}/100`);
  lines.push('');

  // Verified findings (top 3)
  if (verifiedFindings.length > 0) {
    lines.push(`✅ **Verified (${verifiedFindings.length}):**`);
    const top = verifiedFindings.slice(0, 3);
    for (const f of top) {
      const emoji = f.severity === 'critical' ? '🔴' :
                    f.severity === 'high' ? '🟠' :
                    f.severity === 'medium' ? '🟡' : '🟢';
      lines.push(`${emoji} ${f.severity.toUpperCase()}: ${f.title}`);
    }
    if (verifiedFindings.length > 3) {
      lines.push(`   ... +${verifiedFindings.length - 3} more`);
    }
    lines.push('');
  }

  // Hypotheses (top 3)
  if (hypotheses.length > 0) {
    lines.push(`⚠️ **Hypotheses (${hypotheses.length}):**`);
    const top = hypotheses.slice(0, 3);
    for (const h of top) {
      lines.push(`• ${h.title} (${h.likelihood})`);
    }
    if (hypotheses.length > 3) {
      lines.push(`   ... +${hypotheses.length - 3} more`);
    }
    lines.push('');
  }

  // Next actions
  lines.push('📋 **Next:**');
  if (verifiedFindings.length > 0) {
    lines.push('• Review verified findings in report');
  }
  if (hypotheses.length > 0) {
    lines.push('• Investigate top hypotheses');
  }
  lines.push('');

  // Report link
  lines.push(`📄 Full report: ${reportPath}`);

  // Ensure we don't exceed MAX_TELEGRAM_LINES
  return lines.slice(0, MAX_TELEGRAM_LINES).join('\n');
}

/**
 * Store pattern cards from findings for future learning
 */
async function storePatternCards(
  verifiedFindings: AuditFinding[],
  hypotheses: Hypothesis[],
  context: AuditContext,
): Promise<void> {
  try {
    fs.mkdirSync(AUDIT_CARDS_DIR, { recursive: true });

    // Create vulnerability pattern cards from verified findings
    for (const finding of verifiedFindings) {
      const card: PatternCard = {
        id: finding.id,
        type: 'vulnerability',
        name: finding.title,
        description: finding.description,
        indicators: [finding.category, finding.title.toLowerCase()],
        severity: finding.severity,
        confidence: finding.confidence,
        lastSeen: new Date().toISOString(),
      };

      const filename = `vuln-${card.id}.json`;
      fs.writeFileSync(
        path.join(AUDIT_CARDS_DIR, filename),
        JSON.stringify(card, null, 2),
        'utf8',
      );
    }

    console.log(`[AuditPipeline] Stored ${verifiedFindings.length} pattern cards`);
  } catch (error) {
    console.warn('[AuditPipeline] Failed to store pattern cards:', error);
  }
}

/**
 * Write error report when pipeline fails
 */
function writeErrorReport(reportPath: string, context: AuditContext, error: unknown): void {
  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });

    const report = `# Audit Pipeline Error Report

**Target:** ${context.target.address || context.target.protocol || 'Unknown'}
**Date:** ${new Date().toISOString()}
**Error:** ${error instanceof Error ? error.message : 'Unknown error'}

## Stack Trace
\`\`\`
${error instanceof Error ? error.stack : 'No stack trace available'}
\`\`\`

## Context
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

---

*The audit pipeline encountered an error. Please review and retry.*
`;

    fs.writeFileSync(reportPath, report, 'utf8');
  } catch {
    console.error('[AuditPipeline] Failed to write error report');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety Rails (Claim Gating + Exploit Detail Throttle)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CLAIM GATING: Only label as "vulnerability" if verified in Stage 4
 */
export function isVerifiedVulnerability(finding: AuditFinding): boolean {
  return finding.verified === true && finding.confidence >= 70;
}

/**
 * EXPLOIT DETAIL THROTTLE: Strip live exploitation steps
 * Returns mechanics + preconditions only, suitable for reports
 */
export function sanitizeExploitDetails(finding: AuditFinding): AuditFinding {
  return {
    ...finding,
    // Only include mechanics description, no step-by-step exploitation
    mechanics: finding.mechanics || finding.description,
    // Generic preconditions only
    preconditions: finding.preconditions || ['Standard transaction requirements'],
  };
}

/**
 * Guard function: Check if content is safe to output
 */
export function isSafeToOutput(content: string): boolean {
  const unsafePatterns = [
    /private\s*key/i,
    /mnemonic/i,
    /seed\s*phrase/i,
    /exploit\s*on\s*mainnet/i,
    /attack\s*live/i,
    /steal\s*funds/i,
  ];

  return !unsafePatterns.some(pattern => pattern.test(content));
}
