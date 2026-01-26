---
name: contract-scanner
description: Autonomous smart contract vulnerability scanner for DeFi protocols
metadata: {"clawdbot":{"requires":{"bins":["slither","node"],"env":["ETHERSCAN_API_KEY","TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"]},"primaryEnv":"ETHERSCAN_API_KEY","emoji":"🔍","installers":{"slither":"pip install slither-analyzer solc-select && solc-select install 0.8.20 && solc-select use 0.8.20"}}}
---

## Instructions

Scan smart contracts for vulnerabilities using Slither static analysis and AI-augmented review. This skill operates autonomously on a schedule to monitor high-value DeFi protocols.

### Workflow

1. **Discover protocols** — Query DeFiLlama for protocols above TVL threshold on configured chains
2. **Fetch contracts** — Retrieve verified source code from Etherscan V2 API (multi-chain, single key)
3. **Run analysis** — Execute Slither for static analysis (90+ detectors, <1s per contract)
4. **AI enrichment** — Use Claude to contextualize findings, filter false positives, identify business logic issues
5. **Deduplicate** — Merge overlapping findings from different tools into unified severity rankings
6. **Alert** — Send Telegram notifications for medium+ severity findings with fatigue prevention
7. **Store** — Persist all results to PostgreSQL for historical tracking

### Trigger

Run on schedule via heartbeat (every 30 minutes) or cron:

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

- Never test vulnerabilities on mainnet — use testnets or local forks only
- Check Immunefi for existing bug bounty programs before contacting teams
- Follow responsible disclosure timelines (14-45 days for DeFi)
- Document all findings with timestamps and evidence hashes
