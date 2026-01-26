import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATE_DIR = path.join(os.homedir(), '.etherscan-auditor');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

export interface ChainRankingEntry {
  slug: string;
  name: string;
  tvl: number;
  scannable: boolean;
}

export interface ScannerState {
  autonomous: {
    enabled: boolean;
    startedAt: string | null;
    pid: number | null;
  };
  config: {
    networks: string[];
    minTvlUsd: number;
    intervalMinutes: number;
    alertThreshold: string;
  };
  stats: {
    totalScans: number;
    contractsScanned: number;
    verifiedVulns: number;
    likelyRealVulns: number;
    falsePositivesFiltered: number;
    alertsSent: number;
    lastScanAt: string | null;
    lastScanPerNetwork: Record<string, string>;
  };
  chainRankings: {
    chains: ChainRankingEntry[];
    updatedAt: string | null;
  };
  recentFindings: RecentFinding[];
}

export interface RecentFinding {
  id: string;
  timestamp: string;
  contractAddress: string;
  contractName: string;
  chain: string;
  detector: string;
  severity: string;
  confidenceScore: number;
  verificationStatus: string;
  description: string;
}

const DEFAULT_STATE: ScannerState = {
  autonomous: {
    enabled: false,
    startedAt: null,
    pid: null,
  },
  config: {
    networks: ['ethereum', 'base', 'arbitrum'],
    minTvlUsd: 500_000,
    intervalMinutes: 30,
    alertThreshold: 'medium',
  },
  stats: {
    totalScans: 0,
    contractsScanned: 0,
    verifiedVulns: 0,
    likelyRealVulns: 0,
    falsePositivesFiltered: 0,
    alertsSent: 0,
    lastScanAt: null,
    lastScanPerNetwork: {},
  },
  chainRankings: {
    chains: [],
    updatedAt: null,
  },
  recentFindings: [],
};

const MAX_RECENT_FINDINGS = 100;

export class StateManager {
  private state: ScannerState;

  constructor() {
    this.state = this.load();
  }

  private load(): ScannerState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw) as Partial<ScannerState>;
        return { ...DEFAULT_STATE, ...parsed };
      }
    } catch {
      // Corrupted state file; reset
    }
    return { ...DEFAULT_STATE };
  }

  private save(): void {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
  }

  get(): ScannerState {
    return this.state;
  }

  // ── Autonomous Mode ──

  setAutonomous(enabled: boolean): void {
    this.state.autonomous.enabled = enabled;
    this.state.autonomous.startedAt = enabled ? new Date().toISOString() : null;
    this.state.autonomous.pid = enabled ? process.pid : null;
    this.save();
  }

  isAutonomous(): boolean {
    return this.state.autonomous.enabled;
  }

  // ── Configuration ──

  updateConfig(updates: Partial<ScannerState['config']>): void {
    Object.assign(this.state.config, updates);
    this.save();
  }

  getConfig(): ScannerState['config'] {
    return this.state.config;
  }

  // ── Stats ──

  recordScan(network: string, contractsScanned: number, verified: number, likelyReal: number, fpFiltered: number, alerts: number): void {
    const now = new Date().toISOString();
    this.state.stats.totalScans++;
    this.state.stats.contractsScanned += contractsScanned;
    this.state.stats.verifiedVulns += verified;
    this.state.stats.likelyRealVulns += likelyReal;
    this.state.stats.falsePositivesFiltered += fpFiltered;
    this.state.stats.alertsSent += alerts;
    this.state.stats.lastScanAt = now;
    this.state.stats.lastScanPerNetwork[network] = now;
    this.save();
  }

  getStats(): ScannerState['stats'] {
    return this.state.stats;
  }

  // ── Chain Rankings ──

  updateChainRankings(chains: ChainRankingEntry[]): void {
    this.state.chainRankings = {
      chains,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  }

  getChainRankings(): { chains: ChainRankingEntry[]; updatedAt: string | null } {
    return this.state.chainRankings;
  }

  isChainRankingsStale(maxAgeMs = 60 * 60 * 1000): boolean {
    if (!this.state.chainRankings.updatedAt) return true;
    return Date.now() - new Date(this.state.chainRankings.updatedAt).getTime() > maxAgeMs;
  }

  // ── Recent Findings ──

  addFinding(finding: RecentFinding): void {
    this.state.recentFindings.unshift(finding);
    if (this.state.recentFindings.length > MAX_RECENT_FINDINGS) {
      this.state.recentFindings = this.state.recentFindings.slice(0, MAX_RECENT_FINDINGS);
    }
    this.save();
  }

  getRecentFindings(limit = 10): RecentFinding[] {
    return this.state.recentFindings.slice(0, limit);
  }

  getVerifiedFindings(limit = 10): RecentFinding[] {
    return this.state.recentFindings
      .filter(f => f.verificationStatus === 'verified' || f.verificationStatus === 'likely_real')
      .slice(0, limit);
  }

  // ── Formatting for Telegram/CLI ──

  formatStatus(): string {
    const s = this.state;
    const autoStatus = s.autonomous.enabled ? 'ACTIVE' : 'INACTIVE';
    const lastScan = s.stats.lastScanAt
      ? timeSince(new Date(s.stats.lastScanAt))
      : 'never';

    const lines = [
      `Scanner Status`,
      ``,
      `Autonomous mode: ${autoStatus}`,
      `Last scan: ${lastScan}`,
      `Networks: ${s.config.networks.join(', ')}`,
      `Min TVL: $${(s.config.minTvlUsd / 1000).toFixed(0)}K`,
      ``,
      `Stats:`,
      `  Scans run: ${s.stats.totalScans}`,
      `  Contracts scanned: ${s.stats.contractsScanned}`,
      `  Verified vulns: ${s.stats.verifiedVulns}`,
      `  Likely real: ${s.stats.likelyRealVulns}`,
      `  FPs filtered: ${s.stats.falsePositivesFiltered}`,
      `  Alerts sent: ${s.stats.alertsSent}`,
    ];

    // Per-chain last scan
    const perNetwork = Object.entries(s.stats.lastScanPerNetwork);
    if (perNetwork.length > 0) {
      lines.push('', 'Per-chain last scan:');
      for (const [network, ts] of perNetwork) {
        lines.push(`  ${network}: ${timeSince(new Date(ts))}`);
      }
    }

    if (s.autonomous.enabled) {
      lines.push(``, `Next scan in ~${s.config.intervalMinutes} min`);
    }

    return lines.join('\n');
  }

  formatStatusTelegram(): string {
    const s = this.state;
    const autoIcon = s.autonomous.enabled ? '\u{1F7E2}' : '\u{1F534}';
    const lastScan = s.stats.lastScanAt
      ? timeSince(new Date(s.stats.lastScanAt))
      : 'never';

    const modeLabel = s.config.networks.length > 5 ? `top ${s.config.networks.length} chains` : s.config.networks.join(', ');

    const lines = [
      `\u{1F99E} <b>Hunt Status</b>`,
      ``,
      `${autoIcon} Mode: <b>${s.autonomous.enabled ? 'ACTIVE' : 'INACTIVE'}</b> (${modeLabel})`,
      `\u{23F1} Last scan: ${lastScan}`,
      `\u{1F4B0} Min TVL: $${(s.config.minTvlUsd / 1000).toFixed(0)}K`,
    ];

    // Per-chain scan status
    const perNetwork = Object.entries(s.stats.lastScanPerNetwork);
    if (perNetwork.length > 0) {
      lines.push('', `\u{1F4CA} <b>Chains Scanned:</b>`);
      for (const [network, ts] of perNetwork) {
        lines.push(`  \u2705 ${network} - ${timeSince(new Date(ts))}`);
      }
    }

    lines.push('');
    lines.push(`Findings: ${s.stats.verifiedVulns} verified, ${s.stats.likelyRealVulns} likely real, ${s.stats.falsePositivesFiltered} FPs filtered`);

    if (s.autonomous.enabled) {
      lines.push(``, `Next scan in ~${s.config.intervalMinutes} min.`);
    }

    return lines.join('\n');
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
