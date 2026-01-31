/**
 * Lane Queue
 *
 * Control layer for sessions that:
 * 1. Queues requests to prevent overwhelming the LLM API
 * 2. Manages rate limiting across auth profiles
 * 3. Provides backpressure handling
 */

import { EventEmitter } from 'events';

interface QueuedRequest {
  id: string;
  sessionId: string;
  message: string;
  priority: number;
  timestamp: Date;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

interface AuthProfile {
  name: string;
  available: boolean;
  cooldownUntil?: Date;
  requestCount: number;
  lastRequest?: Date;
}

export class LaneQueue extends EventEmitter {
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;
  private authProfiles: Map<string, AuthProfile> = new Map();

  // Configuration
  private maxConcurrent: number = 1;
  private requestsPerMinute: number = 50;
  private cooldownDuration: number = 60000; // 1 minute

  constructor() {
    super();
    this.initAuthProfiles();
  }

  /**
   * Initialize auth profiles from config
   */
  private initAuthProfiles(): void {
    this.authProfiles.set('primary', {
      name: 'primary',
      available: true,
      requestCount: 0
    });

    this.authProfiles.set('fallback', {
      name: 'fallback',
      available: true,
      requestCount: 0
    });
  }

  /**
   * Add request to queue
   */
  async enqueue(
    sessionId: string,
    message: string,
    priority: number = 0
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sessionId,
        message,
        priority,
        timestamp: new Date(),
        resolve,
        reject
      };

      // Insert by priority (higher priority first)
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.emit('enqueued', { id: request.id, queueLength: this.queue.length });

      // Start processing if not already
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      // Get available auth profile
      const profile = this.getAvailableProfile();

      if (!profile) {
        // All profiles in cooldown - requeue and wait
        this.queue.unshift(request);
        this.emit('allProfilesCooldown', {
          nextAvailable: this.getNextAvailableTime()
        });

        await this.waitForAvailableProfile();
        continue;
      }

      try {
        this.emit('processing', { id: request.id, profile: profile.name });

        // Update profile stats
        profile.requestCount++;
        profile.lastRequest = new Date();

        // Execute request (emit event for external handler)
        const result = await this.executeRequest(request, profile);

        request.resolve(result);
        this.emit('completed', { id: request.id });

      } catch (error: any) {
        // Handle rate limit errors
        if (error.status === 429 || error.message?.includes('rate limit')) {
          profile.available = false;
          profile.cooldownUntil = new Date(Date.now() + this.cooldownDuration);

          this.emit('rateLimited', {
            profile: profile.name,
            cooldownUntil: profile.cooldownUntil
          });

          // Requeue the request
          this.queue.unshift(request);
        } else {
          request.reject(error);
          this.emit('error', { id: request.id, error });
        }
      }

      // Small delay between requests
      await this.delay(100);
    }

    this.processing = false;
  }

  /**
   * Get first available auth profile
   */
  private getAvailableProfile(): AuthProfile | null {
    const now = new Date();

    for (const [, profile] of this.authProfiles) {
      if (profile.cooldownUntil && profile.cooldownUntil > now) {
        continue;
      }

      if (profile.cooldownUntil && profile.cooldownUntil <= now) {
        profile.available = true;
        profile.cooldownUntil = undefined;
        profile.requestCount = 0;
      }

      if (profile.available) {
        return profile;
      }
    }

    return null;
  }

  /**
   * Get next time any profile will be available
   */
  private getNextAvailableTime(): Date {
    let earliest = new Date(Date.now() + 3600000);

    for (const [, profile] of this.authProfiles) {
      if (profile.cooldownUntil && profile.cooldownUntil < earliest) {
        earliest = profile.cooldownUntil;
      }
    }

    return earliest;
  }

  /**
   * Wait for a profile to become available
   */
  private async waitForAvailableProfile(): Promise<void> {
    const nextAvailable = this.getNextAvailableTime();
    const waitTime = Math.max(0, nextAvailable.getTime() - Date.now());

    console.log(`All profiles in cooldown. Waiting ${waitTime}ms...`);
    await this.delay(waitTime + 1000);
  }

  /**
   * Execute the actual request - override to integrate with LLM client
   */
  protected async executeRequest(
    request: QueuedRequest,
    profile: AuthProfile
  ): Promise<any> {
    this.emit('executeRequest', { request, profile });
    return { success: true, requestId: request.id };
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    processing: boolean;
    profiles: { name: string; available: boolean; cooldownUntil?: Date }[];
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      profiles: Array.from(this.authProfiles.values()).map(p => ({
        name: p.name,
        available: p.available,
        cooldownUntil: p.cooldownUntil
      }))
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Force reset all cooldowns
   */
  resetCooldowns(): void {
    for (const [, profile] of this.authProfiles) {
      profile.available = true;
      profile.cooldownUntil = undefined;
      profile.requestCount = 0;
    }
    this.emit('cooldownsReset');
  }
}

// Singleton instance
export const laneQueue = new LaneQueue();
