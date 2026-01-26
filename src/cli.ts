import { loadConfig } from './config.js';
import { Scanner } from './scanner.js';
import { CHAINS } from './types/index.js';
import { ChainDiscoveryService } from './services/chains.js';
import { sleep } from './utils/helpers.js';
import { StateManager } from './services/state.js';

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

  const config = loadConfig();
  const scanner = new Scanner(config);

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

// ── Helpers ──

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
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
