# Layer 3 Reading List — Economic & Game-Theoretic Failures

**Research Mode | OpenClawd WhiteRabbit**  
**Status:** ✅ Complete  
**Last Updated:** 2026-02-01

---

## Layer 3 Overview

**Question:** "What if the code is correct but incentives are not?"

**Purpose:** Capture non-code attacks that emerge from rational adversaries.

**Target Artifacts:**
- ✅ `ECONOMIC_ATTACKS.md` — Active exploitation patterns
- ✅ `INCENTIVE_MISALIGNMENT_PATTERNS.md` — Design-level incentive failures

---

## Primary Sources

### Oracle Manipulation & Price Attacks

**1. Cyfrin — "The Full Guide to Price Oracle Manipulation Attacks"**
- **URL:** https://www.cyfrin.io/blog/price-oracle-manipulation-attacks-with-examples
- **Key Topics:**
  - Flash loan price manipulation mechanics
  - DEX spot price vulnerabilities
  - TWAP oracle limitations
  - Mango Markets $117M case study
  - Prevention strategies
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 1)
- **Extraction Quality:** High — detailed attack flows and code examples

**2. CertiK — "Oracle Wars: The Rise of Price Manipulation Attacks"**
- **URL:** https://www.certik.com/resources/blog/oracle-wars-the-rise-of-price-manipulation-attacks
- **Key Topics:**
  - $403.2M losses in 2022 from oracle attacks
  - Oracle types and manipulation risk ranking
  - Flash loan attack patterns
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 1)
- **Extraction Quality:** High — statistical impact data

**3. CoinDesk — "Flash Loans Aren't the Problem, Centralized Price Oracles Are"**
- **URL:** https://www.coindesk.com/tech/2020/11/11/flash-loans-arent-the-problem-centralized-price-oracles-are
- **Key Topics:**
  - Centralized exchange oracle risks
  - Flash loan mechanics
  - Price feed manipulation
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 1.2)
- **Extraction Quality:** Medium — conceptual framework

---

### MEV & Market Manipulation

**4. CoW DAO — "Understanding MEV Attacks"**
- **URL:** https://cow.fi/learn/mev-attacks-explained
- **Key Topics:**
  - Sandwich attack mechanics
  - Frontrunning and backrunning
  - MEV extraction optimization
  - Profit calculations
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 2)
- **Extraction Quality:** High — clear attack flow diagrams

**5. Bitquery — "Understanding Different MEV Attacks"**
- **URL:** https://bitquery.io/blog/different-mev-attacks
- **Key Topics:**
  - Frontrunning strategies
  - Sandwich attack profitability
  - Gas price competition
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 2.1)
- **Extraction Quality:** Medium — attack categorization

**6. Flashbots — MEV-Boost Documentation**
- **URL:** https://docs.flashbots.net/flashbots-mev-boost/introduction
- **Key Topics:**
  - Proposer-Builder Separation (PBS)
  - Relay mechanisms
  - Block builder marketplace
  - Economic formalization of MEV
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 2.3)
- **Extraction Quality:** High — protocol-level economic design

---

### Griefing Attacks

**7. Smart Contract Security Field Guide — "Griefing Attacks"**
- **URL:** https://scsfg.io/hackers/griefing/
- **Key Topics:**
  - Timestamp reset griefing
  - Gas griefing attacks (SWC-126)
  - Insufficient gas forwarding (63/64 rule)
  - Delay mechanism exploitation
  - Relayer contract vulnerabilities
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 3)
- **Extraction Quality:** High — code examples and attack flows

**8. CoinMonks — "Smart Contract Security: Griefing Attack Vectors"**
- **URL:** https://medium.com/coinmonks/smart-contract-security-griefing-attack-vectors-87372a115980
- **Key Topics:**
  - Griefing attack definition and scope
  - Insufficient gas griefing mechanics
  - Best practices for prevention
  - Return value verification
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 3.2)
- **Extraction Quality:** High — detailed vulnerability analysis

---

### Lending Protocol Economics

**9. ArXiv — "A Theory of Lending Protocols in DeFi"**
- **URL:** https://arxiv.org/abs/2506.15295
- **Authors:** Massimo Bartoletti, Enrico Lipparini
- **Key Topics:**
  - Formal model of lending protocol incentives
  - Liquidation mechanism economics
  - User strategy analysis
  - Adversarial strategies
  - Protocol stability conditions
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 4)
- **Extraction Quality:** High — academic rigor, formal modeling

**10. CertiK — "Lending Contract Exploits: A Retrospective"**
- **URL:** https://www.certik.com/resources/blog/6zCUCa5wbbdZsaZr1Ms1Yd-lending-contract-exploits-a-retrospective
- **Key Topics:**
  - 39 lending contract exploits analyzed
  - Liquidation manipulation patterns
  - Collateral price manipulation
  - Flash loan attacks on lending
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 4.1)
- **Extraction Quality:** High — statistical exploit analysis

**11. Cyfrin — "DeFi Liquidation Vulnerabilities and Mitigation Strategies"**
- **URL:** https://www.cyfrin.io/blog/defi-liquidation-vulnerabilities-and-mitigation-strategies
- **Key Topics:**
  - Liquidation blocking attacks
  - Bad debt accumulation
  - Protocol solvency risks
  - Prevention mechanisms
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 4.1)
- **Extraction Quality:** Medium — mitigation focus

---

### Incentive Misalignment & Tokenomics

**12. ChainForce — "The Incentive Misalignment Challenge in Tokenomics"**
- **URL:** https://chainforce.tech/incentive-models/the-incentive-misalignment-challenge-in-tokenomics/
- **Key Topics:**
  - Short-term vs long-term incentive gaps
  - Liquidity provider misalignment
  - Team/community incentive conflicts
  - Early liquidity access problems
- **Artifacts Populated:** INCENTIVE_MISALIGNMENT_PATTERNS.md (Section 1, 2)
- **Extraction Quality:** High — conceptual framework for misalignment

**13. Fidelity Digital Assets — "From Supply to Incentives: Turning Tokenomics into Strategy"**
- **URL:** https://www.fidelitydigitalassets.com/research-and-insights/supply-incentives-turning-tokenomics-strategy
- **Key Topics:**
  - Tokenomics as economic design
  - Value flow analysis
  - Long-term viability assessment
  - Institutional investor perspective
- **Artifacts Populated:** INCENTIVE_MISALIGNMENT_PATTERNS.md (Section 6)
- **Extraction Quality:** High — institutional-grade analysis

**14. IOSCO — "Policy Recommendations for Decentralized Finance (DeFi)"**
- **URL:** https://www.iosco.org/library/pubdocs/pdf/IOSCOPD744.pdf
- **Key Topics:**
  - DeFi risk categorization
  - Governance participation economics
  - Regulatory perspective on incentives
- **Artifacts Populated:** INCENTIVE_MISALIGNMENT_PATTERNS.md (Section 4)
- **Extraction Quality:** Medium — policy-focused

**15. EEA (Enterprise Ethereum Alliance) — "DeFi Risk Assessment Guidelines"**
- **URL:** https://entethalliance.github.io/DRAMA/defi-risks.html
- **Key Topics:**
  - Governance risk assessment
  - Incentive analysis framework
  - Tokenomics risk factors
- **Artifacts Populated:** INCENTIVE_MISALIGNMENT_PATTERNS.md (Section 7)
- **Extraction Quality:** Medium — framework-oriented

---

### Economic Security & Design

**16. Three Sigma — "DeFi Audit: Prevent DeFi Exploits"**
- **URL:** https://threesigma.xyz/blog/defi/defi-audit-guide
- **Key Topics:**
  - Economic audits vs technical audits
  - Incentive misalignment detection
  - Tokenomics vulnerabilities
  - Unsustainable system design
- **Artifacts Populated:** INCENTIVE_MISALIGNMENT_PATTERNS.md (Section 7)
- **Extraction Quality:** High — audit methodology

**17. Gate.io — "Beyond Code Flaws: Economic Audits and DeFi Protocol Security"**
- **URL:** https://www.gate.com/learn/articles/beyond-code-flaws-economic-audits-and-de-fi-protocol-security/4851
- **Key Topics:**
  - Economic audit importance
  - Design-level vulnerabilities
  - Treasury extraction patterns
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 5)
- **Extraction Quality:** Medium — overview content

---

### GitHub Repositories (Code-Level Economics)

**18. calvwang9/oracle-manipulation**
- **URL:** https://github.com/calvwang9/oracle-manipulation
- **Content:** Educational repository on oracle manipulation attacks
- **Value:** Code examples and attack demonstrations
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (code examples)

**19. flashbots/mev-boost**
- **URL:** https://github.com/flashbots/mev-boost
- **Content:** MEV extraction middleware implementation
- **Value:** Production-grade MEV extraction mechanisms
- **Artifacts Populated:** ECONOMIC_ATTACKS.md (Section 2.3)

---

## Extraction Summary

| Artifact | Lines | Sections | Sources Used |
|----------|-------|----------|--------------|
| ECONOMIC_ATTACKS.md | ~500 | 8 major | 15+ sources |
| INCENTIVE_MISALIGNMENT_PATTERNS.md | ~550 | 9 major | 10+ sources |

**Key Concepts Extracted:**
- ✅ Oracle manipulation archetypes (flash loan, cross-exchange, TWAP)
- ✅ MEV-driven failures (sandwich, frontrun, backrun, PBS)
- ✅ Griefing vectors (timestamp reset, gas griefing, general patterns)
- ✅ Lending protocol economic attacks (liquidation manipulation, collateral manipulation)
- ✅ Economic drain vs. theft distinction
- ✅ Tokenomics design flaws (emissions, governance, LP incentives)
- ✅ Stakeholder incentive conflicts (team/community, lenders/borrowers)
- ✅ Governance participation economics (rational apathy, delegation)
- ✅ Cross-protocol incentive interactions (composability risk)

---

## Research Mode Classification

**Layer:** 3 — Economic & Game-Theoretic Failures  
**Completed:** 2026-02-01  
**Next Layer:** Layer 4 — Systemic & Protocol-Level Failures (pending user definition)

**Cross-Layer References:**
- Links to Layer 1 (ATTACK_VECTOR_DATABASE.md for technical counterparts)
- Links to Layer 2 (SPECIFICATION_GAPS.md for formal verification of economic properties)
- Awaits Layer 5 (HISTORICAL_EXPLOITS.md for case study correlations)

---

## Constraints Observed

- ⛔ No simulations executed
- ⛔ No PoCs generated
- ⛔ No live contract interaction
- ✅ Strategic reasoning and pattern extraction only
- ✅ Source attribution for all claims

---

*Layer 3 ingestion complete. Ready for Layer 4 definition.*
