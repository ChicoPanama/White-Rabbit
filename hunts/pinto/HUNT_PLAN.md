# PINTO PROTOCOL HUNT — INITIATION
**Started:** 2026-02-02  
**Status:** Active  
**Protocol:** Pinto (Beanstalk fork)  
**Bounty:** $50K minimum / $100K max  
**Chain:** Base

---

## 🎯 CRITICAL CONTEXT: BEANSTALK HACK

**Historical Precedent:** Beanstalk (Pinto's parent protocol) was **exploited for $182M** on April 17, 2022.

**Attack Vector:**
1. Attacker took flash loan
2. Bought majority governance stake (via BEAN tokens)
3. Passed malicious proposal draining protocol
4. Repaid flash loan
5. Profit: ~$80M

**Key Insight:** Forks of exploited protocols are PRIME hunting grounds because:
- Same vulnerabilities often remain in forks
- Teams may not fully understand parent's flaws
- "Fixed" versions may have incomplete patches
- New code adds new attack surfaces

---

## 📁 CONTRACT STRUCTURE

**Total Contracts:** 188 (excluding mocks/tests)

**Architecture:** EIP-2535 Diamond (multi-facet proxy)

**Main Facets:**
```
contracts/beanstalk/facets/
├── field/          # Lending/borrowing (Soil/Pods)
├── market/         # Trading mechanics
├── season/         # Time-based updates
├── silo/           # Staking/governance
└── sunrise/        # Oracle/price functions
```

**Key Contracts to Analyze:**
1. `SiloFacet.sol` — Staking, governance power
2. `FieldFacet.sol` — Soil/Pod mechanics
3. `MarketFacet.sol` — Trading
4. `SeasonFacet.sol` — Time-based logic
5. `SunriseFacet.sol` — Price oracles
6. `ConvertFacet.sol` — Asset conversion

---

## 🚨 VERIFICATION PROTOCOL — MANDATORY

**Before claiming ANY finding:**
1. ✅ Compile PoC successfully
2. ✅ Execute on Base mainnet fork
3. ✅ Report actual results (never "expected")
4. ✅ Verify contract address matches source
5. ✅ Check if Beanstalk had similar issue
6. ✅ Validate economics at real scale

**NO EXCEPTIONS.**

---

## 🎯 HUNTING STRATEGY

### Phase 1: Beanstalk Hack Analysis (Day 1)
- Study Beanstalk exploit details
- Check if Pinto inherited same vulnerability
- Verify governance flash loan protections

### Phase 2: Governance Analysis (Days 1-2)
- Silo deposit/withdraw mechanics
- Governance power calculation
- Proposal execution flow
- Flash loan protections

### Phase 3: Economic Mechanisms (Days 2-4)
- Soil/Pod mechanics
- Credit-based stablecoin math
- Price oracle manipulation
- Season/sunrise game theory

### Phase 4: Code Review (Days 3-5)
- Access control analysis
- Reentrancy checks
- Integer math errors
- Edge cases in conversions

---

## 📊 TARGET CHECKLIST

**High Priority:**
- [ ] Governance flash loan vulnerability (Beanstalk-style)
- [ ] Silo deposit/withdraw timing attacks
- [ ] Pod market manipulation
- [ ] Oracle price manipulation

**Medium Priority:**
- [ ] Access control bypasses
- [ ] Reentrancy in convertible assets
- [ ] Season transition edge cases
- [ ] Convert calculation errors

**Low Priority:**
- [ ] Gas optimizations
- [ ] Informational findings

---

## 🔗 RESOURCES

**Pinto:**
- GitHub: https://github.com/pinto-org/protocol
- Docs: https://docs.pinto.money
- Immunefi: https://immunefi.com/bug-bounty/pinto/

**Beanstalk History:**
- Hack Analysis: (to research)
- Audits: https://github.com/BeanstalkFarms/Beanstalk-Audits
- Changes: https://docs.pinto.money/resources/audits

---

## ⏰ TIMELINE

**Week 1:** Deep dive governance + Beanstalk comparison  
**Week 2:** Economic mechanism analysis  
**Week 3:** PoC development + verification  
**Week 4:** Submission preparation

**Daily Reports:** Document findings in hunts/pinto/ directory

---

## ⚠️ REMEMBER

- This is a Beanstalk fork - inherits parent's attack surface
- $182M hack precedent means serious vulnerabilities exist
- Verify everything before claiming
- No public disclosure until Immunefi submission ready
