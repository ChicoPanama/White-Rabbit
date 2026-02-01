
---

## 8. Pattern Cross-Reference

This artifact maps to the 8 Recurring Failure Patterns as follows:

### Pattern 1: Trust But Don't Verify
- **Shared Oracle Trust:** Multiple protocols trust same price feed without verification
- **Bridge Dependencies:** Protocols trust bridge solvency without verification
- **Yield Source Trust:** Trust that underlying protocols are secure
- **Historical Context:** stETH depeg, all oracle manipulation cascades

### Pattern 3: Single Point of Failure
- **Shared Collateral Assets:** ETH, stETH, WBTC concentration across protocols
- **Oracle Infrastructure:** Chainlink feeds used by 100+ protocols
- **Bridge Dependencies:** Single bridge connects multiple protocols
- **Yield Source Concentration:** Curve dominance in stablecoin yields
- **Governance Delegation:** Few delegates control multiple protocols
- **Historical Context:** stETH depeg, Chainlink outage risks, Curve dominance

### Pattern 4: Economic Assumptions Don't Hold
- **Correlation Assumptions:** Assumption that "uncorrelated" assets are independent
- **Liquidity Assumptions:** Assumption that shared DEXs have infinite depth
- **Liquidation Assumptions:** Assumption that one protocol's liquidation doesn't affect others
- **Historical Context:** All cascade liquidations, Black Thursday, stETH depeg

### Pattern 5: Complexity Hides Bugs
- **Dependency Chains:** Long chains of protocol dependencies hide risks
- **Yield Aggregator Routing:** Complex routing hides true risk exposure
- **Cross-Protocol Positions:** User positions across protocols create hidden leverage
- **Historical Context:** Yield aggregator failures, hidden rehypothecation

### Pattern 6: Integration Blindness
- **Composability Risk:** Protocols secure in isolation, vulnerable when combined
- **Oracle Correlation:** Multiple protocols fail when shared oracle fails
- **Bridge Contagion:** Bridge failure cascades through connected protocols
- **Governance Cross-Contamination:** Shared governance infrastructure
- **Historical Context:** All cascade failures, stETH depeg (Lido → DeFi)

### Pattern 7: Audit Theater
- **Individual Protocol Audits:** Each protocol audited, interactions not examined
- **Ecosystem Audits:** Rarely performed
- **Dependency Analysis:** Not in standard audit scope
- **Historical Gap:** All cross-protocol failures involved "audited" protocols

### Pattern 8: Governance Capture
- **Cross-Protocol Governance:** Attack on one protocol affects others
- **Shared Infrastructure:** Governance of shared oracle/bridge affects all users
- **Delegation Cascades:** Compromised delegate affects multiple protocols
- **Historical Context:** Compound governance affecting all markets

---

## 9. Audit Gap Analysis

| Cross-Protocol Element | Typically Audited? | Why Missed | Detection Difficulty |
|------------------------|-------------------|------------|---------------------|
| **Shared Collateral Risk** | No | Other protocols not in scope | High - requires ecosystem view |
| **Oracle Correlation** | Rare | Assumed independent | Medium - obvious with analysis |
| **Yield Source Overlap** | No | Aggregation hides sources | Very High - requires tracing |
| **Bridge Systemic Risk** | Partial | Focus on bridge, not impact | High - requires downstream analysis |
| **Governance Cross-Contamination** | No | Governance not audited | Very High - requires coordination |
| **Dependency Chain Depth** | No | Not considered | Very High - requires full graph analysis |

**Key Insight:** Cross-protocol risks emerge from the gaps BETWEEN audits. Each protocol passes audit, but their combination creates vulnerabilities no single audit can catch.

---

## 10. Sources & References

1. **ArXiv:** "Mapping Microscopic and Systemic Risks in TradFi and DeFi" (2025)
2. **Chainalysis:** "Cross-Chain Bridge Hacks Analysis" (2022)
3. **ArXiv:** "SoK: Review of Cross-Chain Bridge Hacks in 2023" (Callens et al.)
4. **ACM:** "Deceptive Assurance? A Conceptual View on Systemic Risk in DeFi"
5. **ScienceDirect:** "What Data Have Told Us About Decentralized Finance"
6. **ScienceDirect:** "DeFi: Mirage or Reality? Wealth Centralization Risk"
7. **FinancialContent:** "DeFi's Stress Test: Liquidation Cascades" (2025)
8. **SSRN:** "Anatomy of Crypto Liquidation Cascade" (Ali, 2025)

---

**Related Layer 4 Artifacts:**
- See `SYSTEMIC_FAILURES.md` for cascade failure mechanisms
- See `ATTACK_VECTOR_DATABASE.md` (Layer 1) for technical attack patterns
- See `INCENTIVE_MISALIGNMENT_PATTERNS.md` (Layer 3) for economic design flaws

**Research Mode Classification:**
- **Layer:** 4 (Systemic & Protocol-Level Failures)
- **Priority:** Critical — Cross-protocol risks threaten ecosystem stability
- **Cross-layer Dependencies:** Layer 1 (technical vulnerabilities), Layer 3 (economic mechanisms), Layer 5 (historical case studies)