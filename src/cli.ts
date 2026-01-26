import { loadConfig } from './config.js';
import { Scanner } from './scanner.js';
import { CHAINS } from './types/index.js';
import { sleep } from './utils/helpers.js';
import { StateManager } from './services/state.js';

const HELP = `
White-Rabbit: Autonomous Smart Contract Vulnerability Scanner

Usage:
  npx tsx src/cli.ts audit <address> [--chain <name>]
  npx tsx src/cli.ts scan <network>
  npx tsx src/cli.ts protocols <network> [--min-tvl <usd>]
  npx tsx src/cli.ts auto [--networks <list>] [--min-tvl <usd>] [--interval <min>]
  npx tsx src/cli.ts stats
  npx tsx src/cli.ts findings [--limit <n>]

Commands:
  audit       Audit a single contract address
  scan        Scan a network for high-TVL protocol vulnerabilities
  protocols   List high-TVL protocols on a network
  auto        Start autonomous scanning loop
  stats       Show scanner status and statistics
  findings    Show recent verified/likely-real findings

Options:
  --chain <name>       Chain name (default: ethereum)
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

  // Stats and findings don't need the full scanner
  if (command === 'stats') {
    runStats();
    return;
  }
  if (command === 'findings') {
    runFindings(args.slice(1));
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

async function runAudit(scanner: Scanner, args: string[]) {
  const address = args[0];
  if (!address) {
    console.error('Error: contract address required');
    console.error('Usage: audit <address> [--chain <name>]');
    process.exit(1);
  }

  const chainName = getFlag(args, '--chain') ?? getFlag(args, '-n') ?? 'ethereum';
  const chain = CHAINS[chainName.toLowerCase()];
  if (!chain) {
    console.error(`Unknown chain: ${chainName}. Available: ${Object.keys(CHAINS).join(', ')}`);
    process.exit(1);
  }

  console.log(`Auditing ${address} on ${chain.name} (chain ID: ${chain.chainId})\n`);

  const findings = await scanner.scanContract(address, chain.chainId);

  // Record findings in state
  const state = new StateManager();
  for (const f of findings) {
    if (f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real') {
      state.addFinding({
        id: f.id,
        timestamp: new Date().toISOString(),
        contractAddress: address,
        contractName: f.title || address,
        chain: chain.name,
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

async function runScan(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const network = args[0];
  if (!network) {
    console.error('Error: network name required');
    console.error('Usage: scan <network>');
    process.exit(1);
  }

  const chain = CHAINS[network.toLowerCase()];
  if (!chain) {
    console.error(`Unknown network: ${network}. Available: ${Object.keys(CHAINS).join(', ')}`);
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

async function runProtocols(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const network = args[0];
  if (!network) {
    console.error('Error: network name required');
    console.error('Usage: protocols <network> [--min-tvl <usd>]');
    process.exit(1);
  }

  const chain = CHAINS[network.toLowerCase()];
  if (!chain) {
    console.error(`Unknown network: ${network}. Available: ${Object.keys(CHAINS).join(', ')}`);
    process.exit(1);
  }

  const minTvl = Number(getFlag(args, '--min-tvl') ?? config.minTvlThreshold);

  console.log(`Top protocols on ${chain.name} (TVL >= $${(minTvl / 1e6).toFixed(0)}M):\n`);

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

async function runAuto(scanner: Scanner, args: string[], config: ReturnType<typeof loadConfig>) {
  const intervalMin = Number(getFlag(args, '--interval') ?? 30);
  const intervalMs = intervalMin * 60 * 1000;

  const state = new StateManager();
  state.setAutonomous(true);
  state.updateConfig({
    networks: config.scanChains.map(c => c.name.toLowerCase()),
    minTvlUsd: config.minTvlThreshold,
    intervalMinutes: intervalMin,
    alertThreshold: config.alertMinSeverity,
  });

  console.log('Starting autonomous scanning mode');
  console.log(`  Networks: ${config.scanChains.map(c => c.name).join(', ')}`);
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
      const summary = await scanner.runFullScan();
      for (const chain of config.scanChains) {
        state.recordScan(
          chain.name.toLowerCase(),
          summary.contractsAnalyzed,
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

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
