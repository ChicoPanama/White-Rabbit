/**
 * Parameter Bounds Checker
 *
 * Critical for arithmetic findings (SSV lesson):
 * An arithmetic overflow requiring fee > 2^64 when the protocol caps fees
 * at 1e10 should not be flagged as critical. This checker validates
 * whether trigger values are actually achievable.
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
  /\b(\w+)\s*=/,
  /\b(?:uint\d*|int\d*)\s+(\w+)/,
  /\b(?:uint\d*|int\d*)\s+(?:public|private|internal)?\s*(\w+)/,
  /\b(fee|rate|amount|balance|supply|shares|assets|price|value|limit|threshold|cap|max|min)\b/i,
];

/**
 * Patterns to find setter functions and their constraints.
 */
const SETTER_PATTERNS = [
  /function\s+(set\w+)\s*\([^)]*\b(\w+)\b[^)]*\)[^{]*\{([^}]+)\}/gs,
  /function\s+(update\w+)\s*\([^)]*\b(\w+)\b[^)]*\)[^{]*\{([^}]+)\}/gs,
  /function\s+(initialize)\s*\([^)]*\)[^{]*\{([^}]+)\}/gs,
  /constructor\s*\([^)]*\)[^{]*\{([^}]+)\}/gs,
];

/**
 * Patterns to extract require/assert constraints.
 */
const CONSTRAINT_PATTERNS = [
  /require\s*\(\s*(\w+)\s*<=\s*([^,)]+)/g,
  /require\s*\(\s*(\w+)\s*<\s*([^,)]+)/g,
  /require\s*\(\s*(\w+)\s*>=\s*([^,)]+)/g,
  /require\s*\(\s*(\w+)\s*>\s*([^,)]+)/g,
  /require\s*\(\s*([^<>=]+)\s*>=\s*(\w+)/g,
  /if\s*\(\s*(\w+)\s*>\s*([^)]+)\s*\)\s*revert/g,
];

/**
 * Known constant bounds in common DeFi protocols.
 */
const KNOWN_BOUNDS: Record<string, { max?: string; min?: string }> = {
  fee: { max: '10000', min: '0' },
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
    const isArithmeticFinding = ARITHMETIC_DETECTORS.some(d =>
      finding.detectorName.toLowerCase().includes(d.toLowerCase()),
    );

    if (!isArithmeticFinding) {
      return {
        isAchievable: true,
        parameterName: null,
        requiredValue: null,
        protocolBound: null,
        boundType: null,
        setterFunction: null,
        reason: 'Not an arithmetic finding',
        suggestedSeverity: null,
      };
    }

    const parameterName = this.extractParameterName(finding);
    if (!parameterName) {
      return {
        isAchievable: true,
        parameterName: null,
        requiredValue: null,
        protocolBound: null,
        boundType: null,
        setterFunction: null,
        reason: 'Could not determine parameter name',
        suggestedSeverity: null,
      };
    }

    const bounds = this.findParameterBounds(parameterName, sourceCode);
    if (bounds.length === 0) {
      const knownBound = this.checkKnownBounds(parameterName);
      if (knownBound) {
        bounds.push(knownBound);
      }
    }

    if (bounds.length === 0) {
      return {
        isAchievable: true,
        parameterName,
        requiredValue: null,
        protocolBound: null,
        boundType: null,
        setterFunction: null,
        reason: `No bounds found for parameter '${parameterName}'`,
        suggestedSeverity: null,
      };
    }

    const requiredValue = this.extractRequiredValue(finding);

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
        return {
          isAchievable: true,
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

  private extractParameterName(finding: Finding): string | null {
    const textToSearch = [
      finding.description,
      finding.codeSnippet ?? '',
      finding.title,
    ].join(' ');

    for (const pattern of PARAMETER_PATTERNS) {
      const match = pattern.exec(textToSearch);
      if (match && match[1]) {
        const name = match[1];
        if (!['function', 'uint', 'int', 'address', 'bool', 'string', 'bytes'].includes(name.toLowerCase())) {
          return name;
        }
      }
    }
    return null;
  }

  private findParameterBounds(parameterName: string, sourceCode: string): ParameterBound[] {
    const bounds: ParameterBound[] = [];
    const normalizedParam = parameterName.toLowerCase();

    for (const setterPattern of SETTER_PATTERNS) {
      let match;
      const regex = new RegExp(setterPattern.source, setterPattern.flags);
      while ((match = regex.exec(sourceCode)) !== null) {
        const funcName = match[1];
        const funcBody = match[match.length - 1];

        if (!funcBody.toLowerCase().includes(normalizedParam)) {
          continue;
        }

        for (const constraintPattern of CONSTRAINT_PATTERNS) {
          let constraintMatch;
          const constraintRegex = new RegExp(constraintPattern.source, constraintPattern.flags);
          while ((constraintMatch = constraintRegex.exec(funcBody)) !== null) {
            const [, leftSide, rightSide] = constraintMatch;
            const leftNorm = leftSide.toLowerCase().trim();
            const rightNorm = rightSide.toLowerCase().trim();

            if (leftNorm.includes(normalizedParam)) {
              const isMax = constraintPattern.source.includes('<=') || constraintPattern.source.includes('<');
              bounds.push({
                parameterName,
                boundType: isMax ? 'max' : 'min',
                boundValue: rightSide.trim(),
                setterFunction: funcName,
                requireCondition: constraintMatch[0],
              });
            } else if (rightNorm.includes(normalizedParam)) {
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

  private extractRequiredValue(finding: Finding): string | null {
    const text = [finding.description, finding.codeSnippet ?? ''].join(' ');
    const patterns = [
      /requires?\s+\w+\s*[><=]+\s*(\d+(?:e\d+)?|\w+)/i,
      /overflow\s+(?:when|if)\s+\w+\s*[><=]+\s*(\d+(?:e\d+)?|\w+)/i,
      /exceeds?\s+(\d+(?:e\d+)?|\w+)/i,
      /type\(uint(\d+)\)\.max/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        if (match[0].includes('type(uint')) {
          const bits = parseInt(match[1]);
          return `2^${bits} - 1`;
        }
        return match[1];
      }
    }
    return null;
  }

  private checkValueWithinBounds(value: string, bound: string, boundType: 'max' | 'min'): boolean {
    const numValue = this.parseNumericValue(value);
    const numBound = this.parseNumericValue(bound);

    if (numValue === null || numBound === null) {
      return true;
    }

    if (boundType === 'max') {
      return numValue <= numBound;
    } else {
      return numValue >= numBound;
    }
  }

  private parseNumericValue(value: string): number | null {
    const trimmed = value.trim();
    const powerMatch = trimmed.match(/2\^(\d+)/);
    if (powerMatch) {
      return Math.pow(2, parseInt(powerMatch[1]));
    }
    const sciMatch = trimmed.match(/(\d+)e(\d+)/i);
    if (sciMatch) {
      return parseFloat(sciMatch[1]) * Math.pow(10, parseInt(sciMatch[2]));
    }
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
