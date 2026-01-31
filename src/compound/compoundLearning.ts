/**
 * Compound Learning System
 *
 * Automatically extracts and stores learnings from:
 * - Verified vulnerabilities
 * - False positives
 * - Successful bounty submissions
 * - Targeting decisions
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const CLAWD_DIR = process.env.HOME + '/clawd';
const KNOWLEDGE_DIR = `${CLAWD_DIR}/knowledge`;
const MEMORY_BANK_DIR = `${CLAWD_DIR}/memory-bank`;

export interface Finding {
  id: string;
  protocol: string;
  chain: string;
  vulnerabilityType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  verified: boolean;
  falsePositive: boolean;
  bountyAmount?: number;
  lessonsLearned?: string;
  solidityVersion?: string;
  submissionUrl?: string;
  status: 'investigation' | 'verification' | 'submitted' | 'accepted' | 'rejected';
}

export interface TargetingDecision {
  protocol: string;
  chain: string;
  reason: string;
  outcome: 'success' | 'failure' | 'pending';
  timeSpent: number;
  lessonsLearned?: string;
  timestamp?: string;
}

export class CompoundLearning {

  /**
   * Codify a verified vulnerability into attack patterns
   */
  async codifyVulnerability(finding: Finding): Promise<void> {
    if (!finding.verified || finding.falsePositive) {
      return;
    }

    const patternFile = path.join(
      KNOWLEDGE_DIR,
      'attack-patterns',
      `${this.slugify(finding.vulnerabilityType)}.md`
    );

    let content = '';

    try {
      content = await fs.readFile(patternFile, 'utf-8');
    } catch {
      // File doesn't exist, create new
      content = `# ${finding.vulnerabilityType} Patterns\n\n## Examples\n`;
    }

    // Append new example
    const example = `
### ${finding.protocol} (${finding.chain}) - ${finding.id}
- **Severity:** ${finding.severity}
- **Solidity:** ${finding.solidityVersion || 'Unknown'}
- **Bounty:** ${finding.bountyAmount ? '$' + finding.bountyAmount : 'Pending'}
- **Status:** ${finding.status}
- **Lessons:** ${finding.lessonsLearned || 'None documented'}
- **Date:** ${new Date().toISOString().split('T')[0]}
`;

    content += example;

    await fs.writeFile(patternFile, content);
    console.log(`Codified vulnerability to ${patternFile}`);
  }

  /**
   * Document a false positive to prevent recurrence
   */
  async codifyFalsePositive(finding: Finding, reason: string): Promise<void> {
    const graveyardDir = path.join(KNOWLEDGE_DIR, 'false-positive-graveyard');
    await fs.mkdir(graveyardDir, { recursive: true });

    const graveyardFile = path.join(
      graveyardDir,
      `${this.slugify(finding.vulnerabilityType)}-${finding.id}.md`
    );

    const content = `# False Positive: ${finding.vulnerabilityType}

## Finding ID
${finding.id}

## Protocol
${finding.protocol} on ${finding.chain}

## Why It Looked Real
[Document what made this look like a real vulnerability]

## Why It Wasn't Exploitable
${reason}

## Prevention Rule
[How to avoid this false positive in the future]

## Solidity Version
${finding.solidityVersion || 'Unknown'}

---
*Documented: ${new Date().toISOString()}*
`;

    await fs.writeFile(graveyardFile, content);
    console.log(`Documented false positive to ${graveyardFile}`);
  }

  /**
   * Log a finding to the findings log
   */
  async logFinding(finding: Finding): Promise<void> {
    const findingsLogPath = path.join(MEMORY_BANK_DIR, 'findingsLog.md');

    let content = '';
    try {
      content = await fs.readFile(findingsLogPath, 'utf-8');
    } catch {
      content = '# Findings Log\n\n## Findings\n';
    }

    const entry = `
### ${finding.id}: ${finding.protocol} ${finding.vulnerabilityType}
- **Chain:** ${finding.chain}
- **Severity:** ${finding.severity}
- **Status:** ${finding.status}
- **Verified:** ${finding.verified ? 'Yes' : 'No'}
- **False Positive:** ${finding.falsePositive ? 'Yes' : 'No'}
- **Bounty:** ${finding.bountyAmount ? '$' + finding.bountyAmount : 'Pending'}
- **Submission:** ${finding.submissionUrl || 'N/A'}
- **Logged:** ${new Date().toISOString()}
`;

    // Insert before the last "---" or at the end
    const lastDashIndex = content.lastIndexOf('---');
    if (lastDashIndex > 0) {
      content = content.slice(0, lastDashIndex) + entry + '\n' + content.slice(lastDashIndex);
    } else {
      content += entry;
    }

    await fs.writeFile(findingsLogPath, content);
    console.log(`Logged finding ${finding.id}`);
  }

  /**
   * Track targeting decision outcomes
   */
  async trackTargetingDecision(decision: TargetingDecision): Promise<void> {
    const statsFile = path.join(KNOWLEDGE_DIR, 'protocol-dna', 'targeting-stats.json');

    let stats: TargetingDecision[] = [];

    try {
      const content = await fs.readFile(statsFile, 'utf-8');
      stats = JSON.parse(content);
    } catch {
      // File doesn't exist
    }

    stats.push({
      ...decision,
      timestamp: new Date().toISOString()
    });

    await fs.writeFile(statsFile, JSON.stringify(stats, null, 2));

    // Update targeting strategy based on outcomes
    await this.updateTargetingStrategy(stats);
  }

  /**
   * Analyze targeting stats and update strategy
   */
  private async updateTargetingStrategy(stats: TargetingDecision[]): Promise<void> {
    // Calculate success rates by reason
    const reasonStats = new Map<string, { success: number; total: number }>();

    for (const decision of stats) {
      if (decision.outcome === 'pending') continue;

      const current = reasonStats.get(decision.reason) || { success: 0, total: 0 };
      current.total++;
      if (decision.outcome === 'success') {
        current.success++;
      }
      reasonStats.set(decision.reason, current);
    }

    // Generate insights
    const insights: string[] = [];

    for (const [reason, stat] of reasonStats) {
      const rate = (stat.success / stat.total * 100).toFixed(1);
      insights.push(`- ${reason}: ${rate}% success rate (${stat.success}/${stat.total})`);
    }

    // Update micro-protocol-tells.md with insights
    const tellsFile = path.join(KNOWLEDGE_DIR, 'protocol-dna', 'micro-protocol-tells.md');

    try {
      let content = await fs.readFile(tellsFile, 'utf-8');

      const statsSection = `
## Targeting Success Rates (Auto-updated)

${insights.join('\n') || '- No data yet'}

*Last Updated: ${new Date().toISOString()}*
`;

      if (content.includes('## Targeting Success Rates')) {
        content = content.replace(
          /## Targeting Success Rates.*$/s,
          statsSection
        );
      } else {
        content += '\n' + statsSection;
      }

      await fs.writeFile(tellsFile, content);
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Auto-learn from a completed session
   */
  async learnFromSession(sessionSummary: {
    findings: Finding[];
    targetingDecisions: TargetingDecision[];
    falsePositives: { finding: Finding; reason: string }[];
  }): Promise<void> {
    // Codify all verified vulnerabilities
    for (const finding of sessionSummary.findings.filter(f => f.verified)) {
      await this.codifyVulnerability(finding);
    }

    // Document all false positives
    for (const fp of sessionSummary.falsePositives) {
      await this.codifyFalsePositive(fp.finding, fp.reason);
    }

    // Track all targeting decisions
    for (const decision of sessionSummary.targetingDecisions) {
      await this.trackTargetingDecision(decision);
    }

    console.log('Session learnings codified');
  }

  /**
   * Update active context with current state
   */
  async updateActiveContext(updates: {
    currentFocus?: string;
    nextSteps?: string[];
    sessionNotes?: string;
  }): Promise<void> {
    const activeContextPath = path.join(MEMORY_BANK_DIR, 'activeContext.md');

    let content = '';
    try {
      content = await fs.readFile(activeContextPath, 'utf-8');
    } catch {
      content = '# Active Context\n\n';
    }

    // Update specific sections
    if (updates.currentFocus) {
      content = content.replace(
        /## Current Focus\n[^\n#]*/,
        `## Current Focus\n${updates.currentFocus}\n`
      );
    }

    // Update timestamp
    content = content.replace(
      /\*Last Updated:.*\*/,
      `*Last Updated: ${new Date().toISOString()}*`
    );

    await fs.writeFile(activeContextPath, content);
  }

  /**
   * Slugify text for filenames
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

// Singleton instance
export const compoundLearning = new CompoundLearning();
