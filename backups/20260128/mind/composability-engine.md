# Composability Engine — Cross-Protocol Interaction Risks

## Core Principle

DeFi's composability is both its strength and its greatest attack surface. Protocols that are individually secure can become vulnerable when composed. A vulnerability in one protocol can cascade through the entire ecosystem.

## Composability Risk Categories

### 1. Oracle Dependency Chains
- Protocol A uses Oracle B for pricing
- Oracle B aggregates from DEX C
- Attacker manipulates DEX C → affects Oracle B → exploits Protocol A
- **Detection:** Map oracle dependencies, check for staleness/TWAP protections

### 2. Flash Loan Attack Surfaces
- Borrow unlimited capital → manipulate state → profit → repay
- Any contract that reads external state (prices, balances) in the same transaction is at risk
- **Detection:** Identify functions that read external prices and allow state changes

### 3. Cascading Liquidations
- Protocol A depends on Protocol B's collateral
- Liquidation in B triggers liquidation in A
- Attackers can trigger cascading liquidations with initial manipulation
- **Detection:** Map collateral dependencies between lending protocols

### 4. Re-entrancy via Composability
- Protocol A calls Protocol B
- Protocol B calls back into Protocol A before A updates state
- Classic reentrancy, but across protocol boundaries
- **Detection:** Trace cross-protocol call paths, check for state updates after external calls

### 5. Governance Attacks
- Accumulate governance tokens (via flash loans or market)
- Propose and execute malicious governance action
- Drain protocol or change critical parameters
- **Detection:** Check governance timelock, quorum requirements, flash loan resistance

### 6. Token Standard Mismatches
- Fee-on-transfer tokens break balance assumptions
- Rebasing tokens change balances between transactions
- ERC-777 hooks enable reentrancy in ERC-20-expecting code
- **Detection:** Check for token standard assumptions in contract logic

## Analysis Checklist

For each protocol under analysis:

1. **What external protocols does it interact with?**
   - DEXes for swaps
   - Lending protocols for borrowing
   - Oracles for pricing
   - Bridges for cross-chain

2. **What external state does it read?**
   - Token balances
   - Oracle prices
   - Pool reserves
   - Governance state

3. **Can external state be manipulated atomically?**
   - In the same transaction (flash loan)
   - In the same block (sandwich)
   - Across blocks (front-running)

4. **What's the blast radius?**
   - How much value is at risk in this protocol?
   - What downstream protocols depend on this one?
   - Can a failure here cascade?

## Interaction Mapping

When analyzing a new protocol, create an interaction map:

```
Protocol Under Analysis
├── Reads from:
│   ├── Oracle: Chainlink ETH/USD
│   ├── DEX: Uniswap V3 WETH/USDC pool
│   └── Lending: Aave V3 (collateral check)
├── Writes to:
│   ├── Token: Mints/burns LP tokens
│   └── Vault: Deposits/withdraws
└── Called by:
    ├── Aggregators: 1inch, Paraswap
    └── Vaults: Yearn strategies
```
