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
| **Fork Cascade Hunting** | Finds a vuln on one chain, then hunts all 20+ chains for vulnerable forks |
| **Cross-Chain PoC Adaptation** | Automatically adapts PoC exploits across chains with token/address mapping |
| **Immunefi Report Generation** | Generates submission-ready reports with severity mapping and bounty estimates |
| **Multi-Agent Architecture** | 18+ specialized agents with parallel execution and structured deliverables |
| **Temporal Workflow Orchestration** | Durable, queryable scan pipelines with automatic retry and progress tracking |
| **Structured Error Handling** | Classified errors with retry policies, circuit breakers, and Temporal integration |
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
├── src/                   # Core scanner source code (see Architecture below)
├── prompts/               # Vulnerability-specific prompt templates
│   ├── vuln-reentrancy.txt    # Reentrancy analysis prompt
│   ├── vuln-oracle.txt        # Oracle manipulation prompt
│   ├── report-immunefi.txt    # Immunefi report generation prompt
│   └── ...                    # 9 vuln templates + 2 shared partials
├── configs/               # YAML configuration files
│   ├── default.yaml           # Default scan configuration
│   ├── schema.json            # JSON Schema for config validation
│   └── micro-protocol.yaml    # Lightweight protocol config
├── fixtures/              # Sample data for testing
├── data/                  # Immunefi program cache
├── docs/                  # Documentation & guides
│   ├── ARMY_COMMAND.md        # Army coordination commands
│   ├── ARMY_DEPLOYMENT.md     # Deployment guide
│   ├── EXPLOIT_PATTERNS.md    # Known exploit patterns
│   ├── RPC_CONFIGURATION.md   # RPC setup guide
│   └── army-command-center.md # Command center docs
├── research/              # Research notes & analysis
├── tools/                 # Standalone utilities
│   ├── forensics-engine.js    # Transaction forensics
│   └── mev-detector.js        # MEV detection tool
├── clawdbot/              # Clawdbot integration
│   ├── skills/                # Bot skills (white-rabbit, etc.)
│   ├── templates/             # Agent templates
│   └── clawdbot.example.json  # Config template
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
├── config-parser.ts       # YAML config with JSON Schema validation
├── prompt-manager.ts      # Template loading with variable substitution
├── queue-validation.ts    # 5-phase pipeline validation
├── deliverables-manager.ts # Session-scoped structured output per scan
├── dry-run.ts             # DRY_RUN/PIPELINE_TESTING mode
├── types/index.ts         # Shared type definitions
├── data/
│   ├── raw-hacks.json     # 430+ historical hack entries
│   ├── enriched-hacks.json
│   ├── known-hacks.ts     # Generated hack database module
│   └── protocol-contracts.ts  # Known protocol contract addresses
├── agents/                # Multi-agent architecture
│   ├── agent-types.ts     # Agent definition, execution context, result types
│   ├── agent-registry.ts  # 18+ agent definitions across 5 pipeline phases
│   ├── agent-executor.ts  # Agent execution with deliverable I/O
│   ├── session-manager.ts # Parallel execution planning and orchestration
│   ├── findings-consolidator.ts  # Cross-agent finding dedup and ranking
│   └── agent-logger.ts    # Session metrics and execution logging
├── errors/                # Structured error handling
│   ├── error-types.ts     # Error class hierarchy (Network, AI, Config, etc.)
│   ├── error-classifier.ts # Automatic error classification from raw errors
│   ├── retry-policy.ts    # Per-category retry with exponential backoff
│   ├── circuit-breaker.ts # Circuit breaker for external service protection
│   └── temporal-errors.ts # Temporal SDK error mapping
├── reporting/             # Immunefi bug bounty submission generation
│   ├── immunefi-types.ts  # Submission schema and program types
│   ├── severity-mapper.ts # Internal severity → Immunefi classification
│   ├── poc-formatter.ts   # PoC sanitization and formatting
│   ├── report-generator.ts # Markdown/JSON report generation
│   ├── recommendation-engine.ts  # Auto-generated fix recommendations
│   ├── report-pipeline.ts # Pipeline integration with deliverables
│   └── program-lookup.ts  # Immunefi program matching and scope validation
├── hunt-forks/            # Cross-chain fork cascade hunting
│   ├── chain-registry.ts  # 20+ EVM chain registry with RPCs and explorers
│   ├── bytecode-matcher.ts # Bytecode signature extraction and similarity
│   ├── fork-hunter.ts     # Multi-chain parallel fork search
│   ├── cascade-scanner.ts # Automatic fork vulnerability verification
│   ├── poc-adapter.ts     # Cross-chain PoC adaptation with token mapping
│   ├── cascade-report.ts  # Cross-chain report with submission plan
│   └── tvl-lookup.ts      # DeFiLlama TVL-based fork prioritization
├── temporal/              # Temporal workflow orchestration
│   ├── shared.ts          # Shared types (V8 sandbox safe)
│   ├── workflows.ts       # Main scan workflow (5 phases)
│   ├── activities.ts      # Activity implementations (Node.js)
│   ├── cascade-shared.ts  # Cascade hunt shared types
│   ├── cascade-workflow.ts # Cascade hunt workflow (5 phases)
│   ├── cascade-activities.ts # Cascade hunt activities
│   ├── worker.ts          # Temporal worker bootstrap
│   ├── client.ts          # Temporal client factory
│   ├── orchestrator.ts    # Legacy/Temporal routing bridge
│   ├── query.ts           # Workflow progress querying
│   └── start-scan.ts      # CLI scan launcher
├── analyzers/
│   ├── slither.ts         # Slither subprocess runner
│   ├── ai-analyzer.ts     # Multi-provider AI analysis
│   ├── deduplicator.ts    # Cross-tool finding dedup
│   └── local-fp-filter.ts # Local FP pattern matching
├── services/
│   ├── chains.ts          # DeFiLlama chain discovery
│   ├── context.ts         # Audit history + FP pattern detection
│   ├── cost-tracker.ts    # AI API cost tracking
│   ├── crypto.ts          # AES-256-GCM wallet encryption
│   ├── exploitEstimator.ts # Exploitable value estimation
│   ├── exploitVerifier.ts # 4-stage wallet-based verification
│   ├── forkHunter.ts      # Cross-chain fork detection (legacy)
│   ├── fork-hunter-v2.ts  # Fork detection v2 (legacy)
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
├── tests/                 # Test suites (Node.js built-in test runner)
│   ├── smoke.test.ts      # Core module smoke tests
│   ├── agents.test.ts     # Multi-agent architecture tests
│   ├── temporal.test.ts   # Temporal workflow tests
│   ├── errors.test.ts     # Error handling tests
│   ├── reporting.test.ts  # Immunefi reporting tests
│   └── hunt-forks.test.ts # Fork cascade hunting tests
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

## Fork Cascade Hunting

When a vulnerability is found on one chain, the cascade system automatically hunts all 20+ EVM chains for forks of the same contract.

```
Original Vuln Found (Ethereum)
        │
        ▼
  Bytecode Extraction → Signature (function selectors, normalized hash)
        │
        ▼
  Fork Discovery (parallel across 20 chains)
        │    └─ Etherscan V2 search + bytecode comparison
        ▼
  Cascade Verification
        │    └─ Source analysis: patch indicators vs vulnerability indicators
        ▼
  PoC Adaptation
        │    └─ Replace addresses, tokens (WETH→WBNB), RPC endpoints
        ▼
  Report Generation → Submission plan with TVL-ranked priorities
```

### Bytecode Similarity

Contracts are compared using:
- **Function selector overlap** (Jaccard index, 70% weight) — extracted from PUSH4 opcodes
- **Code size similarity** (30% weight) — normalized for metadata
- **Normalized hash** — bytecode with zeroed immutables for exact fork detection

| Score | Classification |
|-------|---------------|
| 95-100 | Exact fork |
| 80-94 | Modified fork |
| 60-79 | Related |
| < 60 | Unrelated |

### Fork Verification

Each discovered fork is classified:
- **Vulnerable** — No patch indicators, vuln indicators present, or exact bytecode match
- **Patched** — Security patterns added (ReentrancyGuard, AccessControl, TWAP, etc.)
- **Uncertain** — Mixed signals or bytecode-only analysis

### Cross-Chain PoC Adaptation

The PoC adapter maps well-known addresses across chains:
- Wrapped native tokens (WETH, WBNB, WMATIC, etc.)
- Stablecoins (USDC, USDT per chain)
- DEX routers (Uniswap V2/V3, PancakeSwap, SpookySwap)
- Lending pools (AAVE V3 per chain)

## Immunefi Report Generation

Automatically generates submission-ready bug bounty reports:

```
Findings → Severity Mapping → PoC Formatting → Report Generation
                │                    │                  │
                ▼                    ▼                  ▼
         Immunefi severity     Sanitized PoC      Markdown + JSON
         + CWE mapping         (no private keys)  + per-finding reports
                │                                       │
                ▼                                       ▼
         Recommendation Engine              Submission Checklist
         (auto-generated fixes)             + Program Matching
```

- Maps internal severity to Immunefi classification (Critical/High/Medium/Low)
- Sanitizes PoC code (removes private keys, API keys, internal URLs)
- Generates fix recommendations per vulnerability type
- Matches findings to Immunefi programs by contract address
- Estimates bounty ranges based on program max bounty and severity

## Multi-Agent Architecture

18+ specialized agents organized across 5 pipeline phases:

| Phase | Agents | Purpose |
|-------|--------|---------|
| Discovery | `discovery-source`, `discovery-context` | Fetch source code and audit context |
| Static Analysis | `static-slither` | Run Slither detectors |
| Vulnerability Hypothesis | `vuln-reentrancy`, `vuln-arithmetic`, `vuln-access-control`, `vuln-oracle`, `vuln-flash-loan`, `vuln-logic` | Per-vuln-type AI analysis |
| Verification | `verify-reentrancy`, `verify-arithmetic`, `verify-access-control`, `verify-oracle`, `verify-flash-loan`, `verify-logic` | PoC verification per type |
| Report | `report-consolidate`, `report-immunefi` | Finding consolidation and report generation |

Agents within the same phase run in parallel. Each agent has:
- A prompt template (`prompts/` directory) with variable substitution
- Required input deliverables from prior phases
- Structured output deliverables for downstream agents
- Configurable retry, timeout, and priority settings

## Temporal Workflow Orchestration

Scan pipelines can run as durable Temporal workflows with automatic retry, progress querying, and failure recovery.

```bash
# Set orchestrator mode
export ORCHESTRATOR=temporal   # or 'legacy' (default)

# Start Temporal infrastructure
docker compose -f docker-compose.temporal.yml up -d

# Start Temporal worker
npx tsx src/temporal/worker.ts

# Launch a scan
npx tsx src/temporal/start-scan.ts --address 0x... --chain ethereum

# Query progress
npx tsx src/temporal/query.ts --workflow-id scan-<session-id>
```

Two workflow types:
- **Scan workflow** — 5 phases: discovery → static analysis → vulnerability hypothesis → verification → report
- **Cascade workflow** — 5 phases: bytecode extraction → fork discovery → cascade verification → PoC adaptation → report generation

## Error Handling

Structured error classification with automatic retry policies:

| Error Category | Retry? | Examples |
|----------------|--------|----------|
| Network | Yes (3x, exponential backoff) | Timeouts, DNS failures, 5xx |
| RateLimit | Yes (after cooldown) | 429 responses, quota exceeded |
| AI | Yes (2x with model rotation) | Provider errors, token limits |
| Config | No | Missing env vars, invalid YAML |
| Validation | No | Bad addresses, schema violations |
| Slither | Yes (1x) | Compilation errors, timeouts |
| Database | Yes (2x) | Connection drops, deadlocks |
| Budget | No | Cost limit exceeded |

Circuit breakers protect external services — after 5 consecutive failures, the circuit opens for 60 seconds before allowing half-open probes.

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

## Testing

Tests use the Node.js built-in test runner (`node:test` + `node:assert`):

```bash
npm test
```

| Suite | Tests | Coverage |
|-------|-------|----------|
| `smoke.test.ts` | Core module smoke tests | Config, types, helpers |
| `agents.test.ts` | Multi-agent architecture | Registry, executor, session manager, consolidator |
| `temporal.test.ts` | Temporal workflows | Shared types, activities, orchestrator, docker |
| `errors.test.ts` | Error handling | Classification, retry policies, circuit breakers |
| `reporting.test.ts` | Immunefi reporting | Severity mapping, PoC formatting, report generation |
| `hunt-forks.test.ts` | Fork cascade hunting | Chain registry, bytecode matching, PoC adapter, TVL |

218 tests across 44 suites.

## Docker

```bash
docker compose up -d
```

This starts the scanner, worker, PostgreSQL, and Redis. See `docker-compose.yml` for configuration.

### Temporal Infrastructure

```bash
docker compose -f docker-compose.temporal.yml up -d
```

This starts Temporal Server, PostgreSQL (for Temporal), and the Temporal Web UI at `http://localhost:8233`.

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
