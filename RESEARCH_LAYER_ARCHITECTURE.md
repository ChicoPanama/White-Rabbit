# OpenClawd Research Mode — Canonical Layer Architecture

**Status:** 🔒 IMMUTABLE — Canonical Structure  
**Version:** v1.0  
**Owner:** Chico  
**Effective:** 2026-02-01

---

This is the permanent structure Research Mode operates within. Books, papers, audits are inputs later — layers are the reasoning engine.

---

## 🔒 LAYER 0 — FOUNDATIONAL PRIMITIVES

**Question this layer answers:** "How is the system supposed to work?"

### Purpose
Establish correct mental models before studying failures. This layer prevents:
- Cargo-cult security thinking
- Misunderstanding of trust boundaries
- Misattributing failures to "bugs" that are actually design assumptions

### Scope
- Consensus basics
- State vs computation
- Transaction lifecycle
- Trust assumptions
- Cryptographic primitives at a conceptual level

### Outputs (stored knowledge)
- Protocol invariants (what must always be true)
- Explicit trust assumptions
- System boundaries

### Memory Artifacts
- `FOUNDATION_PRIMITIVES.md`
- `TRUST_ASSUMPTIONS.md`

⛔ No vulnerabilities  
⛔ No attacks  
⛔ No "security" yet — only how things work

---

## 🧱 LAYER 1 — FAILURE MODES & ATTACK PATTERNS

**Question this layer answers:** "How do systems break?"

### Purpose
Catalog recurring ways designs fail, independent of any single protocol. This is the core pattern layer.

### Scope
- Logical failure modes
- State transition errors
- Access control breakdowns
- Dependency failures
- Upgrade & initialization hazards

### Outputs
- Abstract vulnerability patterns
- Failure taxonomies
- False-positive signatures
- Pattern families (not instances)

### Memory Artifacts
- `ATTACK_VECTOR_DATABASE.md`
- `INVARIANT_FAILURES.md`
- `FALSE_POSITIVE_SIGNATURES.md`

⛔ No exploit steps  
⛔ No live systems  
✅ Pure abstraction

---

## 🧠 LAYER 2 — SPECIFICATION & AUDIT BLIND SPOTS

**Question this layer answers:** "Why were these failures missed?"

### Purpose
Explain human and methodological failure, not technical failure. This is what separates research from tool usage.

### Scope
- Ambiguous specifications
- Missing invariants
- Audit scope limitations
- Assumption mismatches
- Tooling blind spots

### Outputs
- Audit failure explanations
- Spec gap categories
- "Looks safe but isn't" patterns

### Memory Artifacts
- `SPECIFICATION_GAPS.md`
- `WHY_AUDITS_MISS_THINGS.md`

This layer explains audit errors, not bugs.

---

## 💰 LAYER 3 — ECONOMIC & GAME-THEORETIC FAILURES

**Question this layer answers:** "What if the code is correct but incentives are not?"

### Purpose
Capture non-code attacks that emerge from rational adversaries. This layer prevents:
- "Code-only" thinking
- Ignoring MEV, manipulation, griefing
- Underestimating rational adversaries

### Scope
- Oracle manipulation
- Liquidity exploitation
- MEV dynamics
- Griefing and denial economics
- Incentive misalignment

### Outputs
- Economic attack archetypes
- Incentive mismatch patterns
- Non-bug exploit classes

### Memory Artifacts
- `ECONOMIC_ATTACKS.md`
- `INCENTIVE_MISALIGNMENT_PATTERNS.md`

⛔ No simulations  
⛔ No PoCs  
✅ Strategic reasoning only

---

## 🌐 LAYER 4 — SYSTEMIC & PROTOCOL-LEVEL FAILURES

**Question this layer answers:** "Why do entire systems collapse?"

### Purpose
Understand failures that arise from composition, scale, or coordination. This layer looks above individual contracts.

### Scope
- Cross-protocol assumptions
- Bridge failures
- Liveness vs safety tradeoffs
- Dependency chains
- Composability risk

### Outputs
- Systemic failure models
- Cross-protocol risk patterns
- Cascade scenarios (abstract)

### Memory Artifacts
- `SYSTEMIC_FAILURES.md`
- `CROSS_PROTOCOL_RISK.md`

⛔ No chain state  
⛔ No live analysis  
✅ Architecture-only reasoning

---

## 🧾 LAYER 5 — HISTORICAL CORRELATION & POST-MORTEMS

**Question this layer answers:** "Where has this happened before?"

### Purpose
Ground theory in real-world recurrence, without operational detail. This layer feeds backward into all others.

### Scope
- Post-mortems
- Incident timelines
- "Known but repeated" failures
- Audit vs outcome deltas

### Outputs
- Recurring failure motifs
- Missed warning signs
- Pattern reinforcement

### Memory Artifacts
- `HISTORICAL_EXPLOITS.md`
- `RECURRING_FAILURE_PATTERNS.md`

⛔ No exploit code  
⛔ No tactical detail  
✅ Pattern reinforcement only

---

## 🔁 How The Layers Interact (IMPORTANT)

```
Layer 0 → defines expectations
Layer 1 → shows how expectations fail
Layer 2 → explains why failures weren't caught
Layer 3 → captures rational exploitation
Layer 4 → explains large-scale collapse
Layer 5 → validates everything historically
```

This creates **closed-loop learning**.

---

## 🔒 Final Lock-In Statement

These layers define how OpenClawd thinks in Research Mode. Books and papers are merely inputs mapped onto this structure.

**The structure itself does not change.**

---

*Immutable as of 2026-02-01.*
