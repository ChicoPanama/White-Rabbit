/**
 * WHITE RABBIT - Enhanced Kimi Client
 * 
 * Fixes:
 * - Retry logic with exponential backoff
 * - Request timeouts
 * - Circuit breaker pattern
 * - Structured logging
 * - Proper error classification
 */

import { aiLogger } from './logger.js';
import { sleep } from '../utils/helpers.js';

export interface KimiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface KimiResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

export interface KimiClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
}

export type KimiErrorType = 
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'INVALID_REQUEST'
  | 'SERVER_ERROR'
  | 'CIRCUIT_OPEN'
  | 'UNKNOWN';

export class KimiError extends Error {
  constructor(
    message: string,
    public type: KimiErrorType,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'KimiError';
  }
}

/**
 * Circuit Breaker State
 */
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if recovered
}

/**
 * Enhanced Kimi Client with resilience patterns
 */
export class KimiClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxRetries: number;
  private timeoutMs: number;
  
  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private circuitBreakerThreshold: number;
  private circuitBreakerResetMs: number;
  private lastFailureTime?: number;
  private halfOpenAttempts: number = 0;

  constructor(config: KimiClientConfig = {}) {
    // Support both Kimi and Moonshot APIs
    this.apiKey = config.apiKey || 
                  process.env.MOONSHOT_API_KEY || 
                  process.env.KIMI_API_KEY || '';
    
    this.baseUrl = config.baseUrl || 
                   process.env.KIMI_BASE_URL || 
                   (this.apiKey ? 'https://api.moonshot.ai/v1' : '');
    
    this.model = config.model || 'kimi-k2-0711-preview';
    this.maxRetries = config.maxRetries || 3;
    this.timeoutMs = config.timeoutMs || 30000;
    this.circuitBreakerThreshold = config.circuitBreakerThreshold || 5;
    this.circuitBreakerResetMs = config.circuitBreakerResetMs || 60000;
  }

  get isAvailable(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  get isCircuitOpen(): boolean {
    if (this.circuitState === CircuitState.OPEN) {
      // Check if we should try half-open
      if (this.lastFailureTime && 
          Date.now() - this.lastFailureTime > this.circuitBreakerResetMs) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        aiLogger.info('Kimi circuit breaker entering HALF_OPEN state');
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Send a message to Kimi API with full resilience
   */
  async createMessage(params: {
    system: string;
    messages: KimiMessage[];
    max_tokens?: number;
  }): Promise<KimiResponse> {
    if (!this.isAvailable) {
      throw new KimiError('Kimi client not configured', 'AUTH_ERROR');
    }

    if (this.isCircuitOpen) {
      throw new KimiError(
        'Circuit breaker is OPEN - too many failures',
        'CIRCUIT_OPEN',
        undefined,
        false
      );
    }

    let lastError: KimiError | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.makeRequest(params);
        this.onSuccess();
        return result;
      } catch (err) {
        lastError = this.classifyError(err);
        
        aiLogger.warn('Kimi request failed', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          errorType: lastError.type,
          retryable: lastError.retryable,
        });

        if (!lastError.retryable || attempt === this.maxRetries - 1) {
          break;
        }

        // Exponential backoff with jitter
        const delay = this.calculateBackoff(attempt);
        aiLogger.info(`Retrying Kimi request in ${delay}ms`);
        await sleep(delay);
      }
    }

    this.onFailure();
    throw lastError || new KimiError('Max retries exceeded', 'UNKNOWN');
  }

  /**
   * Make a single request with timeout
   */
  private async makeRequest(params: {
    system: string;
    messages: KimiMessage[];
    max_tokens?: number;
  }): Promise<KimiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: params.max_tokens || 4096,
          messages: [
            { role: 'system', content: params.system },
            ...params.messages,
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
        model: string;
      };

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0,
        },
        model: data.model || this.model,
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Classify errors for appropriate handling
   */
  private classifyError(err: unknown): KimiError {
    if (err instanceof KimiError) {
      return err;
    }

    const message = err instanceof Error ? err.message : String(err);
    
    // Rate limiting
    if (message.includes('429') || message.includes('rate limit')) {
      return new KimiError(
        'Rate limit exceeded',
        'RATE_LIMITED',
        429,
        true
      );
    }
    
    // Timeout
    if (message.includes('abort') || message.includes('timeout')) {
      return new KimiError(
        'Request timeout',
        'TIMEOUT',
        undefined,
        true
      );
    }
    
    // Auth errors
    if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
      return new KimiError(
        'Authentication failed',
        'AUTH_ERROR',
        message.includes('401') ? 401 : 403,
        false
      );
    }
    
    // Network errors
    if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
      return new KimiError(
        'Network error',
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
    
    // Server errors
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return new KimiError(
        'Server error',
        'SERVER_ERROR',
        500,
        true
      );
    }
    
    // Invalid request
    if (message.includes('400') || message.includes('invalid')) {
      return new KimiError(
        'Invalid request',
        'INVALID_REQUEST',
        400,
        false
      );
    }

    return new KimiError(message, 'UNKNOWN', undefined, true);
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
    const jitter = Math.random() * 1000; // 0-1s random
    return Math.min(baseDelay + jitter, 10000); // Cap at 10s
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= 3) {
        // Successfully made 3 requests in half-open, close the circuit
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.halfOpenAttempts = 0;
        aiLogger.info('Kimi circuit breaker CLOSED - service recovered');
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Failed in half-open, go back to open
      this.circuitState = CircuitState.OPEN;
      aiLogger.warn('Kimi circuit breaker OPEN - recovery failed');
    } else if (this.failureCount >= this.circuitBreakerThreshold) {
      // Too many failures, open the circuit
      this.circuitState = CircuitState.OPEN;
      aiLogger.error('Kimi circuit breaker OPEN - too many failures', {
        failureCount: this.failureCount,
        threshold: this.circuitBreakerThreshold,
      });
    }
  }

  /**
   * Reset circuit breaker (manual recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = undefined;
    aiLogger.info('Kimi circuit breaker manually reset');
  }

  /**
   * Get current client status
   */
  getStatus(): {
    available: boolean;
    circuitState: CircuitState;
    failureCount: number;
    model: string;
  } {
    return {
      available: this.isAvailable,
      circuitState: this.circuitState,
      failureCount: this.failureCount,
      model: this.model,
    };
  }
}

export default KimiClient;
