/**
 * WhiteRabbit RPC Connection Tester
 * Tests all configured RPCs for connectivity and performance
 */

import { JsonRpcProvider } from 'ethers';
import { CHAIN_CONFIGS, ChainConfig } from '../config/chains';

export interface RPCTestResult {
  chainName: string;
  chainId: number;
  rpcUrl: string;
  status: 'success' | 'failed' | 'slow';
  responseTime?: number;
  blockNumber?: number;
  error?: string;
  fallbackTested?: boolean;
  fallbackWorking?: string;
}

export class RPCTester {
  private readonly timeoutMs: number;
  private readonly slowThresholdMs: number;

  constructor(timeoutMs = 5000, slowThresholdMs = 2000) {
    this.timeoutMs = timeoutMs;
    this.slowThresholdMs = slowThresholdMs;
  }

  /**
   * Test all configured chains
   */
  async testAllChains(): Promise<RPCTestResult[]> {
    console.log('🔍 Testing all RPC connections...');
    
    const results: RPCTestResult[] = [];
    const chains = Object.entries(CHAIN_CONFIGS);
    
    // Test chains in parallel but with some batching to avoid overwhelming
    const batchSize = 5;
    for (let i = 0; i < chains.length; i += batchSize) {
      const batch = chains.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(([name, config]) => this.testChain(name, config))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Test a specific chain with fallback testing
   */
  async testChain(chainName: string, config: ChainConfig): Promise<RPCTestResult> {
    console.log(`  Testing ${chainName} (${config.chainId})...`);
    
    // Test primary RPC
    const primaryResult = await this.testSingleRPC(chainName, config.chainId, config.rpcUrl);
    
    // If primary failed, test fallbacks
    if (primaryResult.status === 'failed' && config.fallbacks.length > 0) {
      console.log(`    Primary RPC failed, testing ${config.fallbacks.length} fallbacks...`);
      
      for (const fallbackUrl of config.fallbacks) {
        const fallbackResult = await this.testSingleRPC(chainName, config.chainId, fallbackUrl);
        if (fallbackResult.status === 'success') {
          return {
            ...primaryResult,
            fallbackTested: true,
            fallbackWorking: fallbackUrl,
            status: 'success'
          };
        }
      }
      
      return {
        ...primaryResult,
        fallbackTested: true,
        fallbackWorking: undefined
      };
    }

    return primaryResult;
  }

  /**
   * Test a single RPC endpoint
   */
  async testSingleRPC(chainName: string, chainId: number, rpcUrl: string): Promise<RPCTestResult> {
    const startTime = Date.now();
    
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      
      // Set timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), this.timeoutMs);
      });
      
      // Test basic connectivity with getBlockNumber
      const blockNumberPromise = provider.getBlockNumber();
      const blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]);
      
      const responseTime = Date.now() - startTime;
      const status = responseTime > this.slowThresholdMs ? 'slow' : 'success';
      
      return {
        chainName,
        chainId,
        rpcUrl,
        status,
        responseTime,
        blockNumber
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        chainName,
        chainId,
        rpcUrl,
        status: 'failed',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test high-priority chains only (Tier 1 & 2)
   */
  async testHighPriorityChains(): Promise<RPCTestResult[]> {
    console.log('🎯 Testing high-priority chains (Tier 1 & 2)...');
    
    const highPriorityChains = Object.entries(CHAIN_CONFIGS)
      .filter(([_, config]) => config.tier <= 2 && !config.isTestnet);
    
    const results = await Promise.all(
      highPriorityChains.map(([name, config]) => this.testChain(name, config))
    );

    return results;
  }

  /**
   * Generate test report
   */
  generateReport(results: RPCTestResult[]): void {
    console.log('\n🏴‍☠️ WhiteRabbit RPC Test Report 🏴‍☠️');
    console.log('═'.repeat(50));
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    const slow = results.filter(r => r.status === 'slow');
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total Chains: ${results.length}`);
    console.log(`  ✅ Working: ${successful.length}`);
    console.log(`  🐌 Slow: ${slow.length}`);
    console.log(`  ❌ Failed: ${failed.length}`);
    console.log(`  📈 Success Rate: ${((successful.length + slow.length) / results.length * 100).toFixed(1)}%`);

    if (failed.length > 0) {
      console.log(`\n❌ Failed Chains:`);
      failed.forEach(result => {
        console.log(`  • ${result.chainName} (${result.chainId}): ${result.error}`);
        if (result.fallbackTested && !result.fallbackWorking) {
          console.log(`    └─ All fallbacks also failed`);
        }
      });
    }

    if (slow.length > 0) {
      console.log(`\n🐌 Slow Chains (>${this.slowThresholdMs}ms):`);
      slow.forEach(result => {
        console.log(`  • ${result.chainName}: ${result.responseTime}ms`);
      });
    }

    console.log(`\n⚡ Fastest Chains:`);
    const sortedBySpeed = successful
      .filter(r => r.responseTime !== undefined)
      .sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0))
      .slice(0, 5);
      
    sortedBySpeed.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.chainName}: ${result.responseTime}ms`);
    });

    console.log(`\n🎯 High-Value Chain Status:`);
    const tier1and2 = results.filter(r => {
      const config = Object.values(CHAIN_CONFIGS).find(c => c.chainId === r.chainId);
      return config && config.tier <= 2 && !config.isTestnet;
    });
    
    tier1and2.forEach(result => {
      const statusIcon = result.status === 'success' ? '✅' : 
                        result.status === 'slow' ? '🐌' : '❌';
      console.log(`  ${statusIcon} ${result.chainName}: ${result.responseTime}ms`);
    });

    console.log('\n🐇 WhiteRabbit army ready for multi-chain hunting!\n');
  }

  /**
   * Get working chains only
   */
  getWorkingChains(results: RPCTestResult[]): RPCTestResult[] {
    return results.filter(r => r.status === 'success' || r.status === 'slow');
  }

  /**
   * Get recommended RPC for a chain (primary or working fallback)
   */
  getRecommendedRPC(chainName: string, results: RPCTestResult[]): string | undefined {
    const result = results.find(r => r.chainName === chainName);
    if (!result) return undefined;
    
    if (result.status === 'success' || result.status === 'slow') {
      return result.rpcUrl;
    }
    
    return result.fallbackWorking;
  }
}

/**
 * Quick test of essential chains
 */
export async function quickTest(): Promise<void> {
  const tester = new RPCTester(3000, 1500); // Faster for quick test
  
  const essentialChains = ['ethereum', 'base', 'arbitrum', 'polygon', 'bsc'];
  const results: RPCTestResult[] = [];
  
  for (const chainName of essentialChains) {
    const config = CHAIN_CONFIGS[chainName];
    if (config) {
      const result = await tester.testChain(chainName, config);
      results.push(result);
    }
  }
  
  console.log('\n🚀 Quick RPC Test Results:');
  results.forEach(result => {
    const status = result.status === 'success' ? '✅' : 
                  result.status === 'slow' ? '🐌' : '❌';
    console.log(`  ${status} ${result.chainName}: ${result.responseTime}ms`);
  });
}

// Export singleton instance
export const rpcTester = new RPCTester();