/**
 * Multi-Chain Wallet Manager
 *
 * Manages a single HD wallet derived across all EVM chains.
 * Same address on every chain (shared mnemonic, derivation path m/44'/60'/0'/0/0).
 *
 * Used for:
 * - eth_call simulation with real wallet state
 * - debug_traceCall for exact value flow analysis
 * - Balance tracking across chains for gas funding
 * - Testnet execution for definitive verification ($100K+ findings)
 *
 * Security:
 * - Mnemonic encrypted at rest (AES-256-GCM)
 * - Never executes on mainnet
 * - Auto-lock after inactivity
 * - Memory wipe on destroy
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { decryptMnemonic, encryptMnemonic, secureWipe } from './crypto.js';

// ── Chain Configuration ──

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 56: 'BNB Chain', 42161: 'Arbitrum', 8453: 'Base',
  137: 'Polygon', 10: 'Optimism', 43114: 'Avalanche', 250: 'Fantom',
  100: 'Gnosis', 59144: 'Linea', 534352: 'Scroll', 81457: 'Blast',
};

export const NATIVE_SYMBOLS: Record<number, string> = {
  1: 'ETH', 56: 'BNB', 42161: 'ETH', 8453: 'ETH',
  137: 'MATIC', 10: 'ETH', 43114: 'AVAX', 250: 'FTM',
  100: 'xDAI', 59144: 'ETH', 534352: 'ETH', 81457: 'ETH',
};

export const TESTNET_CHAIN_IDS: Record<number, number> = {
  1: 11155111,      // Ethereum -> Sepolia
  56: 97,           // BSC -> BSC Testnet
  42161: 421614,    // Arbitrum -> Arbitrum Sepolia
  8453: 84532,      // Base -> Base Sepolia
  137: 80002,       // Polygon -> Polygon Amoy
  10: 11155420,     // Optimism -> OP Sepolia
  43114: 43113,     // Avalanche -> Fuji
  59144: 59141,     // Linea -> Linea Sepolia
  534352: 534351,   // Scroll -> Scroll Sepolia
  81457: 168587773, // Blast -> Blast Sepolia
};

export const MIN_BALANCES: Record<number, bigint> = {
  1: ethers.parseEther('0.05'),       // ETH mainnet - higher gas
  56: ethers.parseEther('0.01'),      // BSC - cheap
  42161: ethers.parseEther('0.005'),  // Arbitrum - very cheap
  8453: ethers.parseEther('0.005'),   // Base - very cheap
  137: ethers.parseEther('0.5'),      // Polygon - MATIC cheap but need more
  10: ethers.parseEther('0.005'),     // Optimism - cheap
  43114: ethers.parseEther('0.1'),    // Avalanche - AVAX
  250: ethers.parseEther('1.0'),      // Fantom - FTM cheap
  100: ethers.parseEther('0.1'),      // Gnosis - xDAI
  59144: ethers.parseEther('0.005'),  // Linea - ETH
  534352: ethers.parseEther('0.005'), // Scroll - ETH
  81457: ethers.parseEther('0.005'),  // Blast - ETH
};

const RPC_ENV_MAP: Record<number, string> = {
  1: 'ETH_RPC_URL', 56: 'BSC_RPC_URL', 42161: 'ARBITRUM_RPC_URL',
  8453: 'BASE_RPC_URL', 137: 'POLYGON_RPC_URL', 10: 'OPTIMISM_RPC_URL',
  43114: 'AVALANCHE_RPC_URL', 250: 'FANTOM_RPC_URL', 100: 'GNOSIS_RPC_URL',
  59144: 'LINEA_RPC_URL', 534352: 'SCROLL_RPC_URL', 81457: 'BLAST_RPC_URL',
};

const TESTNET_RPC_ENV_MAP: Record<number, string> = {
  1: 'ETH_TESTNET_RPC_URL', 56: 'BSC_TESTNET_RPC_URL',
  42161: 'ARBITRUM_TESTNET_RPC_URL', 8453: 'BASE_TESTNET_RPC_URL',
  137: 'POLYGON_TESTNET_RPC_URL', 10: 'OPTIMISM_TESTNET_RPC_URL',
};

const WALLET_DIR = path.join(os.homedir(), '.etherscan-auditor');
const WALLET_FILE = path.join(WALLET_DIR, 'wallet.enc');
const AUTO_LOCK_MS = 30 * 60 * 1000; // 30 minutes

// ── Security Config ──

export const SECURITY_CONFIG = {
  maxBalancePerChain: ethers.parseEther('0.1'),
  mainnetExecutionBlocked: true,
  testnetRequiresConfirmation: true,
  autoLockMinutes: 30,
  walletFilePermissions: 0o600,
  neverLogPrivateKeys: true,
  neverLogMnemonic: true,
} as const;

// ── Interfaces ──

export interface ChainWallet {
  chainId: number;
  chainName: string;
  address: string;
  provider: ethers.JsonRpcProvider;
  wallet: ethers.HDNodeWallet;
  balance: {
    native: bigint;
    nativeUsd: number;
    lastChecked: Date;
  };
  testnetRpcUrl: string | null;
}

export interface SimulationResult {
  success: boolean;
  returnData: string;
  error?: string;
}

export interface ExploitSimulationResult {
  success: boolean;
  wouldSucceed: boolean;
  estimatedProfit: number; // USD
  valueTransfers: Array<{ from: string; to: string; value: bigint; valueUsd: number }>;
  gasUsed: bigint;
  error?: string;
}

export interface TestnetExecutionResult {
  success: boolean;
  exploitWorked?: boolean;
  profit?: bigint;
  profitUsd?: number;
  txHash?: string;
  gasUsed?: bigint;
  error?: string;
  faucetUrl?: string;
}

export interface WalletBalanceSummary {
  chainId: number;
  chainName: string;
  symbol: string;
  native: bigint;
  nativeFormatted: string;
  usd: number;
  status: 'ok' | 'low' | 'empty';
}

// ── Wallet Manager ──

export class WalletManager {
  private wallets = new Map<number, ChainWallet>();
  private mnemonic = '';
  private address = '';
  private lastActivityAt = Date.now();
  private locked = true;

  /**
   * Check if a wallet file exists.
   */
  static walletExists(): boolean {
    return fs.existsSync(WALLET_FILE);
  }

  /**
   * Get the wallet file path.
   */
  static getWalletPath(): string {
    return WALLET_FILE;
  }

  /**
   * Initialize a new wallet — generates mnemonic, encrypts, and stores.
   * Returns the mnemonic (display once, then discard).
   */
  static async initializeNew(password: string): Promise<{ mnemonic: string; address: string }> {
    const randomWallet = ethers.Wallet.createRandom();
    const mnemonic = randomWallet.mnemonic?.phrase;
    if (!mnemonic) throw new Error('Failed to generate mnemonic');

    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
    const address = hdNode.address;

    // Encrypt and store atomically
    const encrypted = await encryptMnemonic(mnemonic, password);
    fs.mkdirSync(WALLET_DIR, { recursive: true, mode: 0o700 });
    const fd = fs.openSync(WALLET_FILE, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, SECURITY_CONFIG.walletFilePermissions);
    try {
      fs.writeSync(fd, encrypted, 0, 'utf8');
    } finally {
      fs.closeSync(fd);
    }

    return { mnemonic, address };
  }

  /**
   * Unlock the wallet manager with password.
   */
  async unlock(password: string): Promise<void> {
    if (!WalletManager.walletExists()) {
      throw new Error('No wallet found. Run "wallet:init" first.');
    }

    const encrypted = fs.readFileSync(WALLET_FILE, 'utf8');
    this.mnemonic = await decryptMnemonic(encrypted, password);
    const hdNode = ethers.HDNodeWallet.fromPhrase(this.mnemonic);
    this.address = hdNode.address;
    this.locked = false;
    this.lastActivityAt = Date.now();

    await this.initializeChainWallets();
  }

  /**
   * Initialize wallet connections for all chains with configured RPC.
   */
  private async initializeChainWallets(): Promise<void> {
    this.ensureUnlocked();
    const hdNode = ethers.HDNodeWallet.fromPhrase(this.mnemonic);

    for (const [chainIdStr, envVar] of Object.entries(RPC_ENV_MAP)) {
      const chainId = parseInt(chainIdStr, 10);
      const rpcUrl = process.env[envVar];
      if (!rpcUrl) continue;

      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
        const wallet = hdNode.connect(provider);

        const balance = await provider.getBalance(wallet.address).catch(() => 0n);
        const nativeUsd = await this.getNativeUsd(chainId, balance);

        const testnetEnvVar = TESTNET_RPC_ENV_MAP[chainId];
        const testnetRpcUrl = testnetEnvVar ? (process.env[testnetEnvVar] ?? null) : null;

        this.wallets.set(chainId, {
          chainId,
          chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
          address: wallet.address,
          provider,
          wallet,
          balance: { native: balance, nativeUsd: nativeUsd, lastChecked: new Date() },
          testnetRpcUrl,
        });
      } catch (err) {
        console.warn(`[WalletManager] Failed to connect chain ${chainId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * Get wallet address (same on all chains).
   */
  getAddress(): string {
    return this.address;
  }

  /**
   * Get wallet for a specific chain.
   */
  getWallet(chainId: number): ChainWallet | undefined {
    this.checkAutoLock();
    return this.wallets.get(chainId);
  }

  /**
   * Check if wallet has a chain configured.
   */
  hasChain(chainId: number): boolean {
    return this.wallets.has(chainId);
  }

  /**
   * Check if a testnet is available for a chain.
   */
  hasTestnet(chainId: number): boolean {
    const wallet = this.wallets.get(chainId);
    return !!wallet?.testnetRpcUrl && !!TESTNET_CHAIN_IDS[chainId];
  }

  /**
   * Check balances across all configured chains.
   */
  async checkAllBalances(): Promise<WalletBalanceSummary[]> {
    this.ensureUnlocked();
    const results: WalletBalanceSummary[] = [];

    for (const [chainId, cw] of this.wallets) {
      try {
        const balance = await cw.provider.getBalance(cw.address);
        const usd = await this.getNativeUsd(chainId, balance);
        const minBal = MIN_BALANCES[chainId] ?? 0n;
        const status: WalletBalanceSummary['status'] =
          balance === 0n ? 'empty' :
          balance < minBal ? 'low' : 'ok';

        cw.balance = { native: balance, nativeUsd: usd, lastChecked: new Date() };

        results.push({
          chainId,
          chainName: cw.chainName,
          symbol: NATIVE_SYMBOLS[chainId] ?? 'ETH',
          native: balance,
          nativeFormatted: ethers.formatEther(balance),
          usd,
          status,
        });
      } catch (err) {
        results.push({
          chainId,
          chainName: cw.chainName,
          symbol: NATIVE_SYMBOLS[chainId] ?? 'ETH',
          native: 0n,
          nativeFormatted: '0.0',
          usd: 0,
          status: 'empty',
        });
      }
    }

    this.lastActivityAt = Date.now();
    return results.sort((a, b) => b.usd - a.usd);
  }

  /**
   * Simulate a transaction using eth_call (no state changes, no gas cost).
   */
  async simulateTransaction(
    chainId: number,
    to: string,
    data: string,
    value?: bigint,
  ): Promise<SimulationResult> {
    this.ensureUnlocked();
    const cw = this.wallets.get(chainId);
    if (!cw) return { success: false, returnData: '', error: `No wallet for chain ${chainId}` };

    try {
      const result = await cw.provider.call({
        from: cw.address,
        to,
        data,
        value: value ?? 0n,
      });
      this.lastActivityAt = Date.now();
      return { success: true, returnData: result };
    } catch (err) {
      return { success: false, returnData: '', error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Simulate exploit with profit tracking via debug_traceCall.
   * Falls back to eth_call if trace is not supported.
   */
  async simulateExploitWithProfit(
    chainId: number,
    exploitTo: string,
    exploitData: string,
    targetContract: string,
  ): Promise<ExploitSimulationResult> {
    this.ensureUnlocked();
    const cw = this.wallets.get(chainId);
    if (!cw) {
      return { success: false, wouldSucceed: false, estimatedProfit: 0, valueTransfers: [], gasUsed: 0n, error: `No wallet for chain ${chainId}` };
    }

    // Get target balance before
    const targetBalanceBefore = await cw.provider.getBalance(targetContract).catch(() => 0n);

    try {
      // Try debug_traceCall for detailed execution trace
      const traceResult = await cw.provider.send('debug_traceCall', [
        {
          from: cw.address,
          to: exploitTo,
          data: exploitData,
          value: '0x0',
        },
        'latest',
        { tracer: 'callTracer', tracerConfig: { withLog: true } },
      ]) as { failed?: boolean; gasUsed?: string; output?: string; calls?: unknown[] };

      const gasUsed = BigInt(traceResult.gasUsed ?? '0');
      const wouldSucceed = !traceResult.failed;

      // Parse value transfers from trace
      const transfers = this.parseTraceTransfers(traceResult, cw.address);
      const nativePrice = await this.getNativePrice(chainId);
      const estimatedProfit = transfers.reduce((sum, t) => {
        return sum + Number(ethers.formatEther(t.value)) * nativePrice;
      }, 0);

      this.lastActivityAt = Date.now();
      return {
        success: true,
        wouldSucceed,
        estimatedProfit,
        valueTransfers: transfers.map(t => ({
          ...t,
          valueUsd: Number(ethers.formatEther(t.value)) * nativePrice,
        })),
        gasUsed,
      };
    } catch {
      // Fallback: use eth_call
      return this.fallbackExploitSimulation(chainId, exploitTo, exploitData, targetContract, targetBalanceBefore);
    }
  }

  /**
   * Execute exploit on testnet for definitive verification.
   * ONLY for high-value findings ($100K+).
   * NEVER executes on mainnet.
   */
  async executeOnTestnet(
    chainId: number,
    deployBytecode: string,
    exploitCalldata: string,
  ): Promise<TestnetExecutionResult> {
    this.ensureUnlocked();

    // CRITICAL: Block mainnet execution
    if (!TESTNET_CHAIN_IDS[chainId]) {
      return { success: false, error: `No testnet mapping for chain ${chainId}` };
    }

    const cw = this.wallets.get(chainId);
    if (!cw?.testnetRpcUrl) {
      return { success: false, error: `No testnet RPC configured for ${CHAIN_NAMES[chainId]}` };
    }

    const testnetChainId = TESTNET_CHAIN_IDS[chainId];
    const testnetProvider = new ethers.JsonRpcProvider(cw.testnetRpcUrl, testnetChainId);
    const hdNode = ethers.HDNodeWallet.fromPhrase(this.mnemonic);
    const testnetWallet = hdNode.connect(testnetProvider);

    // Check testnet balance
    const balance = await testnetProvider.getBalance(testnetWallet.address);
    if (balance < ethers.parseEther('0.01')) {
      return { success: false, error: 'Insufficient testnet balance' };
    }

    try {
      // Deploy exploit contract
      const deployTx = await testnetWallet.sendTransaction({ data: deployBytecode });
      const deployReceipt = await deployTx.wait();
      const exploitAddress = deployReceipt?.contractAddress;
      if (!exploitAddress) {
        return { success: false, error: 'Deploy failed — no contract address' };
      }

      // Execute exploit
      const balanceBefore = await testnetProvider.getBalance(testnetWallet.address);
      const exploitTx = await testnetWallet.sendTransaction({
        to: exploitAddress,
        data: exploitCalldata,
      });
      const exploitReceipt = await exploitTx.wait();
      const balanceAfter = await testnetProvider.getBalance(testnetWallet.address);

      const gasCost = (exploitReceipt?.gasUsed ?? 0n) * (exploitReceipt?.gasPrice ?? 0n);
      const profit = balanceAfter - balanceBefore + gasCost;
      const nativePrice = await this.getNativePrice(chainId);

      this.lastActivityAt = Date.now();
      return {
        success: true,
        exploitWorked: profit > 0n,
        profit,
        profitUsd: Number(ethers.formatEther(profit)) * nativePrice,
        txHash: exploitReceipt?.hash ?? undefined,
        gasUsed: exploitReceipt?.gasUsed ?? undefined,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Get chains that need funding for gas.
   */
  getRefundingNeeded(): Array<{ chainId: number; chainName: string; symbol: string; needed: bigint }> {
    const needed: Array<{ chainId: number; chainName: string; symbol: string; needed: bigint }> = [];

    for (const [chainId, cw] of this.wallets) {
      const minBal = MIN_BALANCES[chainId] ?? ethers.parseEther('0.01');
      if (cw.balance.native < minBal) {
        needed.push({
          chainId,
          chainName: cw.chainName,
          symbol: NATIVE_SYMBOLS[chainId] ?? 'ETH',
          needed: minBal - cw.balance.native,
        });
      }
    }

    return needed;
  }

  /**
   * Get number of configured chains.
   */
  chainCount(): number {
    return this.wallets.size;
  }

  /**
   * Whether the wallet is unlocked and active.
   */
  isUnlocked(): boolean {
    return !this.locked;
  }

  /**
   * Lock the wallet and wipe mnemonic from memory.
   */
  destroy(): void {
    this.mnemonic = secureWipe(this.mnemonic);
    this.address = '';
    this.wallets.clear();
    this.locked = true;
  }

  // ── Private helpers ──

  private ensureUnlocked(): void {
    this.checkAutoLock();
    if (this.locked) throw new Error('Wallet is locked. Call unlock() first.');
  }

  private checkAutoLock(): void {
    if (!this.locked && Date.now() - this.lastActivityAt > AUTO_LOCK_MS) {
      console.warn('[WalletManager] Auto-locking after inactivity');
      this.destroy();
    }
  }

  private async fallbackExploitSimulation(
    chainId: number,
    exploitTo: string,
    exploitData: string,
    targetContract: string,
    targetBalanceBefore: bigint,
  ): Promise<ExploitSimulationResult> {
    const cw = this.wallets.get(chainId);
    if (!cw) {
      return { success: false, wouldSucceed: false, estimatedProfit: 0, valueTransfers: [], gasUsed: 0n };
    }

    try {
      // Try eth_call to see if it reverts
      await cw.provider.call({
        from: cw.address,
        to: exploitTo,
        data: exploitData,
      });

      // Estimate gas
      const gasEstimate = await cw.provider.estimateGas({
        from: cw.address,
        to: exploitTo,
        data: exploitData,
      }).catch(() => 0n);

      // Can't measure profit via eth_call alone — use balance heuristic
      const nativePrice = await this.getNativePrice(chainId);
      const targetValue = Number(ethers.formatEther(targetBalanceBefore)) * nativePrice;

      return {
        success: true,
        wouldSucceed: true,
        estimatedProfit: targetValue * 0.1, // Conservative 10% estimate without trace
        valueTransfers: [],
        gasUsed: gasEstimate,
      };
    } catch {
      return { success: false, wouldSucceed: false, estimatedProfit: 0, valueTransfers: [], gasUsed: 0n };
    }
  }

  private parseTraceTransfers(
    trace: { calls?: unknown[] },
    walletAddress: string,
  ): Array<{ from: string; to: string; value: bigint }> {
    const transfers: Array<{ from: string; to: string; value: bigint }> = [];
    const lowerWallet = walletAddress.toLowerCase();

    function walk(node: Record<string, unknown>) {
      if (node.value && typeof node.value === 'string') {
        const val = BigInt(node.value);
        const to = (node.to as string || '').toLowerCase();
        const from = (node.from as string || '').toLowerCase();
        if (val > 0n && (to === lowerWallet || from === lowerWallet)) {
          transfers.push({ from, to, value: val });
        }
      }
      if (Array.isArray(node.calls)) {
        for (const child of node.calls) {
          walk(child as Record<string, unknown>);
        }
      }
    }

    walk(trace as Record<string, unknown>);
    return transfers;
  }

  private async getNativePrice(chainId: number): Promise<number> {
    const coingeckoId = chainId === 56 ? 'binancecoin' :
                        chainId === 137 ? 'matic-network' :
                        chainId === 43114 ? 'avalanche-2' :
                        chainId === 250 ? 'fantom' :
                        chainId === 100 ? 'dai' :
                        'ethereum';
    try {
      const resp = await fetch(`https://coins.llama.fi/prices/current/coingecko:${coingeckoId}`);
      if (resp.ok) {
        const data = await resp.json() as { coins?: Record<string, { price?: number }> };
        const key = `coingecko:${coingeckoId}`;
        if (data.coins?.[key]?.price) return data.coins[key].price;
      }
    } catch { /* fallback */ }

    // Hardcoded fallbacks
    const fallbacks: Record<number, number> = {
      1: 2500, 56: 300, 42161: 2500, 8453: 2500, 137: 0.5,
      10: 2500, 43114: 25, 250: 0.3, 100: 1, 59144: 2500,
      534352: 2500, 81457: 2500,
    };
    return fallbacks[chainId] ?? 2500;
  }

  private async getNativeUsd(chainId: number, balance: bigint): Promise<number> {
    const price = await this.getNativePrice(chainId);
    return Number(ethers.formatEther(balance)) * price;
  }
}
