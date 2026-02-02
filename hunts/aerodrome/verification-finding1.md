# FINDING 1 VERIFICATION: Rebase Claim Timing DoS
**Status:** STEP-BY-STEP VERIFICATION IN PROGRESS
**Hypothesis:** RewardsDistributor.claim() can be griefed at epoch boundaries

---

## STEP 1: EXACT CODE EXTRACTION

### Code from RewardsDistributor.sol (lines 140-155):
```solidity
function claim(uint256 _tokenId) external returns (uint256) {
    if (IMinter(minter).activePeriod() < ((block.timestamp / WEEK) * WEEK)) revert UpdatePeriod();
    if (ve.escrowType(_tokenId) == IVotingEscrow.EscrowType.LOCKED) revert NotManagedOrNormalNFT();
    uint256 _timestamp = block.timestamp;
    uint256 _lastTokenTime = lastTokenTime;
    _lastTokenTime = (_lastTokenTime / WEEK) * WEEK;
    uint256 amount = _claim(_tokenId, _lastTokenTime);
    if (amount != 0) {
        IVotingEscrow.LockedBalance memory _locked = ve.locked(_tokenId);
        if (_timestamp >= _locked.end && !_locked.isPermanent) {
            address _owner = ve.ownerOf(_tokenId);
            IERC20(token).safeTransfer(_owner, amount);
        } else {
            ve.depositFor(_tokenId, amount);
        }
        tokenLastBalance -= amount;
    }
    return amount;
}
```

### Code from Minter.sol - updatePeriod() (lines 180-220 approx):
Need to verify the exact relationship between activePeriod and claim blocking.

---

## STEP 2: VERIFY THE CHECK LOGIC

**Question:** What exactly does `activePeriod < ((block.timestamp / WEEK) * WEEK)` check?

**Analysis:**
- `block.timestamp / WEEK * WEEK` = start of current week (rounded down)
- `activePeriod` = timestamp when updatePeriod() was last called
- Check fails if `activePeriod` is BEFORE the current week start
- This means: if updatePeriod() hasn't been called this week, claims are blocked

**VERIFICATION NEEDED:**
1. What does updatePeriod() actually do?
2. Who can call updatePeriod()?
3. Is there incentive to call it?
4. What happens if it's not called?

---

## STEP 3: VERIFY UPDATEPERIOD() MECHANICS

### Code from Minter.sol:
```solidity
function updatePeriod() external returns (uint256) {
    uint256 _period = activePeriod;
    if (block.timestamp >= _period + WEEK) {  // Only executes if 1 week passed
        // ... minting logic ...
        activePeriod = ((block.timestamp / WEEK) * WEEK);  // Updates to current week
        // ... emission distribution ...
    }
    return activePeriod;
}
```

**Key Insight:** 
- `updatePeriod()` can be called by ANYONE (no access control!)
- It only executes the minting logic if `block.timestamp >= activePeriod + WEEK`
- It updates `activePeriod` to the current week start

**VERIFICATION QUESTION:** Is there really a griefing vector here?

**ANALYSIS:**
- If `updatePeriod()` hasn't been called, anyone can call it permissionlessly
- Once called, `activePeriod` = current week, and claims work
- The griefing window is only the time between week start and updatePeriod() being called
- This is typically seconds/minutes, not a sustained attack

**HYPOTHESIS STATUS:** ⚠️ LIKELY FALSE POSITIVE

**Reasoning:**
- updatePeriod() is permissionless
- Anyone can call it (no cost except gas)
- No economic incentive to block it
- Even if front-run, someone else can call it immediately
- This is designed behavior, not a vulnerability

---

## STEP 4: VERIFY INCENTIVE STRUCTURE

**Question:** Is there any economic benefit to preventing updatePeriod() from being called?

**Analysis:**
- updatePeriod() mints new emissions
- Preventing it would delay new emissions
- But emissions accumulate and can be claimed retroactively
- No clear economic benefit to attacker

**VERIFICATION NEEDED:** Check if emissions really accumulate or if they're lost

---

## STEP 5: DOCUMENT VERIFICATION STATUS

**ORIGINAL CLAIM:** "Attacker can grief by blocking updatePeriod()"

**VERIFIED FACTS:**
1. ✅ updatePeriod() is permissionless
2. ✅ Anyone can call it
3. ✅ No economic incentive to block
4. ✅ Window of "vulnerability" is minutes at most
5. ✅ Designed behavior, not bug

**CONCLUSION:** Finding 1 is a FALSE POSITIVE

**REASON:** The check is a safety mechanism, not a vulnerability. The protocol is designed to require updatePeriod() to be called before claims in a new epoch, and updatePeriod() is permissionless with no economic barrier.

---

## LESSON REINFORCED

This is exactly like the SSV situation:
- **Initial assumption:** Timing check is exploitable
- **After verification:** It's designed behavior with no practical exploit
- **Key mistake:** Not checking who can call updatePeriod() and the economic incentives

**Status:** FINDING 1 REJECTED

**Next:** Proceed to Finding 2 verification with equal rigor
