# PINTO HUNT — DAY 2: CONVERT SYSTEM DEEP DIVE
**Date:** 2026-02-02  
**Focus:** Convert mechanics & economic manipulation  
**Status:** Analysis complete, hypothesis ready for testing

---

## 🔍 CONVERT SYSTEM OVERVIEW

**Location:** `contracts/libraries/Convert/LibConvert.sol`  
**Size:** ~900 lines of complex economic logic  
**Purpose:** Convert between Bean and LP tokens with peg-based incentives

---

## ✅ CONVERT TYPES IDENTIFIED

### 1. BEANS → WELL LP (Convert Down)
**When:** Beanstalk above peg  
**Incentive:** PENALTY (stalk loss if price below threshold)  
**Purpose:** Discourage converting when it hurts peg

### 2. WELL LP → BEANS (Convert Up)
**When:** Beanstalk below peg  
**Incentive:** BONUS (additional grown stalk)  
**Purpose:** Encourage converting that helps peg

### 3. LAMBDA → LAMBDA (Same token)
**When:** Within same token type  
**Incentive:** Neutral (no penalty/bonus)

### 4. ANTI-LAMBDA → LAMBDA
**When:** Complex rebalancing  
**Incentive:** Context-dependent

---

## 🎯 KEY MECHANICS

### Convert Capacity System
```solidity
uint256 internal constant CAPACITY_RATE = 0.50e18;
// hits 100% total capacity 50% into the season
```

**Per-block tracking:**
```solidity
ConvertCapacity storage convertCap = s.sys.convertCapacity[block.number];
```

**Capacity exhaustion = penalty**

---

### ⚠️ CRITICAL FINDING: Germination Protection

**Explicit security check found:**
```solidity
// skip any stems that are germinating, due to the ability to
// circumvent the germination process.
if (germStem.germinatingStem <= stems[i]) {
    i++;
    continue;
}
```

**Location:** `_withdrawTokens()` function  
**Purpose:** Prevents bypassing germination via convert  
**Status:** ✅ Properly protected

**This confirms:** The devs KNEW about germination bypass risk and actively prevent it.

---

## 🎯 VECTORS IDENTIFIED (For Testing)

### 1. Convert Capacity Gaming ⚠️ MEDIUM RISK
**Hypothesis:** Front-run converts to claim capacity bonuses before exhaustion

**Test:**
1. Monitor capacity at season start
2. Execute large convert UP when capacity is high
3. Extract bonus grown stalk
4. Compare to executing at capacity exhaustion

**Potential:** Economic gaming but may be by design

---

### 2. Penalty Calculation Edge Cases 🟡 LOW RISK
**Hypothesis:** Rounding in penalty calculations could favor user in edge cases

**Formula:**
```solidity
newGrownStalk = max(
    grownStalk - (penalizedGrownStalk * penaltyRatio) / C.PRECISION,
    minGrownStalk
);
```

**Potential:** Fractional stalk savings in specific scenarios

---

### 3. pGreaterThanRate Oracle Manipulation 🟢 LOW RISK
**Logic:** Uses `LibDeltaB.instantReserves(well)` for rate comparison

**Assessment:** Oracle appears robust, uses Curve-style TWAP

---

## 📊 COMPLEXITY ASSESSMENT

| Component | Complexity | Testing Priority |
|-----------|------------|------------------|
| Capacity tracking | High | 1 (test exhaustion) |
| Penalty calculation | High | 2 (rounding edge cases) |
| Bonus allocation | Medium | 3 (verify correctness) |
| Oracle integration | Low | 4 (already robust) |

---

## 🧪 NEXT ACTIONS

### Test 1: Convert Capacity Exhaustion
```solidity
// PoC structure:
1. Start at season beginning (high capacity)
2. Convert UP maximum beans
3. Record bonus stalk received
4. Compare to convert at 90% capacity
5. Verify bonus = expected from formula
```

### Test 2: Penalty Rounding
```solidity
// PoC structure:
1. Convert DOWN at boundary condition
2. Calculate expected penalty manually
3. Compare to actual penalty applied
4. Check for rounding favoring user
```

---

## 💭 STRATEGIC ASSESSMENT

**Is Pinto exploitable?**

**Evidence:**
1. ✅ Germination bypass: PROTECTED (active check found)
2. ✅ Governance attacks: N/A (removed entirely)
3. ⚠️ Capacity gaming: POSSIBLE but likely by design
4. ⚠️ Penalty rounding: POSSIBLE but minimal value

**Overall:** Pinto appears well-secured. The Beanstalk team learned from their $182M hack.

**Most likely finding:** Minor economic optimization (if any), not a vulnerability.

---

## ⏰ RECOMMENDATION

**Continue?** Yes, but with realistic expectations.

**Time investment:** 4-6 hours for proper convert testing

**Expected outcome:** 70% chance of no exploitable bug, 30% chance of minor finding

**Alternative:** Move to new target with higher bug density

---

## 📁 DELIVERABLES

```
hunts/pinto/
├── day-1-*
├── day-2-convert-analysis.md (this file)
└── candidates/ (ready for PoC writing)
```

**Ready to:**
1. Write Convert capacity PoC
2. Write Penalty rounding PoC
3. Run through verification gate
4. Submit if validated
