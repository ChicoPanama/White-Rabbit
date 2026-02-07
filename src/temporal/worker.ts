/**
 * Temporal worker — registers activities and starts polling the task queue.
 *
 * Start with:
 *   npx tsx src/temporal/worker.ts
 *   node dist/temporal/worker.js   (after build)
 *
 * Environment variables:
 *   TEMPORAL_ADDRESS   — default: localhost:7233
 *   TEMPORAL_NAMESPACE — default: white-rabbit
 *   TEMPORAL_TASK_QUEUE — default: scanner-queue
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities.js';
import { TASK_QUEUE } from './shared.js';
import * as path from 'node:path';

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'white-rabbit';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? TASK_QUEUE;

  console.log(`[Worker] Connecting to Temporal at ${address} (namespace: ${namespace})`);

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    // Workflows are loaded from the compiled JS file in the sandboxed V8 isolate
    workflowsPath: path.resolve(__dirname, 'workflows.js'),
    activities,
    // Limits
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 5,
  });

  console.log(`[Worker] Listening on task queue: ${taskQueue}`);
  console.log(`[Worker] Registered activities: ${Object.keys(activities).join(', ')}`);
  console.log(`[Worker] Press Ctrl+C to stop`);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Worker] Shutting down...');
    worker.shutdown();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await worker.run();
  console.log('[Worker] Stopped.');
}

run().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
