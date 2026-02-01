# Layer 4: Systemic Failures

**Layer Question:** "Why do entire systems collapse?"

---

## Core Principle

Individual contracts can be secure while the system fails. Composition, scale, and coordination create emergent vulnerabilities.

---

## Category 1: Cascade Failures

### Pattern: DeFi Domino Effect
**Mechanism:** Failure in one protocol triggers failures in dependent protocols.

**Chain Reaction:**
```
Protocol A hacked → Stolen tokens sold → Price crash on DEX
    ↓
Protocol B uses same DEX for oracle → Incorrect price readings
    ↓
Protocol B liquidations trigger incorrectly → Bad debt
    ↓
Protocol C lent to Protocol B → Loss of collateral
    ↓
Contagion continues...
```

**Real-World Example:**
- 2022: Terra/Luna collapse
  - Algorithmic stablecoin depegs
  - Anchor Protocol fails
  - Liquidations across lending protocols
  - Broader DeFi contagion

**Key Insight:**
Each protocol individually sound. System collectively fragile.

---

### Pattern: Oracle Contagion
**Mechanism:** Multiple protocols share oracle infrastructure. Single failure affects all.

**Scenario:**
1. Chainlink price feed pauses (maintenance/attack)
2. Protocols using feed can't liquidate
3. Underwater positions accumulate
4. When feed resumes, mass liquidations occur
5. Market crash triggers further liquidations

**Real-World:**
- Venus Protocol: Chainlink pause contributed to $568M incident
- Not a bug in Venus — systemic oracle dependency

**Research Question:**
How many protocols share your oracle? What if it stops?

---

## Category 2: Composability Risk

### Pattern: Permissionless Integration Attacks
**Mechanism:** Protocol designed for integration, integrated maliciously.

**Scenario:**
1. Protocol A allows flash loans
2. Protocol B integrates with A (legitimate use)
3. Protocol C integrates with B (legitimate use)
4. Attacker uses A's flash loan through B to attack C

**Key Insight:**
Protocol A's security assumptions didn't include Protocol C's risk model.

**Example:**
- Flash loan → AMM manipulation → Lending protocol liquidation
- Each protocol individually secure
- Composition creates attack vector

---

### Pattern: Reentrancy Across Protocols
**Mechanism:** Cross-protocol calls create reentrancy paths not visible in single-protocol analysis.

**Attack Flow:**
```solidity
// Protocol A
function withdraw() {
    uint amount = balances[msg.sender];
    balances[msg.sender] = 0;  // Update after?
    msg.sender.call{value: amount}("");  // External call
}

// Protocol B integrates with A
function compound() {
    A.withdraw();
    // ... do something ...
    A.deposit();  // Reenters through callback
}
```

**Research Question:**
How do your dependencies interact with their dependencies?

---

## Category 3: Bridge Failures

### Pattern: Trust Assumption Collapse
**Mechanism:** Bridge security relies on validator set honesty. Set is compromised.

**Attack Flow:**
1. Bridge uses M-of-N multisig
2. N is large but M is small (e.g., 3-of-11)
3. Attacker compromises M validators
4. Forges withdrawal signatures
5. Infinite mint on destination chain

**Real-World:**
- Ronin Bridge: $600M (5-of-9 validators compromised)
- Nomad Bridge: $190M (initialization bug, but validator-related)
- Wormhole: $320M (validator key compromise)

**Key Insight:**
Bridge security = weakest validator. Not cryptographic security.

---

### Pattern: Message Verification Failure
**Mechanism:** Bridge messages not properly verified on destination chain.

**Scenarios:**
- Replay attacks: Same message processed twice
- Message spoofing: Fake messages accepted
- Chain ID confusion: Message from wrong chain accepted

**Real-World:**
- Nomad: Initialization bug allowed any message
- Poly Network: Cross-chain message verification failure

**Research Question:**
How is the "source" of a bridge message verified?

---

## Category 4: Liveness vs Safety Tradeoffs

### Pattern: Emergency Pause Cascades
**Mechanism:** Emergency pause in one protocol forces pauses in others.

**Scenario:**
1. Protocol A detects attack, pauses
2. Protocol B depends on A (e.g., yield source)
3. B must also pause to prevent arbitrage/stale pricing
4. Protocol C depends on B...
5. System-wide halt

**Key Insight:**
Circuit breakers are safety mechanisms that become liveness failures.

**Real-World:**
- dYdX paused during market volatility
- Multiple protocols pause during major exploits

---

### Pattern: Finality Gadget Failures
**Mechanism:** Protocol assumes finality that doesn't exist.

**Scenarios:**
- Optimistic rollups: 7-day challenge period
- Proof-of-Stake: Weak subjectivity period
- Sharding: Cross-shard finality delays

**Attack:**
1. Deposit on rollup
2. Wait for "soft" finality
3. Withdraw on mainnet
4. Create fraud proof on rollup (after 7 days)
5. Double-spend successful

**Research Question:**
What finality are you assuming? Is it guaranteed?

---

## Category 5: Dependency Chain Collapse

### Pattern: Library Compromise
**Mechanism:** Widely-used library has vulnerability or is compromised.

**Scenario:**
1. Protocol uses OpenZeppelin contracts (trusted)
2. OpenZeppelin has bug (rare but possible)
3. All protocols using affected version vulnerable
4. Coordinated upgrade required

**Key Insight:**
Dependency on audited code ≠ security if dependency is compromised.

**Mitigation:**
- Pin specific versions
- Monitor security advisories
- Timelock on upgrades

---

### Pattern: Infrastructure Failure
**Mechanism:** Critical infrastructure (RPC, indexers, frontends) fails or is attacked.

**Scenarios:**
- RPC provider censors transactions
- Frontend DNS hijacked (fake website)
- Subgraph/indexer provides stale data
- Cloud provider outage

**Key Insight:**
"Decentralized" protocols often rely on centralized infrastructure.

**Research Question:**
What infrastructure do users actually use to access the protocol?

---

## Category 6: Governance Systemic Risk

### Pattern: Governance Token Concentration
**Mechanism:** Governance power concentrated in few hands. Decisions don't reflect user interests.

**Scenarios:**
- Founder holds 40% of governance tokens
- VCs hold 30%
- Community holds 30%, doesn't vote
- Protocol changes serve insiders

**Key Insight:**
"On-chain governance" ≠ "decentralized governance"

**Research Question:**
Who actually controls the protocol? What are their incentives?

---

### Pattern: Proposal Spam
**Mechanism:** Governance mechanism overwhelmed by malicious/spam proposals.

**Attack:**
1. Governance has low proposal threshold
2. Attacker submits hundreds of malicious proposals
3. Legitimate proposals drowned out
4. Community fatigue, participation drops
5. Attacker passes malicious proposal with low turnout

**Mitigation:**
- Proposal deposits (slashed if rejected)
- Delegation to active participants
- Quorum requirements

---

## Systemic Failure Detection Framework

### Questions to Ask:

1. **Who depends on you?**
   - Downstream protocols that integrate

2. **Who do you depend on?**
   - Oracles, bridges, libraries, infrastructure

3. **What happens if they fail?**
   - Cascade paths

4. **What finality are you assuming?**
   - Soft confirmations vs. hard finality

5. **How concentrated is governance?**
   - Actual control vs. apparent decentralization

6. **What's the circuit breaker plan?**
   - What triggers pause? Who can pause? What breaks if paused?

### Red Flags:

- Heavy reliance on single oracle/bridge
- No dependency documentation
- Governance tokens highly concentrated
- No pause mechanism (or too many can pause)
- Unclear finality assumptions
- Permissionless integration without risk limits

---

*Systemic failures emerge from composition. Secure parts don't guarantee secure wholes.*
