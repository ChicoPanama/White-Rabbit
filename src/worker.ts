import { loadConfig } from './config.js';
import { createQueues } from './queue/queues.js';
import { createWorkers } from './queue/workers.js';

async function main() {
  console.log('White-Rabbit Worker Process');
  console.log('==========================\n');

  const config = loadConfig();
  const queues = createQueues(config.redisUrl);
  const workers = createWorkers(config);

  console.log('Workers started:');
  console.log('  - Discovery (concurrency: 2)');
  console.log('  - Analysis  (concurrency: 3, rate: 10/min)');
  console.log('  - Alerts    (concurrency: 1)\n');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down workers...`);
    await workers.shutdown();
    await queues.discoveryQueue.close();
    await queues.analysisQueue.close();
    await queues.alertQueue.close();
    console.log('Workers stopped.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep process alive
  console.log('Waiting for jobs...');
}

main().catch((err) => {
  console.error('Fatal worker error:', err);
  process.exit(1);
});
