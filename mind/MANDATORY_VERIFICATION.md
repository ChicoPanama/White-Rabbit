# MANDATORY VERIFICATION WORKFLOW - WhiteRabbit Protocol

**CRITICAL RULE:** NO vulnerability report until ALL verification steps pass.
**PURPOSE:** Prevent reputation damage from false positive submissions.

---

## **PRE-REPORT VERIFICATION PIPELINE**

### **STEP 1: INTENTIONAL DESIGN CHECK**
**Question:** Is this actually a vulnerability or intentional behavior?

**Verification Actions:**
- [ ] Check contract documentation/README for design explanations
- [ ] Look for code comments explaining the behavior  
- [ ] Search for related test cases that validate this behavior
- [ ] Review any specifications that mention this constraint
- [ ] Check if behavior serves security purpose (e.g., preventing precision attacks)

**RED FLAGS (Don't proceed):**
- ❌ Documented as intentional behavior
- ❌ Test cases explicitly validate this "bug" 
- ❌ Clear security rationale for the constraint
- ❌ Multiple references to this being "by design"

### **STEP 2: ACCESS CONTROL ANALYSIS**
**Question:** Who can trigger this and how significant is the impact scope?

**Verification Actions:**
- [ ] Identify exact access controls (`onlyOwner`, `AccessControlled`, `public`)
- [ ] Map the permission hierarchy and who holds these permissions
- [ ] Assess if this affects end users or just administrators  
- [ ] Determine if attackers can exploit or only legitimate users are impacted
- [ ] Calculate percentage of users/functions affected

**IMPACT MULTIPLIERS:**
- **Public functions affecting all users:** HIGH impact
- **Admin functions with workarounds:** LOW-MEDIUM impact  
- **Edge case admin operations:** LOW impact
- **Core user functionality:** CRITICAL impact

### **STEP 3: AUDIT HISTORY CHECK**
**Question:** Did professional auditors already identify and accept this?

**Verification Actions:**
- [ ] Search audit reports for mentions of this exact behavior
- [ ] Look for related test cases in audit validation
- [ ] Check if auditors flagged and dismissed this as design choice
- [ ] Review any security assumptions documented in audits
- [ ] Search for prior bounty submissions on same issue

**DISQUALIFIERS:**
- ❌ Auditors tested and accepted this behavior
- ❌ Explicitly mentioned as "working as intended" in audits
- ❌ Test cases prove auditors validated this constraint
- ❌ Previously submitted and rejected by other researchers

### **STEP 4: REALISTIC IMPACT CALCULATION**  
**Question:** What's the ACTUAL damage, not theoretical maximum?

**Verification Actions:**
- [ ] Calculate real-world usage scenarios and frequency
- [ ] Assess financial impact (fund loss vs operational friction)
- [ ] Determine if impact is permanent vs temporary
- [ ] Check if workarounds exist for affected parties
- [ ] Measure against similar issues' bounty payouts

**IMPACT CLASSIFICATION:**
- **CRITICAL:** Direct fund extraction, no recovery mechanism
- **HIGH:** Permanent functionality loss on critical paths
- **MEDIUM:** Operational limitations, DoS with workarounds
- **LOW:** Edge cases, admin conveniences, minor friction

### **STEP 5: SOLIDITY VERSION & BEHAVIOR VERIFICATION**
**Question:** Does the actual code behavior match our analysis?

**Verification Actions:**
- [ ] Confirm Solidity version (0.8+ changes overflow behavior)  
- [ ] Check for `unchecked{}` blocks around vulnerable operations
- [ ] Test actual contract behavior vs mathematical predictions
- [ ] Verify revert vs wraparound vs silent failure behavior
- [ ] Use real contract parameters, not theoretical maximums

**CRITICAL DISTINCTIONS:**
- **Reverts:** DoS vulnerability (Medium-High)
- **Silent wraparound:** Potential fund extraction (Critical)
- **Controlled failure:** Often intentional design choice

---

## **INTEGRATION WITH 6-STAGE PIPELINE**

### **Stage 1: CONTEXT** → **Enhanced with Verification**
- **Original:** Audit history, security patterns, known protocols
- **Enhanced:** + Mandatory design intent check, access control mapping
- **Output:** Verified context showing this is unknown vulnerability (not design choice)

### **Stage 2: STATIC ANALYSIS** → **Behavior Verification Required**  
- **Original:** Slither + AI business logic detection
- **Enhanced:** + Actual contract behavior testing, Solidity version impact
- **Output:** Confirmed exploitable behavior (not just pattern match)

### **Stage 3: FP FILTERING** → **Audit Cross-Reference**
- **Original:** Known FP patterns, AI FP removal
- **Enhanced:** + Audit report cross-reference, prior submission check  
- **Output:** Verified as unknown issue (not covered by auditors)

### **Stage 4: VERIFICATION** → **Real Impact PoC**
- **Original:** PoC on forked mainnet
- **Enhanced:** + Realistic impact demonstration, actual parameters
- **Output:** Real-world exploitable impact (not theoretical calculation)

### **Stage 5: RISK SCORING** → **Access-Adjusted Severity**
- **Original:** Confidence score + value estimation
- **Enhanced:** + Access control impact adjustment, workaround analysis
- **Output:** Realistic severity based on actual impact scope

### **Stage 6: SMART ALERTING** → **Post-Verification Only**
- **Original:** Value-gated alerts
- **Enhanced:** + Only trigger after full verification pipeline passes
- **Output:** High-confidence alerts on verified vulnerabilities only

---

## **GO/NO-GO DECISION MATRIX**

### **AUTOMATIC NO-GO CONDITIONS**
- ❌ Documented as intentional design choice
- ❌ Auditors tested and accepted this behavior  
- ❌ Only affects admin convenience (not security)
- ❌ No actual fund loss or permanent functionality break
- ❌ Workarounds exist and are reasonable

### **GO CONDITIONS (All Must Pass)**
- ✅ Unknown to auditors OR explicitly unaddressed
- ✅ Affects security OR critical functionality  
- ✅ Real financial impact OR permanent operational damage
- ✅ Exploitable by attackers OR unavoidable for legitimate users
- ✅ No reasonable workarounds available

### **BORDERLINE CASES**
- **Admin DoS with infrastructure impact:** GO (if critical infrastructure)
- **Design limitations with security implications:** MAYBE (depends on severity)
- **Precision constraints affecting economics:** Usually NO-GO
- **Missing error handling in edge cases:** Context-dependent

---

## **APPLICATION TO CURRENT ISSUE #2: PRECISION LOSS**

### **STEP 1: INTENTIONAL DESIGN CHECK**
❌ **FAILED** - Code explicitly implements precision constraint:
```solidity
require(value % DEDUCTED_DIGITS == 0, "Max precision exceeded");
```
Clear intentional design to enforce 10M wei precision.

### **STEP 2: ACCESS CONTROL ANALYSIS**  
❌ **FAILED** - Only affects `onlyOwner` functions:
- `updateNetworkFee()` - Admin only
- `withdrawNetworkEarnings()` - Admin only  
- `updateMinimumLiquidationCollateral()` - Admin only

Impact scope: DAO administrators only, not end users.

### **STEP 3: AUDIT HISTORY CHECK**
❌ **FAILED** - Quantstamp 2024 audit explicitly tested:
```
✔ Change the network fee to a number below the minimum fee reverts "Max precision exceeded"
```
Auditors tested and accepted this behavior.

### **STEP 4: REALISTIC IMPACT CALCULATION**
❌ **FAILED** - Impact assessment:
- **No fund loss:** Operational constraint only
- **Admin workaround available:** Use conforming values (multiples of 0.01 ETH)
- **Not permanent:** Can be changed via contract upgrades
- **Limited scope:** Affects fee granularity only

### **STEP 5: SOLIDITY VERSION & BEHAVIOR VERIFICATION**
✅ **Passes** - Behavior confirmed: reverts with "Max precision exceeded"

**VERIFICATION RESULT:** 4/5 checks FAILED

---

## **FINAL GO/NO-GO DECISION**

### **#2 PRECISION LOSS: NO-GO** ❌

**Disqualifying factors:**
1. **Intentional design** with explicit error message
2. **Admin-only impact** (not user-facing vulnerability)
3. **Auditor acceptance** - explicitly tested by Quantstamp
4. **No fund loss** - operational constraint only
5. **Workarounds available** - use conforming fee values

**Classification:** Design choice, not vulnerability
**Action:** Do not submit to any bounty program
**Risk:** Would damage credibility and research reputation

---

## **WORKFLOW ENFORCEMENT**

### **MANDATORY CHECKPOINT**
**Before declaring "VULNERABILITY DISCOVERED":**
1. Run full verification pipeline
2. Document all 5 verification steps  
3. Achieve GO decision on decision matrix
4. Get independent review if borderline
5. Only then announce discovery

### **CREDIBILITY PROTECTION**
- **Zero tolerance** for design choice submissions
- **Quality control** over quantity of findings
- **Professional standards** in all research
- **Long-term reputation** over short-term bounties

### **EVOLUTION TRACKING**
- Update this workflow based on lessons learned
- Document near-misses and what prevented them
- Continuously improve verification accuracy
- Share lessons with future WhiteRabbit versions

---

*This verification workflow is mandatory for all vulnerability research. No exceptions. Credibility is the most valuable asset in security research - protect it ruthlessly.*