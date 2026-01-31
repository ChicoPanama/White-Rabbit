/**
 * Clawd Compound Intelligence System
 *
 * Main entry point that integrates all modules:
 * - Context Guard: Token management and compression
 * - Lane Queue: Request queuing and rate limiting
 * - Compound Learning: Knowledge extraction and storage
 */

import { contextGuard, ContextGuard } from './contextGuard';
import { laneQueue, LaneQueue } from './laneQueue';
import { compoundLearning, CompoundLearning, Finding, TargetingDecision } from './compoundLearning';
import * as fs from 'fs/promises';
import * as path from 'path';

const CLAWD_DIR = process.env.HOME + '/clawd';
const MEMORY_BANK_DIR = `${CLAWD_DIR}/memory-bank`;

/**
 * Initialize Clawd system
 */
export async function initialize(): Promise<void> {
  console.log('Initializing Clawd Compound Intelligence...');

  // 1. Load system prompt
  await contextGuard.loadSystemPrompt();

  // 2. Load active context from memory bank
  try {
    const activeContext = await fs.readFile(
      path.join(MEMORY_BANK_DIR, 'activeContext.md'),
      'utf-8'
    );
    console.log('Loaded active context from memory bank');
  } catch {
    console.log('No active context found - starting fresh');
  }

  // 3. Set up lane queue event handlers
  laneQueue.on('rateLimited', (data) => {
    console.log(`Rate limited on ${data.profile}. Cooldown until ${data.cooldownUntil}`);
  });

  laneQueue.on('allProfilesCooldown', (data) => {
    console.log(`All profiles in cooldown. Next available: ${data.nextAvailable}`);
  });

  // 4. Check context health
  const health = await contextGuard.getContextHealth();
  console.log(`Context health: ${health.status} (${health.estimatedTokens} tokens)`);

  console.log('Clawd Compound Intelligence initialized');
}

/**
 * Process incoming message through the full pipeline
 */
export async function processMessage(
  sessionId: string,
  message: string
): Promise<string> {
  // 1. Pre-request check (compress if needed)
  const preCheck = await contextGuard.preRequestCheck();
  if (preCheck.message) {
    console.log(preCheck.message);
  }

  // 2. Add to session history
  contextGuard.addMessage('user', message);

  // 3. Build optimized context
  const context = await contextGuard.buildOptimizedContext();

  // 4. Queue the request
  const result = await laneQueue.enqueue(sessionId, message);

  // 5. Add response to history
  if (result.response) {
    contextGuard.addMessage('assistant', result.response);
  }

  return result.response;
}

/**
 * Commands for Memory Bank management
 */
export const commands = {
  /**
   * Get system status
   */
  async getStatus(): Promise<object> {
    const contextHealth = await contextGuard.getContextHealth();
    const queueStatus = laneQueue.getStatus();

    return {
      context: contextHealth,
      queue: queueStatus,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Compress context manually
   */
  async compressContext(): Promise<void> {
    await contextGuard.compress();
  },

  /**
   * Log a finding
   */
  async logFinding(finding: Finding): Promise<void> {
    await compoundLearning.logFinding(finding);

    if (finding.verified && !finding.falsePositive) {
      await compoundLearning.codifyVulnerability(finding);
    }
  },

  /**
   * Log a false positive
   */
  async logFalsePositive(finding: Finding, reason: string): Promise<void> {
    finding.falsePositive = true;
    await compoundLearning.codifyFalsePositive(finding, reason);
  },

  /**
   * Track targeting decision
   */
  async trackTargeting(decision: TargetingDecision): Promise<void> {
    await compoundLearning.trackTargetingDecision(decision);
  },

  /**
   * Update active context
   */
  async updateContext(updates: {
    currentFocus?: string;
    nextSteps?: string[];
    sessionNotes?: string;
  }): Promise<void> {
    await compoundLearning.updateActiveContext(updates);
  },

  /**
   * Learn from completed session
   */
  async learnFromSession(sessionSummary: {
    findings: Finding[];
    targetingDecisions: TargetingDecision[];
    falsePositives: { finding: Finding; reason: string }[];
  }): Promise<void> {
    await compoundLearning.learnFromSession(sessionSummary);
  }
};

// Export classes and instances
export {
  contextGuard,
  laneQueue,
  compoundLearning,
  ContextGuard,
  LaneQueue,
  CompoundLearning
};

// Export types
export type { Finding, TargetingDecision };
