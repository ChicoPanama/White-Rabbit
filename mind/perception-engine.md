# Perception Engine — How Clawd Sees the Blockchain

## Data Ingestion Layers

### Layer 1: Contract Discovery
- **DeFiLlama API:** TVL, protocol metadata, chain coverage
- **Etherscan API:** Verified source code, ABI, deployment history
- **Block explorers:** Transaction patterns, admin activity

### Layer 2: Static Analysis
- **Slither:** 90+ vulnerability detectors, code patterns
- **Source code parsing:** Custom pattern matching
- **Dependency analysis:** Import chains, library usage

### Layer 3: Dynamic Context
- **Current state:** Storage slot values, balances
- **Historical state:** Past transactions, events
- **Mempool:** Pending transactions (MEV context)

### Layer 4: Ecosystem Context
- **Related protocols:** Composability risks
- **Token relationships:** Price dependencies
- **Governance:** Upgrade capabilities, admin keys

## Perception Priorities

### What to See First
1. **What does this contract control?** (Assets, permissions)
2. **Who can call sensitive functions?** (Access control)
3. **What external dependencies exist?** (Oracles, other contracts)
4. **What changed recently?** (New code, parameter updates)

### Priority Matrix
| Signal | Priority | Reason |
|--------|----------|--------|
| Unverified source | HIGH | Can't analyze, suspicious |
| <30 days old | HIGH | Not battle-tested |
| No audit | HIGH | Higher bug probability |
| Fork of hacked protocol | CRITICAL | Known vulnerability patterns |
| Admin key activity | MEDIUM | Potential rug indicators |

## Filtering Rules

### Skip (Low Value)
- Verified, audited contracts with no recent changes
- Well-known protocols with active security teams
- TVL < $10K (not worth the effort)

### Prioritize (High Value)
- New deployments (<30 days)
- Recent upgrades or parameter changes
- Unverified code
- Forks of previously exploited contracts
- TVL $10K-$1M (sweet spot)

### Flag for Deep Analysis
- Complex mathematical operations
- Cross-protocol interactions
- Unusual access patterns
- Admin functions with high privilege

## Integration with Pipeline

```
Perception → Hypothesis → Analysis → Verification → Alert
     ↓            ↓           ↓            ↓          ↓
 Discovery   Questions    Testing     PoC/Fork    Telegram
```

---
*Last Updated: 2026-01-30*
