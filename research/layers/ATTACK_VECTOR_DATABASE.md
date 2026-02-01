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

## Sources

Attack patterns compiled from:
- **Smart Contract Security Field Guide** (scsfg.io) - Reentrancy, access control
- **ConsenSys Smart Contract Best Practices** - Known attacks catalog
- **Solidity Patterns** - Security patterns and anti-patterns
- **Smart Contract Vulnerabilities** (kadenzipfel) - Vulnerability taxonomy
- **Ethernaut** (OpenZeppelin) - Historical hack reproductions
- **Quantstamp audit library** - 18 reports, 130+ findings
- **DeFiHackLabs** - Reproduced exploit patterns

---

*Pattern database for smart contract security analysis.*
