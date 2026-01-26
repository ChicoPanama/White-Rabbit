---
name: contract-scanner
description: Autonomous smart contract vulnerability scanner with exploitable value estimation
metadata: {"clawdbot":{"requires":{"bins":["slither","node"],"env":["ETHERSCAN_API_KEY","TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"]},"primaryEnv":"ETHERSCAN_API_KEY","emoji":"🦞","installers":{"slither":"pip install slither-analyzer solc-select && solc-select install 0.8.20 && solc-select use 0.8.20","foundry":"curl -L https://foundry.paradigm.xyz | bash && foundryup"},"heartbeat":{"interval_minutes":30,"active_hours":{"start":6,"end":24}},"crons":[{"name":"Top Chain Sweep","cron":"0 */4 * * *","message":"Scan top 10 chains by TVL for vulnerabilities, min TVL 1M, alert on findings over $25K exploitable","deliver":true,"channel":"telegram"},{"name":"Daily Summary","cron":"0 9 * * *","message":"Give me a value breakdown of all findings from the last 24 hours, sorted by exploitable amount. Refresh chain TVL rankings.","deliver":true,"channel":"telegram"}]}}
---

## Instructions

Scan smart contracts for vulnerabilities across the top EVM chains by TVL using a 6-stage verification pipeline. Dynamically discovers chains from DeFiLlama. Estimates **actual exploitable value** (not just TVL) for every finding. Only alerts on verified or high-confidence findings above value thresholds. Never cry wolf.

### Key Insight

TVL ≠ Exploitable Value. A protocol might have $10M TVL but only $267K sits in the vulnerable contract and is actually exploitable. This scanner answers: **"How much money is actually at risk?"**

### Natural Language Commands

| User Says | Action | Script |
|-----------|--------|--------|
| "start hunting" / "hunt top 10" / "start scanning" | Start autonomous scan on top 10 chains | `./scripts/hunt.sh --top-chains 10` |
| "hunt top 5" / "scan top 5" | Scan only top 5 chains by TVL | `./scripts/scan.sh top5` |
| "stop hunting" / "stand down" | Stop the autonomous scanner | Send SIGTERM to scanner PID |
| "scan top 10" / "scan top chains" / "scan everything" | Scan top 10 chains by TVL | `./scripts/scan.sh top10` |
| "scan ethereum" / "scan [network]" | Scan a specific network | `./scripts/scan.sh <network>` |
| "audit 0x..." / "check 0x..." / "analyze 0x..." | Audit a single contract | `./scripts/audit.sh <address>` |
| "audit 0x... on base" | Audit contract on specific chain | `./scripts/audit.sh <address> --chain base` |
| "show top chains" / "chain rankings" / "which chains" | Show current TVL rankings | `./scripts/chains.sh` |
| "what did you find" / "findings" / "any vulns?" | Show recent findings with exploitable values | `./scripts/status.sh findings` |
| "what's the total value at risk?" / "value breakdown" | Sum of all exploitable values found | `./scripts/status.sh` |
| "show findings over $100K" | Filter findings by exploitable value | Filter recent findings ≥ $100K |
| "details on [finding]" | Full breakdown including value analysis | Show full exploit estimate |
| "set alert threshold to $50K" | Only alert on $50K+ exploitable | Update config alertMinExploitable |
| "status" / "how's the hunt going" / "sitrep" | Show scanner status with value summary | `./scripts/status.sh` |
| "add chain [name]" / "also scan [chain]" | Add chain to scan list | Update config |
| "remove chain [name]" / "skip [chain]" | Remove chain from scan list | Update config |
| "protocols on base" / "high tvl on [chain]" | List high-TVL protocols on a chain | `npx tsx src/cli.ts protocols <network>` |
| "wallet status" / "wallet balances" | Show verification wallet balances | `npx tsx src/cli.ts wallet:balances` |
| "fund ethereum" / "fund [chain]" | Show deposit address for a chain | `npx tsx src/cli.ts wallet:fund <chain>` |
| "init wallet" / "setup wallet" | Initialize verification wallet | `npx tsx src/cli.ts wallet:init` |

### Verification Pipeline

1. **Context** — Gather audit history, detect security patterns (ReentrancyGuard, AccessControl), identify known protocols
2. **Static Analysis** — Run Slither (90+ detectors) + AI business logic detection via Claude
3. **FP Filtering** — Match against known false positive patterns, remove AI-flagged FPs, deduplicate
4. **Verification** — Generate PoC exploits and test on forked mainnet via Foundry (critical/high only)
5. **Risk Scoring** — Weighted confidence score (0-100) from tool consensus, context, and PoC results
5b. **Exploit Value Estimation** — Calculate actual exploitable value (contract balances, locked funds, vulnerability-type-specific logic)
6. **Smart Alerting** — Only alert on verified findings above value thresholds. No cry wolf.

### Value-Based Alert Thresholds

| Exploitable Value | Alert Action |
|---|---|
| ≥ $100K or PoC verified | Immediate Telegram alert |
| ≥ $25K | Alert during active hours |
| ≥ $1K | Log only (query via "what did you find") |
| < $1K | Ignore completely |

### Dynamic Chain Discovery

Chains are ranked by TVL from DeFiLlama API. The scanner supports 20+ EVM chains with block explorer APIs:

**Tier 1 (typically top 5):** Ethereum, BSC, Arbitrum, Base, Polygon
**Tier 2:** Optimism, Avalanche, Blast, Linea, Scroll
**Tier 3:** Fantom, Cronos, Gnosis, zkSync Era, Mantle, Manta, Mode, Celo, Moonbeam, Moonriver

Rankings refresh every hour. Non-EVM chains (Solana, Bitcoin, etc.) are shown but skipped.

### Trigger

```bash
# Every 4 hours: scan top 10 chains, alert on $25K+ exploitable
clawdbot cron add \
  --name "Top Chain Sweep" \
  --cron "0 */4 * * *" \
  --session isolated \
  --message "Scan top 10 chains by TVL for vulnerabilities, min TVL 1M, alert on findings over $25K exploitable" \
  --deliver --channel telegram

# Daily: value breakdown summary
clawdbot cron add \
  --name "Daily Summary" \
  --cron "0 9 * * *" \
  --session isolated \
  --message "Give me a value breakdown of all findings from the last 24 hours, sorted by exploitable amount. Refresh chain TVL rankings." \
  --deliver --channel telegram
```

### Example Conversations

**Finding with high exploitable value:**
> Bot: 🚨 CRITICAL: reentrancy-eth | ✅ VERIFIED
> 🔗 Ethereum | YieldVault (0x1234...5678)
>
> ━━━━━━━━━━━━━━━━━━━━━━━━━━
> 💰 VALUE AT RISK
> ━━━━━━━━━━━━━━━━━━━━━━━━━━
> Protocol TVL:     $8,500,000
> Contract Balance: $3,200,000
> Exploitable:      $1,200,000 (37%)
>                   HIGH CONFIDENCE
> ━━━━━━━━━━━━━━━━━━━━━━━━━━
>
> 💥 PoC exploit SUCCEEDED
> 💸 PoC extracted: $1,247,832 (net profit: $1,247,820)
>
> Breakdown:
>   • ETH at risk: $1,784,000
>   • Locked/safe: $2,000,000
>
> Required capital: $0 (direct drain)
> 🎯 Bounty potential: $120K (10% of exploitable)

**Low-value finding (logged, not alerted):**
> Bot: 🟡 Low-Value Finding (logging only)
> Chain: Arbitrum | SmallPool
> Issue: Reentrancy in claim()
> Exploitable: ~$3,200 (0.6%)
> Not alerting — below $10K threshold.

**Value summary:**
> User: "what have you found?"
> Bot: 🦞 Findings Summary
> 💰 Total Exploitable Value Found: $1,847,000
>
> 🔴 VERIFIED:
>   YieldVault (ETH) - $1.2M exploitable
>   LendingPool (Base) - $340K exploitable
>
> ⚠️ LIKELY REAL:
>   SwapRouter (Arbitrum) - $180K estimated
>   StakingContract (Polygon) - $127K estimated
>
> 📊 By Chain:
>   Ethereum: $1.2M
>   Base: $340K
>   Arbitrum: $180K
>   Polygon: $127K

**Status with value tracking:**
> User: "status"
> Bot: 🦞 Hunt Status
> 🟢 Mode: ACTIVE (top 10 chains)
> 💰 Total exploitable: $1,847,000
>   Ethereum: $1,200,000
>   Base: $340,000
> Findings: 2 verified, 3 likely real, 156 FPs filtered

### Wallet-Based Verification (4-Stage)

When a verification wallet is configured, findings go through enhanced 4-stage verification:

1. **Fork simulation** — Foundry/Anvil (fast, free, always runs)
2. **Wallet simulation** — `eth_call` with real wallet state
3. **Trace analysis** — `debug_traceCall` for exact value flows
4. **Testnet execution** — Definitive proof ($100K+ findings only)

Confidence levels:
- **Definitive** — Testnet execution succeeded
- **High** — 2+ stages verified
- **Medium** — Fork-only verification
- **Low** — Fork failed or inconclusive

**Wallet commands:**
> User: "wallet status"
> Bot: Shows balance across all configured chains, low-balance warnings

> User: "fund ethereum"
> Bot: Shows deposit address and minimum balance needed

### Security Notes

- Never test vulnerabilities on mainnet — PoC verification uses forked state only
- Wallet mnemonics are AES-256-GCM encrypted at rest with scrypt key derivation
- Mainnet execution is blocked at the code level — simulation only
- Wallet auto-locks after 30 minutes of inactivity
- Check Immunefi for existing bug bounty programs before contacting teams
- Follow responsible disclosure timelines (14-45 days for DeFi)
- Document all findings with timestamps and evidence hashes
