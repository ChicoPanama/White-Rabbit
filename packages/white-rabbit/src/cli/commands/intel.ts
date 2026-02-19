// ═══════════════════════════════════════════════════════════════════════════════
// Intel Command - Get protocol intelligence from WhiteClaws
// ═══════════════════════════════════════════════════════════════════════════════

import { ProtocolIntelligence } from '../../intelligence/protocol-intel.js';

export interface IntelOptions {
  detailed?: boolean;
  attackSurface?: boolean;
}

export async function intelCommand(
  protocol: string,
  options: IntelOptions,
  apiKey: string
): Promise<void> {
  console.log(`\n📡 Fetching Intelligence: ${protocol.toUpperCase()}\n`);
  console.log('═'.repeat(60));

  const intel = new ProtocolIntelligence(apiKey);

  try {
    const data = await intel.getProtocol(protocol);

    // Basic Info
    console.log('\n📋 Basic Information');
    console.log('─'.repeat(60));
    console.log(`  Name: ${data.name}`);
    console.log(`  Category: ${data.category}`);
    console.log(`  Website: ${data.website || 'N/A'}`);
    if (data.description) {
      console.log(`  Description: ${data.description.slice(0, 100)}${data.description.length > 100 ? '...' : ''}`);
    }

    // TVL Data
    console.log('\n💰 TVL Information');
    console.log('─'.repeat(60));
    console.log(`  Total TVL: $${(data.tvl / 1e9).toFixed(2)}B`);
    console.log(`  Primary Chain: ${data.primaryChain}`);
    console.log('  Chain Breakdown:');
    for (const [chain, tvl] of Object.entries(data.chainTvls).slice(0, 5)) {
      console.log(`    - ${chain}: $${(tvl / 1e6).toFixed(2)}M`);
    }

    // Bounty Info
    console.log('\n🎯 Bounty Program');
    console.log('─'.repeat(60));
    console.log(`  Active: ${data.hasBounty ? '✅ Yes' : '❌ No'}`);
    if (data.maxBounty) {
      console.log(`  Max Bounty: $${data.maxBounty.toLocaleString()}`);
    }

    // Contracts
    if (data.contracts.length > 0) {
      console.log('\n📄 Contracts');
      console.log('─'.repeat(60));
      const inScope = data.contracts.filter(c => c.inScope);
      console.log(`  Total: ${data.contracts.length} (${inScope.length} in-scope)`);
      
      if (options.detailed) {
        for (const contract of data.contracts.slice(0, 10)) {
          const status = contract.inScope ? '✅' : '❌';
          console.log(`  ${status} ${contract.address.slice(0, 12)}... (${contract.type || 'unknown'})`);
        }
        if (data.contracts.length > 10) {
          console.log(`  ... and ${data.contracts.length - 10} more`);
        }
      }
    }

    // Risk Signals
    if (data.riskSignals.length > 0) {
      console.log('\n⚠️  Risk Signals');
      console.log('─'.repeat(60));
      for (const signal of data.riskSignals) {
        const icon = signal.type === 'positive' ? '✅' : signal.type === 'negative' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} [${signal.category}] ${signal.description}`);
      }
    }

    // Attack Surface
    if (options.attackSurface) {
      console.log('\n🎯 Attack Surface');
      console.log('─'.repeat(60));
      
      const surface = await intel.getAttackSurface(protocol);
      
      console.log(`  Entry Points: ${surface.entryPoints.length}`);
      for (const ep of surface.entryPoints.slice(0, 5)) {
        console.log(`    - ${ep.contract.slice(0, 12)}...::${ep.function} (${ep.access})`);
      }

      console.log(`\n  Trust Assumptions: ${surface.trustAssumptions.length}`);
      for (const ta of surface.trustAssumptions.slice(0, 5)) {
        const riskIcon = ta.riskLevel === 'critical' ? '🔴' : ta.riskLevel === 'high' ? '🟠' : '🟡';
        console.log(`    ${riskIcon} [${ta.type}] ${ta.description.slice(0, 60)}`);
      }
    }

    // Known Vulnerabilities
    if (data.knownVulnerabilities.length > 0) {
      console.log('\n🔴 Known Vulnerabilities');
      console.log('─'.repeat(60));
      for (const vuln of data.knownVulnerabilities.slice(0, 5)) {
        const sevIcon = vuln.severity === 'critical' ? '🔴' : vuln.severity === 'high' ? '🟠' : '🟡';
        console.log(`  ${sevIcon} ${vuln.title} (${vuln.type})`);
      }
    }

    // Similar Protocols
    if (data.similarProtocols.length > 0) {
      console.log('\n🔗 Similar Protocols');
      console.log('─'.repeat(60));
      console.log(`  ${data.similarProtocols.join(', ')}`);
    }

    console.log('');

  } catch (error) {
    console.error(`❌ Failed to fetch intelligence: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    intel.clearCache();
  }
}
