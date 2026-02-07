/**
 * Advanced Fork Hunter - Hunt unpatched forks with inherited vulnerabilities
 * Targets TVL sweet spot: $100K - $10M protocols with less security
 */

import { Database } from 'better-sqlite3';
import { DeFiLlamaClient } from '../clients/defillama.js';
import { EtherscanClient } from '../clients/etherscan.js';
import type { DeFiLlamaProtocol, Contract } from '../types/index.js';
import * as crypto from 'crypto';
import * as path from 'path';

interface ForkCandidate {
  address: string;
  chain: string;
  name: string;
  tvl: number;
  suspectedOriginal: string;
  similarityScore: number;
  deploymentAge: number;
  securityScore: number;
  priorityScore: number;
}

interface VulnerabilityInheritance {
  originalVulnerability: string;
  originalProtocol: string;
  originalPatchDate: string | null;
  inheritedByFork: boolean;
  patchStatus: 'unpatched' | 'patched' | 'unknown';
  confidence: number;
  exploitableValue: number;
}

interface HuntTarget {
  address: string;
  chain: string;
  name: string;
  tvl: number;
  suspectedOriginal: string;
  vulnerabilities: VulnerabilityInheritance[];
  priorityScore: number;
  estimatedExploitValue: number;
}

export class AdvancedForkHunter {
  private db: Database;
  private defillama: DeFiLlamaClient;
  private etherscan: EtherscanClient;
  
  // TVL sweet spot: enough value to be worth it, small enough to have weak security
  private readonly TVL_MIN = 100_000;      // $100K minimum
  private readonly TVL_MAX = 10_000_000;   // $10M maximum
  private readonly OPTIMAL_TVL = 2_000_000; // $2M optimal target

  constructor(defillama: DeFiLlamaClient, etherscan: EtherscanClient) {
    const dbPath = path.join(process.cwd(), 'cache', 'fork-hunter.db');
    this.db = require('better-sqlite3')(dbPath);
    this.defillama = defillama;
    this.etherscan = etherscan;
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    const schema = require('fs').readFileSync(
      path.join(process.cwd(), 'cache', 'fork-schema.sql'), 
      'utf8'
    );
    this.db.exec(schema);
  }

  /**
   * Hunt for vulnerable forks across specified chains
   */
  async huntVulnerableForks(chains: string[]): Promise<HuntTarget[]> {
    console.log('🐇 Starting advanced fork hunt...');
    console.log(`🎯 Target TVL range: $${this.TVL_MIN.toLocaleString()} - $${this.TVL_MAX.toLocaleString()}`);
    console.log(`⚡ Optimal target: $${this.OPTIMAL_TVL.toLocaleString()}\n`);

    const huntTargets: HuntTarget[] = [];

    for (const chain of chains) {
      console.log(`🔍 Hunting forks on ${chain}...`);
      
      // Step 1: Discover protocols in TVL sweet spot
      const candidates = await this.discoverForkCandidates(chain);
      console.log(`  📊 Found ${candidates.length} potential fork candidates`);

      // Step 2: Analyze for fork relationships
      for (const candidate of candidates) {
        const forkAnalysis = await this.analyzeForkRelationship(candidate);
        if (forkAnalysis) {
          huntTargets.push(forkAnalysis);
        }
      }
    }

    // Step 3: Rank targets by exploit potential
    const rankedTargets = this.rankHuntTargets(huntTargets);
    
    // Step 4: Store in database for tracking
    await this.storeHuntTargets(rankedTargets);

    console.log(`\n🎯 Hunt completed: ${rankedTargets.length} high-priority targets identified`);
    this.logHuntSummary(rankedTargets);

    return rankedTargets;
  }

  /**
   * Discover protocols in the TVL sweet spot
   */
  private async discoverForkCandidates(chain: string): Promise<ForkCandidate[]> {
    const protocols = await this.defillama.getProtocolsByChain(chain, this.TVL_MIN);
    const candidates: ForkCandidate[] = [];

    for (const protocol of protocols) {
      const tvl = protocol.chainTvls?.[this.capitalizeChain(chain)] || protocol.tvl || 0;
      
      // Filter to sweet spot
      if (tvl < this.TVL_MIN || tvl > this.TVL_MAX) continue;
      if (!protocol.address) continue;

      // Calculate preliminary scores
      const deploymentAge = await this.getDeploymentAge(protocol.address, chain);
      const securityScore = this.estimateSecurityScore(protocol, tvl, deploymentAge);
      const priorityScore = this.calculateInitialPriority(tvl, securityScore, deploymentAge);

      candidates.push({
        address: protocol.address,
        chain,
        name: protocol.name,
        tvl,
        suspectedOriginal: '', // Will be determined by fork analysis
        similarityScore: 0,
        deploymentAge,
        securityScore,
        priorityScore
      });
    }

    return candidates.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Analyze if a protocol is likely a fork and identify the original
   */
  private async analyzeForkRelationship(candidate: ForkCandidate): Promise<HuntTarget | null> {
    try {
      // Get contract source code
      const contractData = await this.etherscan.getContractSourceCode(candidate.chain, candidate.address);
      if (!contractData?.sourceCode) return null;

      // Detect potential original protocols through code similarity
      const originalProtocol = await this.detectOriginalProtocol(contractData.sourceCode, candidate.chain);
      if (!originalProtocol) return null;

      candidate.suspectedOriginal = originalProtocol.name;
      candidate.similarityScore = originalProtocol.similarity;

      // Analyze vulnerability inheritance
      const vulnerabilities = await this.analyzeVulnerabilityInheritance(
        candidate, 
        originalProtocol
      );

      if (vulnerabilities.length === 0) return null;

      // Calculate final priority and exploit value
      const estimatedExploitValue = vulnerabilities.reduce((sum, v) => sum + v.exploitableValue, 0);
      const finalPriority = this.calculateFinalPriority(candidate, vulnerabilities);

      return {
        address: candidate.address,
        chain: candidate.chain,
        name: candidate.name,
        tvl: candidate.tvl,
        suspectedOriginal: candidate.suspectedOriginal,
        vulnerabilities,
        priorityScore: finalPriority,
        estimatedExploitValue
      };

    } catch (error) {
      console.error(`❌ Fork analysis failed for ${candidate.address}:`, error);
      return null;
    }
  }

  /**
   * Detect the original protocol this might be forked from
   */
  private async detectOriginalProtocol(sourceCode: string, chain: string): Promise<{name: string, similarity: number} | null> {
    // Known high-value protocols that are commonly forked
    const commonOriginals = [
      'Uniswap V2', 'Uniswap V3', 'SushiSwap', 'PancakeSwap',
      'Compound', 'Aave', 'MakerDAO', 'Curve',
      'Balancer', 'Yearn', 'Synthetix', '1inch',
      'Olympus DAO', 'Frax', 'Liquity', 'Reflexer'
    ];

    let bestMatch: {name: string, similarity: number} | null = null;

    for (const original of commonOriginals) {
      const similarity = await this.calculateCodeSimilarity(sourceCode, original);
      
      // If similarity > 80%, likely a fork
      if (similarity > 0.8) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { name: original, similarity };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate code similarity between fork and original
   */
  private async calculateCodeSimilarity(forkCode: string, originalProtocol: string): Promise<number> {
    // Simplified similarity calculation
    // In production, this would use more sophisticated techniques:
    // - Function signature matching
    // - Control flow graph comparison  
    // - Bytecode similarity analysis
    // - ABI comparison

    const forkHash = crypto.createHash('md5').update(forkCode).digest('hex');
    
    // For now, use pattern matching for known fork indicators
    const forkIndicators = this.getForkIndicators(originalProtocol);
    let matches = 0;
    
    for (const indicator of forkIndicators) {
      if (forkCode.includes(indicator)) {
        matches++;
      }
    }

    return matches / forkIndicators.length;
  }

  /**
   * Get code patterns that indicate a fork of a specific protocol
   */
  private getForkIndicators(protocol: string): string[] {
    const indicators: Record<string, string[]> = {
      'Uniswap V2': [
        'function swapExactTokensForTokens',
        'function addLiquidity',
        'IUniswapV2Router',
        'getAmountsOut',
        'WETH'
      ],
      'Compound': [
        'function mint(uint mintAmount)',
        'function borrow(uint borrowAmount)',
        'InterestRateModel',
        'exchangeRate',
        'cToken'
      ],
      'Aave': [
        'function deposit(',
        'function withdraw(',
        'function borrow(',
        'LendingPool',
        'aToken'
      ]
      // Add more patterns for other protocols
    };

    return indicators[protocol] || [];
  }

  /**
   * Analyze which vulnerabilities the fork inherited
   */
  private async analyzeVulnerabilityInheritance(
    fork: ForkCandidate, 
    original: {name: string, similarity: number}
  ): Promise<VulnerabilityInheritance[]> {
    
    // Get known vulnerabilities for the original protocol
    const knownVulns = this.getKnownVulnerabilities(original.name);
    const inheritedVulns: VulnerabilityInheritance[] = [];

    for (const vuln of knownVulns) {
      // Estimate if vulnerability was inherited based on similarity and deployment timing
      const inherited = await this.checkVulnerabilityInheritance(fork, vuln, original.similarity);
      
      if (inherited) {
        const exploitableValue = this.estimateExploitValue(fork.tvl, vuln.severity);
        
        inheritedVulns.push({
          originalVulnerability: vuln.id,
          originalProtocol: original.name,
          originalPatchDate: vuln.patchDate,
          inheritedByFork: true,
          patchStatus: await this.checkPatchStatus(fork, vuln),
          confidence: inherited.confidence,
          exploitableValue
        });
      }
    }

    return inheritedVulns;
  }

  /**
   * Get known vulnerabilities for a protocol
   */
  private getKnownVulnerabilities(protocol: string): Array<{
    id: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    technique: string,
    patchDate: string | null,
    description: string
  }> {
    // Query the known_hacks table for vulnerabilities in this protocol type
    const query = this.db.prepare(`
      SELECT * FROM known_hacks 
      WHERE protocol LIKE ? OR name LIKE ?
      ORDER BY loss_amount DESC
    `);
    
    const hacks = query.all(`%${protocol}%`, `%${protocol}%`);
    
    return hacks.map((hack: any) => ({
      id: hack.name,
      severity: this.mapLossToSeverity(hack.loss_amount),
      technique: hack.technique,
      patchDate: null, // Would need to research when patches were applied
      description: hack.description || hack.technique
    }));
  }

  /**
   * Check if a fork inherited a specific vulnerability
   */
  private async checkVulnerabilityInheritance(
    fork: ForkCandidate, 
    vuln: any, 
    similarityScore: number
  ): Promise<{inherited: boolean, confidence: number} | null> {
    
    // Higher similarity = higher chance of inheriting vulnerabilities
    const baseConfidence = similarityScore;
    
    // If fork was deployed before the vulnerability was disclosed, it likely inherited it
    const vulnDisclosureDate = new Date('2022-01-01'); // Placeholder - would get real dates
    const forkDeployDate = new Date(Date.now() - (fork.deploymentAge * 24 * 60 * 60 * 1000));
    
    let timeConfidence = 0.5;
    if (forkDeployDate < vulnDisclosureDate) {
      timeConfidence = 0.9; // Very likely inherited if deployed before disclosure
    }

    const finalConfidence = (baseConfidence + timeConfidence) / 2;
    
    // Only consider if confidence > 60%
    if (finalConfidence < 0.6) return null;
    
    return { inherited: true, confidence: finalConfidence };
  }

  /**
   * Check if the fork has patched a specific vulnerability
   */
  private async checkPatchStatus(fork: ForkCandidate, vuln: any): Promise<'unpatched' | 'patched' | 'unknown'> {
    // This would involve comparing the fork's code against known patch patterns
    // For now, assume smaller protocols are less likely to have patches
    
    if (fork.tvl < 1_000_000 && fork.securityScore < 50) {
      return 'unpatched'; // Small protocols with low security scores likely unpatched
    }
    
    return 'unknown';
  }

  /**
   * Estimate exploit value for a vulnerability in a fork
   */
  private estimateExploitValue(tvl: number, severity: 'critical' | 'high' | 'medium' | 'low'): number {
    const severityMultipliers = {
      critical: 0.8,  // Could drain 80% of TVL
      high: 0.4,      // Could drain 40% of TVL
      medium: 0.15,   // Could drain 15% of TVL
      low: 0.05       // Could drain 5% of TVL
    };
    
    return tvl * severityMultipliers[severity];
  }

  /**
   * Calculate deployment age in days
   */
  private async getDeploymentAge(address: string, chain: string): Promise<number> {
    try {
      // Would query blockchain for contract deployment block
      // For now, return a placeholder
      return 365; // Assume 1 year old
    } catch (error) {
      return 365; // Default fallback
    }
  }

  /**
   * Estimate security score (0-100, lower = more vulnerable)
   */
  private estimateSecurityScore(protocol: DeFiLlamaProtocol, tvl: number, deploymentAge: number): number {
    let score = 50; // Start with neutral score
    
    // Lower TVL typically means less security investment
    if (tvl < 500_000) score -= 20;
    else if (tvl < 2_000_000) score -= 10;
    
    // Very new or very old protocols tend to be more vulnerable
    if (deploymentAge < 30) score -= 15;  // Too new, not battle-tested
    if (deploymentAge > 1000) score -= 10; // Too old, may have accumulated tech debt
    
    // Check for audit indicators in name/description
    const protocolInfo = protocol.name.toLowerCase();
    if (protocolInfo.includes('test') || protocolInfo.includes('beta') || protocolInfo.includes('v0')) {
      score -= 25;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate initial priority score
   */
  private calculateInitialPriority(tvl: number, securityScore: number, deploymentAge: number): number {
    let priority = 50;
    
    // Sweet spot TVL gets higher priority
    const tvlOptimalDistance = Math.abs(tvl - this.OPTIMAL_TVL) / this.OPTIMAL_TVL;
    priority += (1 - tvlOptimalDistance) * 30;
    
    // Lower security score = higher priority
    priority += (100 - securityScore) * 0.4;
    
    // Moderate age is optimal (not too new, not too old)
    if (deploymentAge >= 90 && deploymentAge <= 730) {
      priority += 10;
    }
    
    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Calculate final priority including vulnerability analysis
   */
  private calculateFinalPriority(candidate: ForkCandidate, vulnerabilities: VulnerabilityInheritance[]): number {
    let priority = candidate.priorityScore;
    
    // Boost priority for unpatched critical vulnerabilities
    for (const vuln of vulnerabilities) {
      if (vuln.patchStatus === 'unpatched') {
        if (vuln.originalVulnerability.includes('critical')) priority += 20;
        else if (vuln.originalVulnerability.includes('high')) priority += 15;
        else priority += 10;
      }
    }
    
    // High-confidence inheritance boosts priority
    const avgConfidence = vulnerabilities.reduce((sum, v) => sum + v.confidence, 0) / vulnerabilities.length;
    priority += avgConfidence * 10;
    
    return Math.min(100, priority);
  }

  /**
   * Rank hunt targets by priority
   */
  private rankHuntTargets(targets: HuntTarget[]): HuntTarget[] {
    return targets
      .filter(t => t.priorityScore >= 60) // Only high-priority targets
      .sort((a, b) => {
        // Primary sort: priority score
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        // Secondary sort: exploit value
        return b.estimatedExploitValue - a.estimatedExploitValue;
      })
      .slice(0, 50); // Top 50 targets
  }

  /**
   * Store hunt targets in database
   */
  private async storeHuntTargets(targets: HuntTarget[]): Promise<void> {
    const insertTarget = this.db.prepare(`
      INSERT OR REPLACE INTO hunt_targets (
        target_address, target_chain, target_name, target_tvl, suspected_original,
        vulnerability_candidates, priority_score, estimated_exploit_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const target of targets) {
      insertTarget.run(
        target.address,
        target.chain,
        target.name,
        target.tvl,
        target.suspectedOriginal,
        JSON.stringify(target.vulnerabilities),
        target.priorityScore,
        target.estimatedExploitValue,
        Math.floor(Date.now() / 1000)
      );
    }

    console.log(`✅ Stored ${targets.length} hunt targets in database`);
  }

  /**
   * Log hunt summary
   */
  private logHuntSummary(targets: HuntTarget[]): void {
    console.log('\n🎯 FORK HUNT SUMMARY:');
    
    const totalValue = targets.reduce((sum, t) => sum + t.estimatedExploitValue, 0);
    const criticalTargets = targets.filter(t => t.priorityScore >= 90).length;
    const highTargets = targets.filter(t => t.priorityScore >= 70).length;
    
    console.log(`  💰 Total estimated exploit value: $${totalValue.toLocaleString()}`);
    console.log(`  🎯 Critical targets (90+ priority): ${criticalTargets}`);
    console.log(`  ⚡ High-priority targets (70+ priority): ${highTargets}`);
    console.log(`  📊 Total targets: ${targets.length}`);
    
    if (targets.length > 0) {
      console.log('\n🏆 TOP 5 TARGETS:');
      targets.slice(0, 5).forEach((target, i) => {
        console.log(`  ${i + 1}. ${target.name} (${target.chain})`);
        console.log(`     💰 TVL: $${target.tvl.toLocaleString()}`);
        console.log(`     🎯 Priority: ${target.priorityScore}/100`);
        console.log(`     💥 Est. exploit: $${target.estimatedExploitValue.toLocaleString()}`);
        console.log(`     🔗 Fork of: ${target.suspectedOriginal}`);
      });
    }
  }

  private mapLossToSeverity(loss: number): 'critical' | 'high' | 'medium' | 'low' {
    if (loss >= 100_000_000) return 'critical';
    if (loss >= 10_000_000) return 'high';
    if (loss >= 1_000_000) return 'medium';
    return 'low';
  }

  private capitalizeChain(chain: string): string {
    return chain.charAt(0).toUpperCase() + chain.slice(1);
  }

  /**
   * Get current hunt targets from database
   */
  getHuntTargets(status = 'queued'): any[] {
    const query = this.db.prepare(`
      SELECT * FROM hunt_targets 
      WHERE hunt_status = ? 
      ORDER BY priority_score DESC
    `);
    return query.all(status);
  }

  /**
   * Get fork statistics
   */
  getForkStats(): any {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_targets,
        AVG(priority_score) as avg_priority,
        SUM(estimated_exploit_value) as total_exploit_value,
        COUNT(CASE WHEN priority_score >= 90 THEN 1 END) as critical_targets
      FROM hunt_targets
    `).get();

    return stats;
  }
}

export default AdvancedForkHunter;