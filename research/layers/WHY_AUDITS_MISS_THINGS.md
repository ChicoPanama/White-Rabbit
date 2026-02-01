# Layer 2: Why Audits Miss Things

**Layer Question:** "Why were these failures missed?"

---

## Methodology Limitations

### Limitation 1: Time Constraints
**Reality:** Audits typically 2-4 weeks for complex protocols.

**Impact:**
- Deep analysis of every function impossible
- Focus on "critical" paths defined by client
- Integration testing limited

**Evidence from Quantstamp Reports:**
- Multiple "Acknowledged" findings (not fixed)
- Note: "Edge cases extremely difficult to predict" (LUKSO)

**Implication for Research:**
Post-audit code is often exploitable. The finding exists, just not fixed.

---

### Limitation 2: Scope Definition
**Reality:** Audit scope is negotiated and limited.

**Common Exclusions:**
- Economic attacks (out of scope)
- Governance manipulation ("trusted")
- Oracle dependencies (external)
- Front-running ("MEV, not our bug")
- Post-deployment operations

**Evidence:**
- API3 A3M-10: "Out of scope contracts called" — finding exists but not addressed
- Many Quantstamp reports flag "Privileged roles" as informational, not vulnerability

**Implication for Research:**
"Acknowledged" often means "valid but won't fix" — exploitable opportunity.

---

### Limitation 3: Tool Reliance
**Reality:** Heavy dependence on automated tools (Slither, Mythril).

**Strengths:**
- Fast coverage of common patterns
- Consistent detection

**Weaknesses:**
- Can't detect logical errors
- Misses economic vulnerabilities
- High false positive rate
- Misses novel patterns

**Evidence:**
- Quantstamp uses Slither + manual review
- Manual review finds what tools miss
- But manual review is time-limited

**Implication for Research:**
Tool-based scanning misses what manual review finds. Novel attacks bypass both.

---

### Limitation 4: Novel Standard Complexity

**Reality:** New standards (ERC-4337, LSPs) lack established security patterns.

**Challenge:**
- No historical exploit database
- Edge cases "extremely difficult to predict"
- Audit team learning curve

**Evidence:**
- LUKSO LSP audit: 14 issues, 7 acknowledged
- Note: "Edge cases in novel standards difficult to predict"

**Implication for Research:**
New standards = higher bug density. First-mover advantage for researchers.

---

## Human Factors

### Factor 1: Confirmation Bias
**Reality:** Auditors expect code to work as specified.

**Manifestation:**
- Focus on implementation correctness
- Less scrutiny of specification validity
- Assumptions go unchallenged

**Evidence:**
- Multiple "business logic" bugs post-audit
- Economic manipulation vectors missed

**Implication for Research:**
Question specifications, not just code.

---

### Factor 2: Checklist Fatigue
**Reality:** Repetitive patterns lead to automatic processing.

**Manifestation:**
- Standard patterns marked "safe" without deep review
- Innovation in standard patterns missed
- Custom implementations of standard patterns assumed correct

**Evidence:**
- Compound forks with same vulnerability repeatedly exploited
- Each audit said "standard Compound pattern" — but pattern was vulnerable

**Implication for Research:**
Standard patterns can be wrong. Question everything.

---

### Factor 3: Communication Gaps
**Reality:** Audit findings may not translate to fixes.

**Manifestation:**
- Technical findings → business decision not to fix
- Severity downgraded by client pressure
- Fixes implemented incorrectly

**Evidence:**
- 43% of Quantstamp findings marked "Acknowledged"
- Not all acknowledged issues are invalid

**Implication for Research:**
Track acknowledged issues. They may be exploitable.

---

## Structural Blind Spots

### Blind Spot 1: Economic Modeling
**Reality:** Audits focus on code, not economics.

**Missed:**
- Incentive misalignment
- Rational adversary behavior
- MEV extraction opportunities
- Flash loan attack feasibility

**Evidence:**
- API3 OEVA-4: Auctioneer incentive misalignment flagged but not "fixed"
- Most DeFi exploits are economic, not code bugs

**Implication for Research:**
Economic analysis catches what code audits miss.

---

### Blind Spot 2: Composability Risk
**Reality:** Audits scope per-contract, not system.

**Missed:**
- Cross-contract reentrancy
- State inconsistency
- Cascading failures

**Evidence:**
- LUKSO QSP-7: 6 functions with reentrancy risk
- Cross-contract interactions not fully assessed

**Implication for Research:**
Integration testing reveals what unit audits miss.

---

### Blind Spot 3: Temporal Assumptions
**Reality:** Audits analyze static code, not dynamic behavior.

**Missed:**
- Time-dependent state changes
- Oracle staleness
- Governance delays
- Emergency response procedures

**Evidence:**
- API3 OEVA-1: 15-second delay acknowledged
- Time-based attack windows not fully modeled

**Implication for Research:**
Dynamic analysis reveals static blind spots.

---

## Quantstamp-Specific Insights

### From 18 Reports Analyzed:

**Finding Resolution:**
- ~40% Fixed
- ~43% Acknowledged (not fixed) ← **Opportunity**
- ~10% Mitigated
- ~7% Other

**Pattern:**
"Acknowledged" ≠ Invalid. Often means:
- Too expensive to fix
- Requires architectural change
- Business decision to accept risk
- Not fully understood by team

**Exploitation Opportunity:**
Previously audited protocols with acknowledged issues are prime targets.

---

## Research Application

### When Reviewing Audits:
1. Check "Acknowledged" findings — not just "Fixed"
2. Look for economic findings — often deprioritized
3. Identify integration gaps
4. Note novel standard complexity
5. Track specification vs. implementation gaps

### When Hunting:
1. Target protocols with "Acknowledged" high-severity findings
2. Focus on economic manipulation (audited but deprioritized)
3. Test cross-contract interactions
4. Model temporal attack windows
5. Verify fixes actually deployed

---

## Sources

Audit methodology analysis derived from:
- **Types and Programming Languages** (Pierce) - Type theory and formal verification limits
- **Halmos documentation** (a16z) - Symbolic testing capabilities and constraints
- **Slither documentation** (Trail of Bits) - Static analysis detector limitations
- **Mythril documentation** (ConsenSys) - Symbolic execution boundaries
- **Z3 documentation** (Microsoft) - SMT solver constraints and timeout issues
- **Quantstamp audit library** - 18 real-world audit reports, methodology observations
- **Smart Contract Security Field Guide** - Verification tool blind spots

---

*Understanding why audits miss things helps you find what they missed.*
