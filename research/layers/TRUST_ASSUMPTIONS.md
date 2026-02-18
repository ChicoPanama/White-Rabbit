# Layer 0: Trust Assumptions

**Layer Question:** "How is the system supposed to work?"

---

## Core Principle

Every security property depends on underlying trust assumptions. Understanding these is prerequisite to finding where they break.

---

## Category 1: Consensus Layer Trust

### Assumption: Honest Majority
**Statement:** More than 2/3 of validators/stakers are honest and follow the protocol.

**What This Enables:**
- Block finality
- Transaction ordering guarantees
- State consistency across nodes

**When It Breaks:**
- 51% attacks (PoW)
- Validator collusion (PoS)
- Economic attacks on staking value

### Assumption: Network Synchrony
**Statement:** Messages propagate to honest nodes within a known time bound.

**What This Enables:**
- Consensus can be reached
- Forks resolve naturally

**When It Breaks:**
- Network partitions
- Eclipse attacks
- Geographic latency manipulation

### Assumption: Economic Rationality
**Statement:** Validators act to maximize their economic returns and avoid slashing.

**What This Enables:**
- Slashing conditions deter attacks
- Honest behavior is incentive-aligned

**When It Breaks:**
- Attacker has extrinsic motivation (state-level, ideological)
- External incentives exceed staking value
- Validator extraction attacks

---

## Category 2: Cryptographic Trust

### Assumption: Hash Function Security
**Statement:** Pre-image and collision attacks are computationally infeasible.

**What This Enables:**
- Block immutability
- Address integrity
- Merkle proof verification

**When It Breaks:**
- Quantum computing (future threat)
- Cryptographic breakthroughs
- Implementation bugs (weak RNG)

### Assumption: Signature Unforgeability
**Statement:** Without the private key, valid signatures cannot be produced.

**What This Enables:**
- Ownership of accounts
- Authorization of transactions
- Non-repudiation

**When It Breaks:**
- Private key leakage
- Weak randomness in key generation
- Side-channel attacks

---

## Category 3: Protocol Layer Trust

### Assumption: Client Diversity
**Statement:** No single software implementation dominates the network.

**What This Enables:**
- Resilience to implementation bugs
- Decentralized validation

**When It Breaks:**
- 67%+ run same client (e.g., Prysm in Ethereum)
- Critical bug in majority client

### Assumption: Spec Compliance
**Statement:** All clients implement the protocol specification correctly.

**What This Enables:**
- Deterministic execution across nodes
- Consensus on state transitions

**When It Breaks:**
- Spec ambiguity
- Implementation bugs
- Client divergence

---

## Category 4: Application Layer Trust

### Assumption: Oracle Accuracy
**Statement:** Price feeds and external data reflect real-world values.

**What This Enables:**
- Liquidation mechanisms
- Derivative pricing
- Cross-chain bridging

**When It Breaks:**
- Market manipulation
- Oracle compromise
- Stale data

### Assumption: Contract Code Integrity
**Statement:** Verified source code matches deployed bytecode.

**What This Enables:**
- Trust in contract behavior
- Audit validity

**When It Breaks:**
- Unverified contracts
- Malicious init code
- Proxy pattern confusion

### Assumption: Upgrade Governance
**Statement:** Upgrade mechanisms are controlled by legitimate governance.

**What This Enables:**
- Bug fixes
- Protocol evolution

**When It Breaks:**
- Compromised multisig
- Low participation governance
- Malicious upgrade

---

## Category 5: Economic Trust

### Assumption: Rational Market Participants
**Statement:** Actors act to maximize economic value.

**What This Enables:**
- Arbitrage corrects mispricings
- Liquidations are executed
- MEV extraction is bounded

**When It Breaks:**
- Irrational actors
- Sandwitch attacks without profit motive
- Griefing attacks (cost > gain)

### Assumption: Deep Liquidity
**Statement:** Markets have sufficient depth for normal operations.

**What This Enables:**
- Price stability
- Liquidation execution
- Normal trading

**When It Breaks:**
- Low liquidity pools
- Manipulation via flash loans
- Bank run scenarios

---

## Category 6: Composability Trust

### Assumption: Dependency Availability
**Statement:** Contracts that are called will be available and responsive.

**What This Enables:**
- Complex DeFi interactions
- Composable protocols

**When It Breaks:**
- Dependency pauses
- Gas limit issues
- Reentrancy attacks

### Assumption: Interface Compliance
**Statement:** External contracts implement expected interfaces correctly.

**What This Enables:**
- Token standards (ERC-20, ERC-721)
- Protocol interoperability

**When It Breaks:**
- Malicious ERC-20 implementation
- Non-standard behavior
- Hook-based attacks

---

## Trust Assumption Documentation Template

When analyzing any protocol, document:

```
1. What must be true for security to hold?
2. Who/what is trusted?
3. What happens if that trust is violated?
4. Is the trust assumption explicit or implicit?
5. Can it be verified on-chain?
```

---

## Sources

Trust framework derived from:
- **Mastering Bitcoin** - Economic security assumptions, mining incentives
- **Mastering Ethereum** - Protocol and application layer trust models
- **Bitcoin and Cryptocurrency Technologies** - Formal trust and security models

---

*Understanding trust assumptions is prerequisite to finding where they fail.*
