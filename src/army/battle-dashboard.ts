/**
 * WhiteRabbit Army Battle Dashboard
 * Real-time visualization of army operations
 */

import { commandCenter } from './command-center';

interface BattleStats {
  totalExploitValue: number;
  activeHunts: number;
  vulnerabilitiesFound: number;
  protocolsScanned: number;
  lastMajorFinding: string;
}

export class BattleDashboard {
  private stats: BattleStats = {
    totalExploitValue: 0,
    activeHunts: 0,
    vulnerabilitiesFound: 0,
    protocolsScanned: 0,
    lastMajorFinding: 'None'
  };

  /**
   * Display real-time battle dashboard
   */
  display(): void {
    this.clearScreen();
    this.renderHeader();
    this.renderArmyStatus();
    this.renderIntelligence();
    this.renderTargets();
    this.renderFooter();
  }

  /**
   * Start real-time dashboard updates
   */
  startRealTimeUpdates(): void {
    setInterval(() => {
      this.updateStats();
      this.display();
    }, 5000); // Update every 5 seconds
  }

  private clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[0f');
  }

  private renderHeader(): void {
    console.log('🏴‍☠️ ═══════════════════════════════════════════════════════════ 🏴‍☠️');
    console.log('                    WHITERABBIT ARMY COMMAND CENTER                   ');
    console.log('                   Autonomous Vulnerability Hunters                   ');
    console.log('🐇 ═══════════════════════════════════════════════════════════ 🐇');
    console.log('');
  }

  private renderArmyStatus(): void {
    const status = commandCenter.getArmyStatus();
    
    console.log('📊 ARMY STATUS');
    console.log('──────────────');
    console.log(`🎭 Total Agents: ${status.totalAgents.toString().padEnd(15)} 🎯 Active Hunts: ${status.activeAgents}`);
    console.log(`💰 Discoveries: ${status.totalDiscoveries.toString().padEnd(15)} 📡 Total Intel: ${this.stats.vulnerabilitiesFound}`);
    console.log('');
    
    console.log('🔥 ACTIVE SPECIALISTS');
    console.log('─────────────────────');
    status.agents.forEach(agent => {
      const statusIcon = this.getStatusIcon(agent.status);
      const name = agent.name.padEnd(18);
      const spec = agent.specialization.padEnd(25);
      console.log(`${statusIcon} ${name} | ${spec} | ${agent.discoveries} discoveries`);
    });
    console.log('');
  }

  private renderIntelligence(): void {
    const intel = commandCenter.getIntelligenceSummary();
    
    console.log('🧠 INTELLIGENCE SUMMARY');
    console.log('────────────────────────');
    console.log(`📋 Total Findings: ${intel.totalFindings}`);
    console.log(`🚨 High-Value: ${intel.highValueFindings} (≥$25M)`);
    console.log(`💎 Exploitable Value: $${(intel.totalExploitableValue / 1e6).toFixed(1)}M`);
    console.log('');
    
    if (intel.topFindings.length > 0) {
      console.log('🎯 TOP DISCOVERIES');
      console.log('──────────────────');
      intel.topFindings.slice(0, 5).forEach((finding, index) => {
        const value = `$${(finding.exploitableValue / 1e6).toFixed(1)}M`;
        const protocol = finding.protocol.padEnd(20);
        console.log(`${index + 1}. ${protocol} | ${finding.vulnerabilityType.padEnd(20)} | ${value}`);
      });
      console.log('');
    }
  }

  private renderTargets(): void {
    console.log('🎯 PRIORITY TARGETS');
    console.log('───────────────────');
    console.log('• Ethereum: Lido ($28B), Aave V3 ($28B), EigenLayer ($13B)');
    console.log('• Base: Morpho V1 ($2.4B), Aave V3 ($888M), Steakhouse ($837M)');
    console.log('• Arbitrum: Hyperliquid Bridge ($4B), Aave V3 ($1.1B), USD AI ($655M)');
    console.log('• Bridges: All $500M+ TVL cross-chain protocols');
    console.log('• New Protocols: Unaudited $50M+ TVL DeFi protocols');
    console.log('');
  }

  private renderFooter(): void {
    console.log('🔄 LIVE UPDATES EVERY 5 SECONDS');
    console.log(`⏰ Last Update: ${new Date().toLocaleTimeString()}`);
    console.log('');
    console.log('💀 ATTACK VECTORS: Logic Errors ($12.5B), Access Control ($4.4B), Bridges ($4.7B)');
    console.log('🎭 SPECIALISTS: Business Logic, Admin Bypass, Bridge Hunter, Signature Forge');
    console.log('🏴‍☠️ ═══════════════════════════════════════════════════════════ 🏴‍☠️');
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'hunting': return '🏃';
      case 'active': return '⚡';
      case 'reporting': return '📡';
      case 'idle': return '⏸️';
      default: return '❓';
    }
  }

  private updateStats(): void {
    const intel = commandCenter.getIntelligenceSummary();
    const status = commandCenter.getArmyStatus();
    
    this.stats = {
      totalExploitValue: intel.totalExploitableValue,
      activeHunts: status.activeAgents,
      vulnerabilitiesFound: intel.totalFindings,
      protocolsScanned: status.totalDiscoveries,
      lastMajorFinding: intel.topFindings[0]?.protocol || 'None'
    };
  }
}

/**
 * Launch the battle dashboard
 */
export function launchBattleDashboard(): void {
  const dashboard = new BattleDashboard();
  console.log('🚀 Launching WhiteRabbit Army Battle Dashboard...');
  console.log('');
  
  dashboard.display();
  dashboard.startRealTimeUpdates();
}

// Launch dashboard if run directly
if (require.main === module) {
  launchBattleDashboard();
}