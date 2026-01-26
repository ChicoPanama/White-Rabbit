# White-Rabbit: Autonomous Smart Contract Vulnerability Scanner

## Project Overview

White-Rabbit is a production-ready autonomous smart contract vulnerability scanner that monitors high-value DeFi protocols across multiple EVM chains. It combines static analysis (Slither), blockchain APIs (Etherscan V2, DeFiLlama), AI-augmented analysis (Claude), **multi-layer verification to minimize false positives**, and Telegram alerting into a unified 6-stage scanning pipeline.

## Architecture

```
Heartbeat/Cron Trigger
    │
    ▼
Protocol Discovery (DeFiLlama) ──► TVL-based prioritization
    │
    ▼
Contract Fetching (Etherscan V2) ──► Multi-chain, rate-limited
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│                    6-STAGE VERIFICATION PIPELINE                 │
├──────────────────────────────────────────────────────────────────┤
│  Stage 1: CONTEXT         → Audit history, security patterns    │
│  Stage 2: STATIC ANALYSIS → Slither + AI business logic         │
│  Stage 3: FP FILTERING    → Known FP patterns, AI FP removal   │
│  Stage 4: VERIFICATION    → PoC exploit on forked mainnet      │
│  Stage 5: RISK SCORING    → Confidence 0-100, tool consensus   │
│  Stage 6: SMART ALERTING  → Only verified/likely-real findings  │
└──────────────────────────────────────────────────────────────────┘
    │
    ▼
PostgreSQL Storage ──► Full audit trail
```

## Verification Statuses

| Status | Meaning | Will Alert? |
|--------|---------|-------------|
| **Verified** | PoC exploit succeeded on fork | YES |
| **Likely Real** | 2+ tools agree, high confidence | YES |
| **Needs Review** | Single tool, medium confidence | No (logged) |
| **Likely False** | PoC failed or low confidence | No |
| **False Positive** | Matches known FP pattern | No |

## Tech Stack

- **Language:** TypeScript (Node.js 20+)
- **Static Analysis:** Slither via Docker (`trailofbits/eth-security-toolbox`)
- **PoC Verification:** Foundry (forge) on forked mainnet
- **Queue:** BullMQ + Redis
- **Database:** PostgreSQL 15
- **Blockchain API:** Etherscan V2 (unified multi-chain, single API key)
- **DeFi Data:** DeFiLlama (free, unauthenticated)
- **Alerts:** Telegram Bot API
- **AI Analysis:** Anthropic Claude API
- **Bot Framework:** Clawd bot (skills via SKILL.md)
- **Containerization:** Docker Compose

## Directory Structure

```
White-Rabbit/
├── CLAUDE.md                  # This file - project guide
├── README.md                  # Public documentation
├── package.json               # Node dependencies
├── tsconfig.json              # TypeScript configuration
├── docker-compose.yml         # Service orchestration
├── Dockerfile                 # Scanner container
├── .env.example               # Environment variable template
├── .gitignore
├── scripts/
│   ├── scan.sh                # Scan a network or top N chains (bash wrapper)
│   ├── audit.sh               # Audit a contract (bash wrapper)
│   ├── hunt.sh                # Start autonomous scanning (bash wrapper)
│   ├── chains.sh              # Show top chains by TVL (bash wrapper)
│   ├── status.sh              # Show status/findings (bash wrapper)
│   ├── install-clawd.sh       # Clawd bot installation script
│   └── clawdbot.json          # Clawd bot heartbeat config
├── skills/
│   └── contract-scanner/
│       └── SKILL.md           # Clawd bot skill definition (NL commands)
├── migrations/
│   └── 001_initial_schema.sql # Database schema
└── src/
    ├── index.ts               # Main entry point (one-shot)
    ├── worker.ts              # BullMQ worker entry point
    ├── cli.ts                 # CLI interface (audit, scan, scan-top, chains, protocols, auto, stats, findings)
    ├── config.ts              # Environment & configuration
    ├── scanner.ts             # Orchestrator - 6-stage verification pipeline
    ├── database.ts            # PostgreSQL client
    ├── types/
    │   └── index.ts           # Shared type definitions
    ├── clients/
    │   ├── etherscan.ts       # Etherscan V2 API client
    │   └── defillama.ts       # DeFiLlama API client
    ├── analyzers/
    │   ├── slither.ts         # Slither subprocess runner
    │   ├── ai-analyzer.ts     # Claude-based analysis
    │   └── deduplicator.ts    # Cross-tool finding dedup
    ├── services/
    │   ├── chains.ts          # Dynamic chain discovery from DeFiLlama (top N by TVL)
    │   ├── context.ts         # Audit history, FP pattern detection, confidence scoring
    │   ├── verifier.ts        # PoC generation & Foundry fork testing
    │   └── state.ts           # File-based state persistence for Clawd integration
    ├── alerts/
    │   └── telegram.ts        # Telegram Bot API alerting (mobile-optimized)
    ├── queue/
    │   ├── queues.ts          # Queue definitions
    │   └── workers.ts         # Worker processors
    └── utils/
        └── helpers.ts         # Shared utility functions
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ETHERSCAN_API_KEY` | Yes | Etherscan V2 API key (works across all chains) |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Target chat/channel ID for alerts |
| `ANTHROPIC_API_KEY` | No | Claude API key for AI-augmented analysis |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `ETH_RPC_URL` | No | Ethereum RPC for PoC fork testing |
| `BASE_RPC_URL` | No | Base RPC for PoC fork testing |
| `ARBITRUM_RPC_URL` | No | Arbitrum RPC for PoC fork testing |
| `POLYGON_RPC_URL` | No | Polygon RPC for PoC fork testing |
| `OPTIMISM_RPC_URL` | No | Optimism RPC for PoC fork testing |
| `MIN_TVL_THRESHOLD` | No | Minimum TVL in USD to scan (default: 10000000) |
| `SCAN_CHAINS` | No | Comma-separated chain names (default: ethereum,base,arbitrum) |
| `ALERT_MIN_SEVERITY` | No | Minimum severity to alert on (default: medium) |
| `CLAWD_AGENT_ID` | No | Clawd bot agent identifier (default: white-rabbit) |
| `CLAWD_DELIVERY_CHANNEL` | No | Clawd delivery channel (default: telegram) |

## Key Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Show top chains by TVL
npx tsx src/cli.ts chains --top 10

# Scan top 10 chains by TVL
npx tsx src/cli.ts scan top10

# Scan top N chains
npx tsx src/cli.ts scan-top 5 --min-tvl 1000000

# Scan a specific network
npm run scan -- base

# Audit a single contract
npm run audit -- 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

# Audit on a specific chain (supports 20+ chains)
npx tsx src/cli.ts audit 0xADDRESS --chain bsc

# List high-TVL protocols
npm run protocols -- ethereum --min-tvl 10000000

# Start autonomous scanning (top 10 chains)
npm run dev -- auto --top-chains 10 --interval 30

# Start autonomous scanning (specific networks)
npm run dev -- auto --networks ethereum,base --interval 30

# Show scanner status
npx tsx src/cli.ts stats

# Show recent findings
npx tsx src/cli.ts findings --limit 20

# Run scanner (one-shot, legacy)
npm start

# Run background worker
npm run worker

# Run with Docker
docker compose up -d

# Run database migrations
npm run migrate
```

## Bash Wrapper Scripts

```bash
# Quick access scripts (chmod +x)
./scripts/scan.sh ethereum           # Scan a network
./scripts/audit.sh 0xADDRESS        # Audit a contract
./scripts/hunt.sh                    # Start autonomous mode
./scripts/hunt.sh --interval 15     # Custom scan interval
./scripts/status.sh                  # Show status
./scripts/status.sh findings         # Show findings
./scripts/install-clawd.sh          # Install as Clawd skill
```

## Clawd Bot Integration

White Rabbit integrates with Clawd bot for Telegram-controlled autonomous operation.

### Setup

```bash
# Install as Clawd skill
./scripts/install-clawd.sh
```

This creates:
- `~/.clawdbot/clawdbot.json` — heartbeat config (30min interval, 6AM-midnight)
- `~/.clawdbot/skills/contract-scanner/SKILL.md` — symlinked skill definition
- `~/.etherscan-auditor/state.json` — scanner state persistence

### Natural Language Commands

Users can control the scanner through Telegram via Clawd:

| Command | Action |
|---------|--------|
| "start hunting" / "hunt top 10" | Start autonomous scanning on top 10 chains |
| "stop hunting" | Stop the scanner |
| "scan top10" / "scan top chains" | Scan top 10 chains by TVL |
| "scan ethereum" | Scan a specific network |
| "show top chains" / "chain rankings" | Show current TVL rankings |
| "audit 0x..." | Audit a single contract |
| "audit 0x... on bsc" | Audit on a specific chain |
| "status" | Show scanner status with per-chain breakdown |
| "what did you find" | Show recent findings |
| "add chain fantom" | Add chain to scan list |
| "skip bsc" | Remove chain from scan list |
| "protocols on base" | List high-TVL protocols |

### Cron Jobs

| Schedule | Scope | Description |
|----------|-------|-------------|
| Every 4 hours | Top 10 chains | Full TVL-ranked sweep |
| Daily 9 AM | All | Rankings refresh + daily summary |

### State Persistence

Scanner state persists to `~/.etherscan-auditor/state.json`:
- Autonomous mode status (active/inactive, PID)
- Configuration (networks, TVL threshold, interval)
- Cumulative stats (scans, contracts, findings, FPs filtered)
- Chain TVL rankings cache (1 hour TTL)
- Per-chain last scan timestamps
- Recent findings (last 100, verified/likely-real)

## 6-Stage Verification Pipeline

### Stage 1: Context Gathering
Before analysis, gather context about the contract:
- Is this from a known audited protocol? (Uniswap, Aave, Compound, etc.)
- Does it use security patterns? (ReentrancyGuard, AccessControl, Pausable)
- Does it use oracles? TWAP?

### Stage 2: Static Analysis
- **Slither:** 90+ detectors, <1s execution, ~10.9% FP rate
- **AI Analysis:** Claude contextualizes high/critical findings for business logic issues

### Stage 3: False Positive Filtering
Known FP patterns automatically filtered:
- `reentrancy-eth` + ReentrancyGuard present = FP
- `arbitrary-send-eth` + onlyOwner present = FP
- `oracle-manipulation` + TWAP present = FP
- Plus AI-identified false positives removed

### Stage 4: PoC Verification
For critical/high findings, generate exploit contracts and test on forked mainnet:
- Uses Foundry (forge) with `--fork-url` against configured RPC
- Templates for reentrancy, arbitrary sends, unchecked transfers
- PoC success = **Verified** (100% confidence boost)
- PoC failure = confidence reduced by 30%

### Stage 5: Risk Scoring
Confidence score (0-100) computed from:
- Base tool confidence (high=60, medium=40, low=20)
- Tool consensus bonus (+20 for 2 tools, +30 for 3+)
- Context penalties (audited protocol: -20, battle-tested: -10)
- Security pattern penalties (ReentrancyGuard + reentrancy detector: -30)
- PoC result (+40 if succeeds, -30 if fails)

### Stage 6: Smart Alerting
Only alerts on findings that are:
- **Verified** or **Likely Real** verification status
- Above the configured severity threshold
- Not already sent (24h dedup window)

## Supported Chains

Chains are dynamically ranked by TVL from DeFiLlama. The scanner supports 20+ EVM chains:

| Chain | Chain ID | Explorer API | Tier |
|---|---|---|---|
| Ethereum | 1 | etherscan.io | Tier 1 |
| BNB Chain | 56 | bscscan.com | Tier 1 |
| Arbitrum | 42161 | arbiscan.io | Tier 1 |
| Base | 8453 | basescan.org | Tier 1 |
| Polygon | 137 | polygonscan.com | Tier 1 |
| Optimism | 10 | etherscan.io | Tier 2 |
| Avalanche | 43114 | snowtrace.io | Tier 2 |
| Blast | 81457 | blastscan.io | Tier 2 |
| Linea | 59144 | lineascan.build | Tier 2 |
| Scroll | 534352 | scrollscan.com | Tier 2 |
| Fantom | 250 | ftmscan.com | Tier 3 |
| Cronos | 25 | cronoscan.com | Tier 3 |
| Gnosis | 100 | gnosisscan.io | Tier 3 |
| zkSync Era | 324 | zksync.network | Tier 3 |
| Mantle | 5000 | mantlescan.xyz | Tier 3 |
| Manta Pacific | 169 | mantascan.io | Tier 3 |
| Mode | 34443 | modescan.io | Tier 3 |
| Celo | 42220 | celoscan.io | Tier 3 |
| Moonbeam | 1284 | moonscan.io | Tier 3 |
| Moonriver | 1285 | moonscan.io | Tier 3 |

Use `npx tsx src/cli.ts chains` to see current TVL rankings. Non-EVM chains (Solana, Bitcoin, etc.) are identified but not scannable.

## Rate Limits

- **Etherscan V2:** 5 calls/sec, 100K calls/day (free tier)
- **DeFiLlama:** No authentication, be respectful (cache 5 min)
- **Telegram Bot:** 1 msg/sec per chat, 30 msg/sec global
- **Anthropic API:** Follows your plan's rate limits

## Security & Ethics

- **Never test vulnerabilities on mainnet** — PoC verification uses forked state only
- **Responsible disclosure:** 14-45 day timeline for DeFi vulnerabilities
- **Check Immunefi** for existing bug bounty programs before contacting teams
- **Document everything:** timestamp findings with blockchain tx hashes
- **Legal compliance:** Follow CFAA good-faith security research guidelines

## Development Notes

- Slither requires `solc` version matching the contract's pragma. The Docker image (`trailofbits/eth-security-toolbox`) includes `solc-select` for version management.
- The AI analyzer has ~40% standalone accuracy but excels at contextualizing static analysis results. Always use it as a supplement, not replacement.
- BullMQ workers run with concurrency=3 and rate limiting (10 jobs per 60s) to stay within API limits.
- PostgreSQL uses a UNIQUE constraint on (address, chain_id) to prevent duplicate contract entries.
- PoC verification requires Foundry (`forge`) and at least one RPC URL configured. Without these, Stages 4-5 still run but without PoC confirmation — findings are scored on tool confidence and context alone.
- The context service recognizes 13 known audited protocols and 10 false positive patterns. Extend these lists in `src/services/context.ts`.
