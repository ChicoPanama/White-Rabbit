import { SlitherAnalyzer } from './slither.js';
import { AIAnalyzer } from './ai-analyzer.js';
import type { Contract, Finding } from '../types/index.js';
import CacheManager from '../../cache/CacheManager.js';
import * as crypto from 'crypto';

/**
 * Cached static analysis engine
 * Avoids redundant Slither/AI analysis of previously scanned contracts
 */
export class CachedAnalyzer {
  private cache = CacheManager;
  private slither: SlitherAnalyzer;
  private ai: AIAnalyzer;

  constructor(slither: SlitherAnalyzer, ai: AIAnalyzer) {
    this.slither = slither;
    this.ai = ai;
  }

  /**
   * Analyze contract with intelligent caching
   * Returns cached results if contract hasn't changed (bytecode hash match)
   */
  async analyzeContract(contract: Contract): Promise<Finding[]> {
    const startTime = Date.now();
    const contractHash = this.getContractHash(contract);
    
    // Check cache first
    const cachedAnalysis = await this.cache.getCachedContract(contract.address, contract.chain);
    
    if (cachedAnalysis && cachedAnalysis.bytecode_hash === contractHash) {
      const responseTime = Date.now() - startTime;
      this.cache.recordCacheHit('contract', responseTime);
      
      console.log(`🎯 Analysis cache hit: ${contract.address} (${responseTime}ms)`);
      
      // Return cached findings
      if (cachedAnalysis.analysis_results) {
        const cachedResults = JSON.parse(cachedAnalysis.analysis_results);
        return this.convertCachedFindings(cachedResults, contract);
      }
    }

    // Cache miss or contract changed - run fresh analysis
    this.cache.recordCacheMiss('contract');
    console.log(`🔬 Running fresh analysis: ${contract.address} on ${contract.chain}...`);
    
    const findings = await this.performFullAnalysis(contract);
    
    // Cache the analysis results
    await this.cacheAnalysisResults(contract, findings, contractHash);
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Analysis completed: ${findings.length} findings (${responseTime}ms)`);
    
    return findings;
  }

  /**
   * Batch analyze multiple contracts with optimal caching
   */
  async batchAnalyzeContracts(contracts: Contract[]): Promise<Map<string, Finding[]>> {
    const results = new Map<string, Finding[]>();
    const uncachedContracts: Contract[] = [];
    
    // Check cache for all contracts
    for (const contract of contracts) {
      const contractHash = this.getContractHash(contract);
      const cached = await this.cache.getCachedContract(contract.address, contract.chain);
      
      if (cached && cached.bytecode_hash === contractHash && cached.analysis_results) {
        const cachedResults = JSON.parse(cached.analysis_results);
        const findings = this.convertCachedFindings(cachedResults, contract);
        results.set(contract.address, findings);
        this.cache.recordCacheHit('contract', 10);
      } else {
        uncachedContracts.push(contract);
      }
    }
    
    console.log(`📊 Analysis batch: ${results.size} cache hits, ${uncachedContracts.length} fresh analyses needed`);
    
    // Analyze uncached contracts in parallel (with concurrency limit)
    const maxConcurrency = 3; // Don't overwhelm the system
    for (let i = 0; i < uncachedContracts.length; i += maxConcurrency) {
      const batch = uncachedContracts.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (contract) => {
        try {
          const findings = await this.analyzeContract(contract);
          results.set(contract.address, findings);
        } catch (error) {
          console.error(`❌ Analysis failed for ${contract.address}:`, error);
          results.set(contract.address, []);
        }
      });
      
      await Promise.all(batchPromises);
    }
    
    return results;
  }

  /**
   * Check if contract needs re-analysis based on cache freshness
   */
  async needsAnalysis(contract: Contract): Promise<boolean> {
    const cached = await this.cache.getCachedContract(contract.address, contract.chain);
    
    if (!cached) {
      return true; // Never analyzed
    }
    
    const contractHash = this.getContractHash(contract);
    if (cached.bytecode_hash !== contractHash) {
      return true; // Contract changed (shouldn't happen, but handle it)
    }
    
    // Check if analysis is stale (7 days)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 86400);
    if (cached.last_analyzed < sevenDaysAgo) {
      return true; // Stale analysis, might have new vulnerability patterns
    }
    
    return false; // Recent analysis available
  }

  /**
   * Get analysis statistics
   */
  getAnalysisStats(): any {
    return {
      ...this.cache.getCacheStats(),
      slitherAvailable: this.slither.isAvailable,
      aiAvailable: this.ai.isAvailable
    };
  }

  private async performFullAnalysis(contract: Contract): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Stage 1: Slither static analysis
    if (this.slither.isAvailable) {
      try {
        const slitherFindings = await this.slither.analyze(contract);
        findings.push(...slitherFindings);
        console.log(`  📝 Slither: ${slitherFindings.length} findings`);
      } catch (error) {
        console.error(`  ❌ Slither analysis failed:`, error);
      }
    }
    
    // Stage 2: AI business logic analysis
    if (this.ai.isAvailable && findings.length > 0) {
      try {
        const aiFindings = await this.ai.analyze(contract, findings);
        findings.push(...aiFindings);
        console.log(`  🧠 AI: ${aiFindings.length} additional findings`);
      } catch (error) {
        console.error(`  ❌ AI analysis failed:`, error);
      }
    }
    
    return findings;
  }

  private async cacheAnalysisResults(contract: Contract, findings: Finding[], contractHash: string): Promise<void> {
    const riskScore = this.calculateRiskScore(findings);
    const vulnCount = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
    
    await this.cache.cacheContractAnalysis(contract.address, contract.chain, {
      bytecode: contract.bytecode || '',
      sourceVerified: !!contract.sourceCode,
      sourceCode: contract.sourceCode || null,
      compilerVersion: null, // Could extract from Etherscan data
      results: findings,
      vulnCount,
      riskScore,
      exploitableValue: 0 // Will be calculated later by exploit estimator
    });
  }

  private getContractHash(contract: Contract): string {
    const data = contract.bytecode || contract.sourceCode || contract.address;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private convertCachedFindings(cachedResults: any, contract: Contract): Finding[] {
    if (!Array.isArray(cachedResults)) {
      return [];
    }
    
    return cachedResults.map(finding => ({
      ...finding,
      contract: contract,
      fromCache: true
    }));
  }

  private calculateRiskScore(findings: Finding[]): number {
    let score = 0;
    
    for (const finding of findings) {
      switch (finding.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 5;
          break;
        case 'low':
          score += 1;
          break;
      }
    }
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Learn from false positive patterns
   */
  async learnFalsePositive(finding: Finding): Promise<void> {
    await this.cache.learnFalsePositive({
      detector: finding.detector,
      description: finding.title,
      contract: finding.contract.address,
      severity: finding.severity
    });
    
    console.log(`🧠 Learned false positive pattern: ${finding.detector} - ${finding.title}`);
  }

  /**
   * Clean up old analysis cache (keep fresh for 30 days)
   */
  cleanup(): void {
    this.cache.cleanup();
  }
}

export default CachedAnalyzer;