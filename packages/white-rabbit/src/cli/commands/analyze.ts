// ═══════════════════════════════════════════════════════════════════════════════
// Analyze Command - Analyze local Solidity source files
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { PatternEngine } from '../../engines/pattern.js';
import { Finding } from '../../types.js';

export interface AnalyzeOptions {
  output?: string;
  format?: 'json' | 'table' | 'sarif';
  minSeverity?: string;
}

export async function analyzeCommand(
  filePath: string,
  options: AnalyzeOptions
): Promise<void> {
  console.log(`\n📄 Analyzing ${filePath}\n`);
  console.log('─'.repeat(60));

  // Check file exists
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Read file
  let sourceCode: string;
  try {
    sourceCode = readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`❌ Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log(`  File size: ${sourceCode.length} bytes`);
  console.log(`  Lines: ${sourceCode.split('\n').length}`);

  // Detect compiler version from pragma
  const pragmaMatch = sourceCode.match(/pragma solidity[^;]+;/);
  const compilerVersion = pragmaMatch ? pragmaMatch[0] : 'unknown';
  console.log(`  Compiler: ${compilerVersion}`);

  // Analyze
  console.log('\n🔬 Running analysis...\n');

  const engine = new PatternEngine();
  const startTime = Date.now();

  const result = await engine.analyze({
    id: 'local-analysis',
    address: '0x0000000000000000000000000000000000000000',
    chainId: 1,
    name: filePath.split('/').pop()?.replace('.sol', '') || 'Contract',
    sourceCode,
    abi: [],
    compilerVersion: compilerVersion.match(/[\d.]+/)?.[0] || '0.8.0',
    isProxy: false,
    implementationAddress: null,
    tvlUsd: null,
    protocolName: null,
  });

  const duration = Date.now() - startTime;

  // Filter by severity
  const severityOrder: Record<string, number> = {
    critical: 4, high: 3, medium: 2, low: 1, informational: 0,
  };
  const minLevel = severityOrder[options.minSeverity || 'low'] || 0;
  
  const findings = result.success
    ? result.findings.filter(f => severityOrder[f.severity] >= minLevel)
    : [];

  // Results
  console.log(`Analysis complete in ${duration}ms`);
  console.log(`Findings: ${findings.length}\n`);

  if (findings.length > 0) {
    // Group by severity
    const bySeverity: Record<string, Finding[]> = {};
    for (const f of findings) {
      bySeverity[f.severity] = bySeverity[f.severity] || [];
      bySeverity[f.severity].push(f);
    }

    // Output
    if (options.format === 'json') {
      const output = JSON.stringify({
        file: filePath,
        duration,
        compilerVersion,
        findings,
      }, null, 2);

      if (options.output) {
        const { writeFileSync } = await import('fs');
        writeFileSync(options.output, output);
        console.log(`💾 Results saved to ${options.output}`);
      } else {
        console.log(output);
      }
    } else if (options.format === 'sarif') {
      const sarif = generateSarif(filePath, findings);
      if (options.output) {
        const { writeFileSync } = await import('fs');
        writeFileSync(options.output, JSON.stringify(sarif, null, 2));
        console.log(`💾 SARIF saved to ${options.output}`);
      } else {
        console.log(JSON.stringify(sarif, null, 2));
      }
    } else {
      // Table format
      for (const severity of ['critical', 'high', 'medium', 'low', 'informational']) {
        const group = bySeverity[severity];
        if (!group || group.length === 0) continue;

        const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : severity === 'low' ? '🔵' : '⚪';
        console.log(`${icon} ${severity.toUpperCase()} (${group.length})`);
        console.log('─'.repeat(60));

        for (const finding of group) {
          console.log(`  ${finding.title}`);
          console.log(`  Line: ${finding.lineStart}`);
          console.log(`  ${finding.description.slice(0, 100)}${finding.description.length > 100 ? '...' : ''}`);
          if (finding.codeSnippet) {
            console.log(`  Code: ${finding.codeSnippet.slice(0, 60)}${finding.codeSnippet.length > 60 ? '...' : ''}`);
          }
          console.log();
        }
      }
    }

    // Exit code based on severity
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    process.exit(criticalCount > 0 ? 2 : highCount > 0 ? 1 : 0);
  } else {
    console.log('✅ No vulnerabilities found!');
    process.exit(0);
  }
}

function generateSarif(filePath: string, findings: Finding[]): object {
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'White-Rabbit',
          version: '2.0.0',
          rules: findings.map(f => ({
            id: f.detectorName,
            name: f.title,
            shortDescription: { text: f.description },
            defaultConfiguration: {
              level: f.severity === 'critical' || f.severity === 'high' ? 'error' :
                     f.severity === 'medium' ? 'warning' : 'note',
            },
          })),
        },
      },
      results: findings.map(f => ({
        ruleId: f.detectorName,
        level: f.severity === 'critical' || f.severity === 'high' ? 'error' :
               f.severity === 'medium' ? 'warning' : 'note',
        message: { text: f.description },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: filePath },
            region: {
              startLine: f.lineStart || 1,
              endLine: f.lineEnd || f.lineStart || 1,
            },
          },
        }],
      })),
    }],
  };
}
