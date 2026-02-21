// ═══════════════════════════════════════════════════════════════════════════════
// Submit Command - Submit findings to WhiteClaws
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { WhiteClawsClient } from '../../connectors/whiteclaws-client.js';
import { OfflineQueue } from '../../connectors/offline-queue.js';
import { VerifiedFinding } from '../../types.js';

export interface SubmitOptions {
  protocol?: string;
  dryRun?: boolean;
}

export async function submitCommand(
  filePath: string,
  options: SubmitOptions,
  apiKey: string
): Promise<void> {
  console.log('\n📤 Submitting Finding to WhiteClaws\n');
  console.log('─'.repeat(60));

  // Read finding file
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  let finding: VerifiedFinding;
  try {
    const data = readFileSync(filePath, 'utf-8');
    finding = JSON.parse(data);
  } catch (error) {
    console.error(`❌ Failed to parse finding: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log(`Title: ${finding.title}`);
  console.log(`Severity: ${finding.severity}`);
  console.log(`Tool: ${finding.tool}`);
  console.log(`Protocol: ${options.protocol || 'Not specified'}`);

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN - Would submit:');
    console.log(JSON.stringify(finding, null, 2));
    return;
  }

  // Submit
  const client = new WhiteClawsClient({ apiKey });
  const queue = new OfflineQueue();

  try {
    // Add to queue first (resilient)
    const queueId = await queue.enqueue(finding, options.protocol || 'unknown');
    console.log(`\n📥 Queued for submission (ID: ${queueId})`);

    // Try immediate submission
    console.log('🌐 Submitting to WhiteClaws...');

    if (!options.protocol) {
      throw new Error('Protocol slug is required. Use --protocol <slug>.');
    }

    const response = await client.submitFinding({
      protocol_slug: options.protocol,
      title: finding.title,
      severity: finding.severity === 'informational' ? 'low' : finding.severity,
      description: finding.description,
      poc_url: null,
    });

    console.log('  ✅ Submission successful!');
    console.log(`  Finding ID: ${response.finding.id}`);
    console.log(`  Status: ${response.finding.status}`);
    console.log(`  URL: https://whiteclaws.app/findings/${response.finding.id}`);

  } catch (error) {
    console.log(`\n⚠️  Submission failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log('   Finding saved to offline queue for retry.');
  }

  // Show queue status
  const stats = queue.getStats();
  console.log(`\n📊 Queue Status: ${stats.pending} pending, ${stats.submitted} submitted, ${stats.failed} failed`);
}
