/**
 * Pattern-Based Vulnerability Analyzer
 * Fallback for contracts that fail Slither compilation
 * Enhanced with micro-protocol specific patterns
 */

import type { Finding, Severity, Confidence } from '../types/index.js';

/** Pattern definition */
interface VulnPattern {
  name: string;
  pattern: RegExp;
  severity: Severity;
  confidence: Confidence;
  description: string;
  impact: string;
  recommendation: string;
  category?: 'general' | 'micro-protocol' | 'defi' | 'access-control' | 'oracle';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO-PROTOCOL SPECIFIC PATTERNS
// These are commonly found in small/new protocols with limited security review
// ═══════════════════════════════════════════════════════════════════════════════

const MICRO_PROTOCOL_PATTERNS: VulnPattern[] = [
  // ── Ownership & Access Control ──
  {
    name: 'unprotected-admin-function',
    pattern: /function\s+(set[A-Z]\w+|update[A-Z]\w+|change[A-Z]\w+|modify[A-Z]\w+)\s*\([^)]*\)\s*(public|external)(?![^{]*(?:onlyOwner|onlyAdmin|require\s*\(\s*msg\.sender|_checkOwner|hasRole))/gi,
    severity: 'critical',
    confidence: 'medium',
    description: 'Public admin function without access control',
    impact: 'Anyone can call sensitive admin functions, potentially draining funds or manipulating contract state',
    recommendation: 'Add onlyOwner modifier or access control checks',
    category: 'access-control',
  },
  {
    name: 'single-step-ownership-transfer',
    pattern: /function\s+transferOwnership\s*\([^)]*\)[^{]*\{[^}]*owner\s*=\s*(?:newOwner|_newOwner|\w+)/gi,
    severity: 'high',
    confidence: 'high',
    description: 'Single-step ownership transfer without confirmation',
    impact: 'Owner can accidentally transfer to wrong address with no recovery, losing control of contract',
    recommendation: 'Implement 2-step ownership transfer (propose + accept)',
    category: 'access-control',
  },
  {
    name: 'unprotected-mint',
    pattern: /function\s+mint\s*\([^)]*\)\s*(public|external)(?![^{]*(?:onlyOwner|onlyMinter|require|hasRole))/gi,
    severity: 'critical',
    confidence: 'high',
    description: 'Unprotected mint function - infinite token creation',
    impact: 'Anyone can mint unlimited tokens, destroying token value',
    recommendation: 'Add onlyMinter or onlyOwner modifier to mint function',
    category: 'micro-protocol',
  },
  {
    name: 'hidden-mint-capability',
    pattern: /onlyOwner[^}]*_mint\s*\(|owner[^}]*_mint\s*\(/gi,
    severity: 'high',
    confidence: 'medium',
    description: 'Owner can mint unlimited tokens (rug risk)',
    impact: 'Protocol owner can inflate token supply at will',
    recommendation: 'Review if owner mint capability is documented and justified',
    category: 'micro-protocol',
  },
  {
    name: 'no-timelock-sensitive',
    pattern: /function\s+(setFee|changeFee|updateFee|setRate|changeRate|updateReward|setReward)\s*\([^)]*\)[^{]*onlyOwner(?![^}]*timelock)/gi,
    severity: 'high',
    confidence: 'medium',
    description: 'Sensitive function without timelock',
    impact: 'Owner can instantly change fees/rates, potentially front-running users',
    recommendation: 'Add timelock delay for sensitive parameter changes',
    category: 'micro-protocol',
  },

  // ── Oracle Manipulation ──
  {
    name: 'spot-price-oracle',
    pattern: /getReserves\s*\(\s*\)[^;]*[/\*][^;]*(?:price|rate|amount)/gi,
    severity: 'critical',
    confidence: 'high',
    description: 'Using spot reserves for price calculation - flashloan manipulable',
    impact: 'Attacker can use flashloan to manipulate reserves and exploit price-dependent logic',
    recommendation: 'Use TWAP oracle (e.g., Uniswap V3 TWAP) instead of spot prices',
    category: 'oracle',
  },
  {
    name: 'uniswap-v3-spot-price',
    pattern: /slot0\s*\(\s*\)[^;]*sqrtPrice/gi,
    severity: 'critical',
    confidence: 'high',
    description: 'Using Uniswap V3 slot0 for price - manipulable within single block',
    impact: 'slot0 returns current tick price which can be manipulated via flashloan',
    recommendation: 'Use Uniswap V3 observe() function for TWAP pricing',
    category: 'oracle',
  },
  {
    name: 'balance-based-price',
    pattern: /balanceOf\s*\([^)]+\)\s*[/*]\s*balanceOf\s*\([^)]+\)/gi,
    severity: 'critical',
    confidence: 'high',
    description: 'Calculating price from token balances - easily manipulated',
    impact: 'Attacker can manipulate balance ratio via flashloan for favorable pricing',
    recommendation: 'Use external oracle (Chainlink, TWAP) for pricing',
    category: 'oracle',
  },
  {
    name: 'single-oracle-no-fallback',
    pattern: /latestRoundData\s*\(\s*\)(?![^}]*(?:fallback|secondary|backup))/gi,
    severity: 'medium',
    confidence: 'medium',
    description: 'Single oracle dependency without fallback',
    impact: 'If Chainlink feed fails or returns stale data, contract may malfunction',
    recommendation: 'Implement fallback oracle or staleness checks',
    category: 'oracle',
  },

  // ── Yield Farming Specific ──
  {
    name: 'harvest-no-protection',
    pattern: /function\s+(harvest|claim|claimReward|getReward)\s*\([^)]*\)\s*(public|external)(?![^{]*(?:nonReentrant|ReentrancyGuard))/gi,
    severity: 'high',
    confidence: 'medium',
    description: 'Harvest function without reentrancy protection',
    impact: 'Potential for reentrancy attack during reward claims',
    recommendation: 'Add nonReentrant modifier to harvest functions',
    category: 'defi',
  },
  {
    name: 'reward-calculation-precision',
    pattern: /rewardPerToken[^}]*\*[^}]*balance[^}]*\/[^}]*totalSupply/gi,
    severity: 'medium',
    confidence: 'low',
    description: 'Potential precision loss in reward calculation',
    impact: 'Rounding errors may accumulate, leading to incorrect reward distribution',
    recommendation: 'Use higher precision (e.g., 1e18 scaling) in calculations',
    category: 'defi',
  },

  // ── Zero Address Validation ──
  {
    name: 'missing-zero-address-check',
    pattern: /function\s+(?:set|update|change)[A-Z]\w*\s*\(\s*address\s+\w+\s*\)[^{]*\{(?![^}]*require\s*\([^)]*!=\s*address\s*\(\s*0\s*\))/gi,
    severity: 'medium',
    confidence: 'medium',
    description: 'No zero address validation in setter',
    impact: 'Critical address can be set to 0x0, bricking contract functionality',
    recommendation: 'Add require(newAddress != address(0)) check',
    category: 'general',
  },

  // ── L2 Specific (Base) ──
  {
    name: 'l2-timestamp-dependency',
    pattern: /require\s*\([^)]*block\.timestamp[^)]*[<>][^)]*\)/gi,
    severity: 'low',
    confidence: 'medium',
    description: 'L2 timestamp dependency in require statement',
    impact: 'L2 block timestamps can be manipulated during sequencer downtime',
    recommendation: 'Use block.number or add sequencer uptime feed check',
    category: 'general',
  },

  // ── Rug Pull Indicators ──
  {
    name: 'pause-no-unpause',
    pattern: /function\s+pause\s*\([^)]*\)[^}]*onlyOwner(?![^}]*unpause)/gi,
    severity: 'medium',
    confidence: 'low',
    description: 'Pausable contract may lack unpause function',
    impact: 'Owner could permanently pause contract, locking user funds',
    recommendation: 'Ensure unpause function exists and is documented',
    category: 'micro-protocol',
  },
  {
    name: 'blacklist-capability',
    pattern: /mapping\s*\([^)]*\)\s*(public|private|internal)\s+(?:blacklist|blocklist|banned|frozen)/gi,
    severity: 'medium',
    confidence: 'high',
    description: 'Contract has blacklist functionality',
    impact: 'Owner can freeze specific addresses, potential for targeted censorship',
    recommendation: 'Document blacklist policy; consider timelock for blacklist changes',
    category: 'micro-protocol',
  },
  {
    name: 'unlimited-approval-drain',
    pattern: /transferFrom\s*\([^)]*,[^)]*,[^)]*allowance/gi,
    severity: 'high',
    confidence: 'low',
    description: 'Potential for draining unlimited approvals',
    impact: 'If users grant unlimited approval, contract could drain their tokens',
    recommendation: 'Implement approve patterns that minimize approval amounts',
    category: 'defi',
  },
];

export class PatternAnalyzer {
  private microProtocolMode: boolean = false;

  /**
   * Enable/disable micro-protocol pattern matching
   */
  setMicroProtocolMode(enabled: boolean): void {
    this.microProtocolMode = enabled;
  }

  /**
   * Analyze contract source code for common vulnerability patterns
   */
  analyze(contractAddress: string, sourceCode: string, contractName?: string): Finding[] {
    const findings: Finding[] = [];

    // Combine general patterns with micro-protocol patterns
    const allPatterns = this.microProtocolMode
      ? [...this.getGeneralPatterns(), ...MICRO_PROTOCOL_PATTERNS]
      : this.getGeneralPatterns();

    for (const pattern of allPatterns) {
      const matches = [...sourceCode.matchAll(pattern.pattern)];
      for (const match of matches) {
        const lineNumber = this.getLineNumber(sourceCode, match.index || 0);
        const codeContext = this.getCodeContext(sourceCode, match.index || 0);

        findings.push({
          id: '',
          scanId: '',
          contractId: contractAddress,
          detectorName: pattern.name,
          tool: 'pattern-analyzer',
          severity: pattern.severity,
          confidence: pattern.confidence,
          title: pattern.description,
          description: `${pattern.description}\n\nLocation: Line ${lineNumber}\nCode: ${codeContext}\n\nImpact: ${pattern.impact}\n\nRecommendation: ${pattern.recommendation}`,
          codeSnippet: codeContext,
          filePath: contractAddress,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          aiAssessment: null,
          aiIsFalsePositive: null,
          deduplicatedGroupId: null,
        });
      }
    }

    console.log(`[PatternAnalyzer] Found ${findings.length} potential issues in ${contractAddress}${this.microProtocolMode ? ' (micro-protocol mode)' : ''}`);
    return findings;
  }

  /**
   * Get general vulnerability patterns (original patterns)
   */
  private getGeneralPatterns(): VulnPattern[] {
    return [
      {
        name: 'reentrancy-call',
        pattern: /\.call(?:\s*\{[^}]*\})?\s*\([^)]*\)/gi,
        severity: 'high',
        confidence: 'medium',
        description: 'External call detected - potential reentrancy vulnerability',
        impact: 'Contract could be vulnerable to reentrancy attacks that drain funds',
        recommendation: 'Use checks-effects-interactions pattern and reentrancy guards',
        category: 'general',
      },
      {
        name: 'delegatecall-usage',
        pattern: /\.delegatecall\s*\(/gi,
        severity: 'critical',
        confidence: 'high',
        description: 'Delegatecall usage detected',
        impact: 'Delegatecall can completely compromise contract security if target is malicious',
        recommendation: 'Ensure delegatecall targets are trusted and immutable',
        category: 'general',
      },
      {
        name: 'selfdestruct',
        pattern: /selfdestruct\s*\(|suicide\s*\(/gi,
        severity: 'critical',
        confidence: 'high',
        description: 'Self-destruct capability detected',
        impact: 'Contract can be permanently destroyed, causing total loss of funds',
        recommendation: 'Restrict selfdestruct to authorized users only',
        category: 'general',
      },
      {
        name: 'unchecked-send',
        pattern: /\.send\s*\([^)]*\)(?!\s*&&|;\s*require)/gi,
        severity: 'medium',
        confidence: 'medium',
        description: 'Unchecked send operation',
        impact: 'Failed sends are ignored, funds may be lost',
        recommendation: 'Always check return value of send operations',
        category: 'general',
      },
      {
        name: 'tx-origin',
        pattern: /tx\.origin/gi,
        severity: 'medium',
        confidence: 'high',
        description: 'Use of tx.origin for authorization',
        impact: 'Vulnerable to phishing attacks that bypass authorization',
        recommendation: 'Use msg.sender instead of tx.origin',
        category: 'general',
      },
      {
        name: 'block-timestamp',
        pattern: /block\.timestamp|now(?!\w)/gi,
        severity: 'low',
        confidence: 'medium',
        description: 'Block timestamp dependency',
        impact: 'Miners can manipulate timestamps within ~900 second window',
        recommendation: 'Avoid critical logic depending on exact timestamps',
        category: 'general',
      },
      {
        name: 'unprotected-withdraw',
        pattern: /function\s+withdraw(?:All)?\s*\([^)]*\)(?:[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*)?(?!.*(?:onlyOwner|require|modifier))/gi,
        severity: 'critical',
        confidence: 'low',
        description: 'Potentially unprotected withdraw function',
        impact: 'Anyone might be able to withdraw funds',
        recommendation: 'Add proper access controls to withdraw functions',
        category: 'general',
      },
      {
        name: 'unchecked-call',
        pattern: /\.call(?:\s*\{[^}]*\})?\s*\([^)]*\)\s*(?!&&|;\s*require)/gi,
        severity: 'medium',
        confidence: 'low',
        description: 'Unchecked call operation',
        impact: 'Failed calls are ignored',
        recommendation: 'Always check return value of call operations',
        category: 'general',
      },
      {
        name: 'arbitrary-send',
        pattern: /\.transfer\s*\(\s*[^,)]*,?\s*[^)]*\)|\.send\s*\(\s*[^,)]*,?\s*[^)]*\)/gi,
        severity: 'high',
        confidence: 'low',
        description: 'Ether transfer operation',
        impact: 'Review recipient and amount to ensure no arbitrary transfers',
        recommendation: 'Validate recipients and amounts in transfer operations',
        category: 'general',
      },
      {
        name: 'assembly-usage',
        pattern: /assembly\s*\{/gi,
        severity: 'informational',
        confidence: 'high',
        description: 'Inline assembly usage',
        impact: 'Assembly bypasses Solidity safety checks',
        recommendation: 'Carefully review assembly code for safety',
        category: 'general',
      }
    ];
  }

  /**
   * Analyze specifically for micro-protocol vulnerabilities
   * Returns findings sorted by severity
   */
  analyzeMicroProtocol(contractAddress: string, sourceCode: string, contractName?: string): Finding[] {
    this.setMicroProtocolMode(true);
    const findings = this.analyze(contractAddress, sourceCode, contractName);
    this.setMicroProtocolMode(false);

    // Sort by severity (critical first)
    const severityOrder: Record<Severity, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      informational: 1,
    };

    return findings.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }

  /**
   * Check for rug pull indicators
   */
  hasRugPullIndicators(sourceCode: string): { risk: 'high' | 'medium' | 'low'; indicators: string[] } {
    const indicators: string[] = [];

    // Owner mint capability
    if (/onlyOwner[^}]*_mint|owner[^}]*_mint/gi.test(sourceCode)) {
      indicators.push('Owner can mint unlimited tokens');
    }

    // No timelock on sensitive functions
    if (/function\s+(setFee|changeFee|updateReward)[^}]*onlyOwner(?![^}]*timelock)/gi.test(sourceCode)) {
      indicators.push('No timelock on sensitive admin functions');
    }

    // Blacklist capability
    if (/mapping[^)]*(?:blacklist|blocklist|banned|frozen)/gi.test(sourceCode)) {
      indicators.push('Has blacklist/freeze capability');
    }

    // Single-step ownership
    if (/function\s+transferOwnership[^}]*owner\s*=/gi.test(sourceCode)) {
      indicators.push('Single-step ownership transfer');
    }

    // Hidden selfdestruct
    if (/selfdestruct/gi.test(sourceCode)) {
      indicators.push('Has selfdestruct capability');
    }

    let risk: 'high' | 'medium' | 'low' = 'low';
    if (indicators.length >= 3) risk = 'high';
    else if (indicators.length >= 1) risk = 'medium';

    return { risk, indicators };
  }

  /**
   * Check if contract has high-value functions that warrant deeper analysis
   */
  hasHighValueFunctions(sourceCode: string): boolean {
    const highValuePatterns = [
      /function\s+withdraw/gi,
      /function\s+claim/gi,
      /function\s+redeem/gi,
      /function\s+mint/gi,
      /function\s+burn/gi,
      /function\s+approve/gi,
      /function\s+transfer(?:From)?/gi,
      /function\s+deposit/gi,
      /function\s+stake/gi,
      /function\s+unstake/gi,
      /\.transfer\s*\(/gi,
      /\.call(?:\s*\{[^}]*value:)/gi
    ];

    return highValuePatterns.some(pattern => pattern.test(sourceCode));
  }

  /**
   * Estimate complexity score (0-100)
   */
  getComplexityScore(sourceCode: string): number {
    let score = 0;
    
    // External calls add complexity
    const externalCalls = (sourceCode.match(/\.call(?:\s*\{[^}]*\})?\s*\(/gi) || []).length;
    score += externalCalls * 10;
    
    // Assembly adds complexity
    const assembly = (sourceCode.match(/assembly\s*\{/gi) || []).length;
    score += assembly * 15;
    
    // Delegatecalls add high complexity
    const delegateCalls = (sourceCode.match(/\.delegatecall/gi) || []).length;
    score += delegateCalls * 20;
    
    // Multiple inheritance increases complexity
    const inheritance = (sourceCode.match(/is\s+\w+(?:,\s*\w+)*/gi) || []).length;
    score += inheritance * 5;
    
    // Function count
    const functions = (sourceCode.match(/function\s+\w+/gi) || []).length;
    score += Math.min(functions * 2, 30);
    
    return Math.min(score, 100);
  }

  private getLineNumber(sourceCode: string, index: number): number {
    return sourceCode.substring(0, index).split('\\n').length;
  }

  private getCodeContext(sourceCode: string, index: number, contextLength: number = 100): string {
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(sourceCode.length, index + contextLength / 2);
    return sourceCode.substring(start, end).replace(/\\s+/g, ' ').trim();
  }
}

export const patternAnalyzer = new PatternAnalyzer();