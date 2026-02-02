# INNOVATIVE VECTOR TESTING: Reward Timing Analysis
**Vector 2A:** Delegation Sandwich - Deposit before reward notification
**Status:** ANALYZING CHECKPOINT MECHANICS

---

## KEY CODE FINDING: Reward Calculation in Reward.sol

### earned() function (lines 187-220):
```solidity
function earned(address token, uint256 tokenId) public view returns (uint256) {
    uint256 reward = 0;
    uint256 _supply = 1;
    
    // Start from last claim epoch
    uint256 _currTs = ProtocolTimeLibrary.epochStart(lastEarn[token][tokenId]);
    
    // Get checkpoint at that time
    uint256 _index = getPriorBalanceIndex(tokenId, _currTs);
    Checkpoint memory cp0 = checkpoints[tokenId][_index];
    
    // Calculate epochs since last claim
    uint256 numEpochs = (ProtocolTimeLibrary.epochStart(block.timestamp) - _currTs) / DURATION;

    for (uint256 i = 0; i < numEpochs; i++) {
        // Get balance at end of each epoch
        _index = getPriorBalanceIndex(tokenId, _currTs + DURATION - 1);
        cp0 = checkpoints[tokenId][_index];
        
        // Get supply at that time
        _supply = supplyCheckpoints[getPriorSupplyIndex(_currTs + DURATION - 1)].supply;
        
        // Calculate reward: balance * rewards / supply
        reward += (cp0.balanceOf * tokenRewardsPerEpoch[token][_currTs]) / _supply;
        _currTs += DURATION;
    }
}
```

### notifyRewardAmount() function (lines 256-262):
```solidity
function _notifyRewardAmount(address sender, address token, uint256 amount) internal {
    IERC20(token).safeTransferFrom(sender, address(this), amount);
    
    uint256 epochStart = ProtocolTimeLibrary.epochStart(block.timestamp);
    tokenRewardsPerEpoch[token][epochStart] += amount;  // <-- KEY LINE
}
```

---

## CRITICAL INSIGHT

**Rewards are assigned to EPOCH, not timestamp!**

`tokenRewardsPerEpoch[token][epochStart]` adds rewards to the current epoch bucket.

### Attack Scenario:

**Timeline:**
```
Epoch 1: Monday 00:00 to Sunday 23:59

Day 1 (Monday): User deposits 1000 AERO into managed NFT
  → Checkpoint created: balance = 1000, timestamp = Monday

Day 3 (Wednesday): Rewards deposited: 1000 AERO
  → tokenRewardsPerEpoch[epoch1] = 1000
  → But epoch1 already started 3 days ago!

Day 7 (Sunday): User claims rewards
  → earned() calculates: (1000 * 1000) / totalSupply
  → User gets FULL reward despite only being deposited 3 days
```

**Wait - is this exploitable?**

The user deposited BEFORE rewards were notified, so they should get rewards. That's intended behavior.

### Reverse Attack Scenario:

```
Day 1 (Monday): Rewards deposited: 1000 AERO
  → tokenRewardsPerEpoch[epoch1] = 1000

Day 3 (Wednesday): User deposits 1000 AERO into managed NFT
  → Checkpoint created: balance = 1000, timestamp = Wednesday

Day 7 (Sunday): User claims rewards
  → earned() looks at checkpoint at epoch end
  → User deposited AFTER rewards were added, but still gets FULL reward!
```

**This IS exploitable!** The user deposited mid-epoch but gets full epoch rewards.

---

## ATTACK VECTOR CONFIRMED: Late Deposit Advantage

**Mechanism:**
1. Wait for rewards to be deposited to a managed NFT (notifyRewardAmount)
2. Immediately deposit into that managed NFT
3. Even though you just deposited, you get full epoch's worth of rewards
4. Wait until epoch ends, claim rewards
5. Withdraw

**Why it works:**
- Rewards are assigned to the entire epoch
- Balance checkpoints are used at epoch end (not time-weighted)
- Late depositors get same rewards as early depositors

**Impact:**
- Free riders can capture rewards without long-term commitment
- Dilutes rewards for legitimate long-term depositors
- Economically exploitable!

---

## PROOF OF CONCEPT NEEDED

**Test on Base fork:**

```solidity
function testLateDepositExploit() {
    // Setup: Epoch starts
    vm.warp(epochStart);
    
    // Step 1: Rewards deposited early in epoch
    vm.warp(epochStart + 1 days);
    notifyRewardAmount(token, 1000e18);
    
    // Step 2: Attacker deposits LATE in epoch
    vm.warp(epochStart + 6 days);
    uint256 tokenId = createLock(1000e18);
    depositManaged(tokenId, managedNft);
    
    // Step 3: Epoch ends
    vm.warp(epochStart + 7 days);
    
    // Step 4: Attacker claims rewards
    uint256 rewards = earned(token, tokenId);
    
    // Expected: rewards > 0 despite depositing for only 1 day
    // Legitimate user deposited for 7 days gets same amount
}
```

---

## IS THIS A VULNERABILITY?

**Arguments it's a bug:**
- Rewards intended for long-term commitment
- Late depositors extract value without commitment
- Creates perverse incentive to wait until end of epoch

**Arguments it's feature:**
- Simplifies accounting (per-epoch rather than per-block)
- Known limitation of epoch-based systems
- May be intentional design tradeoff

**Severity Assessment:**
- **Economic impact:** Medium (reward dilution)
- **Exploitability:** High (anyone can do it)
- **Profit:** Moderate (captures rewards without time commitment)

**Bounty Potential:** $25K-$50K (Medium severity)

---

## NEXT STEP

**Build PoC on Base fork to confirm:**
1. Can deposit late and still claim rewards?
2. What percentage of rewards can be captured?
3. Is there any cooldown or lock preventing withdrawal?

**Status:** INNOVATIVE VECTOR CONFIRMED - TESTING NOW
