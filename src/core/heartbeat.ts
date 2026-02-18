/**
 * WHITE RABBIT - Heartbeat Daemon
 * 
 * Automaton Pattern: Cron-based scheduled task execution
 * Runs tasks even when agent "sleeps"
 */

import { serviceLogger } from './logger.js';
import { LocalDatabase, getLocalDatabase, HeartbeatEntry } from './database-sqlite.js';
import { SurvivalManager, getSurvivalManager } from './survival.js';

export type TaskHandler = () => Promise<void>;

export interface HeartbeatTask {
  name: string;
  schedule: string;  // Cron expression
  handler: TaskHandler;
  enabled: boolean;
}

/**
 * Cron Expression Parser
 * Supports: * * * * * (minute hour day month weekday)
 */
export class CronExpression {
  private minute: number[];
  private hour: number[];
  private dayOfMonth: number[];
  private month: number[];
  private dayOfWeek: number[];

  constructor(expression: string) {
    const parts = expression.split(' ');
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${expression}`);
    }

    this.minute = this.parseField(parts[0], 0, 59);
    this.hour = this.parseField(parts[1], 0, 23);
    this.dayOfMonth = this.parseField(parts[2], 1, 31);
    this.month = this.parseField(parts[3], 1, 12);
    this.dayOfWeek = this.parseField(parts[4], 0, 6);
  }

  private parseField(field: string, min: number, max: number): number[] {
    if (field === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    }

    if (field.includes('/')) {
      const [range, step] = field.split('/');
      const stepNum = parseInt(step);
      const values: number[] = [];
      for (let i = min; i <= max; i += stepNum) {
        values.push(i);
      }
      return values;
    }

    if (field.includes(',')) {
      return field.split(',').map(v => parseInt(v.trim()));
    }

    if (field.includes('-')) {
      const [start, end] = field.split('-').map(v => parseInt(v));
      return Array.from({ length: end - start + 1 }, (_, i) => i + start);
    }

    return [parseInt(field)];
  }

  /**
   * Check if the cron expression matches the given date
   */
  matches(date: Date = new Date()): boolean {
    return (
      this.minute.includes(date.getMinutes()) &&
      this.hour.includes(date.getHours()) &&
      this.dayOfMonth.includes(date.getDate()) &&
      this.month.includes(date.getMonth() + 1) &&
      this.dayOfWeek.includes(date.getDay())
    );
  }

  /**
   * Get next run time
   */
  getNextRun(after: Date = new Date()): Date {
    const next = new Date(after);
    next.setSeconds(0);
    next.setMilliseconds(0);
    next.setMinutes(next.getMinutes() + 1);

    // Simple brute force: check each minute for up to 1 year
    for (let i = 0; i < 525600; i++) {
      if (this.matches(next)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }

    throw new Error('Could not find next run time');
  }
}

/**
 * Heartbeat Daemon
 * 
 * Runs scheduled tasks even when the main process is idle.
 * Database-backed for persistence across restarts.
 */
export class HeartbeatDaemon {
  private db: LocalDatabase;
  private survival: SurvivalManager;
  private tasks: Map<string, HeartbeatTask> = new Map();
  private running: boolean = false;
  private checkIntervalMs: number = 60000; // Check every minute
  private intervalId?: NodeJS.Timeout;

  constructor(db?: LocalDatabase, survival?: SurvivalManager) {
    this.db = db || getLocalDatabase();
    this.survival = survival || getSurvivalManager();
  }

  /**
   * Register a task
   */
  registerTask(task: HeartbeatTask): void {
    this.tasks.set(task.name, task);
    
    // Persist to database
    const cron = new CronExpression(task.schedule);
    this.db.upsertHeartbeatEntry({
      name: task.name,
      schedule: task.schedule,
      task: task.name,
      enabled: task.enabled,
      lastRun: undefined,
      nextRun: cron.getNextRun().toISOString(),
      params: '{}',
    });

    serviceLogger.info('Heartbeat task registered', {
      name: task.name,
      schedule: task.schedule,
      enabled: task.enabled,
    });
  }

  /**
   * Built-in tasks
   */
  registerBuiltinTasks(): void {
    // Health check
    this.registerTask({
      name: 'health_check',
      schedule: '*/5 * * * *',  // Every 5 minutes
      enabled: true,
      handler: async () => {
        serviceLogger.debug('Health check running');
        // Check system health
      },
    });

    // Credit check (survival economics)
    this.registerTask({
      name: 'credit_check',
      schedule: '*/10 * * * *',  // Every 10 minutes
      enabled: true,
      handler: async () => {
        this.survival.checkAndApply();
      },
    });

    // Pattern cleanup
    this.registerTask({
      name: 'pattern_cleanup',
      schedule: '0 */6 * * *',  // Every 6 hours
      enabled: true,
      handler: async () => {
        serviceLogger.info('Running pattern cleanup');
        // Clean up old patterns
      },
    });

    // Report generation
    this.registerTask({
      name: 'daily_report',
      schedule: '0 9 * * *',  // Daily at 9 AM
      enabled: true,
      handler: async () => {
        serviceLogger.info('Generating daily report');
        // Generate and send report
      },
    });

    // State snapshot
    this.registerTask({
      name: 'state_snapshot',
      schedule: '0 */4 * * *',  // Every 4 hours
      enabled: true,
      handler: async () => {
        serviceLogger.info('Creating state snapshot');
        // Create atomic snapshot
      },
    });
  }

  /**
   * Start the daemon
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    serviceLogger.info('Heartbeat daemon started');

    this.intervalId = setInterval(() => {
      this.checkAndRun();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the daemon
   */
  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    serviceLogger.info('Heartbeat daemon stopped');
  }

  /**
   * Check for due tasks and run them
   */
  private async checkAndRun(): Promise<void> {
    if (!this.running) return;

    // Check if we should be running based on survival tier
    if (!this.survival.canOperate('scan')) {
      serviceLogger.debug('Skipping heartbeat - survival tier restrictions');
      return;
    }

    const now = new Date();
    const entries = this.db.getHeartbeatEntries();

    for (const entry of entries) {
      const task = this.tasks.get(entry.name);
      if (!task || !task.enabled) continue;

      // Check if due
      const nextRun = entry.nextRun ? new Date(entry.nextRun) : null;
      if (!nextRun || now >= nextRun) {
        await this.executeTask(task);
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: HeartbeatTask): Promise<void> {
    const startTime = Date.now();
    serviceLogger.info('Executing heartbeat task', { name: task.name });

    try {
      await task.handler();
      
      const duration = Date.now() - startTime;
      serviceLogger.info('Heartbeat task completed', { name: task.name, duration });
    } catch (err) {
      serviceLogger.error('Heartbeat task failed', { name: task.name }, err as Error);
    }

    // Update next run time
    try {
      const cron = new CronExpression(task.schedule);
      const nextRun = cron.getNextRun().toISOString();
      
      this.db.upsertHeartbeatEntry({
        name: task.name,
        schedule: task.schedule,
        task: task.name,
        enabled: task.enabled,
        lastRun: new Date().toISOString(),
        nextRun,
        params: '{}',
      });
    } catch (err) {
      serviceLogger.error('Failed to update heartbeat entry', { name: task.name }, err as Error);
    }
  }

  /**
   * Run a task immediately (manual trigger)
   */
  async runNow(taskName: string): Promise<boolean> {
    const task = this.tasks.get(taskName);
    if (!task) {
      serviceLogger.warn('Task not found', { name: taskName });
      return false;
    }

    await this.executeTask(task);
    return true;
  }

  /**
   * Enable/disable a task
   */
  setTaskEnabled(taskName: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskName);
    if (!task) return false;

    task.enabled = enabled;
    
    // Update database
    const entry = this.db.getHeartbeatEntries().find(e => e.name === taskName);
    if (entry) {
      entry.enabled = enabled;
      this.db.upsertHeartbeatEntry(entry);
    }

    serviceLogger.info('Task ' + (enabled ? 'enabled' : 'disabled'), { name: taskName });
    return true;
  }

  /**
   * Get task status
   */
  getStatus(): Array<{
    name: string;
    schedule: string;
    enabled: boolean;
    lastRun?: string;
    nextRun?: string;
  }> {
    const entries = this.db.getHeartbeatEntries();
    return entries.map(e => ({
      name: e.name,
      schedule: e.schedule,
      enabled: e.enabled,
      lastRun: e.lastRun,
      nextRun: e.nextRun,
    }));
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }
}

// Global instance
let globalHeartbeatDaemon: HeartbeatDaemon | null = null;

export function getHeartbeatDaemon(db?: LocalDatabase, survival?: SurvivalManager): HeartbeatDaemon {
  if (!globalHeartbeatDaemon) {
    globalHeartbeatDaemon = new HeartbeatDaemon(db, survival);
  }
  return globalHeartbeatDaemon;
}

export function resetHeartbeatDaemon(): void {
  globalHeartbeatDaemon?.stop();
  globalHeartbeatDaemon = null;
}

export default HeartbeatDaemon;
