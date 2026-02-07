/**
 * Central multi-chain registry for hunt-forks cascade mode.
 *
 * Provides a unified registry of 20+ EVM chains with RPC endpoints,
 * block explorer APIs, and DeFiLlama slugs. Supports custom chains via config.
 */

import { getChainConfig as getExistingChainConfig, getProductionChains } from '../config/chains.js';

// ── Types ──

export interface HuntChainConfig {
  id: string;                       // e.g. 'ethereum', 'base'
  name: string;                     // Display name
  chainId: number;                  // EVM chain ID
  rpcEndpoints: string[];           // PublicNode + configured RPCs
  explorerApiUrl: string;           // Etherscan-compatible API base
  explorerApiKeyEnv?: string;       // env var name for API key
  explorerType: 'etherscan' | 'blockscout' | 'custom';
  tvlSource?: string;               // DeFiLlama chain slug
  enabled: boolean;
}

export interface CustomChainInput {
  id: string;
  name: string;
  chainId: number;
  rpc_endpoints: string[];
  explorer_api_url: string;
  explorer_type?: 'etherscan' | 'blockscout' | 'custom';
  explorer_api_key_env?: string;
  tvl_source?: string;
}

// ── Built-in Chain Definitions ──

const BUILT_IN_CHAINS: HuntChainConfig[] = [
  // Tier 1: Major L1s / L2s
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcEndpoints: ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth'],
    explorerApiUrl: 'https://api.etherscan.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Ethereum',
    enabled: true,
  },
  {
    id: 'bsc',
    name: 'BNB Chain',
    chainId: 56,
    rpcEndpoints: ['https://bsc-rpc.publicnode.com', 'https://rpc.ankr.com/bsc'],
    explorerApiUrl: 'https://api.bscscan.com/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'BSC',
    enabled: true,
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    chainId: 42161,
    rpcEndpoints: ['https://arbitrum-one-rpc.publicnode.com', 'https://rpc.ankr.com/arbitrum'],
    explorerApiUrl: 'https://api.arbiscan.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Arbitrum',
    enabled: true,
  },
  {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    rpcEndpoints: ['https://base-rpc.publicnode.com', 'https://rpc.ankr.com/base'],
    explorerApiUrl: 'https://api.basescan.org/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Base',
    enabled: true,
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    rpcEndpoints: ['https://polygon-bor-rpc.publicnode.com', 'https://rpc.ankr.com/polygon'],
    explorerApiUrl: 'https://api.polygonscan.com/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Polygon',
    enabled: true,
  },
  {
    id: 'optimism',
    name: 'Optimism',
    chainId: 10,
    rpcEndpoints: ['https://optimism-rpc.publicnode.com', 'https://rpc.ankr.com/optimism'],
    explorerApiUrl: 'https://api-optimistic.etherscan.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Optimism',
    enabled: true,
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    chainId: 43114,
    rpcEndpoints: ['https://avalanche-c-chain-rpc.publicnode.com', 'https://rpc.ankr.com/avalanche'],
    explorerApiUrl: 'https://api.snowtrace.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Avalanche',
    enabled: true,
  },
  // Tier 2: Emerging L2s
  {
    id: 'blast',
    name: 'Blast',
    chainId: 81457,
    rpcEndpoints: ['https://blast-rpc.publicnode.com', 'https://rpc.ankr.com/blast'],
    explorerApiUrl: 'https://api.blastscan.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Blast',
    enabled: true,
  },
  {
    id: 'linea',
    name: 'Linea',
    chainId: 59144,
    rpcEndpoints: ['https://linea-rpc.publicnode.com', 'https://rpc.linea.build'],
    explorerApiUrl: 'https://api.lineascan.build/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Linea',
    enabled: true,
  },
  {
    id: 'scroll',
    name: 'Scroll',
    chainId: 534352,
    rpcEndpoints: ['https://scroll-rpc.publicnode.com', 'https://rpc.ankr.com/scroll'],
    explorerApiUrl: 'https://api.scrollscan.com/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Scroll',
    enabled: true,
  },
  {
    id: 'mantle',
    name: 'Mantle',
    chainId: 5000,
    rpcEndpoints: ['https://mantle-rpc.publicnode.com', 'https://rpc.mantle.xyz'],
    explorerApiUrl: 'https://api.mantlescan.xyz/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Mantle',
    enabled: true,
  },
  {
    id: 'zksync',
    name: 'zkSync Era',
    chainId: 324,
    rpcEndpoints: ['https://zksync-era-rpc.publicnode.com', 'https://mainnet.era.zksync.io'],
    explorerApiUrl: 'https://block-explorer-api.mainnet.zksync.io/api',
    explorerType: 'blockscout',
    tvlSource: 'zkSync Era',
    enabled: true,
  },
  {
    id: 'polygon-zkevm',
    name: 'Polygon zkEVM',
    chainId: 1101,
    rpcEndpoints: ['https://polygon-zkevm-rpc.publicnode.com', 'https://zkevm-rpc.com'],
    explorerApiUrl: 'https://api-zkevm.polygonscan.com/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Polygon zkEVM',
    enabled: true,
  },
  // Tier 3: Smaller / Niche chains
  {
    id: 'fantom',
    name: 'Fantom',
    chainId: 250,
    rpcEndpoints: ['https://fantom-rpc.publicnode.com', 'https://rpc.ankr.com/fantom'],
    explorerApiUrl: 'https://api.ftmscan.com/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Fantom',
    enabled: true,
  },
  {
    id: 'gnosis',
    name: 'Gnosis',
    chainId: 100,
    rpcEndpoints: ['https://gnosis-rpc.publicnode.com', 'https://rpc.ankr.com/gnosis'],
    explorerApiUrl: 'https://api.gnosisscan.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Gnosis',
    enabled: true,
  },
  {
    id: 'mode',
    name: 'Mode',
    chainId: 34443,
    rpcEndpoints: ['https://mainnet.mode.network'],
    explorerApiUrl: 'https://api.routescan.io/v2/network/mainnet/evm/34443/etherscan/api',
    explorerType: 'etherscan',
    tvlSource: 'Mode',
    enabled: true,
  },
  {
    id: 'celo',
    name: 'Celo',
    chainId: 42220,
    rpcEndpoints: ['https://celo-rpc.publicnode.com', 'https://forno.celo.org'],
    explorerApiUrl: 'https://api.celoscan.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Celo',
    enabled: true,
  },
  {
    id: 'moonbeam',
    name: 'Moonbeam',
    chainId: 1284,
    rpcEndpoints: ['https://moonbeam-rpc.publicnode.com', 'https://rpc.api.moonbeam.network'],
    explorerApiUrl: 'https://api-moonbeam.moonscan.io/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Moonbeam',
    enabled: true,
  },
  {
    id: 'cronos',
    name: 'Cronos',
    chainId: 25,
    rpcEndpoints: ['https://cronos-evm-rpc.publicnode.com', 'https://evm.cronos.org'],
    explorerApiUrl: 'https://api.cronoscan.com/api',
    explorerApiKeyEnv: 'ETHERSCAN_API_KEY',
    explorerType: 'etherscan',
    tvlSource: 'Cronos',
    enabled: true,
  },
  {
    id: 'metis',
    name: 'Metis',
    chainId: 1088,
    rpcEndpoints: ['https://andromeda.metis.io/?owner=1088'],
    explorerApiUrl: 'https://api.routescan.io/v2/network/mainnet/evm/1088/etherscan/api',
    explorerType: 'etherscan',
    tvlSource: 'Metis',
    enabled: true,
  },
];

// ── Registry State ──

let customChains: HuntChainConfig[] = [];

// ── Public API ──

/**
 * Get the full chain registry (built-in + custom).
 */
export function getHuntChainRegistry(): HuntChainConfig[] {
  return [...BUILT_IN_CHAINS, ...customChains];
}

/**
 * Get a chain by its string ID. Throws if not found.
 */
export function getHuntChainById(id: string): HuntChainConfig {
  const chain = getHuntChainRegistry().find(c => c.id === id);
  if (!chain) {
    throw new Error(`Chain not found: ${id}`);
  }
  return chain;
}

/**
 * Get a chain by its numeric chain ID.
 */
export function getHuntChainByChainId(chainId: number): HuntChainConfig | undefined {
  return getHuntChainRegistry().find(c => c.chainId === chainId);
}

/**
 * Get all enabled chains, optionally filtered by a cascade config's chain list.
 */
export function getEnabledHuntChains(chainFilter?: string[] | 'all'): HuntChainConfig[] {
  const all = getHuntChainRegistry().filter(c => c.enabled);

  if (!chainFilter || chainFilter === 'all') {
    return all;
  }

  const filterSet = new Set(chainFilter.map(c => c.toLowerCase()));
  return all.filter(c => filterSet.has(c.id));
}

/**
 * Add custom chains from YAML config.
 */
export function addCustomChains(chains: CustomChainInput[]): void {
  for (const input of chains) {
    // Don't add duplicates
    if (getHuntChainRegistry().some(c => c.id === input.id)) {
      continue;
    }

    customChains.push({
      id: input.id,
      name: input.name,
      chainId: input.chainId,
      rpcEndpoints: input.rpc_endpoints,
      explorerApiUrl: input.explorer_api_url,
      explorerApiKeyEnv: input.explorer_api_key_env,
      explorerType: input.explorer_type ?? 'etherscan',
      tvlSource: input.tvl_source,
      enabled: true,
    });
  }
}

/**
 * Reset custom chains (for testing).
 */
export function resetCustomChains(): void {
  customChains = [];
}

/**
 * Get chain count.
 */
export function getHuntChainCount(): number {
  return getHuntChainRegistry().length;
}

/**
 * Get all unique chain IDs.
 */
export function getHuntChainIds(): string[] {
  return getHuntChainRegistry().map(c => c.id);
}
