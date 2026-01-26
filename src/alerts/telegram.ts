import * as crypto from 'crypto';
import type { Finding, Severity, TelegramSendResult, VerifiedFinding, VerificationStatus, ExploitEstimate } from '../types/index.js';
import { SEVERITY_ORDER, EXPLOIT_VALUE_THRESHOLDS } from '../types/index.js';
import { formatExploitValue, exploitValueIcon, estimateBounty } from '../services/exploitEstimator.js';

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '\u{1F534}',  // red circle
  high: '\u{1F7E0}',      // orange circle
  medium: '\u{1F7E1}',    // yellow circle
  low: '\u{1F7E2}',       // green circle
  informational: '\u{26AA}', // white circle
};

const VERIFICATION_BADGE: Record<VerificationStatus, string> = {
  verified: '\u{2705} VERIFIED',
  likely_real: '\u{26A0}\u{FE0F} LIKELY REAL',
  needs_review: '\u{1F50D} NEEDS REVIEW',
  likely_false: '\u{274C} LIKELY FALSE',
  false_positive: '\u{1F6AB} FALSE POSITIVE',
};

const CONFIDENCE_BAR_LENGTH = 10;

function confidenceBar(score: number): string {
  const filled = Math.round((score / 100) * CONFIDENCE_BAR_LENGTH);
  const empty = CONFIDENCE_BAR_LENGTH - filled;
  return '\u{2588}'.repeat(filled) + '\u{2591}'.repeat(empty) + ` ${score}%`;
}

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
   * Send alert for a single vulnerability finding (legacy format).
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
   * Send verified finding alert with verification status badge, confidence bar,
   * and mobile-friendly concise format. This is the primary alert method.
   */
  async sendVerifiedFindingAlert(
    finding: VerifiedFinding,
    contractAddress: string,
    chainName: string,
    protocolName?: string,
    chainTvl?: number,
  ): Promise<boolean> {
    const messageHash = this.computeVerifiedHash(finding);
    if (this.sentHashes.has(messageHash)) {
      return false;
    }

    const sevEmoji = SEVERITY_EMOJI[finding.severity] ?? '';
    const badge = VERIFICATION_BADGE[finding.verificationStatus];
    const bar = confidenceBar(finding.confidenceScore);
    const contractLabel = protocolName
      ? `${this.escapeHtml(protocolName)} (<code>${this.escapeHtml(contractAddress.slice(0, 10))}...</code>)`
      : `<code>${this.escapeHtml(contractAddress)}</code>`;

    // Chain label with TVL context
    const chainLabel = chainTvl
      ? `${this.escapeHtml(chainName)} (${formatTvlDisplay(chainTvl)})`
      : this.escapeHtml(chainName);

    const lines = [
      `${sevEmoji} <b>${finding.severity.toUpperCase()}: ${this.escapeHtml(finding.detectorName)}</b>`,
      `${badge}`,
      '',
      `\u{1F517} ${chainLabel} | ${contractLabel}`,
      `\u{1F4CA} Confidence: ${bar}`,
    ];

    // Tools agreeing (consensus indicator)
    if (finding.toolsAgreeing.length > 1) {
      lines.push(`\u{1F91D} Tools: ${finding.toolsAgreeing.map(t => this.escapeHtml(t)).join(', ')}`);
    }

    // PoC result badge
    if (finding.pocResult?.attempted) {
      const pocIcon = finding.pocResult.succeeded ? '\u{1F4A5}' : '\u{1F6E1}\u{FE0F}';
      const pocText = finding.pocResult.succeeded ? 'PoC exploit SUCCEEDED' : 'PoC exploit failed';
      lines.push(`${pocIcon} ${pocText}`);
    }

    lines.push('');
    lines.push(this.escapeHtml(this.truncate(finding.description, 300)));

    // AI assessment (compact)
    if (finding.aiAssessment) {
      lines.push('', `\u{1F916} ${this.escapeHtml(this.truncate(finding.aiAssessment, 200))}`);
    }

    // Context hints
    if (finding.contextInfo) {
      const ctx = finding.contextInfo;
      const hints: string[] = [];
      if (ctx.isAudited) hints.push(`Audited by ${ctx.auditedBy.join(', ')}`);
      if (ctx.knownProtocol) hints.push(`Protocol: ${ctx.knownProtocol}`);
      if (hints.length > 0) {
        lines.push('', `\u{1F4DD} ${this.escapeHtml(hints.join(' | '))}`);
      }
    }

    // Quick action hints
    lines.push('', '\u{2699}\u{FE0F} <i>Reply "status" for scanner status</i>');

    const result = await this.sendMessage(lines.join('\n'), {
      parse_mode: 'HTML',
      disable_notification: false, // Always notify for verified/likely_real
    });

    if (result) {
      this.sentHashes.add(messageHash);
    }
    return result;
  }

  /**
   * Send exploit value alert — the primary alert method.
   * Shows exploitable value, PoC results, bounty estimate, and breakdown.
   */
  async sendExploitValueAlert(
    finding: VerifiedFinding,
    contractAddress: string,
    chainName: string,
    protocolName?: string,
  ): Promise<boolean> {
    const messageHash = this.computeVerifiedHash(finding);
    if (this.sentHashes.has(messageHash)) {
      return false;
    }

    const est = finding.exploitEstimate;
    const badge = VERIFICATION_BADGE[finding.verificationStatus];
    const bar = confidenceBar(finding.confidenceScore);
    const contractLabel = protocolName
      ? `${this.escapeHtml(protocolName)} (<code>${this.escapeHtml(contractAddress.slice(0, 10))}...</code>)`
      : `<code>${this.escapeHtml(contractAddress)}</code>`;

    const lines: string[] = [];

    // Header with value-based severity
    if (est && est.estimatedExploitable > 0) {
      const valueIcon = exploitValueIcon(est.estimatedExploitable);
      const valueStr = formatExploitValue(
        est.estimatedExploitable,
        finding.pocResult?.extractedValue?.extractedValueUsd,
      );
      lines.push(
        `${valueIcon} <b>${finding.severity.toUpperCase()}: ${this.escapeHtml(finding.detectorName)}</b>`,
        `${badge}`,
        '',
        `\u{1F517} ${this.escapeHtml(chainName)} | ${contractLabel}`,
        '',
        `\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}`,
        `\u{1F4B0} <b>VALUE AT RISK</b>`,
        `\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}`,
      );

      // Value breakdown
      if (est.protocolTvl > 0) {
        lines.push(`Protocol TVL:     ${formatTvlDisplay(est.protocolTvl)}`);
      }
      lines.push(`Contract Balance: ${formatTvlDisplay(est.contractBalance)}`);
      lines.push(
        `<b>Exploitable:      ${formatTvlDisplay(est.estimatedExploitable)} (${est.exploitablePercentage.toFixed(0)}%)</b>`,
        `                  ${est.confidence.toUpperCase()} CONFIDENCE`,
      );
      lines.push(`\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}\u{2501}`);
    } else {
      // No value estimate available — fall back to standard format
      const sevEmoji = SEVERITY_EMOJI[finding.severity] ?? '';
      lines.push(
        `${sevEmoji} <b>${finding.severity.toUpperCase()}: ${this.escapeHtml(finding.detectorName)}</b>`,
        `${badge}`,
        '',
        `\u{1F517} ${this.escapeHtml(chainName)} | ${contractLabel}`,
      );
    }

    // Confidence
    lines.push('', `\u{1F4CA} Confidence: ${bar}`);

    // PoC result with extraction value
    if (finding.pocResult?.attempted) {
      const pocIcon = finding.pocResult.succeeded ? '\u{1F4A5}' : '\u{1F6E1}\u{FE0F}';
      const pocText = finding.pocResult.succeeded ? 'PoC exploit SUCCEEDED' : 'PoC exploit failed';
      lines.push(`${pocIcon} ${pocText}`);

      if (finding.pocResult.extractedValue?.extractedValueUsd) {
        const ext = finding.pocResult.extractedValue;
        lines.push(`\u{1F4B8} PoC extracted: ${formatTvlDisplay(ext.extractedValueUsd)} (net profit: ${formatTvlDisplay(ext.netProfit)})`);
      }
    }

    // Description
    lines.push('', this.escapeHtml(this.truncate(finding.description, 250)));

    // Value breakdown details
    if (est && est.estimatedExploitable > 0) {
      const breakdownLines: string[] = [];
      if (est.breakdown.ethBalance > 0) {
        breakdownLines.push(`ETH at risk: ${formatTvlDisplay(est.breakdown.ethBalance)}`);
      }
      for (const token of est.breakdown.tokenBalances.slice(0, 3)) {
        breakdownLines.push(`${this.escapeHtml(token.symbol)} at risk: ${formatTvlDisplay(token.valueUsd)}`);
      }
      if (est.breakdown.lockedFunds > 0) {
        breakdownLines.push(`Locked/safe: ${formatTvlDisplay(est.breakdown.lockedFunds)}`);
      }
      if (breakdownLines.length > 0) {
        lines.push('', '<b>Breakdown:</b>');
        for (const bl of breakdownLines) {
          lines.push(`  \u{2022} ${bl}`);
        }
      }

      // Capital requirements
      if (est.requiredCapital > 0) {
        lines.push(``, `Required capital: ${formatTvlDisplay(est.requiredCapital)} (flash loan)`);
      } else {
        lines.push(``, `Required capital: $0 (direct drain)`);
      }

      // Bounty estimate
      const bounty = estimateBounty(est.estimatedExploitable);
      if (bounty.amount > 0) {
        lines.push(`\u{1F3AF} Bounty potential: ${bounty.formatted} (10% of exploitable)`);
      }
    }

    // Methodology
    if (est?.methodology) {
      lines.push('', `\u{1F9EA} <i>${this.escapeHtml(this.truncate(est.methodology, 150))}</i>`);
    }

    const result = await this.sendMessage(lines.join('\n'), {
      parse_mode: 'HTML',
      disable_notification: false,
    });

    if (result) {
      this.sentHashes.add(messageHash);
    }
    return result;
  }

  /**
   * Send findings summary with total exploitable value breakdown.
   */
  async sendValueSummary(
    findings: VerifiedFinding[],
    chainBreakdown: Array<{ chain: string; exploitable: number; count: number }>,
  ): Promise<boolean> {
    const totalExploitable = findings.reduce(
      (sum, f) => sum + (f.exploitEstimate?.estimatedExploitable ?? 0), 0,
    );

    const verified = findings.filter(f => f.verificationStatus === 'verified');
    const likelyReal = findings.filter(f => f.verificationStatus === 'likely_real');

    const lines = [
      `\u{1F99E} <b>Findings Summary</b>`,
      '',
      `\u{1F4B0} <b>Total Exploitable Value: ${formatTvlDisplay(totalExploitable)}</b>`,
      '',
    ];

    // Verified findings
    if (verified.length > 0) {
      lines.push(`\u{1F534} <b>VERIFIED (PoC succeeded):</b>`);
      for (const f of verified.slice(0, 5)) {
        const est = f.exploitEstimate;
        const value = est ? formatTvlDisplay(est.estimatedExploitable) : 'unknown';
        lines.push(`  ${this.escapeHtml(f.detectorName)} - ${value}`);
      }
      lines.push('');
    }

    // Likely real findings
    if (likelyReal.length > 0) {
      lines.push(`\u{26A0}\u{FE0F} <b>LIKELY REAL:</b>`);
      for (const f of likelyReal.slice(0, 5)) {
        const est = f.exploitEstimate;
        const value = est ? formatTvlDisplay(est.estimatedExploitable) : 'unknown';
        lines.push(`  ${this.escapeHtml(f.detectorName)} - ${value}`);
      }
      lines.push('');
    }

    // By chain breakdown
    if (chainBreakdown.length > 0) {
      lines.push(`\u{1F4CA} <b>By Chain:</b>`);
      for (const cb of chainBreakdown.sort((a, b) => b.exploitable - a.exploitable)) {
        lines.push(`  ${this.escapeHtml(cb.chain)}: ${formatTvlDisplay(cb.exploitable)} (${cb.count} findings)`);
      }
    }

    lines.push('', '<i>Reply "details on [finding]" for full report</i>');

    return this.sendMessage(lines.join('\n'), { parse_mode: 'HTML' });
  }

  /**
   * Send a verified batch summary with verification breakdown.
   */
  async sendVerifiedBatchSummary(
    findings: VerifiedFinding[],
    contractAddress: string,
    chainName: string,
    protocolName: string | null,
  ): Promise<boolean> {
    const verified = findings.filter(f => f.verificationStatus === 'verified').length;
    const likelyReal = findings.filter(f => f.verificationStatus === 'likely_real').length;
    const needsReview = findings.filter(f => f.verificationStatus === 'needs_review').length;
    const filtered = findings.filter(f =>
      f.verificationStatus === 'likely_false' || f.verificationStatus === 'false_positive',
    ).length;

    const bySeverity: Record<string, number> = {};
    const actionable = findings.filter(f =>
      f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real',
    );
    for (const f of actionable) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }

    const severityLine = Object.entries(bySeverity)
      .sort(([a], [b]) => SEVERITY_ORDER[b as Severity] - SEVERITY_ORDER[a as Severity])
      .map(([sev, count]) => `${SEVERITY_EMOJI[sev as Severity] ?? ''} ${sev}: ${count}`)
      .join('  ');

    const topActionable = actionable
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5)
      .map((f, i) => {
        const badge = f.verificationStatus === 'verified' ? '\u{2705}' : '\u{26A0}\u{FE0F}';
        return `${i + 1}. ${badge} [${f.severity.toUpperCase()}] ${this.escapeHtml(f.detectorName)} (${f.confidenceScore}%)`;
      })
      .join('\n');

    const label = protocolName ? this.escapeHtml(protocolName) : `<code>${this.escapeHtml(contractAddress)}</code>`;

    const lines = [
      `\u{1F9EA} <b>Scan Complete: ${label}</b>`,
      '',
      `\u{1F517} ${this.escapeHtml(chainName)} | <code>${this.escapeHtml(contractAddress)}</code>`,
      '',
      `<b>Verification Results:</b>`,
      `  \u{2705} Verified: ${verified}`,
      `  \u{26A0}\u{FE0F} Likely Real: ${likelyReal}`,
      `  \u{1F50D} Needs Review: ${needsReview}`,
      `  \u{1F6AB} Filtered (FP): ${filtered}`,
    ];

    if (severityLine) {
      lines.push('', severityLine);
    }

    if (topActionable) {
      lines.push('', `<b>Actionable Findings:</b>`, topActionable);
    }

    if (actionable.length === 0) {
      lines.push('', '\u{2705} No actionable findings. All clear.');
    }

    return this.sendMessage(lines.join('\n'), { parse_mode: 'HTML' });
  }

  /**
   * Send a batch summary for multiple findings on the same contract (legacy).
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
   * Send daily summary digest. Compact format for mobile.
   */
  async sendDailySummary(stats: {
    totalScans: number;
    contractsScanned: number;
    verified: number;
    likelyReal: number;
    fpFiltered: number;
    networks: string[];
    totalExploitableValue?: number;
    valueByChain?: Array<{ chain: string; value: number }>;
  }): Promise<boolean> {
    const total = stats.verified + stats.likelyReal;
    const icon = total > 0 ? '\u{1F6A8}' : '\u{2705}';
    const totalValue = stats.totalExploitableValue ?? 0;

    const lines = [
      `\u{1F4CB} <b>Daily Summary</b>`,
      '',
      `${icon} <b>${total} actionable findings</b> across ${stats.contractsScanned} contracts`,
    ];

    if (totalValue > 0) {
      lines.push(`\u{1F4B0} <b>Total exploitable value: ${formatTvlDisplay(totalValue)}</b>`);
    }

    lines.push(
      '',
      `  \u{2705} Verified: ${stats.verified}`,
      `  \u{26A0}\u{FE0F} Likely Real: ${stats.likelyReal}`,
      `  \u{1F6AB} FPs Filtered: ${stats.fpFiltered}`,
      '',
      `\u{1F517} Networks: ${stats.networks.join(', ')}`,
      `\u{1F50E} Scans: ${stats.totalScans}`,
    );

    // Value by chain
    if (stats.valueByChain && stats.valueByChain.length > 0) {
      lines.push('', `\u{1F4CA} <b>Value by Chain:</b>`);
      for (const vc of stats.valueByChain.sort((a, b) => b.value - a.value)) {
        lines.push(`  ${this.escapeHtml(vc.chain)}: ${formatTvlDisplay(vc.value)}`);
      }
    }

    if (total === 0) {
      lines.push('', '\u{1F389} Clean sweep. No vulnerabilities found today.');
    }

    return this.sendMessage(lines.join('\n'), { parse_mode: 'HTML' });
  }

  /**
   * Send top chains scan start notification.
   */
  async sendTopChainsScanStart(chains: Array<{ name: string; tvl: number }>, minTvl: number): Promise<boolean> {
    const chainList = chains
      .map(c => `${this.escapeHtml(c.name)} (${formatTvlDisplay(c.tvl)})`)
      .join(' \u{2192} ');

    const lines = [
      `\u{1F99E} <b>Scanning Top ${chains.length} EVM Chains by TVL</b>`,
      '',
      `\u{1F3AF} ${chainList}`,
      '',
      `\u{1F4B0} Min TVL: $${formatTvlDisplay(minTvl)}`,
      `\u{1F50E} Mode: Full sweep`,
      '',
      `Starting now... I'll alert you on verified findings only.`,
    ];

    return this.sendMessage(lines.join('\n'), { parse_mode: 'HTML' });
  }

  /**
   * Send chain rankings message.
   */
  async sendChainRankings(rankings: string): Promise<boolean> {
    return this.sendMessage(rankings, { parse_mode: 'HTML' });
  }

  /**
   * Send per-chain scan status breakdown.
   */
  async sendChainStatusBreakdown(chainStats: Array<{
    name: string;
    contracts: number;
    verified: number;
    likelyReal: number;
    status: 'done' | 'scanning' | 'queued';
  }>): Promise<boolean> {
    const lines = [
      `\u{1F4CA} <b>Per-Chain Scan Status</b>`,
      '',
    ];

    for (const cs of chainStats) {
      let icon: string;
      if (cs.status === 'done') icon = '\u2705';
      else if (cs.status === 'scanning') icon = '\u{1F504}';
      else icon = '\u23F3';

      let detail = `${cs.contracts} contracts`;
      if (cs.verified > 0) detail += `, ${cs.verified} VERIFIED \u{1F534}`;
      else if (cs.likelyReal > 0) detail += `, ${cs.likelyReal} likely real`;
      else detail += ', 0 verified';

      const statusText = cs.status === 'scanning' ? 'scanning now...' :
                         cs.status === 'queued' ? 'queued' : detail;
      lines.push(`${icon} ${this.escapeHtml(cs.name)} - ${statusText}`);
    }

    return this.sendMessage(lines.join('\n'), { parse_mode: 'HTML' });
  }

  /**
   * Send autonomous mode status update.
   */
  async sendStatusUpdate(status: string): Promise<boolean> {
    return this.sendMessage(status, { parse_mode: 'HTML' });
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

  private computeVerifiedHash(finding: VerifiedFinding): string {
    const key = `${finding.detectorName}:${finding.filePath}:${finding.lineStart}:${finding.severity}:${finding.verificationStatus}`;
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

function formatTvlDisplay(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}
