# White-Rabbit: Autonomous Smart Contract Vulnerability Scanner

## 1. Project Overview

White-Rabbit is an autonomous smart contract vulnerability scanner that monitors DeFi protocols across 20+ EVM chains. It combines Slither static analysis, Etherscan V2 + DeFiLlama APIs, Claude AI analysis, multi-layer false positive filtering, and Telegram alerting into a 6-stage verification pipeline.

**Clawdbot** is the AI orchestrator layer — it runs the `white-rabbit` agent on a 30-minute heartbeat, enabling autonomous scanning, hack monitoring, self-evolution, and Telegram-based control.

**Mission:** Find exploitable vulnerabilities before attackers do, focusing on unpatched forks of previously-hacked protocols.

### System Architecture

```
Telegram User (chat 1309504379)
    │
    ▼
Clawdbot Gateway (port 18789, systemd)
    │
    ├── Heartbeat (30m) ──► Agent: white-rabbit
    ├── Cron Jobs (5) ──► Autonomous hunting, hack monitoring, self-evolution
    └── Skills (18) ──► white-rabbit, self-evolution, 16 ClawdHub skills
    │
    ▼
White-Rabbit Scanner (PM2)
    │
    ├── Protocol Discovery (DeFiLlama API)
    ├── Contract Fetching (Etherscan V2)
    ├── Static Analysis (Slither 0.11.5)
    ├── AI Analysis (Claude Haiku/Sonnet)
    ├── FP Filtering (local + AI)
    ├── Value Estimation (on-chain balances)
    └── Smart Alerting (Telegram)
    │
    ▼
Storage
    ├── PostgreSQL (whiterabbit DB — contracts, scans, findings)
    ├── SQLite (patterns.db — learned vulnerability patterns)
    ├── Redis (BullMQ job queue)
    └── File state (~/.etherscan-auditor/state.json)
```

---

## 2. Infrastructure (Verified)

| Component | Value | Status |
|-----------|-------|--------|
| **EC2 Instance** | t2.medium (2 vCPU, 3.8 GB RAM) | Running |
| **OS** | Ubuntu 24.04.3 LTS (Noble Numbat) | - |
| **Node.js** | v22.22.0 | Upgraded from v20 |
| **npm** | 10.9.4 | - |
| **Disk** | 29 GB total, 5.4 GB used (20%) | OK |
| **PostgreSQL** | 16 | active (systemd) |
| **Redis** | redis-server | active (systemd) |
| **Slither** | 0.11.5 (pip, not Docker) | Working |
| **solc-select** | 10 versions: 0.4.17 → 0.8.33 | Auto-switching |
| **Foundry (forge)** | NOT INSTALLED | PoC verification disabled |
| **PM2** | Running 2 processes | white-rabbit-scanner, white-rabbit-worker |
| **Clawdbot** | 2026.1.24-3 | Gateway active (systemd) |

### PM2 Processes

| Process | Purpose | Mode |
|---------|---------|------|
| `white-rabbit-scanner` | One-shot scan loop (runs, exits, PM2 restarts) | fork, online |
| `white-rabbit-worker` | BullMQ worker for queued jobs | fork, online |

### Database State (Verified)

```
PostgreSQL "whiterabbit":
  contracts: 19 rows
  scans:     409 rows
  findings:  2,848 rows
```

Pattern cache at `~/.etherscan-auditor/patterns.db` (SQLite, 90KB).

---

## 3. White-Rabbit Scanner

### Source Code (~9,000 lines TypeScript)

```
~/White-Rabbit/
├── CLAUDE.md                  # This file
├── README.md                  # Public docs
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── .env                       # Environment variables (not committed)
├── scripts/                   # Bash wrappers (scan.sh, audit.sh, hunt.sh, etc.)
├── migrations/
│   └── 001_initial_schema.sql # PostgreSQL schema
├── skills/
│   └── contract-scanner/
│       └── SKILL.md           # Repo-bundled skill definition
├── src/
│   ├── index.ts               # Main entry (one-shot scan cycle) — 53 lines
│   ├── worker.ts              # BullMQ worker entry — 28 lines  (not actively used)
│   ├── cli.ts                 # CLI (audit, scan, scan-top, chains, protocols, auto, stats, findings, wallet, patterns, knowledge, evolve) — 970 lines
│   ├── config.ts              # Env config loader — 87 lines
│   ├── scanner.ts             # 6-stage pipeline orchestrator — 767 lines
│   ├── database.ts            # PostgreSQL client — 200 lines
│   ├── types/index.ts         # Shared types — 428 lines
│   ├── data/
│   │   ├── raw-hacks.json     # 430+ hack entries from DeFiLlama (208KB)
│   │   ├── enriched-hacks.json # Enriched hack data (363KB)
│   │   ├── known-hacks.ts     # Generated hack database module (287KB)
│   │   └── protocol-contracts.ts  # [CLAWD-CREATED] Known protocol addresses — 172 lines
│   ├── analyzers/
│   │   ├── slither.ts         # Slither subprocess runner — 275 lines
│   │   ├── ai-analyzer.ts     # Claude API analysis — 258 lines
│   │   ├── deduplicator.ts    # Cross-tool dedup — 145 lines
│   │   └── local-fp-filter.ts # Local FP pattern matching — 135 lines
│   ├── services/
│   │   ├── chains.ts          # DeFiLlama chain discovery — 305 lines
│   │   ├── context.ts         # Audit history + FP patterns — 255 lines
│   │   ├── cost-tracker.ts    # AI API cost tracking — 124 lines
│   │   ├── crypto.ts          # AES-256-GCM wallet encryption — 104 lines
│   │   ├── exploitEstimator.ts # Value estimation — 526 lines
│   │   ├── exploitVerifier.ts # 4-stage wallet verification — 264 lines
│   │   ├── forkHunter.ts      # Fork detection v1 — 489 lines
│   │   ├── fork-hunter-v2.ts  # Fork detection v2 — 362 lines
│   │   ├── patternCache.ts    # SQLite pattern learning — 860 lines
│   │   ├── selfEvolution.ts   # Self-improvement engine — 449 lines
│   │   ├── state.ts           # File-based state persistence — 458 lines
│   │   ├── verifier.ts        # PoC Foundry verification — 403 lines
│   │   └── walletManager.ts   # HD wallet manager — 639 lines
│   ├── clients/
│   │   ├── etherscan.ts       # Etherscan V2 API — 153 lines
│   │   └── defillama.ts       # DeFiLlama API — 104 lines
│   ├── alerts/
│   │   └── telegram.ts        # Telegram alerting (mobile-optimized) — 894 lines
│   ├── queue/
│   │   ├── queues.ts          # BullMQ queue definitions — 32 lines
│   │   └── workers.ts         # Worker processors — 200 lines
│   └── utils/
│       ├── helpers.ts         # Utilities — 50 lines
│       └── validation.ts      # Input validation — 15 lines
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | ^0.39.0 | Claude AI analysis |
| `better-sqlite3` | ^12.6.2 | Pattern cache (SQLite) |
| `bullmq` | ^5.0.0 | Job queue |
| `dotenv` | ^17.2.3 | Environment vars |
| `ethers` | ^6.16.0 | Ethereum/wallet operations |
| `ioredis` | ^5.4.0 | Redis client |
| `pg` | ^8.13.0 | PostgreSQL client |
| `uuid` | ^10.0.0 | ID generation |
| `tsx` | ^4.19.0 | TypeScript execution (dev) |

### Model Strings (Verified in config.ts)

```typescript
modelHaiku:  'claude-haiku-4-5-20251001'    // config.ts:64
modelSonnet: 'claude-sonnet-4-20250514'     // config.ts:65
```

These are defaults. Override via `AI_MODEL_HAIKU` and `AI_MODEL_SONNET` env vars.

### Environment Variables

| Variable | Required | Set | Description |
|----------|----------|-----|-------------|
| `ETHERSCAN_API_KEY` | Yes | Yes | Etherscan V2 (all chains) |
| `TELEGRAM_BOT_TOKEN` | Yes | Yes | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Yes | Yes | Chat ID: 1309504379 |
| `ANTHROPIC_API_KEY` | Yes | Yes | Claude API key |
| `DATABASE_URL` | Yes | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Yes | Redis connection |
| `ETH_RPC_URL` | No | No | Ethereum RPC (PoC testing) |
| `SCAN_CHAINS` | No | No | Default: ethereum,base,arbitrum |
| `MIN_TVL_THRESHOLD` | No | No | Default: $10M |
| `ALERT_MIN_SEVERITY` | No | No | Default: medium |
| `AI_MODEL_HAIKU` | No | No | Override haiku model string |
| `AI_MODEL_SONNET` | No | No | Override sonnet model string |

### 6-Stage Verification Pipeline

```
Stage 1: CONTEXT           → Audit history, security patterns, known protocols
Stage 2: STATIC ANALYSIS   → Slither (90+ detectors) + Claude AI business logic
Stage 3: FP FILTERING      → Known FP patterns + AI FP removal + dedup
Stage 4: VERIFICATION      → PoC exploit on forked mainnet (requires Foundry — NOT INSTALLED)
Stage 5: RISK SCORING      → Confidence 0-100, tool consensus, PoC results
Stage 5b: VALUE ESTIMATE   → Real exploitable value (TVL ≠ exploitable)
Stage 6: SMART ALERTING    → Value-gated, verified findings only
```

**Current limitation:** Stage 4 (PoC verification) requires Foundry (`forge`), which is not installed. Findings are scored on Slither confidence + AI analysis + context only. No PoC confirmation.

### Verification Statuses

| Status | Meaning | Will Alert? |
|--------|---------|-------------|
| **Verified** | PoC exploit succeeded on fork | YES |
| **Likely Real** | 2+ tools agree, high confidence | YES |
| **Needs Review** | Single tool, medium confidence | No (logged) |
| **Likely False** | PoC failed or low confidence | No |
| **False Positive** | Matches known FP pattern | No |

### Value-Based Alert Thresholds

| Exploitable Value | Action |
|---|---|
| >= $100K or PoC verified | Immediate Telegram alert |
| >= $25K | Alert during active hours |
| >= $1K | Log only |
| < $1K | Ignore |

### Scanner State (Live)

From `~/.etherscan-auditor/state.json`:
- **Autonomous mode:** ACTIVE (since 2026-01-28T03:30:42Z)
- **Networks:** ethereum, bsc, base, arbitrum, polygon
- **Total scans:** 26
- **Contracts scanned:** 25
- **Verified vulns:** 0
- **False positives filtered:** 3
- **Wallet:** Not initialized

### Self-Evolution Activity (Already Happened)

Clawd has already self-evolved the scanner. The evolution log (`~/clawd/memory/evolution-log.json`) shows 6 modifications:

1. **Contract discovery fix** — Scanner was finding 150+ protocols but scanning 0 contracts (missing address resolution)
2. **Protocol-contracts.ts** — Created mapping of known protocol addresses to enable contract discovery
3. **Slither file handling** — Fixed multi-file source handling from Etherscan
4. **Full pipeline operational** — 10 contracts analyzed across 3 chains, 54 raw findings
5. **Autonomous mode activation** — Expanded protocol database, launched aggressive scanning
6. **Forensic analysis** — Transaction-level exploit forensics for Euler, Cream, Nomad attacks

**Files created by Clawd** (untracked in git):
- `src/data/protocol-contracts.ts` — Protocol address mappings
- `exploits/` — Exploit research contracts (ReentrancyExploit.sol, FlashLoanExploit.sol, etc.)
- `forensics-engine.js` — Transaction analysis engine
- Various research markdown files (hunt-targets.md, exploit-research.md, etc.)

### Supported Chains (20+)

| Tier | Chains |
|------|--------|
| **Tier 1** | Ethereum, BNB Chain, Arbitrum, Base, Polygon |
| **Tier 2** | Optimism, Avalanche, Blast, Linea, Scroll |
| **Tier 3** | Fantom, Cronos, Gnosis, zkSync Era, Mantle, Manta, Mode, Celo, Moonbeam, Moonriver |

### Rate Limits

- **Etherscan V2:** 5 calls/sec, 100K calls/day (free tier)
- **DeFiLlama:** No auth, 5-min cache
- **Telegram Bot:** 1 msg/sec per chat, 30 msg/sec global
- **Anthropic API:** Per plan limits, cost-tracked in cost-tracker.ts

---

## 4. Clawdbot Configuration

### Config File: `~/.clawdbot/clawdbot.json`

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-20250514",
        "fallbacks": ["anthropic/claude-haiku-4-5-20251001"]
      },
      "workspace": "/home/ubuntu/clawd",
      "heartbeat": {
        "every": "30m",
        "activeHours": { "start": "00:00", "end": "23:59", "timezone": "UTC" },
        "target": "telegram"
      },
      "contextTokens": 120000,
      "maxConcurrent": 4
    },
    "list": [{ "id": "white-rabbit", "identity": { "name": "White Rabbit", "emoji": "🐇" } }]
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<REDACTED>",
      "dmPolicy": "pairing",
      "allowFrom": ["1309504379"],
      "groupPolicy": "allowlist",
      "streamMode": "partial"
    }
  },
  "tools": {
    "exec": { "host": "gateway", "security": "full" },
    "web": { "search": { "enabled": true }, "fetch": { "enabled": true } }
  },
  "gateway": { "port": 18789, "mode": "local", "bind": "loopback" },
  "bindings": [{ "agentId": "white-rabbit", "match": { "channel": "telegram" } }]
}
```

### System Prompt: `~/.clawdbot/templates/SOUL.md`

Defines the White Rabbit agent identity, mission, strategy, tools, chains reference, communication style, self-learning protocol, autonomous loop, and self-evolution capabilities.

Note: Clawdbot also auto-generates its own SOUL.md at `~/clawd/SOUL.md` from the framework defaults.

### Installed Skills (18 total)

**Custom skills** (`~/.clawdbot/skills/`):
| Skill | Description |
|-------|-------------|
| `white-rabbit` | Scanner commands (scan, audit, chains, protocols, findings, etc.) |
| `self-evolution` | Self-modification capabilities with safety rules |

**ClawdHub skills** (`~/clawd/skills/` — 16 installed):
| Skill | Purpose | API Key Needed |
|-------|---------|----------------|
| `brave-search` | Web search | BRAVE_API_KEY |
| `tavily` | Web search | TAVILY_API_KEY |
| `exa` | Semantic search | EXA_API_KEY |
| `agent-browser` | Browser automation | No |
| `sysadmin-toolbox` | System admin | No |
| `github` | GitHub operations | No |
| `jq` | JSON processing | No |
| `tldr` | Command help | No |
| `auto-updater` | Self-update | No |
| `task-tracker` | Task management | No |
| `todo-tracker` | Todo management | No |
| `clawdbot-logs` | Log analysis | No |
| `process-watch` | Process monitoring | No |
| `oracle` | Knowledge base | No |
| `clawddocs` | Clawdbot docs | No |
| `clawdhub` | Skill marketplace | No |

### Cron Jobs (5 active)

| Name | Schedule | Purpose |
|------|----------|---------|
| `autonomous-hunt` | `*/30 * * * *` | Scan top 5 chains, check for hacks, alert on $25K+ findings |
| `hack-monitor` | `0 */2 * * *` | Check DeFiLlama for new exploits, queue affected protocols |
| `self-evolution-review` | `0 */6 * * *` | Analyze FPs, refine patterns, improve detection |
| `daily-summary` | `0 9 * * *` | Daily metrics summary to Telegram |
| `weekly-analysis` | `0 6 * * 1` | Deep strategy review with Sonnet, write reflection |

All jobs use `--session isolated`, deliver to Telegram chat 1309504379.

### Telegram Bot

- **Bot username:** @WhiteRabbitClawdBot (verify via BotFather)
- **Chat ID:** 1309504379
- **Permissions:** Elevated (canExec, canModifySkills, canModifyCron)
- **Features:** Natural language commands, streaming responses, skill integration

---

## 5. Memory & Learning System

### Directory Structure (Verified)

```
~/clawd/
├── SOUL.md                    # Clawdbot-generated identity (auto)
├── IDENTITY.md                # Agent identity
├── MEMORY.md                  # Memory instructions
├── HEARTBEAT.md               # Heartbeat config
├── TOOLS.md                   # Available tools
├── USER.md                    # User preferences
├── AGENTS.md                  # Agent config
├── hunting-log.json           # Root-level hunt cycles log
├── canvas/index.html          # Clawdbot canvas UI
├── backups/                   # Pre-modification backups
│   ├── scanner.ts.20260128-pre-evolution
│   └── slither.ts.20260128-pre-fix
├── memory/
│   ├── hunting-log.json       # Hunting state (initialized, not yet populated by heartbeat)
│   ├── evolution-log.json     # Self-modification audit trail (6 entries)
│   ├── hack-checks.log        # Hack news check log (1 entry)
│   ├── 2026-01-28.md          # Daily memory journal
│   └── hunt-results-2026-01-28.md  # Hunt results
├── skills/                    # ClawdHub installed skills (16)
├── mind/                      # AGI reasoning framework
│   ├── understanding-framework.md
│   ├── hypothesis-engine.md
│   ├── temporal-analysis.md
│   ├── composability-engine.md
│   ├── learning-system.md
│   ├── intuition.md
│   ├── red-team-self.md
│   ├── agents/multi-agent-config.json
│   ├── knowledge-graph/schema.md
│   ├── hypotheses/.gitkeep
│   ├── learning/.gitkeep
│   └── reflections/.gitkeep
├── defi_exploits/README.md    # [CLAWD-CREATED] Research
├── mev_research/README.md     # [CLAWD-CREATED] Research
├── bridge_exploit_analysis.md # [CLAWD-CREATED] Research
└── governance-attacks-database.md  # [CLAWD-CREATED] Research
```

### hunting-log.json Schema

```json
{
  "version": "1.0",
  "lastUpdated": "ISO timestamp",
  "stats": {
    "totalScans": 0,
    "totalContracts": 0,
    "totalFindings": 0,
    "verifiedExploits": 0,
    "likelyReal": 0,
    "falsePositives": 0,
    "totalExploitableValue": 0,
    "forkMatches": 0,
    "patternsLearned": 0
  },
  "chainPriorities": { "ethereum": 1.0, "bsc": 0.9, ... },
  "scanQueue": [],
  "recentHacks": [],
  "findings": [],
  "patterns": [],
  "lastScanByChain": {}
}
```

### evolution-log.json

Tracks all self-modifications. Each entry has: timestamp, type, description, issue, solution, files modified, backup paths, build/test success, result. Currently has 6 entries from the first autonomous session.

---

## 6. AGI Framework — Implementation Status

### [IMPLEMENTED] — Files exist with structured content

| File | Purpose | Status |
|------|---------|--------|
| `understanding-framework.md` | Epistemological approach — 4 levels of understanding, invariant analysis | Written, reference doc |
| `hypothesis-engine.md` | Hypothesis-driven hunting — fork, temporal, pattern, economic, governance hypotheses | Written, reference doc |
| `temporal-analysis.md` | Time-dependent vulnerability patterns — daily/weekly/monthly scanning cycles | Written, reference doc |
| `composability-engine.md` | Cross-protocol interaction risks — oracle chains, flash loans, cascading liquidations | Written, reference doc |
| `learning-system.md` | Continuous improvement loop — scan→classify→feedback→update | Written, reference doc |
| `intuition.md` | Anomaly detection — suspicion scoring system (0-100) | Written, reference doc |
| `red-team-self.md` | Adversarial self-testing — blind spot checks, FN estimation, attack surface review | Written, reference doc |
| `knowledge-graph/schema.md` | Entity/relationship schema for protocols, contracts, vulnerabilities, patterns | Written, reference doc |
| `agents/multi-agent-config.json` | 4 agent archetypes: archaeologist, adversary, economist, synthesizer | Written, config only |

### [PLANNED] — Not yet implemented in code

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-agent routing | Config only | `multi-agent-config.json` defines archetypes but no code dispatches to them |
| Knowledge graph database | Schema only | `schema.md` defines entities but no graph DB is implemented |
| Hypothesis tracking | Directory only | `hypotheses/.gitkeep` — Clawd hasn't written hypotheses yet |
| Weekly reflections | Directory only | `reflections/.gitkeep` — weekly-analysis cron job will populate |
| Learning event tracking | Directory only | `learning/.gitkeep` — should be populated by scan outcomes |
| Suspicion scoring | Doc only | `intuition.md` describes scoring but it's not integrated into scanner.ts |
| Composability analysis | Doc only | No cross-protocol interaction analysis in scanner pipeline |

### What IS implemented in scanner code

The following intelligence features are **actually implemented** in TypeScript:

- **PatternCache** (`patternCache.ts`, 860 lines) — SQLite-backed pattern learning with code signatures, fingerprints, similarity index
- **ForkHunter** (`forkHunter.ts`, 489 lines + `fork-hunter-v2.ts`, 362 lines) — Cross-chain fork detection
- **SelfEvolution** (`selfEvolution.ts`, 449 lines) — Pattern refinement, FP analysis, accuracy tracking
- **ContextService** (`context.ts`, 255 lines) — Recognizes 13 audited protocols, 10 FP patterns
- **ExploitEstimator** (`exploitEstimator.ts`, 526 lines) — Vulnerability-type-specific value estimation
- **CostTracker** (`cost-tracker.ts`, 124 lines) — AI API cost tracking and budgeting

---

## 7. Commands Reference

### Scanner Commands

```bash
# Build
cd ~/White-Rabbit && npm run build

# Audit a single contract
npx tsx src/cli.ts audit 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
npx tsx src/cli.ts audit 0xADDRESS --chain bsc

# Scan a network
npx tsx src/cli.ts scan ethereum

# Scan top N chains by TVL
npx tsx src/cli.ts scan-top 5 --min-tvl 1000000

# Show chain TVL rankings
npx tsx src/cli.ts chains --top 20

# List protocols on a chain
npx tsx src/cli.ts protocols ethereum --min-tvl 10000000

# Start autonomous scanning
npx tsx src/cli.ts auto --networks ethereum,base --interval 30
npx tsx src/cli.ts auto --top-chains 10 --interval 30

# Show status and findings
npx tsx src/cli.ts stats
npx tsx src/cli.ts findings --limit 20

# Intelligence commands
npx tsx src/cli.ts patterns
npx tsx src/cli.ts knowledge
npx tsx src/cli.ts evolve

# Wallet commands
npx tsx src/cli.ts wallet:init
npx tsx src/cli.ts wallet:balances
npx tsx src/cli.ts wallet:fund ethereum

# Hack database build pipeline
npm run build:hacks          # Full pipeline
npm run build:hacks:scrape   # Scrape from DeFiLlama
npm run build:hacks:extract  # Extract patterns
npm run build:hacks:generate # Generate known-hacks.ts
```

### Service Management

```bash
# PM2
pm2 status
pm2 logs white-rabbit-scanner --lines 50
pm2 logs white-rabbit-worker --lines 50
pm2 restart white-rabbit-scanner
pm2 restart all
pm2 save

# OpenClaw (formerly Clawdbot)
systemctl --user status clawdbot-gateway
systemctl --user restart clawdbot-gateway
openclaw cron list
openclaw cron runs --id <JOB_ID>
openclaw doctor
openclaw models
openclaw skills

# PostgreSQL
sudo -u postgres psql -d whiterabbit
sudo -u postgres psql -d whiterabbit -c "SELECT count(*) FROM findings;"

# Redis
redis-cli ping
redis-cli info memory
```

### Bash Wrapper Scripts

```bash
./scripts/scan.sh ethereum          # Scan a network
./scripts/audit.sh 0xADDRESS       # Audit a contract
./scripts/hunt.sh                   # Start autonomous mode
./scripts/chains.sh                 # Show chain rankings
./scripts/status.sh                 # Show status
./scripts/status.sh findings        # Show findings
```

---

## 8. API Keys & Secrets

All secrets are in `~/White-Rabbit/.env` (not committed to git).

| Secret | Purpose | Set |
|--------|---------|-----|
| `ANTHROPIC_API_KEY` | Claude AI analysis | Yes |
| `ETHERSCAN_API_KEY` | Etherscan V2 API (all chains) | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot | Yes |
| `TELEGRAM_CHAT_ID` | Target chat | Yes (1309504379) |
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `REDIS_URL` | Redis connection | Yes |
| `BRAVE_API_KEY` | Brave search skill | No (skill installed, key not set) |
| `TAVILY_API_KEY` | Tavily search skill | No |
| `EXA_API_KEY` | Exa search skill | No |
| `ETH_RPC_URL` | Ethereum RPC for PoC | No (PoC verification inactive) |

The Clawdbot config (`~/.clawdbot/clawdbot.json`) contains the Telegram bot token inline. File permissions are set to 600.

Anthropic auth is via OAuth (claude-cli profile), which expires and needs periodic `claude setup-token` renewal.

---

## 9. Troubleshooting

### Common Issues

**Scanner keeps restarting (PM2 restart count high)**
This is normal. `index.ts` is a one-shot process — it runs a scan cycle, exits, and PM2 restarts it. The worker process should stay up continuously.

**`ERR_DLOPEN_FAILED` for better-sqlite3**
After Node.js upgrade, native modules need rebuilding:
```bash
pm2 stop all
rm -rf node_modules/better-sqlite3/build
npm install better-sqlite3
pm2 start all
```

**`Unknown model` error in Clawdbot cron**
Check model string format. Clawdbot uses `anthropic/claude-sonnet-4-20250514` (provider/model format). The scanner uses bare model names like `claude-haiku-4-5-20251001`.

**Slither fails for a specific contract**
Slither needs the matching solc version. The analyzer auto-installs via `solc-select` but some versions may fail. Check:
```bash
solc-select versions
solc-select install 0.8.XX
```

**Anthropic API 404 for model**
Current working model names:
- Haiku: `claude-haiku-4-5-20251001`
- Sonnet: `claude-sonnet-4-20250514`
- Opus: `claude-opus-4-5-20251101`

**Gateway timeout on `openclaw cron list`**
Gateway may be busy processing an agent turn. Wait and retry, or increase timeout:
```bash
openclaw cron list --timeout 30000
```

### Log Locations

| Log | Path |
|-----|------|
| PM2 scanner | `~/.pm2/logs/white-rabbit-scanner-out.log` |
| PM2 scanner errors | `~/.pm2/logs/white-rabbit-scanner-error.log` |
| PM2 worker | `~/.pm2/logs/white-rabbit-worker-out.log` |
| OpenClaw gateway | `journalctl --user -u clawdbot-gateway` |
| OpenClaw log file | `~/.clawdbot/clawdbot.log` |
| Scanner state | `~/.etherscan-auditor/state.json` |
| Pattern cache | `~/.etherscan-auditor/patterns.db` |
| Clawd memory | `~/clawd/memory/` |
| Clawd daily journal | `~/clawd/memory/YYYY-MM-DD.md` |

---

## 10. Roadmap

### Done

- [x] 6-stage verification pipeline (Slither + AI + FP filtering + scoring + alerting)
- [x] Multi-chain scanning (20+ EVM chains, TVL-ranked)
- [x] Etherscan V2 integration (single API key, all chains)
- [x] DeFiLlama integration (TVL data, protocol discovery, hack database)
- [x] AI analysis with Claude (Haiku for bulk, Sonnet for high-TVL)
- [x] Telegram alerting (value-gated, mobile-optimized)
- [x] Pattern learning (SQLite-backed, code signatures, fingerprints)
- [x] Fork detection (cross-chain matching)
- [x] Self-evolution engine (pattern refinement, FP analysis)
- [x] Wallet infrastructure (HD wallet, encryption, simulation-only)
- [x] Cost tracking (AI API budget management)
- [x] Hack database (430+ entries from DeFiLlama)
- [x] Clawdbot integration (gateway, Telegram, 30m heartbeat)
- [x] 5 cron jobs (autonomous hunt, hack monitor, daily summary, weekly analysis, self-evolution)
- [x] 18 skills installed (2 custom + 16 ClawdHub)
- [x] AGI reasoning framework (7 reference docs + knowledge graph schema + multi-agent config)
- [x] Protocol-to-address mapping (Clawd self-evolved this)
- [x] Slither multi-file source handling (Clawd self-evolved this)
- [x] First autonomous scan cycle completed (10 contracts, 54 findings, 3 chains)

### Not Yet Done

- [ ] **Install Foundry (forge)** — Required for PoC verification (Stage 4). Without it, findings can't be verified with exploit contracts on forked mainnet.
- [ ] **RPC endpoints** — No ETH_RPC_URL configured. Needed for on-chain balance checks and PoC fork testing.
- [ ] **Search API keys** — BRAVE_API_KEY, TAVILY_API_KEY, EXA_API_KEY not set. Web search skills installed but non-functional.
- [ ] **Wallet initialization** — `wallet:init` not run. 4-stage enhanced verification unavailable.
- [ ] **Real verified findings** — 0 verified or likely-real vulnerabilities found yet. System is working but hasn't triggered on a real exploitable contract.

### Future Enhancements

- [ ] Multi-agent dispatch (use archaeologist/adversary/economist archetypes from multi-agent-config.json)
- [ ] Knowledge graph implementation (Neo4j or similar for protocol/vulnerability relationships)
- [ ] Hypothesis tracking (active hypothesis files, automated validation)
- [ ] Suspicion scoring integration (implement intuition.md scoring in scanner pipeline)
- [ ] Cross-protocol composability analysis (detect multi-protocol attack vectors)
- [ ] Automated Immunefi bounty matching (check if findings qualify for known bounties)
- [ ] Docker Compose deployment (Dockerfile exists but not used — running directly on EC2)
- [ ] Dashboard UI (Clawdbot canvas exists at ~/clawd/canvas/index.html but minimal)
- [ ] Pattern accuracy tracking over time (grafana/prometheus metrics)

---

## Security & Ethics

- **Never test vulnerabilities on mainnet** — PoC uses forked state only
- **Responsible disclosure:** 14-45 day timeline for DeFi vulnerabilities
- **Check Immunefi** for existing bug bounty programs before contacting teams
- **Document everything:** Timestamp findings with evidence
- **Legal compliance:** CFAA good-faith security research guidelines
- **Wallet safety:** Simulation only, no mainnet transactions, max $1K per chain
- **Self-evolution safety:** Max 5 changes/day, always backup, always test, stop after 3 failures

---

## Development Notes

- Slither runs natively via pip (not Docker). `solc-select` auto-installs missing compiler versions.
- The AI analyzer has ~40% standalone accuracy. Use it as a supplement to Slither, not a replacement.
- The scanner is a one-shot process (`index.ts`). PM2 restart loop provides continuous scanning.
- BullMQ workers run with concurrency=3 and rate limiting (10 jobs per 60s).
- PostgreSQL uses UNIQUE(address, chain_id) to prevent duplicate contract entries.
- The context service recognizes 13 known audited protocols and 10 FP patterns. Extend in `src/services/context.ts`.
- Clawd has already self-modified `scanner.ts`, `slither.ts`, and created `protocol-contracts.ts`. These changes are not committed to git.
- The `better-sqlite3` native module must match the Node.js version. After any Node upgrade, run `npm install better-sqlite3` to rebuild.
- Clawdbot auth uses OAuth via claude-cli profile. Token expires periodically — run `claude setup-token` to renew.
