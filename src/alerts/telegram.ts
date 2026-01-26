import * as crypto from 'crypto';
import type { Finding, Severity, TelegramSendResult } from '../types/index.js';
import { SEVERITY_ORDER } from '../types/index.js';

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '\u{1F534}',  // red circle
  high: '\u{1F7E0}',      // orange circle
  medium: '\u{1F7E1}',    // yellow circle
  low: '\u{1F7E2}',       // green circle
  informational: '\u{26AA}', // white circle
};

export class TelegramAlertService {
  private readonly baseUrl: string;
  private readonly chatId: string;
  private lastSendTime = 0;
  private readonly minIntervalMs = 1100; // > 1 msg/sec limit
  private sentHashes = new Set<string>();

  constructor(botToken: string, chatId: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    this.chatId = chatId;
  }

  /**
   * Send alert for a single vulnerability finding.
   * Returns true if sent, false if deduplicated/skipped.
   */
  async sendFindingAlert(finding: Finding, contractAddress: string, chainName: string): Promise<boolean> {
    const messageHash = this.computeHash(finding);
    if (this.sentHashes.has(messageHash)) {
      return false;
    }

    const emoji = SEVERITY_EMOJI[finding.severity] ?? '';
    const message = [
      `${emoji} <b>Vulnerability Detected</b>`,
      '',
      `<b>Chain:</b> ${this.escapeHtml(chainName)}`,
      `<b>Contract:</b> <code>${this.escapeHtml(contractAddress)}</code>`,
      `<b>Severity:</b> ${finding.severity.toUpperCase()}`,
      `<b>Confidence:</b> ${finding.confidence}`,
      `<b>Detector:</b> ${this.escapeHtml(finding.detectorName)}`,
      '',
      `<b>Description:</b>`,
      this.escapeHtml(this.truncate(finding.description, 500)),
    ];

    if (finding.codeSnippet) {
      message.push('', `<pre>${this.escapeHtml(this.truncate(finding.codeSnippet, 1000))}</pre>`);
    }

    if (finding.aiAssessment) {
      message.push('', `<b>AI Assessment:</b>`, this.escapeHtml(this.truncate(finding.aiAssessment, 300)));
    }

    if (finding.filePath) {
      message.push('', `<b>Location:</b> ${this.escapeHtml(finding.filePath)}:${finding.lineStart ?? '?'}`);
    }

    const result = await this.sendMessage(message.join('\n'), {
      parse_mode: 'HTML',
      disable_notification: finding.severity === 'low' || finding.severity === 'informational',
    });

    if (result) {
      this.sentHashes.add(messageHash);
    }
    return result;
  }

  /**
   * Send a batch summary for multiple findings on the same contract.
   */
  async sendBatchSummary(
    findings: Finding[],
    contractAddress: string,
    chainName: string,
    protocolName: string | null,
  ): Promise<boolean> {
    const bySeverity: Record<string, number> = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }

    const severityLine = Object.entries(bySeverity)
      .sort(([a], [b]) => SEVERITY_ORDER[b as Severity] - SEVERITY_ORDER[a as Severity])
      .map(([sev, count]) => `${SEVERITY_EMOJI[sev as Severity] ?? ''} ${sev}: ${count}`)
      .join('  |  ');

    const topFindings = findings
      .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
      .slice(0, 5)
      .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${this.escapeHtml(f.detectorName)} - ${this.escapeHtml(this.truncate(f.description, 100))}`)
      .join('\n');

    const message = [
      `\u{1F50D} <b>Scan Complete: ${this.escapeHtml(protocolName ?? contractAddress)}</b>`,
      '',
      `<b>Chain:</b> ${this.escapeHtml(chainName)}`,
      `<b>Contract:</b> <code>${this.escapeHtml(contractAddress)}</code>`,
      `<b>Total Findings:</b> ${findings.length}`,
      '',
      severityLine,
      '',
      `<b>Top Findings:</b>`,
      topFindings,
    ];

    return this.sendMessage(message.join('\n'), { parse_mode: 'HTML' });
  }

  /**
   * Filter findings by minimum severity threshold.
   */
  filterBySeverity(findings: Finding[], minSeverity: Severity): Finding[] {
    const minOrder = SEVERITY_ORDER[minSeverity];
    return findings.filter(f => SEVERITY_ORDER[f.severity] >= minOrder);
  }

  private async sendMessage(
    text: string,
    options: { parse_mode?: string; disable_notification?: boolean } = {},
  ): Promise<boolean> {
    await this.rateLimit();

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          ...options,
        }),
      });

      const result = await response.json() as TelegramSendResult;
      if (!result.ok) {
        console.error('Telegram API error:', result.description);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Telegram send failed:', err);
      return false;
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastSendTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastSendTime = Date.now();
  }

  private computeHash(finding: Finding): string {
    const key = `${finding.detectorName}:${finding.filePath}:${finding.lineStart}:${finding.severity}`;
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
  }

  /**
   * Clear the 24-hour dedup window.
   * Call periodically to prevent unbounded memory growth.
   */
  clearDedupCache(): void {
    this.sentHashes.clear();
  }
}
