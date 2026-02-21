// ═══════════════════════════════════════════════════════════════════════════════
// Protocol Intelligence - Fetch enriched protocol data from WhiteClaws API
// ═══════════════════════════════════════════════════════════════════════════════

import { WhiteClawsClient } from '../connectors/whiteclaws-client.js';
import { DeFiLlamaConnector } from '../connectors/defillama.js';
import { ScannerError } from '../types.js';

export interface EnrichedProtocol {
  slug: string;
  name: string;
  category: string;
  description?: string;
  website?: string;
  tvl: number;
  chainTvls: Record<string, number>;
  chains: string[];
  primaryChain: string;
  hasBounty: boolean;
  maxBounty?: number;
  contracts: ContractIntel[];
  knownVulnerabilities: KnownVuln[];
  similarProtocols: string[];
  audits: AuditInfo[];
  riskSignals: RiskSignal[];
  vulnerabilitySurface?: {
    evmbenchPatternMatches: Array<{
      patternId: string;
      category: string;
      severity: string;
      title: string;
      relevanceScore: number;
      detectionHints: string[];
      codeIndicators: string[];
    }>;
    contractType: string;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    totalMatchingPatterns: number;
  };
  isFork: boolean;
  forkedFrom?: string;
  oracles: string[];
  fetchedAt: Date;
}

export interface ContractIntel {
  address: string;
  chain: string;
  name?: string;
  type?: 'core' | 'peripheral' | 'oracle' | 'governance' | 'vault';
  tvl?: number;
  isVerified: boolean;
  inScope: boolean;
  criticality: 'critical' | 'high' | 'medium' | 'low';
}

export interface KnownVuln {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
}

export interface AuditInfo {
  auditor: string;
  date: string;
  findings: number;
  highFindings: number;
  criticalFindings: number;
}

export interface RiskSignal {
  type: 'positive' | 'negative' | 'neutral';
  category: string;
  description: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export interface AttackSurface {
  entryPoints: EntryPoint[];
  trustAssumptions: TrustAssumption[];
  privilegedRoles: PrivilegedRole[];
}

export interface EntryPoint {
  contract: string;
  function: string;
  access: 'permissionless' | 'permissioned';
  valueAtRisk?: number;
}

export interface TrustAssumption {
  type: string;
  description: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface PrivilegedRole {
  role: string;
  capabilities: string[];
  isMultisig: boolean;
}

/**
 * Protocol Intelligence aggregator
 */
export class ProtocolIntelligence {
  private whiteclaws: WhiteClawsClient;
  private defillama: DeFiLlamaConnector;
  private cache: Map<string, { data: EnrichedProtocol; expires: number }> = new Map();
  private cacheTtl = 10 * 60 * 1000;

  constructor(whiteclawsApiKey: string) {
    this.whiteclaws = new WhiteClawsClient({ apiKey: whiteclawsApiKey });
    this.defillama = new DeFiLlamaConnector();
  }

  async getProtocol(slug: string): Promise<EnrichedProtocol> {
    const cached = this.getCached(slug);
    if (cached) return cached;

    const [whiteclawsData, defillamaData] = await Promise.allSettled([
      this.fetchWhiteclawsData(slug),
      this.fetchDeFiLlamaData(slug),
    ]);

    const enriched = await this.combineData(
      whiteclawsData.status === 'fulfilled' ? whiteclawsData.value : null,
      defillamaData.status === 'fulfilled' ? defillamaData.value : null,
      slug
    );

    this.setCached(slug, enriched);
    return enriched;
  }

  async getAttackSurface(slug: string): Promise<AttackSurface> {
    const protocol = await this.getProtocol(slug);
    
    return {
      entryPoints: this.analyzeEntryPoints(protocol),
      trustAssumptions: this.analyzeTrustAssumptions(protocol),
      privilegedRoles: [],
    };
  }

  async checkScope(
    protocolSlug: string,
    contractAddress: string,
    chain: string
  ): Promise<{ inScope: boolean; reason?: string; severity?: string }> {
    const protocol = await this.getProtocol(protocolSlug);
    
    const contract = protocol.contracts.find(
      c => c.address.toLowerCase() === contractAddress.toLowerCase() &&
           c.chain.toLowerCase() === chain.toLowerCase()
    );

    if (!contract) {
      return { inScope: false, reason: 'Contract not found' };
    }

    if (!contract.inScope) {
      return { inScope: false, reason: 'Explicitly out-of-scope' };
    }

    return { inScope: true, severity: contract.criticality };
  }

  async getHuntingTargets(protocolSlug: string, minTvl: number = 100000): Promise<ContractIntel[]> {
    const protocol = await this.getProtocol(protocolSlug);
    return protocol.contracts
      .filter(c => c.inScope && (c.tvl || 0) >= minTvl)
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  }

  clearCache(): void {
    this.cache.clear();
  }

  private getCached(slug: string): EnrichedProtocol | null {
    const entry = this.cache.get(slug);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(slug);
      return null;
    }
    return entry.data;
  }

  private setCached(slug: string, data: EnrichedProtocol): void {
    this.cache.set(slug, { data, expires: Date.now() + this.cacheTtl });
  }

  private async fetchWhiteclawsData(slug: string): Promise<Partial<EnrichedProtocol> | null> {
    try {
      const protocol = await this.whiteclaws.getProtocolIntel(slug);
      if (!protocol) return null;
      return {
        slug: protocol.slug,
        name: protocol.name,
        category: protocol.category,
        description: protocol.description,
        website: protocol.website,
        tvl: protocol.tvl,
        chainTvls: protocol.chainTvls,
        chains: protocol.chains,
        primaryChain: protocol.primaryChain,
        hasBounty: protocol.hasBounty,
        maxBounty: protocol.maxBounty,
        contracts: protocol.contracts,
        knownVulnerabilities: (protocol.knownVulnerabilities || []).map((item) => ({
          ...item,
          severity: this.normalizeSeverity(item.severity),
        })),
        audits: protocol.audits,
        riskSignals: protocol.riskSignals.map((signal) => ({
          type: signal.type,
          category: signal.signal,
          description: signal.signal,
        })),
        vulnerabilitySurface: protocol.vulnerabilitySurface,
      };
    } catch {
      return null;
    }
  }

  private async fetchDeFiLlamaData(slug: string): Promise<Partial<EnrichedProtocol> | null> {
    try {
      const protocol = await this.defillama.getProtocol(slug);
      return {
        slug: protocol.slug,
        name: protocol.name,
        category: protocol.category,
        description: protocol.description,
        website: protocol.url,
        tvl: protocol.tvl,
        chainTvls: protocol.chainTvls,
        chains: protocol.chains,
        primaryChain: protocol.chains[0],
        isFork: protocol.forkedFrom?.length > 0,
        forkedFrom: protocol.forkedFrom?.[0],
        oracles: protocol.oracles || [],
      };
    } catch {
      return null;
    }
  }

  private async combineData(
    whiteclaws: Partial<EnrichedProtocol> | null,
    defillama: Partial<EnrichedProtocol> | null,
    slug: string
  ): Promise<EnrichedProtocol> {
    const fallback: EnrichedProtocol = {
      slug,
      name: slug,
      category: 'Unknown',
      tvl: 0,
      chainTvls: {},
      chains: [],
      primaryChain: 'ethereum',
      hasBounty: false,
      contracts: [],
      knownVulnerabilities: [],
      similarProtocols: [],
      audits: [],
      riskSignals: [],
      isFork: false,
      oracles: [],
      fetchedAt: new Date(),
    };

    const merged: EnrichedProtocol = {
      ...fallback,
      ...defillama,
      ...whiteclaws,
      chains: whiteclaws?.chains || defillama?.chains || [],
      contracts: whiteclaws?.contracts || [],
      knownVulnerabilities: whiteclaws?.knownVulnerabilities || [],
      audits: whiteclaws?.audits || [],
      fetchedAt: new Date(),
    };

    merged.riskSignals = this.generateRiskSignals(merged);
    return merged;
  }

  private generateRiskSignals(protocol: EnrichedProtocol): RiskSignal[] {
    const signals: RiskSignal[] = [];

    if (protocol.tvl > 1_000_000_000) {
      signals.push({ type: 'positive', category: 'TVL', description: 'High TVL' });
    }

    if (protocol.isFork) {
      signals.push({
        type: 'neutral',
        category: 'Codebase',
        description: `Fork of ${protocol.forkedFrom}`,
      });
    }

    if (protocol.audits?.length === 0) {
      signals.push({
        type: 'negative',
        category: 'Security',
        description: 'No audits found',
        severity: 'high',
      });
    }

    return signals;
  }

  private analyzeEntryPoints(protocol: EnrichedProtocol): EntryPoint[] {
    return protocol.contracts
      .filter(c => c.inScope && c.type === 'core')
      .map(c => ({
        contract: c.address,
        function: 'deposit/withdraw',
        access: 'permissionless' as const,
        valueAtRisk: c.tvl,
      }));
  }

  private analyzeTrustAssumptions(protocol: EnrichedProtocol): TrustAssumption[] {
    const assumptions: TrustAssumption[] = [];

    if (protocol.oracles?.length > 0) {
      assumptions.push({
        type: 'Oracle',
        description: `Uses ${protocol.oracles.join(', ')}`,
        riskLevel: 'high',
      });
    }

    return assumptions;
  }

  private normalizeSeverity(value: string): 'critical' | 'high' | 'medium' | 'low' {
    if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') {
      return value;
    }
    return 'medium';
  }
}

export default ProtocolIntelligence;
