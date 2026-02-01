# Layer 4 Reading List: Systemic & Protocol-Level Failures

**Layer Question:** "How do failures cascade?"

---

## Core Materials (v1.0)

| Title | Source | Status | Key Takeaways |
|-------|--------|--------|---------------|
| **Bridge Hacks Review** | ArXiv/Chainlink | ✅ Downloaded | Cross-chain vulnerabilities |
| **Systemic Risk Literature** | ArXiv | ✅ Downloaded | Cascade mechanics, fire sales |
| **CAP Theorem Analysis** | Various | ✅ Downloaded | Liveness vs safety tradeoffs |
| **Distributed Systems Challenges** | AWS Builders | ✅ Downloaded | Network partition handling |
| **Data-Intensive Applications** | Martin Kleppmann | ✅ Downloaded | System design patterns |

---

## Extended Materials (v1.1)

| Title | Author | Priority | Purpose | Status |
|-------|--------|----------|---------|--------|
| **Complex Adaptive Systems** | Miller & Page | MEDIUM | Emergent behavior, systemic properties | ⬜ Pending |
| **Normal Accidents** | Charles Perrow | HIGH | Systemic failure inevitability | ⬜ Pending |
| **Release It!** | Michael Nygard | HIGH | Resilience patterns, production failures | ⬜ Pending |
| **Site Reliability Engineering** | Google | MEDIUM | Stress testing, reliability | ⬜ Pending |

---

## Ingestion Status

**v1.0 Core:** ✅ Complete — All 5 resources downloaded and processed  
**v1.1 Extended:** ⬜ Pending — 4 books queued for auto-ingestion

---

## What to Extract (Per Ingestion Rule)

For each extended title:
1. **Core assumptions** — What do protocols assume about systemic stability?
2. **Where assumptions fail** — Cascade triggers and failure propagation
3. **Layer mapping** — Reinforces `SYSTEMIC_FAILURES.md` and `CROSS_PROTOCOL_RISK.md`
4. **Pattern reinforcement** — Explains Pattern 3 (SPOF), Pattern 6 (Integration Blindness)
5. **Audit gap** — Why don't audits assess systemic risks?

---

## Key Concepts to Capture

- Normal accident theory → DeFi cascade failures
- Tight coupling vs. loose coupling → Composability risks
- Resilience patterns → Circuit breakers, graceful degradation
- Stress testing methodologies → DeFi stress test frameworks
- Incident response → Emergency procedures in protocols

---

## Pattern Connections

- **Pattern 3:** Single points of failure in systemic dependencies
- **Pattern 5:** Complexity hiding systemic risks
- **Pattern 6:** Integration blindness across protocol boundaries

---

*See `EXTENDED_READING_LIST_v1.1.md` for full extended library*
