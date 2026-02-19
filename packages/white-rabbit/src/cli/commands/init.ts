// ═══════════════════════════════════════════════════════════════════════════════
// Init Wizard - Interactive setup for White-Rabbit
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';

const CONFIG_DIR = join(homedir(), '.white-rabbit');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface Config {
  apiKey?: string;
  defaultChain: string;
  defaultDepth: 'quick' | 'standard' | 'deep';
  minSeverity: 'critical' | 'high' | 'medium' | 'low';
  autoSubmit: boolean;
  etherscanApiKey?: string;
  customRPCs: Record<number, string[]>;
  capabilities: {
    slither: boolean;
    foundry: boolean;
    mythril: boolean;
    ai: boolean;
  };
  createdAt: string;
}

export async function initCommand(): Promise<void> {
  console.log('\n🐇 White-Rabbit Setup Wizard\n');
  console.log('═'.repeat(50));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string, defaultValue?: string): Promise<string> => {
    return new Promise((resolve) => {
      const prompt = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
      rl.question(prompt, (answer) => {
        resolve(answer.trim() || defaultValue || '');
      });
    });
  };

  const askYesNo = async (question: string, defaultValue: boolean): Promise<boolean> => {
    const answer = await ask(question, defaultValue ? 'Y/n' : 'y/N');
    return answer.toLowerCase().startsWith('y');
  };

  try {
    // Step 1: WhiteClaws API Key
    console.log('\n📡 Step 1/5: WhiteClaws Connection');
    console.log('─'.repeat(50));
    
    const apiKey = await ask('Enter your WhiteClaws API key (get one at whiteclaws.app/dashboard)');
    
    if (apiKey && !apiKey.startsWith('wc_')) {
      console.log('⚠️  Warning: WhiteClaws API keys usually start with "wc_"');
    }

    // Step 2: Detect capabilities
    console.log('\n🔧 Step 2/5: Detecting Local Tools');
    console.log('─'.repeat(50));
    
    const capabilities = await detectCapabilities();
    
    console.log(`  Node.js: ✅ ${process.version}`);
    console.log(`  Slither: ${capabilities.slither ? '✅' : '❌'} ${capabilities.slither ? '' : '(pip install slither-analyzer)'}`);
    console.log(`  Foundry: ${capabilities.foundry ? '✅' : '❌'} ${capabilities.foundry ? '' : '(install from getfoundry.sh)'}`);
    console.log(`  Mythril: ${capabilities.mythril ? '✅' : '❌'} ${capabilities.mythril ? '' : '(pip install mythril)'}`);
    console.log(`  AI Analysis: ${capabilities.ai ? '✅' : '❌'} ${capabilities.ai ? '' : '(set ANTHROPIC_API_KEY or OPENAI_API_KEY)'}`);

    const capabilityLevel = capabilities.slither && capabilities.foundry
      ? 'FULL (all engines)'
      : capabilities.slither
      ? 'STANDARD (patterns + slither + ai)'
      : 'BASIC (patterns + ai only)';
    
    console.log(`\n  Capability Level: ${capabilityLevel}`);

    // Step 3: Etherscan API Key (optional)
    console.log('\n📋 Step 3/5: Block Explorer (Optional)');
    console.log('─'.repeat(50));
    console.log('An Etherscan API key enables fetching contract source code');
    
    const etherscanKey = await ask('Enter Etherscan API key (or leave blank)', '');

    // Step 4: Default configuration
    console.log('\n⚙️  Step 4/5: Default Configuration');
    console.log('─'.repeat(50));
    
    const defaultChain = await ask('Default chain', 'ethereum');
    const defaultDepth = await ask('Default scan depth (quick/standard/deep)', 'standard');
    const minSeverity = await ask('Minimum severity to report (critical/high/medium/low)', 'low');
    const autoSubmit = await askYesNo('Auto-submit findings?', false);

    // Step 5: Save configuration
    console.log('\n💾 Step 5/5: Saving Configuration');
    console.log('─'.repeat(50));

    const config: Config = {
      apiKey: apiKey || undefined,
      defaultChain,
      defaultDepth: defaultDepth as any,
      minSeverity: minSeverity as any,
      autoSubmit,
      etherscanApiKey: etherscanKey || undefined,
      customRPCs: {},
      capabilities,
      createdAt: new Date().toISOString(),
    };

    // Ensure directory exists
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Save config
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    console.log(`  ✅ Configuration saved to ${CONFIG_FILE}`);

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('🎉 Setup Complete!\n');
    console.log('Quick Start:');
    console.log(`  white-rabbit scan 0x1234... --chain ${defaultChain}`);
    console.log(`  white-rabbit hunt uniswap`);
    console.log(`  white-rabbit intel aave`);
    console.log(`  white-rabbit status\n`);

    if (!apiKey) {
      console.log('⚠️  Note: No API key configured. Set WHITECLAWS_API_KEY to submit findings.');
    }

    if (!capabilities.slither) {
      console.log('💡 Tip: Install Slither for deeper analysis: pip install slither-analyzer');
    }

  } finally {
    rl.close();
  }
}

async function detectCapabilities(): Promise<Config['capabilities']> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  async function checkCommand(cmd: string): Promise<boolean> {
    try {
      await execAsync(`${cmd} --version`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  const [slither, foundry, mythril] = await Promise.all([
    checkCommand('slither'),
    checkCommand('forge'),
    checkCommand('myth'),
  ]);

  const ai = !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY
  );

  return { slither, foundry, mythril, ai };
}

export function loadConfig(): Partial<Config> | null {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export function hasConfig(): boolean {
  return existsSync(CONFIG_FILE);
}
