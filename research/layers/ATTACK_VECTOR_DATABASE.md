# Attack Vector Database

**Layer:** 1 - Failure Modes & Attack Patterns  
**Purpose:** Catalog of abstract attack patterns for smart contract analysis

---

## Reentrancy Patterns

### Pattern: REENTRANCY-001 - Single-Function Reentrancy
**Severity:** Critical  
**Confidence:** High

**Description:** External call made before state update, allowing recursive reentry.

**Vulnerable Code:**
```solidity
function withdraw() external {
    uint amount = balances[msg.sender];
    msg.sender.call{value: amount}("");  // External call FIRST
    balances[msg.sender] = 0;            // Update AFTER
}
```

**Detection:**
- External call before state change
- No reentrancy guard
- User-controlled call target

**Mitigation:**
- Checks-Effects-Interactions pattern
- ReentrancyGuard modifier
- Pull over push pattern

**Historical:** DAO (2016), Multiple lending protocols

---

### Pattern: REENTRANCY-002 - Cross-Function Reentrancy
**Severity:** Critical  
**Confidence:** Medium

**Description:** Reentry into different function with shared state.

**Vulnerable Code:**
```solidity
function withdraw() external {
    uint amount = balances[msg.sender];
    balances[msg.sender] = 0;
    msg.sender.call{value: amount}("");  // Reenters transfer()
}

function transfer(address to, uint amount) external {
    balances[msg.sender] -= amount;  // Uses stale balance
    balances[to] += amount;
}
```

**Detection:**
- Multiple functions accessing shared state
- External call in one function
- State inconsistency possible

**Mitigation:**
- Mutex locks across all state-changing functions
- Complete state updates before any external call

---

### Pattern: REENTRANCY-003 - Read-Only Reentrancy
**Severity:** Medium  
**Confidence:** Medium

**Description:** Reentrancy that doesn't change state but reads inconsistent values.

**Impact:** Price oracle manipulation, incorrect liquidations

**Historical:** Curve Finance (2023)

---

## Access Control Patterns

### Pattern: ACCESS-001 - Missing Authorization
**Severity:** Critical  
**Confidence:** High

**Description:** Sensitive function lacks access control.

**Vulnerable Code:**
```solidity
function mint(address to, uint amount) external {  // No modifier!
    _mint(to, amount);
}
```

**Detection:**
- State-changing functions without access modifiers
- Critical operations (mint, burn, upgrade) unprotected

**Historical:** Multiple protocols, Parity Multisig

---

### Pattern: ACCESS-002 - Ownership Transfer to Zero
**Severity:** Medium  
**Confidence:** High

**Description:** Ownership can be transferred to zero address, locking contract.

**Vulnerable Code:**
```solidity
function transferOwnership(address newOwner) external onlyOwner {
    owner = newOwner;  // No validation
}
```

**Mitigation:**
- Two-step ownership transfer (propose + accept)
- Zero address validation

---

## Oracle Manipulation Patterns

### Pattern: ORACLE-001 - Single-Source Price
**Severity:** High  
**Confidence:** High

**Description:** Protocol uses single DEX as price oracle.

**Attack:**
1. Flash loan to manipulate DEX price
2. Protocol reads manipulated price
3. Exploit price-dependent logic
4. Repay flash loan

**Mitigation:**
- Multiple independent oracles
- TWAP with long window
- Circuit breakers

**Historical:** Mango Markets, Alpha Homora, Venus

---

### Pattern: ORACLE-002 - Stale Price
**Severity:** Medium  
**Confidence:** Medium

**Description:** Oracle price not updated, stale data used.

**Vulnerable Code:**
```solidity
function getPrice() external view returns (uint) {
    return lastPrice;  // May be hours/days old
}
```

**Mitigation:**
- Staleness checks (require block.timestamp - lastUpdate < MAX_AGE)
- Fallback oracles

---

## Arithmetic Patterns

### Pattern: ARITH-001 - Integer Overflow/Underflow
**Severity:** Critical (pre-0.8) / Medium (post-0.8)  
**Confidence:** High

**Pre-Solidity 0.8:** Wraparound, fund extraction possible  
**Post-Solidity 0.8:** Revert on overflow (DoS vector)

**Vulnerable Code:**
```solidity
// Pre-0.8
uint8 x = 255;
x += 1;  // Wraps to 0

// Post-0.8 with unchecked
unchecked { x += 1; }  // Reverts
```

**Historical:** Numerous exploits pre-0.8

---

### Pattern: ARITH-002 - Division Before Multiplication
**Severity:** Medium  
**Confidence:** Medium

**Description:** Precision loss due to integer division truncation.

**Vulnerable Code:**
```solidity
uint result = (a / b) * c;  // Loses precision
// vs
uint result = (a * c) / b;  // More precise
```

---

### Pattern: ARITH-003 - Exchange Rate Manipulation
**Severity:** High  
**Confidence:** High

**Description:** Inflate share price via direct token transfers.

**Attack:**
1. Deposit small amount, receive shares
2. Directly transfer tokens to contract
3. Share price inflates (totalAssets / totalShares)
4. Withdraw at inflated rate

**Historical:** Hundred Finance, Multiple Compound forks

**Mitigation:**
- Virtual shares/offsets
- Internal balance tracking
- Donation resistance

---

## Upgradeability Patterns

### Pattern: UPGRADE-001 - Uninitialized Implementation
**Severity:** Critical  
**Confidence:** High

**Description:** Implementation contract can be self-destructed.

**Attack:**
1. Find implementation contract address
2. Call initialize() (no access control)
3. Become owner
4. Call kill()/selfdestruct()
5. All proxies broken

**Historical:** Parity Multisig (second hack)

**Mitigation:**
- `_disableInitializers()` in constructor
- Implementation initialization on deploy

---

### Pattern: UPGRADE-002 - Storage Collision
**Severity:** High  
**Confidence:** Medium

**Description:** Upgrade changes storage layout, corrupting state.

**Vulnerable Code:**
```solidity
// V1
uint256 public value;
address public owner;

// V2 - Variable order changed!
address public owner;
uint256 public value;
```

**Mitigation:**
- Storage gap preservation
- Eternal Storage pattern
- Storage layout verification

---

## Flash Loan Patterns

### Pattern: FLASH-001 - Flash Loan Price Manipulation
**Severity:** High  
**Confidence:** High

**Description:** Use flash loan to manipulate price oracle.

**Attack Flow:**
1. Flash borrow $50M
2. Manipulate single DEX price
3. Protocol reads manipulated price
4. Take oversized position
5. Repay flash loan
6. Protocol left with bad debt

**Mitigation:**
- Manipulation-resistant oracles
- Flash loan detection (tx.origin == msg.sender check)

---

### Pattern: FLASH-002 - Flash Loan Governance Attack
**Severity:** Critical  
**Confidence:** Medium

**Description:** Flash acquire governance tokens to pass malicious proposal.

**Historical:** Beanstalk ($180M)

**Mitigation:**
- Delegation delay
- Voting snapshot at proposal time
- Timelock on execution

---

## Blockchain Infrastructure Attack Vectors

### From SoK: Security Analysis of Blockchain-based Cryptocurrency (2025)

The following vectors target blockchain infrastructure layers beyond smart contracts:

#### Vector: TX-MALLEABILITY-001 - Transaction Malleability
**Classification:** Data Layer | Double-Spend Variant  
**Severity:** High  
**Confidence:** Medium

**Description:** Modify transaction signature without changing output, creating duplicate transaction IDs.

**Mechanism:**
1. Attacker requests withdrawal
2. Victim creates transaction with ID X
3. Attacker modifies signature → creates transaction with ID Y (same inputs/outputs)
4. Transaction Y confirms first
5. Attacker claims transaction X "failed" (appears unconfirmed)
6. Victim resends funds → double payment extracted

**Prerequisites:**
- Pre-SegWit blockchain OR vulnerable wallet implementation
- Exchange/wallet uses transaction ID for confirmation tracking

**Affected Systems:**
- Pre-SegWit Bitcoin (2010-2017)
- Exchanges with poor confirmation logic

**Mitigation:**
- Segregated Witness (SegWit) - signature separation
- Multi-signature requirements
- Transaction ID confirmation before crediting
- Monitor for duplicate transaction outputs

**Detection:**
- Third-party monitoring: blockchain.info, TradeBlock
- Verify transaction outputs, not just IDs

**Historical:** Mt. Gox (claimed), various exchange incidents (2013-2017)

---

#### Vector: ECLIPSE-001 - Eclipse Attack
**Classification:** Network Layer | Node Isolation  
**Severity:** High  
**Confidence:** Medium

**Description:** Isolate target node by controlling all peer connections, feeding false blockchain state.

**Mechanism:**
1. Attacker uses P2P flooding to force victim to disconnect from honest peers
2. Victim restarts (or attacker forces restart)
3. Attacker tampers with victim's routing table
4. Victim reconnects only to malicious nodes controlled by attacker
5. Victim receives false blockchain state
6. Attacker exploits isolated state for double-spend or censorship

**Prerequisites:**
- Attacker can force victim node restart
- Attacker controls sufficient nodes in network
- Victim's routing table can be manipulated

**Impact:**
- Double-spending against isolated victim
- Transaction censorship
- Partition from honest network

**Mitigation:**
- Increase number of network nodes (reduces single-node influence)
- Connect only to trusted/verified nodes
- Node security hardening (firewalls, IDS)
- Verification mechanisms for new node connections

**Detection:**
- Adjacency relationship analysis (Alangot et al., 2021)
- ML-based detection on Ethereum (Xu et al., 2020)
- Analyze transaction data and node connectivity

---

#### Vector: DEFER-BOMB-001 - Transaction Delay (Defer Bomb)
**Classification:** Network Layer | Congestion Attack  
**Severity:** Medium  
**Confidence:** Medium

**Description:** Flood network with delayed transactions to cause congestion and disrupt Lightning Network.

**Mechanism:**
1. Attacker broadcasts large number of transactions
2. Transactions not immediately recorded in blocks
3. Confirmation times delayed
4. Network resources consumed
5. Lightning Network hash-time-lock security affected

**Impact:**
- Network congestion
- Reduced performance
- Lightning Network time-lock disruption
- Often precursor to other attacks

**Prerequisites:**
- Low transaction fees
- Network with congestion vulnerability

**Mitigation:**
- Dynamic fee adjustment (Gas optimization)
- Transaction processing queue optimization
- Reduce time thresholds for pending transactions
- Increase attack cost via fees

**Trade-offs:**
- Aggressive fee increases may impact legitimate users
- Queue optimization may affect transaction ordering guarantees

---

#### Vector: SYBIL-001 - Sybil Attack (Consensus)
**Classification:** Consensus Layer | Identity Manipulation  
**Severity:** Critical  
**Confidence:** High

**Description:** Create multiple fake identities to influence consensus process in authorized mechanisms.

**Mechanism:**
1. Attacker creates t fake accounts
2. In authorized consensus, each account = equal influence
3. If t ≥ s (fake ≥ legitimate accounts), attacker controls consensus
4. Attacker forces incorrect consensus decisions

**Prerequisites:**
- Authorized consensus mechanism (1 account = 1 vote)
- Low cost of account creation
- No identity verification

**Targets:**
- PoS systems
- DPoS systems
- Any "one person one vote" blockchain governance

**Mitigation:**
- Identity verification mechanisms (may increase centralization)
- Increase cost of account creation
- Hybrid consensus (PoW + PoS) to increase attack cost
- Multi-factor identity verification for new nodes

**Trade-offs:**
- Identity verification reduces decentralization
- Higher account costs may exclude legitimate users

---

#### Vector: 51PERCENT-001 - 51% Attack (PoW)
**Classification:** Consensus Layer | Majority Control  
**Severity:** Critical  
**Confidence:** High

**Description:** Control >50% of network hash rate to dominate block production and manipulate chain.

**Mechanism:**
1. Attacker acquires >50% of network computational power
2. Attacker mines privately on alternative chain
3. When alternative chain exceeds main chain, attacker publishes
4. Honest chain is orphaned
5. Attacker controls transaction history

**Sub-attacks Enabled:**
- Double-spending: Reverse transactions
- Transaction censorship: Exclude specific transactions
- Selfish mining: Withhold blocks strategically
- History revision: Rewrite blockchain history

**Prerequisites:**
- Attacker controls >50% network hash rate
- Sustained control for attack duration

**Mitigation:**
- Increase honest node computational power
- Encourage more miners (decentralize hash rate)
- Hybrid consensus mechanisms (PoW + PoS)
- Multi-signature for critical transactions
- Sharding to reduce attack surface

**Historical:** Various small-cap cryptocurrencies (Bitcoin Gold, Ethereum Classic)

---

#### Vector: 51PERCENT-002 - 51% Attack with Short-Selling (PoS)
**Classification:** Consensus Layer | Economic Manipulation  
**Severity:** Critical  
**Confidence:** Medium

**Description:** Borrow stake → Execute 51% attack → Depreciate token → Repay cheaper.

**Mechanism:**
1. Attacker holds stake A (sufficient for 51% attack)
2. Borrows additional stake B from exchange
3. Sells borrowed tokens at price i
4. Executes 51% attack (double-spend, network disruption)
5. Token depreciates due to attack (price l)
6. Repurchases B tokens at lower price l
7. Returns B to exchange
8. Profit: (i-l)(B-A)

**Economic Model:**
- Profit = (initial_price - depreciated_price) × (borrowed_stake - own_stake)
- Requires: (i-l)(B-A) > depreciation_loss_on_A

**Prerequisites:**
- PoS system
- Short-selling mechanism available
- Liquid market for token
- Attacker controls >50% stake in specific round

**Mitigation:**
- Restrict short-selling of staked tokens
- Stake lock-up periods
- Attack detection and slashing mechanisms
- Economic incentives for honest validation

**Source:** Lee & Kim (2020), cited in SoK 2025

---

#### Vector: SELFISH-001 - Selfish Mining
**Classification:** Application Layer | Mining Pool Exploitation  
**Severity:** Medium  
**Confidence:** Medium

**Description:** Withhold discovered blocks, mine privately, release strategically to orphan honest blocks.

**Mechanism:**
1. Attacker discovers new block first
2. Withholds block (doesn't publish)
3. Continues mining on private chain
4. Honest miners mine on public chain
5. When private chain advantage sufficient, attacker publishes
6. Honest chain orphaned, honest miner rewards invalidated

**Threshold:**
- Theoretical: Profitable at >33% hash rate
- Practical: Higher threshold due to network dynamics

**Prerequisites:**
- Significant hash rate (though <50%)
- Ability to mine privately
- Network propagation delay

**Mitigation:**
- Optimize transaction fees (economic deterrence)
- Introduce multiple consensus mechanisms (hybrid PoW/PoS)
- Random honest node selection and incentivization
- Decentralization of mining power

**Historical:** Theoretical since 2014; practical instances suspected but rarely proven

---

#### Vector: BLOCK-WITHHOLD-001 - Block Withholding Attack
**Classification:** Application Layer | Mining Pool Sabotage  
**Severity:** Medium  
**Confidence:** Medium

**Description:** Infiltrate mining pool, conceal valid shares, reduce pool revenue while profiting.

**Mechanism:**
1. Attackers split into Group A1 (infiltrators) and A2 (honest private pool)
2. A1 joins target pool with random identities
3. A1 mines with pool admin's public key
4. When A1 mines valid share, conceals it (doesn't submit)
5. Pool administrator cannot detect withholding
6. Pool revenue decreases ~13%
7. A2 mines normally in private pool, unaffected
8. Attacker profit: ~6-7% above honest mining

**Economic Model:**
- At 20% attacker hash rate: ~6-7% profit advantage
- Formula: α / 4(1-α) where α = attacker hash rate

**Variants:**
- "Destroy": Pure sabotage (no profit, costly)
- "Wait": Complex withholding with delayed publication

**Prerequisites:**
- Mining pool with shared reward mechanism
- Infiltration capability (can join with multiple identities)
- Pool distributes rewards by contribution

**Detection:**
- Statistical analysis of share submission rates
- Cross-check methods comparing expected vs. actual blocks
- Monitor block production time vs. difficulty adjustment
- Hash rate variance analysis

**Mitigation:**
- Forfeiture mechanism (penalize entire pool for detected withholding)
- Robust consensus protocol within pools
- Optimized reward distribution
- Agent-based monitoring of suspicious pools

**Source:** SoK 2025 (Chen et al., 2023; Mihaljević et al., 2022)

---

## Sources

Attack patterns compiled from:
- **Smart Contract Security Field Guide** (scsfg.io) - Reentrancy, access control
- **ConsenSys Smart Contract Best Practices** - Known attacks catalog
- **Solidity Patterns** - Security patterns and anti-patterns
- **Smart Contract Vulnerabilities** (kadenzipfel) - Vulnerability taxonomy
- **Ethernaut** (OpenZeppelin) - Historical hack reproductions
- **Quantstamp audit library** - 18 reports, 130+ findings
- **DeFiHackLabs** - Reproduced exploit patterns
- **SoK: Security Analysis of Blockchain-based Cryptocurrency** (2025) - Infrastructure layer attacks, 5-layer taxonomy

---

*Pattern database for smart contract security analysis.*
