# OpenClawd Research Library — Canonical Structure

**Status:** 🔒 Immutable  
**Version:** v1.0  
**Effective:** 2026-02-01

---

## Core Principle

OpenClawd does not read "books" linearly. Instead, it builds:
1. Mental primitives (Layer 0)
2. Attack patterns (Layer 1)
3. Economic & systemic failures (Layers 2-4)
4. Methodology blind spots (Layer 2)
5. Historical validation (Layer 5)

Each layer feeds the next.

---

## 🔒 LAYER 0 — FOUNDATIONAL PRIMITIVES (NON-NEGOTIABLE)

**Question:** "How do systems actually work?"

**Purpose:** Give OpenClawd a correct mental model so later failures make sense.

### Source Material

#### Book 1: Mastering Bitcoin — Andreas Antonopoulos
**Why:** The canonical introduction to blockchain mechanics

**Extract:**
- Transaction structure and validation
- UTXO model fundamentals
- Proof-of-Work consensus
- Mining and block production
- Script basics
- Network propagation

**Maps to:**
- FOUNDATION_PRIMITIVES.md (consensus, tx lifecycle)
- TRUST_ASSUMPTIONS.md (economic security assumptions)

---

#### Book 2: Mastering Ethereum — Antonopoulos & Wood
**Why:** Essential for EVM understanding

**Extract:**
- Account model vs UTXO
- Smart contract execution
- Gas and metering
- EVM architecture
- State storage
- Contract lifecycle

**Maps to:**
- FOUNDATION_PRIMITIVES.md (state vs computation, tx lifecycle)
- TRUST_ASSUMPTIONS.md (protocol layer trust)

---

#### Book 3: Bitcoin and Cryptocurrency Technologies — Narayanan et al.
**Why:** Academic rigor on cryptographic foundations

**Extract:**
- Cryptographic primitives in depth
- Consensus mechanisms formally
- Distributed systems basics
- Security models
- Anonymity and privacy

**Maps to:**
- FOUNDATION_PRIMITIVES.md (cryptographic primitives)
- TRUST_ASSUMPTIONS.md (cryptographic trust)

---

### Layer 0 Memory Artifacts

**Created/Updated:**
- `research/layers/FOUNDATION_PRIMITIVES.md`
- `research/layers/TRUST_ASSUMPTIONS.md`

**Content:**
- Protocol invariants
- Explicit trust assumptions
- System boundaries
- State transition models

---

## ⛔ LAYER 0 CONSTRAINTS

- **No vulnerabilities yet**
- **No attacks**
- **Only how systems are supposed to work**

**This is prerequisite knowledge.** Without Layer 0, later patterns are misunderstood.

---

## Extraction Methodology

### For Each Source:

1. **Read for primitives, not details**
   - Skip implementation trivia
   - Focus on fundamental concepts
   - Extract mental models

2. **Map to existing layer artifacts**
   - Does this reinforce FOUNDATION_PRIMITIVES?
   - Does it clarify TRUST_ASSUMPTIONS?
   - Update artifacts with new insights

3. **Cross-reference with later layers**
   - Note: "This assumption is violated in Layer X"
   - Don't solve yet, just bookmark

4. **Validate with history**
   - Does this match what we know from HISTORICAL_EXPLOITS?
   - Update primitives if history contradicts

---

## Layer Completion Criteria

Layer 0 is complete when OpenClawd can:
- [ ] Explain transaction lifecycle from mempool to finality
- [ ] Describe state vs computation separation
- [ ] List all trust assumptions by layer
- [ ] Draw system boundaries
- [ ] Answer: "What must be true for security to hold?"

---

*Layer 0 is the foundation. Everything else builds on it.*
