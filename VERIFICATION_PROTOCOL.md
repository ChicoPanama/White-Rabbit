# WHITERABBIT VERIFICATION PROTOCOL v1.0
**MANDATORY CHECKLIST — NO EXCEPTIONS**

---

## 🚨 PRE-FLIGHT CHECKLIST

**Before claiming ANY finding, vulnerability, or test result, ALL boxes must be checked:**

### STEP 1: COMPILATION VERIFICATION
```
□ PoC/test contract compiles without errors
□ All interfaces properly imported
□ No typos in function names or variables
□ Correct Solidity version specified
□ All dependencies resolved
```
**Gate:** If compilation fails → STOP. Fix before proceeding.

---

### STEP 2: CONTRACT IDENTITY VERIFICATION
```
□ Verified contract address matches source code
□ Verified correct contract is being analyzed (not conflated with similar-named contracts)
□ Confirmed contract lineage (fork source, if applicable)
□ Checked for proxy patterns (implementation vs proxy)
□ Confirmed actual deployed bytecode matches source
```
**Gate:** If contracts conflated → STOP. Restart with correct contract.

---

### STEP 3: AUDIT HISTORY CHECK
```
□ Searched for existing audits on this contract
□ Reviewed audit findings for this specific functionality
□ Checked if finding was already reported/addressed
□ Reviewed Immunefi/bug bounty history for this protocol
□ Confirmed finding is novel (not duplicate)
```
**Gate:** If finding already documented → STOP. Not a new vulnerability.

---

### STEP 4: EXECUTION VERIFICATION
```
□ Test executed successfully on forked mainnet
□ Test executed with real contract addresses (not mocks)
□ Results captured from actual execution (not "expected")
□ Transaction traces reviewed
□ State changes verified
```
**Gate:** If test not executed → STOP. No results to report.

---

### STEP 5: ATTACK MECHANISM VALIDATION
```
□ Traced exact code path from attacker action to impact
□ Verified each step of the attack chain
□ Confirmed state transitions happen as claimed
□ Verified no access control blocks the attack
□ Confirmed economic incentives align with attack
```
**Gate:** If mechanism doesn't work as claimed → STOP. Not a real vulnerability.

---

### STEP 6: ECONOMIC REALITY CHECK
```
□ Calculated real numbers (not hypothetical scenarios)
□ Accounted for all costs (gas, fees, opportunity cost)
□ Verified capital requirements are realistic
□ Checked dilution at real mainnet scale
□ Confirmed profit > costs at current mainnet conditions
```
**Gate:** If economics don't work → STOP. Not exploitable.

---

### STEP 7: IMPACT ASSESSMENT
```
□ Fund loss or protocol breakage confirmed (not design choice)
□ Severity calibrated correctly (not over/under-claimed)
□ Impact reproducible consistently
□ No edge cases that invalidate the finding
□ Time-sensitive factors accounted for (locks, delays, etc.)
```
**Gate:** If impact unclear or by design → STOP. Not a vulnerability.

---

## 📋 SUBMISSION GATE

**Before ANY external disclosure (gist, Immunefi, etc.):**

```
□ All 7 verification steps completed
□ PoC runs successfully with actual output captured
□ Report written with real results only
□ Reviewed by second analysis pass
□ No "expected" or "hypothetical" language in report
□ Correct severity assigned
□ Economic analysis based on mainnet data
```

**ABSOLUTE RULES:**
1. ❌ **NEVER** publish public gist before private verification complete
2. ❌ **NEVER** submit to bounty platform without 100% verification
3. ❌ **NEVER** claim "expected" results — only actual execution output
4. ❌ **NEVER** skip steps to show quick results
5. ❌ **NEVER** conflate contracts or mechanisms

---

## ✅ VERIFICATION SIGNATURE

**Before claiming any finding, I must state:**

> "I, WhiteRabbit, certify that:
> 1. This PoC compiles: [YES/NO]
> 2. This PoC executed successfully: [YES/NO]  
> 3. These are actual results (not expected): [YES/NO]
> 4. Contracts verified not conflated: [YES/NO]
> 5. Audit history checked: [YES/NO]
> 6. Economics verified on mainnet scale: [YES/NO]"

**If ANY answer is NO → DO NOT PROCEED.**

---

## 🔒 EMERGENCY STOP CONDITIONS

**STOP and request review if:**
- Results seem "too good to be true"
- Attack seems to bypass all security controls
- Economic analysis shows unrealistic ROI
- Finding contradicts known secure patterns
- Finding matches known-audited functionality
- Time pressure to deliver results
- Eagerness to please overriding rigor

---

## 📊 POST-ANALYSIS DOCUMENTATION

**After verification, document:**
1. Exact commit hash of code analyzed
2. Block number of fork test
3. Actual gas costs from execution
4. Real transaction hashes (if on mainnet)
5. Screenshot or log of test output
6. Audit references that were checked

---

*This protocol is MANDATORY. No exceptions. No shortcuts.*
*Credibility is earned through verification, not speed.*
