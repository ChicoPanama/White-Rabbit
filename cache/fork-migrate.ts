#!/usr/bin/env node
/**
 * Fork Hunter Database Migration
 * Sets up specialized database for hunting vulnerable forks
 */

import { promises as fs } from 'fs';
import { Database } from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(__dirname, 'fork-hunter.db');

async function initializeForkDatabase(): Promise<Database> {
  console.log('🔱 Initializing Fork Hunter database...');
  
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);
  
  // Read and execute fork schema
  const schema = await fs.readFile(path.join(__dirname, 'fork-schema.sql'), 'utf8');
  db.exec(schema);
  
  console.log('✅ Fork hunter database schema created');
  return db;
}

async function seedKnownForkPatterns(db: Database): Promise<void> {
  console.log('🌱 Seeding known fork patterns...');
  
  const insertPattern = db.prepare(`
    INSERT OR REPLACE INTO fork_patterns (
      pattern_name, original_protocol, detection_method, pattern_signature,
      confidence_weight, false_positive_rate, description, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const patterns = [
    // Uniswap V2 fork patterns
    {
      name: 'UniV2_Router_Interface',
      original: 'Uniswap V2',
      method: 'abi',
      signature: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
      weight: 0.4,
      fpRate: 0.1,
      description: 'Uniswap V2 router swap function signature'
    },
    {
      name: 'UniV2_Factory_CreatePair',
      original: 'Uniswap V2',
      method: 'abi',
      signature: 'createPair(address,address)',
      weight: 0.3,
      fpRate: 0.05,
      description: 'Uniswap V2 factory pair creation'
    },
    {
      name: 'UniV2_WETH_Reference',
      original: 'Uniswap V2',
      method: 'bytecode',
      signature: 'WETH',
      weight: 0.2,
      fpRate: 0.3,
      description: 'WETH constant in Uniswap-style routers'
    },
    
    // Compound fork patterns
    {
      name: 'Compound_Mint_Function',
      original: 'Compound',
      method: 'abi',
      signature: 'mint(uint256)',
      weight: 0.4,
      fpRate: 0.15,
      description: 'Compound cToken mint function'
    },
    {
      name: 'Compound_ExchangeRate',
      original: 'Compound',
      method: 'abi',
      signature: 'exchangeRateStored()',
      weight: 0.3,
      fpRate: 0.1,
      description: 'Compound exchange rate mechanism'
    },
    
    // Aave fork patterns
    {
      name: 'Aave_LendingPool',
      original: 'Aave',
      method: 'abi',
      signature: 'deposit(address,uint256,address,uint16)',
      weight: 0.4,
      fpRate: 0.1,
      description: 'Aave lending pool deposit function'
    },
    {
      name: 'Aave_FlashLoan',
      original: 'Aave',
      method: 'abi',
      signature: 'flashLoan(address,address[],uint256[],uint256[],address,bytes,uint16)',
      weight: 0.3,
      fpRate: 0.05,
      description: 'Aave flash loan function'
    }
  ];
  
  let seeded = 0;
  for (const pattern of patterns) {
    insertPattern.run(
      pattern.name,
      pattern.original,
      pattern.method,
      pattern.signature,
      pattern.weight,
      pattern.fpRate,
      pattern.description,
      Math.floor(Date.now() / 1000)
    );
    seeded++;
  }
  
  console.log(`✅ Seeded ${seeded} fork detection patterns`);
}

async function seedTVLCategories(db: Database): Promise<void> {
  console.log('📊 Setting up TVL categorization...');
  
  // Create some example TVL sweet spot entries for testing
  const insertCategory = db.prepare(`
    INSERT OR REPLACE INTO tvl_sweet_spots (
      chain, protocol_address, protocol_name, current_tvl, tvl_category,
      security_score, audit_count, bounty_program, deployment_age_days,
      fork_likelihood, hunt_priority, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Example protocols in different TVL ranges
  const examples = [
    {
      chain: 'polygon',
      address: '0x1111111111111111111111111111111111111111',
      name: 'Example Small DEX',
      tvl: 500_000,
      category: 'small',
      securityScore: 35,
      audits: 0,
      bounty: false,
      age: 120,
      forkLikelihood: 0.8,
      priority: 85
    },
    {
      chain: 'arbitrum',
      address: '0x2222222222222222222222222222222222222222',
      name: 'Example Medium Lending',
      tvl: 2_500_000,
      category: 'medium',
      securityScore: 45,
      audits: 1,
      bounty: false,
      age: 200,
      forkLikelihood: 0.7,
      priority: 75
    }
  ];
  
  const now = Math.floor(Date.now() / 1000);
  for (const example of examples) {
    insertCategory.run(
      example.chain, example.address, example.name, example.tvl, example.category,
      example.securityScore, example.audits, example.bounty ? 1 : 0, example.age,
      example.forkLikelihood, example.priority, now
    );
  }
  
  console.log(`✅ Created TVL categorization framework`);
}

async function createForkUtilities(): Promise<void> {
  console.log('🛠️  Creating fork hunting utilities...');
  
  const utilContent = `
/**
 * Fork Hunter Utilities
 * Helper functions for advanced fork detection and analysis
 */

import { Database } from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(__dirname, 'fork-hunter.db');

export class ForkHunterDB {
  private db: Database;
  
  constructor() {
    const Database = require('better-sqlite3');
    this.db = new Database(DB_PATH);
  }
  
  // Get high-priority hunt targets
  getHighPriorityTargets(limit = 20): any[] {
    return this.db.prepare(\`
      SELECT * FROM hunt_targets 
      WHERE hunt_status = 'queued' AND priority_score >= 70
      ORDER BY priority_score DESC, estimated_exploit_value DESC
      LIMIT ?
    \`).all(limit);
  }
  
  // Get fork statistics by original protocol
  getForkStatsByProtocol(): any[] {
    return this.db.prepare(\`
      SELECT 
        suspected_original,
        COUNT(*) as fork_count,
        AVG(target_tvl) as avg_tvl,
        SUM(estimated_exploit_value) as total_exploit_value,
        AVG(priority_score) as avg_priority
      FROM hunt_targets
      GROUP BY suspected_original
      ORDER BY total_exploit_value DESC
    \`).all();
  }
  
  // Get unpatched vulnerabilities summary
  getUnpatchedVulns(): any[] {
    return this.db.prepare(\`
      SELECT 
        original_vulnerability,
        original_protocol,
        COUNT(*) as affected_forks,
        AVG(confidence) as avg_confidence,
        SUM(exploitable_value) as total_value
      FROM vulnerability_inheritance
      WHERE patch_status = 'unpatched'
      GROUP BY original_vulnerability, original_protocol
      ORDER BY total_value DESC
    \`).all();
  }
  
  // Mark target as analyzed
  markTargetAnalyzed(address: string, chain: string, findings: number): void {
    this.db.prepare(\`
      UPDATE hunt_targets 
      SET hunt_status = 'analyzed', analysis_completed = ?, findings_count = ?
      WHERE target_address = ? AND target_chain = ?
    \`).run(Math.floor(Date.now() / 1000), findings, address, chain);
  }
  
  // Get detection patterns for a protocol
  getDetectionPatterns(protocol: string): any[] {
    return this.db.prepare(\`
      SELECT * FROM fork_patterns 
      WHERE original_protocol = ?
      ORDER BY confidence_weight DESC
    \`).all(protocol);
  }
  
  close(): void {
    this.db.close();
  }
}

export default new ForkHunterDB();
`;
  
  await fs.writeFile(path.join(__dirname, 'ForkHunterDB.ts'), utilContent);
  console.log('✅ Fork hunting utilities created');
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting Fork Hunter database setup...\n');
    
    const db = await initializeForkDatabase();
    await seedKnownForkPatterns(db);
    await seedTVLCategories(db);
    await createForkUtilities();
    
    db.close();
    
    console.log('\n🔱 Fork Hunter database setup completed!');
    console.log(`📊 Database created at: ${DB_PATH}`);
    console.log('🎯 Ready to hunt vulnerable forks in the TVL sweet spot');
    
  } catch (error) {
    console.error('💥 Fork setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}