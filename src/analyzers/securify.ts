/**
 * WHITE RABBIT - Securify2 Analyzer Integration
 * 
 * Formal verification scanner using Datalog analysis
 * GitHub: https://github.com/eth-sri/securify2
 * 
 * Key Capabilities:
 * - 37 vulnerability patterns with formal verification
 * - Context-sensitive static analysis (Datalog/Souffle)
 * - TOD (Transaction Order Dependence) detection
 * - Invariant checking for design-level flaws
 * - Supported by Ethereum Foundation & ChainSecurity
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Finding, Severity, Confidence } from '../types/index.js';
import { serviceLogger } from '../core/logger.js';

export type SecurifyPattern = 
  | 'TODAmount' | 'TODReceiver' | 'TODTransfer' | 'UnrestrictedWrite'
  | 'RightToLeftOverride' | 'ShadowedStateVariable' | 'UnrestrictedSelfdestruct'
  | 'UninitializedStateVariable' | 'UninitializedStorage' | 'UnrestrictedDelegateCall'
  | 'DAO' | 'ERC20Interface' | 'ERC721Interface' | 'IncorrectEquality'
  | 'LockedEther' | 'ReentrancyNoETH' | 'TxOrigin' | 'UnhandledException'
  | 'UnrestrictedEtherFlow' | 'UninitializedLocal' | 'UnusedReturn'
  | 'ShadowedBuiltin' | 'ShadowedLocalVariable' | 'CallToDefaultConstructor'
  | 'CallInLoop' | 'ReentrancyBenign' | 'Timestamp' | 'AssemblyUsage'
  | 'ERC20Indexed' | 'LowLevelCalls' | 'NamingConvention' | 'SolcVersion'
  | 'UnusedStateVariable' | 'TooManyDigits' | 'ConstableStates'
  | 'ExternalFunctions' | 'StateVariablesDefaultVisibility';

export interface SecurifyOptions {
  includePatterns?: SecurifyPattern[];
  excludePatterns?: SecurifyPattern[];
  includeSeverity?: ('Critical' | 'High' | 'Medium' | 'Low' | 'Info')[];
  excludeSeverity?: ('Critical' | 'High' | 'Medium' | 'Low' | 'Info')[];
  timeout?: number;
}

export interface SecurifyViolation {
  line: number;
  column: number;
  file: string;
  code: string;
  witness?: {
    violation_type: string;
    affected_variable?: string;
    dependence_type?: string;
  };
}

export interface SecurifyPatternResult {
  pattern: SecurifyPattern;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  swc_id?: string;
  description: string;
  violations: SecurifyViolation[];
}

export interface SecurifyOutput {
  success: boolean;
  error?: string;
  contract?: string;
  patterns: SecurifyPatternResult[];
}

/**
 * Securify2 Analyzer
 * 
 * Formal verification-based security scanner from ETH Zurich.
 * Best for: DeFi protocols, TOD detection, high-confidence findings
 */
export class SecurifyAnalyzer {
  private readonly DEFAULT_OPTIONS: SecurifyOptions = {
    includeSeverity: ['Critical', 'High', 'Medium'],
    timeout: 300, // 5 minutes
  };

  // Pattern descriptions for detailed reporting
  private readonly PATTERN_DESCRIPTIONS: Record<SecurifyPattern, string> = {
    TODAmount: 'Transaction Order Dependence - Amount can be manipulated by front-running',
    TODReceiver: 'Transaction Order Dependence - Receiver can be manipulated by front-running',
    TODTransfer: 'Transaction Order Dependence - Transfer can be manipulated by front-running',
    UnrestrictedWrite: 'Unprotected storage write - Anyone can modify critical state',
    RightToLeftOverride: 'Right-to-left override character detected (Unicode attack)',
    ShadowedStateVariable: 'State variable is shadowed by local variable',
    UnrestrictedSelfdestruct: 'Anyone can destroy the contract (Parity-style bug)',
    UninitializedStateVariable: 'State variable used before initialization',
    UninitializedStorage: 'Storage variable used before initialization',
    UnrestrictedDelegateCall: 'Unrestricted delegatecall (proxy pattern vulnerability)',
    DAO: 'Reentrancy vulnerability (DAO-style attack)',
    ERC20Interface: 'ERC20 interface violation',
    ERC721Interface: 'ERC721 interface violation',
    IncorrectEquality: 'Incorrect equality check (strict vs loose)',
    LockedEther: 'Ether is locked and cannot be withdrawn',
    ReentrancyNoETH: 'Reentrancy without ETH transfer (state manipulation)',
    TxOrigin: 'Use of tx.origin for authorization (phishing vulnerability)',
    UnhandledException: 'Exception from external call not handled',
    UnrestrictedEtherFlow: 'Unrestricted Ether flow to arbitrary addresses',
    UninitializedLocal: 'Local variable used before initialization',
    UnusedReturn: 'Return value from external call ignored',
    ShadowedBuiltin: 'Built-in symbol is shadowed',
    ShadowedLocalVariable: 'Local variable is shadowed',
    CallToDefaultConstructor: 'Call to default constructor may be unintended',
    CallInLoop: 'External call inside loop (gas/DoS risk)',
    ReentrancyBenign: 'Benign reentrancy pattern detected',
    Timestamp: 'Block timestamp dependence (miner manipulable)',
    AssemblyUsage: 'Assembly code usage (review required)',
    ERC20Indexed: 'ERC20 event without indexed parameters',
    LowLevelCalls: 'Low-level call usage (review required)',
    NamingConvention: 'Naming convention violation',
    SolcVersion: 'Solidity version pragma issue',
    UnusedStateVariable: 'State variable declared but not used',
    TooManyDigits: 'Number with too many digits (precision loss)',
    ConstableStates: 'State variable could be declared constant',
    ExternalFunctions: 'Public function could be external',
    StateVariablesDefaultVisibility: 'State variable has default visibility',
  };

  /**
   * Analyze contract with Securify2
   * 
   * NOTE: Securify2 requires flattened contracts (no imports)
   */
  async analyze(
    contractAddress: string,
    sourceCode: string,
    contractName?: string,
    options: SecurifyOptions = {},
  ): Promise<Finding[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    serviceLogger.info('Starting Securify2 analysis', {
      address: contractAddress,
      includeSeverity: opts.includeSeverity,
    });

    // Check if Securify2 is installed
    if (!this.isSecurifyInstalled()) {
      serviceLogger.error('Securify2 not found. Please install: https://github.com/eth-sri/securify2');
      return [];
    }

    // Flatten contract (Securify2 requires no imports)
    const flattenedSource = await this.flattenContract(sourceCode, contractName);
    
    // Write to temp file
    const tempFile = await this.writeContractToFile(contractAddress, flattenedSource);

    try {
      const output = await this.runSecurify(tempFile, opts);

      if (!output.success) {
        serviceLogger.warn('Securify2 analysis failed', {
          address: contractAddress,
          error: output.error,
        });
        return [];
      }

      serviceLogger.info('Securify2 analysis complete', {
        address: contractAddress,
        patternsFound: output.patterns?.length || 0,
      });

      return this.parseFindings(output.patterns || [], contractAddress);
    } finally {
      this.cleanupFile(tempFile);
    }
  }

  /**
   * Analyze contract from blockchain (Etherscan)
   */
  async analyzeFromBlockchain(
    contractAddress: string,
    etherscanApiKey: string,
    options: SecurifyOptions = {},
  ): Promise<Finding[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    serviceLogger.info('Starting Securify2 analysis from blockchain', {
      address: contractAddress,
    });

    if (!this.isSecurifyInstalled()) {
      serviceLogger.error('Securify2 not found');
      return [];
    }

    const output = await this.runSecurifyOnAddress(contractAddress, etherscanApiKey, opts);

    if (!output.success) {
      serviceLogger.warn('Securify2 blockchain analysis failed', {
        address: contractAddress,
        error: output.error,
      });
      return [];
    }

    return this.parseFindings(output.patterns || [], contractAddress);
  }

  /**
   * Check if Securify2 is installed
   */
  private isSecurifyInstalled(): boolean {
    try {
      execSync('which securify', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Flatten contract to remove imports
   * This is a simplified version - production would need proper flattening
   */
  private async flattenContract(sourceCode: string, contractName?: string): Promise<string> {
    // For now, just return source code
    // In production, use solc flattening or truffle-flattener
    
    // Remove import statements (Securify2 doesn't handle them)
    const flattened = sourceCode.replace(/import\s+["'][^"']+["'];?\s*\n?/g, '');
    
    return flattened;
  }

  /**
   * Run Securify2 on source file
   */
  private runSecurify(
    contractPath: string,
    options: SecurifyOptions,
  ): Promise<SecurifyOutput> {
    return new Promise((resolve) => {
      const args: string[] = [contractPath];

      // Add severity filters
      if (options.includeSeverity && options.includeSeverity.length > 0) {
        args.push('--include-severity', ...options.includeSeverity);
      }
      if (options.excludeSeverity && options.excludeSeverity.length > 0) {
        args.push('--exclude-severity', ...options.excludeSeverity);
      }

      // Add pattern filters
      if (options.includePatterns && options.includePatterns.length > 0) {
        args.push('--use-patterns', ...options.includePatterns);
      }

      serviceLogger.debug('Running Securify2 command', { args: args.join(' ') });

      const proc = spawn('securify', args, {
        timeout: (options.timeout || 300) * 1000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          LD_LIBRARY_PATH: `${process.env.LD_LIBRARY_PATH || ''}:${process.env.SECURIFY_PATH || ''}/securify/staticanalysis/libfunctors`,
        },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        try {
          // Securify2 outputs JSON to stdout
          const parsed = JSON.parse(stdout);
          resolve({
            success: true,
            contract: parsed.contract,
            patterns: parsed.patterns || [],
          });
        } catch (err) {
          resolve({
            success: false,
            error: stderr || `Securify2 exited with code ${code}: ${err}`,
            patterns: [],
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to spawn Securify2: ${err.message}`,
          patterns: [],
        });
      });
    });
  }

  /**
   * Run Securify2 on contract address
   */
  private runSecurifyOnAddress(
    contractAddress: string,
    etherscanApiKey: string,
    options: SecurifyOptions,
  ): Promise<SecurifyOutput> {
    return new Promise((resolve) => {
      const args: string[] = [
        contractAddress,
        '--from-blockchain',
        '--key', etherscanApiKey,
      ];

      if (options.includeSeverity && options.includeSeverity.length > 0) {
        args.push('--include-severity', ...options.includeSeverity);
      }

      const proc = spawn('securify', args, {
        timeout: (options.timeout || 300) * 1000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          LD_LIBRARY_PATH: `${process.env.LD_LIBRARY_PATH || ''}:${process.env.SECURIFY_PATH || ''}/securify/staticanalysis/libfunctors`,
        },
      });

      let stdout = '';
      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.on('close', () => {
        try {
          const parsed = JSON.parse(stdout);
          resolve({
            success: true,
            contract: parsed.contract,
            patterns: parsed.patterns || [],
          });
        } catch (err) {
          resolve({
            success: false,
            error: `Failed to parse output: ${err}`,
            patterns: [],
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to spawn: ${err.message}`,
          patterns: [],
        });
      });
    });
  }

  /**
   * Parse Securify2 patterns into White Rabbit Finding format
   */
  private parseFindings(patterns: SecurifyPatternResult[], contractAddress: string): Finding[] {
    const findings: Finding[] = [];

    for (const pattern of patterns) {
      for (const violation of pattern.violations) {
        findings.push({
          id: '',
          scanId: '',
          contractId: '',
          detectorName: `securify-${pattern.pattern}`,
          tool: 'securify',
          severity: this.mapSeverity(pattern.severity),
          confidence: 'high', // Formal verification confidence
          title: `${pattern.pattern} detected`,
          description: this.buildDescription(pattern, violation),
          codeSnippet: violation.code,
          filePath: violation.file,
          lineStart: violation.line,
          lineEnd: violation.line,
          aiAssessment: null,
          aiIsFalsePositive: null,
          deduplicatedGroupId: null,
          // Securify-specific metadata
          metadata: {
            pattern: pattern.pattern,
            swcId: pattern.swc_id,
            witness: violation.witness,
            column: violation.column,
          },
        });
      }
    }

    return findings;
  }

  /**
   * Build detailed description
   */
  private buildDescription(pattern: SecurifyPatternResult, violation: SecurifyViolation): string {
    let desc = this.PATTERN_DESCRIPTIONS[pattern.pattern] || pattern.description;
    
    if (violation.witness) {
      desc += `\n\nWitness:\n`;
      desc += `  Type: ${violation.witness.violation_type}\n`;
      if (violation.witness.affected_variable) {
        desc += `  Affected Variable: ${violation.witness.affected_variable}\n`;
      }
      if (violation.witness.dependence_type) {
        desc += `  Dependence: ${violation.witness.dependence_type}\n`;
      }
    }

    return desc;
  }

  /**
   * Map Securify severity to White Rabbit severity
   */
  private mapSeverity(severity: string): Severity {
    const map: Record<string, Severity> = {
      'Critical': 'critical',
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
      'Info': 'informational',
    };
    return map[severity] || 'informational';
  }

  /**
   * Write contract to temp file
   */
  private async writeContractToFile(address: string, sourceCode: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), 'securify-analysis');
    fs.mkdirSync(tempDir, { recursive: true });

    const fileName = `contract-${address.slice(2, 10)}.sol`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, sourceCode, 'utf8');
    return filePath;
  }

  /**
   * Cleanup temp file
   */
  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Best effort
    }
  }
}

export default SecurifyAnalyzer;
