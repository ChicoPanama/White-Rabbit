# Layer 3: Economic Attacks

**Layer Question:** "What if the code is correct but incentives are not?"

---

## Core Principle

Code can be bug-free but economically exploitable. The attacker doesn't hack the code — they hack the incentives.

---

## Category 1: Oracle Manipulation

### Pattern: Single-Source Oracle Exploitation
**Mechanism:** Manipulate sole price feed to trigger unintended liquidations or price-based actions.

**Prerequisites:**
- Protocol uses single DEX/AMM as price source
- No staleness checks
- No deviation detection
- No circuit breakers

**Attack Path:**
1. Flash loan to acquire capital
2. Large swap to move price on source DEX
3. Protocol reads manipulated price
4. Liquidations/loans execute at wrong price
5. Price returns to normal, attacker profits

**Example:**
- Alpha Homora v2 (Quantstamp audit): Uniswap oracle manipulation
- Fixed but pattern remains in unaudited forks

**Detection:**
```solidity
// Vulnerable: Single source
price = uniswapPair.getReserves();

// Safer: TWAP + staleness check
price = twapOracle.getPrice();
require(block.timestamp - price.timestamp < MAX_AGE);
```

---

### Pattern: TWAP Manipulation
**Mechanism:** Manipulate time-weighted average price over multiple blocks.

**Prerequisites:**
- Short TWAP window
- Deep liquidity in target pool
- Predictable arbitrage delays

**Attack Path:**
1. Manipulate price in Block N
2. Maintain manipulation across N+1, N+2...
3. TWAP reflects manipulated value
4. Attack on Block N+M when TWAP is skewed

**Example:**
- Compound forks with short TWAP exploited repeatedly

**Detection:**
```solidity
// Vulnerable: Short window
twapWindow = 1 hours;

// Safer: Longer window reduces manipulation impact
twapWindow = 24 hours;
```

---

## Category 2: Flash Loan Attacks

### Pattern: Price Oracle Manipulation
**Mechanism:** Use flash loan to temporarily move prices.

**Attack Flow:**
1. Flash borrow $50M stablecoin
2. Swap for $50M of Token A on DEX
3. Token A price spikes 10x
4. Use inflated Token A as collateral
5. Borrow against inflated collateral
6. Swap back, repay flash loan
7. Protocol left with bad debt

**Real-World:**
- Cream Finance, C.R.E.A.M. Iron Bank
- Numerous lending protocol hacks

**Prevention:**
- Use manipulation-resistant oracles (Chainlink + TWAP)
- Circuit breakers on large price moves
- Cooldown periods for large positions

---

### Pattern: Governance Token Accumulation
**Mechanism:** Flash acquire governance tokens to pass proposals.

**Prerequisites:**
- Governance power based on token holdings
- No delegation delay
- No voting power snapshot delay

**Attack Flow:**
1. Flash loan acquire governance tokens
2. Vote on malicious proposal
3. Execute proposal
4. Return tokens, repay loan

**Real-World:**
- Beanstalk: Flash loan governance attack ($180M)

**Prevention:**
- Delegation delays (e.g., Compound's 2-day delay)
- Voting snapshots at proposal time
- Timelock on governance actions

---

## Category 3: MEV Extraction

### Pattern: Sandwich Attacks
**Mechanism:** Frontrun large trades with same-direction trade, backrun with reverse.

**Attack Flow:**
1. Detect large pending swap in mempool
2. Frontrun: Buy Token A (pushing price up)
3. Victim's swap executes at worse price
4. Backrun: Sell Token A (price returns)
5. Attacker profits from price difference

**Impact:**
- User gets worse execution
- Attacker extracts value without protocol risk
- "Invisible tax" on large trades

**Prevention:**
- Slippage tolerance (user-defined)
- Private mempools (Flashbots, MEV-Share)
- Commit-reveal schemes

---

### Pattern: Liquidation Front-Running
**Mechanism:** Race to be first liquidator.

**Attack Flow:**
1. Monitor for underwater positions
2. When position becomes liquidatable:
   a. Submit liquidation tx with higher gas
   b. Or use Flashbots to guarantee inclusion
3. Win the liquidation race
4. Collect liquidation bonus

**Impact:**
- Honest liquidators can't compete
- Centralization of liquidation profits
- Positions may not get liquidated (bad debt)

**Prevention:**
- Dutch auction liquidations (decreasing bonus)
- Permissionless but competitive mechanisms
- Back-running protection

---

## Category 4: Liquidity Exploitation

### Pattern: Exchange Rate Manipulation
**Mechanism:** Inflate share price via direct transfers.

**Prerequisites:**
- Share price = Total Assets / Total Shares
- Protocol accepts direct token transfers
- No tracking of "real" deposits vs. transfers

**Attack Flow:**
1. Deposit small amount, receive shares
2. Directly transfer tokens to contract (not via deposit)
3. Total Assets increases, Total Shares unchanged
4. Share price inflates
5. Withdraw at inflated rate

**Real-World:**
- Hundred Finance
- Multiple Compound forks
- First存款 + 1 wei donation + later withdrawal

**Prevention:**
- Track deposits separately from transfers
- Use virtual shares/offsets (OpenZeppelin's ERC-4626)
- Minimum share minting thresholds

---

### Pattern: Liquidity Draining
**Mechanism:** Force protocol into illiquidity to extract value.

**Prerequisites:**
- Withdrawal queues
- Utilization caps
- No withdrawal cooldowns

**Attack Flow:**
1. Monitor for high utilization
2. Flash borrow to push utilization to cap
3. Other users can't withdraw
4. Panic selling in secondary markets
5. Buy at discount, repay flash loan

**Example:**
- Ensuro QSP-3: Utilization rate can exceed maximum
- Acknowledged but not fixed

**Prevention:**
- Withdrawal reserves
- Gradual utilization limits
- Circuit breakers

---

## Category 5: Griefing Attacks

### Pattern: Queue-Filling DoS
**Mechanism:** Block legitimate operations by filling capacity.

**Prerequisites:**
- Fixed-size queues
- No quality/priority ranking
- No anti-spam mechanisms

**Attack Flow:**
1. Identify queue with limited capacity
2. Submit lowest-quality entries to fill queue
3. Legitimate high-quality entries blocked
4. Protocol function degraded

**Example:**
- API3 A3M-1: Attacker can DoS queue with low-quality subscriptions
- Acknowledged (5-slot queue)

**Cost:**
- May cost attacker more than gain
- But can block competitor or force protocol changes

---

### Pattern: Sponsor Wallet Drain
**Mechanism:** Drain funds intended for gas subsidies.

**Prerequisites:**
- Sponsor wallets funded for gas
- No usage verification
- Owner can withdraw

**Attack Flow:**
1. Sponsor wallet funded with >5 ETH
2. Owner drains instead of using for gas
3. Service becomes unusable

**Example:**
- API3 A3M-2: Sponsor wallet owner must be trusted
- Acknowledged

---

## Category 6: Incentive Misalignment

### Pattern: Auctioneer Extraction
**Mechanism:** Trusted party extracts value instead of allowing fair competition.

**Prerequisites:**
- Off-chain auctioneer
- No on-chain enforcement
- High-value MEV/OEV at stake

**Attack Flow:**
1. Auctioneer sees winning bid
2. Instead of accepting, executes extraction themselves
3. Users get less than fair value

**Example:**
- API3 OEVA-4: Auctioneer has no economic incentive to behave honestly
- Acknowledged but not fixed

**Economic Analysis:**
- Reputation is only deterrent
- No on-chain penalty for extraction
- Rational actor would extract

---

### Pattern: Stale Price Exploitation
**Mechanism:** Use intentionally delayed prices for advantage.

**Prerequisites:**
- Oracle updates delayed (e.g., 15 seconds)
- Liquidations based on oracle price
- Attacker can predict delay

**Attack Flow:**
1. Price crashes on CEX/DEX
2. Wait for protocol's delayed oracle update
3. During delay window, take positions
4. Oracle updates, liquidations trigger
5. Profit from foreknowledge

**Example:**
- API3 OEVA-1: 15-second delay acknowledged as risk
- OEV extraction happens in this window

---

## Economic Attack Detection Framework

### Red Flags:
- Price-dependent logic with single oracle
- Governance without delegation delay
- Flash loan susceptibility in pricing
- Liquidation bonuses without competitive mechanisms
- Queues with fixed capacity
- Trusted parties with extraction opportunities

### Questions to Ask:
1. What would a rational attacker do?
2. Where is the MEV?
3. What happens if prices move 50% in 1 block?
4. Can someone profit from blocking others?
5. Are trusted roles actually incentivized to be honest?

---

*Economic attacks exploit incentives, not code. The code is correct — the game is rigged.*
