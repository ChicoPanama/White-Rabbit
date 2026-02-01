# Layer 1: Invariant Failures

**Layer Question:** "How do systems break?"

---

## What Are Invariants?

**Definition:** Conditions that must always remain true for the system to be secure.

**Types:**
- **State Invariants:** Properties of the system state (e.g., "total supply equals sum of balances")
- **Behavioral Invariants:** Properties of system behavior (e.g., "users can only withdraw their own funds")
- **Economic Invariants:** Properties of economic mechanisms (e.g., "collateral value > debt value")

---

## Category 1: State Transition Violations

### Pattern: Unauthorized State Changes
**Invariant:** Only authorized actors can modify specific state.

**Failure Modes:**
1. Missing access control on sensitive functions
2. Role-based access control bypass
3. Ownership transfer to zero address
4. Privileged function without modifier

**Detection Signals:**
- `onlyOwner` modifier missing on critical functions
- No role checks on state-changing functions
- `transferOwnership` without validation

**Real-World Correlation:**
- Parity Multisig (2017) - library suicide
- Multiple protocol hacks via missing access control

---

### Pattern: State Consistency Breakdown
**Invariant:** State variables remain internally consistent.

**Failure Modes:**
1. Total supply doesn't match sum of balances
2. Accounting errors in deposit/withdrawal
3. Double-counting in reward calculations
4. State not updated on emergency actions

**Detection Signals:**
- Multiple state variables tracking same data
- Complex update logic with multiple steps
- Missing state synchronization

**Real-World Correlation:**
- Cream Finance - accounting errors
- Multiple vault protocols with share calculation bugs

---

### Pattern: Reentrancy
**Invariant:** State changes complete before external calls.

**Failure Modes:**
1. External call before state update (checks-effects-interactions violation)
2. Callback functions without reentrancy guards
3. Cross-function reentrancy
4. Read-only reentrancy

**Detection Signals:**
- External call to untrusted contract
- State change after external call
- No reentrancy guard on callback handlers
- `transfer`, `send`, `call` to user-controlled addresses

**Real-World Correlation:**
- The DAO (2016)
- Curve reentrancy (2023)
- Multiple lending protocol hacks

---

## Category 2: Arithmetic Violations

### Pattern: Integer Overflow/Underflow
**Invariant:** Arithmetic operations stay within valid ranges.

**Failure Modes:**
1. Pre-Solidity 0.8: Wraparound behavior
2. Post-Solidity 0.8: Revert on overflow (DoS vector)
3. Division before multiplication precision loss
4. Rounding errors in favor of attacker

**Detection Signals:**
- Math operations without bounds checking
- Price calculations with division
- Share/exchange rate math
- Solidity version < 0.8 without SafeMath

**Real-World Correlation:**
- SSV Network DoS (2024) - overflow revert blocking operators
- Numerous pre-0.8 exploits

---

### Pattern: Precision Loss
**Invariant:** Calculations maintain required precision.

**Failure Modes:**
1. Integer division truncation
2. Cumulative rounding in loops
3. Exchange rate manipulation via donations
4. Dust amount exploitation

**Detection Signals:**
- Division operations
- Exchange rate calculations
- Proportional reward distributions
- Flash loan susceptibility

**Real-World Correlation:**
- Hundred Finance - exchange rate manipulation
- Compound forks with donation attacks

---

## Category 3: Access Control Failures

### Pattern: Privilege Escalation
**Invariant:** Users cannot exceed their authorized permissions.

**Failure Modes:**
1. Signature replay attacks
2. Delegatecall to attacker-controlled code
3. Initialization function callable multiple times
4. Proxy pattern confusion

**Detection Signals:**
- `delegatecall` usage
- `selfdestruct` in upgradeable contracts
- Initialization without `initializer` modifier
- Signature verification without nonce/replay protection

**Real-World Correlation:**
- Parity Multisig
- Multiple proxy implementation hacks

---

### Pattern: Approval Exploitation
**Invariant:** Token approvals reflect user intent.

**Failure Modes:**
1. Unlimited approval requirements
2. Race conditions in approval changes (double-spend)
3. permit() signature replay
4. Approval to malicious contracts

**Detection Signals:**
- `approve` to max uint
- No `increaseAllowance`/`decreaseAllowance` pattern
- `permit` without replay protection

**Real-World Correlation:**
- Numerous DeFi hacks via unlimited approvals

---

## Category 4: Oracle & External Data Failures

### Pattern: Price Manipulation
**Invariant:** Price data reflects true market value.

**Failure Modes:**
1. Single-source oracle manipulation
2. Flash loan price impact
3. Stale oracle data
4. Oracle downtime/freeze

**Detection Signals:**
- Single DEX as price source
- No staleness checks
- No circuit breakers
- TWAP with short window

**Real-World Correlation:**
- Mango Markets - oracle manipulation
- Alpha Homora - Uniswap oracle manipulation
- Venus Protocol - Chainlink pause

---

### Pattern: Frontrunning
**Invariant:** Transaction execution order reflects submission order.

**Failure Modes:**
1. Sandwich attacks on AMM trades
2. Liquidation frontrunning
3. MEV extraction
4. Auction manipulation

**Detection Signals:**
- User-specified slippage tolerance
- Mempool-visible transactions
- No commit-reveal schemes

**Real-World Correlation:**
- Universal in DeFi
- CowSwap and Flashbots as mitigations

---

## Category 5: Upgrade & Initialization Failures

### Pattern: Initialization Race
**Invariant:** Contracts are initialized exactly once before use.

**Failure Modes:**
1. Uninitialized implementation contracts
2. `initialize()` callable multiple times
3. Front-running initialization
4. Missing `_disableInitializers()`

**Detection Signals:**
- Upgradeable contract pattern
- `initialize` function present
- No `onlyInitializing` checks

**Real-World Correlation:**
- Multiple implementation contract takeovers
- Yearn exploit (initialization-related)

---

### Pattern: Storage Collision
**Invariant:** Storage layout remains consistent across upgrades.

**Failure Modes:**
1. Variable reordering in upgrades
2. Type changes in storage slots
3. Inherited contract changes
4. Storage gap exhaustion

**Detection Signals:**
- Upgradeable proxy pattern
- Storage variable additions
- Inheritance changes

**Real-World Correlation:**
- Multiple upgrade-related incidents

---

## Category 6: Logic & Business Rule Failures

### Pattern: Business Logic Bypass
**Invariant:** All business rules are enforced.

**Failure Modes:**
1. Missing validation checks
2. Incorrect conditional logic
3. State machine violations
4. Race conditions in multi-step processes

**Detection Signals:**
- Complex conditional logic
- Multi-step user flows
- State transitions without validation
- Unusual code paths

**Real-World Correlation:**
- Numerous protocol-specific logic bugs

---

### Pattern: Input Validation Gaps
**Invariant:** All external inputs are validated.

**Failure Modes:**
1. Missing zero-address checks
2. Unchecked array lengths
3. Unbounded loops
4. Invalid parameter ranges

**Detection Signals:**
- External function parameters
- Array inputs
- User-provided addresses
- Large number inputs

**Real-World Correlation:**
- Multiple DoS via unbounded loops
- Gas griefing attacks

---

## Invariant Failure Analysis Template

```
1. What invariant should hold?
2. How can it be violated?
3. What state enables the violation?
4. What's the exploit path?
5. Has this pattern been seen before?
```

---

*Catalog of how systems break — independent of any single protocol.*
