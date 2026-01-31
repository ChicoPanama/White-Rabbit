/**
 * Context Window Guard
 *
 * Prevents context overflow by:
 * 1. Estimating token count before LLM calls
 * 2. Triggering compression when approaching limits
 * 3. Managing session history intelligently
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ContextHealth {
  estimatedTokens: number;
  status: 'healthy' | 'warning' | 'critical';
  recommendation: string;
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const CLAWD_DIR = process.env.HOME + '/clawd';
const MEMORY_BANK_DIR = `${CLAWD_DIR}/memory-bank`;
const SESSIONS_DIR = `${CLAWD_DIR}/sessions`;

// Token limits
const MAX_CONTEXT = 200000;
const SAFE_THRESHOLD = 150000;
const WARNING_THRESHOLD = 170000;
const MAX_OUTPUT_TOKENS = 2048;

// Rough estimation: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4;

export class ContextGuard {
  private sessionHistory: SessionMessage[] = [];
  private systemPromptTokens: number = 0;

  /**
   * Estimate token count from text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Load and estimate system prompt size
   */
  async loadSystemPrompt(): Promise<string> {
    const soulPath = `${CLAWD_DIR}/SOUL.md`;

    try {
      const soul = await fs.readFile(soulPath, 'utf-8');
      this.systemPromptTokens = this.estimateTokens(soul);
      return soul;
    } catch (error) {
      console.error('Failed to load SOUL.md:', error);
      return '';
    }
  }

  /**
   * Get current context health status
   */
  async getContextHealth(): Promise<ContextHealth> {
    const historyTokens = this.sessionHistory.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.content),
      0
    );

    const totalTokens = this.systemPromptTokens + historyTokens + MAX_OUTPUT_TOKENS;

    let status: ContextHealth['status'];
    let recommendation: string;

    if (totalTokens > WARNING_THRESHOLD) {
      status = 'critical';
      recommendation = 'IMMEDIATE compression required. Context overflow imminent.';
    } else if (totalTokens > SAFE_THRESHOLD) {
      status = 'warning';
      recommendation = 'Consider compressing context soon.';
    } else {
      status = 'healthy';
      recommendation = 'Context within safe limits.';
    }

    return {
      estimatedTokens: totalTokens,
      status,
      recommendation
    };
  }

  /**
   * Add message to session history
   */
  addMessage(role: SessionMessage['role'], content: string): void {
    this.sessionHistory.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  /**
   * Get session history (optionally limited)
   */
  getHistory(maxMessages?: number): SessionMessage[] {
    if (maxMessages && this.sessionHistory.length > maxMessages) {
      return this.sessionHistory.slice(-maxMessages);
    }
    return this.sessionHistory;
  }

  /**
   * Compress session history
   */
  async compress(): Promise<void> {
    const health = await this.getContextHealth();

    if (health.status === 'healthy') {
      console.log('Context healthy, no compression needed');
      return;
    }

    console.log(`Compressing context. Current estimate: ${health.estimatedTokens} tokens`);

    // 1. Archive full session
    await fs.mkdir(path.join(SESSIONS_DIR, 'archived'), { recursive: true });
    const archivePath = path.join(
      SESSIONS_DIR,
      'archived',
      `session-${Date.now()}.json`
    );

    await fs.writeFile(
      archivePath,
      JSON.stringify(this.sessionHistory, null, 2)
    );

    // 2. Create compressed summary
    const summary = this.createSummary();

    // 3. Keep only last 5 messages + summary
    const recentMessages = this.sessionHistory.slice(-5);

    this.sessionHistory = [
      {
        role: 'system',
        content: `[COMPRESSED CONTEXT]\n${summary}`,
        timestamp: new Date()
      },
      ...recentMessages
    ];

    // 4. Update activeContext.md
    await this.updateActiveContext(summary);

    const newHealth = await this.getContextHealth();
    console.log(`Compression complete. New estimate: ${newHealth.estimatedTokens} tokens`);
  }

  /**
   * Create summary of session for compression
   */
  private createSummary(): string {
    const findings: string[] = [];
    const decisions: string[] = [];

    for (const msg of this.sessionHistory) {
      if (msg.content.includes('vulnerability') || msg.content.includes('finding')) {
        findings.push(msg.content.slice(0, 200));
      }
      if (msg.content.includes('decided') || msg.content.includes('will')) {
        decisions.push(msg.content.slice(0, 100));
      }
    }

    return `
## Session Summary (Auto-compressed)

### Key Findings
${findings.slice(-3).map(f => `- ${f}`).join('\n') || '- None this session'}

### Decisions Made
${decisions.slice(-3).map(d => `- ${d}`).join('\n') || '- None recorded'}

### Session Stats
- Messages processed: ${this.sessionHistory.length}
- Compressed at: ${new Date().toISOString()}
    `.trim();
  }

  /**
   * Update activeContext.md with current state
   */
  private async updateActiveContext(summary: string): Promise<void> {
    const activeContextPath = path.join(MEMORY_BANK_DIR, 'activeContext.md');

    const content = `# Active Context — Current Session State

## Current Focus
[Continued from compressed session]

## Session Summary
${summary}

## Context Health
- Last compression: ${new Date().toISOString()}
- Reason: Token limit approaching

---
*Last Updated: ${new Date().toISOString()}*
`;

    await fs.writeFile(activeContextPath, content);
  }

  /**
   * Pre-request check - call before every LLM API call
   */
  async preRequestCheck(): Promise<{ proceed: boolean; message?: string }> {
    const health = await this.getContextHealth();

    if (health.status === 'critical') {
      await this.compress();
      return {
        proceed: true,
        message: 'Context was compressed before proceeding.'
      };
    }

    if (health.status === 'warning') {
      return {
        proceed: true,
        message: `Warning: ${health.estimatedTokens} tokens. ${health.recommendation}`
      };
    }

    return { proceed: true };
  }

  /**
   * Build optimized context for LLM call
   */
  async buildOptimizedContext(): Promise<string> {
    const parts: string[] = [];

    // 1. Core identity (minimal)
    parts.push('You are WhiteRabbit, an autonomous security intelligence system.');

    // 2. Current focus from activeContext.md
    try {
      const activeContext = await fs.readFile(
        path.join(MEMORY_BANK_DIR, 'activeContext.md'),
        'utf-8'
      );
      parts.push('\n## Current Context\n' + activeContext.slice(0, 2000));
    } catch {
      // File doesn't exist yet
    }

    // 3. Recent history (limited)
    const recentHistory = this.getHistory(5);
    if (recentHistory.length > 0) {
      parts.push('\n## Recent Messages');
      for (const msg of recentHistory) {
        parts.push(`[${msg.role}]: ${msg.content.slice(0, 500)}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Clear session history
   */
  clear(): void {
    this.sessionHistory = [];
  }
}

// Singleton instance
export const contextGuard = new ContextGuard();
