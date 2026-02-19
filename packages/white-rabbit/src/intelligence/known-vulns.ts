// ═══════════════════════════════════════════════════════════════════════════════
// Known Vulnerabilities Database
// Check findings against known vulnerability patterns to avoid duplicates
// ═══════════════════════════════════════════════════════════════════════════════

import { Finding } from '../types.js';

export interface KnownVulnerability {
  id: string;
  title: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedProtocols: string[];
  affectedVersions?: string[];
  indicators: VulnIndicator[];
  cwe?: string;
  references: string[];
  firstSeen: string;
  lastSeen: string;
  occurrenceCount: number;
}

export interface VulnIndicator {
  type: 'code-pattern' | 'function-signature' | 'event-signature' | 'contract-name' | 'detector-match';
  pattern: string | RegExp;
  confidence: number; // 0-1
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number;
  matchedVuln?: KnownVulnerability;
  reason: string;
}

/**
 * Database of known vulnerabilities with pattern matching
 */
export class KnownVulnDatabase {
  private vulnerabilities: Map<string, KnownVulnerability> = new Map();
  private patternIndex: Map<string, string[]> = new Map(); // pattern -> vuln IDs

  constructor() {
    this.loadBuiltinVulnerabilities();
  }

  /**
   * Check if a finding matches a known vulnerability
   */
  checkDuplicate(finding: Finding, protocol?: string): DuplicateCheckResult {
    const matches: Array<{ vuln: KnownVulnerability; score: number }> = [];

    for (const vuln of this.vulnerabilities.values()) {
      let score = 0;
      let matchedIndicators = 0;

      // Check protocol match
      if (protocol && vuln.affectedProtocols.includes(protocol)) {
        score += 0.3;
      }

      // Check detector match
      if (finding.detectorName.toLowerCase().includes(vuln.type.toLowerCase())) {
        score += 0.3;
        matchedIndicators++;
      }

      // Check code patterns
      if (finding.codeSnippet) {
        for (const indicator of vuln.indicators) {
          if (indicator.type === 'code-pattern') {
            const pattern = typeof indicator.pattern === 'string' 
              ? new RegExp(indicator.pattern, 'i')
              : indicator.pattern;
            
            if (pattern.test(finding.codeSnippet)) {
              score += indicator.confidence * 0.4;
              matchedIndicators++;
            }
          }
        }
      }

      // Check file path patterns
      if (finding.filePath) {
        for (const indicator of vuln.indicators) {
          if (indicator.type === 'contract-name') {
            if (finding.filePath.toLowerCase().includes(indicator.pattern as string)) {
              score += indicator.confidence * 0.2;
              matchedIndicators++;
            }
          }
        }
      }

      if (matchedIndicators > 0 && score > 0.5) {
        matches.push({ vuln, score });
      }
    }

    // Sort by score
    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 0 && matches[0].score > 0.7) {
      return {
        isDuplicate: true,
        confidence: matches[0].score,
        matchedVuln: matches[0].vuln,
        reason: `Matches known vulnerability: ${matches[0].vuln.title}`,
      };
    }

    if (matches.length > 0) {
      return {
        isDuplicate: false,
        confidence: matches[0].score,
        matchedVuln: matches[0].vuln,
        reason: `Similar to known vulnerability but may be distinct`,
      };
    }

    return {
      isDuplicate: false,
      confidence: 0,
      reason: 'No matching known vulnerabilities found',
    };
  }

  /**
   * Get known vulnerabilities by type
   */
  getByType(type: string): KnownVulnerability[] {
    return Array.from(this.vulnerabilities.values())
      .filter(v => v.type.toLowerCase() === type.toLowerCase());
  }

  /**
   * Get known vulnerabilities affecting a protocol
   */
  getByProtocol(protocol: string): KnownVulnerability[] {
    return Array.from(this.vulnerabilities.values())
      .filter(v => v.affectedProtocols.includes(protocol));
  }

  /**
   * Add a new known vulnerability
   */
  addVulnerability(vuln: KnownVulnerability): void {
    this.vulnerabilities.set(vuln.id, vuln);
    this.indexPatterns(vuln);
  }

  /**
   * Get vulnerability by ID
   */
  getById(id: string): KnownVulnerability | undefined {
    return this.vulnerabilities.get(id);
  }

  /**
   * Get all vulnerabilities
   */
  getAll(): KnownVulnerability[] {
    return Array.from(this.vulnerabilities.values());
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    
    for (const vuln of this.vulnerabilities.values()) {
      byType[vuln.type] = (byType[vuln.type] || 0) + 1;
    }

    return {
      total: this.vulnerabilities.size,
      byType,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════════════════════════

  private indexPatterns(vuln: KnownVulnerability): void {
    for (const indicator of vuln.indicators) {
      const key = `${indicator.type}:${indicator.pattern}`;
      const ids = this.patternIndex.get(key) || [];
      ids.push(vuln.id);
      this.patternIndex.set(key, ids);
    }
  }

  private loadBuiltinVulnerabilities(): void {
    // Reentrancy - The DAO
    this.addVulnerability({
      id: 'REENTRANCY-DAO-2016',
      title: 'Reentrancy in Withdraw Function',
      type: 'reentrancy',
      severity: 'critical',
      description: 'External call before state update allows recursive reentrancy',
      affectedProtocols: ['the-dao'],
      indicators: [
        { type: 'code-pattern', pattern: /\.call\{value:.*\}\s*\([^)]*\)\s*;?\s*(?!.*balances\[|.*_balances)/i, confidence: 0.9 },
        { type: 'function-signature', pattern: 'withdraw()', confidence: 0.7 },
      ],
      cwe: 'CWE-841',
      references: ['https://hackingdistributed.com/2016/06/18/analysis-of-the-dao-exploit/'],
      firstSeen: '2016-06-17',
      lastSeen: '2024-12-01',
      occurrenceCount: 1500,
    });

    // Price Oracle Manipulation - Compound
    this.addVulnerability({
      id: 'ORACLE-MANIPULATION-2020',
      title: 'Price Oracle Manipulation',
      type: 'oracle-manipulation',
      severity: 'critical',
      description: 'Protocol uses manipulable price source (e.g., spot price from DEX)',
      affectedProtocols: ['compound', 'aave-v1', 'cream-finance', 'iron-bank'],
      indicators: [
        { type: 'code-pattern', pattern: /getReserves\(\)|token0\(\)|token1\(\)/i, confidence: 0.8 },
        { type: 'code-pattern', pattern: /price.*cumulative|TWAP|time.*weighted/i, confidence: 0.7 },
        { type: 'detector-match', pattern: 'oracle', confidence: 0.9 },
      ],
      cwe: 'CWE-20',
      references: ['https://rekt.news/alpha-homora-v2/'],
      firstSeen: '2020-02-15',
      lastSeen: '2024-12-15',
      occurrenceCount: 89,
    });

    // Access Control - Missing Authorization
    this.addVulnerability({
      id: 'ACCESS-CONTROL-MISSING-2021',
      title: 'Missing Access Control',
      type: 'access-control',
      severity: 'critical',
      description: 'Critical function lacks proper access control',
      affectedProtocols: ['poly-network', 'nomad', 'wormhole'],
      indicators: [
        { type: 'code-pattern', pattern: /function\s+(mint|burn|transferOwnership|upgrade|setMinter)\s*\([^)]*\)\s*public/i, confidence: 0.8 },
        { type: 'code-pattern', pattern: /onlyOwner|require.*msg\.sender|_checkRole/i, confidence: -0.5 }, // Negative indicator
      ],
      cwe: 'CWE-284',
      references: ['https://rekt.news/nomad-rekt/'],
      firstSeen: '2021-08-10',
      lastSeen: '2024-11-20',
      occurrenceCount: 245,
    });

    // Flash Loan Attack Pattern
    this.addVulnerability({
      id: 'FLASH-LOAN-ATTACK-2020',
      title: 'Flash Loan Attack Vector',
      type: 'flash-loan',
      severity: 'high',
      description: 'Protocol logic vulnerable to flash loan manipulation',
      affectedProtocols: ['bzx', 'cream-finance', 'euler-finance'],
      indicators: [
        { type: 'code-pattern', pattern: /balanceOf\(address\(this\)\)|getBalance|totalSupply/i, confidence: 0.7 },
        { type: 'code-pattern', pattern: /flashLoan|flash|borrow.*no.*collateral/i, confidence: 0.9 },
      ],
      references: ['https://rekt.news/flash-loans-attack/'],
      firstSeen: '2020-02-14',
      lastSeen: '2024-12-10',
      occurrenceCount: 67,
    });

    // Integer Overflow/Underflow (pre-0.8.0)
    this.addVulnerability({
      id: 'INTEGER-OVERFLOW-2018',
      title: 'Integer Overflow/Underflow',
      type: 'integer-overflow',
      severity: 'high',
      description: 'Arithmetic operations without overflow checks',
      affectedProtocols: ['batchoverflow', 'beautychain'],
      indicators: [
        { type: 'code-pattern', pattern: /pragma solidity [\^<]?0\.[567]/, confidence: 0.8 },
        { type: 'code-pattern', pattern: /SafeMath|using SafeMath/, confidence: -0.7 }, // Negative indicator
        { type: 'code-pattern', pattern: /\+\s*=|-\s*=|\*\s*=|\+\+|--/, confidence: 0.5 },
      ],
      cwe: 'CWE-190',
      references: ['https://peckshield.com/2018/04/22/batchOverflow/'],
      firstSeen: '2018-04-22',
      lastSeen: '2023-06-15',
      occurrenceCount: 312,
    });

    // tx.origin Authorization
    this.addVulnerability({
      id: 'TX-ORIGIN-AUTH-2017',
      title: 'tx.origin Authorization',
      type: 'access-control',
      severity: 'high',
      description: 'Using tx.origin for authorization is vulnerable to phishing',
      affectedProtocols: ['unknown'],
      indicators: [
        { type: 'code-pattern', pattern: /tx\.origin\s*==|require\s*\(\s*tx\.origin/i, confidence: 0.95 },
      ],
      cwe: 'CWE-287',
      references: ['https://consensys.github.io/smart-contract-best-practices/development-recommendations/solidity-specific/tx-origin/'],
      firstSeen: '2017-01-01',
      lastSeen: '2024-12-20',
      occurrenceCount: 156,
    });

    // Unchecked External Call
    this.addVulnerability({
      id: 'UNCHECKED-CALL-2019',
      title: 'Unchecked External Call Return Value',
      type: 'error-handling',
      severity: 'medium',
      description: 'Return value of external call not checked',
      affectedProtocols: [],
      indicators: [
        { type: 'code-pattern', pattern: /\.call\{value:.*\}\s*\([^)]*\)\s*;/, confidence: 0.8 },
        { type: 'code-pattern', pattern: /\.send\s*\(|\.transfer\s*\(/, confidence: 0.6 },
      ],
      cwe: 'CWE-252',
      references: [],
      firstSeen: '2019-01-01',
      lastSeen: '2024-12-18',
      occurrenceCount: 423,
    });

    // Delegatecall Injection
    this.addVulnerability({
      id: 'DELEGATECALL-INJECTION-2017',
      title: 'Delegatecall Injection',
      type: 'delegatecall',
      severity: 'critical',
      description: 'Unprotected delegatecall allows arbitrary code execution',
      affectedProtocols: ['parity-multisig'],
      indicators: [
        { type: 'code-pattern', pattern: /delegatecall\s*\(/, confidence: 0.7 },
        { type: 'code-pattern', pattern: /assembly\s*{\s*calldatacopy|delegatecall\s*\(/, confidence: 0.9 },
      ],
      cwe: 'CWE-94',
      references: ['https://paritytech.io/blog/security-alert/'],
      firstSeen: '2017-07-19',
      lastSeen: '2024-10-05',
      occurrenceCount: 34,
    });

    // Timestamp Dependence
    this.addVulnerability({
      id: 'TIMESTAMP-DEPENDENCE-2018',
      title: 'Block Timestamp Dependence',
      type: 'weak-randomness',
      severity: 'low',
      description: 'Using block.timestamp for critical logic (miner manipulable)',
      affectedProtocols: [],
      indicators: [
        { type: 'code-pattern', pattern: /block\.timestamp|now\s*\)|block\.number/, confidence: 0.7 },
        { type: 'code-pattern', pattern: /random|lottery|winner/, confidence: 0.5 },
      ],
      cwe: 'CWE-338',
      references: [],
      firstSeen: '2018-01-01',
      lastSeen: '2024-11-30',
      occurrenceCount: 567,
    });

    // Selfdestruct
    this.addVulnerability({
      id: 'SELFDESTRUCT-2022',
      title: 'Unprotected Selfdestruct',
      type: 'access-control',
      severity: 'high',
      description: 'Contract can be destroyed by unauthorized party',
      affectedProtocols: [],
      indicators: [
        { type: 'code-pattern', pattern: /selfdestruct\s*\(|suicide\s*\(/, confidence: 0.9 },
        { type: 'code-pattern', pattern: /onlyOwner|onlyAdmin|require.*owner/i, confidence: -0.5 },
      ],
      cwe: 'CWE-284',
      references: [],
      firstSeen: '2022-01-01',
      lastSeen: '2024-12-15',
      occurrenceCount: 89,
    });
  }
}

export default KnownVulnDatabase;
