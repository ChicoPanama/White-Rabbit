/**
 * Parameter Bounds Checker
 *
 * Critical for arithmetic findings (SSV lesson):
 * An arithmetic overflow that requires `fee > type(uint64).max` but the protocol
 * caps fees at 1e10 will still be flagged as critical by Slither. This checker
 * validates whether trigger values are actually achievable given protocol constraints.
 *
 * For each arithmetic finding:
 * 1. Parse the contract source for setter functions of the flagged parameters
 * 2. Extract require() constraints and max/min bounds
 * 3. If trigger value exceeds protocol max → downgrade to informational
 */

import type { Finding, Severity } from '../types/index.js';

export interface BoundsCheckResult {
  isAchievable: boolean;
  parameterName: string | null;
  requiredValue: string | null;
  protocolBound: string | null;
  boundType: 'max' | 'min' | null;
  setterFunction: string | null;
  reason: string;
  suggestedSeverity: Severity | null;
}

interface ParameterBound {
  parameterName: string;
  boundType: 'max' | 'min';
  boundValue: string;
  setterFunction: string;
  requireCondition: string;
}

/**
 * Arithmetic detector patterns that need bounds checking.
 */
const ARITHMETIC_DETECTORS = [
  'divide-before-multiply',
  'integer-overflow',
  'integer-underflow',
  'unchecked-lowlevel',
  'unchecked-send',
  'arbitrary-send-eth',
  'arbitrary-send-erc20',
  'tautology',
  'weak-prng',
];

/**
 * Patterns to extract parameter names from arithmetic findings.
 */
const PARAMETER_PATTERNS = [
  // Variable assignment: "fee = ..."
  /\b(\w+)\s*=/,
  // Function parameter: "function foo(uint256 _fee)"
  /\b(?:uint\d*|int\d*)\s+(\w+)/,
  // State variable: "uint256 public fee"
  /\b(?:uint\d*|int\d*)\s+(?:public|private|internal)?\s*(\w+)/,
  // Common arithmetic variable names
  /\b(fee|rate|amount|balance|supply|shares|assets|price|value|limit|threshold|cap|max|min)\b/i,
];

/**
 * Patterns to find setter functions and their constraints.
 */
const SETTER_PATTERNS = [
  // setFee, setRate, setMax, etc.
  /function\s+(set\w+)\s*\([^)]*\b(\w+)\b[^)]*\)[^{]*\{([^}]+)\}/gs,
  // updateFee, updateRate, etc.
  /function\s+(update\w+)\s*\([^)]*\b(\w+)\b[^)]*\)[^{]*\{([^}]+)\}/gs,
  // initialize functions
  /function\s+(initialize)\s*\([^)]*\)[^{]*\{([^}]+)\}/gs,
  // constructor
  /constructor\s*\([^)]*\)[^{]*\{([^}]+)\}/gs,
];

/**
 * Patterns to extract require/assert constraints.
 */
const CONSTRAINT_PATTERNS = [
  // require(foo <= MAX)
  /require\s*\(\s*(\w+)\s*<=\s*([^,)]+)/g,
  // require(foo < MAX)
  /require\s*\(\s*(\w+)\s*<\s*([^,)]+)/g,
  // require(foo >= MIN)
  /require\s*\(\s*(\w+)\s*>=\s*([^,)]+)/g,
  // require(foo > MIN)
  /require\s*\(\s*(\w+)\s*>\s*([^,)]+)/g,
  // require(MAX >= foo)
  /require\s*\(\s*([^<>=]+)\s*>=\s*(\w+)/g,
  // if (foo > MAX) revert
  /if\s*\(\s*(\w+)\s*>\s*([^)]+)\s*\)\s*revert/g,
];

/**
 * Known constant bounds in common DeFi protocols.
 */
const KNOWN_BOUNDS: Record<string, { max?: string; min?: string }> = {
  fee: { max: '10000', min: '0' },          // 100% in basis points
  feeBps: { max: '10000', min: '0' },
  feePercent: { max: '100', min: '0' },
  slippage: { max: '10000', min: '0' },
  slippageBps: { max: '10000', min: '0' },
  rate: { max: '1e18', min: '0' },
  interestRate: { max: '1e18', min: '0' },
  borrowRate: { max: '1e18', min: '0' },
  utilization: { max: '1e18', min: '0' },
  collateralFactor: { max: '1e18', min: '0' },
  liquidationThreshold: { max: '1e18', min: '0' },
  ltv: { max: '10000', min: '0' },
  weight: { max: '1e18', min: '0' },
  multiplier: { max: '1e18', min: '0' },
};

export class ParameterBoundsChecker {
  /**
   * Check if an arithmetic finding's trigger values are achievable.
   */
  checkFinding(finding: Finding, sourceCode: string): BoundsCheckResult {
    // Only check arithmetic-related findings
    const isArithmeticFinding = ARITHMETIC_DETECTORS.some(d =>
      finding.detectorName.toLowerCase().includes(d.toLowerCase()),
    );

    if (!isArithmeticFinding) {
      return {
        isAchievable: true, // Assume achievable for non-arithmetic
        parameterName: null,
        requiredValue: null,
        protocolBound: null,
        boundType: null,
        setterFunction: null,
        reason: 'Not an arithmetic finding',
        suggestedSeverity: null,
      };
    }

    // Extract parameter name from finding
    const parameterName = this.extractParameterName(finding);
    if (!parameterName) {
      return {
        isAchievable: true, // Can't determine, assume achievable
        parameterName: null,
        requiredValue: null,
        protocolBound: null,
        boundType: null,
        setterFunction: null,
        reason: 'Could not determine parameter name',
        suggestedSeverity: null,
      };
    }

    // Find bounds for this parameter
    const bounds = this.findParameterBounds(parameterName, sourceCode);
    if (bounds.length === 0) {
      // Check known bounds
      const knownBound = this.checkKnownBounds(parameterName);
      if (knownBound) {
        bounds.push(knownBound);
      }
    }

    if (bounds.length === 0) {
      return {
        isAchievable: true, // No bounds found, assume achievable
        parameterName,
        requiredValue: null,
        protocolBound: null,
        boundType: null,
        setterFunction: null,
        reason: `No bounds found for parameter '${parameterName}'`,
        suggestedSeverity: null,
      };
    }

    // Extract required value from finding (if detectable)
    const requiredValue = this.extractRequiredValue(finding);

    // Check if any bound would prevent the exploit
    for (const bound of bounds) {
      if (requiredValue) {
        const isWithinBounds = this.checkValueWithinBounds(
          requiredValue,
          bound.boundValue,
          bound.boundType,
        );

        if (!isWithinBounds) {
          return {
            isAchievable: false,
            parameterName,
            requiredValue,
            protocolBound: bound.boundValue,
            boundType: bound.boundType,
            setterFunction: bound.setterFunction,
            reason: `Parameter '${parameterName}' is bounded by ${bound.boundType === 'max' ? '<=' : '>='} ${bound.boundValue} in ${bound.setterFunction}`,
            suggestedSeverity: 'informational',
          };
        }
      } else {
        // Can't determine required value, report the bound for context
        return {
          isAchievable: true, // Assume achievable but report bound
          parameterName,
          requiredValue: null,
          protocolBound: bound.boundValue,
          boundType: bound.boundType,
          setterFunction: bound.setterFunction,
          reason: `Parameter '${parameterName}' has bound ${bound.boundType === 'max' ? '<=' : '>='} ${bound.boundValue} - verify if trigger value is achievable`,
          suggestedSeverity: null,
        };
      }
    }

    return {
      isAchievable: true,
      parameterName,
      requiredValue,
      protocolBound: null,
      boundType: null,
      setterFunction: null,
      reason: 'Required value is within protocol bounds',
      suggestedSeverity: null,
    };
  }

  /**
   * Extract parameter name from finding description/code.
   */
  private extractParameterName(finding: Finding): string | null {
    const textToSearch = [
      finding.description,
      finding.codeSnippet ?? '',
      finding.title,
    ].join(' ');

    for (const pattern of PARAMETER_PATTERNS) {
      const match = pattern.exec(textToSearch);
      if (match && match[1]) {
        // Skip common non-parameter words
        const name = match[1];
        if (!['function', 'uint', 'int', 'address', 'bool', 'string', 'bytes'].includes(name.toLowerCase())) {
          return name;
        }
      }
    }

    return null;
  }

  /**
   * Find bounds for a parameter in setter functions.
   */
  private findParameterBounds(parameterName: string, sourceCode: string): ParameterBound[] {
    const bounds: ParameterBound[] = [];
    const normalizedParam = parameterName.toLowerCase();

    // Search for setter functions
    for (const setterPattern of SETTER_PATTERNS) {
      let match;
      const regex = new RegExp(setterPattern.source, setterPattern.flags);
      while ((match = regex.exec(sourceCode)) !== null) {
        const funcName = match[1];
        const funcBody = match[match.length - 1]; // Last capture group is body

        // Check if this setter is for our parameter
        if (!funcBody.toLowerCase().includes(normalizedParam)) {
          continue;
        }

        // Search for constraints in the function body
        for (const constraintPattern of CONSTRAINT_PATTERNS) {
          let constraintMatch;
          const constraintRegex = new RegExp(constraintPattern.source, constraintPattern.flags);
          while ((constraintMatch = constraintRegex.exec(funcBody)) !== null) {
            const [, leftSide, rightSide] = constraintMatch;

            // Determine which side is the parameter and which is the bound
            const leftNorm = leftSide.toLowerCase().trim();
            const rightNorm = rightSide.toLowerCase().trim();

            if (leftNorm.includes(normalizedParam)) {
              // Parameter on left: param <= MAX or param >= MIN
              const isMax = constraintPattern.source.includes('<=') || constraintPattern.source.includes('<');
              bounds.push({
                parameterName,
                boundType: isMax ? 'max' : 'min',
                boundValue: rightSide.trim(),
                setterFunction: funcName,
                requireCondition: constraintMatch[0],
              });
            } else if (rightNorm.includes(normalizedParam)) {
              // Parameter on right: MAX >= param or MIN <= param
              const isMax = constraintPattern.source.includes('>=') || constraintPattern.source.includes('>');
              bounds.push({
                parameterName,
                boundType: isMax ? 'max' : 'min',
                boundValue: leftSide.trim(),
                setterFunction: funcName,
                requireCondition: constraintMatch[0],
              });
            }
          }
        }
      }
    }

    return bounds;
  }

  /**
   * Check known bounds for common parameter names.
   */
  private checkKnownBounds(parameterName: string): ParameterBound | null {
    const normalizedParam = parameterName.toLowerCase();

    for (const [knownName, bounds] of Object.entries(KNOWN_BOUNDS)) {
      if (normalizedParam.includes(knownName.toLowerCase())) {
        if (bounds.max) {
          return {
            parameterName,
            boundType: 'max',
            boundValue: bounds.max,
            setterFunction: 'known-convention',
            requireCondition: `${parameterName} <= ${bounds.max} (DeFi convention)`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract required value from finding (e.g., "overflow requires value > 2^64").
   */
  private extractRequiredValue(finding: Finding): string | null {
    const text = [finding.description, finding.codeSnippet ?? ''].join(' ');

    // Look for patterns like "requires X > Y" or "when X exceeds Y"
    const patterns = [
      /requires?\s+\w+\s*[><=]+\s*(\d+(?:e\d+)?|\w+)/i,
      /overflow\s+(?:when|if)\s+\w+\s*[><=]+\s*(\d+(?:e\d+)?|\w+)/i,
      /exceeds?\s+(\d+(?:e\d+)?|\w+)/i,
      /type\(uint(\d+)\)\.max/i, // type(uint64).max
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        // Handle type(uintN).max
        if (match[0].includes('type(uint')) {
          const bits = parseInt(match[1]);
          return `2^${bits} - 1`;
        }
        return match[1];
      }
    }

    return null;
  }

  /**
   * Check if a value is within bounds.
   */
  private checkValueWithinBounds(value: string, bound: string, boundType: 'max' | 'min'): boolean {
    // Try to parse as numbers
    const numValue = this.parseNumericValue(value);
    const numBound = this.parseNumericValue(bound);

    if (numValue === null || numBound === null) {
      // Can't compare, assume achievable
      return true;
    }

    if (boundType === 'max') {
      return numValue <= numBound;
    } else {
      return numValue >= numBound;
    }
  }

  /**
   * Parse a string value to a number (handles scientific notation, 2^N, etc.).
   */
  private parseNumericValue(value: string): number | null {
    const trimmed = value.trim();

    // Handle 2^N notation
    const powerMatch = trimmed.match(/2\^(\d+)/);
    if (powerMatch) {
      return Math.pow(2, parseInt(powerMatch[1]));
    }

    // Handle 1eN notation
    const sciMatch = trimmed.match(/(\d+)e(\d+)/i);
    if (sciMatch) {
      return parseFloat(sciMatch[1]) * Math.pow(10, parseInt(sciMatch[2]));
    }

    // Handle regular numbers
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      return num;
    }

    return null;
  }

  /**
   * Batch check all findings and filter/downgrade based on bounds.
   */
  filterFindings(
    findings: Finding[],
    sourceCode: string,
  ): {
    findings: Finding[];
    boundsChecks: Array<{ finding: Finding; result: BoundsCheckResult }>;
  } {
    const result: Finding[] = [];
    const boundsChecks: Array<{ finding: Finding; result: BoundsCheckResult }> = [];

    for (const finding of findings) {
      const check = this.checkFinding(finding, sourceCode);
      boundsChecks.push({ finding, result: check });

      if (!check.isAchievable && check.suggestedSeverity) {
        // Downgrade severity
        const modified: Finding = {
          ...finding,
          severity: check.suggestedSeverity,
          aiAssessment: (finding.aiAssessment ?? '') +
            ` [BOUNDS CHECK: ${check.reason}]`,
        };
        result.push(modified);
      } else {
        result.push(finding);
      }
    }

    return { findings: result, boundsChecks };
  }
}
