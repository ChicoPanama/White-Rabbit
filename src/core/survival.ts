/**
 * WHITE RABBIT - Survival Economics (4-Tier System)
 * 
 * Automaton Pattern: Automatic cost management with graceful degradation
 * Tiers: normal -> low_compute -> critical -> dead
 */

import { serviceLogger } from './logger.js';
import { AuditLogger, getAuditLogger } from './audit.js';

export type SurvivalTier = 'normal' | 'low_compute' | 'critical' | 'dead';

export interface TierConfig {
  tier: SurvivalTier;
  model: string;              // AI model to use
  modelFallback?: string;     // Fallback model
  heartbeatIntervalMs: number;
  maxConcurrentScans: number;
  enableAiAnalysis: boolean;
  enableNotifications: boolean;
  enablePatternLearning: boolean;
  minTvlThreshold: number;    // Adjust based on tier
}

export interface SurvivalThresholds {
  lowCompute: number;     // $5.00
  critical: number;       // $1.00
  dead: number;          // $0.00
}

export interface TierTransition {
  from: SurvivalTier;
  to: SurvivalTier;
  timestamp: string;
  reason: string;
  creditsRemaining: number;
}

/**
 * Survival Manager
 * 
 * Monitors API credit balance and automatically adjusts behavior.
 * Prevents hard failures by degrading gracefully.
 */
export class SurvivalManager {
  private currentTier: SurvivalTier = 'normal';
  private thresholds: SurvivalThresholds;
  private getCreditsRemaining: () => number;
  private audit: AuditLogger;
  private transitionHistory: TierTransition[] = [];

  // Tier configurations
  private static TIER_CONFIGS: Record<SurvivalTier, TierConfig> = {
    normal: {
      tier: 'normal',
      model: 'claude-sonnet-4-20250514',
      modelFallback: 'claude-haiku-4-20250414',
      heartbeatIntervalMs: 10 * 60 * 1000,  // 10 minutes
      maxConcurrentScans: 5,
      enableAiAnalysis: true,
      enableNotifications: true,
      enablePatternLearning: true,
      minTvlThreshold: 10_000_000,  // $10M
    },
    low_compute: {
      tier: 'low_compute',
      model: 'claude-haiku-4-20250414',
      modelFallback: 'gemini-2.0-flash',
      heartbeatIntervalMs: 30 * 60 * 1000,  // 30 minutes
      maxConcurrentScans: 3,
      enableAiAnalysis: true,
      enableNotifications: true,
      enablePatternLearning: false,
      minTvlThreshold: 1_000_000,  // $1M
    },
    critical: {
      tier: 'critical',
      model: 'gemini-2.0-flash',
      modelFallback: 'kimi-k2-0711-preview',
      heartbeatIntervalMs: 60 * 60 * 1000,  // 60 minutes
      maxConcurrentScans: 1,
      enableAiAnalysis: false,  // Disable paid AI
      enableNotifications: false,  // Disable paid notifications
      enablePatternLearning: false,
      minTvlThreshold: 100_000,  // $100K
    },
    dead: {
      tier: 'dead',
      model: 'none',
      heartbeatIntervalMs: 0,  // No heartbeat
      maxConcurrentScans: 0,
      enableAiAnalysis: false,
      enableNotifications: false,
      enablePatternLearning: false,
      minTvlThreshold: Infinity,  // Don't scan
    },
  };

  constructor(
    getCreditsRemaining: () => number,
    thresholds?: Partial<SurvivalThresholds>,
    audit?: AuditLogger
  ) {
    this.getCreditsRemaining = getCreditsRemaining;
    this.thresholds = {
      lowCompute: 5.0,
      critical: 1.0,
      dead: 0.0,
      ...thresholds,
    };
    this.audit = audit || getAuditLogger();
  }

  /**
   * Check current tier and apply if changed
   */
  checkAndApply(): SurvivalTier {
    const credits = this.getCreditsRemaining();
    const newTier = this.calculateTier(credits);

    if (newTier !== this.currentTier) {
      this.transition(newTier, credits);
    }

    return this.currentTier;
  }

  /**
   * Calculate tier based on remaining credits
   */
  private calculateTier(credits: number): SurvivalTier {
    if (credits <= this.thresholds.dead) return 'dead';
    if (credits <= this.thresholds.critical) return 'critical';
    if (credits <= this.thresholds.lowCompute) return 'low_compute';
    return 'normal';
  }

  /**
   * Transition to new tier
   */
  private transition(toTier: SurvivalTier, creditsRemaining: number): void {
    const fromTier = this.currentTier;
    const reason = this.getTransitionReason(fromTier, toTier, creditsRemaining);

    // Record transition
    const transition: TierTransition = {
      from: fromTier,
      to: toTier,
      timestamp: new Date().toISOString(),
      reason,
      creditsRemaining,
    };
    this.transitionHistory.push(transition);

    // Apply tier restrictions
    this.applyTierRestrictions(toTier);

    // Log audit entry
    this.audit.logTierChange(fromTier, toTier, reason);

    // Update current tier
    this.currentTier = toTier;

    serviceLogger.warn('Tier transition', {
      from: fromTier,
      to: toTier,
      creditsRemaining,
      reason,
    });
  }

  /**
   * Get human-readable transition reason
   */
  private getTransitionReason(from: SurvivalTier, to: SurvivalTier, credits: number): string {
    if (to === 'dead') {
      return `Credits depleted ($${credits.toFixed(2)})`;
    }
    if (to === 'critical') {
      return `Low credits: $${credits.toFixed(2)} (threshold: $${this.thresholds.critical})`;
    }
    if (to === 'low_compute') {
      return `Reduced credits: $${credits.toFixed(2)} (threshold: $${this.thresholds.lowCompute})`;
    }
    if (from === 'dead' || from === 'critical') {
      return `Credits restored: $${credits.toFixed(2)}`;
    }
    return `Credits increased: $${credits.toFixed(2)}`;
  }

  /**
   * Apply restrictions for the given tier
   */
  private applyTierRestrictions(tier: SurvivalTier): void {
    const config = SurvivalManager.TIER_CONFIGS[tier];

    // These would typically update global config or emit events
    // For now, we just log the restrictions
    serviceLogger.info('Tier restrictions applied', {
      tier,
      model: config.model,
      heartbeatInterval: config.heartbeatIntervalMs,
      maxScans: config.maxConcurrentScans,
      enableAi: config.enableAiAnalysis,
      enableNotifications: config.enableNotifications,
    });
  }

  /**
   * Get current tier configuration
   */
  getConfig(): TierConfig {
    return SurvivalManager.TIER_CONFIGS[this.currentTier];
  }

  /**
   * Get current tier
   */
  getCurrentTier(): SurvivalTier {
    return this.currentTier;
  }

  /**
   * Get transition history
   */
  getTransitionHistory(): TierTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Force set tier (for testing or manual override)
   */
  forceSetTier(tier: SurvivalTier): void {
    const credits = this.getCreditsRemaining();
    this.transition(tier, credits);
  }

  /**
   * Check if operation is allowed in current tier
   */
  canOperate(operation: 'scan' | 'ai_analysis' | 'notification' | 'pattern_learning'): boolean {
    const config = this.getConfig();

    switch (operation) {
      case 'scan':
        return config.maxConcurrentScans > 0;
      case 'ai_analysis':
        return config.enableAiAnalysis;
      case 'notification':
        return config.enableNotifications;
      case 'pattern_learning':
        return config.enablePatternLearning;
      default:
        return true;
    }
  }

  /**
   * Get recommended model for current tier
   */
  getRecommendedModel(): string {
    return this.getConfig().model;
  }

  /**
   * Get heartbeat interval for current tier
   */
  getHeartbeatInterval(): number {
    return this.getConfig().heartbeatIntervalMs;
  }

  /**
   * Generate survival report
   */
  generateReport(): string {
    const credits = this.getCreditsRemaining();
    const config = this.getConfig();
    
    let report = `## SURVIVAL REPORT\n\n`;
    report += `Current Tier: ${this.currentTier.toUpperCase()}\n`;
    report += `Credits Remaining: $${credits.toFixed(2)}\n\n`;
    
    report += `### Current Configuration\n\n`;
    report += `- Model: ${config.model}\n`;
    report += `- Heartbeat: ${config.heartbeatIntervalMs / 60000} minutes\n`;
    report += `- Max Concurrent Scans: ${config.maxConcurrentScans}\n`;
    report += `- AI Analysis: ${config.enableAiAnalysis ? 'enabled' : 'disabled'}\n`;
    report += `- Notifications: ${config.enableNotifications ? 'enabled' : 'disabled'}\n`;
    report += `- Pattern Learning: ${config.enablePatternLearning ? 'enabled' : 'disabled'}\n\n`;
    
    report += `### Thresholds\n\n`;
    report += `- Normal: >$${this.thresholds.lowCompute}\n`;
    report += `- Low Compute: $${this.thresholds.critical} - $${this.thresholds.lowCompute}\n`;
    report += `- Critical: $${this.thresholds.dead} - $${this.thresholds.critical}\n`;
    report += `- Dead: $${this.thresholds.dead}\n\n`;
    
    if (this.transitionHistory.length > 0) {
      report += `### Transition History\n\n`;
      for (const t of this.transitionHistory.slice(-10)) {
        report += `- ${t.timestamp}: ${t.from} -> ${t.to} (${t.reason})\n`;
      }
    }
    
    return report;
  }
}

// Global instance
let globalSurvivalManager: SurvivalManager | null = null;

export function getSurvivalManager(
  getCreditsRemaining?: () => number,
  thresholds?: Partial<SurvivalThresholds>
): SurvivalManager {
  if (!globalSurvivalManager) {
    if (!getCreditsRemaining) {
      // Default: always return $10 (normal tier)
      getCreditsRemaining = () => 10;
    }
    globalSurvivalManager = new SurvivalManager(getCreditsRemaining, thresholds);
  }
  return globalSurvivalManager;
}

export function resetSurvivalManager(): void {
  globalSurvivalManager = null;
}

export default SurvivalManager;
