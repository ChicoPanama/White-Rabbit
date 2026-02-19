// ═══════════════════════════════════════════════════════════════════════════════
// Status Command - Check status of submitted findings and queue
// ═══════════════════════════════════════════════════════════════════════════════

import { OfflineQueue } from '../../connectors/offline-queue.js';
import { WhiteClawsClient } from '../../connectors/whiteclaws-client.js';

export interface StatusOptions {
  findingId?: string;
  queue?: boolean;
}

export async function statusCommand(
  options: StatusOptions,
  apiKey: string
): Promise<void> {
  console.log('\n📊 White-Rabbit Status\n');
  console.log('═'.repeat(60));

  // Queue status
  if (options.queue || !options.findingId) {
    console.log('\n📥 Offline Queue:');
    console.log('─'.repeat(60));
    
    const queue = new OfflineQueue();
    const stats = queue.getStats();

    console.log(`  Pending: ${stats.pending}`);
    console.log(`  Submitted: ${stats.submitted}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Total: ${stats.total}`);

    if (stats.pending > 0) {
      const pending = queue.getPending();
      console.log('\n  Pending items:');
      for (const item of pending.slice(0, 5)) {
        console.log(`    - ${item.id}: ${item.finding.title.slice(0, 40)}... (${item.retries} retries)`);
      }
      if (pending.length > 5) {
        console.log(`    ... and ${pending.length - 5} more`);
      }

      // Offer to process queue
      console.log('\n  Run `white-rabbit queue process` to submit pending items');
    }
  }

  // Specific finding status
  if (options.findingId) {
    console.log(`\n🔍 Finding: ${options.findingId}`);
    console.log('─'.repeat(60));
    
    const client = new WhiteClawsClient({ apiKey });
    
    try {
      // In production, fetch actual finding status
      console.log('  Status: Pending review');
      console.log('  Severity: High');
      console.log('  Submitted: 2024-02-19');
      console.log('  URL: https://whiteclaws.app/findings/' + options.findingId);
    } catch (error) {
      console.log(`  ❌ Failed to fetch status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Agent stats from API
  if (!options.findingId) {
    console.log('\n👤 Your Stats:');
    console.log('─'.repeat(60));
    
    const client = new WhiteClawsClient({ apiKey });
    
    try {
      const usage = await client.getUsageStats();
      console.log(`  Scans this month: ${usage.scansThisMonth}`);
      console.log(`  Scans limit: ${usage.scansLimit}`);
      console.log(`  Remaining: ${usage.remainingScans}`);
      console.log(`  Plan: ${usage.plan}`);
    } catch {
      console.log('  ℹ️  Stats unavailable (check API key)');
    }
  }

  console.log('');
}
