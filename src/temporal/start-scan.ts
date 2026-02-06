/**
 * Start a scan workflow via the Temporal client.
 *
 * Usage:
 *   npx tsx src/temporal/start-scan.ts --address 0x... --chain ethereum
 *   npx tsx src/temporal/start-scan.ts --config configs/default-config.yaml --dry-run
 */

import { v4 as uuidv4 } from 'uuid';
import { startScan, awaitScanResult, closeClient } from './client.js';
import type { ScanWorkflowInput } from './shared.js';

function parseArgs(argv: string[]): ScanWorkflowInput {
  const args = argv.slice(2);
  let address: string | undefined;
  let chain: string | undefined;
  let protocol: string | undefined;
  let configPath: string | undefined;
  let dryRun = false;
  let sessionId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--address':   address = args[++i]; break;
      case '--chain':     chain = args[++i]; break;
      case '--protocol':  protocol = args[++i]; break;
      case '--config':    configPath = args[++i]; break;
      case '--session':   sessionId = args[++i]; break;
      case '--dry-run':   dryRun = true; break;
    }
  }

  return {
    sessionId: sessionId ?? uuidv4(),
    contractAddress: address,
    chain,
    protocolName: protocol,
    configPath,
    dryRun,
  };
}

async function main(): Promise<void> {
  const input = parseArgs(process.argv);

  console.log(`Session:  ${input.sessionId}`);
  console.log(`Address:  ${input.contractAddress ?? '(from config)'}`);
  console.log(`Chain:    ${input.chain ?? '(from config)'}`);
  console.log(`Config:   ${input.configPath ?? '(default)'}`);
  console.log(`Dry Run:  ${input.dryRun ? 'Yes' : 'No'}`);
  console.log('');

  try {
    const wfId = await startScan(input);
    console.log(`Workflow started: ${wfId}`);
    console.log('');
    console.log('Waiting for result...');
    console.log('(Press Ctrl+C to detach — the workflow continues in the background)');
    console.log('');

    const result = await awaitScanResult(input.sessionId);

    console.log('=== Scan Complete ===');
    console.log(`Status:         ${result.status}`);
    console.log(`Duration:       ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`Findings:       ${result.findingsCount}`);
    console.log(`Verified:       ${result.verifiedCount}`);
    console.log(`Phases OK:      ${result.phasesCompleted.join(', ') || 'none'}`);
    console.log(`Phases Failed:  ${result.phasesFailed.join(', ') || 'none'}`);
    console.log(`Deliverables:   ${result.deliverables.length} files`);

    process.exit(result.status === 'failed' ? 1 : 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  } finally {
    await closeClient();
  }
}

main();
