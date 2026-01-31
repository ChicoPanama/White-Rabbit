/**
 * Contract Decompilation Service
 * 
 * Handles unverified contracts by:
 * 1. ABI extraction via whatsabi
 * 2. Full decompilation via heimdall-rs  
 * 3. Pattern-based vulnerability detection on bytecode
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { whatsabi } from '@shazow/whatsabi';
import { ethers } from 'ethers';

const execAsync = promisify(exec);

export interface DecompilationResult {
  address: string;
  chain: string;
  abi?: any[];
  sourceCode?: string;
  functions?: string[];
  vulnerabilityPatterns?: string[];
  success: boolean;
  error?: string;
}

export class Decompiler {
  private readonly outputDir: string;
  private readonly rpcUrls: Record<string, string>;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'decompiled');
    this.rpcUrls = {
      'ethereum': process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com',
      'base': process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
      'arbitrum': process.env.ARB_RPC_URL || 'https://arbitrum-one-rpc.publicnode.com',
      'polygon': process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
      'optimism': process.env.OP_RPC_URL || 'https://optimism-rpc.publicnode.com',
      'bsc': process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com',
    };
    
    // Ensure output directory exists
    fs.mkdir(this.outputDir, { recursive: true }).catch(() => {});
  }

  /**
   * Attempt to decompile an unverified contract
   */
  async decompileContract(address: string, chainName: string): Promise<DecompilationResult> {
    const result: DecompilationResult = {
      address,
      chain: chainName,
      success: false
    };

    try {
      console.log(`[Decompiler] Attempting decompilation of ${address} on ${chainName}`);

      // Step 1: Extract ABI using whatsabi
      result.abi = await this.extractABI(address, chainName);
      
      // Step 2: Full decompilation with heimdall
      const decompiled = await this.heimdallDecompile(address, chainName);
      if (decompiled) {
        result.sourceCode = decompiled;
      }

      // Step 3: Pattern analysis
      result.vulnerabilityPatterns = await this.analyzePatterns(address, chainName);
      
      result.success = true;
      console.log(`[Decompiler] Success: ${address} - ABI: ${result.abi?.length || 0} functions`);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[Decompiler] Failed: ${address} - ${result.error}`);
    }

    return result;
  }

  /**
   * Extract ABI from bytecode using whatsabi
   */
  private async extractABI(address: string, chainName: string): Promise<any[]> {
    const rpcUrl = this.rpcUrls[chainName];
    if (!rpcUrl) {
      throw new Error(`No RPC URL for chain: ${chainName}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Get contract code
    const code = await provider.getCode(address);
    if (code === '0x') {
      throw new Error('Contract has no bytecode');
    }

    // Extract ABI
    const abi = whatsabi.abiFromBytecode(code);
    return abi;
  }

  /**
   * Full decompilation using heimdall-rs
   */
  private async heimdallDecompile(address: string, chainName: string): Promise<string | null> {
    const rpcUrl = this.rpcUrls[chainName];
    const outputPath = path.join(this.outputDir, `${chainName}_${address}`);
    
    try {
      const command = `./heimdall decompile ${address} --rpc-url ${rpcUrl} --output ${outputPath} --timeout 60`;
      await execAsync(command, { cwd: process.cwd() });
      
      // Read decompiled source
      const sourcePath = path.join(outputPath, `${address}.sol`);
      const source = await fs.readFile(sourcePath, 'utf8');
      return source;
    } catch (error) {
      console.log(`[Decompiler] Heimdall failed for ${address}: ${error}`);
      return null;
    }
  }

  /**
   * Analyze bytecode for vulnerability patterns
   */
  private async analyzePatterns(address: string, chainName: string): Promise<string[]> {
    const patterns: string[] = [];
    const rpcUrl = this.rpcUrls[chainName];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    try {
      const code = await provider.getCode(address);
      
      // Common vulnerability patterns in bytecode
      const vulnerabilityChecks = [
        { pattern: /delegatecall/gi, type: 'delegatecall' },
        { pattern: /selfdestruct/gi, type: 'selfdestruct' },
        { pattern: /suicide/gi, type: 'suicide' },
        { pattern: /call\s*\(/gi, type: 'external-call' },
        // Add more patterns
      ];

      for (const check of vulnerabilityChecks) {
        if (check.pattern.test(code)) {
          patterns.push(check.type);
        }
      }
    } catch (error) {
      console.log(`[Decompiler] Pattern analysis failed: ${error}`);
    }

    return patterns;
  }

  /**
   * Save decompiled contract for Slither analysis
   */
  async saveForSlither(result: DecompilationResult): Promise<string | null> {
    if (!result.sourceCode) return null;

    const filename = `${result.chain}_${result.address}.sol`;
    const filepath = path.join(this.outputDir, filename);
    
    await fs.writeFile(filepath, result.sourceCode);
    return filepath;
  }
}

export const decompiler = new Decompiler();