# Adversarial Engine — Think Like an Attacker

## Attacker Mindset Principles

### 1. Assume Nothing is Safe
Every line of code is a potential vulnerability until proven otherwise.

### 2. Follow the Money
Where are the assets? What functions move them? Who can call those functions?

### 3. Find the Weakest Link
Complex systems fail at integration points. Look for:
- Protocol-to-protocol interactions
- User input handling
- Admin functions
- Upgrade mechanisms

### 4. Time is a Weapon
- **Flash loans:** Infinite capital for one block
- **Sandwich attacks:** Front-run and back-run
- **Timestamp manipulation:** Block timing abuse
- **Accumulation:** Long-term overflow triggers

### 5. Composition Creates Complexity
Protocols that are individually safe may be unsafe when combined.

## Attack Trees

### Goal: Steal Funds
```
Steal Funds
├── Direct theft
│   ├── Unauthorized withdrawal
│   ├── Price manipulation
│   └── Flash loan attack
├── Indirect theft
│   ├── Governance takeover
│   ├── Oracle manipulation
│   └── Rug pull (admin keys)
└── Griefing (value destruction)
    ├── DoS critical functions
    ├── Permanent fund lock
    └── Liquidation cascade
```

### Goal: Manipulate State
```
Manipulate State
├── Storage collision (proxy)
├── Reentrancy state confusion
├── Cross-function race condition
└── Initialization front-running
```

## Questions to Ask

### For Every Contract
1. What's the most valuable thing this contract controls?
2. What's the easiest way to take it?
3. What assumptions would need to be wrong?
4. Has this type of bug existed in similar protocols?

### For Every Function
1. Who can call this? (access control)
2. What state does it change? (side effects)
3. What can go wrong with inputs? (edge cases)
4. Does it call external contracts? (reentrancy)

## Exploit Development Flow

```
Identify Asset → Map Access → Find Weakness → Build PoC → Verify Impact
```

### Step 1: Identify Asset
- Token balances
- NFT ownership
- Governance power
- Oracle control

### Step 2: Map Access
- Who can call?
- What parameters are controllable?
- What state preconditions exist?

### Step 3: Find Weakness
- Arithmetic errors
- Access control gaps
- Reentrancy vectors
- Oracle manipulation

### Step 4: Build PoC
- Mainnet fork test
- Exact parameter values
- Step-by-step reproduction

### Step 5: Verify Impact
- Quantify damage
- Check Solidity version (for arithmetic)
- Realistic attack conditions

---
*Last Updated: 2026-01-30*
