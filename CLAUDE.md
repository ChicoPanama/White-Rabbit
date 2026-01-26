# White-Rabbit: Autonomous Smart Contract Vulnerability Scanner

## Project Overview

White-Rabbit is a production-ready autonomous smart contract vulnerability scanner that monitors high-value DeFi protocols across multiple EVM chains. It combines static analysis tools (Slither, Aderyn, Semgrep), blockchain APIs (Etherscan V2, DeFiLlama), AI-augmented analysis, and Telegram alerting into a unified scanning pipeline.

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
Static Analysis (Slither/Docker) ──► 90+ vulnerability detectors
    │
    ▼
AI Enrichment (Claude) ──► Business logic, false-positive filtering
    │
    ▼
Deduplication & Severity Ranking
    │
    ▼
Telegram Alerts ──► Severity-filtered, fatigue-prevention
    │
    ▼
PostgreSQL Storage ──► Full audit trail
```

## Tech Stack

- **Language:** TypeScript (Node.js 20+)
- **Static Analysis:** Slither via Docker (`trailofbits/eth-security-toolbox`)
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
├── .gitignore
├── skills/
│   └── contract-scanner/
│       └── SKILL.md           # Clawd bot skill definition
├── migrations/
│   └── 001_initial_schema.sql # Database schema
└── src/
    ├── index.ts               # Main entry point
    ├── worker.ts              # BullMQ worker entry point
    ├── config.ts              # Environment & configuration
    ├── scanner.ts             # Orchestrator - main scan pipeline
    ├── types/
    │   └── index.ts           # Shared type definitions
    ├── clients/
    │   ├── etherscan.ts       # Etherscan V2 API client
    │   └── defillama.ts       # DeFiLlama API client
    ├── analyzers/
    │   ├── slither.ts         # Slither subprocess runner
    │   ├── ai-analyzer.ts     # Claude-based analysis
    │   └── deduplicator.ts    # Cross-tool finding dedup
    ├── alerts/
    │   └── telegram.ts        # Telegram Bot API alerting
    └── queue/
        ├── queues.ts          # Queue definitions
        └── workers.ts         # Worker processors
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
| `MIN_TVL_THRESHOLD` | No | Minimum TVL in USD to scan (default: 10000000) |
| `SCAN_CHAINS` | No | Comma-separated chain names (default: ethereum,base,arbitrum) |
| `ALERT_MIN_SEVERITY` | No | Minimum severity to alert on (default: medium) |

## Key Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run scanner (one-shot)
npm start

# Run background worker
npm run worker

# Run with Docker
docker compose up -d

# Run database migrations
npm run migrate

# Development mode
npm run dev
```

## Scanning Pipeline Details

1. **Protocol Discovery:** DeFiLlama `/protocols` endpoint filtered by chain and TVL threshold
2. **Contract Fetching:** Etherscan V2 `getsourcecode` with 200ms minimum between requests, exponential backoff on 429s
3. **Static Analysis:** Slither runs in Docker container via subprocess, outputs JSON findings
4. **AI Enrichment:** Each high/critical Slither finding is contextualized by Claude to filter false positives and identify business logic issues
5. **Deduplication:** Findings from multiple tools are merged by contract location and semantic similarity
6. **Alerting:** Telegram messages grouped by contract, severity-filtered, with 24h dedup window
7. **Storage:** All findings persisted to PostgreSQL with full scan metadata

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

- **Never test vulnerabilities on mainnet** - use testnets or local forks
- **Responsible disclosure:** 14-45 day timeline for DeFi vulnerabilities
- **Check Immunefi** for existing bug bounty programs before contacting teams
- **Document everything:** timestamp findings with blockchain tx hashes
- **Legal compliance:** Follow CFAA good-faith security research guidelines

## Development Notes

- Slither requires `solc` version matching the contract's pragma. The Docker image (`trailofbits/eth-security-toolbox`) includes `solc-select` for version management.
- The AI analyzer has ~40% standalone accuracy but excels at contextualizing static analysis results. Always use it as a supplement, not replacement.
- BullMQ workers run with concurrency=3 and rate limiting (10 jobs per 60s) to stay within API limits.
- PostgreSQL uses a UNIQUE constraint on (address, chain_id) to prevent duplicate contract entries.
