# Governance Attacks & DAO Exploits Database

## Executive Summary

This database catalogs governance vulnerabilities, attack vectors, and real-world exploits affecting DAOs and DeFi protocols. It covers both technical exploits (flash loans, proposal manipulation, timelock bypasses) and social engineering attacks.

## Table of Contents

1. [Major Attack Cases](#major-attack-cases)
2. [Technical Attack Vectors](#technical-attack-vectors)
3. [Social Engineering Vectors](#social-engineering-vectors)
4. [Defensive Measures](#defensive-measures)
5. [Attack Taxonomy](#attack-taxonomy)

---

## Major Attack Cases

### Beanstalk DAO Flash Loan Attack (April 2022)
- **Loss**: ~$182 million
- **Attack Type**: Flash loan governance manipulation
- **Technical Details**:
  - Attacker borrowed massive amounts of assets via flash loans
  - Used borrowed funds to purchase BEAN and STALK tokens
  - Gained voting majority through temporary token holdings
  - Submitted and voted on malicious governance proposal
  - Proposal executed immediately, draining protocol treasury
  - Repaid flash loans with stolen funds
- **Key Vulnerability**: No time delay between proposal submission and execution
- **Social Factor**: Community assumed large holders were legitimate long-term investors

### BuildFinance DAO Attack (February 2021)
- **Loss**: ~$470,000
- **Attack Type**: 51% governance attack via accumulated voting power
- **Technical Details**:
  - Attacker gradually accumulated BUILD tokens over time
  - Reached majority voting power threshold
  - Submitted proposal to mint additional tokens to attacker's address
  - Used legitimate governance process to steal funds
- **Key Vulnerability**: No safeguards against single-entity control
- **Social Factor**: Gradual accumulation went unnoticed by community

### Compound cDAI Attack (October 2022)
- **Loss**: Potential $162 million (prevented)
- **Attack Type**: Proposal 117 manipulation attempt
- **Technical Details**:
  - Malicious proposal to drain protocol reserves
  - Exploited governance delegation mechanics
  - Community intervention prevented execution
- **Key Vulnerability**: Complex proposal mechanics obscured malicious intent

---

## Technical Attack Vectors

### 1. Flash Loan Governance Attacks

**Mechanism:**
- Borrow large amounts of governance tokens via flash loans
- Use temporary voting power to pass malicious proposals
- Execute proposals immediately or with minimal delay
- Repay loans with stolen funds

**Variants:**
- Direct token borrowing (if governance tokens are available on lending markets)
- Collateral conversion (borrow other assets, swap for governance tokens)
- Cross-protocol manipulation (use tokens from multiple protocols)

**Prerequisites:**
- Governance tokens available for borrowing
- Short or no timelock delays
- Sufficient liquidity for large token purchases
- Immediate proposal execution capability

### 2. Voting Power Concentration

**51% Attacks:**
- Gradual accumulation of governance tokens
- Coordination between multiple parties
- Exploitation of token distribution mechanics

**Delegation Manipulation:**
- Convincing users to delegate voting power
- Social engineering of large token holders
- Exploitation of delegation mechanics

**Vampire Attacks:**
- Incentivizing users to migrate governance tokens
- Using governance power from one protocol against another

### 3. Proposal Manipulation

**Obfuscation Techniques:**
- Complex technical language in proposals
- Bundling malicious code with legitimate changes
- Time-sensitive proposals during low community attention
- Misleading proposal descriptions

**Execution Timing:**
- Submitting proposals during holidays/weekends
- Coordinating with market volatility
- Exploiting different timezone community participation

**Technical Exploitation:**
- Exploiting smart contract bugs in governance systems
- Manipulating proposal validity checks
- Bypassing proposal review processes

### 4. Timelock Bypasses

**Emergency Function Abuse:**
- Exploiting emergency pause/upgrade functions
- Social engineering of multisig signers
- Compromising timelock administrators

**Code Vulnerabilities:**
- Smart contract bugs in timelock implementations
- Reentrancy attacks on governance contracts
- Integer overflow/underflow in time calculations

**Administrative Exploits:**
- Compromise of admin keys
- Social engineering of developers
- Insider threats from team members

---

## Social Engineering Vectors

### 1. Community Manipulation

**Reputation Building:**
- Long-term community participation before attack
- Contributing to protocol development
- Building trust through public engagement

**Information Warfare:**
- Spreading false information about proposals
- Creating urgency around decisions
- Manipulating community sentiment

**Sockpuppet Accounts:**
- Creating multiple fake community identities
- Coordinated voting campaigns
- Artificial consensus building

### 2. Developer Targeting

**Key Compromise:**
- Phishing attacks on developers
- Social engineering for private key access
- Compromising development infrastructure

**Code Injection:**
- Introducing malicious code through contributions
- Backdoors in smart contract upgrades
- Supply chain attacks on dependencies

**Insider Threats:**
- Malicious team members
- Compromised employees
- Disgruntled former contributors

### 3. Token Holder Manipulation

**Delegation Attacks:**
- Convincing users to delegate voting power
- Offering incentives for delegation
- Creating fake delegation services

**Panic Selling:**
- Creating market conditions to force token sales
- Spreading FUD to reduce voting participation
- Timing attacks during market stress

**Airdrop Exploitation:**
- Gaming token distribution mechanisms
- Sybil attacks on airdrop criteria
- Exploiting retroactive governance distributions

---

## Attack Taxonomy

### By Execution Speed
1. **Flash Attacks** (Minutes): Flash loan governance attacks, emergency function abuse
2. **Rapid Attacks** (Hours-Days): Concentrated buying, timelock bypasses
3. **Slow Burn** (Weeks-Months): Gradual accumulation, reputation building, delegation gathering

### By Resource Requirements
1. **Low Capital**: Social engineering, insider threats, code vulnerabilities
2. **Medium Capital**: Delegation manipulation, small governance attacks
3. **High Capital**: Flash loan attacks, 51% accumulation

### By Technical Complexity
1. **Basic**: Token purchasing, simple proposal submission
2. **Intermediate**: Flash loan coordination, delegation mechanics
3. **Advanced**: Smart contract exploitation, complex proposal obfuscation

### By Social Component
1. **Purely Technical**: Automated smart contract exploits
2. **Hybrid**: Technical exploits with social engineering components
3. **Primarily Social**: Reputation-based attacks, insider threats

---

## Impact Assessment Framework

### Financial Impact
- Direct losses (treasury drainage)
- Market impact (token price effects)
- Ecosystem damage (protocol reputation)

### Governance Impact
- Loss of community trust
- Centralization of control
- Precedent for future attacks

### Protocol Health
- Code vulnerabilities exposed
- Need for emergency measures
- Long-term sustainability concerns

---

## Detection Indicators

### On-Chain Signals
- Large token accumulation by single address
- Unusual delegation patterns
- Flash loan activity near governance events
- Rapid proposal submission and voting

### Off-Chain Signals
- New community members with strong opinions
- Urgent proposals without proper discussion
- Coordinated social media campaigns
- Unusual trading patterns in governance tokens

### Social Signals
- Requests for delegation without clear rationale
- Pressure for quick decisions on proposals
- Anonymous or new proposers for significant changes
- Community division on typically consensus issues

---

*This database is a living document. Continue to update with new attack vectors, cases, and defensive measures as they emerge.*