# Hypothesis Engine — Hypothesis-Driven Hunting

## Core Principle

Don't just scan blindly. Form hypotheses about where vulnerabilities are likely to exist, then test them systematically.

## Hypothesis Categories

### 1. Fork Hypotheses
**Template:** "If Protocol X was exploited via [technique], then forks of X on [chains] are likely vulnerable to the same attack."

**Testing:**
1. Identify the vulnerable code pattern
2. Generate contract fingerprint
3. Search all chains for matching contracts
4. Verify each match has exploitable value
5. Confirm vulnerability with PoC

### 2. Temporal Hypotheses
**Template:** "Contracts deployed [before/after] [date/event] are more likely to have [vulnerability] because [reason]."

**Examples:**
- Pre-EIP-1559 contracts may have gas-related issues
- Pre-Merge contracts may assume PoW block properties
- Contracts deployed before major audit findings may have the same bug

### 3. Pattern Hypotheses
**Template:** "Contracts using [pattern/library/architecture] are likely vulnerable to [attack] because [reason]."

**Examples:**
- Contracts using Chainlink without staleness checks → oracle manipulation
- Contracts with external calls before state updates → reentrancy
- Contracts using `transfer()` with gas stipend assumptions → broken after gas repricing

### 4. Economic Hypotheses
**Template:** "Protocol X has [economic property] that makes [attack] profitable when [condition]."

**Examples:**
- Lending protocol with low liquidation threshold → can be profitably attacked via oracle manipulation
- DEX with concentrated liquidity → vulnerable to JIT liquidity attacks
- Yield aggregator composing multiple protocols → cascading liquidation risk

### 5. Governance Hypotheses
**Template:** "Protocol X has [governance weakness] that allows [attack] by [accumulating tokens/exploiting voting]."

## Hypothesis Lifecycle

1. **Generate** — Form hypothesis from hack news, scan results, or pattern analysis
2. **Prioritize** — Rank by expected exploitable value and confidence
3. **Test** — Run targeted scans to validate or refute
4. **Record** — Document outcome in hunting log
5. **Learn** — Update patterns based on results
6. **Propagate** — If validated, search for similar instances

## Active Hypotheses

Store active hypotheses in `~/clawd/mind/hypotheses/`. Each hypothesis file:

```markdown
# Hypothesis: [Title]
- Status: active|validated|refuted|investigating
- Confidence: high|medium|low
- Expected value: $X
- Generated: [date]
- Source: [hack news|scan result|pattern analysis]

## Description
[What you expect to find and why]

## Test Plan
[How to validate or refute]

## Results
[Outcomes of testing]

## Conclusions
[What was learned]
```
