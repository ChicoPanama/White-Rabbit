import { spawn } from 'child_process';
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

    try {
      const output = await this.runSlither(solFile);
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
    try {
      // Etherscan wraps multi-file sources in double braces: {{...}}
      const trimmed = sourceCode.startsWith('{{') ? sourceCode.slice(1, -1) : sourceCode;
      const parsed = JSON.parse(trimmed);
      if (parsed.sources && typeof parsed.sources === 'object') {
        const resolvedContractDir = path.resolve(contractDir) + path.sep;
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
    }

    return contractDir;
  }

  private runSlither(contractPath: string): Promise<SlitherOutput> {
    return new Promise((resolve) => {
      const outputFile = path.join(os.tmpdir(), `slither-${crypto.randomBytes(16).toString('hex')}.json`);

      const proc = spawn('slither', [
        contractPath,
        '--json', outputFile,
        '--exclude-low',
        '--filter-paths', 'node_modules|test|mock',
      ], {
        timeout: 120_000,
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
            resolve(JSON.parse(raw) as SlitherOutput);
          } else {
            resolve({
              success: false,
              error: stderr || `Slither exited with code ${code}`,
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

  private parseFindings(detectors: SlitherDetectorResult[], contractAddress: string): Finding[] {
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
