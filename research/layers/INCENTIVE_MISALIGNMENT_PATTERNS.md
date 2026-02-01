# Layer 3: Incentive Misalignment Patterns

**Layer Question:** "What if the code is correct but incentives are not?"

---

## Core Principle

When participants are incentivized to harm the system, "security" becomes a coordination game, not a technical problem.

---

## Pattern 1: Principal-Agent Problems

### Definition
Agent (operator) has different incentives than principal (users).

### Case: Admin Key Extraction
**Setup:**
- Protocol has admin key to upgrade contracts
- Admin can change any logic
- No timelock or governance

**Incentive Analysis:**
- Users: Want protocol security
- Admin: Can extract all funds instantly
- No on-chain enforcement of honesty

**Rational Behavior:**
Honest admin leaves money on the table. Rational admin exits with funds.

**Example:**
- Multiple "rug pulls" are rational economic behavior given incentive structure
- Not bugs — incentive misalignment

**Detection:**
```solidity
function upgradeTo(address newImplementation) external onlyOwner;
// No timelock, no governance, no restrictions
```

---

### Case: Oracle Provider Incentives
**Setup:**
- Protocol relies on oracle for prices
- Oracle provider is separate entity
- Provider can manipulate data

**Incentive Analysis:**
- Protocol: Needs accurate prices
- Oracle provider: May profit from manipulation
- Reputation is only deterrent

**Example:**
- API3 OEVA-4: Auctioneer can extract OEV instead of allowing fair bidding
- Acknowledged: No economic incentive alignment

**Research Question:**
When does reputation cost exceed extraction profit?

---

## Pattern 2: Commons Problems

### Definition
Individual rationality leads to collective harm.

### Case: Liquidation Racing
**Setup:**
- Liquidators compete to liquidate underwater positions
- First liquidator gets bonus
- Gas auctions determine winner

**Incentive Analysis:**
- Individual: Pay up to full bonus in gas to win
- Collective: All profit competed away, centralization to fastest bot
- Protocol: Still gets liquidated, but extraction goes to miners/bots

**Outcome:**
- Liquidation profits centralize to MEV extractors
- Smaller liquidators priced out
- Protocol may have less liquidation coverage

**Mitigation:**
- Dutch auction liquidations (bonus decreases over time)
- Force liquidation orders to be back-run, not front-run

---

### Case: Governance Attacks
**Setup:**
- Token holders vote on protocol changes
- Voting power = token holdings
- No delegation delay

**Incentive Analysis:**
- Attacker: Flash loan $500M, pass malicious proposal, extract $1B, repay
- Token holders: Can't coordinate fast enough
- Rational behavior: Attack is profitable

**Example:**
- Beanstalk: Flash loan governance attack
- Code worked perfectly. Incentives didn't.

**Mitigation:**
- Delegation delays
- Voting snapshots
- Timelocks on execution

---

## Pattern 3: Information Asymmetry

### Definition
One party has information others can't access.

### Case: MEV Searcher Advantage
**Setup:**
- Searchers monitor mempool for profitable transactions
- Validators choose which transactions to include
- Users don't see pending transactions

**Incentive Analysis:**
- Searchers: Can predict price impact of pending trades
- Users: Unaware they're being sandwiched
- Validators: Profit from searcher bribes

**Outcome:**
- Users pay invisible tax on large trades
- Value extracted by sophisticated actors
- "Fair" execution requires private mempools

**Research Question:**
Is this extraction or efficient price discovery?

---

### Case: Insider Oracle Updates
**Setup:**
- Oracle updates before public market reflects change
- Oracle operator knows update timing
- Positions can be taken before update

**Incentive Analysis:**
- Operator: Can front-run own updates
- Users: Receive stale prices
- No transparency into update process

**Example:**
- API3 OEVA-15: OEV parties can delay execution
- Information asymmetry creates extraction opportunity

---

## Pattern 4: Time Inconsistency

### Definition
Incentives change over time, leading to commitment problems.

### Case: Early Liquidity Provider Exit
**Setup:**
- Protocol bootstraps with high rewards for early LPs
- Rewards decrease over time
- No lock-up requirements

**Incentive Analysis:**
- Early: High rewards, provide liquidity
- Later: Rewards drop, rational to exit
- Protocol: Sudden liquidity loss

**Outcome:**
- "Rug pull" by collective LP exit, not admin
- Incentive structure designed this way

**Mitigation:**
- Vesting schedules
- Lock-up periods
- Gradual reward decay

---

### Case: Audit Post-Completion Risk
**Setup:**
- Protocol audited before launch
- Audit finds issues marked "acknowledged"
- Protocol launches without fixes

**Incentive Analysis:**
- Team: Wants to launch, capture market
- Auditors: Paid regardless of fixes
- Users: Assume audit = safe

**Outcome:**
- 43% of Quantstamp findings acknowledged (not fixed)
- Protocols launch with known vulnerabilities

**Research Implication:**
"Audited" ≠ "Secure". Check "Acknowledged" findings.

---

## Pattern 5: Adverse Selection

### Definition
Parties with private information self-select into systems.

### Case: Insurance Protocol
**Setup:**
- Protocol offers insurance against smart contract risk
- Premium based on average risk

**Incentive Analysis:**
- Safe protocols: Don't need insurance, don't buy
- Risky protocols: Need insurance, do buy
- Pool: Adverse selection toward risk

**Outcome:**
- Insurance pool underpriced
- Claims exceed reserves
- Protocol insolvency

**Example:**
- Multiple DeFi insurance protocols struggled with this

**Mitigation:**
- Risk-based pricing
- Underwriting requirements
- Collateralization requirements

---

## Pattern 6: Multi-Party Coordination Failures

### Definition
System requires coordination that doesn't happen.

### Case: Validator Cartels
**Setup:**
- Proof-of-Stake consensus
- Validators can extract MEV
- Cartel can censor transactions

**Incentive Analysis:**
- Individual: Join cartel for higher rewards
- Collective: Cartel controls consensus
- Users: Censored, extracted

**Game Theory:**
Prisoner's dilemma — individual rationality leads to collective suboptimality.

**Research Question:**
When does MEV extraction become consensus attack?

---

### Case: Multisig Signer Abstention
**Setup:**
- Critical operations require M-of-N signatures
- Signers have no penalty for inaction

**Incentive Analysis:**
- Signer: Abstain = no risk, no effort
- Collective: Operations can't execute
- Attacker: Only need to compromise M-N+1 inactive signers

**Example:**
- Radiant Capital: 3-of-11 multisig compromised
- Low signing threshold + inactive signers = vulnerability

---

## Incentive Analysis Framework

### Questions to Ask:

1. **Who are the actors?**
   - Users, operators, validators, attackers

2. **What can each actor do?**
   - Actions available to each party

3. **What does each actor want?**
   - Economic incentives, reputation, ideology

4. **What happens if they act selfishly?**
   - Equilibrium outcome of rational play

5. **Is there a profitable attack?**
   - If yes, it will happen eventually

### Red Flags:

- Trusted roles with extraction opportunities
- No penalty for malicious behavior
- Rewards front-loaded, costs back-loaded
- Coordination required but no coordination mechanism
- Information asymmetry favoring operators

---

*Incentive misalignment is the root cause of many "exploits." The code is fine. The game is not.*
