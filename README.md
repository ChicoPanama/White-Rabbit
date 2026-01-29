# White-Rabbit

Autonomous smart contract vulnerability scanner for [Clawdbot](https://clawd.bot) with **multi-layer verification to minimize false positives**.

## What Makes This Different

Most automated scanners flood you with false positives. White-Rabbit runs a 6-stage verification pipeline that filters noise and only alerts on findings worth investigating.

```
Stage 1: CONTEXT              Stage 2: STATIC ANALYSIS
  - Audit history                - Slither (90+ detectors)
  - Contract age                 - AI business logic analysis
  - Security patterns            - Pattern matching
         |                              |
         v                              v
Stage 3: FALSE POSITIVE        Stage 4: VERIFICATION
  FILTERING
  - Known FP patterns            - PoC on forked mainnet
  - Audit check                  - Tool consensus
  - AI FP removal                - Confidence scoring
         |                              |
         v                              v
Stage 5: RISK SCORING          Stage 6: SMART ALERTING
  - Weighted by verification     - Only verified or
  - Context adjusted               likely-real findings
  - Exploitable value estimate   - Value-gated ($25K+)
```

## Features

| Feature | Description |
|---------|-------------|
| **TVL-Based Prioritization** | Discovers and ranks protocols by TVL via DeFiLlama |
| **Multi-Tool Analysis** | Slither static analysis + Claude AI business logic detection |
| **PoC Verification** | Generates exploit contracts on forked mainnet using Foundry |
| **False Positive Filtering** | 10 known FP patterns + AI filtering + deduplication |
| **Exploitable Value Estimation** | Estimates real extractable value (TVL != exploitable) |
| **Smart Alerts** | Telegram alerts only for verified/likely-real findings above $25K |
| **20+ EVM Chains** | Ethereum, Base, Arbitrum, Polygon, Optimism, BNB Chain, and 15+ more |
| **Fork Detection** | Finds vulnerable forks across all chains when one exploit is discovered |
| **Pattern Learning** | SQLite-backed pattern cache learns from scan outcomes |
| **Self-Evolution** | Autonomous pattern refinement and FP accuracy improvement |
| **Hack Database** | 430+ historical DeFi hacks from DeFiLlama for pattern matching |
| **Clawdbot Integration** | Telegram-controlled autonomous operation via natural language |

## Verification Statuses

| Status | Meaning | Will Alert? |
|--------|---------|-------------|
| **Verified** | PoC exploit succeeded on fork | YES |
| **Likely Real** | 2+ tools agree, high confidence | YES |
| **Needs Review** | Single tool, medium confidence | No (logged) |
| **Likely False** | PoC failed or low confidence | No |
| **False Positive** | Matches known FP pattern | No |

## Quick Start

### 1. Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Redis
- Python 3.x with pip (for Slither)

### 2. Install

```bash
git clone https://github.com/ChicoPanama/White-Rabbit.git
cd White-Rabbit
npm install
```

### 3. Install Slither

```bash
pip install slither-analyzer solc-select
solc-select install 0.8.20
solc-select use 0.8.20
```

### 4. Install Foundry (optional, for PoC verification)

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

### 5. Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required environment variables:
- `ETHERSCAN_API_KEY` - [Etherscan V2 API key](https://etherscan.io/apis) (works across all chains)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

Recommended:
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` - For Telegram alerts
- `ANTHROPIC_API_KEY` - For AI-augmented analysis
- `ETH_RPC_URL` - For PoC fork testing

### 6. Set up database

```bash
npm run migrate
```

### 7. Run

```bash
# Audit a single contract
npm run audit -- 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

# Audit on a specific chain
npx tsx src/cli.ts audit 0xADDRESS --chain bsc

# Scan a network
npm run scan -- ethereum

# Scan top N chains by TVL
npx tsx src/cli.ts scan-top 5 --min-tvl 1000000

# Show top chains by TVL
npx tsx src/cli.ts chains --top 20

# List high-TVL protocols
npm run protocols -- ethereum --min-tvl 10000000

# Start autonomous scanning
npm run dev -- auto --top-chains 10 --interval 30

# Show scanner status
npx tsx src/cli.ts stats

# Show recent findings
npx tsx src/cli.ts findings --limit 20
```

## Project Structure

```
White-Rabbit/
├── src/                   # Core scanner source code
├── docs/                  # Documentation & guides
│   ├── ARMY_COMMAND.md        # Army coordination commands
│   ├── ARMY_DEPLOYMENT.md     # Deployment guide
│   ├── EXPLOIT_PATTERNS.md    # Known exploit patterns
│   ├── RPC_CONFIGURATION.md   # RPC setup guide
│   └── army-command-center.md # Command center docs
├── research/              # Research notes & analysis
│   ├── exploit-research.md    # Exploit research notes
│   ├── exploiter-study.md     # Exploiter behavior analysis
│   ├── mev-exploiter-analysis.md
│   ├── hunt-plan.md           # Hunting strategy
│   ├── hunt-targets.md        # Target protocols
│   └── hunting-log.json       # Scan results log
├── tools/                 # Standalone utilities
│   ├── forensics-engine.js    # Transaction forensics
│   └── mev-detector.js        # MEV detection tool
├── clawdbot/              # Clawdbot integration
│   ├── skills/                # Bot skills (white-rabbit, etc.)
│   ├── templates/             # Agent templates
│   └── clawdbot.example.json  # Config template
├── cache/                 # SQLite caching system
├── analysis/              # Analysis scripts
├── exploits/              # PoC exploit templates
├── contracts/             # Test contracts
├── migrations/            # Database migrations
├── scripts/               # Bash wrapper scripts
└── skills/                # Legacy skill definitions
```

## Architecture

```
src/
├── index.ts               # Main entry point (one-shot scan cycle)
├── worker.ts              # BullMQ worker entry point
├── cli.ts                 # CLI interface
├── config.ts              # Environment configuration
├── scanner.ts             # 6-stage pipeline orchestrator
├── database.ts            # PostgreSQL persistence
├── types/index.ts         # Shared type definitions
├── data/
│   ├── raw-hacks.json     # 430+ historical hack entries
│   ├── enriched-hacks.json
│   ├── known-hacks.ts     # Generated hack database module
│   └── protocol-contracts.ts  # Known protocol contract addresses
├── analyzers/
│   ├── slither.ts         # Slither subprocess runner
│   ├── ai-analyzer.ts     # Claude AI analysis
│   ├── deduplicator.ts    # Cross-tool finding dedup
│   └── local-fp-filter.ts # Local FP pattern matching
├── services/
│   ├── chains.ts          # DeFiLlama chain discovery
│   ├── context.ts         # Audit history + FP pattern detection
│   ├── cost-tracker.ts    # AI API cost tracking
│   ├── crypto.ts          # AES-256-GCM wallet encryption
│   ├── exploitEstimator.ts # Exploitable value estimation
│   ├── exploitVerifier.ts # 4-stage wallet-based verification
│   ├── forkHunter.ts      # Cross-chain fork detection
│   ├── fork-hunter-v2.ts  # Fork detection v2
│   ├── patternCache.ts    # SQLite pattern learning
│   ├── selfEvolution.ts   # Self-improvement engine
│   ├── state.ts           # File-based state persistence
│   ├── verifier.ts        # PoC Foundry verification
│   └── walletManager.ts   # HD wallet manager
├── clients/
│   ├── etherscan.ts       # Etherscan V2 API client
│   └── defillama.ts       # DeFiLlama API client
├── alerts/
│   └── telegram.ts        # Telegram alerting
├── queue/
│   ├── queues.ts          # BullMQ queue definitions
│   └── workers.ts         # Worker processors
└── utils/
    ├── helpers.ts         # Utilities
    └── validation.ts      # Input validation
```

## How Verification Works

### Context Gathering

Before analyzing, the scanner gathers context:
- Is this contract from a known audited protocol? (13 recognized: Uniswap, Aave, Compound, etc.)
- Does it use security patterns? (ReentrancyGuard, AccessControl, Pausable)
- Does it use oracles? TWAP?

### False Positive Filtering

10 known FP patterns are automatically filtered:
- `reentrancy-eth` + `ReentrancyGuard` present = FP
- `arbitrary-send-eth` + `onlyOwner` present = FP
- `oracle-manipulation` + `TWAP` present = FP
- Plus 7 more patterns (see `src/services/context.ts`)

### PoC Verification

For critical/high findings, exploit contracts are generated and tested on forked mainnet using Foundry:
- PoC succeeds = **Verified** (+40 confidence)
- PoC fails = confidence reduced by 30%
- Requires Foundry (`forge`) and an RPC URL for the target chain

### Exploitable Value Estimation

TVL does not equal exploitable value. The estimator calculates real value at risk using vulnerability-type-specific logic:

| Vulnerability | Exploitable Estimate |
|---|---|
| reentrancy-eth | Full ETH balance |
| oracle-manipulation | 5% of pool TVL |
| access-control (mint) | 10x total balance |
| suicidal / unprotected-upgrade | Full balance |

### Confidence Scoring

| Factor | Score Impact |
|--------|-------------|
| High tool confidence | +60 base |
| 3+ tools agree | +30 |
| PoC succeeded | +40 |
| PoC failed | -30 |
| Known audited protocol | -20 |
| Battle-tested (>1yr) | -10 |
| ReentrancyGuard + reentrancy detector | -30 |

## Intelligence Layer

### Pattern Learning

When a vulnerability is found, the system extracts code signatures and contract fingerprints, then searches all 20+ chains for forks with the same vulnerability. One finding cascades into finding all vulnerable forks.

```bash
# Show learned patterns
npx tsx src/cli.ts patterns

# Show learning statistics
npx tsx src/cli.ts knowledge

# Run self-evolution cycle
npx tsx src/cli.ts evolve
```

### Hack Database

430+ historical DeFi hacks scraped from DeFiLlama, enriched with attack patterns:

```bash
npm run build:hacks          # Full pipeline
npm run build:hacks:scrape   # Scrape from DeFiLlama
npm run build:hacks:extract  # Extract patterns
npm run build:hacks:generate # Generate known-hacks.ts
```

## AI Memory System

White-Rabbit includes a durable memory and caching layer for AI analysis results, enabling cost-effective and consistent contract analysis.

### Memory HTTP Server

The memory server provides REST API access to cached AI analysis:

```bash
# Start the memory server
WR_MEMORY_HTTP_ENABLED=true npx tsx src/memory-server.ts

# Check health
curl http://localhost:8787/healthz

# Get memory bundle for a contract
curl "http://localhost:8787/memory/contract/ethereum/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D?includeSummaries=true&includeSimilar=true"
```

### Memory Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WR_MEMORY_HTTP_ENABLED` | `false` | Enable HTTP memory server |
| `WR_MEMORY_HTTP_PORT` | `8787` | HTTP server port |
| `WR_AI_CACHE_TTL_DAYS` | `7` | AI result cache TTL in days |

### Deterministic Confidence Scoring

The memory system computes a deterministic confidence score (0-1) for each contract analysis. This score determines whether an LLM call is needed:

| Confidence | Recommendation | Action |
|------------|----------------|--------|
| >= 0.75 | `use_memory` | Return decision from cached memory, no LLM call |
| < 0.75 | `call_llm` | LLM call allowed with compressed context only |

Signals that increase confidence:
- Definitive tags (honeypot, rug, audited, verified)
- High similarity to known contracts (>= 85% match)
- All findings marked as false positives
- Rich summaries with final determinations

Signals that decrease confidence:
- No findings or scans
- Contradictory findings (critical + low)
- Very recent data with limited history

### CLI Memory Command

```bash
# Get memory bundle for a contract
npx tsx src/cli.ts memory 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum

# With full options
npx tsx src/cli.ts memory 0x... --chain base --scans 10 --findings 50 --includeSummaries --includeSimilar
```

### Clawdbot Memory Policy

When using White-Rabbit with Clawdbot, the agent follows a strict memory-first policy:

1. **MANDATORY**: Call `white_rabbit_memory_lookup` before any contract analysis
2. **Check confidence**: If score >= 0.75, use cached memory without calling AI
3. **Compressed context**: When AI is needed, use only summaries + top 5 findings

See `clawdbot/agents/white-rabbit.policy.json` for the full policy configuration.

## Supported Chains

Chains are dynamically ranked by TVL from DeFiLlama.

| Tier | Chains |
|------|--------|
| **Tier 1** | Ethereum, BNB Chain, Arbitrum, Base, Polygon |
| **Tier 2** | Optimism, Avalanche, Blast, Linea, Scroll |
| **Tier 3** | Fantom, Cronos, Gnosis, zkSync Era, Mantle, Manta, Mode, Celo, Moonbeam, Moonriver |

## Clawdbot Integration

White-Rabbit integrates with [Clawdbot](https://clawd.bot) for Telegram-controlled autonomous operation.

```bash
# Install as Clawdbot skill
./scripts/install-clawd.sh
```

### Natural Language Commands via Telegram

| Command | Action |
|---------|--------|
| "start hunting" | Start autonomous scanning |
| "scan ethereum" | Scan a specific network |
| "audit 0x..." | Audit a single contract |
| "audit 0x... on bsc" | Audit on a specific chain |
| "status" | Show scanner status |
| "what did you find" | Show recent findings |
| "show top chains" | Show TVL rankings |
| "wallet status" | Show verification wallet balances |

### Bash Wrapper Scripts

```bash
./scripts/scan.sh ethereum          # Scan a network
./scripts/audit.sh 0xADDRESS       # Audit a contract
./scripts/hunt.sh                   # Start autonomous mode
./scripts/chains.sh                 # Show chain rankings
./scripts/status.sh                 # Show status
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ETHERSCAN_API_KEY` | Yes | Etherscan V2 API key (all chains) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `TELEGRAM_BOT_TOKEN` | Recommended | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Recommended | Telegram chat ID for alerts |
| `ANTHROPIC_API_KEY` | Recommended | Claude API key for AI analysis |
| `ETH_RPC_URL` | Optional | Ethereum RPC for PoC testing |
| `BASE_RPC_URL` | Optional | Base RPC |
| `ARBITRUM_RPC_URL` | Optional | Arbitrum RPC |
| `POLYGON_RPC_URL` | Optional | Polygon RPC |
| `OPTIMISM_RPC_URL` | Optional | Optimism RPC |
| `MIN_TVL_THRESHOLD` | Optional | Min TVL to scan (default: $10M) |
| `SCAN_CHAINS` | Optional | Comma-separated chains (default: ethereum,base,arbitrum) |
| `ALERT_MIN_SEVERITY` | Optional | Min severity to alert (default: medium) |

See `.env.example` for the full list including wallet, search, and additional chain RPC variables.

## Docker

```bash
docker compose up -d
```

This starts the scanner, worker, PostgreSQL, and Redis. See `docker-compose.yml` for configuration.

## Responsible Disclosure

This tool is for **white hat security research only**.

When you find vulnerabilities:

1. Check for bug bounty programs (Immunefi, HackerOne)
2. Contact the protocol team through official channels
3. Document findings professionally
4. Wait for acknowledgment
5. Follow responsible disclosure timelines (14-45 days)

See `CLAUDE.md` for detailed internal documentation including infrastructure setup, Clawdbot configuration, AGI framework, and troubleshooting.

## License

MIT
