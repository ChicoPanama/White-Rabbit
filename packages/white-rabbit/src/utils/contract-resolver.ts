// ═══════════════════════════════════════════════════════════════════════════════
// ContractResolver - Resolves contract metadata from Etherscan/block explorers
// ═══════════════════════════════════════════════════════════════════════════════

import { Contract, ContractMetadata, ChainConfig, getChainConfig } from '../types.js';
import { ulid } from 'ulid';

export interface ResolverConfig {
  etherscanApiKey?: string;
  requestIntervalMs?: number;
}

export interface EtherscanSourceResult {
  ContractName: string;
  SourceCode: string;
  ABI: string;
  CompilerVersion: string;
  Proxy: string;
  Implementation: string;
}

/**
 * Resolves contract information from blockchain explorers
 */
export class ContractResolver {
  private apiKey: string;
  private requestIntervalMs: number;
  private lastRequestTime = 0;

  constructor(config: ResolverConfig = {}) {
    this.apiKey = config.etherscanApiKey || process.env.ETHERSCAN_API_KEY || '';
    this.requestIntervalMs = config.requestIntervalMs || 200;
  }

  /**
   * Resolve a contract by address
   */
  async resolve(address: string, chainId: number): Promise<Contract | null> {
    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new Error(`Unknown chain ID: ${chainId}`);
    }

    // Rate limit
    await this.rateLimit();

    // Fetch from Etherscan API
    const url = this.buildApiUrl(address, chain);
    
    try {
      const response = await fetch(url);
      const data = await response.json() as { status: string; result: EtherscanSourceResult[]; message?: string };

      if (data.status !== '1' || !data.result || data.result[0].SourceCode === '') {
        return null; // Not verified
      }

      const result = data.result[0];
      return this.parseContract(address, chainId, result);
    } catch (error) {
      console.error('Failed to resolve contract:', error);
      return null;
    }
  }

  /**
   * Get contract metadata without full source
   */
  async getMetadata(address: string, chainId: number): Promise<ContractMetadata | null> {
    const contract = await this.resolve(address, chainId);
    if (!contract) return null;

    return {
      name: contract.name,
      isProxy: contract.isProxy,
      implementationAddress: contract.implementationAddress || undefined,
      compilerVersion: contract.compilerVersion,
    };
  }

  /**
   * Check if a contract is verified
   */
  async isVerified(address: string, chainId: number): Promise<boolean> {
    const chain = getChainConfig(chainId);
    if (!chain) return false;

    await this.rateLimit();

    const url = this.buildApiUrl(address, chain);
    
    try {
      const response = await fetch(url);
      const data = await response.json() as { status: string; result: EtherscanSourceResult[] };
      return data.status === '1' && data.result && data.result[0].SourceCode !== '';
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private buildApiUrl(address: string, chain: ChainConfig): string {
    const baseUrl = chain.etherscanApiUrl || 'https://api.etherscan.io/api';
    return `${baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${this.apiKey}`;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.requestIntervalMs) {
      await sleep(this.requestIntervalMs - elapsed);
    }
    
    this.lastRequestTime = Date.now();
  }

  private parseContract(
    address: string,
    chainId: number,
    result: EtherscanSourceResult
  ): Contract {
    // Handle proxy contracts
    let sourceCode = result.SourceCode;
    const isProxy = result.Proxy === '1';
    const implementationAddress = result.Implementation || null;

    // Handle multi-file sources (wrapped in {{ }})
    if (sourceCode.startsWith('{{') && sourceCode.endsWith('}}')) {
      try {
        const parsed = JSON.parse(sourceCode.slice(1, -1));
        if (parsed.sources) {
          // Concatenate all sources
          sourceCode = Object.values(parsed.sources)
            .map((s: unknown) => (s as { content: string }).content)
            .join('\n');
        }
      } catch {
        // Keep original if parsing fails
      }
    }

    return {
      id: ulid(),
      address: address.toLowerCase(),
      chainId,
      name: result.ContractName || 'Unknown',
      sourceCode,
      abi: JSON.parse(result.ABI || '[]'),
      compilerVersion: result.CompilerVersion,
      isProxy,
      implementationAddress,
      tvlUsd: null,
      protocolName: null,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
