/**
 * Report pipeline — integrates the report generator with the scanner pipeline.
 *
 * Reads findings from session deliverables, generates the full Immunefi report,
 * writes all output deliverables, and generates the submission checklist.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from '../agents/agent-types.js';
import type { ScanConfig } from '../config-parser.js';
import {
  readDeliverable,
  writeDeliverable,
  getSessionDir,
} from '../deliverables-manager.js';
import {
  generateImmunefiReport,
  renderMarkdown,
  renderJSON,
  renderPerFinding,
} from './report-generator.js';
import type { ReportInput } from './report-generator.js';
import { generateFullRecommendation } from './recommendation-engine.js';
import type { VerificationDeliverable } from './poc-formatter.js';
import type { ImmunefiReport, SubmissionChecklist, ChecklistItem } from './immunefi-types.js';

// ── Pipeline Entry Point ──

export interface ReportPipelineInput {
  sessionId: string;
  config: ScanConfig;
  consolidatedFindings: Finding[];
}

export interface ReportPipelineOutput {
  report: ImmunefiReport;
  markdownPath: string;
  jsonPath: string;
  findingPaths: string[];
  checklistPath: string;
}

/**
 * Run the full report pipeline.
 *
 * 1. Reads protocol metadata from discovery deliverables
 * 2. Reads verification results from verification deliverables
 * 3. Generates the Immunefi report
 * 4. Writes all output files
 * 5. Generates the submission checklist
 */
export function runReportPipeline(input: ReportPipelineInput): ReportPipelineOutput {
  const { sessionId, config, consolidatedFindings } = input;

  // Load protocol metadata from discovery deliverables
  const metadataDeliverable = readDeliverable<Record<string, unknown>>(
    sessionId, 'discovery', 'protocol-metadata.json',
  );
  const protocolMetadata = metadataDeliverable?.data ?? {};

  // Load verification results for each finding's vuln type
  const verificationResults: Record<string, VerificationDeliverable> = {};
  const vulnTypes = ['arithmetic', 'reentrancy', 'access-control', 'oracle', 'flash-loan', 'logic'];
  for (const vulnType of vulnTypes) {
    const verResult = readDeliverable<VerificationDeliverable>(
      sessionId, 'verification', `verification-${vulnType}-result.json`,
    );
    if (verResult?.data) {
      // Map to finding IDs that match this vuln type
      for (const finding of consolidatedFindings) {
        if (finding.vulnType === vulnType) {
          verificationResults[finding.id] = verResult.data;
        }
      }
    }
  }

  // Build the report input
  const reportInput: ReportInput = {
    sessionId,
    protocolName: String(protocolMetadata.protocolName ?? config.target.protocol_name ?? 'Unknown'),
    chain: String(protocolMetadata.chain ?? config.target.chain ?? 'ethereum'),
    contractAddress: String(protocolMetadata.address ?? config.target.contract_address ?? ''),
    findings: consolidatedFindings,
    protocolMetadata: {
      tvl: typeof protocolMetadata.tvl === 'number' ? protocolMetadata.tvl : undefined,
      contractBalance: typeof protocolMetadata.contractBalance === 'number' ? protocolMetadata.contractBalance : undefined,
    },
    verificationResults,
  };

  // Generate the report
  const report = generateImmunefiReport(reportInput);

  // Enrich with recommendations
  for (const sub of report.submissions) {
    const matchingFinding = consolidatedFindings.find(f => f.title === sub.vulnerability.title);
    if (matchingFinding) {
      sub.additionalInfo = generateFullRecommendation(matchingFinding);
    }
  }

  // Write all output deliverables
  const sessionDir = getSessionDir(sessionId);

  // 1. Full combined report (markdown)
  const markdown = renderMarkdown(report);
  writeDeliverable(sessionId, 'report', 'final-report.md', markdown, 'report-immunefi');
  const markdownPath = path.join(sessionDir, 'report', 'final-report.md');

  // 2. Machine-readable JSON
  const json = renderJSON(report);
  writeDeliverable(sessionId, 'report', 'final-report.json', report, 'report-immunefi');
  const jsonPath = path.join(sessionDir, 'report', 'final-report.json');

  // 3. Individual per-finding reports
  const perFinding = renderPerFinding(report);
  const findingsDir = path.join(sessionDir, 'report', 'findings');
  fs.mkdirSync(findingsDir, { recursive: true });

  const findingPaths: string[] = [];
  for (const [findingId, content] of perFinding) {
    const filename = `${findingId}.md`;
    writeDeliverable(sessionId, 'report/findings', filename, content, 'report-immunefi');
    findingPaths.push(path.join(findingsDir, filename));
  }

  // 4. Submission checklist
  const checklist = generateSubmissionChecklist(report, consolidatedFindings);
  writeDeliverable(sessionId, 'report', '_submission-checklist.md', checklist, 'report-immunefi');
  const checklistPath = path.join(sessionDir, 'report', '_submission-checklist.md');

  return {
    report,
    markdownPath,
    jsonPath,
    findingPaths,
    checklistPath,
  };
}

// ── Submission Checklist ──

/**
 * Generate a pre-submission checklist for all findings.
 */
export function generateSubmissionChecklist(
  report: ImmunefiReport,
  findings: Finding[],
): string {
  const lines: string[] = [];
  lines.push('# Pre-Submission Checklist');
  lines.push('');
  lines.push(`**Protocol:** ${report.protocolName}`);
  lines.push(`**Chain:** ${report.chain}`);
  lines.push(`**Date:** ${report.generatedAt.split('T')[0]}`);
  lines.push(`**Findings:** ${report.submissions.length}`);
  lines.push('');

  // Global checks
  lines.push('## Global Checks');
  lines.push('');
  lines.push('- [ ] The program is active on Immunefi and covers this asset');
  lines.push('- [ ] The contract address is in the program\'s asset scope');
  lines.push('- [ ] No sensitive data (private keys, internal URLs) in any report');
  lines.push('- [ ] All code snippets compile and are syntactically correct');
  lines.push('');

  // Per-finding checks
  for (let i = 0; i < report.submissions.length; i++) {
    const sub = report.submissions[i];
    const finding = findings[i];

    lines.push(`## Finding #${i + 1}: ${sub.vulnerability.title}`);
    lines.push('');
    lines.push(`**Severity:** ${sub.vulnerability.severity}`);
    lines.push(`**Category:** ${sub.vulnerability.type.replace(/_/g, ' ')}`);
    if (sub.impact.exploitableValueUsd) {
      lines.push(`**Estimated value:** $${sub.impact.exploitableValueUsd.toLocaleString()}`);
    }
    lines.push('');
    lines.push('- [ ] Finding is not a known issue or design choice');
    lines.push('- [ ] PoC runs successfully on a fresh mainnet fork');
    lines.push('- [ ] Severity classification matches Immunefi\'s impact scale');
    lines.push('- [ ] The vulnerability type is in-scope for this program');
    lines.push('- [ ] Exploitable value estimate is conservative and justified');
    lines.push('- [ ] Report is clear enough for a non-technical reviewer');
    lines.push(`- [ ] Verified: ${finding?.verified ? 'Yes' : 'Pending'}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build structured checklist items for a finding (for programmatic use).
 */
export function buildChecklistItems(
  finding: Finding,
  programActive?: boolean,
): SubmissionChecklist {
  const checks: ChecklistItem[] = [
    {
      label: 'Finding is not a known issue or design choice',
      checked: false,
    },
    {
      label: 'PoC runs successfully on a fresh mainnet fork',
      checked: finding.verified,
    },
    {
      label: 'Severity classification matches Immunefi impact scale',
      checked: false,
    },
    {
      label: 'The program is active on Immunefi and covers this asset',
      checked: programActive ?? false,
    },
    {
      label: 'The vulnerability type is in-scope for this program',
      checked: false,
    },
    {
      label: 'Exploitable value estimate is conservative and justified',
      checked: (finding.exploitableValue ?? 0) > 0,
    },
    {
      label: 'Report is clear enough for a non-technical reviewer',
      checked: false,
    },
    {
      label: 'No sensitive data (private keys, internal URLs) in report',
      checked: false,
    },
  ];

  return {
    findingId: finding.id,
    findingTitle: finding.title,
    checks,
  };
}
