import { loadConfig } from './config.js';
import { Scanner } from './scanner.js';
import { CHAINS } from './types/index.js';
import { ChainDiscoveryService } from './services/chains.js';
import { PatternCache } from './services/patternCache.js';
import { SelfEvolutionEngine } from './services/selfEvolution.js';
import { sleep } from './utils/helpers.js';
import { isValidEthAddress } from './utils/validation.js';
import { StateManager } from './services/state.js';
import { WalletManager, CHAIN_NAMES, NATIVE_SYMBOLS, MIN_BALANCES } from './services/walletManager.js';
import { ethers } from 'ethers';

const HELP = `
White-Rabbit: Autonomous Smart Contract Vulnerability Scanner

Usage:
  npx tsx src/cli.ts audit <address> [--chain <name>]
  npx tsx src/cli.ts scan <network|top5|top10>
  npx tsx src/cli.ts scan-top [N] [--min-tvl <usd>]
  npx tsx src/cli.ts chains [--top <n>]
  npx tsx src/cli.ts protocols <network> [--min-tvl <usd>]
  npx tsx src/cli.ts auto [--networks <list>] [--top-chains <n>] [--min-tvl <usd>] [--interval <min>]
  npx tsx src/cli.ts stats
  npx tsx src/cli.ts findings [--limit <n>]

Commands:
  audit       Audit a single contract address
  scan        Scan a network (or top5/top10) for vulnerabilities
  scan-top    Scan top N chains by TVL
  chains      Show top chains ranked by TVL from DeFiLlama
  protocols   List high-TVL protocols on a network
  auto        Start autonomous scanning loop
  stats       Show scanner status and statistics
  findings    Show recent verified/likely-real findings
  wallet:init      Initialize verification wallet (generates mnemonic)
  wallet:balances  Check wallet balances across all chains
  wallet:fund      Show deposit address for gas funding
  patterns         Show learned vulnerability patterns
  knowledge        Show learning statistics and evolution history
  evolve           Run self-evolution cycle (refine patterns, analyze FPs)

Options:
  --chain <name>       Chain name (default: ethereum)
  --top <n>            Number of top chains to show/scan (default: 10)
  --top-chains <n>     Scan top N chains in auto mode (overrides --networks)
  --min-tvl <usd>      Minimum TVL threshold (default: 10000000)
  --networks <list>    Comma-separated networks (default: ethereum,base,arbitrum)
  --interval <min>     Minutes between scan cycles in auto mode (default: 30)
  --limit <n>          Number of findings to show (default: 10)
  --help               Show this help
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  // Lightweight commands that don't need the full scanner
  if (command === 'stats') {
    runStats();
    return;
  }
  if (command === 'findings') {
    runFindings(args.slice(1));
    return;
  }
  if (command === 'chains') {
    await runChains(args.slice(1));
    return;
  }
  if (command === 'wallet:init') {
    await runWalletInit(args.slice(1));
    return;
  }
  if (command === 'wallet:balances') {
    await runWalletBalances(args.slice(1));
    return;
  }
  if (command === 'wallet:fund') {
    await runWalletFund();
    return;
  }
  if (command === 'patterns') {
    runPatterns(args.slice(1));
    return;
  }
  if (command === 'knowledge') {
    runKnowledge();
    return;
  }
  if (command === 'evolve') {
    runEvolve();
    return;
  }

  const config = loadConfig();
  const scanner = new Scanner(config);

  // Graceful shutdown for scanner-using commands
  const handleSignal = async (signal: string) => {
    console.log(`\n${signal} received, shutting down scanner...`);
    await scanner.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => { handleSignal('SIGINT'); });
  process.on('SIGTERM', () => { handleSignal('SIGTERM'); });

  try {
    switch (command) {
      case 'audit':
        await runAudit(scanner, args.slice(1));
        break;
      case 'scan':
        await runScan(scanner, args.slice(1), config);
        break;
      case 'scan-top':
        await runScanTop(scanner, args.slice(1), config);
        break;
      case 'protocols':
        await runProtocols(scanner, args.slice(1), config);
        break;
      case 'auto':
        await runAuto(scanner, args.slice(1), config);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } finally {
    await scanner.shutdown();
  }
}

// ── chains ──

async function runChains(args: string[]) {
  const topN = Number(getFlag(args, '--top') ?? 10);
  const discovery = new ChainDiscoveryService();

  console.log('Fetching chain TVL rankings from DeFiLlama...\n');
  const chains = await discovery.getAllChainsByTvl(topN + 5); // fetch extra to show non-EVM
  console.log(discovery.formatChainRankings(chains, topN));

  const scannable = chains.filter(c => c.scannable).length;
  console.log(`\n${scannable} of ${Math.min(topN, chains.length)} chains are scannable.`);
  console.log('Run "scan top10" to scan all supported chains.');
}

// ── audit ──

async function runAudit(scanner: Scanner, args: string[]) {
  const address = args[0];
  if (!address) {
    console.error('Error: contract address required');
    console.error('Usage: audit <address> [--chain <name>]');
    process.exit(1);
  }
  if (!isValidEthAddress(address)) {
    console.error('Error: invalid Ethereum address (expected 0x + 40 hex characters)');
    process.exit(1);
  }

  const chainName = getFlag(args, '--chain') ?? getFlag(args, '-n') ?? 'ethereum';

  // Try static CHAINS first, then dynamic discovery
  let chainId: number;
  let displayName: string;
  const staticChain = CHAINS[chainName.toLowerCase()];
  if (staticChain) {
    chainId = staticChain.chainId;
    displayName = staticChain.name;
  } else {
    const dynChain = scanner.chainDiscovery.getChainConfig(chainName);
    if (!dynChain) {
      const supported = scanner.chainDiscovery.getSupportedChains();
      console.error(`Unknown chain: ${chainName}`);
      console.error(`Available: ${supported.map(c => c.slug).join(', ')}`);
      process.exit(1);
    }
    chainId = dynChain.chainId;
    displayName = dynChain.name;
  }

  console.log(`Auditing ${address} on ${displayName} (chain ID: ${chainId})\n`);

  const findings = await scanner.scanContract(address, chainId);

  // Record findings in state
  const state = new StateManager();
  for (const f of findings) {
    if (f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real') {
      state.addFinding({
        id: f.id,
        timestamp: new Date().toISOString(),
        contractAddress: address,
        contractName: f.title || address,
        chain: displayName,
        detector: f.detectorName,
        severity: f.severity,
        confidenceScore: f.confidenceScore,
        verificationStatus: f.verificationStatus,
        description: f.description.slice(0, 200),
        exploitableValue: f.exploitEstimate?.estimatedExploitable ?? 0,
        pocExtractedValue: f.pocResult?.extractedValue?.extractedValueUsd ?? null,
      });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Audit complete: ${findings.length} findings\n`);

  // Group by verification status
  const byStatus: Record<string, typeof findings> = {};
  for (const f of findings) {
    const status = f.verificationStatus;
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(f);
  }

  for (const [status, group] of Object.entries(byStatus)) {
    console.log(`${status.toUpperCase()} (${group.length}):`);
    for (const f of group) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.detectorName} (confidence: ${f.confidenceScore}%)`);
      if (f.description) {
        const desc = f.description.length > 120 ? f.description.slice(0, 117) + '...' : f.description;
        console.log(`    ${desc}`);
      }
    }
    console.log();
  }
}

// ── scan ──

async function runScan(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const network = args[0];
  if (!network) {
    console.error('Error: network name required');
    console.error('Usage: scan <network|top5|top10>');
    process.exit(1);
  }

  // Handle top5/top10 shortcuts
  const topMatch = network.match(/^top(\d+)$/i);
  if (topMatch) {
    const n = parseInt(topMatch[1], 10);
    return runScanTop(scanner, [String(n), ...args.slice(1)], config);
  }

  // Try static chains first, then dynamic
  const chain = CHAINS[network.toLowerCase()];
  if (!chain) {
    const dynChain = scanner.chainDiscovery.getChainConfig(network);
    if (dynChain) {
      console.log(`Scanning ${dynChain.name} for vulnerable protocols (min TVL: $${(config.minTvlThreshold / 1e6).toFixed(0)}M)\n`);
      const summary = await scanner.scanTopChains(1, config.minTvlThreshold);
      const state = new StateManager();
      state.recordScan(network, summary.contractsAnalyzed, summary.verifiedFindings, summary.likelyRealFindings, summary.falsePositivesFiltered, summary.alertsSent);
      return;
    }
    const supported = scanner.chainDiscovery.getSupportedChains();
    console.error(`Unknown network: ${network}`);
    console.error(`Available: ${Object.keys(CHAINS).join(', ')}`);
    console.error(`Dynamic: ${supported.map(c => c.slug).join(', ')}`);
    console.error(`Shortcuts: top5, top10`);
    process.exit(1);
  }

  console.log(`Scanning ${chain.name} for vulnerable protocols (min TVL: $${(config.minTvlThreshold / 1e6).toFixed(0)}M)\n`);

  const summary = await scanner.runFullScan();

  // Record stats
  const state = new StateManager();
  state.recordScan(
    network,
    summary.contractsAnalyzed,
    summary.verifiedFindings,
    summary.likelyRealFindings,
    summary.falsePositivesFiltered,
    summary.alertsSent,
  );

  if (summary.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of summary.errors) {
      console.log(`  - ${err}`);
    }
  }
}

// ── scan-top ──

async function runScanTop(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const topN = Number(args[0] ?? getFlag(args, '--top') ?? 10);
  const minTvl = Number(getFlag(args, '--min-tvl') ?? config.minTvlThreshold);

  // Show what we're about to scan
  const chains = await scanner.chainDiscovery.getTopChainsByTvl(topN);
  console.log(`Scanning top ${topN} EVM chains by TVL\n`);
  console.log(`Targets: ${chains.map(c => c.name).join(', ')}`);
  console.log(`Min TVL: $${formatTvlCompact(minTvl)}`);
  console.log(`Mode: Full sweep\n`);

  const summary = await scanner.scanTopChains(topN, minTvl);

  // Record stats per chain
  const state = new StateManager();
  for (const chain of chains) {
    state.recordScan(
      chain.slug,
      Math.ceil(summary.contractsAnalyzed / chains.length),
      summary.verifiedFindings,
      summary.likelyRealFindings,
      summary.falsePositivesFiltered,
      summary.alertsSent,
    );
  }
  state.updateConfig({
    networks: chains.map(c => c.slug),
    minTvlUsd: minTvl,
  });

  if (summary.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of summary.errors) {
      console.log(`  - ${err}`);
    }
  }
}

// ── protocols ──

async function runProtocols(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const network = args[0];
  if (!network) {
    console.error('Error: network name required');
    console.error('Usage: protocols <network> [--min-tvl <usd>]');
    process.exit(1);
  }

  // Support both static and dynamic chains
  const chain = CHAINS[network.toLowerCase()];
  const dynChain = chain ? null : scanner.chainDiscovery.getChainConfig(network);
  if (!chain && !dynChain) {
    const supported = scanner.chainDiscovery.getSupportedChains();
    console.error(`Unknown network: ${network}`);
    console.error(`Available: ${[...Object.keys(CHAINS), ...supported.map(c => c.slug)].join(', ')}`);
    process.exit(1);
  }

  const displayName = chain?.name ?? dynChain!.name;
  const minTvl = Number(getFlag(args, '--min-tvl') ?? config.minTvlThreshold);

  console.log(`Top protocols on ${displayName} (TVL >= $${(minTvl / 1e6).toFixed(0)}M):\n`);

  const protocols = await scanner.listProtocols(network, minTvl);

  if (protocols.length === 0) {
    console.log('No protocols found matching criteria.');
    return;
  }

  console.log(`${'#'.padStart(4)}  ${'Protocol'.padEnd(30)}  ${'TVL'.padStart(15)}`);
  console.log(`${'-'.repeat(4)}  ${'-'.repeat(30)}  ${'-'.repeat(15)}`);

  for (let i = 0; i < protocols.length; i++) {
    const p = protocols[i];
    const tvlStr = `$${(p.tvl / 1e6).toFixed(1)}M`;
    console.log(`${String(i + 1).padStart(4)}  ${p.name.padEnd(30)}  ${tvlStr.padStart(15)}`);
  }

  console.log(`\nTotal: ${protocols.length} protocols`);
}

// ── auto ──

async function runAuto(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const intervalMin = Number(getFlag(args, '--interval') ?? 30);
  const intervalMs = intervalMin * 60 * 1000;
  const topChainsN = getFlag(args, '--top-chains');

  const state = new StateManager();
  state.setAutonomous(true);

  // Determine target chains
  let targetLabel: string;
  if (topChainsN) {
    const n = Number(topChainsN);
    const chains = await scanner.chainDiscovery.getTopChainsByTvl(n);
    targetLabel = `Top ${n} chains: ${chains.map(c => c.name).join(', ')}`;
    state.updateConfig({
      networks: chains.map(c => c.slug),
      minTvlUsd: config.minTvlThreshold,
      intervalMinutes: intervalMin,
      alertThreshold: config.alertMinSeverity,
    });
  } else {
    targetLabel = `Networks: ${config.scanChains.map(c => c.name).join(', ')}`;
    state.updateConfig({
      networks: config.scanChains.map(c => c.name.toLowerCase()),
      minTvlUsd: config.minTvlThreshold,
      intervalMinutes: intervalMin,
      alertThreshold: config.alertMinSeverity,
    });
  }

  console.log('Starting autonomous scanning mode');
  console.log(`  ${targetLabel}`);
  console.log(`  Min TVL: $${(config.minTvlThreshold / 1e6).toFixed(0)}M`);
  console.log(`  Scan interval: ${intervalMin} minutes`);
  console.log(`  Alert threshold: ${config.alertMinSeverity}+`);
  console.log(`  Verification pipeline: 6-stage with FP filtering`);
  console.log();

  let cycle = 0;

  const shutdown = () => {
    console.log('\nShutting down autonomous scanner...');
    state.setAutonomous(false);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (true) {
    cycle++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scan cycle #${cycle} starting at ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    try {
      let summary;
      if (topChainsN) {
        summary = await scanner.scanTopChains(Number(topChainsN), config.minTvlThreshold);
      } else {
        summary = await scanner.runFullScan();
      }

      const networks = topChainsN
        ? (await scanner.chainDiscovery.getTopChainsByTvl(Number(topChainsN))).map(c => c.slug)
        : config.scanChains.map(c => c.name.toLowerCase());

      for (const network of networks) {
        state.recordScan(
          network,
          Math.ceil(summary.contractsAnalyzed / networks.length),
          summary.verifiedFindings,
          summary.likelyRealFindings,
          summary.falsePositivesFiltered,
          summary.alertsSent,
        );
      }
    } catch (err) {
      console.error(`Cycle #${cycle} failed:`, err);
    }

    console.log(`\nNext scan in ${intervalMin} minutes...`);
    await sleep(intervalMs);
  }
}

// ── stats & findings ──

function runStats() {
  const state = new StateManager();
  console.log(state.formatStatus());
}

function runFindings(args: string[]) {
  const limit = Number(getFlag(args, '--limit') ?? 10);
  const state = new StateManager();
  const findings = state.getVerifiedFindings(limit);

  if (findings.length === 0) {
    console.log('No verified or likely-real findings recorded yet.');
    return;
  }

  console.log(`Recent verified/likely-real findings (${findings.length}):\n`);

  for (const f of findings) {
    const statusIcon = f.verificationStatus === 'verified' ? 'VERIFIED' : 'LIKELY REAL';
    console.log(`[${f.severity.toUpperCase()}] ${statusIcon} - ${f.detector}`);
    console.log(`  Contract: ${f.contractAddress} (${f.chain})`);
    console.log(`  Confidence: ${f.confidenceScore}%`);
    console.log(`  ${f.description}`);
    console.log(`  Found: ${f.timestamp}`);
    console.log();
  }
}

// ── Wallet Commands ──

async function runWalletInit(args: string[]) {
  if (WalletManager.walletExists()) {
    console.error('Wallet already exists at:', WalletManager.getWalletPath());
    console.error('Delete it first if you want to re-initialize.');
    process.exit(1);
  }

  const password = getWalletPassword(args);
  if (!password) {
    console.error('Error: password required');
    console.error('Usage: wallet:init --password <password>');
    console.error('Or set WALLET_ENCRYPTION_PASSWORD or WALLET_PASSWORD_FILE env var');
    process.exit(1);
  }

  const { mnemonic, address } = await WalletManager.initializeNew(password);

  console.log('\nWallet initialized!\n');
  console.log(`Address (same on all chains): ${address}`);
  console.log('\nBACKUP YOUR MNEMONIC SECURELY:');
  console.log('-'.repeat(50));
  console.log(mnemonic);
  console.log('-'.repeat(50));
  console.log('\nThis will only be shown once!\n');
  console.log('Next steps:');
  console.log('1. Fund the wallet with small amounts on each chain for gas');
  console.log('2. Run "wallet:balances" to check balances');
  console.log('3. Recommended amounts per chain:');

  for (const [chainIdStr, amount] of Object.entries(MIN_BALANCES)) {
    const chainId = parseInt(chainIdStr, 10);
    const name = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
    const symbol = NATIVE_SYMBOLS[chainId] ?? 'ETH';
    console.log(`   ${name}: ${ethers.formatEther(amount)} ${symbol}`);
  }
}

async function runWalletBalances(args: string[]) {
  if (!WalletManager.walletExists()) {
    console.error('No wallet found. Run "wallet:init" first.');
    process.exit(1);
  }

  const password = getWalletPassword(args);
  if (!password) {
    console.error('Error: password required');
    console.error('Usage: wallet:balances --password <password>');
    console.error('Or set WALLET_ENCRYPTION_PASSWORD or WALLET_PASSWORD_FILE env var');
    process.exit(1);
  }

  const wm = new WalletManager();
  await wm.unlock(password);

  console.log(`\nChecking balances across all chains...\n`);
  console.log(`Wallet Address: ${wm.getAddress()}\n`);

  const balances = await wm.checkAllBalances();
  if (balances.length === 0) {
    console.log('No chains configured. Set RPC URL env vars (ETH_RPC_URL, etc.).');
    wm.destroy();
    return;
  }

  let totalUsd = 0;
  console.log(`${'Chain'.padEnd(20)} ${'Balance'.padEnd(18)} ${'USD Value'.padEnd(12)} Status`);
  console.log('-'.repeat(65));

  for (const b of balances) {
    const balStr = b.nativeFormatted.slice(0, 12).padEnd(18);
    const usdStr = `$${b.usd.toFixed(2)}`.padEnd(12);
    const status = b.status === 'ok' ? 'OK' : b.status === 'low' ? 'LOW' : 'EMPTY';
    console.log(`${b.chainName.padEnd(20)} ${balStr} ${usdStr} ${status}`);
    totalUsd += b.usd;
  }

  console.log('-'.repeat(65));
  console.log(`Total Value: $${totalUsd.toFixed(2)}`);

  const needsFunding = wm.getRefundingNeeded();
  if (needsFunding.length > 0) {
    console.log('\nChains needing gas funding:');
    for (const { chainName, symbol, needed } of needsFunding) {
      console.log(`  ${chainName}: needs ${ethers.formatEther(needed)} ${symbol} more`);
    }
  }

  wm.destroy();
}

async function runWalletFund() {
  if (!WalletManager.walletExists()) {
    console.error('No wallet found. Run "wallet:init" first.');
    process.exit(1);
  }

  const password = getWalletPassword([]);
  if (!password) {
    console.error('Error: set WALLET_ENCRYPTION_PASSWORD or WALLET_PASSWORD_FILE env var');
    process.exit(1);
  }

  const wm = new WalletManager();
  await wm.unlock(password);
  const address = wm.getAddress();

  console.log('\nFund Your Verification Wallet\n');
  console.log(`Address (same on all EVM chains): ${address}\n`);
  console.log('Recommended amounts for gas:');
  console.log('-'.repeat(50));

  for (const [chainIdStr, amount] of Object.entries(MIN_BALANCES)) {
    const chainId = parseInt(chainIdStr, 10);
    const name = (CHAIN_NAMES[chainId] ?? `Chain ${chainId}`).padEnd(15);
    const symbol = NATIVE_SYMBOLS[chainId] ?? 'ETH';
    console.log(`${name} ${ethers.formatEther(amount)} ${symbol}`);
  }

  console.log('\nThese are small amounts just for gas to run simulations.');
  console.log('The wallet never executes actual exploits on mainnet.');

  wm.destroy();
}

// ── Intelligence Commands ──

function runPatterns(args: string[]) {
  const cache = new PatternCache();
  const patterns = cache.getAllPatterns();

  if (patterns.length === 0) {
    console.log('No vulnerability patterns learned yet.');
    console.log('Patterns are learned automatically when verified findings are discovered.');
    cache.close();
    return;
  }

  const topN = Number(getFlag(args, '--top') ?? 20);
  const typeFilter = getFlag(args, '--type');

  const filtered = typeFilter
    ? patterns.filter(p => p.patternType === typeFilter)
    : patterns;

  console.log(`Learned Vulnerability Patterns (${filtered.length} total)\n`);
  console.log(`${'#'.padStart(3)}  ${'Type'.padEnd(22)}  ${'Instances'.padStart(9)}  ${'Value'.padStart(12)}  ${'Accuracy'.padStart(8)}  ${'First Seen'.padEnd(12)}`);
  console.log(`${'-'.repeat(3)}  ${'-'.repeat(22)}  ${'-'.repeat(9)}  ${'-'.repeat(12)}  ${'-'.repeat(8)}  ${'-'.repeat(12)}`);

  for (let i = 0; i < Math.min(filtered.length, topN); i++) {
    const p = filtered[i];
    const instances = cache.getPatternInstances(p.id);
    const valueStr = p.totalValueAtRisk >= 1e6
      ? `$${(p.totalValueAtRisk / 1e6).toFixed(1)}M`
      : p.totalValueAtRisk >= 1e3
      ? `$${(p.totalValueAtRisk / 1e3).toFixed(0)}K`
      : `$${p.totalValueAtRisk.toFixed(0)}`;
    const accuracy = `${(p.truePositiveRate * 100).toFixed(0)}%`;
    const date = p.firstSeenDate.slice(0, 10);

    console.log(
      `${String(i + 1).padStart(3)}  ${p.patternType.padEnd(22)}  ${String(instances.length).padStart(9)}  ${valueStr.padStart(12)}  ${accuracy.padStart(8)}  ${date.padEnd(12)}`,
    );
  }

  // Summary
  const totalValue = filtered.reduce((s, p) => s + p.totalValueAtRisk, 0);
  const avgAccuracy = filtered.reduce((s, p) => s + p.truePositiveRate, 0) / (filtered.length || 1);
  console.log(`\nTotal value tracked: $${totalValue.toLocaleString()}`);
  console.log(`Average accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
  console.log(`Fingerprints cached: ${cache.getFingerprintCount()}`);

  cache.close();
}

function runKnowledge() {
  const cache = new PatternCache();
  const evolution = new SelfEvolutionEngine(cache);
  const stats = evolution.getEvolutionStats();

  console.log('Learning & Knowledge Report\n');
  console.log(`Patterns learned:     ${stats.totalPatterns}`);
  console.log(`Pattern instances:    ${stats.totalInstances}`);
  console.log(`Fingerprints cached:  ${stats.totalFingerprints}`);
  console.log(`Total value tracked:  $${stats.totalValueTracked.toLocaleString()}`);
  console.log(`Overall accuracy:     ${(stats.overallAccuracy * 100).toFixed(1)}%`);
  console.log(`Learning velocity:    ${stats.learningVelocity > 0 ? '+' : ''}${stats.learningVelocity.toFixed(0)}% (week-over-week)`);

  if (stats.topPatterns.length > 0) {
    console.log('\nTop Patterns by Value:');
    for (const tp of stats.topPatterns.slice(0, 5)) {
      const valueStr = tp.totalValue >= 1e6
        ? `$${(tp.totalValue / 1e6).toFixed(1)}M`
        : `$${(tp.totalValue / 1e3).toFixed(0)}K`;
      console.log(`  ${tp.patternType}: ${valueStr} (${tp.instanceCount} instances, ${(tp.avgAccuracy * 100).toFixed(0)}% accuracy)`);
    }
  }

  if (stats.patternsByType.length > 0) {
    console.log('\nPatterns by Type:');
    for (const pt of stats.patternsByType) {
      console.log(`  ${pt.patternType}: ${pt.count} patterns, $${pt.value.toLocaleString()} value`);
    }
  }

  if (stats.recentLearningEvents.length > 0) {
    console.log('\nRecent Learning Events (last 7 days):');
    for (const ev of stats.recentLearningEvents) {
      console.log(`  ${ev.eventType}: ${ev.count}`);
    }
  }

  if (stats.evolutionHistory.length > 0) {
    console.log('\nEvolution History (last 30 days):');
    console.log(`${'Date'.padEnd(12)} ${'TP'.padStart(4)} ${'FP'.padStart(4)} ${'New'.padStart(4)}`);
    for (const eh of stats.evolutionHistory.slice(0, 10)) {
      console.log(`${eh.date.padEnd(12)} ${String(eh.truePositives).padStart(4)} ${String(eh.falsePositives).padStart(4)} ${String(eh.newPatterns).padStart(4)}`);
    }
  }

  cache.close();
}

function runEvolve() {
  const cache = new PatternCache();
  const evolution = new SelfEvolutionEngine(cache);

  console.log('Running self-evolution cycle...\n');
  const report = evolution.evolve();
  console.log(`\n${report.summary}`);

  cache.close();
}

// ── Helpers ──

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function getWalletPassword(args: string[]): string | undefined {
  const fromFlag = getFlag(args, '--password');
  if (fromFlag) return fromFlag;
  if (process.env.WALLET_ENCRYPTION_PASSWORD) return process.env.WALLET_ENCRYPTION_PASSWORD;
  if (process.env.WALLET_PASSWORD_FILE) {
    try {
      const fs = require('fs');
      return fs.readFileSync(process.env.WALLET_PASSWORD_FILE, 'utf8').trim();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function formatTvlCompact(tvl: number): string {
  if (tvl >= 1e9) return `${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `${(tvl / 1e6).toFixed(0)}M`;
  if (tvl >= 1e3) return `${(tvl / 1e3).toFixed(0)}K`;
  return String(tvl);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
