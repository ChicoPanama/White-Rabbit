# Layer 4: Cross-Protocol Risk

**Layer Question:** "Why do entire systems collapse?"

---

## Core Principle

Risks multiply across protocol boundaries. What is safe in isolation becomes dangerous in composition.

---

## Risk Category 1: Shared Collateral Risk

### Pattern: Circular Collateral
**Mechanism:** Protocol A accepts Protocol B's token as collateral. Protocol B accepts Protocol A's token.

**Scenario:**
```
Protocol A: Deposit B-Token, borrow A-Token
Protocol B: Deposit A-Token, borrow B-Token

User Action:
1. Deposit $1M B-Token in A, borrow $800k A-Token
2. Deposit $800k A-Token in B, borrow $640k B-Token
3. Now "own" $1.64M with $1M real collateral
4. If either token drops, cascade liquidation
```

**Risk:**
- Inflated collateral value
- Correlated liquidations
- Systemic leverage

**Detection:**
- Map collateral relationships
- Look for mutual collateral acceptance
- Calculate "real" vs. "recursive" TVL

---

### Pattern: Synthetic Asset Loop
**Mechanism:** Synthetic assets backed by other synthetics create leverage loops.

**Example:**
- Synthetic ETH backed by USDC
- Synthetic USDC backed by ETH
- Correlation risk hidden in system

**Key Insight:**
"Diversified" collateral may all be correlated in crisis.

---

## Risk Category 2: Liquidation Cascades

### Pattern: Cross-Protocol Liquidation
**Mechanism:** Liquidation in one protocol dumps assets, triggering liquidations in others.

**Scenario:**
```
1. Large user underwater in Protocol A
2. Liquidation sells 10M Token X
3. Token X price drops 20%
4. Protocol B uses Token X as collateral
5. Users in B now underwater
6. B liquidations sell more Token X
7. Price drops further...
8. Cascade continues
```

**Real-World:**
- March 2020: Black Thursday cascade
- May 2021: Flash crash liquidations
- Any high-volatility event

**Research Question:**
What are the largest collateral positions? What if they all liquidate at once?

---

### Pattern: Liquidation Bot Failure
**Mechanism:** Bots that execute liquidations fail during high gas/network congestion.

**Scenario:**
1. Network congestion (high gas prices)
2. Liquidation bots pause (unprofitable)
3. Underwater positions accumulate
4. Protocol accrues bad debt
5. Insolvency risk

**Key Insight:**
Liquidation mechanisms assume functioning infrastructure. Infrastructure fails.

---

## Risk Category 3: Oracle Correlation

### Pattern: Shared Price Source
**Mechanism:** Multiple protocols use same DEX for price discovery.

**Scenario:**
1. Protocol A, B, C all use Uniswap ETH/USDC
2. Large trade moves Uniswap price
3. All three protocols see price change simultaneously
4. Liquidations trigger across all three
5. Cascading effect

**Real-World:**
- Curve pool manipulation affects multiple protocols
- Single AMM as primary oracle = systemic risk

**Research Question:**
How many protocols use the same price source as you?

---

### Pattern: Stale Price Divergence
**Mechanism:** Different protocols use different oracle update frequencies.

**Scenario:**
1. Protocol A updates every block
2. Protocol B updates every hour
3. Flash crash happens
4. A liquidates at crash price
5. B still shows pre-crash price
6. Arbitrage: Buy cheap on A, collateralize on B
7. B absorbs bad debt

**Key Insight:**
Temporal inconsistency in oracle updates = arbitrage opportunity.

---

## Risk Category 4: Bridge Systemic Risk

### Pattern: Bridge as Central Hub
**Mechanism:** Single bridge connects many chains. Bridge failure isolates ecosystems.

**Scenario:**
1. Major bridge connects Ethereum, Polygon, Arbitrum, Base
2. Bridge exploited/halted
3. Assets trapped on one side
4. Secondary markets for "trapped" assets emerge
5. Price divergence
6. Arbitrage when bridge resumes
7. Protocols on affected chains face liquidity crisis

**Real-World:**
- Multichain bridge collapse (2023)
- Assets stranded, protocols insolvent

**Research Question:**
What bridges does your protocol depend on? What if they halt?

---

### Pattern: Wrapped Asset Risk
**Mechanism:** Wrapped assets (WBTC, WETH) create bridge-like risk.

**Scenario:**
1. WBTC backed by custodial BTC
2. Custodian compromised or freezes
3. WBTC depegs from BTC
4. All protocols using WBTC face collateral risk
5. Liquidations cascade

**Key Insight:**
"Wrapped" assets = trust assumption. Not the same as native assets.

---

## Risk Category 5: Yield Source Correlation

### Pattern: Shared Yield Strategy
**Mechanism:** Multiple protocols deposit into same yield source.

**Scenario:**
1. Protocols A, B, C all deposit into Curve Pool X
2. Curve Pool X has vulnerability
3. All three protocols lose funds
4. Users of all three affected

**Example:**
- Yearn, Convex, various aggregators use same underlying strategies
- Strategy failure affects all

**Research Question:**
Where does your yield actually come from? Who else uses it?

---

### Pattern: Yield Token Cascade
**Mechanism:** Yield-bearing tokens used as collateral throughout DeFi.

**Scenario:**
```
stETH (staked ETH) used as collateral in:
- Aave
- Curve
- MakerDAO
- Multiple other protocols

Event: stETH depegs from ETH
Impact: All protocols using stETH face simultaneous collateral issues
```

**Real-World:**
- 2022: stETH depeg stress test
- Multiple protocols tested simultaneously
- Some failed, some survived

---

## Risk Category 6: Governance Cross-Contamination

### Pattern: Governance Token Overlap
**Mechanism:** Same entities control multiple protocols.

**Scenario:**
1. Entity X holds governance tokens of Protocol A and B
2. X passes proposal in A that benefits B at A's expense
3. A's users harmed by B's governance

**Key Insight:**
Governance decentralization theater — same actors control multiple "decentralized" protocols.

---

### Pattern: Proposal Spillover
**Mechanism:** Proposal in one protocol affects others unexpectedly.

**Scenario:**
1. Protocol A votes to change tokenomics
2. Token price drops 50%
3. Protocol B uses A's token as collateral
4. Unexpected liquidations in B
5. B's governance blames A

**Research Question:**
What governance decisions by other protocols affect you?

---

## Cross-Protocol Risk Mapping Framework

### Map Creation:

1. **Identify Your Dependencies**
   - Oracles
   - Bridges
   - Yield sources
   - Collateral assets
   - Governance relationships

2. **Identify Dependents**
   - Who uses your token?
   - Who integrates with you?
   - Who holds your governance tokens?

3. **Stress Test Scenarios**
   - What if your oracle stops?
   - What if your bridge halts?
   - What if your largest collateral crashes?
   - What if your yield source is exploited?

4. **Cascade Analysis**
   - Who gets liquidated if X happens?
   - What else liquidates as a result?
   - How deep does the cascade go?

### Visualization:
```
Protocol A ← Oracle O → Protocol B
     ↓                      ↓
   Token T               Token T
     ↓                      ↓
Protocol C ← Bridge B → Protocol D

If Oracle O fails: A and B affected
If Token T crashes: A, B, C, D affected
If Bridge B halts: C and D isolated
```

---

*Cross-protocol risk is the difference between micro-security and macro-security.*
