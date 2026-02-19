// ═══════════════════════════════════════════════════════════════════════════════
// Pattern Registry - ESM Compatible version with CommonJS fallback
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface PatternDetector {
  id: string;
  name: string;
  description: string;
  pattern: string;
  flags?: string;
  safePatterns?: string[];
  contextPatterns?: string[];
  examples?: string[];
}

export interface HistoricalCase {
  protocol: string;
  date: string;
  loss?: string;
  description: string;
}

export interface VulnerabilityPattern {
  id: string;
  name: string;
  version: string;
  description: string;
  cwe: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  confidence?: 'high' | 'medium' | 'low';
  detectors: PatternDetector[];
  remediation?: string;
  references?: string[];
  historical?: HistoricalCase[];
}

export interface PatternRegistry {
  registry: {
    name: string;
    version: string;
    description: string;
    lastUpdated: string;
    patternCount: number;
  };
  patterns: Array<{
    id: string;
    file: string;
    name: string;
    severity: string;
    cwe: string;
    detectorCount: number;
  }>;
  categories: Record<string, {
    name: string;
    patterns: string[];
  }>;
  severities: Record<string, {
    patterns: string[];
  }>;
}

/**
 * Pattern Registry - Manages vulnerability detection patterns from JSON files
 * Cross-platform version with CommonJS/ESM compatibility
 */
export class PatternRegistryLoader {
  private patterns: Map<string, VulnerabilityPattern> = new Map();
  private registry: PatternRegistry | null = null;
  private patternsDir: string;

  constructor(customDir?: string) {
    this.patternsDir = customDir || this.getDefaultPatternsDir();
    this.loadRegistry();
  }

  /**
   * Get default patterns directory path
   */
  private getDefaultPatternsDir(): string {
    // Try multiple paths to find patterns
    const paths = [
      join(process.cwd(), 'data/patterns'),
      join(process.cwd(), 'node_modules/@whiteclaws/white-rabbit/data/patterns'),
      join(__dirname, '../../data/patterns'),
      join(__dirname, '../data/patterns'),
      join(__dirname, '../../../data/patterns'),
    ];

    for (const path of paths) {
      if (existsSync(join(path, 'index.json'))) {
        return path;
      }
    }

    // Return first path as default
    return paths[0];
  }

  /**
   * Load all patterns from the registry
   */
  loadAll(): VulnerabilityPattern[] {
    if (!this.registry) {
      this.loadRegistry();
    }

    const patterns: VulnerabilityPattern[] = [];
    
    for (const entry of this.registry?.patterns || []) {
      const pattern = this.loadPattern(entry.id);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Load a specific pattern by ID
   */
  loadPattern(id: string): VulnerabilityPattern | null {
    // Check cache
    if (this.patterns.has(id)) {
      return this.patterns.get(id)!;
    }

    // Find pattern file
    const entry = this.registry?.patterns.find(p => p.id === id);
    if (!entry) {
      return null;
    }

    try {
      const filePath = join(this.patternsDir, entry.file);
      const content = readFileSync(filePath, 'utf-8');
      const pattern: VulnerabilityPattern = JSON.parse(content);
      
      // Validate required fields
      if (!this.validatePattern(pattern)) {
        console.warn(`Invalid pattern: ${id}`);
        return null;
      }

      // Cache it
      this.patterns.set(id, pattern);
      return pattern;
    } catch (error) {
      console.error(`Failed to load pattern ${id}:`, error);
      return null;
    }
  }

  /**
   * Get patterns by severity
   */
  getBySeverity(severity: string): VulnerabilityPattern[] {
    const ids = this.registry?.severities[severity]?.patterns || [];
    return ids
      .map(id => this.loadPattern(id))
      .filter((p): p is VulnerabilityPattern => p !== null);
  }

  /**
   * Get patterns by category
   */
  getByCategory(category: string): VulnerabilityPattern[] {
    const ids = this.registry?.categories[category]?.patterns || [];
    return ids
      .map(id => this.loadPattern(id))
      .filter((p): p is VulnerabilityPattern => p !== null);
  }

  /**
   * Get patterns by CWE
   */
  getByCwe(cwe: string): VulnerabilityPattern[] {
    return this.loadAll().filter(p => p.cwe === cwe);
  }

  /**
   * Search patterns by keyword
   */
  search(query: string): VulnerabilityPattern[] {
    const lower = query.toLowerCase();
    return this.loadAll().filter(p =>
      p.id.toLowerCase().includes(lower) ||
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.cwe.toLowerCase().includes(lower)
    );
  }

  /**
   * Get registry info
   */
  getRegistryInfo(): PatternRegistry['registry'] | null {
    return this.registry?.registry || null;
  }

  /**
   * Get all pattern IDs
   */
  getPatternIds(): string[] {
    return this.registry?.patterns.map(p => p.id) || [];
  }

  /**
   * Get categories
   */
  getCategories(): string[] {
    return Object.keys(this.registry?.categories || {});
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.patterns.clear();
  }

  /**
   * Reload registry
   */
  reload(): void {
    this.clearCache();
    this.loadRegistry();
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════════════════════════

  private loadRegistry(): void {
    try {
      const indexPath = join(this.patternsDir, 'index.json');
      
      if (!existsSync(indexPath)) {
        console.warn('Pattern registry index not found at:', indexPath);
        return;
      }

      const content = readFileSync(indexPath, 'utf-8');
      this.registry = JSON.parse(content);
    } catch (error) {
      console.error('Failed to load pattern registry:', error);
    }
  }

  private validatePattern(pattern: unknown): pattern is VulnerabilityPattern {
    const p = pattern as VulnerabilityPattern;
    
    if (!p.id || typeof p.id !== 'string') return false;
    if (!p.name || typeof p.name !== 'string') return false;
    if (!p.description || typeof p.description !== 'string') return false;
    if (!p.cwe || typeof p.cwe !== 'string') return false;
    if (!p.severity || !['critical', 'high', 'medium', 'low', 'informational'].includes(p.severity)) return false;
    if (!Array.isArray(p.detectors) || p.detectors.length === 0) return false;
    
    // Validate detectors
    for (const d of p.detectors) {
      if (!d.id || !d.name || !d.description || !d.pattern) return false;
    }

    return true;
  }
}

// Singleton instance
let registryInstance: PatternRegistryLoader | null = null;

export function getPatternRegistry(customDir?: string): PatternRegistryLoader {
  if (!registryInstance) {
    registryInstance = new PatternRegistryLoader(customDir);
  }
  return registryInstance;
}

export default PatternRegistryLoader;
