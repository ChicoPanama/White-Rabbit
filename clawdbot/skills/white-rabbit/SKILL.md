---
name: white-rabbit
description: Autonomous smart contract vulnerability scanner with 6-stage verification pipeline
requires:
  bins: [node, slither, solc-select]
  env: [ETHERSCAN_API_KEY]
emoji: 🐇
---

## Instructions

Scan smart contracts for vulnerabilities across 20+ EVM chains using the White-Rabbit 6-stage verification pipeline. Estimates actual exploitable value (TVL ≠ exploitable value). Only alerts on verified or high-confidence findings above value thresholds.

### Commands

| Command | Action | Script |
|---------|--------|--------|
| scan top N | Scan top N chains by TVL | `cd ~/White-Rabbit && npx tsx src/cli.ts scan-top <N> --min-tvl 1000000` |
| scan [chain] | Scan a specific chain | `cd ~/White-Rabbit && npx tsx src/cli.ts scan <chain>` |
| audit [address] | Audit a single contract | `cd ~/White-Rabbit && npx tsx src/cli.ts audit <address>` |
| audit [address] on [chain] | Audit on specific chain | `cd ~/White-Rabbit && npx tsx src/cli.ts audit <address> --chain <chain>` |
| chains / chain rankings | Show TVL rankings | `cd ~/White-Rabbit && npx tsx src/cli.ts chains --top 20` |
| protocols on [chain] | List high-TVL protocols | `cd ~/White-Rabbit && npx tsx src/cli.ts protocols <chain> --min-tvl 1000000` |
| findings | Show recent findings | `cd ~/White-Rabbit && npx tsx src/cli.ts findings --limit 20` |
| stats / status | Show scanner stats | `cd ~/White-Rabbit && npx tsx src/cli.ts stats` |
| patterns | Show learned patterns | `cd ~/White-Rabbit && npx tsx src/cli.ts patterns` |
| knowledge | Show learning stats | `cd ~/White-Rabbit && npx tsx src/cli.ts knowledge` |
| evolve | Run self-evolution | `cd ~/White-Rabbit && npx tsx src/cli.ts evolve` |
| wallet balances | Show wallet balances | `cd ~/White-Rabbit && npx tsx src/cli.ts wallet:balances` |
| wallet fund [chain] | Show deposit address | `cd ~/White-Rabbit && npx tsx src/cli.ts wallet:fund <chain>` |
| memory [address] | Get AI memory bundle | `cd ~/White-Rabbit && npx tsx src/cli.ts memory <address> --chain <chain>` |
| memory [address] on [chain] | Get memory for specific chain | `cd ~/White-Rabbit && npx tsx src/cli.ts memory <address> --chain <chain> --scans 10 --findings 50` |

### Hack Database

The scanner includes a comprehensive hack database at `~/White-Rabbit/src/data/raw-hacks.json` with 430+ entries. Use it for:
- Pattern matching against known exploit techniques
- Historical analysis of vulnerability types
- Fork hunting targets (protocols that were exploited)

### Chains Reference

| Chain | ID | Flag |
|-------|-----|------|
| Ethereum | 1 | `--chain ethereum` |
| BNB Chain | 56 | `--chain bsc` |
| Arbitrum | 42161 | `--chain arbitrum` |
| Base | 8453 | `--chain base` |
| Polygon | 137 | `--chain polygon` |
| Optimism | 10 | `--chain optimism` |
| Avalanche | 43114 | `--chain avalanche` |
| Blast | 81457 | `--chain blast` |
| Linea | 59144 | `--chain linea` |
| Scroll | 534352 | `--chain scroll` |
| Fantom | 250 | `--chain fantom` |
| Gnosis | 100 | `--chain gnosis` |
| Cronos | 25 | `--chain cronos` |

### Verification Pipeline

1. **Context** — Audit history, security patterns, known protocols
2. **Static Analysis** — Slither (90+ detectors) + AI business logic
3. **FP Filtering** — Known FP patterns, AI FP removal, deduplication
4. **PoC Verification** — Exploit contracts on forked mainnet (Foundry)
5. **Risk Scoring** — Confidence 0-100, tool consensus, PoC results
5b. **Value Estimation** — Real exploitable value, not just TVL
6. **Smart Alerting** — Value-gated, verified findings only

### Alert Thresholds

| Exploitable Value | Action |
|---|---|
| >= $100K or PoC verified | Immediate alert |
| >= $25K | Alert during active hours |
| >= $1K | Log only |
| < $1K | Ignore |

### AI Memory & Caching

The scanner includes an AI memory system that caches analysis results to avoid redundant API calls:

- **Memory Bundle** — Compact JSON with contract data, scan history, findings, and AI assessments
- **Prompt-Hash Caching** — SHA-256 hash of normalized prompts for deduplication
- **Redis Hot Cache** — Optional fast cache (2-minute TTL for memory bundles)
- **Postgres Persistence** — Durable storage for AI runs (7-day default TTL)

```bash
# CLI memory lookup
npx tsx src/cli.ts memory 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum

# Start memory HTTP server (optional)
WR_MEMORY_HTTP_ENABLED=true npx tsx src/memory-server.ts

# HTTP endpoint (when server is running)
curl http://localhost:8787/memory/contract/ethereum/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
```

### Context Management

The scanner automatically manages context to prevent overflow errors.

| Mode | Max Output | Use Case |
|------|-----------|----------|
| Interactive (default) | 2048 tokens | Chat, quick queries |
| Report | 4096 tokens | Full analysis reports |
| Minimal | 1024 tokens | Status checks, simple answers |

**Context-Saving Commands:**

| Command | Action |
|---------|--------|
| `brief status` | Get minimal status (saves context) |
| `full report on [X]` | Triggers report mode for one response |

**Memory Payload Limits:**
- Default findings per request: 10 (max 50)
- Default scans per request: 5 (max 50)
- Max response tokens: 5000

### Micro-Protocol Hunting

Hunt small protocols ($10K-$10M TVL) with prioritized targets:

```bash
npx tsx src/cli.ts micro --chain base --min-tvl 10000 --max-tvl 100000
npx tsx src/cli.ts micro --tier 1  # Use predefined tier ($10K-$100K)
npx tsx src/cli.ts micro --continuous  # Auto-tier progression
npx tsx src/cli.ts sessions  # View hunting sessions
npx tsx src/cli.ts sessions --learning  # Show learning data
```

**TVL Tiers:**
| Tier | Range | Description |
|------|-------|-------------|
| 1 | $10K-$100K | Micro protocols |
| 2 | $100K-$500K | Small protocols |
| 3 | $500K-$1M | Growing protocols |
| 4 | $1M-$5M | Medium protocols |
| 5 | $5M-$10M | Established protocols |

### Process Management

```bash
pm2 status                           # Check scanner processes
pm2 logs white-rabbit-scanner        # Scanner logs
pm2 logs white-rabbit-worker         # Worker logs
pm2 restart white-rabbit-scanner     # Restart scanner
```
