# Micro-Protocol Vulnerability Indicators

## What is a Micro-Protocol?
- TVL: $10K - $1M
- Team: Usually 1-5 developers
- Audits: Often none or minimal
- Response: Variable (can be fast or abandoned)

## Red Flags (High Vulnerability Probability)

### 1. Fork Without Modification Understanding
- Forked from well-known protocol
- Modified core functions without understanding implications
- **Detection:** Different function bodies, same interface

### 2. No Audit Badge
- No audit report linked
- No security section in docs
- No bug bounty program (or just launched one)

### 3. Rapid Deployment
- Contract deployed < 30 days ago
- Multiple redeployments (sign of bugs)
- Unverified source code on explorer

### 4. Single Developer Patterns
- All commits from one address
- No code review process visible
- Copy-paste code with original comments

### 5. Complexity Without Justification
- Complex tokenomics for simple use case
- Multiple proxy patterns
- Unusual upgrade mechanisms

## Green Flags (Lower Priority)
- Active security team
- Multiple audits from reputable firms
- Active bug bounty with fast response history
- Battle-tested code (> 1 year, high TVL)

## Hunting Strategy
1. Use DeFiLlama to filter by TVL range ($10K-$1M)
2. Check deployment date on explorer (<30 days = priority)
3. Look for audit reports (none = priority)
4. Check if it's a fork (compare bytecode)
5. **Prioritize:** Young + Unaudited + Fork of complex protocol

## High-Value Fork Patterns (from OSINT)

| Original | Vulnerability Pattern | Bounty Potential |
|----------|----------------------|------------------|
| Compound | Donation attack, exchange rate manipulation | $50K-500K |
| Aave | Flash loan logic errors | $100K-1M |
| Uniswap | Price manipulation, reentrancy | $50K-500K |
| Curve | Pool manipulation, admin abuse | $50K-200K |

## Targeting Success Rates
*Auto-updated from hunting results*

[To be populated by compoundLearning.ts]

---
*Last Updated: 2026-01-30*
