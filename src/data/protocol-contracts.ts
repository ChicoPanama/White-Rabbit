/**
 * Known contract addresses for major DeFi protocols
 * This enables contract discovery for protocols found by DeFiLlama
 */

export interface ProtocolContract {
  address: string;
  name: string;
  chainId: number;
  protocol: string;
  type: 'core' | 'token' | 'pool' | 'vault' | 'staking';
  tvlCategory?: 'high' | 'medium' | 'low'; // Priority for scanning
}

export const PROTOCOL_CONTRACTS: Record<string, ProtocolContract[]> = {
  // Ethereum mainnet (chainId: 1)
  'compound-v3': [
    { address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3', name: 'cUSDCv3', chainId: 1, protocol: 'compound-v3', type: 'core', tvlCategory: 'high' },
    { address: '0xA17581A9E3356d9A858b789D68B4d866e593aE94', name: 'cWETHv3', chainId: 1, protocol: 'compound-v3', type: 'core', tvlCategory: 'high' },
  ],
  'aave-v3': [
    { address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', name: 'PoolV3', chainId: 1, protocol: 'aave-v3', type: 'core', tvlCategory: 'high' },
    { address: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e', name: 'PoolAddressesProvider', chainId: 1, protocol: 'aave-v3', type: 'core', tvlCategory: 'high' },
  ],
  'uniswap-v3': [
    { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', name: 'UniswapV3Factory', chainId: 1, protocol: 'uniswap-v3', type: 'core', tvlCategory: 'high' },
    { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'SwapRouter', chainId: 1, protocol: 'uniswap-v3', type: 'core', tvlCategory: 'high' },
  ],
  'morpho-v1': [
    { address: '0x777777c9898D384F785Ee44Acfe945efDFf5f3E0', name: 'Morpho', chainId: 1, protocol: 'morpho-v1', type: 'core', tvlCategory: 'high' },
  ],
  'curve-dex': [
    { address: '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5', name: '3Pool', chainId: 1, protocol: 'curve-dex', type: 'pool', tvlCategory: 'high' },
    { address: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', name: '3CRV', chainId: 1, protocol: 'curve-dex', type: 'pool', tvlCategory: 'high' },
  ],
  'lido': [
    { address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', name: 'stETH', chainId: 1, protocol: 'lido', type: 'staking', tvlCategory: 'high' },
  ],

  // Base (chainId: 8453) - Target newer/less-audited protocols
  'aerodrome-v1': [
    { address: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', name: 'Router', chainId: 8453, protocol: 'aerodrome-v1', type: 'core', tvlCategory: 'high' },
  ],
  'aerodrome-slipstream': [
    { address: '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A', name: 'SlipstreamFactory', chainId: 8453, protocol: 'aerodrome-slipstream', type: 'core', tvlCategory: 'high' },
  ],
  'moonwell-lending': [
    { address: '0xfBb21d0380beE3312B33c4353c8936a0F13EF26C', name: 'Comptroller', chainId: 8453, protocol: 'moonwell-lending', type: 'core', tvlCategory: 'medium' },
  ],
  'avantis': [
    { address: '0x5E7a6F5C9b29d3F83AD1C83b067a97e8Fb0a2Da6', name: 'TradingEngine', chainId: 8453, protocol: 'avantis', type: 'core', tvlCategory: 'medium' },
  ],
  'anzen-v2': [
    { address: '0x4EDC966Df24264c9C817295AC456d3481c1eab3B', name: 'Vault', chainId: 8453, protocol: 'anzen-v2', type: 'vault', tvlCategory: 'medium' },
  ],
  // SMALLER BASE PROTOCOLS - HIGH EXPLOIT POTENTIAL
  'seamless-protocol': [
    { address: '0x8F44Fd754285aa6A2b8B9B97739B79746e0475a7', name: 'SeamlessVault', chainId: 8453, protocol: 'seamless-protocol', type: 'vault', tvlCategory: 'medium' },
  ],
  'beefy': [
    { address: '0x4E5Cf54FdE5E1237e80E87fcbA555d829e1307CE', name: 'BeefyVault', chainId: 8453, protocol: 'beefy', type: 'vault', tvlCategory: 'low' },
  ],
  'extra-finance': [
    { address: '0x2dAdF1F3A3a4F8EEfBf53BD1e1D1Fd6F8eCe6d6E', name: 'ExtraVault', chainId: 8453, protocol: 'extra-finance', type: 'vault', tvlCategory: 'medium' },
  ],

  // Polygon (chainId: 137) - QUICK EXPANSION  
  'quickswap': [
    { address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', name: 'QuickRouter', chainId: 137, protocol: 'quickswap', type: 'core', tvlCategory: 'medium' },
  ],
  'sushiswap': [
    { address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', name: 'SushiRouter', chainId: 137, protocol: 'sushiswap', type: 'core', tvlCategory: 'medium' },
  ],

  // Arbitrum (chainId: 42161) - EXPANDED TARGET LIST
  'gmx-v2-perps': [
    { address: '0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55', name: 'ExchangeRouter', chainId: 42161, protocol: 'gmx-v2-perps', type: 'core', tvlCategory: 'high' },
    { address: '0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6', name: 'Router', chainId: 42161, protocol: 'gmx-v2-perps', type: 'core', tvlCategory: 'high' },
  ],
  'pendle': [
    { address: '0x888888888889758F76e7103c6CbF23ABbF58F946', name: 'Router', chainId: 42161, protocol: 'pendle', type: 'core', tvlCategory: 'high' },
    { address: '0x0000000001E4ef00d069e71d6bA041b0A16F7eA0', name: 'Market', chainId: 42161, protocol: 'pendle', type: 'core', tvlCategory: 'high' },
  ],
  'spiko': [
    { address: '0x3E5c63644E683549055b9Be8653de26E0B4CD36E', name: 'SpikoVault', chainId: 42161, protocol: 'spiko', type: 'vault', tvlCategory: 'medium' },
  ],
  'kelp': [
    { address: '0x94d442A4236E3D5b0c9Ef9Bb5e4E40e0CaB0e92F', name: 'KelpDAO', chainId: 42161, protocol: 'kelp', type: 'staking', tvlCategory: 'medium' },
  ],
  // SMALLER PROTOCOLS - HIGH RISK TARGETS
  'radiant-capital': [
    { address: '0x2032b9A8e9F7e76768CA9271003d3e43E1616B1F', name: 'LendingPool', chainId: 42161, protocol: 'radiant-capital', type: 'core', tvlCategory: 'medium' },
  ],
  'jones-dao': [
    { address: '0x5375616bb6c52A90439ff96882fBd5a2fb8C1ecE', name: 'JonesVault', chainId: 42161, protocol: 'jones-dao', type: 'vault', tvlCategory: 'medium' },
  ],
  'plutus-dao': [
    { address: '0x51318B7D00db7ACc4026C88c3952B66278B6A67F', name: 'PlutusVault', chainId: 42161, protocol: 'plutus-dao', type: 'vault', tvlCategory: 'low' },
  ],
};

/**
 * Get contracts for a protocol by name/slug
 */
export function getProtocolContracts(protocolSlug: string, chainId: number): ProtocolContract[] {
  const normalizedSlug = protocolSlug.toLowerCase().replace(/\s+/g, '-');
  const contracts = PROTOCOL_CONTRACTS[normalizedSlug] || [];
  return contracts.filter(c => c.chainId === chainId);
}

/**
 * Get all known contracts for a chain
 */
export function getChainContracts(chainId: number): ProtocolContract[] {
  const allContracts: ProtocolContract[] = [];
  for (const contracts of Object.values(PROTOCOL_CONTRACTS)) {
    allContracts.push(...contracts.filter(c => c.chainId === chainId));
  }
  return allContracts.sort((a, b) => {
    // Sort by TVL category priority
    const order = { high: 3, medium: 2, low: 1 };
    return (order[b.tvlCategory || 'low'] - order[a.tvlCategory || 'low']);
  });
}

/**
 * Check if protocol has known contracts
 */
export function hasKnownContracts(protocolSlug: string): boolean {
  const normalizedSlug = protocolSlug.toLowerCase().replace(/\s+/g, '-');
  return normalizedSlug in PROTOCOL_CONTRACTS;
}