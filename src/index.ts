import { loadConfig } from './config.js';
import { Scanner } from './scanner.js';

async function main() {
  console.log('White-Rabbit Smart Contract Vulnerability Scanner');
  console.log('================================================\n');

  const config = loadConfig();
  console.log(`Chains: ${config.scanChains.map(c => c.name).join(', ')}`);
  console.log(`Min TVL: $${(config.minTvlThreshold / 1e6).toFixed(0)}M`);
  console.log(`Alert severity: ${config.alertMinSeverity}+`);
  console.log(`AI analysis: ${config.anthropicApiKey ? 'enabled' : 'disabled'}\n`);

  const scanner = new Scanner(config);

  // Check if a specific contract address was provided via CLI
  const targetAddress = process.argv[2];
  const targetChainId = process.argv[3] ? Number(process.argv[3]) : 1;

  try {
    if (targetAddress) {
      console.log(`Scanning specific contract: ${targetAddress} on chain ${targetChainId}\n`);
      const findings = await scanner.scanContract(targetAddress, targetChainId);
      console.log(`\nCompleted. ${findings.length} deduplicated findings.`);
    } else {
      const summary = await scanner.runFullScan();
      if (summary.errors.length > 0) {
        console.log('\nErrors encountered:');
        for (const err of summary.errors) {
          console.log(`  - ${err}`);
        }
      }
    }
  } finally {
    await scanner.shutdown();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
