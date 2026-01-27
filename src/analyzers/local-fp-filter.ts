/**
 * Local False Positive Filter - Rule-based FP detection that runs BEFORE
 * any AI calls, eliminating obvious false positives at zero cost.
 *
 * These patterns are deterministic and well-understood — no AI needed.
 */

import type { Finding } from '../types/index.js';

interface FilterRule {
  /** Slither detector name (or prefix) this rule targets */
  detector: string | RegExp;
  /** Code pattern that, if present, means the finding is a false positive */
  safePattern: RegExp;
  /** Human-readable explanation */
  reason: string;
}

const FILTER_RULES: FilterRule[] = [
  // Reentrancy on view/pure functions — impossible to exploit
  {
    detector: /^reentrancy/,
    safePattern: /function\s+\w+\s*\([^)]*\)\s+(?:external|public)\s+(?:view|pure)/,
    reason: 'Reentrancy on view/pure function (no state changes)',
  },

  // Reentrancy with OpenZeppelin ReentrancyGuard
  {
    detector: /^reentrancy/,
    safePattern: /nonReentrant|ReentrancyGuard/,
    reason: 'Protected by ReentrancyGuard modifier',
  },

  // Arbitrary-send with onlyOwner/onlyRole access control
  {
    detector: 'arbitrary-send-eth',
    safePattern: /onlyOwner|onlyRole|onlyAdmin|Ownable|AccessControl/,
    reason: 'Send restricted by access control modifier',
  },

  // Uninitialized state in upgradeable contracts with initializer
  {
    detector: /uninitialized/,
    safePattern: /initializer|Initializable|__init\(/,
    reason: 'Upgradeable contract with proper initializer pattern',
  },

  // Timestamp dependence in non-critical paths (logging, events)
  {
    detector: 'timestamp',
    safePattern: /emit\s+\w+.*block\.timestamp|lastUpdated\s*=\s*block\.timestamp/,
    reason: 'Timestamp used for non-critical bookkeeping only',
  },

  // Assembly usage that is standard safe patterns
  {
    detector: /assembly/,
    safePattern: /assembly\s*\{[^}]*(?:mload|mstore|returndatasize|returndatacopy|extcodesize|chainid|calldataload|calldatasize|calldatacopy)[^}]*\}/s,
    reason: 'Standard safe assembly pattern (memory ops, calldata reads)',
  },

  // Low-level call with checked return value
  {
    detector: 'low-level-calls',
    safePattern: /\(bool\s+success[^)]*\)\s*=\s*\w+\.call|require\s*\(\s*success/,
    reason: 'Low-level call with return value check',
  },

  // Controlled delegatecall in known proxy patterns
  {
    detector: 'controlled-delegatecall',
    safePattern: /ERC1967|TransparentUpgradeableProxy|UUPSUpgradeable|BeaconProxy/,
    reason: 'Delegatecall in standard proxy pattern',
  },

  // Oracle manipulation with TWAP protection
  {
    detector: /oracle/,
    safePattern: /TWAP|twap|timeWeightedAverage|observe\s*\(|consult\s*\(/,
    reason: 'Oracle protected by TWAP mechanism',
  },

  // Missing zero-address check on constructor-only params
  {
    detector: 'missing-zero-check',
    safePattern: /constructor\s*\(/,
    reason: 'Zero-check in constructor (deploy-time only, not exploitable post-deploy)',
  },
];

export interface LocalFilterResult {
  /** Findings that passed local filtering (not obvious FPs) */
  passed: Finding[];
  /** Count of findings removed by local rules */
  filteredCount: number;
  /** Details of each filtered finding */
  filtered: Array<{ finding: Finding; rule: string }>;
}

/**
 * Run rule-based FP filtering on findings before AI analysis.
 *
 * This is cheap (string matching only) and catches the most common
 * false positive patterns from Slither without any API calls.
 */
export function localFpFilter(findings: Finding[], contractSource: string): LocalFilterResult {
  const passed: Finding[] = [];
  const filtered: Array<{ finding: Finding; rule: string }> = [];

  for (const finding of findings) {
    const matchedRule = FILTER_RULES.find(rule => {
      // Check detector match
      const detectorMatch = typeof rule.detector === 'string'
        ? finding.detectorName === rule.detector
        : rule.detector.test(finding.detectorName);
      if (!detectorMatch) return false;

      // Check if safe pattern exists in contract source or code snippet
      const codeToCheck = finding.codeSnippet
        ? contractSource + '\n' + finding.codeSnippet
        : contractSource;
      return rule.safePattern.test(codeToCheck);
    });

    if (matchedRule) {
      filtered.push({ finding, rule: matchedRule.reason });
    } else {
      passed.push(finding);
    }
  }

  return {
    passed,
    filteredCount: filtered.length,
    filtered,
  };
}
