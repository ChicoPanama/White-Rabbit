// ═══════════════════════════════════════════════════════════════════════════════
// Chain Connector - Multi-chain RPC with failover
// Supports 30+ chains with PublicNode defaults
// ═══════════════════════════════════════════════════════════════════════════════

import { Contract, ChainConfig, ScannerError } from '../types.js';

export interface RPCConfig {
  url: string;
  timeout?: number;
  retries?: number;
}

export interface ChainConnection {
  chain: ChainConfig;
  provider: any; // ethers.JsonRpcProvider
  blockNumber: number;
  latency: number;
}

// Default RPC endpoints (PublicNode - free, reliable)
const DEFAULT_RPCS: Record<number, string[]> = {
  1: [        // Ethereum
    'https://ethereum.publicnode.com',
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
  ],
  8453: [     // Base
    'https://base.publicnode.com',
    'https://base.llamarpc.com',
    'https://mainnet.base.org',
  ],
  42161: [    // Arbitrum
    'https://arbitrum.publicnode.com',
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
  ],
  10: [       // Optimism
    'https://optimism.publicnode.com',
    'https://mainnet.optimism.io',
    'https://rpc.ankr.com/optimism',
  ],
  137: [      // Polygon
    'https://polygon.publicnode.com',
    'https://polygon.llamarpc.com',
    'https://rpc.ankr.com/polygon',
  ],
  56: [       // BSC
    'https://bsc.publicnode.com',
    'https://bsc-dataseed.binance.org',
    'https://rpc.ankr.com/bsc',
  ],
  43114: [    // Avalanche
    'https://avalanche.publicnode.com',
    'https://api.avax.network/ext/bc/C/rpc',
    'https://rpc.ankr.com/avalanche',
  ],
  250: [      // Fantom
    'https://fantom.publicnode.com',
    'https://rpc.ftm.tools',
    'https://rpc.ankr.com/fantom',
  ],
  59144: [    // Linea
    'https://linea.publicnode.com',
    'https://rpc.linea.build',
  ],
  534352: [   // Scroll
    'https://scroll.publicnode.com',
    'https://rpc.scroll.io',
  ],
  81457: [    // Blast
    'https://blast.publicnode.com',
    'https://rpc.blast.io',
  ],
  100: [      // Gnosis
    'https://gnosis.publicnode.com',
    'https://rpc.gnosischain.com',
  ],
  7777777: [  // Zora
    'https://rpc.zora.energy',
  ],
  84532: [    // Base Sepolia
    'https://base-sepolia.publicnode.com',
  ],
  11155111: [ // Sepolia
    'https://ethereum-sepolia.publicnode.com',
  ],
  421614: [   // Arbitrum Sepolia
    'https://arbitrum-sepolia.publicnode.com',
  ],
  11155420: [ // Optimism Sepolia
    'https://optimism-sepolia.publicnode.com',
  ],
  80002: [    // Polygon Amoy
    'https://polygon-amoy.publicnode.com',
  ],
  97: [       // BSC Testnet
    'https://bsc-testnet.publicnode.com',
  ],
  43113: [    // Avalanche Fuji
    'https://avalanche-fuji.publicnode.com',
  ],
  4002: [     // Fantom Testnet
    'https://fantom-testnet.publicnode.com',
  ],
  59141: [    // Linea Sepolia
    'https://linea-sepolia.publicnode.com',
  ],
  534351: [   // Scroll Sepolia
    'https://scroll-sepolia.publicnode.com',
  ],
  168587773: [ // Blast Sepolia
    'https://blast-sepolia.publicnode.com',
  ],
  10200: [    // Gnosis Chiado
    'https://gnosis-chiado.publicnode.com',
  ],
  324: [      // zkSync Era
    'https://mainnet.era.zksync.io',
    'https://zksync-era.publicnode.com',
  ],
  1101: [     // Polygon zkEVM
    'https://zkevm-rpc.com',
    'https://polygon-zkevm.publicnode.com',
  ],
  5000: [     // Mantle
    'https://rpc.mantle.xyz',
  ],
  1329: [     // Sei
    'https://evm-rpc.sei-apis.com',
  ],
  42220: [    // Celo
    'https://forno.celo.org',
    'https://celo.publicnode.com',
  ],
};

// Chain metadata
export const CHAIN_METADATA: Record<number, { name: string; symbol: string; decimals: number; blockTimeSec: number }> = {
  1: { name: 'Ethereum', symbol: 'ETH', decimals: 18, blockTimeSec: 12 },
  8453: { name: 'Base', symbol: 'ETH', decimals: 18, blockTimeSec: 2 },
  42161: { name: 'Arbitrum', symbol: 'ETH', decimals: 18, blockTimeSec: 0.25 },
  10: { name: 'Optimism', symbol: 'ETH', decimals: 18, blockTimeSec: 2 },
  137: { name: 'Polygon', symbol: 'MATIC', decimals: 18, blockTimeSec: 2 },
  56: { name: 'BSC', symbol: 'BNB', decimals: 18, blockTimeSec: 3 },
  43114: { name: 'Avalanche', symbol: 'AVAX', decimals: 18, blockTimeSec: 2 },
  250: { name: 'Fantom', symbol: 'FTM', decimals: 18, blockTimeSec: 1 },
  59144: { name: 'Linea', symbol: 'ETH', decimals: 18, blockTimeSec: 12 },
  534352: { name: 'Scroll', symbol: 'ETH', decimals: 18, blockTimeSec: 3 },
  81457: { name: 'Blast', symbol: 'ETH', decimals: 18, blockTimeSec: 2 },
  100: { name: 'Gnosis', symbol: 'xDAI', decimals: 18, blockTimeSec: 5 },
};

/**
 * Multi-chain RPC connector with automatic failover
 */
export class ChainConnector {
  private connections: Map<number, ChainConnection> = new Map();
  private customRPCs: Map<number, string[]> = new Map();
  private defaultTimeout = 10000;
  private maxRetries = 3;

  constructor(customRPCs?: Record<number, string[]>) {
    if (customRPCs) {
      for (const [chainId, urls] of Object.entries(customRPCs)) {
        this.customRPCs.set(parseInt(chainId), urls);
      }
    }
  }

  /**
   * Connect to a chain with automatic failover
   */
  async connect(chainId: number): Promise<ChainConnection> {
    // Return cached connection if valid
    const cached = this.connections.get(chainId);
    if (cached) {
      try {
        // Verify connection is still alive
        await cached.provider.getBlockNumber();
        return cached;
      } catch {
        // Connection dead, remove from cache
        this.connections.delete(chainId);
      }
    }

    // Get RPC list for this chain
    const rpcs = this.getRPCList(chainId);
    if (!rpcs || rpcs.length === 0) {
      throw new ScannerError(
        `No RPC configured for chain ${chainId}`,
        'CHAIN_NOT_SUPPORTED'
      );
    }

    // Try each RPC in order
    const errors: string[] = [];
    
    for (const url of rpcs) {
      try {
        const connection = await this.testConnection(chainId, url);
        this.connections.set(chainId, connection);
        return connection;
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new ScannerError(
      `Failed to connect to chain ${chainId}. All RPCs failed:\n${errors.join('\n')}`,
      'RPC_CONNECTION_FAILED'
    );
  }

  /**
   * Get contract bytecode
   */
  async getBytecode(address: string, chainId: number): Promise<string> {
    const connection = await this.connect(chainId);
    const code = await connection.provider.getCode(address);
    return code;
  }

  /**
   * Get contract balance
   */
  async getBalance(address: string, chainId: number): Promise<bigint> {
    const connection = await this.connect(chainId);
    const balance = await connection.provider.getBalance(address);
    return balance;
  }

  /**
   * Get current block number
   */
  async getBlockNumber(chainId: number): Promise<number> {
    const connection = await this.connect(chainId);
    return await connection.provider.getBlockNumber();
  }

  /**
   * Get block by number
   */
  async getBlock(chainId: number, blockNumber: number | 'latest' = 'latest') {
    const connection = await this.connect(chainId);
    return await connection.provider.getBlock(blockNumber);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string, chainId: number) {
    const connection = await this.connect(chainId);
    return await connection.provider.getTransactionReceipt(txHash);
  }

  /**
   * Get token balance (ERC20)
   */
  async getTokenBalance(
    tokenAddress: string,
    holderAddress: string,
    chainId: number
  ): Promise<bigint> {
    const connection = await this.connect(chainId);
    
    // ERC20 balanceOf selector: 0x70a08231
    const data = `0x70a08231000000000000000000000000${holderAddress.slice(2)}`;
    
    const result = await connection.provider.call({
      to: tokenAddress,
      data,
    });
    
    return BigInt(result);
  }

  /**
   * Get native currency symbol for chain
   */
  getNativeSymbol(chainId: number): string {
    return CHAIN_METADATA[chainId]?.symbol || 'ETH';
  }

  /**
   * Get chain name
   */
  getChainName(chainId: number): string {
    return CHAIN_METADATA[chainId]?.name || `Chain ${chainId}`;
  }

  /**
   * Check if chain is supported
   */
  isSupported(chainId: number): boolean {
    return !!DEFAULT_RPCS[chainId] || this.customRPCs.has(chainId);
  }

  /**
   * Get all supported chain IDs
   */
  getSupportedChains(): number[] {
    const chains = new Set([
      ...Object.keys(DEFAULT_RPCS).map(Number),
      ...this.customRPCs.keys(),
    ]);
    return Array.from(chains).sort((a, b) => a - b);
  }

  /**
   * Add custom RPC for a chain
   */
  addCustomRPC(chainId: number, url: string): void {
    const existing = this.customRPCs.get(chainId) || [];
    this.customRPCs.set(chainId, [url, ...existing]);
    // Clear cached connection to force reconnect
    this.connections.delete(chainId);
  }

  /**
   * Close all connections
   */
  async disconnect(): Promise<void> {
    this.connections.clear();
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════════════════════════

  private getRPCList(chainId: number): string[] {
    // Custom RPCs take precedence
    const custom = this.customRPCs.get(chainId);
    if (custom && custom.length > 0) {
      return custom;
    }
    
    // Fall back to defaults
    return DEFAULT_RPCS[chainId] || [];
  }

  private async testConnection(chainId: number, url: string): Promise<ChainConnection> {
    const startTime = Date.now();
    
    // Dynamic import ethers to avoid issues
    const { ethers } = await import('ethers');
    
    const provider = new ethers.JsonRpcProvider(url, {
      name: this.getChainName(chainId),
      chainId,
    });

    // Test connection with timeout
    const blockNumber = await Promise.race([
      provider.getBlockNumber(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), this.defaultTimeout)
      ),
    ]);

    const latency = Date.now() - startTime;

    return {
      chain: {
        id: chainId,
        name: this.getChainName(chainId).toLowerCase(),
        rpcUrl: url,
        explorerUrl: '', // Not needed for connector
        nativeCurrency: {
          name: this.getChainName(chainId),
          symbol: this.getNativeSymbol(chainId),
          decimals: 18,
        },
      },
      provider,
      blockNumber,
      latency,
    };
  }
}

export default ChainConnector;
