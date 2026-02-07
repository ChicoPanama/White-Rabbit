/**
 * Findings consolidation and deduplication.
 *
 * Collects findings from all agents, deduplicates by location, filters
 * by config thresholds, and generates human-readable summaries.
 */

import type { AgentResult, Finding } from './agent-types.js';
import type { ScanConfig } from '../config-parser.js';

// ── Severity Ordering ──

const SEVERITY_ORDER: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function severityScore(s: string): number {
  return SEVERITY_ORDER[s] ?? 0;
}

// ── Consolidation ──

/**
 * Collect all findings from agent results, deduplicate by location,
 * and sort by severity.
 */
export function consolidateFindings(results: AgentResult[]): Finding[] {
  // Collect all findings
  const allFindings: Finding[] = [];
  for (const result of results) {
    if (result.status === 'success' || result.status === 'skipped') {
      allFindings.push(...result.findings);
    }
  }

  if (allFindings.length === 0) return [];

  // Deduplicate by location (same contract:function:line)
  const locationMap = new Map<string, Finding[]>();
  for (const finding of allFindings) {
    const key = finding.location ? normalizeLocation(finding.location) : finding.id;
    const group = locationMap.get(key) ?? [];
    group.push(finding);
    locationMap.set(key, group);
  }

  // For each location group, keep the highest-severity finding and merge info
  const deduplicated: Finding[] = [];
  for (const [_location, group] of locationMap) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
      continue;
    }

    // Sort by severity (highest first)
    group.sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
    const primary = { ...group[0] };

    // Merge descriptions from other agents
    const otherDescriptions = group
      .slice(1)
      .filter(f => f.agentId !== primary.agentId)
      .map(f => `[${f.agentId}]: ${f.description}`)
      .join('\n\n');

    if (otherDescriptions) {
      primary.description += `\n\n--- Corroborated by ---\n${otherDescriptions}`;
    }

    // Take PoC from any agent that has one
    if (!primary.poc) {
      const withPoc = group.find(f => f.poc);
      if (withPoc) primary.poc = withPoc.poc;
    }

    // Take highest exploitable value
    const maxValue = Math.max(...group.map(f => f.exploitableValue ?? 0));
    if (maxValue > 0) primary.exploitableValue = maxValue;

    // Mark as verified if any agent verified it
    if (group.some(f => f.verified)) primary.verified = true;

    deduplicated.push(primary);
  }

  // Sort by severity (critical first), then by exploitable value
  deduplicated.sort((a, b) => {
    const severityDiff = severityScore(b.severity) - severityScore(a.severity);
    if (severityDiff !== 0) return severityDiff;
    return (b.exploitableValue ?? 0) - (a.exploitableValue ?? 0);
  });

  return deduplicated;
}

/**
 * Normalize a location string for comparison.
 * Handles variations like "Contract:function:42" vs "Contract:function:42-50".
 */
function normalizeLocation(loc: string): string {
  // Remove whitespace and lowercase for comparison
  return loc.trim().toLowerCase().replace(/\s+/g, '');
}

// ── Filtering ──

/**
 * Filter findings based on config thresholds.
 */
export function filterFindings(findings: Finding[], config: ScanConfig): Finding[] {
  const minSeverity = config.reporting.min_severity ?? 'low';
  const minSeverityScore = severityScore(minSeverity);
  const skipOverflow08 = config.filtering.skip_solidity_08_overflow;
  const skipDesignChoices = config.filtering.skip_design_choices;
  const minValue = config.filtering.min_exploitable_value_usd;

  return findings.filter(finding => {
    // Filter by minimum severity
    if (severityScore(finding.severity) < minSeverityScore) {
      return false;
    }

    // Filter known design choice patterns
    if (skipDesignChoices && isDesignChoice(finding)) {
      return false;
    }

    // Filter Solidity 0.8+ overflow (checked by default)
    if (skipOverflow08 && finding.vulnType === 'arithmetic' && isOverflow08(finding)) {
      return false;
    }

    // Filter by minimum exploitable value
    if (minValue > 0 && finding.exploitableValue !== undefined && finding.exploitableValue < minValue) {
      return false;
    }

    return true;
  });
}

/**
 * Check if a finding is a known design choice (not a real vulnerability).
 */
function isDesignChoice(finding: Finding): boolean {
  const lowerDesc = finding.description.toLowerCase();
  const designPatterns = [
    'immutable',
    'by design',
    'expected behavior',
    'intentional',
    'access control is centralized',
    'admin can',
    'owner can',
    'governance decision',
  ];
  return designPatterns.some(p => lowerDesc.includes(p));
}

/**
 * Check if an arithmetic finding is for Solidity 0.8+ (which has built-in overflow checks).
 */
function isOverflow08(finding: Finding): boolean {
  const lowerDesc = finding.description.toLowerCase();
  return lowerDesc.includes('0.8') || lowerDesc.includes('solidity 0.8');
}

// ── Summary ──

/**
 * Generate a human-readable findings summary.
 */
export function generateFindingsSummary(findings: Finding[]): string {
  if (findings.length === 0) {
    return 'No findings discovered.';
  }

  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byVulnType: Record<string, number> = {};
  let verified = 0;
  let unverified = 0;

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byVulnType[f.vulnType] = (byVulnType[f.vulnType] ?? 0) + 1;
    if (f.verified) verified++;
    else unverified++;
  }

  const lines: string[] = [];
  lines.push(`Total: ${findings.length} findings`);
  lines.push('');

  // Severity breakdown
  lines.push('By Severity:');
  for (const [severity, count] of Object.entries(bySeverity)) {
    if (count > 0) {
      lines.push(`  ${severity.toUpperCase()}: ${count}`);
    }
  }

  // Vuln type breakdown
  lines.push('');
  lines.push('By Type:');
  for (const [type, count] of Object.entries(byVulnType).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${type}: ${count}`);
  }

  // Verification status
  lines.push('');
  lines.push(`Verified: ${verified} | Unverified: ${unverified}`);

  // High-value findings
  const highValue = findings.filter(f => (f.exploitableValue ?? 0) > 0);
  if (highValue.length > 0) {
    const totalValue = highValue.reduce((sum, f) => sum + (f.exploitableValue ?? 0), 0);
    lines.push(`Estimated exploitable value: $${totalValue.toLocaleString()}`);
  }

  return lines.join('\n');
}
