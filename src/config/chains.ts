/**
 * WhiteRabbit Chain Configuration
 * Comprehensive EVM chain support with fallback RPCs
 */

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  wsUrl?: string;
  fallbacks: string[];
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  tier: 1 | 2 | 3 | 4 | 5;
  tvl?: string;
  isTestnet?: boolean;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  // ============================================
  // TIER 1 - MAJOR L1s (Highest TVL)
  // ============================================
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com',
    wsUrl: process.env.ETH_RPC_WS || 'wss://ethereum-rpc.publicnode.com',
    fallbacks: [
      process.env.ETH_RPC_FALLBACK_1 || 'https://eth.llamarpc.com',
      process.env.ETH_RPC_FALLBACK_2 || 'https://rpc.ankr.com/eth',
      process.env.ETH_RPC_FALLBACK_3 || 'https://1rpc.io/eth'
    ],
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 1,
    tvl: '$70B+'
  },

  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com',
    wsUrl: process.env.BSC_RPC_WS || 'wss://bsc-rpc.publicnode.com',
    fallbacks: [
      process.env.BSC_RPC_FALLBACK_1 || 'https://bsc-dataseed.binance.org',
      process.env.BSC_RPC_FALLBACK_2 || 'https://rpc.ankr.com/bsc'
    ],
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    tier: 1,
    tvl: '$5B+'
  },

  avalanche: {
    chainId: 43114,
    name: 'Avalanche',
    rpcUrl: process.env.AVAX_RPC_URL || 'https://avalanche-c-chain-rpc.publicnode.com',
    wsUrl: process.env.AVAX_RPC_WS || 'wss://avalanche-c-chain-rpc.publicnode.com',
    fallbacks: [
      process.env.AVAX_RPC_FALLBACK_1 || 'https://api.avax.network/ext/bc/C/rpc',
      process.env.AVAX_RPC_FALLBACK_2 || 'https://rpc.ankr.com/avalanche'
    ],
    blockExplorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
    tier: 1,
    tvl: '$2B+'
  },

  // ============================================
  // TIER 2 - MAJOR L2s (High TVL)
  // ============================================
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
    wsUrl: process.env.BASE_RPC_WS || 'wss://base-rpc.publicnode.com',
    fallbacks: [
      process.env.BASE_RPC_FALLBACK_1 || 'https://mainnet.base.org',
      process.env.BASE_RPC_FALLBACK_2 || 'https://base.llamarpc.com'
    ],
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 2,
    tvl: '$4.8B'
  },

  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: process.env.ARB_RPC_URL || 'https://arbitrum-one-rpc.publicnode.com',
    wsUrl: process.env.ARB_RPC_WS || 'wss://arbitrum-one-rpc.publicnode.com',
    fallbacks: [
      process.env.ARB_RPC_FALLBACK_1 || 'https://arb1.arbitrum.io/rpc',
      process.env.ARB_RPC_FALLBACK_2 || 'https://rpc.ankr.com/arbitrum'
    ],
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 2,
    tvl: '$2.9B'
  },

  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
    wsUrl: process.env.POLYGON_RPC_WS || 'wss://polygon-bor-rpc.publicnode.com',
    fallbacks: [
      process.env.POLYGON_RPC_FALLBACK_1 || 'https://polygon-rpc.com',
      process.env.POLYGON_RPC_FALLBACK_2 || 'https://rpc.ankr.com/polygon'
    ],
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    tier: 2,
    tvl: '$1.2B'
  },

  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: process.env.OP_RPC_URL || 'https://optimism-rpc.publicnode.com',
    wsUrl: process.env.OP_RPC_WS || 'wss://optimism-rpc.publicnode.com',
    fallbacks: [
      process.env.OP_RPC_FALLBACK_1 || 'https://mainnet.optimism.io',
      process.env.OP_RPC_FALLBACK_2 || 'https://rpc.ankr.com/optimism'
    ],
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 2,
    tvl: '$800M+'
  },

  // ============================================
  // TIER 3 - EMERGING L2s & ALT-L1s
  // ============================================
  linea: {
    chainId: 59144,
    name: 'Linea',
    rpcUrl: process.env.LINEA_RPC_URL || 'https://linea-rpc.publicnode.com',
    wsUrl: process.env.LINEA_RPC_WS || 'wss://linea-rpc.publicnode.com',
    fallbacks: ['https://rpc.linea.build'],
    blockExplorer: 'https://lineascan.build',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 3
  },

  scroll: {
    chainId: 534352,
    name: 'Scroll',
    rpcUrl: process.env.SCROLL_RPC_URL || 'https://scroll-rpc.publicnode.com',
    wsUrl: process.env.SCROLL_RPC_WS || 'wss://scroll-rpc.publicnode.com',
    fallbacks: ['https://rpc.scroll.io'],
    blockExplorer: 'https://scrollscan.com',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 3
  },

  blast: {
    chainId: 81457,
    name: 'Blast',
    rpcUrl: process.env.BLAST_RPC_URL || 'https://blast-rpc.publicnode.com',
    wsUrl: process.env.BLAST_RPC_WS || 'wss://blast-rpc.publicnode.com',
    fallbacks: ['https://rpc.blast.io'],
    blockExplorer: 'https://blastscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 3
  },

  mantle: {
    chainId: 5000,
    name: 'Mantle',
    rpcUrl: process.env.MANTLE_RPC_URL || 'https://mantle-rpc.publicnode.com',
    wsUrl: process.env.MANTLE_RPC_WS || 'wss://mantle-rpc.publicnode.com',
    fallbacks: ['https://rpc.mantle.xyz'],
    blockExplorer: 'https://mantlescan.info',
    nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
    tier: 3
  },

  gnosis: {
    chainId: 100,
    name: 'Gnosis',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://gnosis-rpc.publicnode.com',
    wsUrl: process.env.GNOSIS_RPC_WS || 'wss://gnosis-rpc.publicnode.com',
    fallbacks: ['https://rpc.gnosischain.com'],
    blockExplorer: 'https://gnosisscan.io',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    tier: 3
  },

  cronos: {
    chainId: 25,
    name: 'Cronos',
    rpcUrl: process.env.CRONOS_RPC_URL || 'https://cronos-evm-rpc.publicnode.com',
    wsUrl: process.env.CRONOS_RPC_WS || 'wss://cronos-evm-rpc.publicnode.com',
    fallbacks: ['https://evm.cronos.org'],
    blockExplorer: 'https://cronoscan.com',
    nativeCurrency: { name: 'CRO', symbol: 'CRO', decimals: 18 },
    tier: 3
  },

  // ============================================
  // TIER 4 - NEW/EMERGING CHAINS
  // ============================================
  sonic: {
    chainId: 146,
    name: 'Sonic',
    rpcUrl: process.env.SONIC_RPC_URL || 'https://sonic-rpc.publicnode.com',
    wsUrl: process.env.SONIC_RPC_WS || 'wss://sonic-rpc.publicnode.com',
    fallbacks: [],
    blockExplorer: 'https://sonicscan.org',
    nativeCurrency: { name: 'S', symbol: 'S', decimals: 18 },
    tier: 4
  },

  taiko: {
    chainId: 167000,
    name: 'Taiko',
    rpcUrl: process.env.TAIKO_RPC_URL || 'https://taiko-rpc.publicnode.com',
    wsUrl: process.env.TAIKO_RPC_WS || 'wss://taiko-rpc.publicnode.com',
    fallbacks: ['https://rpc.mainnet.taiko.xyz'],
    blockExplorer: 'https://taikoscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 4
  },

  unichain: {
    chainId: 130,
    name: 'Unichain',
    rpcUrl: process.env.UNICHAIN_RPC_URL || 'https://unichain-rpc.publicnode.com',
    wsUrl: process.env.UNICHAIN_RPC_WS || 'wss://unichain-rpc.publicnode.com',
    fallbacks: [],
    blockExplorer: 'https://uniscan.xyz',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    tier: 4
  },

  // ============================================
  // TESTNETS
  // ============================================
  sepolia: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    wsUrl: process.env.SEPOLIA_RPC_WS || 'wss://ethereum-sepolia-rpc.publicnode.com',
    fallbacks: ['https://sepolia.infura.io/v3/YOUR_KEY'],
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    tier: 5,
    isTestnet: true
  },

  baseSepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
    fallbacks: ['https://sepolia.base.org'],
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    tier: 5,
    isTestnet: true
  }
};

/**
 * Get chain key from display name (e.g., "Arbitrum One" -> "arbitrum")
 */
export function getChainKey(nameOrKey: string): string | undefined {
  const lower = nameOrKey.toLowerCase();
  // Direct key match
  if (CHAIN_CONFIGS[lower]) {
    return lower;
  }
  // Search by display name
  for (const [key, config] of Object.entries(CHAIN_CONFIGS)) {
    if (config.name.toLowerCase() === lower) {
      return key;
    }
  }
  return undefined;
}

/**
 * Get chain configuration by name or ID
 */
export function getChainConfig(chainIdentifier: string | number): ChainConfig | undefined {
  if (typeof chainIdentifier === 'string') {
    // Try direct key lookup first
    if (CHAIN_CONFIGS[chainIdentifier]) {
      return CHAIN_CONFIGS[chainIdentifier];
    }
    // Try lowercase key
    if (CHAIN_CONFIGS[chainIdentifier.toLowerCase()]) {
      return CHAIN_CONFIGS[chainIdentifier.toLowerCase()];
    }
    // Try matching by display name
    const key = getChainKey(chainIdentifier);
    if (key) {
      return CHAIN_CONFIGS[key];
    }
    return undefined;
  }

  return Object.values(CHAIN_CONFIGS).find(config => config.chainId === chainIdentifier);
}

/**
 * Get all chains by tier
 */
export function getChainsByTier(tier: 1 | 2 | 3 | 4 | 5): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(config => config.tier === tier);
}

/**
 * Get production chains (exclude testnets)
 */
export function getProductionChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(config => !config.isTestnet);
}

/**
 * Get high-value chains (Tier 1 & 2)
 */
export function getHighValueChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(config => 
    !config.isTestnet && (config.tier === 1 || config.tier === 2)
  );
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.values(CHAIN_CONFIGS).map(config => config.chainId);
}

/**
 * Get chain registry for dynamic loading
 */
export function getChainRegistry(): string {
  return process.env.CHAIN_REGISTRY || 
    Object.entries(CHAIN_CONFIGS)
      .filter(([_, config]) => !config.isTestnet)
      .map(([name, config]) => `${name}:${config.chainId}:${config.rpcUrl}`)
      .join(',');
}

export default CHAIN_CONFIGS;