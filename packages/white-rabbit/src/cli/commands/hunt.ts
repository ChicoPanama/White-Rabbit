// ═══════════════════════════════════════════════════════════════════════════════
// Hunt Command - Full protocol vulnerability hunting
// ═══════════════════════════════════════════════════════════════════════════════

import { WhiteRabbit } from '../../core/white-rabbit.js';
import { ProtocolIntelligence } from '../../intelligence/protocol-intel.js';
import { ScopeChecker } from '../../core/scope-checker.js';
import { OfflineQueue } from '../../connectors/offline-queue.js';
import { Finding, VerifiedFinding } from '../../types.js';

export interface HuntOptions {
  chain?: string;
  depth?: 'quick' | 'standard' | 'deep';
  minTvl?: number;
  maxContracts?: number;
  output?: string;
  submit?: boolean;
  format?: 'json' | 'table';
}

export async function huntCommand(
  protocol: string,
  options: HuntOptions,
  apiKey: string
): Promise<void> {
  console.log(`\n🔍 Hunting ${protocol.toUpperCase()} for vulnerabilities\n`);
  console.log('─'.repeat(60));

  const startTime = Date.now();
  const allFindings: VerifiedFinding[] = [];

  // Initialize components
  const intel = new ProtocolIntelligence(apiKey);
  const scopeChecker = new ScopeChecker(apiKey);
  const scanner = new WhiteRabbit({
    whiteclawsApiKey: apiKey,
    enableDeepAnalysis: options.depth === 'deep',
  });

  try {
    // Step 1: Protocol Intelligence
    console.log('📡 Fetching protocol intelligence...');
    const protocolData = await intel.getProtocol(protocol);
    
    console.log(`  Name: ${protocolData.name}`);
    console.log(`  Category: ${protocolData.category}`);
    console.log(`  TVL: $${(protocolData.tvl / 1e9).toFixed(2)}B`);
    console.log(`  Chains: ${protocolData.chains.join(', ')}`);
    console.log(`  Has Bounty: ${protocolData.hasBounty ? '✅' : '❌'}`);

    if (!protocolData.hasBounty) {
      console.log('\n⚠️  Warning: Protocol does not have an active bounty program');
      console.log('   Findings can still be submitted for reputation points');
    }

    // Step 2: Get Hunting Targets
    console.log('\n🎯 Identifying high-value targets...');
    const targets = await scopeChecker.getPriorityTargets(
      protocol,
      options.minTvl || 100000
    );

    const limitedTargets = targets.slice(0, options.maxContracts || 10);
    console.log(`  Found ${targets.length} in-scope contracts`);
    console.log(`  Will scan ${limitedTargets.length} highest-value targets`);

    // Step 3: Scan Each Target
    console.log('\n🔬 Starting scans...\n');
    
    for (let i = 0; i < limitedTargets.length; i++) {
      const target = limitedTargets[i];
      const progress = `[${i + 1}/${limitedTargets.length}]`;
      
      console.log(`${progress} Scanning ${target.address.slice(0, 12)}... on ${target.chain}`);
      console.log(`     TVL: $${(target.tvl / 1e6).toFixed(2)}M | Criticality: ${target.criticality}`);

      try {
        const findings = await scanner.scan(target.address, {
          chain: target.chain,
          deep: options.depth === 'deep',
        });

        if (findings.length > 0) {
          console.log(`     ⚠️  Found ${findings.length} issues`);
          allFindings.push(...findings);
        } else {
          console.log(`     ✅ No issues found`);
        }
      } catch (error) {
        console.log(`     ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Progress update every 3 contracts
      if ((i + 1) % 3 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n     Progress: ${i + 1}/${limitedTargets.length} contracts | ${elapsed}s elapsed\n`);
      }
    }

    // Step 4: Results Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Hunt Complete\n');
    console.log(`Duration: ${duration}s`);
    console.log(`Contracts Scanned: ${limitedTargets.length}`);
    console.log(`Total Findings: ${allFindings.length}`);

    if (allFindings.length > 0) {
      // Group by severity
      const bySeverity: Record<string, VerifiedFinding[]> = {};
      for (const f of allFindings) {
        bySeverity[f.severity] = bySeverity[f.severity] || [];
        bySeverity[f.severity].push(f);
      }

      console.log('\nBy Severity:');
      for (const [sev, findings] of Object.entries(bySeverity)) {
        const icon = sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🟡' : '🔵';
        console.log(`  ${icon} ${sev}: ${findings.length}`);
      }

      // Output format
      if (options.format === 'json') {
        const output = JSON.stringify({
          protocol,
          duration: parseFloat(duration),
          contractsScanned: limitedTargets.length,
          findings: allFindings,
        }, null, 2);

        if (options.output) {
          const { writeFileSync } = await import('fs');
          writeFileSync(options.output, output);
          console.log(`\n💾 Results saved to ${options.output}`);
        } else {
          console.log('\n--- JSON OUTPUT ---');
          console.log(output);
        }
      } else {
        // Table output
        console.log('\n--- FINDINGS ---\n');
        for (const finding of allFindings.slice(0, 20)) {
          console.log(`[${finding.severity.toUpperCase()}] ${finding.title}`);
          console.log(`  Tool: ${finding.tool} | Confidence: ${finding.confidence}`);
          if (finding.filePath) {
            console.log(`  Location: ${finding.filePath}:${finding.lineStart}`);
          }
          console.log();
        }

        if (allFindings.length > 20) {
          console.log(`... and ${allFindings.length - 20} more findings`);
        }
      }

      // Submit option
      if (options.submit) {
        console.log('\n📤 Submitting findings to WhiteClaws...');
        const queue = new OfflineQueue();
        
        for (const finding of allFindings) {
          await queue.enqueue(finding, protocol);
        }

        // Try to submit immediately
        await queue.process(async (finding, proto) => {
          console.log(`  Submitting: ${finding.title.slice(0, 50)}...`);
          // Would call actual submission API here
        });

        const stats = queue.getStats();
        console.log(`\n  Queued: ${stats.pending} | Submitted: ${stats.submitted} | Failed: ${stats.failed}`);
      }
    } else {
      console.log('\n🎉 No vulnerabilities found!');
    }

    // Risk signals from protocol intel
    if (protocolData.riskSignals.length > 0) {
      console.log('\n📋 Protocol Risk Signals:');
      for (const signal of protocolData.riskSignals.slice(0, 5)) {
        const icon = signal.type === 'positive' ? '✅' : signal.type === 'negative' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${signal.category}: ${signal.description}`);
      }
    }

  } finally {
    await scanner.shutdown();
    intel.clearCache();
    scopeChecker.clearCache();
  }
}
