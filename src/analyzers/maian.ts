/**
 * WHITE RABBIT - MAIAN Analyzer Integration
 * 
 * Trace-based vulnerability detector for Ethereum contracts
 * GitHub: https://github.com/ivicanikolicsg/MAIAN
 * Research: "Finding The Greedy, Prodigal, and Suicidal Contracts at Scale" (NDSS 2018)
 * 
 * Key Capabilities:
 * - Deploys contracts on private blockchain for real execution
 * - Detects Suicidal, Prodigal, and Greedy contract bugs
 * - Generates confirmed exploits (not just theoretical)
 * - Low false positive rate through actual execution
 * 
 * Requirements:
 * - Go Ethereum (geth)
 * - Solidity compiler (solc)
 * - Z3 Theorem Prover
 * - Python 3 + web3
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Finding, Severity, Confidence } from '../types/index.js';
import { serviceLogger } from '../core/logger.js';

export type MaianBugClass = 'suicidal' | 'prodigal' | 'greedy';

export interface MaianOptions {
  bugClasses?: MaianBugClass[];
  timeout?: number;
  maxDepth?: number;
}

export interface MaianCall {
  function: string;
  calldata: string;
  value: string;
  caller: string;
  decodedInput?: string;
}

export interface MaianOutput {
  success: boolean;
  error?: string;
  confirmed: boolean;
  bugClass?: MaianBugClass;
  callSequence: MaianCall[];
  rawOutput: string;
}

/**
 * MAIAN Analyzer
 * 
 * Automatic tool for finding trace vulnerabilities in Ethereum contracts.
 * Best for: Critical contracts, fund safety verification, exploit confirmation
 * 
 * NOTE: MAIAN spawns a private geth blockchain. Resource intensive.
 */
export class MaianAnalyzer {
  private readonly DEFAULT_OPTIONS: MaianOptions = {
    bugClasses: ['suicidal', 'prodigal', 'greedy'],
    timeout: 300, // 5 minutes
    maxDepth: 3,
  };

  private readonly BUG_DESCRIPTIONS: Record<MaianBugClass, { 
    title: string; 
    description: string;
    severity: Severity;
    impact: string;
  }> = {
    suicidal: {
      title: 'Suicidal Contract',
      description: 'Contract can be destroyed by anyone, causing complete loss of funds',
      severity: 'critical',
      impact: 'Anyone can trigger SELFDESTRUCT and steal all funds',
    },
    prodigal: {
      title: 'Prodigal Contract',
      description: 'Contract can send Ether to arbitrary addresses without authorization',
      severity: 'high',
      impact: 'Funds can be drained to any address',
    },
    greedy: {
      title: 'Greedy Contract',
      description: 'Funds are locked in contract with no withdrawal mechanism',
      severity: 'medium',
      impact: 'Ether is permanently locked, cannot be recovered',
    },
  };

  private activeGethProcesses: Map<number, number> = new Map(); // pid -> startTime

  /**
   * Analyze contract with MAIAN
   * 
   * @param contractAddress - Contract address
   * @param sourceCode - Solidity source code
   * @param contractName - Main contract name (required for Solidity)
   * @param options - Analysis options
   */
  async analyze(
    contractAddress: string,
    sourceCode: string,
    contractName: string,
    options: MaianOptions = {},
  ): Promise<Finding[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    serviceLogger.info('Starting MAIAN analysis', {
      address: contractAddress,
      contractName,
      bugClasses: opts.bugClasses,
    });

    // Check if MAIAN is installed
    if (!this.isMaianInstalled()) {
      serviceLogger.error('MAIAN not found. Install from: https://github.com/ivicanikolicsg/MAIAN');
      return [];
    }

    // Check dependencies
    if (!this.checkDependencies()) {
      serviceLogger.error('MAIAN dependencies missing (geth, solc, z3)');
      return [];
    }

    // Write contract to temp file
    const tempFile = await this.writeContractToFile(contractAddress, sourceCode);

    const findings: Finding[] = [];

    try {
      // Run MAIAN for each bug class
      for (const bugClass of opts.bugClasses!) {
        try {
          const output = await this.runMaian(tempFile, contractName, bugClass, opts);

          if (output.confirmed) {
            serviceLogger.warn('MAIAN confirmed vulnerability', {
              address: contractAddress,
              bugClass,
            });
            findings.push(this.parseFinding(output, contractAddress));
          }
        } catch (err) {
          serviceLogger.error('MAIAN analysis error', { bugClass, error: err });
        }
      }

      serviceLogger.info('MAIAN analysis complete', {
        address: contractAddress,
        vulnerabilitiesFound: findings.length,
      });
    } finally {
      // Cleanup
      this.cleanupFile(tempFile);
      this.cleanupGethProcesses();
    }

    return findings;
  }

  /**
   * Analyze contract bytecode directly
   * 
   * @param contractAddress - Contract address
   * @param bytecode - Contract bytecode (hex string)
   * @param options - Analysis options
   */
  async analyzeBytecode(
    contractAddress: string,
    bytecode: string,
    options: MaianOptions = {},
  ): Promise<Finding[]> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    serviceLogger.info('Starting MAIAN bytecode analysis', {
      address: contractAddress,
    });

    if (!this.isMaianInstalled()) {
      serviceLogger.error('MAIAN not found');
      return [];
    }

    // Write bytecode to temp file
    const tempFile = await this.writeBytecodeToFile(contractAddress, bytecode);

    const findings: Finding[] = [];

    try {
      for (const bugClass of opts.bugClasses!) {
        try {
          const output = await this.runMaianBytecode(tempFile, bugClass, opts);

          if (output.confirmed) {
            findings.push(this.parseFinding(output, contractAddress));
          }
        } catch (err) {
          serviceLogger.error('MAIAN bytecode analysis error', { bugClass, error: err });
        }
      }
    } finally {
      this.cleanupFile(tempFile);
      this.cleanupGethProcesses();
    }

    return findings;
  }

  /**
   * Check if MAIAN is installed
   */
  private isMaianInstalled(): boolean {
    try {
      const maianPath = process.env.MAIAN_PATH;
      if (maianPath) {
        return fs.existsSync(path.join(maianPath, 'maian.py'));
      }
      // Try to find in PATH
      execSync('python -c "import maian"', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check MAIAN dependencies
   */
  private checkDependencies(): boolean {
    try {
      // Check geth
      execSync('which geth', { stdio: 'ignore' });
      // Check solc
      execSync('which solc', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run MAIAN on Solidity source
   */
  private runMaian(
    contractPath: string,
    contractName: string,
    bugClass: MaianBugClass,
    options: MaianOptions,
  ): Promise<MaianOutput> {
    return new Promise((resolve, reject) => {
      const classFlag = { suicidal: '0', prodigal: '1', greedy: '2' }[bugClass];
      const maianPath = process.env.MAIAN_PATH || '.';

      const args = [
        path.join(maianPath, 'maian.py'),
        '-s', contractPath,
        contractName,
        '-c', classFlag,
      ];

      serviceLogger.debug('Running MAIAN command', { args: args.join(' ') });

      const proc = spawn('python', args, {
        timeout: options.timeout! * 1000,
        cwd: maianPath,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Track geth process spawned by MAIAN
      proc.on('spawn', () => {
        this.trackGethProcess(proc.pid!);
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
        this.untrackGethProcess(proc.pid!);

        const confirmed = stdout.includes('Confirmed bug!') || stdout.includes('vulnerability found');
        const callSequence = this.parseCallSequence(stdout);

        resolve({
          success: code === 0 || confirmed,
          confirmed,
          bugClass,
          callSequence,
          rawOutput: stdout,
        });
      });

      proc.on('error', (err) => {
        this.untrackGethProcess(proc.pid!);
        reject(err);
      });
    });
  }

  /**
   * Run MAIAN on bytecode
   */
  private runMaianBytecode(
    bytecodePath: string,
    bugClass: MaianBugClass,
    options: MaianOptions,
  ): Promise<MaianOutput> {
    return new Promise((resolve, reject) => {
      const classFlag = { suicidal: '0', prodigal: '1', greedy: '2' }[bugClass];
      const maianPath = process.env.MAIAN_PATH || '.';

      const args = [
        path.join(maianPath, 'maian.py'),
        '-b', bytecodePath,
        '-c', classFlag,
      ];

      const proc = spawn('python', args, {
        timeout: options.timeout! * 1000,
        cwd: maianPath,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.on('spawn', () => {
        this.trackGethProcess(proc.pid!);
      });

      let stdout = '';
      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.on('close', (code) => {
        this.untrackGethProcess(proc.pid!);

        const confirmed = stdout.includes('Confirmed bug!');
        const callSequence = this.parseCallSequence(stdout);

        resolve({
          success: code === 0 || confirmed,
          confirmed,
          bugClass,
          callSequence,
          rawOutput: stdout,
        });
      });

      proc.on('error', reject);
    });
  }

  /**
   * Parse call sequence from MAIAN output
   */
  private parseCallSequence(output: string): MaianCall[] {
    const calls: MaianCall[] = [];
    const lines = output.split('\n');

    let inSequence = false;
    for (const line of lines) {
      if (line.includes('Call sequence to trigger bug:')) {
        inSequence = true;
        continue;
      }

      if (inSequence && line.trim().startsWith('1.')) {
        // Parse call
        const match = line.match(/(\d+)\.\s+(\w+)\((.*)\)/);
        if (match) {
          calls.push({
            function: match[2],
            calldata: '',
            value: '0',
            caller: 'ANY',
          });
        }
      }
    }

    return calls;
  }

  /**
   * Parse MAIAN output into White Rabbit Finding
   */
  private parseFinding(output: MaianOutput, contractAddress: string): Finding {
    const bugInfo = this.BUG_DESCRIPTIONS[output.bugClass!];

    return {
      id: '',
      scanId: '',
      contractId: '',
      detectorName: `maian-${output.bugClass}`,
      tool: 'maian',
      severity: bugInfo.severity,
      confidence: 'high', // Confirmed by execution
      title: bugInfo.title,
      description: `${bugInfo.description}\n\nImpact: ${bugInfo.impact}`,
      codeSnippet: this.formatCallSequence(output.callSequence),
      filePath: null,
      lineStart: null,
      lineEnd: null,
      aiAssessment: null,
      aiIsFalsePositive: null,
      deduplicatedGroupId: null,
      // MAIAN-specific metadata
      metadata: {
        bugClass: output.bugClass,
        callSequence: output.callSequence,
        confirmed: true,
        rawOutput: output.rawOutput.slice(0, 1000), // Truncate for storage
      },
    };
  }

  /**
   * Format call sequence for display
   */
  private formatCallSequence(calls: MaianCall[]): string | null {
    if (!calls || calls.length === 0) return null;

    return calls.map((call, idx) => {
      let line = `${idx + 1}. ${call.function}(`;
      if (call.decodedInput) {
        line += call.decodedInput;
      }
      line += ')';
      if (call.value && call.value !== '0') {
        line += ` value: ${call.value}`;
      }
      return line;
    }).join('\n');
  }

  /**
   * Track geth process for cleanup
   */
  private trackGethProcess(pid: number): void {
    this.activeGethProcesses.set(pid, Date.now());
  }

  /**
   * Untrack geth process
   */
  private untrackGethProcess(pid: number): void {
    this.activeGethProcesses.delete(pid);
  }

  /**
   * Cleanup zombie geth processes
   */
  private cleanupGethProcesses(): void {
    const now = Date.now();
    for (const [pid, startTime] of this.activeGethProcesses) {
      // Kill processes older than 10 minutes (zombies)
      if (now - startTime > 600000) {
        try {
          process.kill(pid, 'SIGTERM');
          serviceLogger.debug('Killed zombie geth process', { pid });
        } catch {
          // Process already dead
        }
        this.activeGethProcesses.delete(pid);
      }
    }
  }

  /**
   * Write contract to temp file
   */
  private async writeContractToFile(address: string, sourceCode: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), 'maian-analysis');
    fs.mkdirSync(tempDir, { recursive: true });

    const fileName = `contract-${address.slice(2, 10)}.sol`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, sourceCode, 'utf8');
    return filePath;
  }

  /**
   * Write bytecode to temp file
   */
  private async writeBytecodeToFile(address: string, bytecode: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), 'maian-analysis');
    fs.mkdirSync(tempDir, { recursive: true });

    const fileName = `bytecode-${address.slice(2, 10)}.bin`;
    const filePath = path.join(tempDir, fileName);

    // Remove 0x prefix if present
    const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    fs.writeFileSync(filePath, cleanBytecode, 'utf8');
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

export default MaianAnalyzer;
