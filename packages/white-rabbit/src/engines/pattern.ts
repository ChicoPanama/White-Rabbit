// ═══════════════════════════════════════════════════════════════════════════════
// PatternEngine - Pattern-based vulnerability detection
// Loads patterns from JSON files via PatternRegistry with fallback
// ═══════════════════════════════════════════════════════════════════════════════

import { Contract, Finding, AnalysisEngine, EngineOptions, EngineResult, Severity, Confidence } from '../types.js';
import { PatternRegistryLoader, VulnerabilityPattern, PatternDetector } from './pattern-registry-compat.js';
import { ulid } from 'ulid';

export class PatternEngine implements AnalysisEngine {
  name = 'pattern';
  version = '2.0.0';
  private registry: PatternRegistryLoader;
  private useFallback = false;
  private fallbackPatterns: VulnerabilityPattern[] = [];

  constructor(registry?: PatternRegistryLoader) {
    this.registry = registry || new PatternRegistryLoader();
    
    // Check if registry loaded successfully
    const info = this.registry.getRegistryInfo();
    if (!info) {
      this.useFallback = true;
      this.fallbackPatterns = this.getFallbackPatterns();
    }
  }

  async isAvailable(): Promise<boolean> {
    // Always available - pure JavaScript analysis
    return true;
  }

  async analyze(
    contract: Contract,
    options: EngineOptions = {}
  ): Promise<EngineResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    try {
      // Load patterns from registry or fallback
      const rawPatterns = this.useFallback ? this.fallbackPatterns : this.registry.loadAll();
      const patterns = this.prioritizeByIntel(rawPatterns, options.intelContext);
      
      for (const pattern of patterns) {
        for (const detector of pattern.detectors) {
          const matches = this.findMatches(contract.sourceCode, detector);
          
          for (const match of matches) {
            // Check if safe pattern exists nearby
            if (detector.safePatterns && this.hasSafePattern(contract.sourceCode, match.line, detector.safePatterns)) {
              continue;
            }

            findings.push({
              id: ulid(),
              scanId: '',
              contractId: '',
              detectorName: detector.id,
              tool: 'pattern',
              severity: pattern.severity,
              confidence: pattern.confidence || 'medium',
              title: detector.name,
              description: detector.description,
              codeSnippet: match.code,
              filePath: null,
              lineStart: match.line,
              lineEnd: match.line,
              aiAssessment: null,
              aiIsFalsePositive: null,
              deduplicatedGroupId: null,
            });
          }
        }
      }

      return {
        success: true,
        findings,
        errors: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        findings: [],
        errors: [error instanceof Error ? error.message : String(error)],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get available pattern categories
   */
  getCategories(): string[] {
    return this.useFallback ? ['reentrancy', 'access-control'] : this.registry.getCategories();
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(category: string) {
    if (this.useFallback) {
      return this.fallbackPatterns.filter(p => p.id === category || p.id.includes(category));
    }
    return this.registry.getByCategory(category);
  }

  /**
   * Get patterns by severity
   */
  getPatternsBySeverity(severity: string) {
    if (this.useFallback) {
      return this.fallbackPatterns.filter(p => p.severity === severity);
    }
    return this.registry.getBySeverity(severity);
  }

  /**
   * Search patterns
   */
  searchPatterns(query: string) {
    if (this.useFallback) {
      const lower = query.toLowerCase();
      return this.fallbackPatterns.filter(p =>
        p.id.toLowerCase().includes(lower) ||
        p.name.toLowerCase().includes(lower)
      );
    }
    return this.registry.search(query);
  }

  /**
   * Get pattern count
   */
  getPatternCount(): number {
    if (this.useFallback) {
      return this.fallbackPatterns.length;
    }
    return this.registry.getPatternIds().length;
  }

  /**
   * Reorder patterns so that those matching WhiteClaws-provided intel are checked first.
   */
  private prioritizeByIntel(
    patterns: VulnerabilityPattern[],
    intelContext?: EngineOptions['intelContext']
  ): VulnerabilityPattern[] {
    if (!intelContext?.evmbenchPatternMatches?.length) return patterns;

    const scoreByPatternId = new Map<string, number>();

    for (const match of intelContext.evmbenchPatternMatches) {
      const hint = `${match.patternId} ${match.category}`.toLowerCase();
      for (const pattern of patterns) {
        const patternKey = `${pattern.id} ${pattern.name}`.toLowerCase();
        if (hint.includes(pattern.id.toLowerCase()) || patternKey.includes(match.category.toLowerCase())) {
          const current = scoreByPatternId.get(pattern.id) || 0;
          scoreByPatternId.set(pattern.id, Math.max(current, Number(match.relevanceScore || 0)));
        }
      }
    }

    return [...patterns].sort((a, b) => {
      const scoreA = scoreByPatternId.get(a.id) || 0;
      const scoreB = scoreByPatternId.get(b.id) || 0;
      return scoreB - scoreA;
    });
  }

  /**
   * Get fallback patterns (built-in)
   */
  private getFallbackPatterns(): VulnerabilityPattern[] {
    return [
      {
        id: 'reentrancy',
        name: 'Reentrancy Vulnerability',
        version: '1.0.0',
        description: 'Detects external calls before state changes',
        cwe: 'CWE-841',
        severity: 'high',
        confidence: 'medium',
        detectors: [
          {
            id: 'external-call-before-state-change',
            name: 'External Call Before State Change',
            description: 'External call made before state variable is updated, vulnerable to reentrancy',
            pattern: '(call|callcode|delegatecall|send|transfer)\\s*\\{[^}]*\\}\\s*\\([^)]*\\)',
            flags: 'i',
            safePatterns: ['nonReentrant', 'ReentrancyGuard', 'lock'],
          },
        ],
        remediation: 'Update state before external calls or use ReentrancyGuard',
        references: [
          'https://swcregistry.io/docs/SWC-107',
          'https://docs.openzeppelin.com/contracts/4.x/api/security#ReentrancyGuard',
        ],
      },
      {
        id: 'tx-origin',
        name: 'tx.origin Authentication',
        version: '1.0.0',
        description: 'Using tx.origin for authentication is vulnerable to phishing',
        cwe: 'CWE-287',
        severity: 'high',
        confidence: 'high',
        detectors: [
          {
            id: 'tx-origin-usage',
            name: 'tx.origin Used for Authentication',
            description: 'tx.origin is used for authentication, vulnerable to phishing attacks',
            pattern: 'tx\\.origin',
            flags: 'i',
            safePatterns: ['tx.origin == address(this)'],
          },
        ],
        remediation: 'Use msg.sender instead of tx.origin for authentication',
        references: ['https://swcregistry.io/docs/SWC-115'],
      },
      {
        id: 'unchecked-call',
        name: 'Unchecked External Call',
        version: '1.0.0',
        description: 'External call return value not checked',
        cwe: 'CWE-252',
        severity: 'medium',
        confidence: 'high',
        detectors: [
          {
            id: 'unchecked-low-level-call',
            name: 'Unchecked Low-Level Call',
            description: 'Return value of low-level call not checked',
            pattern: '(call|delegatecall|staticcall|callcode)\\s*\\{[^}]*\\}\\s*\\([^)]*\\)\\s*[^(;]',
            flags: 'i',
          },
        ],
        remediation: 'Check return value of external calls or use SafeERC20',
        references: ['https://swcregistry.io/docs/SWC-104'],
      },
      {
        id: 'selfdestruct',
        name: 'Selfdestruct Usage',
        version: '1.0.0',
        description: 'Contract can be destroyed by unauthorized users',
        cwe: 'CWE-284',
        severity: 'high',
        confidence: 'medium',
        detectors: [
          {
            id: 'selfdestruct-call',
            name: 'Selfdestruct or Suicide',
            description: 'Contract can be destroyed, removing code and storage',
            pattern: '\\b(selfdestruct|suicide)\\s*\\(',
            flags: 'i',
          },
        ],
        remediation: 'Restrict selfdestruct to authorized roles only',
        references: ['https://swcregistry.io/docs/SWC-106'],
      },
      {
        id: 'unrestricted-access',
        name: 'Unrestricted Function Access',
        version: '1.0.0',
        description: 'Function has no access control',
        cwe: 'CWE-284',
        severity: 'medium',
        confidence: 'low',
        detectors: [
          {
            id: 'no-access-control',
            name: 'No Access Control',
            description: 'Public function that modifies state may lack access control',
            pattern: 'function\\s+\\w+\\s*\\([^)]*\\)\\s*(public|external)\\s*\\{',
            flags: 'i',
            safePatterns: ['onlyOwner', 'onlyRole', 'require', 'AccessControl', 'Ownable'],
          },
        ],
        remediation: 'Implement proper access control with modifiers',
        references: ['https://swcregistry.io/docs/SWC-105'],
      },
    ];
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════════════════════════

  private findMatches(
    source: string,
    detector: PatternDetector
  ): Array<{ line: number; code: string }> {
    const matches: Array<{ line: number; code: string }> = [];
    const lines = source.split('\n');
    
    let regex: RegExp;
    try {
      const flags = detector.flags || 'i';
      regex = new RegExp(detector.pattern, flags);
    } catch {
      return matches;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (regex.test(line)) {
        matches.push({
          line: i + 1,
          code: line.trim(),
        });
      }
    }

    return matches;
  }

  private hasSafePattern(source: string, lineNumber: number, safePatterns: string[]): boolean {
    // Check context around the line for safe patterns
    const lines = source.split('\n');
    const contextSize = 15;
    const start = Math.max(0, lineNumber - contextSize - 1);
    const end = Math.min(lines.length, lineNumber + contextSize);
    const context = lines.slice(start, end).join('\n');

    return safePatterns.some(p => {
      try {
        return new RegExp(p, 'i').test(context);
      } catch {
        return context.toLowerCase().includes(p.toLowerCase());
      }
    });
  }
}

export default PatternEngine;
