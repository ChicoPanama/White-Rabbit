/**
 * Vyper Contract Handler
 * Handles Vyper contracts that Slither can't process natively
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Finding } from '../types/index.js';

const execAsync = promisify(exec);

export class VyperHandler {
  /**
   * Check if a contract is written in Vyper
   */
  isVyperContract(sourceCode: string): boolean {
    return sourceCode.includes('# @version') || 
           sourceCode.includes('@external') ||
           sourceCode.includes('@internal') ||
           sourceCode.includes('@pure') ||
           sourceCode.includes('@view') ||
           sourceCode.includes('def ') && sourceCode.includes(':');
  }

  /**
   * Analyze Vyper contract for common vulnerability patterns
   */
  async analyzeVyperContract(sourceCode: string, contractName: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Pattern-based analysis for Vyper-specific vulnerabilities
      const patterns = [
        {
          name: 'vyper-reentrancy',
          pattern: /\.call\s*\([^)]*\)|\.delegatecall\s*\([^)]*\)|raw_call\s*\(/gi,
          severity: 'high' as const,
          description: 'Potential reentrancy vulnerability in external call',
          impact: 'An attacker could exploit reentrancy to drain contract funds'
        },
        {
          name: 'vyper-overflow',
          pattern: /\+\s*[^=\s]+(?!\s*[<>=])|[^=\s]+\s*\+(?!\s*[=<>])/gi,
          severity: 'medium' as const,
          description: 'Potential integer overflow in arithmetic operation',
          impact: 'Arithmetic operations could overflow and produce unexpected results'
        },
        {
          name: 'vyper-external-call',
          pattern: /@external\s+def\s+\w+.*?(?=@|\n\s*def|\Z)/gis,
          severity: 'informational' as const,
          description: 'External function detected - review access controls',
          impact: 'External functions should have proper access controls'
        },
        {
          name: 'vyper-send-ether',
          pattern: /send\s*\([^)]*\)|transfer\s*\([^)]*\)|\.value\s*\(/gi,
          severity: 'medium' as const,
          description: 'Ether transfer detected - check for failure handling',
          impact: 'Ether transfers can fail and should be handled properly'
        },
        {
          name: 'vyper-selfdestruct',
          pattern: /selfdestruct\s*\(|suicide\s*\(/gi,
          severity: 'critical' as const,
          description: 'Contract self-destruction capability detected',
          impact: 'Malicious actors could permanently destroy the contract'
        },
        {
          name: 'vyper-unchecked-call',
          pattern: /raw_call\s*\([^)]*success\s*=[^)]*\)/gi,
          severity: 'medium' as const,
          description: 'Unchecked raw call detected',
          impact: 'Failed calls should be properly handled'
        }
      ];

      for (const pattern of patterns) {
        const matches = sourceCode.matchAll(pattern.pattern);
        for (const match of matches) {
          const lineNumber = sourceCode.substring(0, match.index).split('\n').length;
          
          const recommendation = this.getRecommendation(pattern.name);
          findings.push({
            id: '',
            scanId: '',
            contractId: contractName,
            detectorName: pattern.name,
            tool: 'vyper-handler',
            severity: pattern.severity,
            confidence: 'medium',
            title: pattern.description,
            description: `${pattern.description}\n\nLocation: Line ${lineNumber}\nCode: ${match[0].substring(0, 100)}...\n\nImpact: ${pattern.impact}\n\nRecommendation: ${recommendation}`,
            codeSnippet: match[0].substring(0, 200),
            filePath: contractName,
            lineStart: lineNumber,
            lineEnd: lineNumber,
            aiAssessment: null,
            aiIsFalsePositive: null,
            deduplicatedGroupId: null,
          });
        }
      }

      console.log(`[VyperHandler] Analyzed ${contractName}: ${findings.length} potential issues found`);
      return findings;

    } catch (error) {
      console.log(`[VyperHandler] Analysis failed for ${contractName}:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Get recommendations for Vyper-specific vulnerabilities
   */
  private getRecommendation(detectorName: string): string {
    const recommendations: Record<string, string> = {
      'vyper-reentrancy': 'Use checks-effects-interactions pattern and consider reentrancy guards',
      'vyper-overflow': 'Use safe math operations or explicit overflow checks',
      'vyper-external-call': 'Implement proper access controls and input validation',
      'vyper-send-ether': 'Always check return values of transfer operations',
      'vyper-selfdestruct': 'Restrict selfdestruct to authorized users only',
      'vyper-unchecked-call': 'Always check return values and handle failures appropriately'
    };

    return recommendations[detectorName] || 'Review the flagged code for potential security issues';
  }

  /**
   * Extract function signatures from Vyper contract
   */
  extractFunctionSignatures(sourceCode: string): string[] {
    const functionRegex = /@external\s+def\s+(\w+)\s*\([^)]*\)/gi;
    const functions: string[] = [];
    let match;

    while ((match = functionRegex.exec(sourceCode)) !== null) {
      functions.push(match[1]);
    }

    return functions;
  }

  /**
   * Check if Vyper contract has potential high-value functions
   */
  hasHighValueFunctions(sourceCode: string): boolean {
    const highValuePatterns = [
      /withdraw/gi,
      /transfer/gi,
      /approve/gi,
      /mint/gi,
      /burn/gi,
      /deposit/gi,
      /claim/gi,
      /redeem/gi
    ];

    return highValuePatterns.some(pattern => pattern.test(sourceCode));
  }
}

export const vyperHandler = new VyperHandler();