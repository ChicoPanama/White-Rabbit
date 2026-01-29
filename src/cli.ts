import 'dotenv/config';
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
import { ForkHunterV2 } from './services/fork-hunter-v2.js';
import { huntingMemory, TVL_TIERS } from './services/huntingMemory.js';
import { getProtocolContracts } from './data/protocol-contracts.js';
import { ethers } from 'ethers';
import { Database } from './database.js';
import { initRedisCache } from './services/redis-cache.js';

const HELP = `
White-Rabbit: Autonomous Smart Contract Vulnerability Scanner

Usage:
  npx tsx src/cli.ts audit <address> [--chain <name>]
  npx tsx src/cli.ts scan <network|top5|top10>
  npx tsx src/cli.ts scan-top [N] [--min-tvl <usd>]
  npx tsx src/cli.ts chains [--top <n>]
  npx tsx src/cli.ts protocols <network> [--min-tvl <usd>]
  npx tsx src/cli.ts auto [--networks <list>] [--top-chains <n>] [--min-tvl <usd>] [--interval <min>]
  npx tsx src/cli.ts hunt [--chains <list>] [--min-tvl <usd>] [--max-spend <usd>] [--interval <min>]
  npx tsx src/cli.ts hunt-forks [--hack <id|all>] [--min-tvl <usd>] [--chains <list>]
  npx tsx src/cli.ts micro [--chain <name>] [--min-tvl <usd>] [--max-tvl <usd>] [--tier <1-5>]
  npx tsx src/cli.ts sessions [--list]
  npx tsx src/cli.ts stats
  npx tsx src/cli.ts findings [--limit <n>]

Commands:
  audit       Audit a single contract address
  scan        Scan a network (or top5/top10) for vulnerabilities
  scan-top    Scan top N chains by TVL
  chains      Show top chains ranked by TVL from DeFiLlama
  protocols   List high-TVL protocols on a network
  auto        Start autonomous scanning loop
  hunt        Continuous cost-optimized scanning (tiered AI, budget controls)
  hunt-forks  Hunt for unpatched forks of known hacked protocols
  micro       Micro-protocol hunting ($10K-$10M TVL range, prioritized targets)
  sessions    List hunting sessions and learning data
  stats       Show scanner status and statistics
  findings    Show recent verified/likely-real findings
  wallet:init      Initialize verification wallet (generates mnemonic)
  wallet:balances  Check wallet balances across all chains
  wallet:fund      Show deposit address for gas funding
  memory           Get memory bundle for a contract (AI history, findings, tags)
  patterns         Show learned vulnerability patterns
  knowledge        Show learning statistics and evolution history
  evolve           Run self-evolution cycle (refine patterns, analyze FPs)

Options:
  --chain <name>       Chain name (default: ethereum, micro default: base)
  --chains <list>      Comma-separated chains for hunt mode (default: top 10 by TVL)
  --top <n>            Number of top chains to show/scan (default: 10)
  --top-chains <n>     Scan top N chains in auto mode (overrides --networks)
  --min-tvl <usd>      Minimum TVL threshold (default: 10000000, micro: 10000)
  --max-tvl <usd>      Maximum TVL threshold (micro mode only, default: 1000000)
  --tier <1-5>         TVL tier for micro hunting (1=$10K-100K, 5=$5M-10M)
  --hack <id>          Specific hack ID to hunt (default: all). Use 'list' to see IDs
  --max-spend <usd>    Max daily AI spend in USD for hunt mode (default: 1.00)
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
  if (command === 'memory') {
    await runMemory(args.slice(1));
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
  if (command === 'sessions') {
    await runSessions(args.slice(1));
    return;
  }

  const config = loadConfig();
  
  // Initialize wallet manager if wallet exists and password available
  let walletManager = null;
  if (WalletManager.walletExists()) {
    const password = process.env.WALLET_ENCRYPTION_PASSWORD || 
                    (process.env.WALLET_PASSWORD_FILE ? 
                     require('fs').readFileSync(process.env.WALLET_PASSWORD_FILE, 'utf8').trim() : null);
    
    if (password) {
      try {
        walletManager = new WalletManager();
        await walletManager.unlock(password);
        console.log('Wallet unlocked for enhanced verification:', walletManager.getAddress());
      } catch (error) {
        console.log('Failed to unlock wallet:', error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  const scanner = new Scanner(config, walletManager);

  // Graceful shutdown for scanner-using commands
  const handleSignal = async (signal: string) => {
    console.log(`\n${signal} received, shutting down scanner...`);
    await scanner.shutdown();
    if (walletManager) {
      walletManager.destroy();
    }
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
      case 'hunt':
        await runHunt(scanner, args.slice(1), config);
        break;
      case 'hunt-forks':
        await runHuntForks(scanner, args.slice(1), config);
        break;
      case 'micro':
        await runMicroHunt(scanner, args.slice(1), config);
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

// ── hunt (cost-optimized continuous scanning) ──

async function runHunt(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const intervalMin = Number(getFlag(args, '--interval') ?? 30);
  const intervalMs = intervalMin * 60 * 1000;
  const minTvl = Number(getFlag(args, '--min-tvl') ?? config.minTvlThreshold);
  const maxSpend = getFlag(args, '--max-spend');
  const chainsArg = getFlag(args, '--chains');

  // Override AI spend limit if --max-spend is provided
  if (maxSpend) {
    config.ai.maxSpendPerDay = Number(maxSpend);
  }

  const state = new StateManager();
  state.setAutonomous(true);

  // Determine target chains
  let targetChains: string[];
  if (chainsArg) {
    targetChains = chainsArg.split(',').map(c => c.trim().toLowerCase());
  } else {
    const topChains = await scanner.chainDiscovery.getTopChainsByTvl(10);
    targetChains = topChains.map(c => c.slug);
  }

  state.updateConfig({
    networks: targetChains,
    minTvlUsd: minTvl,
    intervalMinutes: intervalMin,
    alertThreshold: config.alertMinSeverity,
  });

  const costTracker = scanner.getCostTracker();

  console.log('Starting cost-optimized continuous scanning (hunt mode)');
  console.log(`  Chains: ${targetChains.join(', ')}`);
  console.log(`  Min TVL: $${formatTvlCompact(minTvl)}`);
  console.log(`  Scan interval: ${intervalMin} minutes`);
  console.log(`  AI budget: ${config.ai.maxCallsPerHour} calls/hr, $${config.ai.maxSpendPerDay.toFixed(2)}/day`);
  console.log(`  AI models: haiku=${config.ai.modelHaiku}, sonnet=${config.ai.modelSonnet}`);
  console.log(`  Local FP filter: enabled`);
  console.log();

  let cycle = 0;

  const shutdown = () => {
    console.log('\nShutting down hunt mode...');
    if (costTracker) {
      const summary = costTracker.getSummary();
      console.log(`  AI usage: ${summary.totalCalls} calls, $${summary.totalSpend.toFixed(4)} total`);
    }
    state.setAutonomous(false);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (true) {
    cycle++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Hunt cycle #${cycle} at ${new Date().toISOString()}`);
    if (costTracker) {
      const summary = costTracker.getSummary();
      console.log(`  AI budget: ${summary.hourCalls}/${config.ai.maxCallsPerHour} calls/hr, $${summary.daySpend.toFixed(4)}/$${config.ai.maxSpendPerDay.toFixed(2)} today`);
    }
    console.log('='.repeat(60));

    try {
      const summary = await scanner.scanTopChains(targetChains.length, minTvl);

      for (const network of targetChains) {
        state.recordScan(
          network,
          Math.ceil(summary.contractsAnalyzed / targetChains.length),
          summary.verifiedFindings,
          summary.likelyRealFindings,
          summary.falsePositivesFiltered,
          summary.alertsSent,
        );
      }
    } catch (err) {
      console.error(`Hunt cycle #${cycle} failed:`, err);
    }

    console.log(`\nNext hunt cycle in ${intervalMin} minutes...`);
    await sleep(intervalMs);
  }
}

// ── hunt-forks (target unpatched forks of known hacks) ──

async function runHuntForks(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const hackId = getFlag(args, '--hack') ?? 'all';
  const minTvl = Number(getFlag(args, '--min-tvl') ?? 10_000);
  const chainsArg = getFlag(args, '--chains');

  // Handle 'list' to show available hack IDs
  if (hackId === 'list') {
    const hacks = ForkHunterV2.getHacksSummary();
    console.log(`Known Hacks Database (${hacks.length} entries)\n`);
    console.log(`${'ID'.padEnd(35)} ${'Type'.padEnd(22)} ${'Lost'.padStart(12)} ${'Fork Score'.padStart(10)}`);
    console.log(`${'-'.repeat(35)} ${'-'.repeat(22)} ${'-'.repeat(12)} ${'-'.repeat(10)}`);
    for (const h of hacks) {
      const lost = h.amountLost >= 1e6
        ? `$${(h.amountLost / 1e6).toFixed(0)}M`
        : `$${(h.amountLost / 1e3).toFixed(0)}K`;
      console.log(`${h.id.padEnd(35)} ${h.type.padEnd(22)} ${lost.padStart(12)} ${String(h.forkScore).padStart(10)}`);
    }
    console.log(`\nUse --hack <id> to hunt for a specific hack pattern.`);
    return;
  }

  // Determine target chains
  let chainSlugs: string[];
  if (chainsArg) {
    chainSlugs = chainsArg.split(',').map(c => c.trim().toLowerCase());
  } else {
    const topChains = await scanner.chainDiscovery.getTopChainsByTvl(10);
    chainSlugs = topChains.map(c => c.slug);
  }

  // Build ForkHunterV2 using scanner's internal services
  const hunter = scanner.createForkHunterV2();

  const hackLabel = hackId === 'all' ? 'all known hacks' : hackId;
  console.log(`Hunting unpatched forks of ${hackLabel} across ${chainSlugs.length} chains\n`);
  console.log(`  Chains: ${chainSlugs.join(', ')}`);
  console.log(`  Min TVL: $${formatTvlCompact(minTvl)}`);
  console.log(`  Mode: Code pattern matching + Slither verification`);
  console.log(`  AI cost: $0 (no AI needed for fork hunting)\n`);

  const summary = await hunter.huntAll(chainSlugs, minTvl, hackId);

  // Results
  console.log(`\n${'='.repeat(60)}`);
  console.log('Fork Hunt Results');
  console.log('='.repeat(60));
  console.log(`  Hacks scanned: ${summary.hacksScanned}`);
  console.log(`  Chains searched: ${summary.chainsSearched}`);
  console.log(`  Contracts examined: ${summary.contractsExamined}`);
  console.log(`  Patched forks found: ${summary.patchedForksFound}`);
  console.log(`  Duration: ${(summary.duration / 1000).toFixed(1)}s`);

  if (summary.vulnerableForksFound.length > 0) {
    console.log(`\n  VULNERABLE FORKS: ${summary.vulnerableForksFound.length}`);
    console.log(`  TOTAL VALUE AT RISK: $${summary.totalValueAtRisk.toLocaleString()}\n`);

    for (const fork of summary.vulnerableForksFound) {
      const tvlStr = fork.tvl >= 1e6
        ? `$${(fork.tvl / 1e6).toFixed(1)}M`
        : fork.tvl >= 1e3
        ? `$${(fork.tvl / 1e3).toFixed(0)}K`
        : `$${fork.tvl.toFixed(0)}`;
      const confStr = `${(fork.confidence * 100).toFixed(0)}%`;
      const bountyStr = fork.immunefiBounty ? ' [Immunefi bounty available]' : '';
      const methodStr = fork.verificationMethod === 'code_and_slither'
        ? 'Code + Slither'
        : 'Code pattern';

      console.log(`  ${fork.chain}: ${fork.name} (${fork.address})`);
      console.log(`    Original hack: ${fork.hack.name}`);
      console.log(`    TVL: ${tvlStr}, Confidence: ${confStr}, Verified: ${methodStr}${bountyStr}`);
      console.log();
    }
  } else {
    console.log('\n  No vulnerable forks found. All clear.');
  }

  // Record findings in state
  const state = new StateManager();
  for (const fork of summary.vulnerableForksFound) {
    state.addFinding({
      id: `fork-${fork.hack.id}-${fork.chain}-${fork.address.slice(0, 10)}`,
      timestamp: new Date().toISOString(),
      contractAddress: fork.address,
      contractName: fork.name,
      chain: fork.chain,
      detector: fork.hack.vulnerability.detectors[0] ?? fork.hack.vulnerability.type,
      severity: 'high',
      confidenceScore: Math.round(fork.confidence * 100),
      verificationStatus: fork.verificationMethod === 'code_and_slither' ? 'verified' : 'likely_real',
      description: `Unpatched fork of ${fork.hack.name} ($${(fork.hack.amountLost / 1e6).toFixed(0)}M hack)`,
      exploitableValue: fork.tvl,
      pocExtractedValue: null,
    });
  }
}

// ── micro-protocol hunting ──

async function runMicroHunt(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const chain = getFlag(args, '--chain') ?? config.microProtocol.primaryChain;
  const tierNum = getFlag(args, '--tier');

  // Determine TVL range from tier or flags
  let minTvl: number;
  let maxTvl: number;
  let tierName: string;

  if (tierNum) {
    const tierIndex = parseInt(tierNum, 10) - 1;
    if (tierIndex < 0 || tierIndex >= TVL_TIERS.length) {
      console.error(`Invalid tier: ${tierNum}. Valid tiers: 1-${TVL_TIERS.length}`);
      process.exit(1);
    }
    const tier = TVL_TIERS[tierIndex];
    minTvl = tier.min;
    maxTvl = tier.max;
    tierName = tier.name;
  } else {
    minTvl = Number(getFlag(args, '--min-tvl') ?? config.microProtocol.minTvl);
    maxTvl = Number(getFlag(args, '--max-tvl') ?? config.microProtocol.maxTvl);
    tierName = `Custom ($${formatTvlCompact(minTvl)}-$${formatTvlCompact(maxTvl)})`;
  }

  const intervalMin = Number(getFlag(args, '--interval') ?? 30);
  const continuous = args.includes('--continuous') || args.includes('-c');

  // Try to resume existing session or start new
  let session = await huntingMemory.resumeSession();
  if (!session) {
    const tvlRange = `$${formatTvlCompact(minTvl)} - $${formatTvlCompact(maxTvl)}`;
    await huntingMemory.startSession(chain, tvlRange, minTvl, maxTvl);
    session = huntingMemory.getCurrentSession();
  }

  console.log('Micro-Protocol Hunter');
  console.log('='.repeat(50));
  console.log(`  Chain: ${chain}`);
  console.log(`  TVL Range: ${tierName}`);
  console.log(`  Min TVL: $${formatTvlCompact(minTvl)}`);
  console.log(`  Max TVL: $${formatTvlCompact(maxTvl)}`);
  console.log(`  Mode: ${continuous ? 'Continuous' : 'Single scan'}`);
  console.log(`  Session: ${session?.sessionId ?? 'new'}`);
  console.log();

  // Fetch protocols in range
  console.log('Fetching protocols in TVL range...');
  const protocols = await scanner.listProtocols(chain, minTvl);
  const filtered = protocols.filter(p => p.tvl >= minTvl && p.tvl <= maxTvl);

  // Sort by TVL (smaller = higher priority for micro hunting)
  const sorted = [...filtered].sort((a, b) => a.tvl - b.tvl);

  // Categorize by priority based on TVL within range
  const tvlMid = (minTvl + maxTvl) / 2;
  const tier1 = sorted.filter(p => p.tvl <= tvlMid * 0.5);  // Lower quarter
  const tier2 = sorted.filter(p => p.tvl > tvlMid * 0.5 && p.tvl <= tvlMid);  // Mid-low
  const tier3 = sorted.filter(p => p.tvl > tvlMid);  // Upper half
  const totalTvl = filtered.reduce((sum, p) => sum + p.tvl, 0);

  console.log(`\nTarget Summary:`);
  console.log(`  Total protocols in range: ${filtered.length}`);
  console.log(`  Tier 1 (high priority, smallest TVL): ${tier1.length} protocols`);
  console.log(`  Tier 2 (medium priority): ${tier2.length} protocols`);
  console.log(`  Tier 3 (lower priority, larger TVL): ${tier3.length} protocols`);
  console.log(`  Total TVL in range: $${formatTvlCompact(totalTvl)}`);
  console.log();

  // Add targets to session (prioritize smaller TVL first)
  for (const p of sorted.slice(0, 50)) {
    const priority = tier1.includes(p) ? 'EXTREME' :
                     tier2.includes(p) ? 'HIGH' : 'MEDIUM';
    await huntingMemory.addTarget(p.name, `$${formatTvlCompact(p.tvl)}`, priority, p.slug);
  }

  // Scan loop
  const state = new StateManager();
  const scanTargets = async () => {
    let target = huntingMemory.getNextTarget();
    let scanned = 0;

    while (target) {
      console.log(`\nScanning: ${target.protocol} (${target.tvl}, ${target.priority} priority)`);
      await huntingMemory.updateTarget(target.protocol, 'SCANNING');

      try {
        // Find protocol in our list - use slug for identification
        const protocol = filtered.find(p => p.name === target!.protocol || p.slug === target!.address);
        const chainConfig = CHAINS[chain.toLowerCase()] ?? scanner.chainDiscovery.getChainConfig(chain);

        if (protocol && chainConfig) {
          // Get contract addresses for this protocol
          const contracts = getProtocolContracts(protocol.slug, chainConfig.chainId);

          if (contracts.length === 0) {
            console.log(`  No known contracts for ${protocol.name} on chain ${chainConfig.chainId}, skipping`);
            await huntingMemory.updateTarget(target.protocol, 'COMPLETED', 0);
          } else {
            console.log(`  Found ${contracts.length} contracts for ${protocol.name}`);
            let totalFindings = 0;
            const allVulns: string[] = [];

            // Scan each contract
            for (const contract of contracts.slice(0, 3)) { // Limit to 3 contracts per protocol
              console.log(`    Scanning ${contract.address} (${contract.name})`);
              const findings = await scanner.scanContract(contract.address, chainConfig.chainId);

              totalFindings += findings.length;

              // Record findings
              const vulns = findings
                .filter(f => f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real')
                .map(f => f.detectorName);
              allVulns.push(...vulns);

              // Record learning data
              for (const f of findings) {
                if (f.verificationStatus === 'false_positive' || f.aiIsFalsePositive) {
                  await huntingMemory.recordFalsePositive(f.detectorName);
                } else if (f.verificationStatus === 'verified') {
                  await huntingMemory.recordConfirmedPattern(f.detectorName);
                }
              }

              // Record in state manager
              for (const f of findings) {
                if (f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real') {
                  state.addFinding({
                    id: f.id,
                    timestamp: new Date().toISOString(),
                    contractAddress: contract.address,
                    contractName: `${target.protocol} - ${contract.name}`,
                    chain,
                    detector: f.detectorName,
                    severity: f.severity,
                    confidenceScore: f.confidenceScore,
                    verificationStatus: f.verificationStatus,
                    description: f.description.slice(0, 200),
                    exploitableValue: f.exploitEstimate?.estimatedExploitable ?? 0,
                    pocExtractedValue: null,
                  });
                }
              }
            }

            await huntingMemory.updateTarget(target.protocol, 'COMPLETED', totalFindings, allVulns);
          }
        } else {
          console.log(`  Protocol ${target.protocol} not found or chain config unavailable, skipping`);
          await huntingMemory.updateTarget(target.protocol, 'FAILED');
        }
      } catch (err) {
        console.error(`  Error scanning ${target.protocol}:`, err);
        await huntingMemory.updateTarget(target.protocol, 'FAILED');
      }

      scanned++;
      target = huntingMemory.getNextTarget();

      // Progress update every 5 protocols
      if (scanned % 5 === 0) {
        console.log(`\n${huntingMemory.getProgress()}\n`);
      }
    }

    return scanned;
  };

  if (continuous) {
    const shutdown = async () => {
      console.log('\nPausing micro-protocol hunt...');
      await huntingMemory.pauseSession();
      console.log(huntingMemory.getProgress());
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    while (true) {
      const scanned = await scanTargets();

      if (scanned === 0) {
        // Check if we should move to next tier
        const nextTier = huntingMemory.getNextTvlTier();
        if (nextTier) {
          console.log(`\nCurrent tier complete. Moving to ${nextTier.name}...`);
          await huntingMemory.adjustTvlRange(nextTier.min, nextTier.max);
          // Refresh protocols for new tier
          const newProtocols = await scanner.listProtocols(chain, nextTier.min);
          const newFiltered = newProtocols.filter(p => p.tvl >= nextTier.min && p.tvl <= nextTier.max);
          for (const p of newFiltered.slice(0, 50)) {
            await huntingMemory.addTarget(p.name, `$${formatTvlCompact(p.tvl)}`, 'HIGH');
          }
        } else {
          console.log('\nAll tiers complete. Waiting before restarting...');
        }
      }

      console.log(`\nNext scan in ${intervalMin} minutes...`);
      await sleep(intervalMin * 60 * 1000);
    }
  } else {
    await scanTargets();
    console.log('\n' + huntingMemory.getProgress());

    // Suggest next tier
    const nextTier = huntingMemory.getNextTvlTier();
    if (nextTier) {
      console.log(`\nNext tier available: ${nextTier.name}`);
      console.log(`Run: npx tsx src/cli.ts micro --chain ${chain} --min-tvl ${nextTier.min} --max-tvl ${nextTier.max}`);
    }
  }
}

// ── sessions ──

async function runSessions(args: string[]) {
  const showLearning = args.includes('--learning') || args.includes('-l');

  const sessions = await huntingMemory.listSessions();

  if (sessions.length === 0) {
    console.log('No hunting sessions found.');
    console.log('Start one with: npx tsx src/cli.ts micro --chain base');
    return;
  }

  console.log(`Hunting Sessions (${sessions.length} total)\n`);
  console.log(`${'ID'.padEnd(20)} ${'Chain'.padEnd(10)} ${'Status'.padEnd(10)} ${'Protocols'.padStart(10)} ${'Findings'.padStart(10)} ${'Verified'.padStart(10)}`);
  console.log('-'.repeat(80));

  for (const s of sessions.slice(0, 20)) {
    console.log(
      `${s.sessionId.padEnd(20)} ${s.chain.padEnd(10)} ${s.status.padEnd(10)} ${String(s.stats.protocols).padStart(10)} ${String(s.stats.findings).padStart(10)} ${String(s.stats.verified).padStart(10)}`
    );
  }

  if (showLearning) {
    const learning = await huntingMemory.getLearningData();
    console.log(`\nLearning Data (aggregated from all sessions):`);
    console.log(`  Total false positives recorded: ${learning.totalFP}`);
    console.log(`  Total confirmed patterns: ${learning.totalConfirmed}`);

    if (learning.falsePositivePatterns.length > 0) {
      console.log(`\n  False Positive Patterns (${learning.falsePositivePatterns.length}):`);
      for (const p of learning.falsePositivePatterns.slice(0, 10)) {
        console.log(`    - ${p}`);
      }
    }

    if (learning.confirmedPatterns.length > 0) {
      console.log(`\n  Confirmed Patterns (${learning.confirmedPatterns.length}):`);
      for (const p of learning.confirmedPatterns.slice(0, 10)) {
        console.log(`    - ${p}`);
      }
    }
  }

  // Show current session progress if active
  const current = huntingMemory.getCurrentSession();
  if (current) {
    console.log(`\nCurrent Session:`);
    console.log(huntingMemory.getProgress());
  }

  console.log(`\nUse --learning flag to see aggregated learning data.`);
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

// ── Memory Command ──

async function runMemory(args: string[]) {
  // Import confidence scoring
  const { computeConfidence } = await import('./memory/confidence.js');

  const chain = getFlag(args, '--chain') ?? 'ethereum';
  const address = args.find(a => a.startsWith('0x')) ?? getFlag(args, '--address');
  const scans = Math.min(Number(getFlag(args, '--scans') ?? 5), 50);
  const findings = Math.min(Number(getFlag(args, '--findings') ?? 25), 100);
  const includeSummaries = args.includes('--includeSummaries') || getFlag(args, '--includeSummaries') === 'true';
  const includeSimilar = args.includes('--includeSimilar') || getFlag(args, '--includeSimilar') === 'true';

  if (!address) {
    console.error('Error: contract address required');
    console.error('Usage: memory <address> [--chain <name>] [--scans <n>] [--findings <n>] [--includeSummaries] [--includeSimilar]');
    console.error('       memory --chain base --address 0x... --scans 5 --findings 25 --includeSummaries --includeSimilar');
    process.exit(1);
  }

  if (!isValidEthAddress(address)) {
    console.error('Error: invalid Ethereum address (expected 0x + 40 hex characters)');
    process.exit(1);
  }

  const config = loadConfig();
  const db = new Database(config.databaseUrl);
  const redis = await initRedisCache();

  try {
    // Run migrations (idempotent)
    try {
      await db.runMigrations('./migrations');
    } catch (err) {
      // Ignore migration errors (table may already exist)
    }

    console.error(`[Memory] Looking up ${chain}/${address} (scans=${scans}, findings=${findings}, summaries=${includeSummaries}, similar=${includeSimilar})...`);

    const bundle = await db.getContractMemoryBundle({
      chain,
      address,
      limitScans: scans,
      limitFindings: findings,
      includeSummaries,
      includeSimilar,
    });

    if (!bundle) {
      // Return empty bundle instead of failing
      const emptyBundle = {
        chain,
        address: address.toLowerCase(),
        tags: [],
        scans: [],
        findings: [],
        stats: {
          totalScans: 0,
          totalFindings: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          aiAnalyzedCount: 0,
        },
        confidence: computeConfidence({
          chain,
          address: address.toLowerCase(),
          tags: [],
          scans: [],
          findings: [],
          stats: { totalScans: 0, totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, aiAnalyzedCount: 0 },
          generatedAt: new Date().toISOString(),
          cached: false,
        }),
        generatedAt: new Date().toISOString(),
        cached: false,
      };
      console.log(JSON.stringify(emptyBundle, null, 2));
      return;
    }

    // Compute confidence score
    bundle.confidence = computeConfidence(bundle);

    // Output JSON to stdout (for piping)
    console.log(JSON.stringify(bundle, null, 2));
  } finally {
    await redis.close();
    await db.close();
  }
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
