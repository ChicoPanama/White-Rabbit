/**
 * Local False Positive Filter
 *
 * Critical fix: The previous FP filter checked if patterns like ReentrancyGuard
 * exist ANYWHERE in the contract. This means if ANY function has the guard,
 * ALL reentrancy findings were filtered out — even for unprotected functions.
 *
 * This filter checks if the SPECIFIC function flagged in the finding has
 * the relevant protection modifier.
 */

import type { Finding } from '../types/index.js';

export interface FPFilterResult {
  isFalsePositive: boolean;
  reason: string | null;
  detectedProtection: string | null;
}

interface PerFunctionFPPattern {
  detector: RegExp;
  modifierPattern: RegExp;
  reason: string;
  protectionName: string;
}

/**
 * Per-function false positive patterns.
 * These only trigger FP if the SPECIFIC flagged function has the modifier.
 */
const PER_FUNCTION_FP_PATTERNS: PerFunctionFPPattern[] = [
  {
    detector: /^reentrancy/i,
    modifierPattern: /\bnonReentrant\b/,
    reason: 'Function is protected by nonReentrant modifier',
    protectionName: 'nonReentrant',
  },
  {
    detector: /^reentrancy/i,
    modifierPattern: /\block\s*\(\s*\)/,
    reason: 'Function uses explicit lock pattern',
    protectionName: 'lock()',
  },
  {
    detector: /arbitrary-send-eth/i,
    modifierPattern: /\bonlyOwner\b/,
    reason: 'Function is restricted to owner',
    protectionName: 'onlyOwner',
  },
  {
    detector: /arbitrary-send-eth/i,
    modifierPattern: /\bonlyAdmin\b/,
    reason: 'Function is restricted to admin',
    protectionName: 'onlyAdmin',
  },
  {
    detector: /arbitrary-send-eth/i,
    modifierPattern: /\bonlyRole\s*\([^)]+\)/,
    reason: 'Function is role-restricted',
    protectionName: 'onlyRole',
  },
  {
    detector: /arbitrary-send-erc20/i,
    modifierPattern: /\bonlyOwner\b/,
    reason: 'Function is restricted to owner',
    protectionName: 'onlyOwner',
  },
  {
    detector: /arbitrary-send-erc20/i,
    modifierPattern: /\bonlyAdmin\b/,
    reason: 'Function is restricted to admin',
    protectionName: 'onlyAdmin',
  },
  {
    detector: /controlled-delegatecall/i,
    modifierPattern: /\bonlyOwner\b/,
    reason: 'Delegatecall is restricted to owner',
    protectionName: 'onlyOwner',
  },
  {
    detector: /controlled-delegatecall/i,
    modifierPattern: /\b_checkProxy\b/,
    reason: 'Delegatecall is part of proxy pattern',
    protectionName: '_checkProxy',
  },
  {
    detector: /suicidal/i,
    modifierPattern: /\bonlyOwner\b/,
    reason: 'Self-destruct is restricted to owner',
    protectionName: 'onlyOwner',
  },
];

/**
 * Global FP patterns that apply contract-wide.
 * These are patterns where presence ANYWHERE in the contract means the
 * finding is very unlikely to be exploitable.
 */
interface GlobalFPPattern {
  detector: RegExp;
  globalPattern: RegExp;
  reason: string;
}

const GLOBAL_FP_PATTERNS: GlobalFPPattern[] = [
  {
    detector: /oracle-manipulation/i,
    globalPattern: /\bTWAP\b|\btimeWeightedAverage\b|\bobserve\s*\(/i,
    reason: 'Contract uses TWAP oracle (manipulation resistant)',
  },
  {
    detector: /uninitialized-state/i,
    globalPattern: /\bInitializable\b|\binitializer\b|constructor\s*\(/i,
    reason: 'Contract uses proper initialization pattern',
  },
  {
    detector: /tx-origin/i,
    globalPattern: /tx\.origin\s*==\s*msg\.sender/i,
    reason: 'tx.origin used as additional check alongside msg.sender',
  },
];

export class LocalFPFilter {
  /**
   * Check if a finding is a false positive by examining the SPECIFIC
   * function flagged, not the entire contract.
   */
  checkFinding(finding: Finding, sourceCode: string): FPFilterResult {
    const detectorName = finding.detectorName.toLowerCase();

    // First check global patterns (contract-wide)
    for (const pattern of GLOBAL_FP_PATTERNS) {
      if (pattern.detector.test(detectorName)) {
        if (pattern.globalPattern.test(sourceCode)) {
          return {
            isFalsePositive: true,
            reason: pattern.reason,
            detectedProtection: null,
          };
        }
      }
    }

    // Extract the flagged function from source code
    const flaggedFunction = this.extractFlaggedFunction(finding, sourceCode);
    if (!flaggedFunction) {
      // Can't determine the specific function, don't filter
      return { isFalsePositive: false, reason: null, detectedProtection: null };
    }

    // Check per-function patterns
    for (const pattern of PER_FUNCTION_FP_PATTERNS) {
      if (pattern.detector.test(detectorName)) {
        if (pattern.modifierPattern.test(flaggedFunction.declaration)) {
          return {
            isFalsePositive: true,
            reason: pattern.reason,
            detectedProtection: pattern.protectionName,
          };
        }
      }
    }

    return { isFalsePositive: false, reason: null, detectedProtection: null };
  }

  /**
   * Extract the function declaration and body for the flagged finding.
   */
  private extractFlaggedFunction(
    finding: Finding,
    sourceCode: string,
  ): { name: string; declaration: string; body: string } | null {
    // Method 1: Use line numbers if available
    if (finding.lineStart != null && finding.lineEnd != null) {
      const lines = sourceCode.split('\n');
      const startLine = Math.max(0, finding.lineStart - 1);
      const endLine = Math.min(lines.length - 1, finding.lineEnd);

      // Search backwards from startLine to find function declaration
      let funcStart = startLine;
      for (let i = startLine; i >= 0; i--) {
        const line = lines[i];
        if (/^\s*(function|modifier|constructor|receive|fallback)\s+/.test(line) ||
            /^\s*(function|modifier|constructor)\s*\(/.test(line)) {
          funcStart = i;
          break;
        }
        // Stop if we hit another function's closing brace or contract declaration
        if (/^\s*\}\s*$/.test(line) || /^\s*(contract|library|interface)\s+/.test(line)) {
          break;
        }
      }

      // Get the function declaration line(s)
      const declarationLines: string[] = [];
      let braceCount = 0;
      let foundOpenBrace = false;
      for (let i = funcStart; i <= endLine && i < lines.length; i++) {
        declarationLines.push(lines[i]);
        for (const char of lines[i]) {
          if (char === '{') {
            foundOpenBrace = true;
            braceCount++;
          } else if (char === '}') {
            braceCount--;
          }
        }
        if (foundOpenBrace && braceCount === 0) break;
      }

      const declaration = declarationLines.join('\n');
      // The declaration is everything up to (and including) the first '{'
      const declMatch = declaration.match(/^[\s\S]*?\{/);

      return {
        name: this.extractFunctionName(declaration) ?? 'unknown',
        declaration: declMatch ? declMatch[0] : declaration.split('{')[0],
        body: declaration,
      };
    }

    // Method 2: Parse function name from codeSnippet
    if (finding.codeSnippet) {
      const funcName = this.extractFunctionName(finding.codeSnippet);
      if (funcName) {
        return this.findFunctionByName(funcName, sourceCode);
      }
    }

    // Method 3: Parse function name from description
    const descMatch = finding.description.match(/(?:function|modifier)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (descMatch) {
      return this.findFunctionByName(descMatch[1], sourceCode);
    }

    return null;
  }

  /**
   * Extract function name from code snippet or declaration.
   */
  private extractFunctionName(code: string): string | null {
    // Match "function name(" or "function name ("
    const match = code.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (match) return match[1];

    // Match modifier declarations
    const modMatch = code.match(/modifier\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (modMatch) return modMatch[1];

    return null;
  }

  /**
   * Find a function by name in the source code and return its declaration + body.
   */
  private findFunctionByName(
    name: string,
    sourceCode: string,
  ): { name: string; declaration: string; body: string } | null {
    // Build regex to find function declaration
    const funcRegex = new RegExp(
      `(function\\s+${name}\\s*\\([^)]*\\)[^{]*\\{)`,
      'g',
    );

    const match = funcRegex.exec(sourceCode);
    if (!match) return null;

    const startIdx = match.index;
    const declaration = match[1];

    // Find matching closing brace
    let braceCount = 1;
    let endIdx = startIdx + declaration.length;
    for (let i = endIdx; i < sourceCode.length && braceCount > 0; i++) {
      if (sourceCode[i] === '{') braceCount++;
      else if (sourceCode[i] === '}') braceCount--;
      endIdx = i + 1;
    }

    return {
      name,
      declaration,
      body: sourceCode.slice(startIdx, endIdx),
    };
  }

  /**
   * Batch filter findings, separating real findings from false positives.
   */
  filterFindings(
    findings: Finding[],
    sourceCode: string,
  ): {
    real: Finding[];
    falsePositives: Array<{ finding: Finding; reason: string; protection: string | null }>;
  } {
    const real: Finding[] = [];
    const falsePositives: Array<{ finding: Finding; reason: string; protection: string | null }> = [];

    for (const finding of findings) {
      const result = this.checkFinding(finding, sourceCode);
      if (result.isFalsePositive && result.reason) {
        falsePositives.push({
          finding,
          reason: result.reason,
          protection: result.detectedProtection,
        });
      } else {
        real.push(finding);
      }
    }

    return { real, falsePositives };
  }
}
