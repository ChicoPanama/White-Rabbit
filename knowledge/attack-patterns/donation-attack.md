# Donation Attack Patterns (Compound Forks)

## Overview
**Severity:** Critical
**Target:** Compound/cToken forks (Hundred Finance, Cream, etc.)
**Detection:** Exchange rate manipulation analysis

## The Attack

### Mechanism
1. Attacker is first depositor in empty pool
2. Deposits minimal amount (e.g., 1 wei)
3. Receives share tokens
4. Directly donates large amount to pool (bypassing deposit)
5. Exchange rate becomes inflated
6. Subsequent depositors lose funds to rounding errors

### Mathematical Example
```
Initial state:
- Pool balance: 0
- Total shares: 0

Attack:
1. Attacker deposits 1 wei → receives 1 share
2. Attacker donates 1000 ETH directly to contract
3. Exchange rate: 1000 ETH / 1 share = 1000 ETH per share

4. Victim deposits 500 ETH
5. Shares = 500 ETH / 1000 ETH per share = 0.5 → rounds to 0
6. Victim receives 0 shares, loses 500 ETH
```

## Detection Signatures

### Code Patterns
```solidity
// VULNERABLE: First depositor gets favorable rate
function deposit(uint256 amount) external {
    uint256 shares = totalShares == 0
        ? amount  // First depositor sets rate
        : amount * totalShares / totalAssets;
    // ...
}

// Look for: Direct balance manipulation
function _getBalance() internal view returns (uint256) {
    return token.balanceOf(address(this));  // Can be manipulated
}
```

### Indicators
- Empty pool initialization without minimum deposit
- Exchange rate calculation using direct balance
- No dead shares / minimum liquidity
- First depositor advantage

## Real Examples
- **Hundred Finance (2023):** $7.4M lost
- **Similar attacks:** Cream Finance, multiple Compound forks

## Mitigation
1. **Minimum initial deposit:** Require substantial first deposit
2. **Dead shares:** Burn small amount to prevent empty pool manipulation
3. **Use internal accounting:** Don't rely on `balanceOf()` directly

---
*Last Updated: 2026-01-30*
