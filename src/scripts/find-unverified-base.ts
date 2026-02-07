/**
 * Find unverified contracts on Base for decompilation testing
 */

import { ethers } from 'ethers';

const BASE_RPC = 'https://base-rpc.publicnode.com';
const provider = new ethers.JsonRpcProvider(BASE_RPC);

// Test addresses from Base protocols
const testContracts = [
  { name: 'Uniswap V3 Router', address: '0x2626664c2603336E57B271c5C0b26F421741e481' },
  { name: 'Base Bridge', address: '0x3154Cf16ccdb4C6d922629664174b904d80F2C35' },
  { name: 'Compound USDC', address: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf' },
  { name: 'Aerodrome Router', address: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43' },
];

async function checkContractVerification() {
  console.log('🔍 Checking Base contracts for verification status...\n');

  for (const contract of testContracts) {
    try {
      const code = await provider.getCode(contract.address);
      const hasCode = code !== '0x';
      
      console.log(`📋 ${contract.name}`);
      console.log(`   Address: ${contract.address}`);
      console.log(`   Has Code: ${hasCode}`);
      
      if (hasCode) {
        console.log(`   Bytecode length: ${code.length - 2} bytes`);
        console.log(`   First 100 bytes: ${code.slice(0, 100)}...`);
        
        // Try to extract some info
        const balance = await provider.getBalance(contract.address);
        console.log(`   ETH Balance: ${ethers.formatEther(balance)} ETH`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`   ERROR: ${error}`);
      console.log('');
    }
  }
}

checkContractVerification().catch(console.error);