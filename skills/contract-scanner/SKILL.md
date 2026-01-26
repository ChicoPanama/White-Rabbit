---
name: contract-scanner
description: Autonomous smart contract vulnerability scanner with dynamic top-10 chain discovery
metadata: {"clawdbot":{"requires":{"bins":["slither","node"],"env":["ETHERSCAN_API_KEY","TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"]},"primaryEnv":"ETHERSCAN_API_KEY","emoji":"🦞","installers":{"slither":"pip install slither-analyzer solc-select && solc-select install 0.8.20 && solc-select use 0.8.20","foundry":"curl -L https://foundry.paradigm.xyz | bash && foundryup"},"heartbeat":{"interval_minutes":30,"active_hours":{"start":6,"end":24}},"crons":[{"name":"Top Chain Sweep","cron":"0 */4 * * *","message":"Scan top 10 chains by TVL for vulnerabilities, min TVL 1M, alert me only on verified findings","deliver":true,"channel":"telegram"},{"name":"Daily Summary","cron":"0 9 * * *","message":"Refresh chain TVL rankings, show me the current top 10, and summarize vulnerabilities found in the last 24 hours","deliver":true,"channel":"telegram"}]}}
---

## Instructions

Scan smart contracts for vulnerabilities across the top EVM chains by TVL using a 6-stage verification pipeline. Dynamically discovers chains from DeFiLlama. Only alerts on verified or high-confidence findings. Never cry wolf.

### Natural Language Commands

| User Says | Action | Script |
|-----------|--------|--------|
| "start hunting" / "hunt top 10" / "start scanning" | Start autonomous scan on top 10 chains | `./scripts/hunt.sh --top-chains 10` |
| "hunt top 5" / "scan top 5" | Scan only top 5 chains by TVL | `./scripts/scan.sh top5` |
| "stop hunting" / "stand down" | Stop the autonomous scanner | Send SIGTERM to scanner PID |
| "scan top 10" / "scan top chains" / "scan everything" | Scan top 10 chains by TVL | `./scripts/scan.sh top10` |
| "scan ethereum" / "scan [network]" | Scan a specific network | `./scripts/scan.sh <network>` |
| "scan base and arbitrum" / "scan [chain1], [chain2]" | Scan specific chains | Run scan for each chain |
| "audit 0x..." / "check 0x..." / "analyze 0x..." | Audit a single contract | `./scripts/audit.sh <address>` |
| "audit 0x... on base" | Audit contract on specific chain | `./scripts/audit.sh <address> --chain base` |
| "show top chains" / "chain rankings" / "which chains" | Show current TVL rankings | `./scripts/chains.sh` |
| "what did you find" / "findings" / "any vulns?" | Show recent verified findings | `./scripts/status.sh findings` |
| "status" / "how's the hunt going" / "sitrep" | Show scanner status with per-chain breakdown | `./scripts/status.sh` |
| "add chain [name]" / "also scan [chain]" | Add chain to scan list | Update config |
| "remove chain [name]" / "skip [chain]" | Remove chain from scan list | Update config |
| "set min tvl to 5M" | Update TVL threshold | Update config via CLI |
| "focus on ethereum,base" | Change target networks | Update config via CLI |
| "protocols on base" / "high tvl on [chain]" | List high-TVL protocols on a chain | `npx tsx src/cli.ts protocols <network>` |

### Verification Pipeline

1. **Context** — Gather audit history, detect security patterns (ReentrancyGuard, AccessControl), identify known protocols
2. **Static Analysis** — Run Slither (90+ detectors) + AI business logic detection via Claude
3. **FP Filtering** — Match against known false positive patterns, remove AI-flagged FPs, deduplicate
4. **Verification** — Generate PoC exploits and test on forked mainnet via Foundry (critical/high only)
5. **Risk Scoring** — Weighted confidence score (0-100) from tool consensus, context, and PoC results
6. **Smart Alerting** — Only alert on verified or likely-real findings. No cry wolf.

### Dynamic Chain Discovery

Chains are ranked by TVL from DeFiLlama API. The scanner supports 20+ EVM chains with block explorer APIs:

**Tier 1 (typically top 5):** Ethereum, BSC, Arbitrum, Base, Polygon
**Tier 2:** Optimism, Avalanche, Blast, Linea, Scroll
**Tier 3:** Fantom, Cronos, Gnosis, zkSync Era, Mantle, Manta, Mode, Celo, Moonbeam, Moonriver

Rankings refresh every hour. Non-EVM chains (Solana, Bitcoin, etc.) are shown but skipped.

### Trigger

```bash
# Every 4 hours: scan top 10 chains
clawdbot cron add \
  --name "Top Chain Sweep" \
  --cron "0 */4 * * *" \
  --session isolated \
  --message "Scan top 10 chains by TVL for vulnerabilities, min TVL 1M, alert me only on verified findings" \
  --deliver --channel telegram

# Daily: refresh rankings and summarize
clawdbot cron add \
  --name "Daily Summary" \
  --cron "0 9 * * *" \
  --session isolated \
  --message "Refresh chain TVL rankings, show me the current top 10, and summarize vulnerabilities found in the last 24 hours" \
  --deliver --channel telegram
```

### Example Conversations

**Asking about chains:**
> User: "What chains can you scan?"
> Bot: 📊 Top 10 Chains by TVL (DeFiLlama)
> 1. 🥇 Ethereum - $52.3B ✅
> 2. 🥈 BSC - $4.8B ✅
> 3. 🥉 Arbitrum - $3.2B ✅
> 4. Solana - $2.9B ❌ (not EVM)
> 5. Base - $2.1B ✅
> ...
> I can scan all 8 EVM chains. Want me to start hunting?

**Starting a full hunt:**
> User: "Hunt top 10 chains, 1M min tvl"
> Bot: 🦞 Starting the hunt across TOP 10 CHAINS!
> Targets: Ethereum ($52.3B) → BSC ($4.8B) → Arbitrum ($3.2B) → Base ($2.1B) → ...
> Min TVL: $1,000,000 | Mode: Autonomous (every 30 min)
> Let the hunt begin! 🎯

**Finding across chains:**
> Bot: 🔴 CRITICAL: reentrancy-eth | ✅ VERIFIED
> 🔵 Base ($2.1B) | SomeProtocol Vault (0x1234...5678)
> 📊 Confidence: ████████░░ 94%
> 💥 PoC exploit SUCCEEDED

**Status with chain breakdown:**
> User: "Status"
> Bot: 🦞 Hunt Status
> 🟢 Mode: ACTIVE (top 10 chains)
> ✅ Ethereum - 12 contracts, 0 verified
> ✅ BSC - 8 contracts, 1 likely real
> ✅ Base - 18 contracts, 1 VERIFIED 🔴
> 🔄 Polygon - scanning now...
> ⏳ Optimism - queued
> Findings: 1 verified, 2 likely real, 156 FPs filtered

**Clean sweep:**
> Bot: 📋 Daily Summary | ✅ 0 actionable findings across 156 contracts | 🎉 Clean sweep.

### Security Notes

- Never test vulnerabilities on mainnet — PoC verification uses forked state only
- Check Immunefi for existing bug bounty programs before contacting teams
- Follow responsible disclosure timelines (14-45 days for DeFi)
- Document all findings with timestamps and evidence hashes
