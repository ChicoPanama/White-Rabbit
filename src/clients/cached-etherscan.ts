import { EtherscanClient } from './etherscan.js';
import CacheManager from '../../cache/CacheManager.js';
import * as crypto from 'crypto';

/**
 * Enhanced Etherscan client with RPC response caching
 * Eliminates redundant blockchain calls and contract fetches
 */
export class CachedEtherscanClient extends EtherscanClient {
  private cache = CacheManager;

  constructor(apiKey: string, requestIntervalMs = 200) {
    super(apiKey, requestIntervalMs);
  }

  /**
   * Get contract source code with caching
   * Contracts are immutable once deployed, so cache permanently
   */
  async getContractSourceCode(chain: string, address: string): Promise<any> {
    const startTime = Date.now();
    
    // Check if contract is already cached
    const cachedContract = await this.cache.getCachedContract(address, chain);
    
    if (cachedContract && cachedContract.source_code) {
      const responseTime = Date.now() - startTime;
      this.cache.recordCacheHit('contract', responseTime);
      
      console.log(`🎯 Contract cache hit: ${address} on ${chain} (${responseTime}ms)`);
      
      return {
        sourceCode: cachedContract.source_code,
        abi: null, // Would need to parse from source_code if needed
        contractName: null,
        compilerVersion: cachedContract.compiler_version,
        optimizationUsed: null,
        runs: null,
        constructorArguments: null,
        evmVersion: null,
        library: null,
        licenseType: null,
        proxy: null,
        implementation: null,
        swarmSource: null
      };
    }

    // Cache miss - fetch from Etherscan
    this.cache.recordCacheMiss('contract');
    console.log(`📡 Contract cache miss: fetching ${address} from Etherscan...`);
    
    const result = await super.getContractSourceCode(chain, address);
    
    // Cache the contract source (permanent cache for immutable contracts)
    if (result && result.sourceCode) {
      await this.cache.cacheContractAnalysis(address, chain, {
        bytecode: result.sourceCode,
        sourceVerified: true,
        sourceCode: result.sourceCode,
        compilerVersion: result.compilerVersion,
        results: null, // No analysis results yet
        vulnCount: 0,
        riskScore: 0,
        exploitableValue: 0
      });
      
      console.log(`✅ Cached contract source: ${address} on ${chain}`);
    }
    
    return result;
  }

  /**
   * Get contract ABI with caching
   */
  async getContractAbi(chain: string, address: string): Promise<any[]> {
    // Check cache first
    const cacheKey = `abi:${chain}:${address}`;
    const cachedResponse = await this.cache.getCachedRPCResponse(chain, 'getContractAbi', { address });
    
    if (cachedResponse) {
      console.log(`🎯 ABI cache hit: ${address}`);
      return cachedResponse;
    }

    // Fetch from API and cache
    const abi = await super.getContractAbi(chain, address);
    
    // Cache ABI with long TTL (contracts don't change)
    if (abi) {
      await this.cache.cacheRPCResponse(chain, 'getContractAbi', { address }, abi, 86400); // 24h TTL
      console.log(`✅ Cached ABI: ${address}`);
    }
    
    return abi;
  }

  /**
   * Get transaction details with short-term caching
   */
  async getTransaction(chain: string, txHash: string): Promise<any> {
    const cachedResponse = await this.cache.getCachedRPCResponse(chain, 'getTransaction', { txHash });
    
    if (cachedResponse) {
      console.log(`🎯 Transaction cache hit: ${txHash}`);
      return cachedResponse;
    }

    const tx = await super.getTransaction(chain, txHash);
    
    if (tx) {
      // Cache transactions with shorter TTL (15 minutes)
      await this.cache.cacheRPCResponse(chain, 'getTransaction', { txHash }, tx, 900);
      console.log(`✅ Cached transaction: ${txHash}`);
    }
    
    return tx;
  }

  /**
   * Batch get contract information with optimized caching
   */
  async batchGetContracts(chain: string, addresses: string[]): Promise<Map<string, any>> {
    const results = new Map();
    const uncachedAddresses: string[] = [];
    
    // Check cache for all addresses first
    for (const address of addresses) {
      const cached = await this.cache.getCachedContract(address, chain);
      if (cached) {
        results.set(address, cached);
        this.cache.recordCacheHit('contract', 10); // Fast cache hit
      } else {
        uncachedAddresses.push(address);
      }
    }
    
    console.log(`🎯 Contract batch: ${results.size} cache hits, ${uncachedAddresses.length} API calls needed`);
    
    // Fetch uncached contracts
    const batchPromises = uncachedAddresses.map(async (address) => {
      try {
        const contract = await this.getContractSourceCode(chain, address);
        if (contract) {
          results.set(address, contract);
        }
      } catch (error) {
        console.error(`❌ Failed to fetch contract ${address}:`, error);
      }
    });
    
    await Promise.allSettled(batchPromises);
    
    return results;
  }

  /**
   * Intelligent cache preheating for known protocol contracts
   */
  async preheatProtocolContracts(chain: string, protocolAddresses: string[]): Promise<void> {
    console.log(`🔥 Preheating contract cache for ${protocolAddresses.length} addresses...`);
    
    const uncachedAddresses = [];
    for (const address of protocolAddresses) {
      const cached = await this.cache.getCachedContract(address, chain);
      if (!cached) {
        uncachedAddresses.push(address);
      }
    }
    
    if (uncachedAddresses.length === 0) {
      console.log('✅ All contracts already cached');
      return;
    }
    
    console.log(`📡 Fetching ${uncachedAddresses.length} uncached contracts...`);
    
    // Batch fetch with rate limiting
    const batchSize = 5; // Respect API rate limits
    for (let i = 0; i < uncachedAddresses.length; i += batchSize) {
      const batch = uncachedAddresses.slice(i, i + batchSize);
      await Promise.all(
        batch.map(address => this.getContractSourceCode(chain, address))
      );
      
      // Rate limiting delay
      if (i + batchSize < uncachedAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('✅ Contract cache preheating completed');
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): any {
    return this.cache.getCacheStats();
  }
}

export default CachedEtherscanClient;