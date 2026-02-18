#!/usr/bin/env node

// Set Foundry path before any imports
process.env.PATH = `${process.env.HOME}/.foundry/bin:${process.env.PATH}`;

import { loadConfig } from './src/config.js';
import { Scanner } from './src/scanner.js';
import { WalletManager } from './src/services/walletManager.js';

async function startEnhancedScan() {
  console.log('🐇 ENHANCED BASE SCANNER - $10K-$1M TVL TARGET');
  console.log('=' .repeat(60));
  
  const config = loadConfig();
  
  // Try to initialize wallet manager if wallet exists
  let walletManager = null;
  if (WalletManager.walletExists()) {
    try {
      const password = process.env.WALLET_ENCRYPTION_PASSWORD;
      if (password) {
        walletManager = new WalletManager();
        await walletManager.unlock(password);
        console.log('✅ Wallet unlocked:', walletManager.getAddress());
      } else {
        console.log('⚠️  Wallet exists but no password provided');
      }
    } catch (error) {
      console.log('❌ Failed to unlock wallet:', error.message);
    }
  } else {
    console.log('⚠️  No wallet found - run wallet:init first');
  }
  
  // Initialize scanner with wallet manager
  const scanner = new Scanner(config, walletManager);
  
  console.log('\n🎯 SCANNER CONFIGURATION:');
  console.log(`  PoC verification: ${scanner.verifier ? 'CHECKING...' : 'disabled'}`);
  console.log(`  Wallet verification: ${walletManager?.isUnlocked() ? 'enabled' : 'disabled'}`);
  
  // Test a single Base protocol first
  console.log('\n🔫 TESTING MICRO-PROTOCOL SCAN...');
  
  try {
    // Scan Base with very low TVL threshold (10K-1M range)
    const result = await scanner.scanChain('base', { 
      minTvlThreshold: 10000,     // $10K minimum  
      maxTvlThreshold: 1000000,   // $1M maximum
      skipMegaProtocols: true,
      forceAnalyze: true
    });
    
    console.log('\n📊 SCAN RESULTS:');
    console.log(`  Protocols found: ${result.protocolsDiscovered}`);
    console.log(`  Contracts analyzed: ${result.contractsAnalyzed}`);
    console.log(`  Findings: ${result.totalFindings}`);
    console.log(`  Verified: ${result.verifiedFindings}`);
    
  } catch (error) {
    console.error('❌ Scan error:', error.message);
  } finally {
    await scanner.shutdown();
    if (walletManager) {
      walletManager.destroy();
    }
  }
}

startEnhancedScan().catch(console.error);
