/**
 * Immunefi report generator.
 *
 * Main report generation pipeline: reads verified findings from deliverables,
 * maps severity, formats PoC, and renders markdown/JSON output.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from '../agents/agent-types.js';
import type {
  ImmunefiReport,
  ImmunefiSubmission,
  ImmunefiSeverity,
  AssetInfo,
  VulnerabilityInfo,
  ImpactInfo,
  ProofOfConcept,
} from './immunefi-types.js';
import {
  mapToImmunefiSeverity,
  mapToVulnCategory,
  mapCWE,
  estimateExploitableValue,
} from './severity-mapper.js';
import {
  formatFoundryPoC,
  generateExploitSteps,
  sanitizePoC,
} from './poc-formatter.js';
import type { VerificationDeliverable } from './poc-formatter.js';

// ── Scanner version ──

let scannerVersion = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
  scannerVersion = pkg.version ?? '1.0.0';
} catch {
  // Ignore
}

// ── Report Generation ──

export interface ReportInput {
  sessionId: string;
  protocolName: string;
  chain: string;
  contractAddress: string;
  findings: Finding[];
  protocolMetadata?: { tvl?: number; contractBalance?: number };
  verificationResults?: Record<string, VerificationDeliverable>;
  programName?: string;
  programUrl?: string;
}

/**
 * Generate a complete Immunefi report from verified findings.
 */
export function generateImmunefiReport(input: ReportInput): ImmunefiReport {
  const {
    sessionId,
    protocolName,
    chain,
    contractAddress,
    findings,
    protocolMetadata,
    verificationResults,
    programName,
    programUrl,
  } = input;

  // Only include verified or likely-real findings
  const reportableFindings = findings.filter(f =>
    f.verified || f.severity === 'critical' || f.severity === 'high',
  );

  // Build submissions
  const submissions: ImmunefiSubmission[] = reportableFindings.map(finding => {
    const severity = mapToImmunefiSeverity(finding);
    const vulnCategory = mapToVulnCategory(finding);
    const cweId = mapCWE(finding.vulnType);
    const exploitableValue = estimateExploitableValue(finding, protocolMetadata);

    // Build PoC
    const verResult = verificationResults?.[finding.id];
    let poc: ProofOfConcept;
    if (verResult) {
      poc = formatFoundryPoC(verResult, finding);
    } else {
      const steps = generateExploitSteps(finding, finding.poc ?? '');
      poc = sanitizePoC({
        summary: `Exploit for: ${finding.title}`,
        environment: 'Foundry mainnet fork',
        steps,
        foundryTest: finding.poc || undefined,
        verifiedOnFork: finding.verified,
      });
    }

    // Build asset info
    const asset: AssetInfo = {
      type: 'smart_contract',
      chain: capitalizeChain(chain),
      address: contractAddress,
      name: protocolName,
      sourceVerified: true,
      compilerVersion: '',
    };

    // Build vulnerability info
    const vulnerability: VulnerabilityInfo = {
      title: finding.title,
      type: vulnCategory,
      severity,
      description: finding.description,
      rootCause: extractRootCause(finding),
      affectedFunctions: extractAffectedFunctions(finding),
      affectedLines: extractAffectedLines(finding),
      cweId,
    };

    // Build impact info
    const impact: ImpactInfo = {
      description: finding.estimatedImpact ?? buildImpactDescription(finding, exploitableValue),
      estimatedLoss: formatEstimatedLoss(exploitableValue),
      exploitableValueUsd: exploitableValue > 0 ? exploitableValue : undefined,
      affectedUsers: inferAffectedUsers(finding),
      prerequisites: inferPrerequisites(finding),
      attackComplexity: inferAttackComplexity(finding),
    };

    return {
      programName: programName ?? protocolName,
      programUrl: programUrl ?? '',
      asset,
      vulnerability,
      impact,
      proofOfConcept: poc,
      additionalInfo: '',
      submissionDate: new Date().toISOString(),
      scannerVersion,
      sessionId,
    };
  });

  // Compute severity counts
  const severityCounts: Record<ImmunefiSeverity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };
  for (const sub of submissions) {
    severityCounts[sub.vulnerability.severity]++;
  }

  const totalExploitableValueUsd = submissions.reduce(
    (sum, s) => sum + (s.impact.exploitableValueUsd ?? 0),
    0,
  );

  const executiveSummary = buildExecutiveSummary(
    protocolName,
    submissions.length,
    severityCounts,
    totalExploitableValueUsd,
  );

  return {
    protocolName,
    chain: capitalizeChain(chain),
    contractAddress,
    scannerVersion,
    sessionId,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    submissions,
    severityCounts,
    totalExploitableValueUsd,
  };
}

// ── Markdown Rendering ──

/**
 * Render a full Immunefi report as a markdown document.
 */
export function renderMarkdown(report: ImmunefiReport): string {
  const lines: string[] = [];

  lines.push(`# Security Assessment: ${report.protocolName}`);
  lines.push('');
  lines.push(`**Scanner:** White-Rabbit v${report.scannerVersion}`);
  lines.push(`**Date:** ${report.generatedAt.split('T')[0]}`);
  lines.push(`**Chain:** ${report.chain}`);
  lines.push(`**Contract:** ${report.contractAddress}`);
  lines.push(`**Session:** ${report.sessionId}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(report.executiveSummary);
  lines.push('');
  lines.push('---');

  for (let i = 0; i < report.submissions.length; i++) {
    const sub = report.submissions[i];
    lines.push('');
    lines.push(`## Finding #${i + 1}: ${sub.vulnerability.title}`);
    lines.push('');

    // Metadata table
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| Severity | ${sub.vulnerability.severity} |`);
    lines.push(`| Category | ${formatCategory(sub.vulnerability.type)} |`);
    if (sub.vulnerability.cweId) {
      lines.push(`| CWE | ${sub.vulnerability.cweId} |`);
    }
    lines.push(`| Contract | ${sub.asset.address} |`);
    if (sub.vulnerability.affectedFunctions.length > 0) {
      lines.push(`| Function | ${sub.vulnerability.affectedFunctions.join(', ')} |`);
    }
    if (sub.vulnerability.affectedLines.length > 0) {
      lines.push(`| Lines | ${sub.vulnerability.affectedLines.join(', ')} |`);
    }
    lines.push(`| Attack Complexity | ${sub.impact.attackComplexity} |`);
    if (sub.impact.exploitableValueUsd) {
      lines.push(`| Estimated Impact | $${sub.impact.exploitableValueUsd.toLocaleString()} |`);
    }

    // Description
    lines.push('');
    lines.push('### Description');
    lines.push('');
    lines.push(sub.vulnerability.description);

    // Root Cause
    lines.push('');
    lines.push('### Root Cause');
    lines.push('');
    lines.push(sub.vulnerability.rootCause);

    // Impact
    lines.push('');
    lines.push('### Impact');
    lines.push('');
    lines.push(sub.impact.description);

    // Prerequisites
    if (sub.impact.prerequisites.length > 0) {
      lines.push('');
      lines.push('### Prerequisites');
      lines.push('');
      for (const prereq of sub.impact.prerequisites) {
        lines.push(`- ${prereq}`);
      }
    }

    // Proof of Concept
    lines.push('');
    lines.push('### Proof of Concept');
    lines.push('');
    lines.push(`**Environment:** ${sub.proofOfConcept.environment}`);

    if (sub.proofOfConcept.steps.length > 0) {
      lines.push('');
      lines.push('**Steps to reproduce:**');
      for (const step of sub.proofOfConcept.steps) {
        lines.push(`${step.stepNumber}. ${step.description}`);
        if (step.code) {
          lines.push('```solidity');
          lines.push(step.code);
          lines.push('```');
        }
      }
    }

    if (sub.proofOfConcept.foundryTest) {
      lines.push('');
      lines.push('**Foundry Test:**');
      lines.push('```solidity');
      lines.push(sub.proofOfConcept.foundryTest);
      lines.push('```');
    }

    if (sub.proofOfConcept.exploitOutput) {
      lines.push('');
      lines.push('**Output:**');
      lines.push('```');
      lines.push(sub.proofOfConcept.exploitOutput);
      lines.push('```');
    }

    lines.push('');
    lines.push('---');
  }

  return lines.join('\n');
}

// ── JSON Rendering ──

/**
 * Render a report as machine-readable JSON.
 * One JSON object per finding.
 */
export function renderJSON(report: ImmunefiReport): string {
  return JSON.stringify(report, null, 2);
}

// ── Per-Finding Rendering ──

/**
 * Render separate markdown for each finding.
 * Returns a map of findingId → markdown content.
 */
export function renderPerFinding(report: ImmunefiReport): Map<string, string> {
  const result = new Map<string, string>();

  for (let i = 0; i < report.submissions.length; i++) {
    const sub = report.submissions[i];
    const findingId = `finding-${i + 1}`;

    // Build a single-finding report
    const singleReport: ImmunefiReport = {
      ...report,
      submissions: [sub],
      executiveSummary: `Single finding report: ${sub.vulnerability.title}`,
    };

    result.set(findingId, renderMarkdown(singleReport));
  }

  return result;
}

// ── Helper Functions ──

function capitalizeChain(chain: string): string {
  const names: Record<string, string> = {
    ethereum: 'Ethereum',
    bsc: 'BNB Chain',
    arbitrum: 'Arbitrum',
    base: 'Base',
    polygon: 'Polygon',
    optimism: 'Optimism',
    avalanche: 'Avalanche',
    blast: 'Blast',
    linea: 'Linea',
    scroll: 'Scroll',
    fantom: 'Fantom',
    gnosis: 'Gnosis',
    zksync: 'zkSync Era',
    mantle: 'Mantle',
  };
  return names[chain.toLowerCase()] ?? chain.charAt(0).toUpperCase() + chain.slice(1);
}

function formatCategory(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractRootCause(finding: Finding): string {
  const desc = finding.description;
  // Look for root cause markers in description
  const markers = ['root cause', 'because', 'due to', 'the issue is', 'this occurs'];
  for (const marker of markers) {
    const idx = desc.toLowerCase().indexOf(marker);
    if (idx !== -1) {
      // Extract sentence containing the marker
      const start = desc.lastIndexOf('.', idx) + 1;
      const end = desc.indexOf('.', idx + marker.length);
      if (end !== -1) {
        return desc.slice(start, end + 1).trim();
      }
    }
  }
  // Fallback: first 2 sentences
  const sentences = desc.split('.').filter(s => s.trim().length > 0);
  return sentences.slice(0, 2).join('.').trim() + '.';
}

function extractAffectedFunctions(finding: Finding): string[] {
  // Parse from location: "Contract:functionName:line"
  if (!finding.location) return [];
  const parts = finding.location.split(':');
  if (parts.length >= 2 && parts[1]) {
    return [parts[1]];
  }
  return [];
}

function extractAffectedLines(finding: Finding): string[] {
  if (!finding.location) return [];
  const parts = finding.location.split(':');
  if (parts.length >= 3 && parts[2]) {
    return [`${parts[0]}:${parts[2]}`];
  }
  return [finding.location];
}

function buildImpactDescription(finding: Finding, exploitableValue: number): string {
  const vulnType = finding.vulnType.toLowerCase();

  if (vulnType.includes('reentrancy')) {
    return `An attacker could drain funds from the contract through a reentrancy attack. Estimated maximum loss: ${formatEstimatedLoss(exploitableValue)}.`;
  }
  if (vulnType.includes('flash-loan')) {
    return `An attacker could use a flash loan to manipulate state and extract value. Estimated maximum loss: ${formatEstimatedLoss(exploitableValue)}.`;
  }
  if (vulnType.includes('oracle')) {
    return `An attacker could manipulate the price oracle to extract value through mispriced trades. Estimated maximum loss: ${formatEstimatedLoss(exploitableValue)}.`;
  }
  if (vulnType.includes('access-control')) {
    return `An unauthorized user could execute privileged operations. Estimated maximum loss: ${formatEstimatedLoss(exploitableValue)}.`;
  }
  if (vulnType.includes('arithmetic')) {
    return `Integer overflow/underflow could lead to incorrect calculations affecting fund balances. Estimated maximum loss: ${formatEstimatedLoss(exploitableValue)}.`;
  }

  return `This vulnerability could be exploited to cause financial loss. Estimated maximum loss: ${formatEstimatedLoss(exploitableValue)}.`;
}

function formatEstimatedLoss(value: number): string {
  if (value <= 0) return 'Unknown';
  if (value >= 1_000_000) return `Up to $${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `Up to $${(value / 1_000).toFixed(0)}K`;
  return `Up to $${value.toLocaleString()}`;
}

function inferAffectedUsers(finding: Finding): string {
  const desc = finding.description.toLowerCase();
  if (desc.includes('depositor') || desc.includes('lp ') || desc.includes('liquidity')) {
    return 'All depositors and liquidity providers';
  }
  if (desc.includes('staker') || desc.includes('staking')) {
    return 'All stakers in the protocol';
  }
  if (desc.includes('governance') || desc.includes('voting')) {
    return 'All governance participants';
  }
  if (desc.includes('treasury') || desc.includes('admin')) {
    return 'Protocol treasury and administrators';
  }
  return 'All users interacting with the affected contract';
}

function inferPrerequisites(finding: Finding): string[] {
  const prereqs: string[] = [];
  const desc = finding.description.toLowerCase();
  const vulnType = finding.vulnType.toLowerCase();

  if (vulnType.includes('flash-loan') || desc.includes('flash loan')) {
    prereqs.push('Flash loan access from a lending protocol');
  }
  if (desc.includes('front-run') || desc.includes('frontrun')) {
    prereqs.push('Mempool monitoring and frontrunning capability');
  }
  if (desc.includes('admin') || desc.includes('owner') || desc.includes('privileged')) {
    prereqs.push('Compromised admin/owner account or key');
  }
  if (desc.includes('multi-block') || desc.includes('multiple block')) {
    prereqs.push('Block builder/validator cooperation or multi-block MEV');
  }

  if (prereqs.length === 0) {
    prereqs.push('None (exploitable by any address)');
  }

  return prereqs;
}

function inferAttackComplexity(finding: Finding): 'Low' | 'Medium' | 'High' {
  const vulnType = finding.vulnType.toLowerCase();
  const desc = finding.description.toLowerCase();

  // Low complexity: single-tx exploits with no special requirements
  if (vulnType.includes('access-control') && !desc.includes('multi-step')) {
    return 'Low';
  }
  if (vulnType.includes('reentrancy') && !desc.includes('cross-function')) {
    return 'Low';
  }

  // High complexity: multi-tx, timing-dependent, requires coordination
  if (desc.includes('multi-block') || desc.includes('multi-step') || desc.includes('timing')) {
    return 'High';
  }
  if (vulnType.includes('governance') || desc.includes('front-run')) {
    return 'High';
  }

  // Default: medium
  return 'Medium';
}

function buildExecutiveSummary(
  protocolName: string,
  findingCount: number,
  severityCounts: Record<ImmunefiSeverity, number>,
  totalValue: number,
): string {
  if (findingCount === 0) {
    return `No verified vulnerabilities were found in ${protocolName}.`;
  }

  const lines: string[] = [];
  lines.push(`${findingCount} verified vulnerabilit${findingCount === 1 ? 'y' : 'ies'} found:`);

  for (const sev of ['Critical', 'High', 'Medium', 'Low'] as ImmunefiSeverity[]) {
    if (severityCounts[sev] > 0) {
      lines.push(`- ${severityCounts[sev]} ${sev}`);
    }
  }

  if (totalValue > 0) {
    lines.push('');
    lines.push(`Estimated total exploitable value: ${formatEstimatedLoss(totalValue)}`);
  }

  return lines.join('\n');
}
