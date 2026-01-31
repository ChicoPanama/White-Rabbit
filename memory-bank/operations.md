# Operations Status

## System Health: 🟢 Operational

| Component | Status | Last Check | Notes |
|-----------|--------|------------|-------|
| **Clawdbot Gateway** | 🟢 Running | 2026-01-30 | systemd service active |
| **White-Rabbit Scanner** | 🟢 Running | 2026-01-30 | PM2 process (one-shot loop) |
| **White-Rabbit Worker** | 🟢 Running | 2026-01-30 | PM2 process (BullMQ) |
| **PostgreSQL** | 🟢 Active | 2026-01-30 | whiterabbit DB |
| **Redis** | 🟢 Active | 2026-01-30 | BullMQ queue backend |
| **Slither** | 🟢 Working | 2026-01-30 | v0.11.5 (pip) |
| **Foundry (forge)** | ❌ Not Installed | - | PoC verification disabled |
| **AI Pipeline** | 🟢 Active | 2026-01-30 | Haiku/Sonnet tiered |

## Infrastructure

### EC2 Scanner (AWS)
- **Instance:** t2.medium (2 vCPU, 3.8 GB RAM)
- **OS:** Ubuntu 24.04.3 LTS
- **Node.js:** v22.22.0
- **Disk:** 29 GB total, ~20% used
- **Location:** ~/White-Rabbit

### Process Management
```
PM2 Processes:
- white-rabbit-scanner (id: 2) - Scan loop
- white-rabbit-worker (id: 1) - Job queue

Systemd Services:
- clawdbot-gateway.service - Telegram bot + orchestration
```

## Database State
| Table | Rows | Purpose |
|-------|------|---------|
| contracts | 19+ | Scanned contract metadata |
| scans | 409+ | Scan history |
| findings | 2,848+ | Raw findings from analysis |

## API Keys Status
| Service | Status | Notes |
|---------|--------|-------|
| Anthropic | 🟢 Active | Claude Haiku + Sonnet |
| Etherscan | 🟢 Active | V2 API (all chains) |
| Telegram | 🟢 Active | @WhiteRabbitClawdBot |
| Brave Search | ⚠️ Not Set | BRAVE_API_KEY missing |
| RPC Endpoints | ⚠️ Limited | ETH_RPC_URL not configured |

## Recent Issues & Resolutions
| Date | Issue | Resolution | Status |
|------|-------|------------|--------|
| 2026-01-30 | Orphan Chrome processes | Killed manually, clean restart | Resolved |
| 2026-01-30 | PM2 clawd misconfigured | Deleted broken entry | Resolved |
| 2026-01-30 | Arbitrum chain lookup | "Arbitrum One" vs "arbitrum" | Open |

## Scan Statistics (Lifetime)
```
Protocols Discovered: 100+
Contracts Scanned: 25+
Raw Findings: 2,848+
Verified Vulnerabilities: 1 (SSV DoS)
False Positives Filtered: 3+
Bounty Submissions: 1
```

## Current Scan Queue
| Priority | Target | Chain | TVL | Status |
|----------|--------|-------|-----|--------|
| - | Awaiting next hunt cycle | - | - | - |

## Alerts & Notifications
- **Telegram Chat:** 1309504379
- **Alert Threshold:** Medium+ severity
- **Value Gate:** $25K+ for active alerts

## Maintenance Tasks
- [ ] Install Foundry for PoC verification
- [ ] Configure ETH_RPC_URL for fork testing
- [ ] Set up BRAVE_API_KEY for web search
- [ ] Fix Arbitrum chain name lookup
- [ ] Clean up old session-findings JSON files (100+)

## Service Commands
```bash
# Scanner
pm2 logs white-rabbit-scanner --lines 50
pm2 restart white-rabbit-scanner

# Clawdbot
systemctl --user status clawdbot-gateway
systemctl --user restart clawdbot-gateway

# Database
sudo -u postgres psql -d whiterabbit
```

---
*Last Updated: 2026-01-30T22:04:12+00:00*
