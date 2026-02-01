# Layer 5: Recurring Failure Patterns

**Layer Question:** "Where has this happened before?"

---

## Core Principle

Failures recur because certain patterns are seductive but flawed. Recognizing these motifs prevents repeated mistakes.

---

## Recurring Motif 1: Trust But Don't Verify

### Pattern
Protocol assumes external data/parties are honest without verification.

### Manifestations:
- **Oracle Trust:** Assume price feed accurate
- **Admin Trust:** Assume multisig signers honest
- **Bridge Trust:** Assume validators won't collude
- **Token Trust:** Assume ERC-20 behaves normally

### Historical Examples:
- Venus (Chainlink trust)
- Ronin (validator trust)
- Multiple ERC-777 reentrancy (token behavior trust)

### Warning Signs:
```solidity
// No validation of oracle data freshness
price = oracle.getPrice();

// No check on token callback behavior
token.transfer(user, amount);
```

### Prevention:
- Staleness checks on all external data
- Circuit breakers on anomalous values
- Assume malicious behavior, prove otherwise

---

## Recurring Motif 2: Update Order Matters

### Pattern
State updates in wrong order enable exploitation.

### Manifestations:
- **Reentrancy:** External call before state update
- **Initialization:** Use before initialization
- **Accounting:** Withdraw recorded after transfer

### Historical Examples:
- The DAO (reentrancy)
- Multiple Compound forks (accounting)
- Nomad (initialization order)

### Warning Signs:
```solidity
// External call BEFORE state update
msg.sender.call{value: amount}("");
balances[msg.sender] = 0;

// Use of potentially uninitialized value
function initialize() external {
    implementation = _implementation;  // Set after use?
}
```

### Prevention:
- Checks-Effects-Interactions pattern
- Initialize before use validation
- State consistency checks

---

## Recurring Motif 3: Single Point of Failure

### Pattern
System relies on single component that can fail or be compromised.

### Manifestations:
- **Single Oracle:** One price source
- **Single Admin:** One EOA with full control
- **Single Bridge:** One cross-chain connection
- **Single Liquidator:** One bot for liquidations

### Historical Examples:
- Multiple oracle manipulation attacks
- Various "rug pulls" via admin keys
- Bridge halts affecting entire ecosystems

### Warning Signs:
```solidity
// Single owner
address public owner;

// Single price source
price = uniswapPair.getPrice();
```

### Prevention:
- Multiple independent oracles
- Decentralized governance
- Redundant infrastructure

---

## Recurring Motif 4: Economic Assumptions Don't Hold

### Pattern
Code assumes rational behavior, but actors exploit incentives.

### Manifestations:
- **Flash Loans:** Assume capital constraints
- **Governance:** Assume long-term alignment
- **Liquidations:** Assume liquidators always available
- **Arbitrage:** Assume efficient markets

### Historical Examples:
- Beanstalk (governance flash loan)
- Various flash loan attacks
- Black Thursday (liquidation bots failed)

### Warning Signs:
- "Users won't do X because it's not profitable"
- "This requires too much capital"
- "Governance takes time"

### Prevention:
- Assume adversarial economics
- Flash loan resistance by design
- Multiple liquidation mechanisms

---

## Recurring Motif 5: Complexity Hides Bugs

### Pattern
Complex logic contains vulnerabilities invisible to casual review.

### Manifestations:
- **Multiple Inheritance:** Diamond problem, storage collisions
- **Complex Math:** Rounding errors, overflow/underflow
- **Multi-Step Flows:** Race conditions, state inconsistency
- **Upgrade Logic:** Initialization, storage gaps

### Historical Examples:
- Various proxy pattern bugs
- Multiple rounding error exploits
- Race conditions in multi-step withdrawals

### Warning Signs:
```solidity
// Multiple inheritance
contract Token is ERC20, ERC4626, Ownable, Pausable, ReentrancyGuard {

// Complex math
uint shares = (amount * totalShares) / totalAssets;

// Multi-step process
function withdraw() {
    step1();
    step2();  // What if fails here?
    step3();
}
```

### Prevention:
- Simplicity by design
- Extensive invariant testing
- Formal verification for critical math

---

## Recurring Motif 6: Integration Blindness

### Pattern
Protocol works in isolation, fails in composition.

### Manifestations:
- **Reentrancy:** External calls to unknown contracts
- **Callback Exploits:** Token standards with hooks
- **Composability Attacks:** Flash loans through integrations
- **Oracle Contamination:** Price manipulation affects integrators

### Historical Examples:
- Cream Finance (ERC-777 callback)
- Multiple flash loan attacks via integrations
- Curve reentrancy affecting multiple protocols

### Warning Signs:
- External calls without reentrancy guards
- "We trust our integrations"
- No assumptions about external contract behavior

### Prevention:
- Reentrancy guards on all external calls
- Callback-safe design
- Integration testing with adversarial contracts

---

## Recurring Motif 7: Audit Theater

### Pattern
Reliance on audits without understanding limitations.

### Manifestations:
- **Acknowledged Not Fixed:** Known issues remain exploitable
- **Scope Limitations:** Critical paths not audited
- **Outdated Audits:** Code changed post-audit
- **False Confidence:** "Audited" interpreted as "safe"

### Historical Examples:
- Multiple exploited protocols with audit reports
- Post-audit upgrades introducing bugs
- "Acknowledged" findings exploited

### Warning Signs:
- "Audited by [firm]" as primary security claim
- No verification that fixes deployed
- Multiple acknowledged high-severity issues

### Prevention:
- Verify fixes, not just findings
- Continuous monitoring post-audit
- Independent verification

---

## Recurring Motif 8: Governance Capture

### Pattern
Decentralized governance concentrates to few actors.

### Manifestations:
- **Token Concentration:** Founders/VCs hold majority
- **Low Participation:** Small voter turnout
- **Delegation Centralization:** Few delegates hold power
- **Proposal Spam:** Legitimate proposals drowned out

### Historical Examples:
- Various governance attacks
- Low participation enabling malicious proposals
- Delegate cartels

### Warning Signs:
- Top 10 holders > 50% of supply
- < 5% voter participation
- Same delegates on multiple protocols

### Prevention:
- Quadratic voting
- Participation incentives
- Delegation limits

---

## Pattern Recognition Framework

### When Analyzing Protocols:

1. **Identify Trust Assumptions**
   - What external parties are trusted?
   - What data is trusted?

2. **Check Update Ordering**
   - Are state changes before external calls?
   - Are there multi-step processes?

3. **Map Single Points of Failure**
   - Single oracles?
   - Single admins?
   - Single liquidity sources?

4. **Test Economic Assumptions**
   - What if actors are rational but malicious?
   - What if capital is free (flash loans)?

5. **Measure Complexity**
   - Inheritance depth?
   - Function interdependence?
   - Multi-step flows?

6. **Review Integration Points**
   - External calls?
   - Callbacks accepted?
   - Composability assumptions?

7. **Verify Audit Quality**
   - What was scope?
   - What was acknowledged not fixed?
   - Has code changed since?

8. **Assess Governance Health**
   - Token distribution?
   - Participation rates?
   - Delegation concentration?

---

## Pattern Frequency in Exploits

| Pattern | % of Exploits | Detectable Pre-Exploit |
|---------|---------------|----------------------|
| Trust Without Verify | 40% | Yes |
| Update Order | 25% | Yes |
| Single Point of Failure | 20% | Yes |
| Economic Assumption Failure | 35% | Hard |
| Complexity Bugs | 30% | Sometimes |
| Integration Blindness | 25% | Yes |
| Audit Theater | 15% | Yes |
| Governance Capture | 10% | Yes |

*(Note: Exploits often involve multiple patterns)*

---

*Patterns repeat because human nature repeats. Recognize the pattern, prevent the failure.*
