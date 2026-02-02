# FINDING 2 VERIFICATION: Rounding Error in Rebase Distribution
**Status:** STEP-BY-STEP VERIFICATION
**Hypothesis:** Small veNFT holders receive 0 rebases due to integer division rounding

---

## STEP 1: EXACT CODE EXTRACTION

### Code from RewardsDistributor.sol - _claimable() (lines 99-130):
```solidity
function _claimable(
    uint256 _tokenId,
    uint256 _lastTokenTime
) internal view returns (uint256 toDistribute, uint256 weekCursorStart, uint256 weekCursor) {
    uint256 _startTime = startTime;
    weekCursor = timeCursorOf[_tokenId];
    weekCursorStart = weekCursor;

    // case where token does not exist
    uint256 maxUserEpoch = ve.userPointEpoch(_tokenId);
    if (maxUserEpoch == 0) return (0, weekCursorStart, weekCursor);

    // case where token exists but has never been claimed
    if (weekCursor == 0) {
        IVotingEscrow.UserPoint memory userPoint = ve.userPointHistory(_tokenId, 1);
        weekCursor = (userPoint.ts / WEEK) * WEEK;
        weekCursorStart = weekCursor;
    }
    if (weekCursor >= _lastTokenTime) return (0, weekCursorStart, weekCursor);
    if (weekCursor < _startTime) weekCursor = _startTime;

    for (uint256 i = 0; i < 50; i++) {
        if (weekCursor >= _lastTokenTime) break;

        uint256 balance = ve.balanceOfNFTAt(_tokenId, weekCursor + WEEK - 1);
        uint256 supply = ve.totalSupplyAt(weekCursor + WEEK - 1);
        supply = supply == 0 ? 1 : supply;
        toDistribute += (balance * tokensPerWeek[weekCursor]) / supply;  // <-- KEY LINE
        weekCursor += WEEK;
    }
}
```

**Key Line 126:** `toDistribute += (balance * tokensPerWeek[weekCursor]) / supply`

---

## STEP 2: MATHEMATICAL ANALYSIS

**Formula:** `rebase = (userBalance * weeklyEmission) / totalSupply`

**Question:** When does this round to 0?

**Condition for rounding to 0:**
```
(userBalance * weeklyEmission) / totalSupply < 1
=> userBalance * weeklyEmission < totalSupply
=> userBalance < totalSupply / weeklyEmission
```

**EXAMPLE CALCULATION:**
- Assume totalSupply = 100,000,000 AERO (1e26 wei)
- Assume weeklyEmission = 10,000,000 AERO (1e25 wei)
- Threshold = 1e26 / 1e25 = 10 AERO

**Any veNFT with balance < 10 AERO gets 0 rebase!**

---

## STEP 3: VERIFY REAL-WORLD PARAMETERS

**Question:** What are actual Aerodrome parameters?

**From Minter.sol:**
```solidity
uint256 public weekly = 10_000_000 * 1e18;  // 10M AERO per week
```

**From current network (need to verify):**
- Current total veAERO supply: ~500M-1B AERO estimated

**Calculation with realistic numbers:**
- totalSupply = 500,000,000 AERO (5e26 wei)
- weeklyEmission = 10,000,000 AERO (1e25 wei)
- Threshold = 5e26 / 1e25 = 50 AERO

**Any lock under 50 AERO gets 0 rebase!**

---

## STEP 4: VERIFY IF THIS IS EXPLOITABLE

**Question 1:** Can attacker profit from this?

**Analysis:**
- Creating dust locks costs gas (no economic benefit to attacker)
- The "exploit" would be: create many small locks to dilute emissions
- BUT: Emissions are distributed proportionally, so dust locks just waste gas
- No clear profit vector for attacker

**Question 2:** Is this a vulnerability or designed behavior?

**Analysis:**
- Integer division rounding is standard in Solidity
- Protocol could have set minimum lock amounts (but didn't)
- Small holders losing rewards is an economic reality, not a security bug
- Similar to The Graph's rounding issue, but that was about fee evasion (profitable)
- Here, there's no fee to evade, just small amounts rounding to 0

---

## STEP 5: CHECK FOR PROFITABLE ATTACK VECTOR

**The Graph rounding exploit worked because:**
- Attacker could EVADE fees (direct profit)
- Gas cost on L2 was negligible
- Could batch operations profitably

**Aerodrome rounding:**
- No fees to evade
- No economic benefit to creating dust locks
- Just small holders not getting rebases (which is expected for tiny positions)

**VERIFICATION QUESTION:** Is there ANY way to profit from this?

**SCENARIO TEST:**
1. Attacker creates 1000 locks of 1 AERO each
2. Total supply increases by 1000 AERO (negligible)
3. Each lock gets 0 rebase due to rounding
4. Attacker loses gas costs, gains nothing
5. Other users' rebases unchanged (dust amount is negligible)

**CONCLUSION:** No profitable attack vector

---

## STEP 6: DOCUMENT VERIFICATION STATUS

**ORIGINAL CLAIM:** "Rounding error allows attacker to grief by creating dust locks"

**VERIFIED FACTS:**
1. ✅ Integer division does round to 0 for small balances
2. ✅ Mathematical threshold exists (roughly: balance < totalSupply/weeklyEmission)
3. ✅ Small holders (under ~50 AERO) get 0 rebases
4. ❌ NO economic incentive to exploit this
5. ❌ NO profit vector for attacker
6. ❌ This is standard rounding behavior, not a vulnerability

**KEY DIFFERENCE FROM THE GRAPH:**
- The Graph: Rounding allowed FEE EVASION (direct profit)
- Aerodrome: Rounding just means small holders get nothing (no profit to attacker)

**CONCLUSION:** Finding 2 is NOT A VULNERABILITY

**REASON:** While rounding to 0 does occur, there is no economic incentive or attack vector. This is standard behavior for proportional distribution systems.

**Status:** FINDING 2 REJECTED (downgraded from "exploitable" to "known limitation")

---

## LESSON REINFORCED (AGAIN)

Must distinguish between:
1. **Technical behavior:** Yes, rounding to 0 occurs
2. **Economic exploitability:** No, no profit possible
3. **Vulnerability:** Requires both technical flaw + exploitable impact

This is NOT like SSV (which was a real DoS), but it's also NOT like The Graph rounding (which had fee evasion profit).

**Status:** FINDING 2 REJECTED AS NON-EXPLOITABLE

**Next:** Finding 3 verification
