# OpenClawd Research Mode — Layer Architecture Index

**Status:** 🔒 Immutable Canonical Structure  
**Version:** v1.0  
**Effective:** 2026-02-01

---

## Layer Structure Overview

```
Layer 0: FOUNDATIONAL PRIMITIVES
    ↓ defines expectations
Layer 1: FAILURE MODES & ATTACK PATTERNS
    ↓ shows how expectations fail
Layer 2: SPECIFICATION & AUDIT BLIND SPOTS
    ↓ explains why failures weren't caught
Layer 3: ECONOMIC & GAME-THEORETIC FAILURES
    ↓ captures rational exploitation
Layer 4: SYSTEMIC & PROTOCOL-LEVEL FAILURES
    ↓ explains large-scale collapse
Layer 5: HISTORICAL CORRELATION & POST-MORTEMS
    ↓ validates everything historically
```

---

## Layer 0 — Foundational Primitives

**Question:** "How is the system supposed to work?"

**Purpose:** Establish correct mental models before studying failures.

### Artifacts:
- [FOUNDATION_PRIMITIVES.md](layers/FOUNDATION_PRIMITIVES.md)
  - Consensus basics
  - State vs computation
  - Transaction lifecycle
  - Trust assumptions
  - Cryptographic primitives
  
- [TRUST_ASSUMPTIONS.md](layers/TRUST_ASSUMPTIONS.md)
  - Consensus layer trust
  - Cryptographic trust
  - Protocol layer trust
  - Application layer trust
  - Economic trust
  - Composability trust

**Constraints:**
- ⛔ No vulnerabilities
- ⛔ No attacks
- ✅ Only how things work

---

## Layer 1 — Failure Modes & Attack Patterns

**Question:** "How do systems break?"

**Purpose:** Catalog recurring ways designs fail, independent of any single protocol.

### Artifacts:
- [INVARIANT_FAILURES.md](layers/INVARIANT_FAILURES.md)
  - State transition violations
  - Arithmetic violations
  - Access control failures
  - Oracle & external data failures
  - Upgrade & initialization failures
  - Logic & business rule failures

- [FALSE_POSITIVE_SIGNATURES.md](layers/FALSE_POSITIVE_SIGNATURES.md)
  - Compiler artifacts (SELFDESTRUCT, DELEGATECALL)
  - Design pattern confusion
  - Tool limitations
  - Context misunderstanding
  - Economic false positives

**Constraints:**
- ⛔ No exploit steps
- ⛔ No live systems
- ✅ Pure abstraction

---

## Layer 2 — Specification & Audit Blind Spots

**Question:** "Why were these failures missed?"

**Purpose:** Explain human and methodological failure, not technical failure.

### Artifacts:
- [SPECIFICATION_GAPS.md](layers/SPECIFICATION_GAPS.md)
  - Ambiguous specifications
  - Missing invariants
  - Integration blind spots
  - Operational gaps

- [WHY_AUDITS_MISS_THINGS.md](layers/WHY_AUDITS_MISS_THINGS.md)
  - Methodology limitations (time, scope, tools)
  - Human factors (bias, fatigue, communication)
  - Structural blind spots (economic, composability, temporal)
  - Quantstamp-specific insights

**Constraints:**
- This layer explains audit errors, not bugs

---

## Layer 3 — Economic & Game-Theoretic Failures

**Question:** "What if the code is correct but incentives are not?"

**Purpose:** Capture non-code attacks that emerge from rational adversaries.

### Artifacts:
- [ECONOMIC_ATTACKS.md](layers/ECONOMIC_ATTACKS.md)
  - Oracle manipulation
  - Flash loan attacks
  - MEV extraction
  - Liquidity exploitation
  - Griefing attacks

- [INCENTIVE_MISALIGNMENT_PATTERNS.md](layers/INCENTIVE_MISALIGNMENT_PATTERNS.md)
  - Principal-agent problems
  - Commons problems
  - Information asymmetry
  - Time inconsistency
  - Adverse selection
  - Multi-party coordination failures

**Constraints:**
- ⛔ No simulations
- ⛔ No PoCs
- ✅ Strategic reasoning only

---

## Layer 4 — Systemic & Protocol-Level Failures

**Question:** "Why do entire systems collapse?"

**Purpose:** Understand failures that arise from composition, scale, or coordination.

### Artifacts:
- [SYSTEMIC_FAILURES.md](layers/SYSTEMIC_FAILURES.md)
  - Cascade failures
  - Composability risk
  - Bridge failures
  - Liveness vs safety tradeoffs
  - Dependency chain collapse
  - Governance systemic risk

- [CROSS_PROTOCOL_RISK.md](layers/CROSS_PROTOCOL_RISK.md)
  - Shared collateral risk
  - Liquidation cascades
  - Oracle correlation
  - Bridge systemic risk
  - Yield source correlation
  - Governance cross-contamination

**Constraints:**
- ⛔ No chain state
- ⛔ No live analysis
- ✅ Architecture-only reasoning

---

## Layer 5 — Historical Correlation & Post-Mortems

**Question:** "Where has this happened before?"

**Purpose:** Ground theory in real-world recurrence, without operational detail.

### Artifacts:
- [HISTORICAL_EXPLOITS.md](layers/HISTORICAL_EXPLOITS.md)
  - Reentrancy attacks (The DAO, Cream)
  - Oracle manipulation (Mango, Venus)
  - Flash loan attacks (Cream, Beanstalk)
  - Access control failures (Parity, Ronin)
  - Economic/logic exploits (Poly, Nomad)
  - Integer/math exploits

- [RECURRING_FAILURE_PATTERNS.md](layers/RECURRING_FAILURE_PATTERNS.md)
  - Trust but don't verify
  - Update order matters
  - Single point of failure
  - Economic assumptions don't hold
  - Complexity hides bugs
  - Integration blindness
  - Audit theater
  - Governance capture

**Constraints:**
- ⛔ No exploit code
- ⛔ No tactical detail
- ✅ Pattern reinforcement only

---

## Layer Interactions

### Closed-Loop Learning:
```
Layer 0 defines expectations
    ↓
Layer 1 shows how expectations fail
    ↓
Layer 2 explains why failures weren't caught
    ↓
Layer 3 captures rational exploitation
    ↓
Layer 4 explains large-scale collapse
    ↓
Layer 5 validates everything historically
    ↓
[Feedback to Layer 0 for updated mental models]
```

### Research Mode Flow:
1. **Ingest** source material (audit, paper, exploit)
2. **Parse** findings and claims
3. **Classify** severity and relevance
4. **Extract** generalized patterns
5. **Cross-reference** with historical exploits (Layer 5)
6. **Document** blind spots and lessons learned

---

## Usage Guidelines

### When Researching Audits:
- Map findings to Layer 1 patterns
- Identify specification gaps (Layer 2)
- Assess economic implications (Layer 3)
- Check systemic impact (Layer 4)
- Correlate with history (Layer 5)

### When Learning New Protocols:
- Start with Layer 0 (understand design)
- Apply Layer 1 (find failure modes)
- Use Layer 2 (identify blind spots)
- Test with Layer 3 (economic attacks)
- Assess with Layer 4 (systemic risk)
- Validate with Layer 5 (historical precedents)

### When Documenting Findings:
- Store abstract patterns in appropriate layer files
- Index to ATTACK_VECTOR_DATABASE.md (Layer 1)
- Log methodology insights in memory files (Layer 2)
- Update historical correlations (Layer 5)

---

## File Structure

```
research/
├── layers/
│   ├── FOUNDATION_PRIMITIVES.md           (Layer 0)
│   ├── TRUST_ASSUMPTIONS.md               (Layer 0)
│   ├── INVARIANT_FAILURES.md              (Layer 1)
│   ├── FALSE_POSITIVE_SIGNATURES.md       (Layer 1)
│   ├── SPECIFICATION_GAPS.md              (Layer 2)
│   ├── WHY_AUDITS_MISS_THINGS.md          (Layer 2)
│   ├── ECONOMIC_ATTACKS.md                (Layer 3)
│   ├── INCENTIVE_MISALIGNMENT_PATTERNS.md (Layer 3)
│   ├── SYSTEMIC_FAILURES.md               (Layer 4)
│   ├── CROSS_PROTOCOL_RISK.md             (Layer 4)
│   ├── HISTORICAL_EXPLOITS.md             (Layer 5)
│   └── RECURRING_FAILURE_PATTERNS.md      (Layer 5)
├── quantstamp-library/
│   └── [18 audit reports]
├── COMMAND_SPEC.md
└── INDEX.md                               (this file)
```

---

## Immutability

This layer structure is canonical. Books, papers, and audits are inputs mapped onto this framework.

**The structure itself does not change.**

New versions require explicit RESEARCH_LAYER_ARCHITECTURE_v2.md with owner acknowledgment.

---

*Research Mode: Structured knowledge extraction without execution.*
