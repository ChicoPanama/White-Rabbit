# Layer 1: False Positive Signatures

**Layer Question:** "How do systems break?"

---

## Purpose

False positives waste research time and damage credibility. Recognizing FP patterns is as important as finding real bugs.

---

## Category 1: Compiler Artifacts

### Signature: SELFDESTRUCT Pattern
**Detector Alert:** `SELFDESTRUCT` opcode found

**Reality:**
- High occurrence count (>1000) usually indicates compiler padding
- Modern Solidity often includes unreachable `SELFDESTRUCT` as metadata
- Real vulnerabilities have low occurrence and clear execution path

**Distinguishing Real from FP:**
- FP: High count, no clear call path, in constructor/init
- Real: Low count, reachable from external function, can drain funds

**Example:**
- Many flagged contracts show 2,500+ `SELFDESTRUCT` patterns
- Reality: Compiler-generated, not exploitable

---

### Signature: DELEGATECALL Pattern
**Detector Alert:** `DELEGATECALL` to user-controlled address

**Reality:**
- Proxy patterns legitimately use `DELEGATECALL`
- Upgradeable contracts require it
- Most detections are proxy implementations

**Distinguishing Real from FP:**
- FP: Proxy upgrade pattern, admin-only `delegatecall`
- Real: User-controlled target, no access control, can selfdestruct

**Example:**
- Transparent proxy pattern triggers alerts
- Reality: Design pattern, not vulnerability

---

### Signature: Low-Level Call
**Detector Alert:** Use of `call` instead of high-level functions

**Reality:**
- Often required for ETH transfers to contracts
- Necessary for gas forwarding
- ERC-20 `transfer` doesn't work for all tokens

**Distinguishing Real from FP:**
- FP: `call{value: amount}("")` for ETH send with gas limit
- Real: `call(data)` with user-controlled data and no validation

---

## Category 2: Design Pattern Confusion

### Signature: Unlimited Approval
**Detector Alert:** `approve(spender, type(uint256).max)`

**Reality:**
- Standard DeFi UX optimization
- Reduces transaction count
- Users explicitly opt-in

**Distinguishing Real from FP:**
- FP: User-initiated max approval for trusted protocol
- Real: Protocol forces unlimited approval, no opt-out

**Note:** 
This is a risk, not necessarily a vulnerability. Report as UX issue, not bug.

---

### Signature: Centralized Control
**Detector Alert:** Owner can change critical parameters

**Reality:**
- Necessary for protocol evolution
- Standard in early-stage projects
- Often has timelock protection

**Distinguishing Real from FP:**
- FP: Timelock present, multisig required, governance transition planned
- Real: Single EOA owner, no timelock, can rug immediately

**Example:**
- Quantstamp reports flag "Privileged Roles" as informational
- Reality: Design choice, not necessarily vulnerability

---

### Signature: Upgradeable Contract
**Detector Alert:** Contract uses proxy pattern

**Reality:**
- Industry standard for contract evolution
- Allows bug fixes
- Properly implemented = secure

**Distinguishing Real from FP:**
- FP: Well-known proxy pattern (Transparent, UUPS, Diamond)
- Real: Custom proxy with storage collision risk, no initialization protection

---

## Category 3: Tool Limitations

### Signature: Unchecked Return Value
**Detector Alert:** Return value of external call not checked

**Reality:**
- Some functions don't return values
- `transfer` and `send` revert on failure
- IERC-20 standard doesn't require return value check

**Distinguishing Real from FP:**
- FP: Using `SafeERC20` which handles return values
- Real: Direct ERC-20 call without checking success/failure

---

### Signature: Floating Pragma
**Detector Alert:** `pragma solidity ^0.8.0;`

**Reality:**
- Allows compilation with newer compiler versions
- Common in libraries
- Not a security issue if testing is thorough

**Distinguishing Real from FP:**
- FP: Well-tested contracts with CI across multiple versions
- Real: Untested with different compiler versions, version-dependent behavior

---

### Signature: Timestamp Dependence
**Detector Alert:** Use of `block.timestamp`

**Reality:**
- Required for time-based logic
- Validators can manipulate slightly (~15 seconds)
- Acceptable for long time periods

**Distinguishing Real from FP:**
- FP: Timestamp used for daily/weekly periods
- Real: Timestamp used for sub-minute critical decisions (e.g., oracle updates)

---

## Category 4: Context Misunderstanding

### Signature: Integer Overflow
**Detector Alert:** Potential integer overflow

**Reality (Solidity ≥0.8):**
- Built-in overflow protection (reverts on overflow)
- Alert is outdated for modern contracts
- May indicate DoS vector, not fund extraction

**Distinguishing Real from FP:**
- FP: Solidity 0.8+ with no `unchecked` blocks
- Real: Solidity <0.8 without SafeMath, or intentional unchecked with validation gaps

**Critical Example:**
- SSV Network: Overflow in 0.8.24 causes revert (DoS), not fund theft
- Many scanners still flag as Critical

---

### Signature: Reentrancy (Read-Only)
**Detector Alert:** External call without reentrancy guard

**Reality:**
- View functions can be "reentered" but no state change
- Static calls to oracles are safe
- Not all external calls are dangerous

**Distinguishing Real from FP:**
- FP: `view`/`pure` functions, static calls, read-only operations
- Real: State-changing external calls before state updates

---

### Signature: tx.origin Usage
**Detector Alert:** Use of `tx.origin` for authorization

**Reality:**
- Sometimes used legitimately (e.g., allowing contracts to pay for users)
- Not automatically exploitable

**Distinguishing Real from FP:**
- FP: `tx.origin` used for non-security purposes (logging, rewards)
- Real: `tx.origin == owner` for access control (phishing vulnerable)

---

## Category 5: Economic False Positives

### Signature: Flash Loan Risk
**Detector Alert:** Function doesn't prevent flash loan attacks

**Reality:**
- Flash loans are a tool, not a vulnerability
- Most functions can't prevent flash loans
- Real issue is oracle dependence or single-block assumptions

**Distinguishing Real from FP:**
- FP: Alert on any state-reading function
- Real: Price-dependent logic with single-block oracle

---

### Signature: MEV Extractable
**Detector Alert:** Transaction ordering affects outcome

**Reality:**
- Universal in DeFi
- Not a bug, just blockchain reality
- Some ordering dependence is unavoidable

**Distinguishing Real from FP:**
- FP: Slippage protection present, normal AMM behavior
- Real: No slippage protection, predictable large moves

---

## FP Prevention Checklist

Before claiming a vulnerability:

- [ ] Verify Solidity version and compiler behavior
- [ ] Check if pattern is standard design (proxies, approvals)
- [ ] Confirm execution path is actually reachable
- [ ] Validate impact (fund loss vs. theoretical issue)
- [ ] Cross-reference with known FPs
- [ ] Check if flagged code is from library/import
- [ ] Verify real vs. test/deploy artifacts

---

## High FP Risk Patterns (Be Extra Careful)

1. **Overflow in Solidity 0.8+** - Usually revert, not theft
2. **Any pattern with >1000 occurrences** - Usually compiler noise
3. **Centralization complaints** - Usually design choice
4. **Upgradeable contract warnings** - Standard pattern
5. **Timestamp usage** - Often acceptable
6. **Delegatecall in proxies** - Required by design

---

## Sources

False positive signatures compiled from:
- **ConsenSys Smart Contract Best Practices** - Tool limitation documentation
- **Smart Contract Security Field Guide** - Scanner false positive analysis
- **Slither/Solhint documentation** - Detector behavior and known FPs
- **Quantstamp audit analysis** - Real-world FP patterns from 18 reports

---

*False positives waste time and credibility. Verify before claiming.*
