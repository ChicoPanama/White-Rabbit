# Layer 2: Specification Gaps

**Layer Question:** "Why were these failures missed?"

---

## Core Concept

Most vulnerabilities aren't coding errors — they're specification failures. The code correctly implements a flawed design.

---

## Category 1: Ambiguous Specifications

### Gap: Undefined Edge Cases
**Problem:** Specification doesn't define behavior at boundary conditions.

**Manifestation:**
- Zero input handling
- Empty array operations
- Minimum/maximum value behaviors
- First/last user in system

**Example:**
- "Users can withdraw their deposits" — but what if deposit is 0?
- "Calculate pro-rata rewards" — but what if total staked is 0?

**Why Audits Miss:**
- Focus on "normal" paths
- Edge cases seem "obvious"
- Specification assumes happy path

**Detection:**
- Look for division operations (division by zero)
- Array access without length checks
- Math operations at extremes

---

### Gap: Implicit State Assumptions
**Problem:** Specification assumes state transitions happen in specific order.

**Manifestation:**
- "User must deposit before withdrawing" — but what if they try to withdraw 0?
- "Rewards accrue over time" — but what if time doesn't advance?

**Why Audits Miss:**
- Linear thinking (A→B→C)
- Missing state machine analysis
- Not considering out-of-order calls

**Detection:**
- Multi-step user flows
- State-dependent access control
- Time-dependent logic

---

### Gap: Unclear Trust Boundaries
**Problem:** Specification doesn't define who is trusted for what.

**Manifestation:**
- Admin functions without timelocks
- Oracle updates without validation
- Upgrade rights unclear

**Why Audits Miss:**
- Assumes honest operators
- Doesn't question trust model
- Focuses on code, not governance

**Detection:**
- Privileged roles
- External dependencies
- Upgrade mechanisms

---

## Category 2: Missing Invariants

### Gap: Unstated Economic Assumptions
**Problem:** Economic security properties never explicitly defined.

**Manifestation:**
- "Collateral ratio > 150%" — but doesn't specify what happens at 149%
- "Liquidation bonus" — but doesn't bound it

**Why Audits Miss:**
- Assumes markets are efficient
- Doesn't model adversarial economics
- Focuses on code correctness

**Example from Quantstamp Reports:**
- API3 OEVA-4: "Auctioneer has no economic incentive to behave honestly"
- Acknowledged but not fixed — economic gap

---

### Gap: Implicit System Properties
**Problem:** System assumes properties that aren't enforced.

**Manifestation:**
- "Token price reflects market value" — assumes manipulation-resistant oracle
- "Users act rationally" — assumes no griefing attacks

**Why Audits Miss:**
- Outside scope of code review
- Requires economic modeling
- Assumed as external guarantee

**Detection:**
- Oracle dependencies
- Economic mechanisms
- Game-theoretic properties

---

### Gap: Time-Based Assumptions
**Problem:** System behavior assumes specific timing that isn't guaranteed.

**Manifestation:**
- "Price updates every block" — but what if oracle stops?
- "Withdrawal delay for security" — but what if delay is bypassed?

**Why Audits Miss:**
- Assumes liveness
- Doesn't model failure modes
- Treats time as continuous

**Example:**
- API3 OEVA-1: 15-second oracle delay acknowledged as risk
- Impact on liquidations not fully assessed

---

## Category 3: Integration Blind Spots

### Gap: Cross-Contract Interactions
**Problem:** Specification focuses on individual contracts, not their interaction.

**Manifestation:**
- Reentrancy between protocol contracts
- State inconsistency across upgrades
- Race conditions in multi-contract calls

**Why Audits Miss:**
- Audit scope per-contract
- Doesn't model full system
- Assumes isolation

**Example from Quantstamp Reports:**
- LUKSO QSP-7: Reentrancy acknowledged across 6 critical functions
- Cross-contract reentrancy not fully assessed

---

### Gap: External Dependency Behavior
**Problem:** Specification assumes external contracts behave correctly.

**Manifestation:**
- ERC-20 tokens with callbacks (ERC-777)
- Oracles with pause mechanisms
- Governance tokens with flash minting

**Why Audits Miss:**
- Assumes standard behavior
- Doesn't consider malicious implementations
- Outside audit scope

**Detection:**
- Token standard compliance checks
- External call validations
- Callback handling

---

## Category 4: Operational Gaps

### Gap: Upgrade Path Risks
**Problem:** Specification covers current version, not upgrade risks.

**Manifestation:**
- Storage layout changes
- Initialization of new implementations
- Migration edge cases

**Why Audits Miss:**
- Audit snapshot is point-in-time
- Future changes out of scope
- Assumes safe upgrade process

**Example:**
- Multiple protocols exploited post-audit via upgrades

---

### Gap: Emergency Procedure Gaps
**Problem:** Specification has "emergency stop" but doesn't define "emergency."

**Manifestation:**
- Pause mechanism without unpause conditions
- Emergency upgrades without multisig requirements
- Fund recovery mechanisms undefined

**Why Audits Miss:**
- "Administrative" functions deprioritized
- Assumes honest operators
- Focus on normal operation

---

## Specification Gap Detection Framework

### Questions to Ask:
1. What is NOT specified that should be?
2. What does "obviously" happen that isn't enforced?
3. What external guarantees are assumed?
4. What order of operations is required but not validated?
5. What economic properties must hold?

### Documentation Pattern:
```
SPECIFICATION GAP IDENTIFIED
- Location: [Function/Contract]
- Missing: [What should be specified]
- Current Behavior: [What code does]
- Required Behavior: [What should happen]
- Risk: [What could go wrong]
```

---

*Specification gaps are the root cause of most high-impact vulnerabilities.*
