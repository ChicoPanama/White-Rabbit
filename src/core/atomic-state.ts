/**
 * WHITE RABBIT - Atomic State Persistence
 * 
 * PicoClaw Pattern: Atomic file writes using temp-file + rename
 * Ensures state is never corrupted, even if process crashes during write
 */

import * as fs from 'fs';
import * as path from 'path';
import { serviceLogger } from './logger.js';

export interface AtomicStateConfig {
  stateDir: string;
  snapshotDir?: string;
  maxSnapshots?: number;
}

/**
 * Atomic State Manager
 * 
 * All state writes are atomic (temp file + rename)
 * Snapshots provide point-in-time recovery
 */
export class AtomicStateManager {
  private stateDir: string;
  private snapshotDir: string;
  private maxSnapshots: number;

  constructor(config: AtomicStateConfig) {
    this.stateDir = config.stateDir;
    this.snapshotDir = config.snapshotDir || path.join(config.stateDir, 'snapshots');
    this.maxSnapshots = config.maxSnapshots || 10;
    
    // Ensure directories exist with secure permissions
    this.secureMkdir(this.stateDir, 0o700);
    this.secureMkdir(this.snapshotDir, 0o700);
    
    serviceLogger.info('AtomicStateManager initialized', {
      stateDir: this.stateDir,
      snapshotDir: this.snapshotDir,
    });
  }

  /**
   * Save state atomically
   * Uses temp-file + rename pattern for atomicity
   */
  save<T>(key: string, data: T): void {
    const filePath = path.join(this.stateDir, `${key}.json`);
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      // Write to temp file
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
      
      // Atomic rename (POSIX guarantees this is atomic)
      fs.renameSync(tempPath, filePath);
      
      serviceLogger.debug('State saved atomically', { key, path: filePath });
    } catch (err) {
      // Clean up temp file on failure
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      serviceLogger.error('Failed to save state', { key, error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Load state from disk
   */
  load<T>(key: string): T | null {
    const filePath = path.join(this.stateDir, `${key}.json`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data) as T;
    } catch (err) {
      serviceLogger.error('Failed to load state', { key, error: (err as Error).message });
      return null;
    }
  }

  /**
   * Check if state exists
   */
  exists(key: string): boolean {
    const filePath = path.join(this.stateDir, `${key}.json`);
    return fs.existsSync(filePath);
  }

  /**
   * Delete state
   */
  delete(key: string): boolean {
    const filePath = path.join(this.stateDir, `${key}.json`);
    
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    try {
      fs.unlinkSync(filePath);
      serviceLogger.debug('State deleted', { key });
      return true;
    } catch (err) {
      serviceLogger.error('Failed to delete state', { key, error: (err as Error).message });
      return false;
    }
  }

  /**
   * List all state keys
   */
  list(): string[] {
    try {
      return fs.readdirSync(this.stateDir)
        .filter(f => f.endsWith('.json') && !f.includes('.tmp.'))
        .map(f => f.replace('.json', ''));
    } catch (err) {
      serviceLogger.error('Failed to list state', { error: (err as Error).message });
      return [];
    }
  }

  /**
   * Create a snapshot of current state
   */
  snapshot(name: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotKey = `${name}@${timestamp}`;
    const snapshotPath = path.join(this.snapshotDir, `${snapshotKey}.json`);
    
    // Collect all current state
    const states: Record<string, unknown> = {};
    for (const key of this.list()) {
      states[key] = this.load(key);
    }
    
    // Write snapshot atomically
    const tempPath = `${snapshotPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(states, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, snapshotPath);
    
    // Clean up old snapshots
    this.cleanupOldSnapshots();
    
    serviceLogger.info('Snapshot created', { name, key: snapshotKey });
  }

  /**
   * Restore from snapshot
   */
  restore(snapshotKey: string): boolean {
    const snapshotPath = path.join(this.snapshotDir, `${snapshotKey}.json`);
    
    if (!fs.existsSync(snapshotPath)) {
      serviceLogger.error('Snapshot not found', { key: snapshotKey });
      return false;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      
      // Restore each state file
      for (const [key, value] of Object.entries(data)) {
        this.save(key, value);
      }
      
      serviceLogger.info('State restored from snapshot', { key: snapshotKey });
      return true;
    } catch (err) {
      serviceLogger.error('Failed to restore snapshot', { key: snapshotKey, error: (err as Error).message });
      return false;
    }
  }

  /**
   * List available snapshots
   */
  listSnapshots(): string[] {
    try {
      return fs.readdirSync(this.snapshotDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse();
    } catch (err) {
      return [];
    }
  }

  /**
   * Create secure directory with proper permissions
   */
  private secureMkdir(dirPath: string, mode: number): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode });
    }
  }

  /**
   * Clean up old snapshots, keeping only maxSnapshots
   */
  private cleanupOldSnapshots(): void {
    const snapshots = this.listSnapshots();
    
    if (snapshots.length > this.maxSnapshots) {
      const toDelete = snapshots.slice(this.maxSnapshots);
      for (const key of toDelete) {
        const snapshotPath = path.join(this.snapshotDir, `${key}.json`);
        try {
          fs.unlinkSync(snapshotPath);
          serviceLogger.debug('Old snapshot cleaned up', { key });
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  }
}

// Global instance
let globalStateManager: AtomicStateManager | null = null;

export function getStateManager(config?: AtomicStateConfig): AtomicStateManager {
  if (!globalStateManager) {
    if (!config) {
      throw new Error('StateManager not initialized');
    }
    globalStateManager = new AtomicStateManager(config);
  }
  return globalStateManager;
}

export function resetStateManager(): void {
  globalStateManager = null;
}

export default AtomicStateManager;
