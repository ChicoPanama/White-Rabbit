#!/usr/bin/env node
/**
 * Debug TVL ranges to understand protocol distribution
 */

import 'dotenv/config';
import { loadConfig } from './config.js';
import { CachedDeFiLlamaClient } from './clients/cached-defillama.js';

async function analyzeProtocolTVLs(chain: string): Promise<void> {
  console.log(`📊 Analyzing TVL distribution on ${chain}...\n`);
  
  const config = await loadConfig();
  const defillama = new CachedDeFiLlamaClient();
  
  try {
    // Get all protocols with very low minimum (1K)
    const protocols = await defillama.getProtocolsByChain(chain, 1000);
    
    console.log(`Found ${protocols.length} total protocols on ${chain}`);
    
    // Categorize by TVL
    const categories = {
      whale: { min: 50_000_000, protocols: [] as any[] },
      large: { min: 10_000_000, max: 50_000_000, protocols: [] as any[] },
      medium: { min: 2_000_000, max: 10_000_000, protocols: [] as any[] },
      sweet_spot: { min: 100_000, max: 2_000_000, protocols: [] as any[] },
      small: { min: 10_000, max: 100_000, protocols: [] as any[] },
      micro: { max: 10_000, protocols: [] as any[] }
    };
    
    for (const protocol of protocols) {
      const chainKey = chain.charAt(0).toUpperCase() + chain.slice(1);
      const tvl = protocol.chainTvls?.[chainKey] || protocol.tvl || 0;
      
      if (tvl >= categories.whale.min) {
        categories.whale.protocols.push({ ...protocol, tvl });
      } else if (tvl >= categories.large.min) {
        categories.large.protocols.push({ ...protocol, tvl });
      } else if (tvl >= categories.medium.min) {
        categories.medium.protocols.push({ ...protocol, tvl });
      } else if (tvl >= categories.sweet_spot.min) {
        categories.sweet_spot.protocols.push({ ...protocol, tvl });
      } else if (tvl >= categories.small.min) {
        categories.small.protocols.push({ ...protocol, tvl });
      } else {
        categories.micro.protocols.push({ ...protocol, tvl });
      }
    }
    
    // Display results
    console.log('\n🏆 TVL DISTRIBUTION ANALYSIS:');
    
    Object.entries(categories).forEach(([category, data]) => {
      const count = data.protocols.length;
      const totalTvl = data.protocols.reduce((sum: number, p: any) => sum + p.tvl, 0);
      
      let range = '';
      if (data.min && data.max) {
        range = `$${(data.min/1000000).toFixed(1)}M - $${(data.max/1000000).toFixed(1)}M`;
      } else if (data.min) {
        range = `> $${(data.min/1000000).toFixed(1)}M`;
      } else if (data.max) {
        range = `< $${(data.max/1000000).toFixed(1)}M`;
      }
      
      console.log(`\n${category.toUpperCase()} (${range}):`);
      console.log(`  📊 Count: ${count} protocols`);
      console.log(`  💰 Total TVL: $${totalTvl.toLocaleString()}`);
      
      if (count > 0) {
        const avgTvl = totalTvl / count;
        console.log(`  📈 Avg TVL: $${avgTvl.toLocaleString()}`);
        
        // Show top 3 in this category
        const top3 = data.protocols
          .sort((a: any, b: any) => b.tvl - a.tvl)
          .slice(0, 3);
        
        console.log(`  🏆 Top protocols:`);
        top3.forEach((p: any, i: number) => {
          console.log(`    ${i+1}. ${p.name}: $${p.tvl.toLocaleString()}`);
        });
      }
    });
    
    // Focus on sweet spot
    console.log('\n🎯 SWEET SPOT ANALYSIS ($100K - $2M):');
    const sweetSpot = categories.sweet_spot.protocols;
    
    if (sweetSpot.length === 0) {
      console.log('❌ No protocols in sweet spot range found.');
      console.log('💡 This suggests either:');
      console.log('  1. Chain has mostly large protocols');
      console.log('  2. DeFiLlama data doesn\'t include smaller protocols');
      console.log('  3. TVL calculations may be inaccurate for this chain');
    } else {
      console.log(`✅ Found ${sweetSpot.length} protocols in optimal target range!`);
      
      sweetSpot.slice(0, 10).forEach((p: any, i: number) => {
        console.log(`  ${i+1}. ${p.name}`);
        console.log(`     💰 TVL: $${p.tvl.toLocaleString()}`);
        console.log(`     📍 Address: ${p.address || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

async function main(): Promise<void> {
  const chain = process.argv[2] || 'polygon';
  await analyzeProtocolTVLs(chain);
}

if (require.main === module) {
  main();
}