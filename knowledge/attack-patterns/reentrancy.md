# Reentrancy Attack Patterns

## Overview
**Severity:** Critical
**Detection:** Slither reentrancy detectors + manual review

## Attack Types

### 1. Single-Function Reentrancy
External call to untrusted contract before state update.

```solidity
// VULNERABLE
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool success, ) = msg.sender.call{value: amount}("");  // External call
    balances[msg.sender] -= amount;  // State update AFTER call
}

// SAFE
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;  // State update BEFORE call
    (bool success, ) = msg.sender.call{value: amount}("");
}
```

### 2. Cross-Function Reentrancy
Reentering through a different function that modifies shared state.

```solidity
// Attacker enters withdraw(), then re-enters transfer() before state updates
function withdraw() external { ... }
function transfer(address to, uint256 amount) external { ... }
```

### 3. Cross-Contract Reentrancy
Reentering through a different contract in the same protocol.

### 4. Read-Only Reentrancy
Exploiting stale state reads during reentrant call.

## Detection Signatures

### Slither Detectors
- `reentrancy-eth`
- `reentrancy-no-eth`
- `reentrancy-benign`
- `reentrancy-events`

### Code Patterns to Flag
- External calls (`.call`, `.transfer`, `.send`)
- State changes after external calls
- Missing ReentrancyGuard
- Callbacks to untrusted addresses

## Mitigation Patterns
1. **Checks-Effects-Interactions:** Update state before external calls
2. **ReentrancyGuard:** Use OpenZeppelin nonReentrant modifier
3. **Pull over Push:** Let users withdraw instead of pushing funds

## Real Examples
- **The DAO (2016):** $60M stolen - classic single-function reentrancy
- **Cream Finance (2021):** $130M - cross-contract reentrancy

---
*Last Updated: 2026-01-30*
