---
name: contract-scanner
description: Autonomous smart contract vulnerability scanner with 6-stage verification pipeline
metadata: {"clawdbot":{"requires":{"bins":["slither","node"],"env":["ETHERSCAN_API_KEY","TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"]},"primaryEnv":"ETHERSCAN_API_KEY","emoji":"🦞","installers":{"slither":"pip install slither-analyzer solc-select && solc-select install 0.8.20 && solc-select use 0.8.20","foundry":"curl -L https://foundry.paradigm.xyz | bash && foundryup"},"heartbeat":{"interval_minutes":30,"active_hours":{"start":6,"end":24}},"crons":[{"name":"ETH Mainnet scan","cron":"0 */4 * * *","message":"Run vulnerability scan on ethereum","deliver":true,"channel":"telegram"},{"name":"L2 scan","cron":"0 */6 * * *","message":"Run vulnerability scan on base,arbitrum,optimism","deliver":true,"channel":"telegram"},{"name":"Daily summary","cron":"0 9 * * *","message":"Send daily vulnerability summary","deliver":true,"channel":"telegram"}]}}
---

## Instructions

Scan smart contracts for vulnerabilities using a 6-stage verification pipeline that minimizes false positives. Only alert on verified or high-confidence findings. Never cry wolf.

### Natural Language Commands

| User Says | Action | Script |
|-----------|--------|--------|
| "start hunting" / "go hunting" / "start scanning" | Start autonomous scanning loop | `./scripts/hunt.sh` |
| "stop hunting" / "stop scanning" / "stand down" | Stop the autonomous scanner | Send SIGTERM to scanner PID |
| "scan ethereum" / "scan [network]" | Scan a specific network | `./scripts/scan.sh <network>` |
| "audit 0x..." / "check 0x..." / "analyze 0x..." | Audit a single contract | `./scripts/audit.sh <address>` |
| "what did you find" / "findings" / "any vulns?" | Show recent verified findings | `./scripts/status.sh findings` |
| "status" / "how's it going" / "sitrep" | Show scanner status and stats | `./scripts/status.sh` |
| "set min tvl to 5M" / "change threshold to..." | Update TVL threshold | Update config via CLI |
| "focus on ethereum,base" / "only scan..." | Change target networks | Update config via CLI |
| "protocols on base" / "top protocols..." | List high-TVL protocols | `npx tsx src/cli.ts protocols <network>` |

### Verification Pipeline

1. **Context** — Gather audit history, detect security patterns (ReentrancyGuard, AccessControl), identify known protocols
2. **Static Analysis** — Run Slither (90+ detectors) + AI business logic detection via Claude
3. **FP Filtering** — Match against known false positive patterns, remove AI-flagged FPs, deduplicate
4. **Verification** — Generate PoC exploits and test on forked mainnet via Foundry (critical/high only)
5. **Risk Scoring** — Weighted confidence score (0-100) from tool consensus, context, and PoC results
6. **Smart Alerting** — Only alert on verified or likely-real findings. No cry wolf.

### Verification Statuses

- **Verified** — PoC exploit succeeded on fork (always alert)
- **Likely Real** — 2+ tools agree, high confidence (always alert)
- **Needs Review** — Single tool, medium confidence (logged only)
- **Likely False** — PoC failed or low confidence (suppressed)
- **False Positive** — Matches known FP pattern (suppressed)

### Trigger

```bash
# Ethereum mainnet every 4 hours
clawdbot cron add \
  --name "ETH scan" \
  --cron "0 */4 * * *" \
  --session isolated \
  --message "Run vulnerability scan on ethereum" \
  --deliver --channel telegram

# L2 networks every 6 hours
clawdbot cron add \
  --name "L2 scan" \
  --cron "0 */6 * * *" \
  --session isolated \
  --message "Run vulnerability scan on base,arbitrum,optimism" \
  --deliver --channel telegram

# Daily summary at 9 AM
clawdbot cron add \
  --name "Daily summary" \
  --cron "0 9 * * *" \
  --session isolated \
  --message "Send daily vulnerability summary" \
  --deliver --channel telegram
```

### Supported Chains

Ethereum (1), Base (8453), Arbitrum (42161), Polygon (137), Optimism (10)

### Example Conversations

**Starting a hunt:**
> User: "Start hunting for vulnerabilities"
> Bot: Starting autonomous scanning on ethereum, base, arbitrum. Min TVL: $10M. Interval: 30min. I'll alert you on verified findings only.

**Checking in:**
> User: "Status"
> Bot: 🟢 Autonomous mode: ACTIVE | Last scan: 12 min ago | Scanned 47 contracts | 2 verified vulns, 1 likely real | 23 FPs filtered

**After finding something:**
> Bot: 🔴 CRITICAL: reentrancy-eth | ✅ VERIFIED | Contract: 0x7a25...88D (Ethereum) | Confidence: ████████░░ 85% | PoC exploit SUCCEEDED

**Clean sweep:**
> Bot: 📋 Daily Summary | ✅ 0 actionable findings across 156 contracts | 🎉 Clean sweep. No vulnerabilities found today.

### Security Notes

- Never test vulnerabilities on mainnet — PoC verification uses forked state only
- Check Immunefi for existing bug bounty programs before contacting teams
- Follow responsible disclosure timelines (14-45 days for DeFi)
- Document all findings with timestamps and evidence hashes
