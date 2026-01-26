import type { EtherscanSourceResult } from '../types/index.js';

const BASE_URL = 'https://api.etherscan.io/v2/api';

interface RateLimiter {
  lastRequestTime: number;
  minIntervalMs: number;
}

export class EtherscanClient {
  private readonly apiKey: string;
  private readonly limiter: RateLimiter;

  constructor(apiKey: string, requestIntervalMs = 200) {
    this.apiKey = apiKey;
    this.limiter = { lastRequestTime: 0, minIntervalMs: requestIntervalMs };
  }

  async getContractSource(chainId: number, address: string): Promise<{
    name: string;
    sourceCode: string;
    abi: unknown[];
    compilerVersion: string;
    isProxy: boolean;
    implementationAddress: string | null;
  } | null> {
    const params = new URLSearchParams({
      chainid: chainId.toString(),
      module: 'contract',
      action: 'getsourcecode',
      address,
      apikey: this.apiKey,
    });

    const data = await this.fetchWithRetry(`${BASE_URL}?${params}`);
    const resultArr = data?.result as EtherscanSourceResult[] | undefined;
    if (!resultArr?.[0] || resultArr[0].ABI === 'Contract source code not verified') {
      return null;
    }

    const r = resultArr[0];
    let abi: unknown[] = [];
    try {
      abi = JSON.parse(r.ABI);
    } catch {
      // ABI may be unavailable
    }

    return {
      name: r.ContractName,
      sourceCode: r.SourceCode,
      abi,
      compilerVersion: r.CompilerVersion,
      isProxy: r.Proxy === '1',
      implementationAddress: r.Implementation || null,
    };
  }

  async getNewlyVerifiedContracts(chainId: number): Promise<Array<{ address: string; contractName: string }>> {
    // Etherscan doesn't have a direct "newly verified" endpoint.
    // We approximate by checking recent contract creations via the
    // contract list API or by monitoring specific addresses.
    // For production, you'd use a block scanner approach.
    const params = new URLSearchParams({
      chainid: chainId.toString(),
      module: 'contract',
      action: 'listcontracts',
      page: '1',
      offset: '20',
      apikey: this.apiKey,
    });

    const data = await this.fetchWithRetry(`${BASE_URL}?${params}`);
    if (!data?.result || !Array.isArray(data.result)) {
      return [];
    }

    return data.result.map((c: { Address: string; ContractName: string }) => ({
      address: c.Address,
      contractName: c.ContractName,
    }));
  }

  async getContractCreationTx(chainId: number, addresses: string[]): Promise<
    Array<{ contractAddress: string; txHash: string; contractCreator: string }>
  > {
    const params = new URLSearchParams({
      chainid: chainId.toString(),
      module: 'contract',
      action: 'getcontractcreation',
      contractaddresses: addresses.join(','),
      apikey: this.apiKey,
    });

    const data = await this.fetchWithRetry(`${BASE_URL}?${params}`);
    if (!data?.result || !Array.isArray(data.result)) {
      return [];
    }

    return data.result.map((c: { contractAddress: string; txHash: string; contractCreator: string }) => ({
      contractAddress: c.contractAddress,
      txHash: c.txHash,
      contractCreator: c.contractCreator,
    }));
  }

  private async fetchWithRetry(url: string, maxRetries = 3): Promise<Record<string, unknown>> {
    await this.waitForRateLimit();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url);

        if (response.status === 429) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 60_000);
          console.warn(`Etherscan rate limited, backing off ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }

        if (!response.ok) {
          throw new Error(`Etherscan HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as Record<string, unknown>;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          await sleep(backoffMs);
        }
      }
    }

    throw lastError ?? new Error('Etherscan request failed');
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.limiter.lastRequestTime;
    if (elapsed < this.limiter.minIntervalMs) {
      await sleep(this.limiter.minIntervalMs - elapsed);
    }
    this.limiter.lastRequestTime = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
