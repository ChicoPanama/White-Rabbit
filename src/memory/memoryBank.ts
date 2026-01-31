/**
 * Memory Bank - Hybrid Memory System for WhiteRabbit/Clawd
 *
 * Combines existing memory structure with new session continuity features.
 * Preserves all existing data while adding structured access.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MemoryFile,
  MemoryBankState,
  Finding,
  ScanTarget,
  OperationStatus,
  SessionContext,
  HuntingLog
} from './types';

// Base directory for Clawd
const CLAWD_ROOT = process.env.CLAWD_ROOT || path.join(process.env.HOME || '/home/ubuntu', 'clawd');

// File mappings (existing + new)
const FILE_PATHS = {
  // Core identity (existing)
  memory: 'MEMORY.md',
  identity: 'IDENTITY.md',
  soul: 'SOUL.md',

  // Session state (new)
  activeContext: 'activeContext.md',
  operations: 'operations.md',
  findingsLog: 'findingsLog.md',

  // Intelligence (existing)
  attackVectors: 'memory/ATTACK_VECTOR_DATABASE.md',
  huntingLog: 'memory/hunting-log.json',

  // Rules
  clawdrules: '.clawdrules'
};

export class MemoryBank {
  private state: Partial<MemoryBankState> = {};
  private rootDir: string;

  constructor(rootDir: string = CLAWD_ROOT) {
    this.rootDir = rootDir;
  }

  /**
   * Initialize the Memory Bank by loading all files
   */
  async initialize(): Promise<void> {
    console.log(`[MemoryBank] Initializing from ${this.rootDir}`);
    await this.loadAll();
    console.log(`[MemoryBank] Loaded ${Object.keys(this.state).length} memory files`);
  }

  /**
   * Load all memory files into state
   */
  async loadAll(): Promise<Partial<MemoryBankState>> {
    for (const [key, relativePath] of Object.entries(FILE_PATHS)) {
      if (key === 'clawdrules') continue; // Skip rules file

      const filePath = path.join(this.rootDir, relativePath);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        this.state[key as keyof MemoryBankState] = {
          name: key,
          path: filePath,
          content,
          lastUpdated: stats.mtime
        };
      } catch (error) {
        console.warn(`[MemoryBank] Could not load ${relativePath}: ${(error as Error).message}`);
      }
    }

    return this.state;
  }

  /**
   * Read a specific file
   */
  async readFile(fileKey: keyof typeof FILE_PATHS): Promise<string> {
    const filePath = path.join(this.rootDir, FILE_PATHS[fileKey]);
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * Update a file with auto-timestamp
   */
  async updateFile(fileKey: keyof typeof FILE_PATHS, content: string): Promise<void> {
    const filePath = path.join(this.rootDir, FILE_PATHS[fileKey]);

    // Auto-update timestamp
    const timestamp = new Date().toISOString();
    const updatedContent = content.replace(
      /\*Last Updated:.*\*/,
      `*Last Updated: ${timestamp}*`
    );

    await fs.writeFile(filePath, updatedContent, 'utf-8');

    // Update state
    this.state[fileKey as keyof MemoryBankState] = {
      name: fileKey,
      path: filePath,
      content: updatedContent,
      lastUpdated: new Date()
    };

    console.log(`[MemoryBank] Updated: ${fileKey}`);
  }

  /**
   * Update active context (most frequently used)
   */
  async updateActiveContext(updates: Partial<SessionContext>): Promise<void> {
    let content = await this.readFile('activeContext');

    if (updates.currentFocus) {
      content = content.replace(
        /## Current Focus\n[^\n#]*/,
        `## Current Focus\n${updates.currentFocus}\n`
      );
    }

    if (updates.mode) {
      content = content.replace(
        /- \*\*Mode:\*\* \w+/,
        `- **Mode:** ${updates.mode}`
      );
    }

    if (updates.lastAction) {
      content = content.replace(
        /- \*\*Last Action:\*\* .*/,
        `- **Last Action:** ${updates.lastAction}`
      );
    }

    if (updates.nextSteps && updates.nextSteps.length > 0) {
      const steps = updates.nextSteps.map(s => `- [ ] ${s}`).join('\n');
      content = content.replace(
        /### Priority 1 \(Do Now\)\n[\s\S]*?(?=\n### Priority 2)/,
        `### Priority 1 (Do Now)\n${steps}\n\n`
      );
    }

    await this.updateFile('activeContext', content);
  }

  /**
   * Log a new finding
   */
  async logFinding(finding: Finding): Promise<void> {
    let content = await this.readFile('findingsLog');

    // Generate ID if not provided
    if (!finding.id) {
      finding.id = `WR-${String(Date.now()).slice(-6)}`;
    }

    // Add to appropriate section based on stage
    const tableRow = `| ${finding.id} | ${finding.protocol} | ${finding.chain} | ${finding.vulnerabilityType} | ${finding.severity} | ${finding.stage} | ${finding.estimatedValue || '-'} |`;

    if (finding.stage === 'Investigation') {
      content = content.replace(
        /(### Under Investigation\n\|.*\n\|[-| ]+\n)/,
        `$1${tableRow}\n`
      );
    } else if (finding.stage === 'Verification') {
      content = content.replace(
        /(### Pending Verification\n\|.*\n\|[-| ]+\n)/,
        `$1| ${finding.id} | ${finding.protocol} | ${finding.vulnerabilityType} | ${finding.severity} | ${finding.trigger || '-'} |\n`
      );
    }

    // Add detailed entry
    const detailedEntry = `
### ${finding.id}: ${finding.protocol} ${finding.vulnerabilityType}
- **Contract:** ${finding.contract}
- **Function:** ${finding.function || 'N/A'}
- **Vulnerability:** ${finding.description}
- **Trigger:** ${finding.trigger}
- **Impact:** ${finding.impact}
- **Severity:** ${finding.severity}
- **Est. Value:** ${finding.estimatedValue || 'TBD'}
- **Status:** ${finding.stage}
- **Created:** ${finding.createdAt.toISOString()}
`;

    // Insert before the Templates section
    content = content.replace(
      /\n---\n\n## Finding Templates/,
      `${detailedEntry}\n---\n\n## Finding Templates`
    );

    await this.updateFile('findingsLog', content);
    console.log(`[MemoryBank] Logged finding: ${finding.id}`);
  }

  /**
   * Update operations status
   */
  async updateOperationStatus(statuses: OperationStatus[]): Promise<void> {
    let content = await this.readFile('operations');

    for (const status of statuses) {
      const regex = new RegExp(`\\| \\*\\*${status.component}\\*\\* \\| [^|]+ \\| [^|]+ \\|`);
      const replacement = `| **${status.component}** | ${status.status} | ${status.lastCheck.toISOString().split('T')[0]} |`;
      content = content.replace(regex, replacement);
    }

    await this.updateFile('operations', content);
  }

  /**
   * Get hunting log (JSON)
   */
  async getHuntingLog(): Promise<HuntingLog> {
    const content = await this.readFile('huntingLog');
    return JSON.parse(content);
  }

  /**
   * Update hunting log stats
   */
  async updateHuntingLog(updates: Partial<HuntingLog>): Promise<void> {
    const current = await this.getHuntingLog();
    const updated = { ...current, ...updates, lastUpdated: new Date().toISOString() };

    const filePath = path.join(this.rootDir, FILE_PATHS.huntingLog);
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');

    console.log(`[MemoryBank] Updated hunting-log.json`);
  }

  /**
   * Get full context for AI (session start)
   */
  async getContextForAI(): Promise<string> {
    await this.loadAll();

    const sections: string[] = [
      '# MEMORY BANK CONTEXT',
      '',
      '## Active Context (CURRENT STATE - READ FIRST)',
      this.state.activeContext?.content || '[Not loaded]',
      '',
      '## Operations Status',
      this.state.operations?.content || '[Not loaded]',
      '',
      '## Identity & Mission',
      this.state.memory?.content || '[Not loaded]',
      '',
      '## Findings Log',
      this.state.findingsLog?.content || '[Not loaded]',
      '',
      '## Attack Vector Database',
      this.state.attackVectors?.content || '[Not loaded]'
    ];

    return sections.join('\n');
  }

  /**
   * Get quick context (lighter weight for mid-session)
   */
  async getQuickContext(): Promise<string> {
    const activeContext = await this.readFile('activeContext');
    const operations = await this.readFile('operations');

    return `# QUICK CONTEXT\n\n${activeContext}\n\n## System Status\n${operations}`;
  }

  /**
   * Get current state
   */
  getState(): Partial<MemoryBankState> {
    return this.state;
  }

  /**
   * Check if all required files exist
   */
  async checkHealth(): Promise<{ healthy: boolean; missing: string[] }> {
    const missing: string[] = [];

    for (const [key, relativePath] of Object.entries(FILE_PATHS)) {
      const filePath = path.join(this.rootDir, relativePath);
      try {
        await fs.access(filePath);
      } catch {
        missing.push(relativePath);
      }
    }

    return {
      healthy: missing.length === 0,
      missing
    };
  }
}

// Singleton instance
export const memoryBank = new MemoryBank();
