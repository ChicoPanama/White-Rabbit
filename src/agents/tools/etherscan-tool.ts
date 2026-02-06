/**
 * Etherscan tool — wraps Etherscan V2 API calls.
 */

import type { ToolResult } from '../agent-types.js';
import { isDryRun, dryRunLog, loadJsonFixture, logApiCall } from '../../dry-run.js';

/**
 * Check if the Etherscan API key is configured.
 */
export function isAvailable(): boolean {
  return !!process.env.ETHERSCAN_API_KEY;
}

/**
 * Make an Etherscan API call.
 */
export async function execute(params: Record<string, unknown>): Promise<ToolResult> {
  const startMs = Date.now();
  const action = String(params.action ?? 'getsourcecode');
  const address = String(params.address ?? '');
  const chain = String(params.chain ?? 'ethereum');

  if (isDryRun()) {
    logApiCall('Etherscan', action, { address, chain });
    const fixture = loadJsonFixture('sample-contract-source.json');
    return {
      tool: 'etherscan',
      success: true,
      data: fixture ?? { name: 'DryRunContract', sourceCode: '// dry run' },
      duration: Date.now() - startMs,
    };
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return {
      tool: 'etherscan',
      success: false,
      data: null,
      error: 'ETHERSCAN_API_KEY not set',
      duration: Date.now() - startMs,
    };
  }

  try {
    // Use Etherscan V2 unified endpoint
    const url = `https://api.etherscan.io/v2/api?chainid=${getChainId(chain)}&module=contract&action=${action}&address=${address}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    return {
      tool: 'etherscan',
      success: true,
      data,
      duration: Date.now() - startMs,
    };
  } catch (err) {
    return {
      tool: 'etherscan',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startMs,
    };
  }
}

function getChainId(chain: string): number {
  const chains: Record<string, number> = {
    ethereum: 1, bsc: 56, polygon: 137, arbitrum: 42161, base: 8453,
    optimism: 10, avalanche: 43114, fantom: 250, gnosis: 100,
    linea: 59144, scroll: 534352, blast: 81457,
  };
  return chains[chain] ?? 1;
}
