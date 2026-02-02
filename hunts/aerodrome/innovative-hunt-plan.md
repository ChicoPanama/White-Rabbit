# AERODROME — INNOVATIVE ATTACK VECTOR HUNT
**Date:** 2026-02-02  
**Protocol:** Aerodrome Finance  
**Hunter:** WhiteRabbit 🐇  
**Method:** Creative exploitation, not pattern matching

---

## 🎯 INNOVATION PRINCIPLE

**Stop asking:** "Does this match known patterns?"  
**Start asking:** "How can I creatively break this specific protocol's unique mechanics?"

---

## UNIQUE AERODROME MECHANICS TO EXPLOIT

### 1. ve(3,3) TIME-DECAY VOTING POWER

**The Mechanic:**
- Voting power decays linearly over 4 years
- `balanceOfNFTAt(tokenId, timestamp)` gives historical power
- Votes are time-weighted snapshots

**Innovative Attack Vectors:**

**Vector 1A: Vote Snapshot Timing Manipulation**
```
Idea: Aerodrome uses balanceOfNFTAt(timestamp) for historical voting
Question: Can I manipulate what timestamp is used?

Attack Path:
1. Lock AERO for 4 years (max voting power)
2. Wait until just before vote decay starts
3. Call vote() at optimal moment
4. Immediately withdraw/reduce lock
5. Did I capture max voting power while minimizing lock time?

Check: How is timestamp determined in _vote() function?
```

**Vector 1B: Voting Power Double-Counting Through Delegation**
```
Idea: Managed NFTs aggregate voting power
Question: Can I get voting power counted twice?

Attack Path:
1. Create veNFT A with 1000 AERO locked
2. Delegate to managed NFT M
3. Managed NFT M votes with aggregated power
4. Can I also vote with my original veNFT A?
5. Or: Split my veNFT, delegate both parts to different managed NFTs?

Check: Are delegated tokens prevented from voting directly?
```

**Vector 1C: Time-Travel Voting (Flash Voting)**
```
Idea: Can I manipulate block.timestamp perception?
Question: Does the protocol rely on current timestamp or stored checkpoints?

Attack Path:
1. Flashloan AERO
2. Lock at block N (high voting power)
3. Vote in same transaction (timestamp = N)
4. Immediately unlock (if possible)
5. Repay flashloan

Check: Is there minimum lock duration? Can I unlock immediately?
```

---

### 2. MANAGED NFT DELEGATION GAMING

**The Mechanic:**
- Users delegate voting power to "managed" veNFTs
- Managed NFTs earn fees but user retains ownership
- Rewards split between user and manager

**Innovative Attack Vectors:**

**Vector 2A: The Delegation Sandwich**
```
Idea: Deposit before reward snapshot, withdraw after
Question: Are rewards calculated at deposit time or claim time?

Attack Path:
1. Wait for fees to accumulate in gauge
2. Quickly deposit into managed NFT just before reward calculation
3. Claim rewards proportional to my deposit
4. Immediately withdraw
5. Did I extract rewards without long-term commitment?

Check: When is reward rate calculated? At deposit or continuously?
```

**Vector 2B: Cross-Managed NFT Arbitrage**
```
Idea: Different managed NFTs have different reward rates
Question: Can I arbitrage between managed NFTs?

Attack Path:
1. Deposit into managed NFT A with high APR
2. Wait for rewards to accumulate
3. Withdraw and immediately deposit into managed NFT B with higher APR
4. Capture both reward streams?

Check: Is there withdrawal cooldown? Reward accrual timing?
```

**Vector 2C: Manager Fee Exploitation**
```
Idea: Manager takes cut of rewards
Question: Can I become a manager and extract value?

Attack Path:
1. Create managed NFT with 0% fee (or minimum)
2. Attract many delegators with low fees
3. Wait for significant TVL
4. Abruptly increase manager fee to maximum
5. Extract maximum rewards before delegators withdraw

Check: Can manager fee be changed instantly? Is there timelock?
```

---

### 3. REBASE + EMISSION INTERACTION

**The Mechanic:**
- Rebases: Compounding rewards for veNFT holders (anti-dilution)
- Emissions: New AERO minted weekly for gauges
- Both happen at epoch boundaries

**Innovative Attack Vectors:**

**Vector 3A: The Rebase-Emission Sandwich**
```
Idea: Rebases happen at updatePeriod(), emissions distributed to gauges
Question: Can I capture both rebase and emission optimally?

Attack Path:
1. Have veNFT locked
2. Call updatePeriod() at exact epoch boundary
3. Claim rebase immediately
4. Vote for high-emission gauge
5. Collect gauge rewards
6. Did I capture maximum value at exact right moment?

Check: Is there race condition between rebase claim and voting?
```

**Vector 3B: Rebase Dilution Attack**
```
Idea: Rebases are proportional to total supply
Question: Can I manipulate my share of rebases?

Attack Path:
1. Lock large amount of AERO right before rebase
2. Rebase calculation includes my new lock
3. Immediately unlock after rebase
4. Did I capture rebase without 4-year lock commitment?

Check: When is totalSupply() snapshot taken for rebase?
```

**Vector 3C: Double-Dipping Rebases**
```
Idea: Rebases go to locked AERO, increasing voting power
Question: Can I claim rebase multiple times?

Attack Path:
1. Lock AERO, get veNFT
2. Rebase increases locked amount
3. Split veNFT into multiple tokens
4. Each new veNFT gets proportional share
5. Do multiple smaller veNFTs get more rebases than one large one?

Check: Does splitting preserve total rebase entitlement?
```

---

### 4. GAUGE MANIPULATION

**The Mechanic:**
- Gauges distribute emissions based on votes
- Fees accumulate in gauges and go to voters
- Can create gauges for any pool

**Innovative Attack Vectors:**

**Vector 4A: The Fake Pool Gauge Attack**
```
Idea: Anyone can create gauges for pools
Question: Can I create a gauge that extracts value?

Attack Path:
1. Create fake pool with myself as only liquidity provider
2. Create gauge for fake pool
3. Vote for my own gauge with significant veNFT power
4. Receive emissions (AERO) from protocol
5. Extract value even though pool has no real volume

Check: Are there requirements for pool legitimacy? Minimum liquidity?
```

**Vector 4B: Gauge Weight Manipulation**
```
Idea: Emissions proportional to gauge weight
Question: Can I manipulate weight calculation?

Attack Path:
1. Concentrate votes on specific gauge at last moment
2. Emission calculation uses this weight
3. Immediately reset votes after calculation
4. Did I capture disproportionate emissions?

Check: When is weight snapshot taken for emission calculation?
```

**Vector 4C: Fee Extraction Through Gauge Poisoning**
```
Idea: Fees go to gauge voters
Question: Can I extract fees without real trading?

Attack Path:
1. Create pool with high fee (1%)
2. Create gauge
3. Self-trade to generate fees
4. Vote for own gauge
5. Collect fees as "voter"
6. Value extracted from myself, but protocol emissions subsidize?

Check: Do emissions outweigh self-trading costs?
```

---

### 5. ROUTER MULTI-HOP EXPLOITATION

**The Mechanic:**
- Router allows multi-hop swaps through multiple pools
- Routes can be complex and include intermediate tokens

**Innovative Attack Vectors:**

**Vector 5A: The Multi-Hop Sandwich**
```
Idea: Multi-hop routes touch multiple pools
Question: Can I sandwich multi-hop swaps more profitably?

Attack Path:
1. Monitor for large multi-hop swaps
2. Front-run by manipulating first pool
3. Victim's swap propagates through multiple pools
4. Back-run by manipulating last pool
5. Did multi-hop amplify sandwich profit?

Check: Are multi-hop swaps atomic? Can I manipulate intermediate pools?
```

**Vector 5B: Route Poisoning**
```
Idea: Router finds "optimal" routes
Question: Can I manipulate route selection?

Attack Path:
1. Create shallow pool with extreme pricing
2. Trick router into selecting my pool for part of route
3. Extract value from price discrepancy
4. Router thinks it's optimal, but it's exploitable

Check: How does router calculate "optimal"? Can it be gamed?
```

---

### 6. EPOCH BOUNDARY GAMING

**The Mechanic:**
- Protocol operates in 1-week epochs
- Critical state changes at epoch boundaries
- updatePeriod() triggers many actions

**Innovative Attack Vectors:**

**Vector 6A: The Epoch Flip Attack**
```
Idea: Many operations restricted to specific epoch phases
Question: Can I exploit atomicity at epoch boundaries?

Attack Path:
1. Wait for epoch N to end (block.timestamp >= activePeriod + WEEK)
2. In single transaction:
   - Call updatePeriod() (starts epoch N+1)
   - Immediately vote (onlyNewEpoch allows voting)
   - Claim rewards from epoch N
   - Reset votes for next manipulation
3. Did I capture value from two epochs simultaneously?

Check: Are these operations order-dependent? Atomicity possible?
```

**Vector 6B: Voting Window Exploitation**
```
Idea: Votes only allowed during specific window
Question: Can I manipulate timing to extend voting power?

Attack Path:
1. Vote at very end of voting window
2. Wait for new epoch
3. Try to vote again immediately
4. onlyNewEpoch modifier prevents, but...
5. Can I manipulate lastVoted timestamp perception?

Check: Is lastVoted based on block.timestamp or transaction order?
```

---

## 🔬 INNOVATIVE HUNTING EXECUTION PLAN

**Phase 1: Deep Mechanic Understanding (30 min)**
1. Map exact timing of all operations
2. Identify state change dependencies
3. Find atomic operation sequences

**Phase 2: Attack Vector Testing (2 hours)**
1. Pick 3 most promising vectors from above
2. Build PoCs for each
3. Test on Base mainnet fork

**Phase 3: Economic Analysis (30 min)**
1. Calculate profit for each successful vector
2. Factor in gas costs on Base
3. Determine if profitable at scale

**Phase 4: Documentation (30 min)**
1. Document confirmed vulnerabilities
2. Draft exploit scenarios
3. Prepare bounty submissions

---

## 🎯 TARGET PRIORITIES

**Highest Innovation Potential:**
1. **Vector 2A** — Delegation Sandwich (if rewards calculated at snapshot)
2. **Vector 3B** — Rebase Dilution (if supply snapshot timing wrong)
3. **Vector 4A** — Fake Pool Gauge (if no legitimacy checks)
4. **Vector 6A** — Epoch Flip (if atomic operations possible)

**Testing Order:**
1. Start with Vector 4A (easiest to test — create fake pool)
2. Move to Vector 2A (requires delegation timing)
3. Test Vector 3B (requires rebase timing analysis)
4. Attempt Vector 6A (requires complex transaction)

---

**STATUS:** INNOVATIVE HUNT BEGINS — CREATING NOVEL ATTACK VECTORS
