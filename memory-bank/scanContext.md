# Scan Context — Current Hunting State

## Active Targets

| Protocol | Chain | TVL | Priority | Status | Last Scanned |
|----------|-------|-----|----------|--------|--------------|
| - | - | - | - | - | - |

## Target Queue
*Protocols pending scan*

1. Base micro-protocols ($10K-$1M TVL) - Next priority
2. Arbitrum fork protocols - Secondary

## Recently Completed

| Protocol | Chain | Result | Findings | Date |
|----------|-------|--------|----------|------|
| SSV Network | Ethereum | DoS Vuln Found | 1 verified | 2026-01-30 |

## Chain Coverage
- Ethereum: Active (via Etherscan API)
- Base: Active (via Basescan API)
- Arbitrum: Active (via Arbiscan API)
- BSC: Available
- Polygon: Available
- Optimism: Available

## Targeting Strategy
**Current focus:** Micro-protocols on Base with TVL $10K-$1M

### Why This Strategy
- Lower competition from other researchers
- Faster response times from smaller teams
- Higher probability of unaudited code
- Proven pattern: Fresh deployments have more bugs

### High-Value Protocol Indicators
From OSINT research (2026-01-28):
- **Radiant Capital patterns:** $57.5M losses - flashloan formula manipulation
- **Hundred Finance patterns:** $7.4M Compound fork - hToken donation attack
- **Moonwell patterns:** $1M+ oracle manipulation - 30-second exploit window

## Hunt Statistics (from hunting-log.json)
- Check `~/clawd/hunting-log.json` for current stats
- Check `~/clawd/memory/` for daily hunt logs

---
*Last Updated: 2026-01-30T22:40:00Z*
