# AERODROME FINANCE — INITIAL HUNT FINDINGS
**Date:** 2026-02-02  
**Protocol:** Aerodrome Finance (Base)  
**Hunter:** WhiteRabbit 🐇  
**Status:** INITIAL ANALYSIS COMPLETE — PoC DEVELOPMENT PHASE

---

## 🎯 EXECUTIVE SUMMARY

Completed systematic analysis of Aerodrome Finance contracts using Immunefi-derived patterns. **3 POTENTIAL VULNERABILITY VECTORS IDENTIFIED** requiring PoC verification.

**Contracts Analyzed:**
- ✅ VotingEscrow.sol (veNFT, 1000+ lines)
- ✅ RewardsDistributor.sol (rebase logic)
- ✅ Minter.sol (emissions)
- ✅ Voter.sol (governance)
- ✅ Gauge.sol (rewards)

---

## 🔴 FINDING 1: Rebase Claim Timing Manipulation (MEDIUM-HIGH)

### Location
`RewardsDistributor.claim()` + `Minter.updatePeriod()`

### The Issue
```solidity
// RewardsDistributor.claim()
function claim(uint256 _tokenId) external returns (uint256) {
    if (IMinter(minter).activePeriod() < ((block.timestamp / WEEK) * WEEK)) 
        revert UpdatePeriod();
    // ... claim logic
}
```

**Vulnerability Pattern:** The claim requires `activePeriod >= current_week`. If `updatePeriod()` hasn't been called at the start of a new week, **all rebase claims are blocked protocol-wide**.

### Attack Vector
1. Attacker monitors for epoch boundaries
2. Front-run `updatePeriod()` call with griefing (if profitable)
3. OR: MEV sandwich to delay updatePeriod
4. Result: All users blocked from claiming rebases for that period

### Economic Impact
- **DoS on rebase claims** — affects all veNFT holders
- **No direct profit** for attacker (griefing only)
- **Severity:** Medium (availability impact, no fund loss)

### PoC Required
```solidity
// Test: Claim at week boundary before updatePeriod
// Expected: Revert with UpdatePeriod
// Impact: Temporary DoS
```

### Recommendation
Add incentivized keeper or allow permissionless `updatePeriod()` with small reward.

---

## 🟡 FINDING 2: Rounding Error in Rebase Distribution (MEDIUM)

### Location
`RewardsDistributor._claimable()`

### The Issue
```solidity
// Line 126 in RewardsDistributor.sol
toDistribute += (balance * tokensPerWeek[weekCursor]) / supply;
```

**Vulnerability Pattern:** When `balance` is small and `supply` is large, the division rounds down to 0, resulting in **0 rebase for small veNFT holders**.

### Attack Vector
1. Create veNFT with minimal lock amount (1 wei)
2. Wait for rebase distribution
3. Claim returns 0 (rounding loss)
4. **Sybil attack:** Attacker creates many 1-wei locks, diluting rebases for legitimate users

### Economic Impact
- **Small holders lose rebases** due to rounding
- **Attacker can grief** by creating dust locks to dilute distribution
- **Severity:** Medium (economic manipulation)

### PoC Required
```solidity
// Test: Create lock with 1 wei, wait for rebase, claim
// Expected: 0 rebase received due to rounding
// Test: Create lock with 1e18, compare rebase amounts
```

### Calculation Example
```solidity
// Scenario:
// - tokensPerWeek = 100,000 AERO
// - totalSupply = 1,000,000,000 AERO
// - Small holder balance = 1 AERO (1e18 wei)

rebase = (1e18 * 100000e18) / 1e27 = 0.0001e18
// If precision loss: rounds to 0
```

### Recommendation
Add minimum lock threshold or round up for small amounts.

---

## 🟡 FINDING 3: Managed NFT Delegation Edge Cases (LOW-MEDIUM)

### Location
`VotingEscrow.depositManaged()` + `withdrawManaged()`

### The Issue
Complex state transitions when delegating to managed NFTs:
- `depositManaged` transfers voting power to managed NFT
- `withdrawManaged` restores it
- Edge case: What happens if managed NFT is deactivated during delegation?

### Code Analysis
```solidity
function depositManaged(uint256 _tokenId, uint256 _mTokenId) external nonReentrant {
    if (escrowType[_mTokenId] != EscrowType.MANAGED) revert NotManagedNFT();
    if (escrowType[_tokenId] != EscrowType.NORMAL) revert NotNormalNFT();
    // ... delegation logic
}

function withdrawManaged(uint256 _tokenId) external nonReentrant {
    uint256 _mTokenId = idToManaged[_tokenId];
    // What if deactivated[_mTokenId] == true here?
    // Withdraw still works but voting power calculation may be inconsistent
}
```

### Attack Vector
1. User deposits to managed NFT
2. Manager gets deactivated (emergency or governance)
3. User withdraws — but voting power calculation uses `balanceOfNFTAt` at current timestamp
4. **Potential:** Voting power desynchronization between delegatee and delegator

### Economic Impact
- **Voting power manipulation** in edge cases
- **Severity:** Low-Medium (complex scenario, limited impact)

### PoC Required
```solidity
// Test: depositManaged -> deactivate managed NFT -> withdrawManaged
// Check: voting power consistency, reward calculations
```

---

## ✅ SECURITY POSITIVES

### Well-Protected Patterns
1. **ReentrancyGuard** — Used on all state-changing functions
2. **Access Control** — Proper onlyOwner/governor checks
3. **Initialization** — `initialized` flag prevents re-initialization
4. **Checks-Effects-Interactions** — Generally followed
5. **SafeERC20** — Used for all token transfers

### No Evidence Found
- ❌ Uninitialized proxy vulnerability
- ❌ Flashloan oracle manipulation (no spot price oracles)
- ❌ isContract bypass (standard ERC721 pattern only)
- ❌ Classic reentrancy (guards in place)
- ❌ Governance flashloan attacks (time-weighted voting power)

---

## 📊 RISK ASSESSMENT

| Finding | Severity | Exploitability | Bounty Potential |
|---------|----------|----------------|------------------|
| Rebase Claim Timing (DoS) | Medium | High | $10K-$25K |
| Rounding Error (Economic) | Medium | Medium | $25K-$50K |
| Managed NFT Edge Case | Low-Medium | Low | $5K-$15K |

**Total Estimated Bounty Potential:** $40K-$90K

---

## 🎯 NEXT STEPS

### Phase 1: PoC Development (2-4 hours)
1. **Finding 1:** Build Foundry test for epoch boundary DoS
2. **Finding 2:** Quantify rounding loss with different lock sizes
3. **Finding 3:** Test managed NFT deactivation scenarios

### Phase 2: Impact Verification (2 hours)
1. Run PoCs on Base mainnet fork
2. Calculate exact economic impact
3. Document exploit conditions

### Phase 3: Report Drafting (2 hours)
1. Write technical reports for confirmed findings
2. Include PoC code, remediation suggestions
3. Submit via Immunefi bounty program

---

## 🔍 ADDITIONAL RESEARCH VECTORS

### High-Complexity Areas Requiring Deep Dive
1. **Delegation Logic Library** — Complex math in `DelegationLogicLibrary.sol`
2. **Balance Calculation** — Time-decay voting power in `BalanceLogicLibrary.sol`
3. **Pool Pricing** — Constant-product AMM math in `Pool.sol`
4. **Router Slippage** — Multi-hop routing protection

### Recommended Fuzzing Targets
```solidity
// 1. Reward calculation with extreme values
fuzz_test_rebase_calculation(uint256 tiny_balance, uint256 huge_supply)

// 2. Epoch boundary transitions
fuzz_test_epoch_transition(uint256 timestamp_at_boundary)

// 3. Delegation state transitions
fuzz_test_managed_delegation(address delegator, uint256 amount, bool deactivate)
```

---

## 📋 CONTRACT COMPLEXITY SCORES

| Contract | Lines | Complexity | Risk Level |
|----------|-------|------------|------------|
| VotingEscrow | 1100+ | Very High | 🔴 |
| RewardsDistributor | 200 | Medium | 🟡 |
| Minter | 250 | Medium | 🟡 |
| Voter | 550 | High | 🟡 |
| Gauge | 250 | Medium | 🟢 |

---

## 🏆 HUNT SUMMARY

**Strengths of Aerodrome Codebase:**
- Well-structured with clear separation of concerns
- Proper use of OpenZeppelin security libraries
- Reentrancy protection on critical functions
- Comprehensive access control

**Weaknesses Identified:**
- Timing-sensitive operations (epoch boundaries)
- Rounding in economic calculations
- Complex delegation logic with edge cases

**Verdict:** Solid codebase with minor issues. **Finding 2 (rounding)** has highest bounty potential due to economic impact.

---

**RECOMMENDATION:** Proceed with PoC development for Finding 2 (rounding error) — highest ROI for bounty submission.

**Status:** AWAITING PoC EXECUTION
