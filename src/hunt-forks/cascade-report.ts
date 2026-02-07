/**
 * Cascade Report Generator — Cross-chain vulnerability report.
 *
 * Generates comprehensive reports for cascade hunts, including
 * per-fork results, submission plans, and priority rankings.
 */

import type { CascadeWorkflowInput, CascadePhaseResult } from '../temporal/cascade-shared.js';
import type { ForkHuntResult, ForkMatch } from './fork-hunter.js';
import type { CascadeResult, CascadeForkResult } from './cascade-scanner.js';

// ── Types ──

export interface CascadeReportInput {
  input: CascadeWorkflowInput;
  huntResult: ForkHuntResult;
  cascadeResult?: CascadeResult;
  phaseResults: CascadePhaseResult[];
}

export interface CascadeReport {
  markdown: string;
  json: CascadeReportJSON;
}

export interface CascadeReportJSON {
  generatedAt: string;
  originalContract: {
    address: string;
    chain: string;
    chainId: number;
    name: string;
    vulnType: string;
    vulnTitle: string;
  };
  summary: {
    totalChainsSearched: number;
    totalChainsWithMatches: number;
    totalForksFound: number;
    vulnerableForksFound: number;
    patchedForksFound: number;
    uncertainForksFound: number;
    highestSimilarity: number;
    huntDuration: number;
  };
  vulnerableForks: ForkReportEntry[];
  patchedForks: ForkReportEntry[];
  uncertainForks: ForkReportEntry[];
  submissionPlan: SubmissionPlanEntry[];
  chainBreakdown: ChainBreakdownEntry[];
  phases: PhaseEntry[];
}

export interface ForkReportEntry {
  address: string;
  chain: string;
  chainId: number;
  name: string;
  similarity: number;
  matchType: string;
  confidence: number;
  patchIndicators: string[];
  vulnIndicators: string[];
}

export interface SubmissionPlanEntry {
  priority: number;
  address: string;
  chain: string;
  name: string;
  confidence: number;
  similarity: number;
  reason: string;
}

export interface ChainBreakdownEntry {
  chain: string;
  chainId: number;
  matchesFound: number;
  vulnerableCount: number;
  patchedCount: number;
  searchDuration: number;
  error?: string;
}

export interface PhaseEntry {
  phase: string;
  status: string;
  duration: number;
  errors: string[];
}

// ── Main Generator ──

/**
 * Generate a cascade hunt report with markdown and JSON outputs.
 */
export function generateCascadeReport(reportInput: CascadeReportInput): CascadeReport {
  const json = buildJSON(reportInput);
  const markdown = buildMarkdown(json);
  return { markdown, json };
}

// ── JSON Builder ──

function buildJSON(reportInput: CascadeReportInput): CascadeReportJSON {
  const { input, huntResult, cascadeResult, phaseResults } = reportInput;

  // Categorize forks
  const vulnerableForks: ForkReportEntry[] = [];
  const patchedForks: ForkReportEntry[] = [];
  const uncertainForks: ForkReportEntry[] = [];

  if (cascadeResult) {
    for (const fr of cascadeResult.forkResults) {
      const entry = forkResultToEntry(fr);
      switch (fr.status) {
        case 'vulnerable':
          vulnerableForks.push(entry);
          break;
        case 'patched':
          patchedForks.push(entry);
          break;
        case 'uncertain':
        case 'error':
          uncertainForks.push(entry);
          break;
      }
    }
  }

  // Sort vulnerable forks by confidence (descending)
  vulnerableForks.sort((a, b) => b.confidence - a.confidence);

  // Build submission plan from vulnerable forks
  const submissionPlan = vulnerableForks.map((f, i) => ({
    priority: i + 1,
    address: f.address,
    chain: f.chain,
    name: f.name,
    confidence: f.confidence,
    similarity: f.similarity,
    reason: buildSubmissionReason(f),
  }));

  // Chain breakdown
  const chainBreakdown: ChainBreakdownEntry[] = huntResult.chainResults.map(cr => {
    const chainCascadeResults = cascadeResult?.forkResults.filter(fr => fr.fork.chain === cr.chain) ?? [];
    return {
      chain: cr.chain,
      chainId: cr.chainId,
      matchesFound: cr.matches.length,
      vulnerableCount: chainCascadeResults.filter(r => r.status === 'vulnerable').length,
      patchedCount: chainCascadeResults.filter(r => r.status === 'patched').length,
      searchDuration: cr.searchDuration,
      error: cr.error,
    };
  });

  // Phase entries
  const phases: PhaseEntry[] = phaseResults.map(p => ({
    phase: p.phase,
    status: p.status,
    duration: p.duration,
    errors: p.errors,
  }));

  // Summary
  const highestSimilarity = huntResult.topMatches.length > 0
    ? Math.max(...huntResult.topMatches.map(m => m.similarity.overall))
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    originalContract: {
      address: input.contractAddress,
      chain: input.chain,
      chainId: input.chainId,
      name: input.contractName,
      vulnType: input.vulnType,
      vulnTitle: input.vulnTitle,
    },
    summary: {
      totalChainsSearched: huntResult.totalChainsSearched,
      totalChainsWithMatches: huntResult.totalChainsWithMatches,
      totalForksFound: huntResult.totalMatches,
      vulnerableForksFound: vulnerableForks.length,
      patchedForksFound: patchedForks.length,
      uncertainForksFound: uncertainForks.length,
      highestSimilarity,
      huntDuration: huntResult.duration,
    },
    vulnerableForks,
    patchedForks,
    uncertainForks,
    submissionPlan,
    chainBreakdown,
    phases,
  };
}

// ── Markdown Builder ──

function buildMarkdown(json: CascadeReportJSON): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Cascade Hunt Report`);
  lines.push('');
  lines.push(`**Generated:** ${json.generatedAt}`);
  lines.push('');

  // Original contract
  lines.push(`## Original Vulnerability`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Contract | ${json.originalContract.name} |`);
  lines.push(`| Address | \`${json.originalContract.address}\` |`);
  lines.push(`| Chain | ${json.originalContract.chain} (${json.originalContract.chainId}) |`);
  lines.push(`| Vulnerability | ${json.originalContract.vulnTitle} |`);
  lines.push(`| Type | ${json.originalContract.vulnType} |`);
  lines.push('');

  // Summary
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Chains searched | ${json.summary.totalChainsSearched} |`);
  lines.push(`| Chains with matches | ${json.summary.totalChainsWithMatches} |`);
  lines.push(`| Total forks found | ${json.summary.totalForksFound} |`);
  lines.push(`| Vulnerable forks | **${json.summary.vulnerableForksFound}** |`);
  lines.push(`| Patched forks | ${json.summary.patchedForksFound} |`);
  lines.push(`| Uncertain forks | ${json.summary.uncertainForksFound} |`);
  lines.push(`| Highest similarity | ${json.summary.highestSimilarity.toFixed(1)}% |`);
  lines.push(`| Hunt duration | ${(json.summary.huntDuration / 1000).toFixed(1)}s |`);
  lines.push('');

  // Vulnerable forks
  if (json.vulnerableForks.length > 0) {
    lines.push(`## Vulnerable Forks`);
    lines.push('');
    lines.push(`| # | Chain | Contract | Address | Similarity | Confidence |`);
    lines.push(`|---|-------|----------|---------|------------|------------|`);
    for (let i = 0; i < json.vulnerableForks.length; i++) {
      const f = json.vulnerableForks[i];
      lines.push(`| ${i + 1} | ${f.chain} | ${f.name} | \`${f.address.slice(0, 10)}...\` | ${f.similarity.toFixed(1)}% | ${f.confidence}% |`);
    }
    lines.push('');
  }

  // Submission plan
  if (json.submissionPlan.length > 0) {
    lines.push(`## Submission Plan`);
    lines.push('');
    for (const sp of json.submissionPlan) {
      lines.push(`### Priority ${sp.priority}: ${sp.name} (${sp.chain})`);
      lines.push(`- **Address:** \`${sp.address}\``);
      lines.push(`- **Confidence:** ${sp.confidence}%`);
      lines.push(`- **Similarity:** ${sp.similarity.toFixed(1)}%`);
      lines.push(`- **Reason:** ${sp.reason}`);
      lines.push('');
    }
  }

  // Chain breakdown
  if (json.chainBreakdown.length > 0) {
    lines.push(`## Chain Breakdown`);
    lines.push('');
    lines.push(`| Chain | Matches | Vulnerable | Patched | Duration | Error |`);
    lines.push(`|-------|---------|------------|---------|----------|-------|`);
    for (const cb of json.chainBreakdown) {
      lines.push(`| ${cb.chain} | ${cb.matchesFound} | ${cb.vulnerableCount} | ${cb.patchedCount} | ${(cb.searchDuration / 1000).toFixed(1)}s | ${cb.error ?? '-'} |`);
    }
    lines.push('');
  }

  // Patched forks
  if (json.patchedForks.length > 0) {
    lines.push(`## Patched Forks`);
    lines.push('');
    for (const f of json.patchedForks) {
      lines.push(`- **${f.name}** (\`${f.address.slice(0, 10)}...\`) on ${f.chain} — ${f.patchIndicators.join(', ')}`);
    }
    lines.push('');
  }

  // Phases
  lines.push(`## Pipeline Phases`);
  lines.push('');
  lines.push(`| Phase | Status | Duration | Errors |`);
  lines.push(`|-------|--------|----------|--------|`);
  for (const p of json.phases) {
    lines.push(`| ${p.phase} | ${p.status} | ${(p.duration / 1000).toFixed(1)}s | ${p.errors.length > 0 ? p.errors.join('; ') : '-'} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ── Helpers ──

function forkResultToEntry(fr: CascadeForkResult): ForkReportEntry {
  return {
    address: fr.fork.address,
    chain: fr.fork.chain,
    chainId: fr.fork.chainId,
    name: fr.fork.name,
    similarity: fr.fork.similarity.overall,
    matchType: fr.fork.matchType,
    confidence: fr.confidence,
    patchIndicators: fr.patchIndicators,
    vulnIndicators: fr.vulnIndicators,
  };
}

function buildSubmissionReason(entry: ForkReportEntry): string {
  const parts: string[] = [];

  if (entry.similarity >= 95) {
    parts.push('exact fork');
  } else if (entry.similarity >= 85) {
    parts.push('high-similarity fork');
  } else {
    parts.push('modified fork');
  }

  if (entry.confidence >= 80) {
    parts.push('high confidence');
  } else if (entry.confidence >= 60) {
    parts.push('medium confidence');
  }

  if (entry.vulnIndicators.length > 0) {
    parts.push(`${entry.vulnIndicators.length} vuln indicator(s)`);
  }

  return parts.join(', ');
}
