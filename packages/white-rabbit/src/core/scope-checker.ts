// ═══════════════════════════════════════════════════════════════════════════════
// Scope Checker - Validates target is in-scope for bounty
// ═══════════════════════════════════════════════════════════════════════════════

import { ProtocolIntelligence } from '../intelligence/protocol-intel.js';
import { KnownVulnDatabase } from '../intelligence/known-vulns.js';
import { Finding, ScannerError } from '../types.js';

export interface ScopeResult {
  inScope: boolean;
  reason: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  maxBounty?: number;
  exclusions?: string[];
  similarFindings?: number;
}

export interface BountyScope {
  protocol: string;
  chain: string;
  contracts: ScopeContract[];
  exclusions: string[];
  maxBounty: number;
  minSeverity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ScopeContract {
  address: string;
  name?: string;
  type: 'core' | 'peripheral' | 'oracle' | 'governance' | 'out-of-scope';
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Scope checker validates findings against bounty program scope
 */
export class ScopeChecker {
  private intel: ProtocolIntelligence;
  private knownVulns: KnownVulnDatabase;
  private scopeCache: Map<string, BountyScope> = new Map();

  constructor(whiteclawsApiKey: string) {
    this.intel = new ProtocolIntelligence(whiteclawsApiKey);
    this.knownVulns = new KnownVulnDatabase();
  }

  /**
   * Check if a contract is in-scope for a protocol's bounty
   */
  async checkContractScope(
    protocolSlug: string,
    contractAddress: string,
    chain: string
  ): Promise<ScopeResult> {
    try {
      // Get protocol intelligence
      const protocol = await this.intel.getProtocol(protocolSlug);
      
      if (!protocol.hasBounty) {
        return {
          inScope: false,
          reason: `Protocol ${protocolSlug} does not have an active bounty program`,
        };
      }

      // Check against protocol contracts
      const contract = protocol.contracts.find(
        c => c.address.toLowerCase() === contractAddress.toLowerCase() &&
             c.chain.toLowerCase() === chain.toLowerCase()
      );

      if (!contract) {
        return {
          inScope: false,
          reason: `Contract ${contractAddress} not listed in ${protocolSlug} bounty scope`,
          maxBounty: protocol.maxBounty,
        };
      }

      if (!contract.inScope) {
        return {
          inScope: false,
          reason: `Contract ${contract.name || contractAddress} is explicitly out-of-scope`,
          exclusions: ['Explicitly excluded from bounty scope'],
        };
      }

      return {
        inScope: true,
        reason: `Contract ${contract.name || contractAddress} is in-scope (${contract.criticality} criticality)`,
        severity: contract.criticality,
        maxBounty: protocol.maxBounty,
      };
    } catch (error) {
      return {
        inScope: false,
        reason: `Failed to check scope: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check if a finding is in-scope
   */
  async checkFindingScope(
    finding: Finding,
    protocolSlug: string
  ): Promise<ScopeResult> {
    // Check contract scope first
    const contractScope = await this.checkContractScope(
      protocolSlug,
      finding.contractId, // This would be the actual address
      'ethereum' // Would be passed in
    );

    if (!contractScope.inScope) {
      return contractScope;
    }

    // Check for known vulnerabilities (duplicates)
    const duplicateCheck = this.knownVulns.checkDuplicate(finding, protocolSlug);
    if (duplicateCheck.isDuplicate && duplicateCheck.confidence > 0.8) {
      return {
        inScope: false,
        reason: `Similar to known vulnerability: ${duplicateCheck.matchedVuln?.title}`,
        similarFindings: duplicateCheck.matchedVuln?.occurrenceCount,
      };
    }

    // Check severity minimum
    const protocol = await this.intel.getProtocol(protocolSlug);
    // Would check min severity from bounty config

    return {
      inScope: true,
      reason: 'Finding is in-scope for bounty',
      severity: finding.severity as any,
      maxBounty: protocol.maxBounty,
    };
  }

  /**
   * Get full bounty scope for a protocol
   */
  async getBountyScope(protocolSlug: string): Promise<BountyScope | null> {
    // Check cache
    const cached = this.scopeCache.get(protocolSlug);
    if (cached) return cached;

    try {
      const protocol = await this.intel.getProtocol(protocolSlug);
      
      if (!protocol.hasBounty) {
        return null;
      }

      const scope: BountyScope = {
        protocol: protocolSlug,
        chain: protocol.primaryChain,
        contracts: protocol.contracts.map(c => {
          const type = c.type || 'peripheral';
          return {
            address: c.address,
            name: c.name,
            type: type === 'vault' ? 'core' : type,
            criticality: c.criticality,
          };
        }),
        exclusions: [], // Would come from bounty config
        maxBounty: protocol.maxBounty || 0,
        minSeverity: 'medium', // Would come from bounty config
      };

      this.scopeCache.set(protocolSlug, scope);
      return scope;
    } catch {
      return null;
    }
  }

  /**
   * Validate multiple contracts at once
   */
  async validateContracts(
    protocolSlug: string,
    contracts: Array<{ address: string; chain: string }>
  ): Promise<Map<string, ScopeResult>> {
    const results = new Map<string, ScopeResult>();

    await Promise.all(
      contracts.map(async ({ address, chain }) => {
        const result = await this.checkContractScope(protocolSlug, address, chain);
        results.set(address, result);
      })
    );

    return results;
  }

  /**
   * Get contracts in-scope sorted by value-at-risk
   */
  async getPriorityTargets(
    protocolSlug: string,
    minTvl: number = 100000
  ): Promise<Array<{ address: string; chain: string; tvl: number; criticality: string }>> {
    const targets = await this.intel.getHuntingTargets(protocolSlug, minTvl);
    
    return targets
      .filter(t => t.inScope)
      .map(t => ({
        address: t.address,
        chain: t.chain,
        tvl: t.tvl || 0,
        criticality: t.criticality,
      }))
      .sort((a, b) => b.tvl - a.tvl);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.scopeCache.clear();
    this.intel.clearCache();
  }
}

export default ScopeChecker;
