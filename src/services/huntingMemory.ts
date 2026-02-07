/**
 * Hunting Memory System
 * Persistent context for vulnerability hunting across sessions
 *
 * Features:
 * - Session tracking with progressive TVL tiers
 * - Learning data (false positives, confirmed patterns)
 * - Cross-session pattern aggregation
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

interface HuntingTarget {
  protocol: string;
  address?: string;
  tvl: string;
  priority: 'EXTREME' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'SCANNING' | 'COMPLETED' | 'FAILED';
  findings?: number;
  lastScanned?: string;
  vulnerabilities?: string[];
}

interface HuntingSession {
  sessionId: string;
  startedAt: string;
  chain: string;
  tvlRange: string;
  targets: HuntingTarget[];
  totalFindings: number;
  verifiedVulns: number;
  progress: {
    protocolsScanned: number;
    contractsAnalyzed: number;
    currentTarget?: string;
  };
  configuration: {
    minTvl: number;
    maxTvl: number;
    pocEnabled: boolean;
    walletEnabled: boolean;
    aiEnabled: boolean;
  };
  // Learning data for pattern improvement
  learning: {
    falsePositivePatterns: string[];   // Detector names that were FP
    confirmedPatterns: string[];       // Detector names that found real issues
    falsePositiveCount: number;
    confirmedCount: number;
  };
  // Session state
  status: 'active' | 'paused' | 'completed';
  pausedAt?: string;
  completedAt?: string;
}

// Progressive TVL tiers for micro-protocol hunting
export const TVL_TIERS = [
  { min: 10_000, max: 100_000, name: 'Tier 1: Micro ($10K-$100K)' },
  { min: 100_000, max: 500_000, name: 'Tier 2: Small ($100K-$500K)' },
  { min: 500_000, max: 1_000_000, name: 'Tier 3: Growing ($500K-$1M)' },
  { min: 1_000_000, max: 5_000_000, name: 'Tier 4: Medium ($1M-$5M)' },
  { min: 5_000_000, max: 10_000_000, name: 'Tier 5: Established ($5M-$10M)' },
];

const SESSIONS_DIR = path.join(process.cwd(), 'cache', 'hunting-sessions');

export class HuntingMemory {
  private readonly memoryFile: string;
  private session: HuntingSession | null = null;

  constructor() {
    this.memoryFile = path.join(process.cwd(), 'hunting-session.json');
    // Ensure sessions directory exists
    if (!fsSync.existsSync(SESSIONS_DIR)) {
      fsSync.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  /**
   * Start a new hunting session
   */
  async startSession(chain: string, tvlRange: string, minTvl: number, maxTvl: number): Promise<string> {
    const sessionId = `hunt-${Date.now()}`;

    this.session = {
      sessionId,
      startedAt: new Date().toISOString(),
      chain,
      tvlRange,
      targets: [],
      totalFindings: 0,
      verifiedVulns: 0,
      progress: {
        protocolsScanned: 0,
        contractsAnalyzed: 0
      },
      configuration: {
        minTvl,
        maxTvl,
        pocEnabled: false, // Will be updated
        walletEnabled: false,
        aiEnabled: true
      },
      learning: {
        falsePositivePatterns: [],
        confirmedPatterns: [],
        falsePositiveCount: 0,
        confirmedCount: 0
      },
      status: 'active'
    };

    await this.saveSession();
    // Also save to sessions archive
    await this.archiveSession();
    console.log(`[HuntingMemory] Started session: ${sessionId} for ${chain} ($${this.formatTvl(minTvl)} - $${this.formatTvl(maxTvl)})`);
    return sessionId;
  }

  /**
   * Resume existing session
   */
  async resumeSession(): Promise<HuntingSession | null> {
    try {
      const data = await fs.readFile(this.memoryFile, 'utf8');
      this.session = JSON.parse(data);
      console.log(`🧠 Resumed hunting session: ${this.session?.sessionId}`);
      return this.session;
    } catch (error) {
      console.log('🧠 No existing hunting session found');
      return null;
    }
  }

  /**
   * Add target to hunting list
   */
  async addTarget(protocol: string, tvl: string, priority: HuntingTarget['priority'], address?: string): Promise<void> {
    if (!this.session) {
      throw new Error('No active hunting session');
    }

    const target: HuntingTarget = {
      protocol,
      tvl,
      priority,
      status: 'PENDING',
      address
    };

    this.session.targets.push(target);
    await this.saveSession();
    console.log(`🎯 Added target: ${protocol} (${tvl}) - ${priority} priority`);
  }

  /**
   * Update target status
   */
  async updateTarget(protocol: string, status: HuntingTarget['status'], findings?: number, vulnerabilities?: string[]): Promise<void> {
    if (!this.session) return;

    const target = this.session.targets.find(t => t.protocol === protocol);
    if (target) {
      target.status = status;
      target.lastScanned = new Date().toISOString();
      
      if (findings !== undefined) {
        target.findings = findings;
        this.session.totalFindings += findings;
      }
      
      if (vulnerabilities) {
        target.vulnerabilities = vulnerabilities;
        this.session.verifiedVulns += vulnerabilities.length;
      }

      if (status === 'COMPLETED') {
        this.session.progress.protocolsScanned++;
      }

      await this.saveSession();
      console.log(`📊 Updated ${protocol}: ${status} (${findings || 0} findings)`);
    }
  }

  /**
   * Get next pending target
   */
  getNextTarget(): HuntingTarget | null {
    if (!this.session) return null;
    
    // Prioritize EXTREME > HIGH > MEDIUM > LOW
    const priorities: HuntingTarget['priority'][] = ['EXTREME', 'HIGH', 'MEDIUM', 'LOW'];
    
    for (const priority of priorities) {
      const target = this.session.targets.find(t => t.priority === priority && t.status === 'PENDING');
      if (target) {
        return target;
      }
    }
    
    return null;
  }

  /**
   * Get hunting progress summary
   */
  getProgress(): string {
    if (!this.session) return 'No active session';

    const pending = this.session.targets.filter(t => t.status === 'PENDING').length;
    const scanning = this.session.targets.filter(t => t.status === 'SCANNING').length;
    const completed = this.session.targets.filter(t => t.status === 'COMPLETED').length;
    const failed = this.session.targets.filter(t => t.status === 'FAILED').length;

    return `
🧠 Hunting Session: ${this.session.sessionId}
📊 Progress: ${completed}/${this.session.targets.length} targets completed
🎯 Status: ${pending} pending, ${scanning} scanning, ${failed} failed
🔍 Findings: ${this.session.totalFindings} total, ${this.session.verifiedVulns} verified
⏱️  Runtime: ${Math.round((Date.now() - new Date(this.session.startedAt).getTime()) / 1000 / 60)} minutes
    `.trim();
  }

  /**
   * Save session to disk
   */
  private async saveSession(): Promise<void> {
    if (this.session) {
      await fs.writeFile(this.memoryFile, JSON.stringify(this.session, null, 2));
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): HuntingSession | null {
    return this.session;
  }

  /**
   * Mark configuration flags
   */
  async updateConfiguration(pocEnabled: boolean, walletEnabled: boolean): Promise<void> {
    if (!this.session) return;

    this.session.configuration.pocEnabled = pocEnabled;
    this.session.configuration.walletEnabled = walletEnabled;
    await this.saveSession();
  }

  /**
   * Record a false positive pattern for learning
   */
  async recordFalsePositive(detectorName: string): Promise<void> {
    if (!this.session) return;

    if (!this.session.learning.falsePositivePatterns.includes(detectorName)) {
      this.session.learning.falsePositivePatterns.push(detectorName);
    }
    this.session.learning.falsePositiveCount++;
    await this.saveSession();
    await this.archiveSession();
    console.log(`[HuntingMemory] Recorded FP: ${detectorName}`);
  }

  /**
   * Record a confirmed (verified) pattern for learning
   */
  async recordConfirmedPattern(detectorName: string): Promise<void> {
    if (!this.session) return;

    if (!this.session.learning.confirmedPatterns.includes(detectorName)) {
      this.session.learning.confirmedPatterns.push(detectorName);
    }
    this.session.learning.confirmedCount++;
    await this.saveSession();
    await this.archiveSession();
    console.log(`[HuntingMemory] Recorded confirmed: ${detectorName}`);
  }

  /**
   * Pause the current session
   */
  async pauseSession(): Promise<void> {
    if (!this.session) return;

    this.session.status = 'paused';
    this.session.pausedAt = new Date().toISOString();
    await this.saveSession();
    await this.archiveSession();
    console.log(`[HuntingMemory] Paused session: ${this.session.sessionId}`);
  }

  /**
   * Complete the current session
   */
  async completeSession(): Promise<HuntingSession | null> {
    if (!this.session) return null;

    this.session.status = 'completed';
    this.session.completedAt = new Date().toISOString();
    await this.saveSession();
    await this.archiveSession();
    console.log(`[HuntingMemory] Completed session: ${this.session.sessionId}`);

    const completed = this.session;
    this.session = null;
    return completed;
  }

  /**
   * List all archived sessions
   */
  async listSessions(): Promise<Array<{ sessionId: string; chain: string; status: string; startedAt: string; stats: { protocols: number; findings: number; verified: number } }>> {
    const files = fsSync.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const sessions: Array<{ sessionId: string; chain: string; status: string; startedAt: string; stats: { protocols: number; findings: number; verified: number } }> = [];

    for (const file of files) {
      try {
        const data = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8');
        const session = JSON.parse(data) as HuntingSession;
        sessions.push({
          sessionId: session.sessionId,
          chain: session.chain,
          status: session.status || 'unknown',
          startedAt: session.startedAt,
          stats: {
            protocols: session.progress.protocolsScanned,
            findings: session.totalFindings,
            verified: session.verifiedVulns
          }
        });
      } catch {
        // Skip invalid files
      }
    }

    // Sort by start date, newest first
    return sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  /**
   * Get aggregated learning data from all sessions
   */
  async getLearningData(): Promise<{ falsePositivePatterns: string[]; confirmedPatterns: string[]; totalFP: number; totalConfirmed: number }> {
    const sessions = await this.listSessions();
    const fpPatterns = new Set<string>();
    const confirmedPatterns = new Set<string>();
    let totalFP = 0;
    let totalConfirmed = 0;

    for (const { sessionId } of sessions) {
      try {
        const data = await fs.readFile(path.join(SESSIONS_DIR, `${sessionId}.json`), 'utf8');
        const session = JSON.parse(data) as HuntingSession;
        if (session.learning) {
          session.learning.falsePositivePatterns?.forEach(p => fpPatterns.add(p));
          session.learning.confirmedPatterns?.forEach(p => confirmedPatterns.add(p));
          totalFP += session.learning.falsePositiveCount || 0;
          totalConfirmed += session.learning.confirmedCount || 0;
        }
      } catch {
        // Skip invalid files
      }
    }

    return {
      falsePositivePatterns: Array.from(fpPatterns),
      confirmedPatterns: Array.from(confirmedPatterns),
      totalFP,
      totalConfirmed
    };
  }

  /**
   * Get recommended next TVL tier based on current progress
   */
  getNextTvlTier(): { min: number; max: number; name: string } | null {
    if (!this.session) return TVL_TIERS[0];

    const currentMax = this.session.configuration.maxTvl;
    const currentTierIndex = TVL_TIERS.findIndex(t => t.max === currentMax);

    if (currentTierIndex >= 0 && currentTierIndex < TVL_TIERS.length - 1) {
      return TVL_TIERS[currentTierIndex + 1];
    }

    return null;
  }

  /**
   * Adjust TVL range for progressive hunting
   */
  async adjustTvlRange(minTvl: number, maxTvl: number): Promise<void> {
    if (!this.session) return;

    this.session.configuration.minTvl = minTvl;
    this.session.configuration.maxTvl = maxTvl;
    this.session.tvlRange = `$${this.formatTvl(minTvl)} - $${this.formatTvl(maxTvl)}`;
    await this.saveSession();
    await this.archiveSession();
    console.log(`[HuntingMemory] Adjusted TVL range to ${this.session.tvlRange}`);
  }

  /**
   * Archive session to sessions directory
   */
  private async archiveSession(): Promise<void> {
    if (!this.session) return;
    const archivePath = path.join(SESSIONS_DIR, `${this.session.sessionId}.json`);
    await fs.writeFile(archivePath, JSON.stringify(this.session, null, 2));
  }

  /**
   * Format TVL for display
   */
  private formatTvl(tvl: number): string {
    if (tvl >= 1_000_000) {
      return `${(tvl / 1_000_000).toFixed(1)}M`;
    } else if (tvl >= 1_000) {
      return `${(tvl / 1_000).toFixed(0)}K`;
    }
    return tvl.toFixed(0);
  }
}

export const huntingMemory = new HuntingMemory();