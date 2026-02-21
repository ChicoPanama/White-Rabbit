// ═══════════════════════════════════════════════════════════════════════════════
// WhiteClawsClient - API client for whiteclaws.app
// ═══════════════════════════════════════════════════════════════════════════════

import {
  WhiteClawsCredentials,
  ScanRequest,
  ScanResponse,
  ScanResult,
  ProtocolInfo,
  ProtocolIntel,
  SubmitFindingRequest,
  SubmitFindingResponse,
  ScannerError,
} from '../types.js';

export interface ClientConfig extends WhiteClawsCredentials {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Client for WhiteClaws APIs.
 * Uses the newer platform endpoints (`/api/*`) and keeps legacy helpers for compatibility.
 */
export class WhiteClawsClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private retries: number;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || process.env.WHITECLAWS_API_URL || 'https://whiteclaws.app').replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs || 30_000;
    this.retries = config.retries ?? 2;
  }

  /**
   * Queue a new scan (legacy endpoint compatibility).
   */
  async queueScan(request: ScanRequest): Promise<ScanResponse> {
    const response = await this.fetch('/api/scans', {
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
      throw new ScannerError(`Failed to queue scan: ${error}`, 'API_ERROR', { status: response.status });
    }

    return response.json() as Promise<ScanResponse>;
  }

  /**
   * Get scan results by ID (legacy endpoint compatibility).
   */
  async getScanResults(scanId: string): Promise<ScanResult | null> {
    const response = await this.fetch(`/api/scans/${scanId}`);

    if (response.status === 404) return null;

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(`Failed to get scan results: ${error}`, 'API_ERROR', { status: response.status });
    }

    return response.json() as Promise<ScanResult>;
  }

  /**
   * List scans (legacy endpoint compatibility).
   */
  async listScans(limit = 10, offset = 0): Promise<ScanResult[]> {
    const response = await this.fetch(`/api/scans?limit=${limit}&offset=${offset}`);

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(`Failed to list scans: ${error}`, 'API_ERROR', { status: response.status });
    }

    return response.json() as Promise<ScanResult[]>;
  }

  /**
   * Get public intel response for a protocol.
   */
  async getProtocolIntel(slug: string): Promise<ProtocolIntel | null> {
    try {
      const response = await this.fetch(`/api/intel/protocol/${encodeURIComponent(slug)}/`);

      if (response.status === 404) return null;
      if (response.status === 503) return null;

      if (!response.ok) {
        throw new ScannerError(`Intel API error: ${response.status}`, 'API_ERROR', { status: response.status });
      }

      return response.json() as Promise<ProtocolIntel>;
    } catch (error) {
      // Graceful degradation: scanners should continue even if intel is down.
      return null;
    }
  }

  /**
   * Get protocol by slug (maps intel payload to legacy ProtocolInfo shape).
   */
  async getProtocol(slug: string): Promise<ProtocolInfo | null> {
    const intel = await this.getProtocolIntel(slug);
    if (!intel) return null;

    return {
      id: intel.programId || intel.slug,
      name: intel.name,
      slug: intel.slug,
      chains: intel.chains,
      tvl: intel.tvl,
      category: intel.category,
      url: intel.website || `https://whiteclaws.app/protocols/${intel.slug}`,
    };
  }

  /**
   * Submit a verified finding to WhiteClaws.
   */
  async submitFinding(payload: SubmitFindingRequest): Promise<SubmitFindingResponse> {
    const response = await this.fetch('/api/agents/submit/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ScannerError(`Failed to submit finding: ${errorText}`, 'API_ERROR', { status: response.status });
    }

    return response.json() as Promise<SubmitFindingResponse>;
  }

  /**
   * Verify API key is valid.
   */
  async verifyKey(): Promise<boolean> {
    try {
      const response = await this.fetch('/api/agents/status/');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get usage stats if the endpoint is available.
   */
  async getUsageStats(): Promise<{
    scansThisMonth: number;
    scansLimit: number;
    remainingScans: number;
    plan: string;
  }> {
    const response = await this.fetch('/api/agents/me/');

    if (!response.ok) {
      const error = await response.text();
      throw new ScannerError(`Failed to get usage stats: ${error}`, 'API_ERROR', { status: response.status });
    }

    const data = await response.json() as any;
    return {
      scansThisMonth: Number(data?.usage?.scans_this_month || 0),
      scansLimit: Number(data?.usage?.scan_limit || 0),
      remainingScans: Number(data?.usage?.remaining_scans || 0),
      plan: String(data?.plan || 'unknown'),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    return this.withRetries(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-API-Key': this.apiKey,
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
    });
  }

  private async withRetries<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.retries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === this.retries) break;
        await this.sleep(250 * (attempt + 1));
      }
      attempt += 1;
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
