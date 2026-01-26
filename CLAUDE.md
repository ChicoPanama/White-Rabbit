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
├── skills/
│   └── contract-scanner/
│       └── SKILL.md           # Clawd bot skill definition
├── migrations/
│   └── 001_initial_schema.sql # Database schema
└── src/
    ├── index.ts               # Main entry point (one-shot)
    ├── worker.ts              # BullMQ worker entry point
    ├── cli.ts                 # CLI interface (audit, scan, protocols, auto)
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
    │   ├── context.ts         # Audit history, FP pattern detection, confidence scoring
    │   └── verifier.ts        # PoC generation & Foundry fork testing
    ├── alerts/
    │   └── telegram.ts        # Telegram Bot API alerting
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

## Key Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Audit a single contract
npm run audit -- 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

# Scan a network
npm run scan -- base

# List high-TVL protocols
npm run protocols -- ethereum --min-tvl 10000000

# Start autonomous scanning
npm run dev -- auto --networks ethereum,base --interval 30

# Run scanner (one-shot, legacy)
npm start

# Run background worker
npm run worker

# Run with Docker
docker compose up -d

# Run database migrations
npm run migrate
```

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

| Chain | Chain ID | Notes |
|---|---|---|
| Ethereum | 1 | Primary target |
| Base | 8453 | Growing DeFi ecosystem |
| Arbitrum | 42161 | Major L2 |
| Polygon | 137 | High volume |
| Optimism | 10 | OP Stack L2 |

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
