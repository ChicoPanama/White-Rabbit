# AERODROME — REMAINING CONTRACTS INNOVATIVE HUNT
**Contracts:** Pool, Router, ProtocolGovernor, AirdropDistributor  
**Method:** Deep feature interaction analysis

---

## CONTRACT 1: Pool.sol (AMM)

### Standard Analysis (Already Done)
- Constant product formula: x * y = k
- Volatile and stable pool variants
- Fee collection

### Innovative Attack Vectors:

**Vector 1A: Custom Fee Exploitation**
```solidity
// PoolFactory allows custom fees per pool
mapping(address => uint256) public customFee;

Attack Idea:
1. Create pool with 0% fee (if possible)
2. Or create pool with 3% fee (MAX_FEE)
3. Self-trade to generate artificial volume
4. Extract value through fee mechanism

Check: Can pool creator manipulate fees to extract value?
```

**Vector 1B: Fee Accumulation Timing**
```solidity
// Fees accumulate in PoolFees.sol separate from reserves
// Claimed via gauge

Attack Idea:
1. Provide liquidity when fees are about to be claimed
2. Remove liquidity immediately after
3. Capture fees without long-term LP commitment

Check: When exactly are fees calculated? Can we time LP around fee claims?
```

**Vector 1C: Stable Pool Curve Manipulation**
```solidity
// Stable pools use different curve than constant product
// More complex pricing near 1:1

Attack Idea:
1. Manipulate stable pool away from equilibrium
2. Exploit curve asymmetry
3. Profit from pricing errors

Check: Is stable curve manipulation resistant?
```

---

## CONTRACT 2: Router.sol

### Standard Analysis
- Multi-hop routing
- Slippage protection
- Meta-transactions via ERC2771

### Innovative Attack Vectors:

**Vector 2A: Route Manipulation Through Factory Poisoning**
```solidity
function getAmountsOut(uint256 amountIn, Route[] memory routes) public view returns (uint256[] memory amounts) {
    // Router finds path through multiple pools
}

Attack Idea:
1. Create shallow pool with extreme price
2. Router might route through it as "optimal"
3. Victim gets terrible execution
4. Attacker profits from price discrepancy

Check: How does router determine "optimal" route? Can we game it?
```

**Vector 2B: Slippage Sandwich on Multi-Hop**
```solidity
// Multi-hop swaps touch multiple pools
// Each pool can be manipulated

Attack Idea:
1. Monitor for large multi-hop swaps
2. Front-run: manipulate first pool
3. Back-run: manipulate last pool
4. Amplified profit from touching multiple pools

Check: Are multi-hop swaps atomic? Can we extract from each hop?
```

**Vector 2C: Deadline Manipulation via Timezone Gaming**
```solidity
// Router uses block.timestamp for deadline
// Deadline can be set to arbitrary future time

Attack Idea:
1. Submit tx with very long deadline
2. Wait for favorable price movement
3. MEV bot executes when profitable
4. User gets worse execution than expected

Check: Is deadline actually enforced? Can users be exploited via long deadlines?
```

**Vector 2D: Meta-Transaction Replay**
```solidity
// Router uses ERC2771Context for meta-transactions
// msg.sender extracted from calldata

Attack Idea:
1. Intercept meta-transaction
2. Replay with different parameters
3. Or front-run original execution

Check: Are meta-transactions properly protected against replay/frontrunning?
```

---

## CONTRACT 3: ProtocolGovernor.sol

### Standard Analysis
- OpenZeppelin Governor pattern
- Voting with veNFT power
- Proposal execution

### Innovative Attack Vectors:

**Vector 3A: Vote Timing Manipulation**
```solidity
// Governor uses block.timestamp for voting period
// Votes counted via getVotes(account, blockNumber)

Attack Idea:
1. Wait until last minute of voting period
2. Flashloan AERO, lock, vote
3. Immediately unlock after vote
4. Did we capture voting power without long-term lock?

Check: Is voting power snapshot at proposal creation or vote time?
```

**Vector 3B: Proposal Execution Race**
```solidity
// Successful proposals can be executed by anyone after timelock

Attack Idea:
1. Create proposal with favorable parameters
2. Get it passed
3. Wait for exact moment of execution
4. Front-run execution with state manipulation

Check: Can proposal execution be front-run with state changes?
```

**Vector 3C: Vote Delegation Double-Counting**
```solidity
// Users can delegate votes
// Managed NFTs also have voting power

Attack Idea:
1. Delegate votes to address A
2. Also deposit into managed NFT
3. Does managed NFT voting double-count?
4. Can we vote twice with same underlying tokens?

Check: How is voting power calculated for delegators vs managed NFT depositors?
```

---

## CONTRACT 4: AirdropDistributor.sol

### Standard Analysis
- One-time airdrop distribution
- Permanently locked veNFTs
- Governor-only function

### Innovative Attack Vectors:

**Vector 4A: Airdrop Gaming via Sybil**
```solidity
// Airdrop is permanently locked veNFTs
// Cannot be sold/transferred easily

Attack Idea:
1. Create multiple addresses
2. Each gets airdrop
3. Merge veNFTs after distribution?
4. Or: Sell addresses on secondary market

Check: Can airdropped veNFTs be merged/split? Can sybil be profitable?
```

**Vector 4B: Distribution Timing Front-run**
```solidity
// Airdrop happens via governor function
// Timing is public

Attack Idea:
1. Monitor governance for airdrop proposal
2. Buy AERO before airdrop (if price impact positive)
3. Sell after airdrop announcement
4. Extract value from information asymmetry

Check: Is airdrop value extractable through trading?
```

---

## PRIORITY ANALYSIS

**Highest Innovation Potential:**
1. **Router Route Manipulation** (Vector 2A) - Could affect all swaps
2. **Governor Vote Timing** (Vector 3A) - Flash governance attacks
3. **Pool Fee Timing** (Vector 1B) - LP gaming

**Testing Order:**
1. Start with Vector 3A (Governor vote timing - most novel)
2. Test Vector 2A (Router route manipulation)
3. Investigate Vector 1B (Pool fee timing)

---

## IMMEDIATE ACTION

Checking Governor vote timing vulnerability now...
