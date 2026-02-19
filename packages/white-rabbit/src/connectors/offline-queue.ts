// ═══════════════════════════════════════════════════════════════════════════════
// Offline Queue - Store findings locally, submit when connected
// Resilient operation for unstable connections
// ═══════════════════════════════════════════════════════════════════════════════

import { Finding } from '../types.js';
import { writeFile, readFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface QueuedFinding {
  id: string;
  finding: Finding;
  protocol: string;
  submittedAt?: Date;
  error?: string;
  retries: number;
  maxRetries: number;
  createdAt: Date;
}

export interface QueueStats {
  pending: number;
  submitted: number;
  failed: number;
  total: number;
}

/**
 * Offline queue for resilient finding submission
 */
export class OfflineQueue {
  private queueDir: string;
  private queue: Map<string, QueuedFinding> = new Map();
  private isProcessing = false;
  private maxRetries = 5;
  private retryDelayMs = 5000;

  constructor(customDir?: string) {
    this.queueDir = customDir || join(homedir(), '.white-rabbit', 'queue');
    this.ensureDir();
  }

  /**
   * Add a finding to the queue
   */
  async enqueue(finding: Finding, protocol: string): Promise<string> {
    const id = `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const queued: QueuedFinding = {
      id,
      finding,
      protocol,
      retries: 0,
      maxRetries: this.maxRetries,
      createdAt: new Date(),
    };

    this.queue.set(id, queued);
    await this.saveQueue();

    return id;
  }

  /**
   * Process the queue
   */
  async process(submitFn: (finding: Finding, protocol: string) => Promise<void>): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Load any persisted queue
      await this.loadQueue();

      const pending = Array.from(this.queue.values())
        .filter(q => !q.submittedAt && q.retries < q.maxRetries);

      for (const item of pending) {
        try {
          await submitFn(item.finding, item.protocol);
          
          // Mark as submitted
          item.submittedAt = new Date();
          this.queue.set(item.id, item);
          await this.saveQueue();
        } catch (error) {
          item.retries++;
          item.error = error instanceof Error ? error.message : String(error);
          this.queue.set(item.id, item);
          await this.saveQueue();

          if (item.retries < item.maxRetries) {
            // Wait before retrying
            await this.delay(this.retryDelayMs * item.retries);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const items = Array.from(this.queue.values());
    
    return {
      pending: items.filter(q => !q.submittedAt && q.retries < q.maxRetries).length,
      submitted: items.filter(q => q.submittedAt).length,
      failed: items.filter(q => !q.submittedAt && q.retries >= q.maxRetries).length,
      total: items.length,
    };
  }

  /**
   * Get pending items
   */
  getPending(): QueuedFinding[] {
    return Array.from(this.queue.values())
      .filter(q => !q.submittedAt && q.retries < q.maxRetries);
  }

  /**
   * Get failed items
   */
  getFailed(): QueuedFinding[] {
    return Array.from(this.queue.values())
      .filter(q => !q.submittedAt && q.retries >= q.maxRetries);
  }

  /**
   * Get submitted items
   */
  getSubmitted(): QueuedFinding[] {
    return Array.from(this.queue.values())
      .filter(q => q.submittedAt);
  }

  /**
   * Retry a specific failed item
   */
  async retry(id: string): Promise<boolean> {
    const item = this.queue.get(id);
    if (!item) return false;
    
    if (item.submittedAt) return false;
    
    item.retries = 0;
    item.error = undefined;
    this.queue.set(id, item);
    await this.saveQueue();
    
    return true;
  }

  /**
   * Remove an item from the queue
   */
  async remove(id: string): Promise<boolean> {
    const existed = this.queue.delete(id);
    if (existed) {
      await this.saveQueue();
    }
    return existed;
  }

  /**
   * Clear the entire queue
   */
  async clear(): Promise<void> {
    this.queue.clear();
    await this.saveQueue();
  }

  /**
   * Export queue to JSON
   */
  export(): string {
    return JSON.stringify({
      queue: Array.from(this.queue.values()),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import queue from JSON
   */
  async import(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data);
      if (parsed.queue && Array.isArray(parsed.queue)) {
        for (const item of parsed.queue) {
          this.queue.set(item.id, {
            ...item,
            createdAt: new Date(item.createdAt),
            submittedAt: item.submittedAt ? new Date(item.submittedAt) : undefined,
          });
        }
        await this.saveQueue();
      }
    } catch (error) {
      throw new Error(`Failed to import queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═════════════════════════════════════════════════════════════════════════════

  private async ensureDir(): Promise<void> {
    try {
      await access(this.queueDir);
    } catch {
      await mkdir(this.queueDir, { recursive: true });
    }
  }

  private get queueFile(): string {
    return join(this.queueDir, 'queue.json');
  }

  private async saveQueue(): Promise<void> {
    await this.ensureDir();
    await writeFile(
      this.queueFile,
      JSON.stringify({
        queue: Array.from(this.queue.values()),
        savedAt: new Date().toISOString(),
      }, null, 2)
    );
  }

  private async loadQueue(): Promise<void> {
    try {
      const data = await readFile(this.queueFile, 'utf-8');
      const parsed = JSON.parse(data);
      
      if (parsed.queue && Array.isArray(parsed.queue)) {
        for (const item of parsed.queue) {
          this.queue.set(item.id, {
            ...item,
            createdAt: new Date(item.createdAt),
            submittedAt: item.submittedAt ? new Date(item.submittedAt) : undefined,
          });
        }
      }
    } catch {
      // No saved queue or corrupted, start fresh
      this.queue.clear();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default OfflineQueue;
