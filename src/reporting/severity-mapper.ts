/**
 * Severity mapper — translates internal findings to Immunefi classification.
 *
 * Maps scanner vuln types + severity to Immunefi severity levels,
 * vulnerability categories, CWE identifiers, and exploitable value estimates.
 */

import type { Finding } from '../agents/agent-types.js';
import type { ImmunefiSeverity, VulnCategory } from './immunefi-types.js';

// ── Severity Mapping ──

/**
 * Map an internal finding to an Immunefi severity level.
 *
 * Uses Immunefi's impact classification:
 * - Critical: Direct theft / permanent freeze of funds > $10K
 * - High: Theft of yield, temporary freeze, governance manipulation
 * - Medium: Griefing with bounded impact, DoS of non-critical function
 * - Low: Minor issues, informational with potential impact
 */
export function mapToImmunefiSeverity(finding: Finding): ImmunefiSeverity {
  const vulnType = finding.vulnType.toLowerCase();
  const severity = finding.severity;
  const value = finding.exploitableValue ?? 0;

  // If we have a verified exploit with significant value, severity is driven by impact
  if (finding.verified && value >= 100_000) return 'Critical';
  if (finding.verified && value >= 10_000) return 'High';

  // Direct theft / permanent freeze patterns → Critical
  if (severity === 'critical') {
    const criticalTypes = [
      'reentrancy', 'flash-loan', 'oracle', 'arithmetic',
      'access-control', 'logic',
    ];
    if (criticalTypes.some(t => vulnType.includes(t)) && value >= 10_000) {
      return 'Critical';
    }
    return 'High';
  }

  // High severity internal → map by vuln type
  if (severity === 'high') {
    // Types that can escalate to Critical if value is high enough
    if (vulnType.includes('reentrancy') || vulnType.includes('flash-loan')) {
      return value >= 50_000 ? 'Critical' : 'High';
    }
    if (vulnType.includes('access-control') || vulnType.includes('oracle')) {
      return value >= 50_000 ? 'Critical' : 'High';
    }
    return 'High';
  }

  // Medium severity internal
  if (severity === 'medium') {
    if (vulnType.includes('dos') || vulnType.includes('denial')) {
      return 'Medium';
    }
    if (vulnType.includes('griefing')) return 'Medium';
    // Upgrade if exploitable value is significant
    if (value >= 25_000) return 'High';
    return 'Medium';
  }

  // Low / info
  return 'Low';
}

// ── Vulnerability Category Mapping ──

/** Mapping rules: internal vuln type → Immunefi category */
const CATEGORY_RULES: Array<{ pattern: string; category: VulnCategory }> = [
  { pattern: 'reentrancy',       category: 'theft_of_funds' },
  { pattern: 'flash-loan',       category: 'theft_of_funds' },
  { pattern: 'oracle',           category: 'theft_of_funds' },
  { pattern: 'arithmetic',       category: 'theft_of_funds' },
  { pattern: 'access-control',   category: 'privilege_escalation' },
  { pattern: 'governance',       category: 'manipulation_of_governance' },
  { pattern: 'dos',              category: 'denial_of_service' },
  { pattern: 'denial',           category: 'denial_of_service' },
  { pattern: 'griefing',         category: 'griefing' },
  { pattern: 'freeze',           category: 'temporary_freezing_of_funds' },
  { pattern: 'lock',             category: 'temporary_freezing_of_funds' },
  { pattern: 'mint',             category: 'unauthorized_minting' },
  { pattern: 'inflation',        category: 'unauthorized_minting' },
  { pattern: 'yield',            category: 'theft_of_yield' },
  { pattern: 'gas',              category: 'theft_of_gas' },
];

/**
 * Map a finding's vuln type to an Immunefi vulnerability category.
 */
export function mapToVulnCategory(finding: Finding): VulnCategory {
  const vulnType = finding.vulnType.toLowerCase();
  const desc = finding.description.toLowerCase();
  const combined = `${vulnType} ${desc}`;

  // Check for permanent freeze indicators
  if (combined.includes('permanent') && combined.includes('freez')) {
    return 'permanent_freezing_of_funds';
  }

  // Check access-control patterns that escalate to theft
  if (vulnType.includes('access-control')) {
    if (desc.includes('withdraw') || desc.includes('drain') || desc.includes('transfer')) {
      return 'theft_of_funds';
    }
    return 'privilege_escalation';
  }

  // Oracle manipulation: context-dependent
  if (vulnType.includes('oracle')) {
    if (desc.includes('governance') || desc.includes('voting')) {
      return 'manipulation_of_governance';
    }
    return 'theft_of_funds';
  }

  // Logic errors: context-dependent
  if (vulnType.includes('logic')) {
    if (desc.includes('drain') || desc.includes('steal') || desc.includes('extract')) {
      return 'theft_of_funds';
    }
    if (desc.includes('freeze') || desc.includes('lock')) {
      return 'temporary_freezing_of_funds';
    }
    if (desc.includes('dos') || desc.includes('revert') || desc.includes('block')) {
      return 'denial_of_service';
    }
    return 'other';
  }

  // Match by pattern rules
  for (const rule of CATEGORY_RULES) {
    if (vulnType.includes(rule.pattern)) {
      return rule.category;
    }
  }

  return 'other';
}

// ── Exploitable Value Estimation ──

/** Heuristics by vuln type for value estimation */
const VALUE_HEURISTICS: Record<string, { factor: number; description: string }> = {
  reentrancy:      { factor: 0.8,  description: 'Up to pool balance of affected function' },
  'flash-loan':    { factor: 0.6,  description: 'Bounded by flash loan liquidity and price impact' },
  oracle:          { factor: 0.4,  description: 'Percentage of TVL based on manipulation feasibility' },
  'access-control': { factor: 1.0, description: 'Full contract balance if admin access gained' },
  arithmetic:      { factor: 0.5,  description: 'Depends on overflow location and affected balances' },
  logic:           { factor: 0.3,  description: 'Conservative estimate based on logic error scope' },
  governance:      { factor: 0.2,  description: 'Indirect impact via governance manipulation' },
  dos:             { factor: 0.05, description: 'No direct fund loss, estimated service disruption cost' },
  griefing:        { factor: 0.1,  description: 'Bounded griefing impact' },
};

/**
 * Estimate exploitable value from a finding and protocol metadata.
 * Returns conservative estimate (better to underestimate for credibility).
 *
 * @param finding - The scanner finding
 * @param protocolMetadata - Protocol metadata with TVL info
 * @returns Conservative exploitable value in USD
 */
export function estimateExploitableValue(
  finding: Finding,
  protocolMetadata?: { tvl?: number; contractBalance?: number },
): number {
  // If finding already has an estimate, use it
  if (finding.exploitableValue && finding.exploitableValue > 0) {
    return finding.exploitableValue;
  }

  const tvl = protocolMetadata?.tvl ?? 0;
  const contractBalance = protocolMetadata?.contractBalance ?? tvl;
  const baseValue = Math.min(contractBalance, tvl || Infinity);

  if (baseValue <= 0) return 0;

  const vulnType = finding.vulnType.toLowerCase();

  // Find matching heuristic
  for (const [type, heuristic] of Object.entries(VALUE_HEURISTICS)) {
    if (vulnType.includes(type)) {
      // Apply factor and cap at contract balance
      const estimate = baseValue * heuristic.factor;
      // Conservative: take 50% of estimate
      return Math.floor(estimate * 0.5);
    }
  }

  // Unknown type: very conservative 10% estimate
  return Math.floor(baseValue * 0.1 * 0.5);
}

// ── CWE Mapping ──

const CWE_MAP: Record<string, { id: string; name: string }> = {
  reentrancy:      { id: 'CWE-841', name: 'Improper Enforcement of Behavioral Workflow' },
  arithmetic:      { id: 'CWE-190', name: 'Integer Overflow or Wraparound' },
  underflow:       { id: 'CWE-191', name: 'Integer Underflow' },
  'access-control': { id: 'CWE-284', name: 'Improper Access Control' },
  oracle:          { id: 'CWE-20',  name: 'Improper Input Validation' },
  'flash-loan':    { id: 'CWE-362', name: 'Concurrent Execution Using Shared Resource with Improper Synchronization' },
  logic:           { id: 'CWE-840', name: 'Business Logic Errors' },
  dos:             { id: 'CWE-400', name: 'Uncontrolled Resource Consumption' },
  governance:      { id: 'CWE-863', name: 'Incorrect Authorization' },
  griefing:        { id: 'CWE-400', name: 'Uncontrolled Resource Consumption' },
  freeze:          { id: 'CWE-667', name: 'Improper Locking' },
  mint:            { id: 'CWE-269', name: 'Improper Privilege Management' },
};

/**
 * Map a vulnerability type to its CWE identifier.
 */
export function mapCWE(vulnType: string): string | undefined {
  const lower = vulnType.toLowerCase();

  // Check for underflow specifically (before generic arithmetic)
  if (lower.includes('underflow')) {
    return CWE_MAP['underflow']?.id;
  }

  for (const [type, cwe] of Object.entries(CWE_MAP)) {
    if (lower.includes(type)) {
      return cwe.id;
    }
  }

  return undefined;
}

/**
 * Get full CWE info (id + name) for a vulnerability type.
 */
export function getCWEInfo(vulnType: string): { id: string; name: string } | undefined {
  const lower = vulnType.toLowerCase();

  if (lower.includes('underflow')) {
    return CWE_MAP['underflow'];
  }

  for (const [type, cwe] of Object.entries(CWE_MAP)) {
    if (lower.includes(type)) {
      return cwe;
    }
  }

  return undefined;
}
