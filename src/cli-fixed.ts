import 'dotenv/config';

// CRITICAL: Set Foundry path before any other imports
process.env.PATH = `${process.env.HOME}/.foundry/bin:${process.env.PATH}`;

import { loadConfig } from './config.js';
import { Scanner } from './scanner.js';
import { CHAINS } from './types/index.js';
import { WalletManager } from './services/walletManager.js';

/**
 * Fixed CLI that properly initializes Scanner with wallet support
 * Ensures PoC verification and wallet verification are enabled
 */

async function createEnhancedScanner() {
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
        console.log('⚠️  Wallet exists but WALLET_ENCRYPTION_PASSWORD not set');
      }
    } catch (error) {
      console.log('❌ Failed to unlock wallet:', error.message);
    }
  }
  
  // Create scanner with wallet manager
  const scanner = new Scanner(config, walletManager);
  return { scanner, walletManager };
}

async function scanBaseMicroProtocols() {
  console.log('🐇 MICRO-PROTOCOL SCANNER - $12-30M TVL TARGETS');
  console.log('='.repeat(60));
  
  const { scanner, walletManager } = await createEnhancedScanner();
  
  try {
    // Test scanner configuration
    console.log('\\n🔧 SCANNER STATUS:');
    console.log(`  Foundry available: ${scanner.verifier?.isAvailable || 'checking...'}`);
    console.log(`  Wallet unlocked: ${walletManager?.isUnlocked() || false}`);
    console.log(`  PoC verification: ${scanner.verifier?.isAvailable ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  Enhanced verification: ${walletManager?.isUnlocked() ? 'ENABLED' : 'DISABLED'}`);
    
    // Run scan with micro-protocol focus
    console.log('\\n⚡ STARTING ENHANCED SCAN...');
    
    const result = await scanner.scanChain('base', {
      minTvlThreshold: 10000000, // $10M - smallest trackable protocols
      maxProtocols: 20,          // Focus on smallest 20
      skipMegaProtocols: true,
      enhancedAnalysis: true
    });
    
    console.log('\\n📊 SCAN RESULTS:');
    console.log(`  Protocols discovered: ${result.protocolsDiscovered}`);
    console.log(`  Contracts analyzed: ${result.contractsAnalyzed}`);
    console.log(`  Total findings: ${result.totalFindings}`);
    console.log(`  Verified findings: ${result.verifiedFindings || 0}`);
    console.log(`  Likely real: ${result.likelyReal || 0}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Scan error:', error.message);
    throw error;
  } finally {
    await scanner.shutdown();
    if (walletManager) {
      walletManager.destroy();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scanBaseMicroProtocols().catch(console.error);
}

export { createEnhancedScanner, scanBaseMicroProtocols };