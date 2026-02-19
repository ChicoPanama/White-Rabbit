// ═══════════════════════════════════════════════════════════════════════════════
// Config Command - Show and edit configuration
// ═══════════════════════════════════════════════════════════════════════════════

import { loadConfig, hasConfig } from './init.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';

const CONFIG_FILE = join(homedir(), '.white-rabbit', 'config.json');

export async function configCommand(): Promise<void> {
  console.log('\n⚙️  White-Rabbit Configuration\n');
  console.log('═'.repeat(60));

  if (!hasConfig()) {
    console.log('❌ No configuration found.');
    console.log('   Run `white-rabbit init` to create one.\n');
    process.exit(1);
  }

  const config = loadConfig();
  if (!config) {
    console.log('❌ Failed to load configuration.\n');
    process.exit(1);
  }

  // Display current config
  console.log('\n📋 Current Configuration');
  console.log('─'.repeat(60));
  console.log(`  Config file: ${CONFIG_FILE}`);
  console.log(`  API Key: ${config.apiKey ? `${config.apiKey.slice(0, 10)}...` : 'Not set'}`);
  console.log(`  Default Chain: ${config.defaultChain || 'ethereum'}`);
  console.log(`  Default Depth: ${config.defaultDepth || 'standard'}`);
  console.log(`  Min Severity: ${config.minSeverity || 'low'}`);
  console.log(`  Auto-submit: ${config.autoSubmit ? 'Yes' : 'No'}`);
  console.log(`  Etherscan Key: ${config.etherscanApiKey ? '✅ Set' : '❌ Not set'}`);

  if (config.capabilities) {
    console.log('\n🔧 Detected Capabilities');
    console.log('─'.repeat(60));
    console.log(`  Slither: ${config.capabilities.slither ? '✅' : '❌'}`);
    console.log(`  Foundry: ${config.capabilities.foundry ? '✅' : '❌'}`);
    console.log(`  Mythril: ${config.capabilities.mythril ? '✅' : '❌'}`);
    console.log(`  AI: ${config.capabilities.ai ? '✅' : '❌'}`);
  }

  if (config.createdAt) {
    console.log(`\n📅 Created: ${new Date(config.createdAt).toLocaleDateString()}`);
  }

  // Interactive edit option
  console.log('\n─'.repeat(60));
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('\nEdit configuration? (y/N): ', (ans) => {
      resolve(ans.trim().toLowerCase());
    });
  });

  if (answer === 'y' || answer === 'yes') {
    const ask = (question: string, defaultValue?: string): Promise<string> => {
      return new Promise((resolve) => {
        const prompt = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
        rl.question(prompt, (ans) => {
          resolve(ans.trim() || defaultValue || '');
        });
      });
    };

    console.log('\n📝 Edit Configuration (press Enter to keep current value)');
    console.log('─'.repeat(60));

    const newConfig = {
      ...config,
      defaultChain: await ask('Default chain', config.defaultChain),
      defaultDepth: await ask('Default depth (quick/standard/deep)', config.defaultDepth) as any,
      minSeverity: await ask('Min severity (critical/high/medium/low)', config.minSeverity) as any,
    };

    const autoSubmit = await new Promise<string>((resolve) => {
      rl.question(`Auto-submit findings? (y/N, current: ${config.autoSubmit ? 'Y' : 'N'}): `, (ans) => {
        resolve(ans.trim().toLowerCase());
      });
    });

    if (autoSubmit) {
      newConfig.autoSubmit = autoSubmit.startsWith('y');
    }

    // Save
    writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    console.log('\n✅ Configuration updated!\n');
  } else {
    console.log('');
  }

  rl.close();
}

export function showConfigPath(): void {
  console.log(CONFIG_FILE);
}
