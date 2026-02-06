import { loadConfig } from './config.js';
import { Scanner } from './scanner.js';
import { isDryRun, phaseStart, phaseEnd, printDryRunSummary, resetTimings } from './dry-run.js';
import { createSession, listDeliverables } from './deliverables-manager.js';
import { loadScanConfig } from './config-parser.js';
import { getOrchestratorMode, runTemporalScan } from './temporal/orchestrator.js';

async function main() {
  console.log('White-Rabbit Smart Contract Vulnerability Scanner');
  console.log('================================================\n');

  const orchestrator = getOrchestratorMode();
  console.log(`Orchestrator: ${orchestrator}`);

  if (isDryRun()) {
    console.log('[DRY_RUN] Pipeline testing mode active — no external calls will be made\n');
    resetTimings();
  }

  // Load YAML config if --config flag is provided, otherwise use env-based config
  const configArg = process.argv.indexOf('--config');
  let configPath: string | undefined;
  if (configArg !== -1 && process.argv[configArg + 1]) {
    configPath = process.argv[configArg + 1];
    try {
      loadScanConfig(configPath);
      console.log(`Loaded config from: ${configPath}`);
    } catch (err) {
      console.warn(`Config load warning: ${err instanceof Error ? err.message : String(err)}`);
      console.warn('Falling back to environment variables\n');
      configPath = undefined;
    }
  }

  // Check if a specific contract address was provided via CLI
  const args = process.argv.filter(a => a !== '--config' && !(configArg !== -1 && a === process.argv[configArg + 1]));
  const targetAddress = args[2];
  const targetChainId = args[3] ? Number(args[3]) : 1;

  // ── Temporal orchestrator path ──
  if (orchestrator === 'temporal') {
    const sessionId = createSession();
    console.log(`Session: ${sessionId}\n`);

    const result = await runTemporalScan({
      contractAddress: targetAddress,
      chain: targetChainId === 1 ? 'ethereum' : String(targetChainId),
      configPath,
      dryRun: isDryRun(),
      sessionId,
    });

    console.log(`\nScan ${result.status}: ${result.findingsCount} findings (${result.verifiedCount} verified)`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    if (result.phasesFailed.length > 0) {
      console.log(`Failed phases: ${result.phasesFailed.join(', ')}`);
    }

    if (isDryRun()) {
      const deliverables = listDeliverables(sessionId);
      printDryRunSummary(deliverables.length);
    }

    process.exit(result.status === 'failed' ? 1 : 0);
    return;
  }

  // ── Legacy orchestrator path (PM2/BullMQ) ──

  const config = loadConfig();
  console.log(`Chains: ${config.scanChains.map(c => c.name).join(', ')}`);
  console.log(`Min TVL: $${(config.minTvlThreshold / 1e6).toFixed(0)}M`);
  console.log(`Alert severity: ${config.alertMinSeverity}+`);
  console.log(`AI analysis: ${config.anthropicApiKey ? 'enabled' : 'disabled'}`);
  if (isDryRun()) console.log(`Mode: DRY_RUN (no external calls)`);
  console.log();

  // Create a deliverables session for this scan cycle
  const sessionId = createSession();
  console.log(`Session: ${sessionId}\n`);

  const scanner = new Scanner(config);

  const handleSignal = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    await scanner.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => { handleSignal('SIGINT'); });
  process.on('SIGTERM', () => { handleSignal('SIGTERM'); });

  try {
    if (targetAddress) {
      phaseStart('full-pipeline');
      console.log(`Scanning specific contract: ${targetAddress} on chain ${targetChainId}\n`);
      const findings = await scanner.scanContract(targetAddress, targetChainId);
      const verified = findings.filter(f => f.verificationStatus === 'verified').length;
      const likelyReal = findings.filter(f => f.verificationStatus === 'likely_real').length;
      console.log(`\nCompleted. ${findings.length} findings (${verified} verified, ${likelyReal} likely real).`);
      phaseEnd();
    } else {
      phaseStart('full-scan');
      const summary = await scanner.runFullScan();
      if (summary.errors.length > 0) {
        console.log('\nErrors encountered:');
        for (const err of summary.errors) {
          console.log(`  - ${err}`);
        }
      }
      phaseEnd();
    }
  } finally {
    await scanner.shutdown();
  }

  // Print dry-run summary if active
  if (isDryRun()) {
    const deliverables = listDeliverables(sessionId);
    printDryRunSummary(deliverables.length);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
