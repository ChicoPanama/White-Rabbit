import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import type { SlitherOutput, SlitherDetectorResult, Finding, Severity, Confidence } from '../types/index.js';
import { vyperHandler } from '../services/vyperHandler.js';
import { patternAnalyzer } from './patternAnalyzer.js';

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
    // Check if this is a Vyper contract
    if (vyperHandler.isVyperContract(sourceCode)) {
      console.log(`[Slither] Detected Vyper contract: ${contractAddress}`);
      try {
        return await vyperHandler.analyzeVyperContract(sourceCode, contractAddress);
      } catch (error) {
        console.log(`[Slither] Vyper analysis failed, falling back to pattern matching:`, error);
        return [];
      }
    }
    
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
      
      if (!output.success || !output.results?.detectors?.length) {
        console.warn(`Slither analysis failed for ${contractAddress}: ${output.error}`);
        console.log(`[Slither] Falling back to pattern analysis...`);
        
        // Fallback to pattern-based analysis
        const patternFindings = patternAnalyzer.analyze(contractAddress, sourceCode, contractAddress);
        console.log(`[Slither] Pattern analyzer found ${patternFindings.length} potential issues`);
        return patternFindings;
      }
      
      const slitherFindings = this.parseFindings(output.results.detectors, contractAddress);
      
      // If Slither found very few findings but contract looks complex, supplement with pattern analysis
      if (slitherFindings.length < 3 && patternAnalyzer.hasHighValueFunctions(sourceCode)) {
        console.log(`[Slither] Supplementing with pattern analysis for high-value contract`);
        const patternFindings = patternAnalyzer.analyze(contractAddress, sourceCode, contractAddress);
        return [...slitherFindings, ...patternFindings];
      }
      
      return slitherFindings;
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
      // Default to recent stable version
      version = '0.8.20';
    }

    // Handle version compatibility
    const versionParts = version.split('.').map(Number);
    const [major, minor] = versionParts;
    
    // If version is too old (< 0.4.0), use 0.4.26 as minimum
    if (major === 0 && minor < 4) {
      console.log(`[Slither] Version ${version} too old, using 0.4.26`);
      version = '0.4.26';
    }
    
    // Special handling for Vyper version indicators
    if (version.includes('2.11') || compilerVersion.includes('vyper')) {
      console.log(`[Slither] Vyper version detected, using latest Solidity`);
      version = '0.8.20';
    }

    const artifactsDir = path.join(os.homedir(), '.solc-select', 'artifacts');
    const solcBin = path.join(artifactsDir, `solc-${version}`, `solc-${version}`);

    if (fs.existsSync(solcBin)) {
      return solcBin;
    }

    // Try to install the version
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
      
      // Fallback to available versions
      const fallbackVersions = ['0.8.20', '0.8.19', '0.8.13', '0.7.6', '0.6.12', '0.5.17', '0.4.26'];
      for (const fallback of fallbackVersions) {
        const fallbackBin = path.join(artifactsDir, `solc-${fallback}`, `solc-${fallback}`);
        if (fs.existsSync(fallbackBin)) {
          console.log(`[Slither] Using fallback version ${fallback}`);
          return fallbackBin;
        }
      }
    }
    
    // Last resort: use system solc
    try {
      execSync('solc --version', { stdio: 'ignore' });
      console.log(`[Slither] Using system solc`);
      return 'solc';
    } catch (err) {
      console.warn(`[Slither] No usable solc version found`);
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
      
      // Create remappings for common dependencies
      const contractDir = path.dirname(contractPath);
      const remappingsFile = path.join(contractDir, 'remappings.txt');
      const remappings = [
        '@openzeppelin/contracts/=../node_modules/@openzeppelin/contracts/',
        '@openzeppelin/=../node_modules/@openzeppelin/',
        '@nomad-xyz/src/=../node_modules/@nomad-xyz/excessively-safe-call/src/',
        'forge-std/=../node_modules/forge-std/src/',
        'ds-test/=../node_modules/ds-test/src/',
        './=./',
        '../=../',
      ];
      
      try {
        fs.writeFileSync(remappingsFile, remappings.join('\n'));
      } catch (err) {
        console.log('[Slither] Failed to create remappings file:', err);
      }

      const args = [
        contractPath,
        '--json', outputFile,
        '--exclude-low',
        '--filter-paths', 'node_modules|test|mock',
        '--ignore-compile',  // Skip compilation errors for missing dependencies
        '--disable-color',   // Cleaner output
        '--solc-remaps', remappings.join(' '),
      ];
      if (solcPath) {
        args.push('--solc', solcPath);
      }
      
      // Add foundry config if exists
      const foundryToml = path.join(process.cwd(), 'foundry.toml');
      if (fs.existsSync(foundryToml)) {
        args.push('--foundry-out-dir', './out');
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
