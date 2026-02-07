/**
 * Contract Dependency Resolver
 * Handles missing imports by creating dependency mappings and remappings
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export class ContractResolver {
  private readonly contractDir: string;
  private readonly nodeModulesPath: string;
  
  constructor() {
    this.contractDir = path.join(process.cwd(), 'contracts');
    this.nodeModulesPath = path.join(process.cwd(), 'node_modules');
  }

  /**
   * Create Foundry remappings for common dependencies
   */
  async createRemappings(): Promise<string> {
    const remappings = [
      '@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/',
      '@openzeppelin/=node_modules/@openzeppelin/',
      '@nomad-xyz/src/=node_modules/@nomad-xyz/excessively-safe-call/src/',
      'forge-std/=node_modules/forge-std/src/',
    ];

    const remappingsFile = path.join(process.cwd(), 'remappings.txt');
    await fs.writeFile(remappingsFile, remappings.join('\n') + '\n');
    
    return remappingsFile;
  }

  /**
   * Fix contract imports by creating local copies of missing files
   */
  async resolveContractDependencies(contractPath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(contractPath, 'utf8');
      const imports = this.extractImports(content);
      
      for (const importPath of imports) {
        await this.resolveImport(importPath, path.dirname(contractPath));
      }
      
      return true;
    } catch (error) {
      console.log(`[ContractResolver] Failed to resolve dependencies for ${contractPath}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Extract import statements from Solidity code
   */
  private extractImports(content: string): string[] {
    const importRegex = /import\s+[^;]*["']([^"']+)["'][^;]*;/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * Resolve a single import by finding it in node_modules or creating a stub
   */
  private async resolveImport(importPath: string, contractDir: string): Promise<void> {
    // Skip relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return;
    }

    const targetPath = path.join(contractDir, importPath);
    
    // Check if already exists
    try {
      await fs.access(targetPath);
      return; // Already exists
    } catch {
      // Doesn't exist, need to resolve
    }

    // Try to find in node_modules
    let sourcePath: string | null = null;
    
    if (importPath.startsWith('@openzeppelin/contracts/')) {
      sourcePath = path.join(this.nodeModulesPath, importPath);
    } else if (importPath.startsWith('@nomad-xyz/src/')) {
      const cleanPath = importPath.replace('@nomad-xyz/src/', '');
      sourcePath = path.join(this.nodeModulesPath, '@nomad-xyz/excessively-safe-call/src', cleanPath);
    }

    if (sourcePath) {
      try {
        await fs.access(sourcePath);
        
        // Create directory structure
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // Copy the file
        await fs.copyFile(sourcePath, targetPath);
        console.log(`[ContractResolver] Resolved: ${importPath}`);
        return;
      } catch {
        // Source not found in node_modules
      }
    }

    // Create interface stub as fallback
    await this.createInterfaceStub(targetPath, importPath);
  }

  /**
   * Create a basic interface stub for missing contracts
   */
  private async createInterfaceStub(targetPath: string, importPath: string): Promise<void> {
    const interfaceName = path.basename(importPath, '.sol');
    
    const stubContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Generated stub for ${importPath}
interface ${interfaceName} {
    // Stub interface - add functions as needed
}
`;

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, stubContent);
    console.log(`[ContractResolver] Created stub: ${importPath}`);
  }

  /**
   * Setup Foundry configuration for better compilation
   */
  async setupFoundryConfig(): Promise<void> {
    const foundryToml = `[profile.default]
src = "contracts"
out = "out"
libs = ["node_modules"]
remappings = [
    "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
    "@openzeppelin/=node_modules/@openzeppelin/",
    "@nomad-xyz/src/=node_modules/@nomad-xyz/excessively-safe-call/src/",
    "forge-std/=node_modules/forge-std/src/"
]

[profile.default.solc]
version = "0.8.20"
optimizer = true
optimizer_runs = 200
via_ir = false

[profile.slither]
src = "contracts" 
optimizer = false
`;

    await fs.writeFile('foundry.toml', foundryToml);
    console.log('[ContractResolver] Created foundry.toml configuration');
  }
}

export const contractResolver = new ContractResolver();