/**
 * Cross-chain PoC Adapter — Adapts proof-of-concept exploits across chains.
 *
 * Takes a PoC developed for one chain and adapts it for deployment on
 * another chain by replacing addresses, tokens, RPC endpoints, and
 * chain-specific parameters.
 */

import type { ForkMatch } from './fork-hunter.js';
import type { HuntChainConfig } from './chain-registry.js';
import { getHuntChainById } from './chain-registry.js';

// ── Types ──

export interface PoCTemplate {
  code: string;                        // Foundry test source code
  vulnType: string;                    // e.g. 'reentrancy'
  originalAddress: string;             // Target contract on original chain
  originalChain: string;               // Chain ID string
  rpcUrl?: string;                     // Fork RPC URL used in PoC
  dependencies?: string[];             // External contracts used (DEX routers, etc.)
}

export interface AdaptedPoC {
  code: string;                        // Adapted Foundry test
  targetAddress: string;               // Fork contract address
  targetChain: string;                 // Target chain ID string
  targetChainId: number;
  rpcUrl: string;                      // RPC for forking
  replacements: Replacement[];         // All replacements made
  warnings: string[];                  // Adaptation warnings
  confidence: number;                  // 0-100 how likely this works
}

export interface Replacement {
  original: string;
  replacement: string;
  reason: string;
}

// ── Well-Known Cross-Chain Addresses ──

/**
 * Common DeFi protocol addresses by chain.
 * These are canonical deployments that differ across chains.
 */
const WELL_KNOWN_ADDRESSES: Record<string, Record<string, string>> = {
  // WETH / WBNB / WMATIC etc.
  wrapped_native: {
    ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    base: '0x4200000000000000000000000000000000000006',
    polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    optimism: '0x4200000000000000000000000000000000000006',
    avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    fantom: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    blast: '0x4300000000000000000000000000000000000004',
    gnosis: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
  },
  // USDC
  usdc: {
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  },
  // USDT
  usdt: {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    bsc: '0x55d398326f99059fF775485246999027B3197955',
    arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  // Uniswap V2 Router
  uniswap_v2_router: {
    ethereum: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    bsc: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap
    arbitrum: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    base: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    polygon: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
    optimism: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
    avalanche: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    fantom: '0xF491e7B69E4244ad4002BC14e878a34207E38c29', // SpookySwap
  },
  // Uniswap V3 Router
  uniswap_v3_router: {
    ethereum: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    arbitrum: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    base: '0x2626664c2603336E57B271c5C0b26F421741e481',
    polygon: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    optimism: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  },
  // AAVE V3 Pool
  aave_v3_pool: {
    ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    arbitrum: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    base: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    optimism: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    avalanche: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  },
};

// ── Main Adaptation Function ──

/**
 * Adapt a PoC from one chain to another.
 *
 * Performs:
 * 1. Target address replacement
 * 2. Well-known address mapping (WETH → WBNB, etc.)
 * 3. RPC URL replacement for fork testing
 * 4. Chain-specific parameter adjustment
 */
export function adaptPoC(
  template: PoCTemplate,
  fork: ForkMatch,
): AdaptedPoC {
  let code = template.code;
  const replacements: Replacement[] = [];
  const warnings: string[] = [];
  let confidence = 80; // Start optimistic

  // Get target chain config
  let targetChain: HuntChainConfig;
  try {
    targetChain = getHuntChainById(fork.chain);
  } catch {
    return {
      code: template.code,
      targetAddress: fork.address,
      targetChain: fork.chain,
      targetChainId: fork.chainId,
      rpcUrl: '',
      replacements: [],
      warnings: ['Unknown target chain: ' + fork.chain],
      confidence: 0,
    };
  }

  // 1. Replace target contract address
  if (template.originalAddress) {
    const originalLower = template.originalAddress.toLowerCase();
    const originalChecksummed = template.originalAddress;

    // Replace both checksummed and lowercase variants
    for (const variant of [originalChecksummed, originalLower]) {
      if (code.includes(variant)) {
        code = code.split(variant).join(fork.address);
        replacements.push({
          original: variant,
          replacement: fork.address,
          reason: 'Target contract address',
        });
      }
    }
  }

  // 2. Replace well-known addresses
  for (const [tokenName, chainAddresses] of Object.entries(WELL_KNOWN_ADDRESSES)) {
    const originalAddr = chainAddresses[template.originalChain];
    const targetAddr = chainAddresses[fork.chain];

    if (originalAddr && targetAddr && originalAddr !== targetAddr) {
      // Check both case variants
      for (const variant of [originalAddr, originalAddr.toLowerCase()]) {
        if (code.includes(variant)) {
          code = code.split(variant).join(targetAddr);
          replacements.push({
            original: variant,
            replacement: targetAddr,
            reason: `${tokenName} address (${template.originalChain} → ${fork.chain})`,
          });
        }
      }
    } else if (originalAddr && !targetAddr && code.includes(originalAddr)) {
      warnings.push(`No ${tokenName} equivalent on ${fork.chain} — address kept as-is`);
      confidence -= 15;
    }
  }

  // 3. Replace RPC URL
  const targetRpc = targetChain.rpcEndpoints[0] ?? '';
  if (template.rpcUrl && code.includes(template.rpcUrl)) {
    code = code.split(template.rpcUrl).join(targetRpc);
    replacements.push({
      original: template.rpcUrl,
      replacement: targetRpc,
      reason: 'Fork RPC endpoint',
    });
  }

  // Also replace common RPC URL patterns
  code = replaceRpcPatterns(code, targetRpc, replacements);

  // 4. Replace chain-specific comments/labels
  code = code.replace(
    new RegExp(`on\\s+${escapeRegex(template.originalChain)}`, 'gi'),
    `on ${fork.chain}`,
  );

  // 5. Adjust confidence based on fork similarity
  if (fork.similarity.exactMatch) {
    confidence = Math.min(confidence + 15, 95);
  } else if (fork.similarity.overall < 85) {
    confidence -= 10;
  }
  if (fork.matchType === 'modified_fork') {
    confidence -= 10;
    warnings.push('Modified fork — PoC may need manual adjustments');
  }
  if (fork.matchType === 'related') {
    confidence -= 25;
    warnings.push('Related contract (not direct fork) — PoC likely needs significant changes');
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    code,
    targetAddress: fork.address,
    targetChain: fork.chain,
    targetChainId: fork.chainId,
    rpcUrl: targetRpc,
    replacements,
    warnings,
    confidence,
  };
}

/**
 * Batch-adapt a PoC for multiple forks.
 */
export function adaptPoCForForks(
  template: PoCTemplate,
  forks: ForkMatch[],
): AdaptedPoC[] {
  return forks.map(fork => adaptPoC(template, fork));
}

// ── RPC URL Replacement ──

/**
 * Replace common RPC URL patterns in PoC code.
 */
function replaceRpcPatterns(
  code: string,
  targetRpc: string,
  replacements: Replacement[],
): string {
  const rpcPatterns = [
    /vm\.createFork\(\s*"([^"]+)"\s*\)/g,
    /vm\.createSelectFork\(\s*"([^"]+)"\s*\)/g,
    /fork_url\s*=\s*"([^"]+)"/g,
  ];

  for (const pattern of rpcPatterns) {
    code = code.replace(pattern, (match, url) => {
      const replacement = match.replace(url, targetRpc);
      replacements.push({
        original: url,
        replacement: targetRpc,
        reason: 'Fork RPC URL in Foundry test',
      });
      return replacement;
    });
  }

  return code;
}

// ── Token Mapping ──

/**
 * Get the equivalent token address on a target chain.
 *
 * @returns The mapped address or null if no equivalent exists
 */
export function mapTokenAddress(
  tokenAddress: string,
  sourceChain: string,
  targetChain: string,
): string | null {
  const normalizedAddr = tokenAddress.toLowerCase();

  for (const [, chainAddresses] of Object.entries(WELL_KNOWN_ADDRESSES)) {
    const sourceAddr = chainAddresses[sourceChain];
    if (sourceAddr && sourceAddr.toLowerCase() === normalizedAddr) {
      return chainAddresses[targetChain] ?? null;
    }
  }

  return null;
}

/**
 * Get all well-known token addresses on a given chain.
 */
export function getChainTokenAddresses(chain: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [tokenName, chainAddresses] of Object.entries(WELL_KNOWN_ADDRESSES)) {
    if (chainAddresses[chain]) {
      tokens[tokenName] = chainAddresses[chain];
    }
  }
  return tokens;
}

// ── Utility ──

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
