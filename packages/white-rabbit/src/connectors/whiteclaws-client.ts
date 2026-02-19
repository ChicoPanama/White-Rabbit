// ═══════════════════════════════════════════════════════════════════════════════
// WhiteClawsClient - API client for whiteclaws.app
// ═══════════════════════════════════════════════════════════════════════════════

import {
  WhiteClawsCredentials,
  ScanRequest,
  ScanResponse,
  ScanResult,
  ProtocolInfo,
  ScannerError,
} from '../types.js';

export interface ClientConfig extends WhiteClawsCredentials {
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Client for the WhiteClaws API
 * Provides access to queued scans and protocol data
 */
export class WhiteClawsClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://whiteclaws.app/api/v1';
    this.timeoutMs = config.timeoutMs || 30000;
  }

  /**
   * Queue a new scan
   */
  async queueScan(request: ScanRequest): Promise<ScanResponse> {
    const response = await this.fetch('/scans', {
      method: 'POST',
      body: JSON.stringify({
        address: request.address,
        chain: request.chain,
        options: request.options,
        callback_url: request.callbackUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(
        `Failed to queue scan: ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    return response.json() as Promise<ScanResponse>;
  }

  /**
   * Get scan results by ID
   */
  async getScanResults(scanId: string): Promise<ScanResult | null> {
    const response = await this.fetch(`/scans/${scanId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(
        `Failed to get scan results: ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    return response.json() as Promise<ScanResult>;
  }

  /**
   * List all scans for the authenticated user
   */
  async listScans(limit = 10, offset = 0): Promise<ScanResult[]> {
    const response = await this.fetch(`/scans?limit=${limit}&offset=${offset}`);

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(
        `Failed to list scans: ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    return response.json() as Promise<ScanResult[]>;
  }

  /**
   * Get supported protocols
   */
  async getProtocols(): Promise<ProtocolInfo[]> {
    const response = await this.fetch('/protocols');

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(
        `Failed to get protocols: ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    return response.json() as Promise<ProtocolInfo[]>;
  }

  /**
   * Get protocol by slug
   */
  async getProtocol(slug: string): Promise<ProtocolInfo | null> {
    const response = await this.fetch(`/protocols/${slug}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(
        `Failed to get protocol: ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    return response.json() as Promise<ProtocolInfo>;
  }

  /**
   * Verify API key is valid
   */
  async verifyKey(): Promise<boolean> {
    try {
      const response = await this.fetch('/auth/verify', {
        method: 'POST',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get API usage stats
   */
  async getUsageStats(): Promise<{
    scansThisMonth: number;
    scansLimit: number;
    remainingScans: number;
    plan: string;
  }> {
    const response = await this.fetch('/usage');

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(
        `Failed to get usage stats: ${error}`,
        'API_ERROR',
        { status: response.status }
      );
    }

    return response.json() as Promise<{ scansThisMonth: number; scansLimit: number; remainingScans: number; plan: string; }>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async fetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}
