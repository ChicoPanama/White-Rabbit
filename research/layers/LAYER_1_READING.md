# Layer 1 Reading List: Failure Modes & Attack Patterns

**Layer Question:** "How do systems break?"

---

## Core Materials (v1.0)

| Title | Source | Status | Key Takeaways |
|-------|--------|--------|---------------|
| **Smart Contract Security Field Guide** | scsfg.io | ✅ Downloaded | Reentrancy classes, access control patterns |
| **ConsenSys Best Practices** | ConsenSys | ✅ Downloaded | Known attacks catalog |
| **Solidity Patterns** | fravoll | ✅ Downloaded | Security patterns and anti-patterns |
| **Smart Contract Vulnerabilities** | kadenzipfel | ✅ Downloaded | Vulnerability taxonomy |
| **Ethernaut** | OpenZeppelin | ✅ Downloaded | Historical hack reproductions |

---

## Extended Materials (v1.1)

| Title | Author | Priority | Purpose | Status |
|-------|--------|----------|---------|--------|
| **Secure Programming in C and C++** | Robert Seacord | MEDIUM | Memory safety → State safety analogies | ⬜ Pending |
| **The Art of Exploitation** | Jon Erickson | HIGH | Attacker mindset, exploit conceptualization | ⬜ Pending |
| **Bug Bounty Playbook** | Various | HIGH | Pattern recognition frameworks | ⬜ Pending |

---

## Ingestion Status

**v1.0 Core:** ✅ Complete — All 5 resources downloaded and processed  
**v1.1 Extended:** ⬜ Pending — 3 books queued for auto-ingestion

---

## What to Extract (Per Ingestion Rule)

For each extended title:
1. **Core assumptions** — What patterns does the attacker/defender assume?
2. **Where assumptions fail** — Novel variations on known patterns
3. **Layer mapping** — Reinforces `INVARIANT_FAILURES.md` and `ATTACK_VECTOR_DATABASE.md`
4. **Pattern reinforcement** — Cross-domain pattern transfer to Solidity
5. **Audit gap** — Do auditors recognize these pattern families?

---

## Key Concepts to Capture

- Memory corruption patterns → State corruption analogies
- Exploit development methodology → Smart contract PoC methodology
- Bug bounty pattern recognition → DeFi vulnerability patterns
- Attacker mindset frameworks

---

## Cross-Layer Connections

- Layer 0: Primitives that enable these failures
- Layer 2: Why audits miss these patterns
- Layer 5: Historical examples of each pattern

---

*See `EXTENDED_READING_LIST_v1.1.md` for full extended library*
