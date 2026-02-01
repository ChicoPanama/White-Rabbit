# Layer 2 Reading List: Specification & Audit Blind Spots

**Layer Question:** "Why were these failures missed?"

---

## Core Materials (v1.0)

| Title | Source | Status | Key Takeaways |
|-------|--------|--------|---------------|
| **Software Abstractions** | Daniel Jackson | ✅ Downloaded | Conceptual modeling, specification theory |
| **Z3 Theorem Prover** | Microsoft | ✅ Downloaded | Formal verification capabilities |
| **Halmos** | a16z | ✅ Downloaded | Symbolic testing, bounded model checking |
| **Slither** | Trail of Bits | ✅ Downloaded | Static analysis detector limitations |
| **Mythril** | ConsenSys | ✅ Downloaded | Symbolic execution boundaries |

---

## Extended Materials (v1.1)

| Title | Author | Priority | Purpose | Status |
|-------|--------|----------|---------|--------|
| **The Design of Everyday Things** | Don Norman | MEDIUM | Cognitive bias in design | ⬜ Pending |
| **Thinking, Fast and Slow** | Daniel Kahneman | HIGH | Dual-process theory, cognitive bias | ⬜ Pending |
| **Human Error** | James Reason | HIGH | Error taxonomy, Swiss Cheese Model | ⬜ Pending |
| **How Complex Systems Fail** | Richard Cook | HIGH | Systemic review failures | ⬜ Pending |

---

## Ingestion Status

**v1.0 Core:** ✅ Complete — All 5 tools/books downloaded and processed  
**v1.1 Extended:** ⬜ Pending — 4 books queued for auto-ingestion

---

## What to Extract (Per Ingestion Rule)

For each extended title:
1. **Core assumptions** — What do auditors/reviewers assume about their own process?
2. **Where assumptions fail** — Cognitive biases and systematic blind spots
3. **Layer mapping** — Reinforces `WHY_AUDITS_MISS_THINGS.md` and `SPECIFICATION_GAPS.md`
4. **Pattern reinforcement** — Explains Pattern 7 (Audit Theater) psychologically
5. **Audit gap** — Meta: why don't audits account for cognitive bias?

---

## Key Concepts to Capture

- Cognitive biases in code review (confirmation bias, anchoring)
- Error taxonomies applicable to audit failures
- Swiss Cheese Model → Defense-in-depth failures
- "Normal accidents" → Complex protocol failures
- Fast vs. slow thinking in security assessment

---

## Special Focus: Pattern 7 (Audit Theater)

These materials explain *why* Pattern 7 exists:
- **Thinking, Fast and Slow** → Fast thinking in checklist audits
- **Human Error** → Systematic error types in review processes
- **How Complex Systems Fail** → Why complex protocols defy audit

---

*See `EXTENDED_READING_LIST_v1.1.md` for full extended library*
