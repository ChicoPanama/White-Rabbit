/**
 * Local False Positive Filter - Rule-based FP detection that runs BEFORE
 * any AI calls, eliminating obvious false positives at zero cost.
 *
 * These patterns are deterministic and well-understood — no AI needed.
 *
 * CRITICAL FIX: For modifier-based protections (nonReentrant, onlyOwner),
 * we now check if the SPECIFIC function flagged has the modifier, not just
 * if the pattern exists ANYWHERE in the contract. This prevents masking
 * real vulnerabilities in unprotected functions.
 */

import type { Finding } from '../types/index.js';

interface FilterRule {
  /** Slither detector name (or prefix) this rule targets */
  detector: string | RegExp;
  /** Code pattern that, if present, means the finding is a false positive */
  safePattern: RegExp;
  /** Human-readable explanation */
  reason: string;
  /** If true, check only the specific function, not the entire contract */
  perFunction?: boolean;
}

/**
 * Global rules: These patterns, if found ANYWHERE in the contract, mean the
 * finding is likely a false positive. Good for contract-wide patterns.
 */
const GLOBAL_RULES: FilterRule[] = [
  // Reentrancy on view/pure functions — impossible to exploit
  {
    detector: /^reentrancy/,
    safePattern: /function\s+\w+\s*\([^)]*\)\s+(?:external|public)\s+(?:view|pure)/,
    reason: 'Reentrancy on view/pure function (no state changes)',
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

/**
 * Per-function rules: These patterns must be checked on the SPECIFIC function
 * flagged in the finding, not the entire contract. This prevents false negatives
 * where one protected function masks an unprotected vulnerable function.
 */
const PER_FUNCTION_RULES: FilterRule[] = [
  // Reentrancy with OpenZeppelin ReentrancyGuard - CHECK SPECIFIC FUNCTION
  {
    detector: /^reentrancy/,
    safePattern: /\bnonReentrant\b/,
    reason: 'Function protected by nonReentrant modifier',
    perFunction: true,
  },

  // Arbitrary-send with onlyOwner/onlyRole - CHECK SPECIFIC FUNCTION
  {
    detector: 'arbitrary-send-eth',
    safePattern: /\bonlyOwner\b|\bonlyRole\s*\([^)]+\)|\bonlyAdmin\b/,
    reason: 'Function restricted by access control modifier',
    perFunction: true,
  },

  // Arbitrary-send-erc20 with access control - CHECK SPECIFIC FUNCTION
  {
    detector: 'arbitrary-send-erc20',
    safePattern: /\bonlyOwner\b|\bonlyRole\s*\([^)]+\)|\bonlyAdmin\b/,
    reason: 'Function restricted by access control modifier',
    perFunction: true,
  },

  // Controlled delegatecall with owner check - CHECK SPECIFIC FUNCTION
  {
    detector: 'controlled-delegatecall',
    safePattern: /\bonlyOwner\b|\bonlyProxy\b|\b_checkProxy\b/,
    reason: 'Delegatecall restricted by access control',
    perFunction: true,
  },

  // Suicidal with owner protection - CHECK SPECIFIC FUNCTION
  {
    detector: 'suicidal',
    safePattern: /\bonlyOwner\b|\bonlyAdmin\b/,
    reason: 'Self-destruct restricted to owner',
    perFunction: true,
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
 * Extract the function declaration line(s) for the flagged finding.
 * Returns the function signature with modifiers if found.
 */
function extractFlaggedFunction(finding: Finding, contractSource: string): string | null {
  // Method 1: Use line numbers if available
  if (finding.lineStart != null && finding.lineEnd != null) {
    const lines = contractSource.split('\n');
    const startLine = Math.max(0, finding.lineStart - 1);

    // Search backwards to find function declaration
    for (let i = startLine; i >= Math.max(0, startLine - 20); i--) {
      const line = lines[i];
      if (/^\s*(function|modifier|constructor|receive|fallback)\s+/.test(line) ||
          /^\s*(function|modifier|constructor)\s*\(/.test(line)) {
        // Collect the full declaration (may span multiple lines)
        const declarationLines: string[] = [];
        let braceDepth = 0;
        for (let j = i; j < lines.length && j < i + 10; j++) {
          declarationLines.push(lines[j]);
          for (const char of lines[j]) {
            if (char === '{') braceDepth++;
            if (char === '}') braceDepth--;
          }
          if (braceDepth > 0 || lines[j].includes('{')) break;
        }
        return declarationLines.join('\n');
      }
      // Stop if we hit another function's closing brace or contract declaration
      if (/^\s*\}\s*$/.test(line) || /^\s*(contract|library|interface)\s+/.test(line)) {
        break;
      }
    }
  }

  // Method 2: Parse function name from description or code snippet
  const funcNameMatch = finding.description.match(/(?:function|modifier)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (funcNameMatch) {
    const funcName = funcNameMatch[1];
    const funcRegex = new RegExp(
      `function\\s+${funcName}\\s*\\([^)]*\\)[^{]*\\{`,
      'g',
    );
    const match = funcRegex.exec(contractSource);
    if (match) {
      return match[0];
    }
  }

  // Method 3: Use code snippet directly
  if (finding.codeSnippet) {
    return finding.codeSnippet;
  }

  return null;
}

/**
 * Run rule-based FP filtering on findings before AI analysis.
 *
 * This is cheap (string matching only) and catches the most common
 * false positive patterns from Slither without any API calls.
 *
 * CRITICAL: Per-function rules check the SPECIFIC function flagged,
 * not the entire contract. This prevents masking real vulnerabilities.
 */
export function localFpFilter(findings: Finding[], contractSource: string): LocalFilterResult {
  const passed: Finding[] = [];
  const filtered: Array<{ finding: Finding; rule: string }> = [];

  for (const finding of findings) {
    let matchedRule: FilterRule | undefined;

    // First check global rules (contract-wide patterns)
    matchedRule = GLOBAL_RULES.find(rule => {
      const detectorMatch = typeof rule.detector === 'string'
        ? finding.detectorName === rule.detector
        : rule.detector.test(finding.detectorName);
      if (!detectorMatch) return false;
      return rule.safePattern.test(contractSource);
    });

    // If no global rule matched, check per-function rules
    if (!matchedRule) {
      const flaggedFunction = extractFlaggedFunction(finding, contractSource);

      if (flaggedFunction) {
        matchedRule = PER_FUNCTION_RULES.find(rule => {
          const detectorMatch = typeof rule.detector === 'string'
            ? finding.detectorName === rule.detector
            : rule.detector.test(finding.detectorName);
          if (!detectorMatch) return false;

          // Check if the SPECIFIC function has the modifier
          return rule.safePattern.test(flaggedFunction);
        });
      }
    }

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
