# SoK: Security Analysis of Blockchain-based Cryptocurrency (2025) — INGESTION OUTPUT

**Source:** arXiv:2503.22156  
**Date:** 2026-02-01  
**Status:** Processing Prompts 1.1–1.4

---

## 1.1 Extract Vulnerability Taxonomy

### Five-Layer Classification System

The SoK categorizes cryptocurrency security threats into **five fundamental layers** based on blockchain infrastructure:

| Layer | Attack Types | Core Vulnerability |
|-------|--------------|-------------------|
| **Data Layer** | Collision attacks, Transaction malleability | Cryptographic integrity, double-spend variants |
| **Network Layer** | Eclipse attacks, Defer bomb (tx delay) | P2P network manipulation, congestion |
| **Consensus Layer** | Sybil attacks, 51% attacks | Consensus mechanism compromise |
| **Contract Layer** | Reentrancy, Integer overflow, Resource exhaustion | Smart contract code vulnerabilities |
| **Application Layer** | Selfish mining, Block withholding | Mining pool/economic manipulation |

### Detailed Taxonomy

#### Data Layer Attacks
1. **Collision Attack**
   - Target: Message digest algorithms (SHA-256, etc.)
   - Mechanism: Birthday paradox exploitation
   - Risk: Future threat as computational power increases
   - Status: "Future attack" — computationally infeasible currently

2. **Transaction Malleability Attack**
   - Variant of double-spend
   - Mechanism: Alter transaction signature without changing output
   - Attack flow: Request withdrawal → Modify tx ID → Double claim

#### Network Layer Attacks
1. **Eclipse Attack**
   - Target: Individual node isolation
   - Mechanism: Control all peer connections to victim
   - Enables: Double-spend, transaction censorship
   - Detection: Adjacency relationship analysis, ML-based detection

2. **Defer Bomb (Transaction Delay)**
   - Mechanism: Flood network with unconfirmed transactions
   - Impact: Lightning Network disruption, congestion
   - Often precursor to other attacks

#### Consensus Layer Attacks
1. **Sybil Attack**
   - Target: Authorized consensus (PoS, etc.)
   - Mechanism: Multiple fake identities
   - Condition: t ≥ s (fake accounts ≥ legitimate accounts)

2. **51% Attack**
   - **PoW Variant:** Control >50% hash rate
   - **PoS Variant:** Control >50% stake
   - **Short-selling Attack (PoS):** Borrow → Attack → Depreciate → Repay cheaper
   - Sub-attacks enabled: Double-spend, selfish mining, history revision

#### Contract Layer Attacks
1. **Reentrancy Attack**
   - Types: Single-function, Cross-function, Read-only
   - Mechanism: External call before state update
   - Classic pattern: withdraw() sends funds before updating balance

2. **Integer Overflow/Underflow**
   - **Overflow:** Max value + 1 → Min value (reduce purchase cost)
   - **Underflow:** Min value - 1 → Max value (drain balances)
   - EVM behavior: Automatic modulo wrapping

3. **Resource Exhaustion**
   - Target: EVM computational resources
   - Mitigation: Gas mechanism
   - Status: Largely mitigated, rarely discussed now

#### Application Layer Attacks
1. **Selfish Mining**
   - Mechanism: Withhold blocks, mine privately, release strategically
   - Impact: Honest miner rewards invalidated
   - Trigger: Release when private chain advantage sufficient

2. **Block Withholding**
   - Mechanism: Infiltrate pool, conceal valid shares
   - Economic model: 6-7% profit advantage at 20% hash rate
   - Variants: "Destroy" (sabotage) vs "Wait" (complex selfish mining)

---

## 1.2 Attacker Technique Analysis

### Attacker Capability Requirements

| Attack Type | Computational Power | Capital Required | Technical Skill |
|-------------|-------------------|------------------|-----------------|
| Collision Attack | Massive (future) | Low | High (cryptanalysis) |
| Eclipse Attack | Low | Low | Medium |
| 51% Attack (PoW) | >50% network hash | Very High | Medium |
| 51% Attack (PoS) | >50% stake | Very High | Medium |
| Sybil Attack | Low | Low (account creation) | Low |
| Reentrancy | Low | Low (gas only) | Medium |
| Selfish Mining | Significant | N/A (mining equipment) | High |
| Block Withholding | Moderate | N/A | Medium |

### Economic Viability Assessment

**High ROI Attacks:**
1. **Block Withholding:** 6-7% profit increase at 20% hash rate
2. **Reentrancy:** Near-zero cost, potentially massive gains (DAO: $60M)
3. **Short-selling 51% (PoS):** Profit = (i-l)(B-A) where i=initial price, l=depreciated price

**Break-even Required:**
- 51% Attack: Must sustain control long enough to profit > attack cost
- Selfish Mining: Requires significant hash rate (theoretical: >33% for profitability)

### Attacker Motivation Patterns

**Financial Gain (Primary):**
- Reentrancy: Direct fund extraction
- 51% Attack: Double-spend, short-selling
- Block Withholding: Mining pool advantage

**Network Disruption (Secondary):**
- Eclipse: Isolation for further attacks
- Defer bomb: Congestion, LN disruption
- History revision: Chain reorganization

**Sabotage (Tertiary):**
- Block withholding "destroy" variant
- Resource exhaustion (DoS)

### Prerequisite Conditions

| Attack | Preconditions |
|--------|--------------|
| Reentrancy | Contract uses external calls before state updates |
| 51% PoW | Attacker controls >50% hash rate |
| 51% PoS | Attacker controls >50% stake in round |
| Eclipse | Attacker can force victim node restart |
| Sybil | Authorized consensus mechanism (1 account = 1 vote) |
| Selfish mining | Attacker finds block before honest network |
| Tx malleability | Exchange/wallet uses tx ID for confirmation |

---

## 1.3 Pattern Mapping to 8 Recurring Failure Patterns

### Pattern 1: Trust But Don't Verify

**Mapped Attacks:**
- **Transaction Malleability:** Trust transaction ID as unique identifier
- **Eclipse Attack:** Trust peer nodes without verification
- **Sybil Attack:** Trust identity without verification
- **Contract external calls:** Trust called contracts

**SoK Evidence:**
> "The attacker modifies the transaction information, altering its unique identifier... The victim only sees that transaction s remains unconfirmed"

**Gap:** Pre-SegWit Bitcoin, vulnerable contract patterns

---

### Pattern 2: State Update Order Matters

**Mapped Attacks:**
- **Reentrancy:** External call before balance update (classic checks-effects-interactions violation)
- **Double-spend:** Transaction ordering manipulation
- **History revision:** Chain reorganization

**SoK Evidence:**
> "In the withdraw function of the Bank contract, the contract first checks... sends amount tokens... has not yet been completed, the attacker's recorded balance does not decrease"

**Attack Flow:**
```
Attacker calls withdraw()
    ↓
Contract sends ETH (external call)
    ↓
Fallback function triggered
    ↓
Fallback calls withdraw() again
    ↓
Balance not yet updated → check passes
    ↓
Recursive extraction
```

---

### Pattern 3: Single Point of Failure

**Mapped Attacks:**
- **51% Attack:** Concentrated hash rate/stake
- **Mining pool centralization:** Pool administrators control rewards
- **Eclipse:** Single node isolation

**SoK Evidence:**
> "If an attacker or their group controls more than half of the computational power in the blockchain network, they can initiate a 51% attack"

> "Nodes in a mining pool are divided into administrator nodes and miner nodes... only through the private key held by the administrator can new blocks be generated"

**Concentration Risks:**
- PoW: Mining pool centralization (historical: GHash.io >51%)
- PoS: Stake concentration (wealth centralization)

---

### Pattern 4: Economic Assumptions Don't Hold

**Mapped Attacks:**
- **Selfish mining:** Assumption honest miners profit most
- **Block withholding:** Assumption pool members act honestly
- **Short-selling 51% (PoS):** Assumption attackers hold long-term

**SoK Evidence:**
> "Attackers split into two groups... Group A1 infiltrates the mining pools... constantly changing identities"

> "The average profit of the attackers exceeds that of honest miner nodes by approximately 6% to 7%"

**Economic Model Failure:**
- Selfish mining: Rational miners should be honest → Actually, selfish mining > honest at certain thresholds
- Block withholding: Pool members should maximize pool profit → Actually, withholding is profitable

---

### Pattern 5: Complexity Hides Bugs

**Mapped Attacks:**
- **Reentrancy:** Complex fallback interactions
- **Integer overflow:** Arithmetic edge cases
- **Transaction malleability:** Cryptographic complexity
- **Consensus interactions:** 51% enabling other attacks

**SoK Evidence:**
> "A transaction malleability attack represents a variant of a double-spend attack"

> "Integer overflow vulnerabilities can be categorized into integer overflow and integer underflow"

**Complexity Sources:**
- Solidity language complexity (reentrancy)
- EVM arithmetic behavior (overflow/underflow)
- Cryptographic protocol interactions (malleability)
- Multi-layer attack chains (51% → selfish mining)

---

### Pattern 6: Integration Blindness

**Mapped Attacks:**
- **Contract virtual machine:** Resource exhaustion via gas
- **Lightning Network:** Defer bomb attacks
- **Mining pool protocols:** Block withholding infiltration
- **Cross-layer attacks:** Tx malleability (data layer) enables double-spend (consensus layer)

**SoK Evidence:**
> "A defer bomb attack... affects the normal operation of the Lightning Network"

> "A transaction malleability attack originates from a vulnerability in the source code... classified under the data layer"

**Integration Gaps:**
- LN + main chain: Congestion on L1 affects L2
- Contract VM: External calls to untrusted contracts
- Pool protocols: Cannot verify miner honesty

---

### Pattern 7: Audit Theater

**Mapped Attacks:**
- **Reentrancy:** Audited contracts still vulnerable (DAO was "reviewed")
- **Integer overflow:** Static analysis tools exist, still exploited
- **Consensus attacks:** Protocol design assumptions not challenged

**SoK Evidence:**
> "The 2016 The DAO attack exposes the enormous risks of smart contract vulnerabilities, resulting in the theft of over $50 million"

> "Various smart contract detection solutions exist, including static analysis tools and dynamic testing frameworks"

**Audit Gaps Identified in SoK:**
1. Static analysis limitations with external calls
2. Dynamic analysis sample size issues
3. Detection models focus on single attack types
4. Struggle in "complex, interactive environments"

---

### Pattern 8: Governance Capture

**Mapped Attacks (Indirect):**
- **Sybil attack:** Governance voting manipulation
- **Mining pool control:** Administrator centralization
- **51% PoS:** Economic majority = governance majority

**SoK Evidence:**
> "The pool administrator distributes profits based on miners' contributions"

> "In the blockchain network, every decision is made through a collective vote by all accounts"

**Governance Risks:**
- PoS: Economic stake = governance power
- Mining pools: Administrator = dictator of reward distribution
- Authorized consensus: 1 account = 1 vote (vulnerable to Sybil)

---

## 1.4 Update ATTACK_VECTOR_DATABASE.md

### New Attack Vectors to Add

#### Vector: Transaction Malleability
```markdown
### Transaction Malleability Attack
**Classification:** Data Layer | Double-Spend Variant
**Mechanism:** Modify transaction signature without changing output
**Prerequisites:** 
- Pre-SegWit blockchain OR vulnerable wallet implementation
- Exchange/wallet uses tx ID for confirmation

**Attack Flow:**
1. Attacker requests withdrawal
2. Victim creates transaction with ID X
3. Attacker modifies signature → new ID Y
4. Transaction Y confirms first
5. Attacker claims transaction X "failed"
6. Victim resends → double payment

**Mitigation:**
- SegWit (signature separation)
- Multi-signature requirements
- Transaction ID confirmation before crediting

**Historical Examples:**
- Mt. Gox (claimed, disputed)
- Various exchange incidents (2013-2017)

**Detection:**
- Monitor for duplicate transaction outputs
- Third-party tools: blockchain.info, TradeBlock

**Source:** SoK 2025, Layer: Data
```

#### Vector: Short-Selling 51% Attack (PoS)
```markdown
### Short-Selling 51% Attack (PoS)
**Classification:** Consensus Layer | Economic Manipulation
**Mechanism:** Borrow stake → Attack → Depreciate → Repay cheaper
**Prerequisites:**
- PoS system with exchange/shorting mechanism
- Attacker controls >50% stake in round
- Liquid market for token

**Attack Flow:**
1. Attacker holds stake A (sufficient for 51% attack)
2. Borrows additional stake B from exchange
3. Sells borrowed tokens at price i
4. Executes 51% attack (double-spend, delay)
5. Token depreciates to price l
6. Repurchases B tokens at price l
7. Returns B to exchange
8. Profit: (i-l)(B-A)

**Risk Factor:**
- Attacker's own stake A also depreciates
- Requires i-l > depreciation of A
- Economically viable at certain thresholds

**Mitigation:**
- Short-selling restrictions on staked tokens
- Stake lock-up periods
- Attack detection and slashing

**Source:** SoK 2025 (Lee & Kim, 2020)
```

#### Vector: Defer Bomb (Transaction Delay)
```markdown
### Defer Bomb Attack (Transaction Delay)
**Classification:** Network Layer | Congestion Attack
**Mechanism:** Flood network with delayed transactions
**Prerequisites:**
- Low transaction fees
- Network congestion vulnerability

**Attack Flow:**
1. Attacker broadcasts many transactions
2. Does not immediately record in blocks
3. Confirmation time delayed
4. Network resources consumed
5. LN time-lock security affected

**Impact:**
- Network congestion
- Lightning Network disruption
- Precursor to other attacks

**Mitigation:**
- Dynamic fee adjustment
- Transaction processing queue optimization
- Time threshold reductions

**Source:** SoK 2025, Layer: Network
```

#### Vector: Block Withholding Attack
```markdown
### Block Withholding Attack
**Classification:** Application Layer | Mining Pool Exploitation
**Mechanism:** Infiltrate pool, conceal valid shares
**Prerequisites:**
- Mining pool with reward-sharing
- Infiltration capability

**Attack Flow:**
1. Attackers split into Group A1 (infiltrators) and A2 (honest pool)
2. A1 joins target pool, mines with pool admin's public key
3. A1 conceals valid shares (withholds blocks)
4. A2 mines normally in private pool
5. Target pool revenue decreases ~13%
6. Attacker profit increases ~6-7%

**Variants:**
- "Destroy": Pure sabotage (costly, no profit)
- "Wait": Complex withholding with delayed publication

**Detection:**
- Statistical analysis of share submission
- Cross-check methods (Li et al., 2024)
- Monitor block production time vs. difficulty

**Mitigation:**
- Forfeiture mechanism (penalize entire pool for withholding)
- Robust consensus protocol in pools
- Reward distribution optimization

**Source:** SoK 2025, Layer: Application
```

---

## Ingestion Rule Compliance Summary

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **1. Core Assumptions** | ✅ | Five-layer blockchain architecture; consensus assumptions; economic rationality |
| **2. Where Assumptions Fail** | ✅ | 51% control breaks consensus; selfish mining breaks honest-miner assumption; reentrancy breaks atomicity |
| **3. Layer Mapping** | ✅ | Data/Network/Consensus/Contract/Application layers explicitly mapped |
| **4. Pattern Mapping** | ✅ | All 8 patterns mapped to specific attacks in taxonomy |
| **5. Audit Gap** | ✅ | Detection limitations noted; static/dynamic analysis gaps documented; "struggle in complex environments" |

---

## Source Citation

**SoK: Security Analysis of Blockchain-based Cryptocurrency**  
Zekai Liu et al., arXiv:2503.22156 [cs.CR], March 2025

---

*Ingestion Complete — Prompts 1.1-1.4 Executed*
