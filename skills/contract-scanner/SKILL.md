---
name: contract-scanner
description: Autonomous smart contract vulnerability scanner with multi-layer verification
metadata: {"clawdbot":{"requires":{"bins":["slither","node"],"env":["ETHERSCAN_API_KEY","TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"]},"primaryEnv":"ETHERSCAN_API_KEY","emoji":"🦞","installers":{"slither":"pip install slither-analyzer solc-select && solc-select install 0.8.20 && solc-select use 0.8.20","foundry":"curl -L https://foundry.paradigm.xyz | bash && foundryup"}}}
---

## Instructions

Scan smart contracts for vulnerabilities using a 6-stage verification pipeline that minimizes false positives. Only alerts on verified or high-confidence findings.

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
clawdbot cron add \
  --name "Contract scan" \
  --cron "0 */4 * * *" \
  --session isolated \
  --message "Run vulnerability scan on newly verified contracts" \
  --deliver --channel telegram
```

### Supported Chains

Ethereum (1), Base (8453), Arbitrum (42161), Polygon (137), Optimism (10)

### Security Notes

- Never test vulnerabilities on mainnet — PoC verification uses forked state only
- Check Immunefi for existing bug bounty programs before contacting teams
- Follow responsible disclosure timelines (14-45 days for DeFi)
- Document all findings with timestamps and evidence hashes
