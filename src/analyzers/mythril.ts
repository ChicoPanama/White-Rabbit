/**
 * WHITE RABBIT - Mythril Analyzer Integration
 * 
 * Symbolic execution engine for EVM bytecode
 * GitHub: https://github.com/ConsenSys/mythril
 * 
 * Key Capabilities:
 * - Symbolic execution for complex vulnerability detection
 * - Transaction sequence generation for exploit reproduction
 * - Works with both source code and bytecode
 * - Low false positive rate through path exploration
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Finding, Severity, Confidence } from '../types/index.js';
import { serviceLogger } from '../core/logger.js';

export interface MythrilOptions {
  maxTransactions?: number;      // -t: Max transaction depth (default: 3)
  executionTimeout?: number;     // --execution-timeout: Seconds (default: 600)
  solverTimeout?: number;        // --solver-timeout: SMT solver timeout
  callDepth?: number;            // --call-depth: Max call depth
  strategy?: 'dfs' | 'bfs' | 'naive-random' | 'weighted-random'; // Exploration strategy
  useIntegerModule?: boolean;    // --use-integer-module: For arithmetic bugs
}

export interface MythrilIssue {
  title: string;
  'swc-id': string;
  severity: 'High' | 'Medium' | 'Low' | 'Informational';
  description: string;
  function?: string;
  address?: number;
  'estimated-gas-usage'?: string;
  'transaction-sequence'?: MythrilTransaction[];
}

export interface MythrilTransaction {
  'contract-address'?: string;
  caller: string;
  'calldata'?: string;
  'decoded-input'?: string;
  value: string;
  function?: string;
  'input-data'?: string;
}

export interface MythrilOutput {
  success: boolean;
  error?: string;
  issues: MythrilIssue[];
}

/**
 * Mythril Analyzer
 * 
 * Integrates ConsenSys Mythril for symbolic execution-based analysis.
 * Best for: High-value contracts, complex reentrancies, arithmetic bugs
 */
export class MythrilAnalyzer {
  private readonly DEFAULT_OPTIONS: MythrilOptions = {
    maxTransactions: 3,
    executionTimeout: 600,
    solverTimeout: 60,
    callDepth: 5,
    strategy: 'bfs',
    useIntegerModule: true,
  };

  /**
   * Analyze contract with Mythril
   * 
   * @param contractAddress - Contract address
   * @param chainId - Chain ID
   * @param sourceCode - Solidity source code
   * @param compilerVersion - Solc version
   * @param options - Analysis options
   */
  async analyze(
    contractAddress: string,
    chainId: number,
    sourceCode: string,
    compilerVersion: string,
    options: MythrilOptions = {},
  ): Promise<Finding[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    serviceLogger.info('Starting Mythril analysis', {
      address: contractAddress,
      chainId,
      maxTransactions: opts.maxTransactions,
      executionTimeout: opts.executionTimeout,
    });

    // Write contract to temp file
    const tempFile = await this.writeContractToFile(contractAddress, sourceCode);

    try {
      // Run Mythril analysis
      const output = await this.runMythril(tempFile, compilerVersion, opts);

      if (!output.success) {
        serviceLogger.warn('Mythril analysis failed', {
          address: contractAddress,
          error: output.error,
        });
        return [];
      }

      serviceLogger.info('Mythril analysis complete', {
        address: contractAddress,
        issuesFound: output.issues?.length || 0,
      });

      // Parse findings into White Rabbit format
      return this.parseFindings(output.issues || [], contractAddress);
    } finally {
      // Cleanup
      this.cleanupFile(tempFile);
    }
  }

  /**
   * Analyze contract by address (using RPC)
   * 
   * @param contractAddress - Contract address
   * @param rpcUrl - Ethereum RPC URL
   * @param options - Analysis options
   */
  async analyzeByAddress(
    contractAddress: string,
    rpcUrl: string,
    options: MythrilOptions = {},
  ): Promise<Finding[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    serviceLogger.info('Starting Mythril analysis by address', {
      address: contractAddress,
      rpcUrl,
    });

    const output = await this.runMythrilOnAddress(contractAddress, rpcUrl, opts);

    if (!output.success) {
      serviceLogger.warn('Mythril address analysis failed', {
        address: contractAddress,
        error: output.error,
      });
      return [];
    }

    return this.parseFindings(output.issues || [], contractAddress);
  }

  /**
   * Run Mythril on source file
   */
  private runMythril(
    contractPath: string,
    compilerVersion: string,
    options: MythrilOptions,
  ): Promise<MythrilOutput> {
    return new Promise((resolve) => {
      const outputFile = path.join(os.tmpdir(), `mythril-${crypto.randomBytes(8).toString('hex')}.json`);
      
      const args = [
        'analyze',
        contractPath,
        '-t', String(options.maxTransactions),
        '--execution-timeout', String(options.executionTimeout),
        '--solver-timeout', String(options.solverTimeout),
        '--strategy', options.strategy!,
        '-o', 'json',
        '--json', outputFile,
      ];

      // Add solc version if available
      const solcVersion = this.extractSolcVersion(compilerVersion);
      if (solcVersion) {
        args.push('--solv', solcVersion);
      }

      // Optional flags
      if (options.useIntegerModule) {
        args.push('--use-integer-module');
      }

      serviceLogger.debug('Running Mythril command', { args: args.join(' ') });

      const proc = spawn('myth', args, {
        timeout: (options.executionTimeout! + 60) * 1000, // Buffer for cleanup
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `${os.homedir()}/.local/bin:${process.env.PATH}` },
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        try {
          if (fs.existsSync(outputFile)) {
            const raw = fs.readFileSync(outputFile, 'utf8');
            fs.unlinkSync(outputFile);
            
            const parsed = JSON.parse(raw);
            resolve({
              success: true,
              issues: Array.isArray(parsed) ? parsed : parsed.issues || [],
            });
          } else {
            resolve({
              success: code === 0,
              error: stderr || `Mythril exited with code ${code}`,
              issues: [],
            });
          }
        } catch (err) {
          resolve({
            success: false,
            error: `Failed to parse Mythril output: ${err}`,
            issues: [],
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to spawn Mythril: ${err.message}`,
          issues: [],
        });
      });
    });
  }

  /**
   * Run Mythril on contract address (bytecode analysis)
   */
  private runMythrilOnAddress(
    contractAddress: string,
    rpcUrl: string,
    options: MythrilOptions,
  ): Promise<MythrilOutput> {
    return new Promise((resolve) => {
      const outputFile = path.join(os.tmpdir(), `mythril-addr-${crypto.randomBytes(8).toString('hex')}.json`);

      const args = [
        'analyze',
        '-a', contractAddress,
        '--rpc', rpcUrl,
        '-t', String(options.maxTransactions),
        '--execution-timeout', String(options.executionTimeout),
        '-o', 'json',
        '--json', outputFile,
      ];

      const proc = spawn('myth', args, {
        timeout: (options.executionTimeout! + 60) * 1000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        try {
          if (fs.existsSync(outputFile)) {
            const raw = fs.readFileSync(outputFile, 'utf8');
            fs.unlinkSync(outputFile);
            const parsed = JSON.parse(raw);
            resolve({
              success: true,
              issues: Array.isArray(parsed) ? parsed : parsed.issues || [],
            });
          } else {
            resolve({
              success: code === 0,
              error: stderr || `Mythril exited with code ${code}`,
              issues: [],
            });
          }
        } catch (err) {
          resolve({
            success: false,
            error: `Failed to parse output: ${err}`,
            issues: [],
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to spawn: ${err.message}`,
          issues: [],
        });
      });
    });
  }

  /**
   * Parse Mythril issues into White Rabbit Finding format
   */
  private parseFindings(issues: MythrilIssue[], contractAddress: string): Finding[] {
    return issues.map((issue) => {
      const txSequence = issue['transaction-sequence'] || [];
      
      return {
        id: '', // Assigned by database
        scanId: '',
        contractId: '',
        detectorName: `mythril-${issue['swc-id'] || 'unknown'}`,
        tool: 'mythril',
        severity: this.mapSeverity(issue.severity),
        confidence: 'high', // Symbolic execution has high confidence
        title: issue.title,
        description: this.buildDescription(issue),
        codeSnippet: this.formatTransactionSequence(txSequence),
        filePath: null, // Mythril works on bytecode
        lineStart: null,
        lineEnd: null,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
        // Mythril-specific metadata
        metadata: {
          swcId: issue['swc-id'],
          function: issue.function,
          pcAddress: issue.address,
          estimatedGasUsage: issue['estimated-gas-usage'],
          transactionSequence: txSequence,
        },
      };
    });
  }

  /**
   * Build detailed description with transaction sequence
   */
  private buildDescription(issue: MythrilIssue): string {
    let desc = issue.description;
    
    if (issue['transaction-sequence'] && issue['transaction-sequence'].length > 0) {
      desc += '\n\nExploit Transaction Sequence:\n';
      issue['transaction-sequence'].forEach((tx, idx) => {
        desc += `\n${idx + 1}. ${tx.function || 'Transaction'}\n`;
        desc += `   Caller: ${tx.caller}\n`;
        desc += `   Value: ${tx.value}\n`;
        if (tx['decoded-input']) {
          desc += `   Input: ${tx['decoded-input']}\n`;
        }
      });
    }
    
    return desc;
  }

  /**
   * Format transaction sequence for display
   */
  private formatTransactionSequence(txs: MythrilTransaction[]): string | null {
    if (!txs || txs.length === 0) return null;
    
    return txs.map((tx, idx) => {
      let line = `${idx + 1}. ${tx.function || 'call'}(`;
      if (tx['decoded-input']) {
        line += tx['decoded-input'];
      }
      line += `) from ${tx.caller}`;
      if (tx.value && tx.value !== '0x0') {
        line += ` value: ${tx.value}`;
      }
      return line;
    }).join('\n');
  }

  /**
   * Map Mythril severity to White Rabbit severity
   */
  private mapSeverity(severity: string): Severity {
    const map: Record<string, Severity> = {
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
      'Informational': 'informational',
    };
    return map[severity] || 'informational';
  }

  /**
   * Write contract source to temp file
   */
  private async writeContractToFile(address: string, sourceCode: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), 'mythril-analysis');
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
      // Best effort cleanup
    }
  }

  /**
   * Extract solc version from compiler version string
   */
  private extractSolcVersion(compilerVersion: string): string | null {
    const match = compilerVersion.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }
}

export default MythrilAnalyzer;
