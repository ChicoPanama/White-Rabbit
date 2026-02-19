// ═══════════════════════════════════════════════════════════════════════════════
// SlitherEngine - Slither static analysis integration
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Contract,
  Finding,
  AnalysisEngine,
  EngineOptions,
  EngineResult,
  Severity,
  Confidence,
} from '../types.js';
import { ulid } from 'ulid';
import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export class SlitherEngine implements AnalysisEngine {
  name = 'slither';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('slither', ['--version']);
      proc.on('error', () => resolve(false));
      proc.on('exit', (code) => resolve(code === 0));
    });
  }

  async analyze(
    contract: Contract,
    options: EngineOptions = {}
  ): Promise<EngineResult> {
    const tempDir = await this.createTempDir();
    const startTime = Date.now();

    try {
      // Write contract source to temp file
      const sourcePath = join(tempDir, 'Contract.sol');
      await writeFile(sourcePath, contract.sourceCode);

      // Run slither
      const findings = await this.runSlither(sourcePath, options);

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
    } finally {
      // Cleanup
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async runSlither(
    sourcePath: string,
    options: EngineOptions
  ): Promise<Finding[]> {
    return new Promise((resolve, reject) => {
      const args = [
        sourcePath,
        '--json', '-',
        '--exclude-informational',
        '--exclude-low',
        '--filter-paths', 'node_modules',
      ];

      const proc = spawn('slither', args, {
        timeout: options.timeoutMs || 300000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0 && code !== 255) { // 255 = findings found
          reject(new Error(`Slither exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const findings = this.parseOutput(stdout);
          resolve(findings);
        } catch (error) {
          reject(error);
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseOutput(output: string): Finding[] {
    try {
      const json = JSON.parse(output);
      const findings: Finding[] = [];

      for (const detector of json.results?.detectors || []) {
        const element = detector.elements?.[0];
        
        findings.push({
          id: ulid(),
          scanId: '', // Will be set by caller
          contractId: '', // Will be set by caller
          detectorName: detector.check,
          tool: 'slither',
          severity: this.mapSeverity(detector.impact),
          confidence: this.mapConfidence(detector.confidence),
          title: detector.description?.split('.')[0] || detector.check,
          description: detector.description,
          codeSnippet: null,
          filePath: element?.source_mapping?.filename_relative || null,
          lineStart: element?.source_mapping?.lines?.[0] || null,
          lineEnd: element?.source_mapping?.lines?.slice(-1)[0] || null,
          aiAssessment: null,
          aiIsFalsePositive: null,
          deduplicatedGroupId: null,
        });
      }

      return findings;
    } catch {
      return [];
    }
  }

  private mapSeverity(impact: string): Severity {
    const map: Record<string, Severity> = {
      High: 'high',
      Medium: 'medium',
      Low: 'low',
      Informational: 'informational',
    };
    return map[impact] || 'medium';
  }

  private mapConfidence(confidence: string): Confidence {
    const map: Record<string, Confidence> = {
      High: 'high',
      Medium: 'medium',
      Low: 'low',
    };
    return map[confidence] || 'medium';
  }

  private async createTempDir(): Promise<string> {
    const dir = join(tmpdir(), `slither-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dir, { recursive: true });
    return dir;
  }
}
