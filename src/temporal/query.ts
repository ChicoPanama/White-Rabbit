/**
 * Temporal query tool — CLI entry point for querying scan workflow status.
 *
 * Usage:
 *   npx tsx src/temporal/query.ts progress <sessionId>
 *   npx tsx src/temporal/query.ts describe <sessionId>
 *   npx tsx src/temporal/query.ts list [limit]
 *   npx tsx src/temporal/query.ts result <sessionId>
 *   npx tsx src/temporal/query.ts cancel <sessionId>
 */

import { queryProgress, describeScan, listScans, awaitScanResult, cancelScan, closeClient } from './client.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const sessionId = args[1];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  try {
    switch (command) {
      case 'progress': {
        if (!sessionId) { console.error('Error: sessionId required'); process.exit(1); }
        const progress = await queryProgress(sessionId);
        console.log(JSON.stringify(progress, null, 2));
        break;
      }

      case 'describe': {
        if (!sessionId) { console.error('Error: sessionId required'); process.exit(1); }
        const desc = await describeScan(sessionId);
        console.log(JSON.stringify(desc, null, 2));
        break;
      }

      case 'list': {
        const limit = sessionId ? parseInt(sessionId, 10) : 10;
        const scans = await listScans(limit);
        if (scans.length === 0) {
          console.log('No scan workflows found.');
        } else {
          console.log(`Recent scan workflows (${scans.length}):\n`);
          for (const scan of scans) {
            const time = scan.startTime ? scan.startTime.toISOString() : 'unknown';
            console.log(`  ${scan.workflowId}  ${scan.status.padEnd(12)}  ${time}`);
          }
        }
        break;
      }

      case 'result': {
        if (!sessionId) { console.error('Error: sessionId required'); process.exit(1); }
        console.log('Waiting for scan result...');
        const result = await awaitScanResult(sessionId);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'cancel': {
        if (!sessionId) { console.error('Error: sessionId required'); process.exit(1); }
        await cancelScan(sessionId);
        console.log(`Scan ${sessionId} cancelled.`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  } finally {
    await closeClient();
  }
}

function printUsage(): void {
  console.log(`
Temporal Scan Query Tool

Usage:
  npx tsx src/temporal/query.ts <command> [args]

Commands:
  progress <sessionId>   Show live workflow progress
  describe <sessionId>   Show workflow metadata (status, timing)
  list [limit]           List recent scan workflows (default: 10)
  result <sessionId>     Wait for and display scan result
  cancel <sessionId>     Cancel a running scan workflow
`);
}

main();
