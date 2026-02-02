# AERODROME FINANCE — COMPREHENSIVE VULNERABILITY HUNT
**Date:** 2026-02-02  
**Protocol:** Aerodrome Finance (Base)  
**Hunter:** WhiteRabbit 🐇  
**Status:** ACTIVE HUNT

---

## 📋 CONTRACT LANDSCAPE

| Contract | Address | Type | Risk Profile |
|----------|---------|------|--------------|
| **VotingEscrow** | 0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4 | veNFT (ERC721) | 🔴 HIGH — Custom logic, merge/split features |
| **Minter** | 0xeB018363F0a9Af8f91F06FEe6613a751b2A33FE5 | Emissions | 🟡 MEDIUM — Mint authority, rebase logic |
| **Voter** | 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5 | Governance | 🔴 HIGH — Vote delegation, gauge rewards |
| **Router** | 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43 | DEX Router | 🟡 MEDIUM — Swap routing, slippage handling |
| **PoolFactory** | 0x420DD381b31aEf6683db6B902084cB0FFECe40Da | Factory | 🟢 LOW — Pool creation |
| **GaugeFactory** | 0x35f35cA5B132CaDf2916BaB57639128eAC5bbcb5 | Factory | 🟢 LOW — Gauge creation |
| **RewardsDistributor** | 0x227f65131A261548b057215bB1D5Ab2997964C7d | Rebase | 🔴 HIGH — Rebase distribution logic |
| **AERO Token** | 0x940181a94A35A4569E4529A3CDfB74e38FD98631 | ERC20 | 🟡 MEDIUM — Minter authority |

---

## 🎯 HUNT PHASE 1: PATTERN MATCHING (Applying Immunefi Intel)

### Pattern 1: Uninitialized Proxy (V09) — $10M Category
**Check:** All upgradeable contracts

**Targets:**
- ✅ VotingEscrow — Proxy pattern? Checking...
- ✅ VeArtProxy — Explicitly upgradeable
- ✅ ProtocolGovernor — Governance contract

**Analysis Needed:**
1. Are implementations initialized?
2. Can initialize() be front-run?
3. UUPS vs Transparent proxy pattern?

### Pattern 2: Rounding Error (V06) — The Graph Pattern
**Check:** Fee calculations, rebase math, reward distributions

**Targets:**
- 🔍 Minter.sol — Emission calculations
- 🔍 RewardsDistributor — Rebase calculations
- 🔍 Gauge — Reward distribution math

**Specific Checks:**
```solidity
// Look for: (amount * percent) / DENOM
// When amount < DENOM/percent, fee rounds to 0

// Minter emission calculation
// RewardsDistributor rebase math
// Gauge rewardPerToken calculations
```

### Pattern 3: Reentrancy (V07) — Omni Protocol Pattern
**Check:** External calls before state updates

**Targets:**
- 🔍 VotingEscrow — NFT transfers, merge/split
- 🔍 Router — Swap callbacks
- 🔍 Gauge — Deposit/withdraw with external rewards

**Specific Checks:**
```solidity
// Look for:
// 1. safeTransferFrom before state update
// 2. External calls in deposit/withdraw
// 3. NFT callbacks (onERC721Received)
```

### Pattern 4: Access Control (V04) — Beanstalk Pattern
**Check:** Privileged functions, role assignments

**Targets:**
- 🔍 Minter — Mint authority
- 🔍 Voter — Gauge creation, emission updates
- 🔍 ProtocolGovernor — Whitelist functions

**Specific Checks:**
```solidity
// Look for missing onlyOwner
// Look for improper role checks
// Look for initialize() without access control
```

### Pattern 5: Input Validation (V01) — Beanstalk Mode Pattern
**Check:** Multi-mode functions, parameter validation

**Targets:**
- 🔍 VotingEscrow — merge, split, managed NFTs
- 🔍 Router — Multi-hop routes
- 🔍 Voter — Vote delegation modes

**Specific Checks:**
```solidity
// Look for functions with mode parameters
// Check if all modes have consistent validation
// Look for EXTERNAL/INTERNAL mode gaps
```

### Pattern 6: Flashloan + Price Manipulation (V03) — Cream Pattern
**Check:** Oracle usage, spot price dependencies

**Targets:**
- 🔍 Router — Slippage protection
- 🔍 Pool — Pricing calculations
- 🔍 Gauge — LP token valuation

**Specific Checks:**
```solidity
// Look for getReserves() usage without TWAP
// Look for spot price in collateral calculations
// Check slippage tolerances
```

---

## 🔍 PRIORITY TARGET: VotingEscrow (veNFT)

**Why:** Highest complexity, custom features (merge, split, managed NFTs), ERC721 callbacks

### Code Structure Analysis
```solidity
// Key functions to analyze:
1. createLock() — Initial lock creation
2. increaseAmount() — Add to existing lock
3. extendLock() — Extend unlock time
4. merge() — Merge two veNFTs
5. split() — Split veNFT into multiple
6. createManagedNFT() — Managed NFT creation
7. depositIntoManagedNFT() — Delegation to managed
8. withdrawFromManagedNFT() — Undelegation
```

### Attack Vectors to Test:

**Vector 1: Merge/Split Reentrancy**
- Does merge transfer NFTs before updating state?
- Can split be reentered during execution?

**Vector 2: Managed NFT Deposit Timing**
- Deposit into managed → claim rebase → withdraw
- Is rebase calculated correctly during the epoch?

**Vector 3: Lock Time Manipulation**
- extendLock() rounding behavior
- Can we minimize lock extension via rounding?

**Vector 4: Permission Bypass**
- Who can call merge/split?
- Are approvals checked correctly?

---

## 🔍 PRIORITY TARGET: RewardsDistributor

**Why:** Rebase calculations, complex timing, potential for precision loss

### Key Function: claim()
```solidity
// Rebase claim logic
// Checks:
// 1. Rounding in rebase calculation
// 2. Epoch boundary conditions
// 3. Double-claim prevention
// 4. Expired veNFT handling
```

### Attack Vectors:

**Vector 1: Rebase Rounding Exploitation**
- Small veNFT positions may have rounding advantages
- Test with 1 wei vs 1 ether lock amounts

**Vector 2: Epoch Flip Timing**
- Claim at exact epoch boundary
- Is rebase calculated from correct snapshot?

**Vector 3: Expired veNFT Rebase Theft**
- "Rebase claims against expired veNFTs distributed as unlocked AERO"
- Can this be exploited for extra yield?

---

## 🔍 PRIORITY TARGET: Minter

**Why:** Emission calculations, mint authority, inflation control

### Key Functions:
```solidity
1. updatePeriod() — Epoch transition
2. calculateGrowth() — Emission growth
3. notifyRewardAmount() — Gauge rewards
```

### Attack Vectors:

**Vector 1: Emission Calculation Precision**
- Growth formula: `emissions = prior_emissions * growth_rate`
- Rounding behavior when growth_rate is small

**Vector 2: Front-running updatePeriod()**
- Call updatePeriod() at epoch boundary
- Can we manipulate timing for better rates?

**Vector 3: Rebase vs Emission Double Counting**
- Are rebases properly excluded from emissions?
- Can we claim both rebase and emission on same tokens?

---

## 🔍 PRIORITY TARGET: Voter

**Why:** Vote delegation, gauge rewards, complex reward distribution

### Key Functions:
```solidity
1. vote() — Cast votes for gauges
2. reset() — Reset votes
3. poke() — Update vote weights
4. distribute() — Distribute emissions
5. createGauge() — Create new gauge
```

### Attack Vectors:

**Vector 1: Vote Manipulation**
- Flashloan AERO → lock → vote → unlock
- Is there a lock duration requirement?

**Vector 2: Vote Reset Timing**
- Reset votes → immediate revote
- Can we double-dip on rewards?

**Vector 3: Gauge Creation Spam**
- Can anyone create gauges?
- Governance check sufficient?

**Vector 4: Bribe Front-running**
- BribeVotingReward deposits
- Can we predict and front-run bribe distributions?

---

## 📊 SYSTEMATIC TESTING PLAN

### Phase 1: Static Analysis (Slither)
1. Run slither on all contracts
2. Flag: Reentrancy, access control, shadowing
3. Custom detectors for patterns above

### Phase 2: Manual Code Review
1. VotingEscrow merge/split logic (2 hours)
2. RewardsDistributor rebase math (2 hours)
3. Minter emission calculations (1 hour)
4. Voter delegation logic (2 hours)
5. Router slippage protection (1 hour)

### Phase 3: Fork Testing (Foundry)
1. Deploy local fork of Base
2. Test each attack vector with PoC
3. Document exploitable conditions

### Phase 4: Exploit Development
1. For confirmed vulnerabilities:
   - Develop full PoC
   - Calculate exploitable value
   - Draft bug report

---

## 🎯 IMMEDIATE ACTION ITEMS

**Next 30 minutes:**
1. ✅ Fetch all contract source code from GitHub
2. 🔄 Run slither static analysis
3. ⏳ Begin VotingEscrow deep dive

**Next 2 hours:**
4. Complete manual review of high-risk contracts
5. Identify 3-5 potential vulnerabilities
6. Prioritize by severity and exploitability

**Next 4 hours:**
7. Develop PoCs for top 2-3 findings
8. Verify on Base mainnet fork
9. Document findings

---

## 📈 SUCCESS METRICS

**Target:**
- 1 Critical finding (> $100K impact)
- OR 2-3 High findings ($25K-$100K)
- OR 5+ Medium findings with clear PoCs

**Bounty Potential:**
- Aerodrome has active bug bounty (likely via Immunefi)
- Based on TVL ($500M+), Critical bounties could reach $100K-$500K

---

**STATUS:** Hunt initiated, beginning systematic analysis

