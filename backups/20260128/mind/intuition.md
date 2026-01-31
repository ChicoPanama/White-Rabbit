# Intuition — Anomaly Detection and Gut-Check Scoring

## Core Principle

Beyond formal analysis, develop a "gut feeling" for suspicious code. Experienced auditors notice things that don't fit — unusual patterns, missing safeguards, over-complex logic, suspiciously simple implementations.

## Anomaly Indicators

### Code Smell Indicators (each adds to suspicion score)

| Indicator | Suspicion | Reasoning |
|-----------|-----------|-----------|
| No access control on sensitive function | +30 | Likely oversight |
| `selfdestruct` present | +25 | Rarely needed, often dangerous |
| Inline assembly | +20 | Bypasses Solidity safety, harder to audit |
| `delegatecall` to user input | +40 | Almost always exploitable |
| Unchecked math in financial calculations | +20 | Overflow/underflow risk |
| External call before state update | +35 | Classic reentrancy pattern |
| No events emitted on state changes | +15 | Suggests immature development |
| Hardcoded addresses | +10 | Inflexible, may be malicious |
| Unusually high complexity | +15 | More bugs hide in complex code |
| Missing zero-address checks | +10 | Common oversight |
| Token approval to arbitrary address | +30 | Potential drain vector |
| Block timestamp dependency for randomness | +25 | Miner-manipulable |

### Protocol-Level Indicators

| Indicator | Suspicion | Reasoning |
|-----------|-----------|-----------|
| No audit report | +25 | Unreviewed code is riskier |
| Audit > 12 months old | +15 | Code may have changed |
| Single admin key (no multisig) | +20 | Single point of failure |
| No timelock on admin functions | +20 | No time for users to exit |
| Proxy without upgrade delay | +25 | Can rug instantly |
| No emergency pause mechanism | +15 | Can't stop ongoing exploit |
| Fork with no meaningful changes | +10 | Often done by less experienced teams |

### Economic Indicators

| Indicator | Suspicion | Reasoning |
|-----------|-----------|-----------|
| TVL growing much faster than adoption | +15 | Possible ponzi dynamics |
| Extremely high APY (> 1000%) | +20 | Unsustainable, likely exploitable |
| Single asset pool dominance | +10 | Concentration risk |
| No liquidation mechanism in lending | +30 | Bad debt risk |
| Fixed price oracle | +35 | Price manipulation trivial |

## Gut-Check Scoring

For each contract, compute a **suspicion score** (0-100):

- **0-20:** Clean — standard patterns, audited, battle-tested
- **21-40:** Watchful — some minor concerns, worth a closer look
- **41-60:** Suspicious — multiple indicators, prioritize for deep analysis
- **61-80:** Alarming — high likelihood of vulnerability, PoC verification priority
- **81-100:** Critical — strong indicators of exploitable vulnerability

## Application

1. During initial scan, compute suspicion score
2. If score > 40, escalate to AI analysis
3. If score > 60, prioritize for PoC verification
4. Log suspicion scores for pattern learning
5. Track which indicators most correlate with real findings
