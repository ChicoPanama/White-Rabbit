# Layer 0 Reading List: Foundational Primitives

**Layer Question:** "What primitives must we trust?"

---

## Core Materials (v1.0)

| Title | Author | Status | Key Takeaways |
|-------|--------|--------|---------------|
| **Mastering Bitcoin** | Andreas Antonopoulos | ✅ Downloaded | Consensus, scripting, UTXO model |
| **Mastering Ethereum** | Andreas Antonopoulos | ✅ Downloaded | EVM, accounts, smart contracts |
| **Princeton Bitcoin Book** | Narayanan et al. | ✅ Downloaded | Academic foundations, proof-of-work |

---

## Extended Materials (v1.1)

| Title | Author | Priority | Purpose | Status |
|-------|--------|----------|---------|--------|
| **Security Engineering** | Ross Anderson | HIGH | Threat modeling, crypto assumptions | ⬜ Pending |
| **Applied Cryptography** | Bruce Schneier | HIGH | Cryptographic primitives, attack vectors | ⬜ Pending |
| **Introduction to Modern Cryptography** | Katz & Lindell | MEDIUM | Formal crypto, provable security | ⬜ Pending |
| **The Architecture of Open Source Applications** | Various | MEDIUM | Real-world system design | ⬜ Pending |

---

## Ingestion Status

**v1.0 Core:** ✅ Complete — All 3 books downloaded and processed  
**v1.1 Extended:** ⬜ Pending — 4 books queued for auto-ingestion

---

## What to Extract (Per Ingestion Rule)

For each extended title:
1. **Core assumptions** — What crypto/systems assumptions does it make?
2. **Where assumptions fail** — When do those assumptions break in practice?
3. **Layer mapping** — Reinforces `FOUNDATION_PRIMITIVES.md` and `TRUST_ASSUMPTIONS.md`
4. **Pattern reinforcement** — How do failures map to 8 Recurring Failure Patterns?
5. **Audit gap** — Do traditional audits assess these assumptions?

---

## Key Concepts to Capture

- Threat modeling frameworks (STRIDE, attack trees)
- Cryptographic assumption failures (when theory meets reality)
- Engineering tradeoffs that become vulnerabilities
- Open source security lessons

---

*See `EXTENDED_READING_LIST_v1.1.md` for full extended library*
