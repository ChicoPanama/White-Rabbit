import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import type { SlitherOutput, SlitherDetectorResult, Finding, Severity, Confidence } from '../types/index.js';

const CONTRACTS_DIR = path.resolve(process.cwd(), 'contracts');

export class SlitherAnalyzer {
  /**
   * Write contract source to disk and run Slither analysis.
   * Returns parsed findings with normalized severity.
   */
  async analyze(
    contractAddress: string,
    chainId: number,
    sourceCode: string,
    compilerVersion: string,
  ): Promise<Finding[]> {
    const contractDir = await this.writeContractSource(contractAddress, chainId, sourceCode);
    const solFile = path.join(contractDir, 'contract.sol');

    // Debug: verify file exists
    if (!fs.existsSync(solFile)) {
      console.error(`[Slither] Contract file does not exist: ${solFile}`);
      console.error(`[Slither] Directory contents:`, fs.readdirSync(contractDir, { withFileTypes: true }).map(d => `${d.name}${d.isDirectory() ? '/' : ''}`));
      this.cleanupDir(contractDir);
      return [];
    }

    console.log(`[Slither] Contract file created: ${solFile} (${fs.statSync(solFile).size} bytes)`);

    try {
      const solcPath = this.ensureSolcVersion(compilerVersion, sourceCode);
      const output = await this.runSlither(solFile, solcPath);
      if (!output.success && !output.results?.detectors?.length) {
        console.warn(`Slither analysis failed for ${contractAddress}: ${output.error}`);
        return [];
      }
      return this.parseFindings(output.results.detectors, contractAddress);
    } finally {
      // Clean up written files
      this.cleanupDir(contractDir);
    }
  }

  /**
   * Parse the solc version from Etherscan's compilerVersion string or source pragma,
   * install it via solc-select if needed, and return the path to the binary.
   */
  private ensureSolcVersion(compilerVersion: string, sourceCode: string): string | null {
    let version = this.parseSolcVersion(compilerVersion);
    if (!version) {
      version = this.parsePragmaVersion(sourceCode);
    }
    if (!version) {
      return null;
    }

    const artifactsDir = path.join(os.homedir(), '.solc-select', 'artifacts');
    const solcBin = path.join(artifactsDir, `solc-${version}`, `solc-${version}`);

    if (fs.existsSync(solcBin)) {
      return solcBin;
    }

    // Install the needed version
    try {
      console.log(`[Slither] Installing solc ${version} via solc-select...`);
      execSync(`solc-select install ${version}`, {
        timeout: 60_000,
        stdio: 'pipe',
        env: { ...process.env, PATH: `${os.homedir()}/.local/bin:${process.env.PATH}` },
      });
      if (fs.existsSync(solcBin)) {
        return solcBin;
      }
    } catch (err) {
      console.warn(`[Slither] Failed to install solc ${version}: ${err}`);
    }
    return null;
  }

  /** Extract version from Etherscan format like "v0.6.6+commit.6c089d02" */
  private parseSolcVersion(compilerVersion: string): string | null {
    const match = compilerVersion.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }

  /** Extract version from pragma like "pragma solidity ^0.6.6;" or "pragma solidity =0.6.6;" */
  private parsePragmaVersion(sourceCode: string): string | null {
    const match = sourceCode.match(/pragma\s+solidity\s+[^;]*?(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }

  private async writeContractSource(
    address: string,
    chainId: number,
    sourceCode: string,
  ): Promise<string> {
    const hash = crypto.createHash('sha256').update(`${chainId}:${address}`).digest('hex').slice(0, 12);
    const contractDir = path.join(CONTRACTS_DIR, hash);
    fs.mkdirSync(contractDir, { recursive: true });

    // Handle Etherscan's multi-file JSON format
    let parsedMulti = false;
    let mainContractFile: string | null = null;
    
    try {
      // Etherscan wraps multi-file sources in double braces: {{...}}
      const trimmed = sourceCode.startsWith('{{') ? sourceCode.slice(1, -1) : sourceCode;
      const parsed = JSON.parse(trimmed);
      if (parsed.sources && typeof parsed.sources === 'object') {
        const resolvedContractDir = path.resolve(contractDir) + path.sep;
        const filePaths = Object.keys(parsed.sources);
        
        // Find the main contract file (usually the first one or one with contract name)
        mainContractFile = filePaths.find(fp => fp.includes('contract') || fp.includes(address.slice(2, 8))) || filePaths[0];
        
        for (const [filePath, fileData] of Object.entries(parsed.sources)) {
          const fullPath = path.resolve(contractDir, filePath);
          if (!fullPath.startsWith(resolvedContractDir)) {
            console.warn(`Skipping path traversal attempt in source: ${filePath}`);
            continue;
          }
          if (typeof (fileData as { content: unknown })?.content !== 'string') {
            console.warn(`Skipping invalid source entry: ${filePath}`);
            continue;
          }
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, (fileData as { content: string }).content, 'utf8');
        }
        parsedMulti = true;
      }
    } catch {
      // Single-file source
    }

    if (!parsedMulti) {
      fs.writeFileSync(path.join(contractDir, 'contract.sol'), sourceCode, 'utf8');
    } else if (mainContractFile) {
      // For multi-file sources, also copy the main contract to contract.sol for Slither
      const mainContractPath = path.join(contractDir, mainContractFile);
      if (fs.existsSync(mainContractPath)) {
        const mainContent = fs.readFileSync(mainContractPath, 'utf8');
        fs.writeFileSync(path.join(contractDir, 'contract.sol'), mainContent, 'utf8');
      }
    }

    return contractDir;
  }

  private runSlither(contractPath: string, solcPath?: string | null): Promise<SlitherOutput> {
    return new Promise((resolve) => {
      const outputFile = path.join(os.tmpdir(), `slither-${crypto.randomBytes(16).toString('hex')}.json`);

      const args = [
        contractPath,
        '--json', outputFile,
        '--exclude-low',
        '--filter-paths', 'node_modules|test|mock',
        '--ignore-compile',  // Skip compilation errors for missing dependencies
        '--disable-color',   // Cleaner output
      ];
      if (solcPath) {
        args.push('--solc', solcPath);
      }

      const proc = spawn('slither', args, {
        timeout: 120_000,
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
            const parsed = JSON.parse(raw) as SlitherOutput;
            // Even if compilation failed, Slither might have found some detectors
            resolve({
              success: true,
              error: stderr || null,
              results: parsed.results || { detectors: [] },
            });
          } else {
            // No JSON output but maybe partial success with compilation errors
            resolve({
              success: code === 0,
              error: stderr || `Slither exited with code ${code} (dependency issues expected)`,
              results: { detectors: [] },
            });
          }
        } catch (err) {
          resolve({
            success: false,
            error: `Failed to parse Slither output: ${err}`,
            results: { detectors: [] },
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to spawn Slither: ${err.message}`,
          results: { detectors: [] },
        });
      });
    });
  }

  private parseFindings(detectors: SlitherDetectorResult[] | undefined, contractAddress: string): Finding[] {
    if (!detectors || !Array.isArray(detectors)) {
      return [];
    }
    return detectors.map((d) => {
      const firstElement = d.elements?.[0];
      const lines = firstElement?.source_mapping?.lines ?? [];

      return {
        id: '', // Assigned by database
        scanId: '',
        contractId: '',
        detectorName: d.check,
        tool: 'slither',
        severity: this.normalizeSeverity(d.impact),
        confidence: this.normalizeConfidence(d.confidence),
        title: `${d.check} in ${contractAddress}`,
        description: d.description,
        codeSnippet: d.markdown || null,
        filePath: firstElement?.source_mapping?.filename_relative ?? null,
        lineStart: lines.length > 0 ? lines[0] : null,
        lineEnd: lines.length > 0 ? lines[lines.length - 1] : null,
        aiAssessment: null,
        aiIsFalsePositive: null,
        deduplicatedGroupId: null,
      };
    });
  }

  private normalizeSeverity(impact: string): Severity {
    const map: Record<string, Severity> = {
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
      'Informational': 'informational',
    };
    return map[impact] ?? 'informational';
  }

  private normalizeConfidence(conf: string): Confidence {
    const map: Record<string, Confidence> = {
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
    };
    return map[conf] ?? 'medium';
  }

  private cleanupDir(dir: string): void {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}
