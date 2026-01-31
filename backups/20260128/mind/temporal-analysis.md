# Temporal Analysis — Time-Dependent Vulnerability Patterns

## Core Principle

Vulnerability risk is not static. It changes with time, network conditions, market state, and protocol evolution. Understanding temporal patterns improves targeting accuracy.

## Time-Dependent Risk Factors

### 1. Deployment Age
- **New deployments (< 30 days):** Higher risk — less battle-tested, fewer eyes on code
- **Medium age (30-180 days):** Moderate risk — some testing, but may have undiscovered issues
- **Battle-tested (> 180 days, high TVL):** Lower risk — likely audited, many transactions

### 2. Upgrade Recency
- Contracts upgraded recently may have introduced new bugs
- Proxy patterns (UUPS, Transparent) add complexity
- Check implementation vs proxy deployment dates

### 3. Market Conditions
- **High volatility:** Oracle manipulation attacks more profitable
- **Low liquidity:** Price manipulation easier
- **High gas:** Some attacks become unprofitable
- **Flash loan availability:** Reduces capital requirements for attacks

### 4. Protocol Lifecycle Events
- **Pre-audit:** Highest vulnerability risk
- **Post-audit, pre-fix:** Known issues may not be patched yet
- **Post-hack of similar protocol:** Copycats and forks at high risk
- **Governance transition:** Access control vulnerabilities more likely

### 5. EVM Evolution
- **Pre-Shanghai:** May assume different gas mechanics
- **Pre-Merge:** May assume PoW properties
- **New opcodes:** Contracts not updated for new capabilities

## Temporal Scanning Strategy

### Daily Priorities
1. **Morning:** Check hack news, scan affected protocols and forks
2. **Midday:** Continue TVL-ranked scanning from previous cycle
3. **Evening:** Review findings, update patterns, plan next day

### Weekly Cycle
- **Monday:** Deep analysis of previous week's findings
- **Tuesday-Thursday:** Active scanning, highest TVL chains
- **Friday:** Fork hunting, pattern propagation
- **Weekend:** Lower-tier chains, pattern refinement

### Monthly Cycle
- **Week 1:** Full TVL sweep across all chains
- **Week 2:** Focus on new deployments and upgrades
- **Week 3:** Deep-dive on specific vulnerability classes
- **Week 4:** Self-evolution, pattern accuracy review, strategy adjustment

## Temporal Indicators to Track

- Time since last contract upgrade
- Time since protocol's last audit
- Days since similar protocols were hacked
- Market volatility (ETH price movement)
- New protocol launches on each chain
