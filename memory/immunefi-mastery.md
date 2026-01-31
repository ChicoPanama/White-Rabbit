# Immunefi Platform Mastery Guide
*Created: 2026-01-30 | Last Updated: 2026-01-30*

## Platform Overview

**Immunefi** is the world's leading bug bounty platform for Web3 and blockchain security, positioning itself as "The Security OS for the Onchain Economy."

### Key Statistics (as of Jan 2026)
- **$180B+** Protected across Web3
- **$25B+** Hacks prevented 
- **60k+** Security researchers in ecosystem
- **650+** Secured protocols
- **$110M+** Total bounties paid out
- **276** Active bounty programs
- **$162M** Available in bug bounties

### Major Payouts (Hall of Fame)
- **$10M** - satya0x for Wormhole critical vulnerability
- **$6M** - pwning.eth for Aurora infinite spend bug
- **$2.2M** - Leon Spacewalker for Polygon balance check bug
- **$2M** - Saurik for Optimism infinite money duplication

---

## Platform Structure

### 1. Bug Bounty Programs
**Traditional continuous programs for live protocols**

**Key Features:**
- Ongoing protection for mainnet protocols
- Real-time bug reporting and response
- "Legendary response times" (industry-leading)
- Expert triaging by Immunefi team
- Largest bounties in the industry

**Filter Options:**
- General/Premium programs
- KYC requirements
- PoC requirements
- Arbitration availability
- Safe Harbor protections
- Vault TVL ranges
- Ecosystem types

### 2. Audit Competitions
**Time-bound, crowdsourced security reviews**

**Statistics:**
- **1,970+** bug reports generated (through Sep 2024)
- **$2.3M** paid to researchers
- **28.5%** valid report conversion rate
- **Up to 19x** engagement vs standard programs
- **20%** more cost-effective than market alternatives

**Use Cases:**
- Pre-mainnet launch hardening
- Post-audit validation
- Critical code update reviews
- Community building around security

**Process:**
1. **Launch:** Projects set reward pool and timeframe
2. **Hunt:** Researchers review code during competition window
3. **Real-time reporting:** Bugs reported and triaged live
4. **Distribution:** Rewards allocated based on bug severity/impact
5. **Report:** Consolidated findings report delivered

---

## Severity Classification System v2.3

### Blockchain/DLT Vulnerabilities

**🔴 Critical:**
- Network shutdown (unable to confirm transactions)
- Chain split requiring hard fork
- Direct loss of funds
- Permanent fund freezing (hard fork to fix)

**🟠 High:**
- Network partition (unintended chain split)
- Block delay >500% of 24h average
- Transaction processing beyond parameters
- RPC crashes affecting >25% market cap projects

**🟡 Medium:**
- >30% increase in node resource consumption
- Shutdown of 30%+ nodes (non-brute force)
- Unintended smart contract behavior (no direct funds risk)

**🔵 Low:**
- Shutdown of 10-30% nodes
- Transaction fee modification outside parameters

### Smart Contract Vulnerabilities

**🔴 Critical:**
- Governance manipulation
- Direct theft of user funds/NFTs
- Permanent freezing of funds/NFTs
- Unauthorized NFT minting
- Manipulable RNG exploitation
- Protocol insolvency

**🟠 High:**
- Theft of unclaimed yield/royalties
- Permanent freezing of unclaimed assets
- Temporary freezing of funds/NFTs

**🟡 Medium:**
- Contract unable to operate (lack of funds)
- Block stuffing/griefing attacks
- Gas theft/unbounded consumption

**🔵 Low:**
- Failed promised returns (no value loss)

### Web/App Vulnerabilities

**🔴 Critical:**
- Arbitrary system command execution
- Sensitive data retrieval (passwords, keys)
- Taking down application/NFT URI
- State-modifying actions on behalf of users
- Direct theft of funds/NFTs
- Malicious wallet interactions
- XSS through NFT metadata

**🟠 High:**
- Static content injection (persistent)
- Sensitive user detail changes
- Confidential information disclosure
- Subdomain takeover

**🟡 Medium:**
- Non-sensitive user detail changes
- Reflected HTML injection
- Open redirect vulnerabilities

**🔵 Low:**
- User detail changes (significant interaction required)
- Broken/expired link takeover
- Temporary access disruption

---

## How to Participate as a Security Researcher

### Getting Started Process
1. **Explore Programs:** Browse 276+ active bounties
2. **Review Code:** Study scope and requirements
3. **Submit Reports:** Use bugs.immunefi.com platform
4. **Get Paid:** After validation and fixing

### Account Setup
- Create account on immunefi.com
- Complete KYC if required by specific programs
- Access bugs.immunefi.com for submissions

### Best Practices for Submissions
- **Read scope carefully** - Out of scope bugs don't get paid
- **Provide clear PoC** when required
- **Follow program-specific rules**
- **Use structured reporting format**
- **Include impact assessment**

### Research Community
- **35k+** total security researchers
- **1000+** proven researchers with mainnet bug finds
- Access to exclusive audit competitions
- Real-time collaboration and learning

---

## Out of Scope (Default)

### Universal Exclusions
- Self-exploited vulnerabilities causing damage
- Attacks requiring leaked credentials
- Privileged address attacks (without additional modifications)
- External stablecoin depegging (not caused by code bug)
- GitHub secrets without production usage proof
- Best practice recommendations
- Feature requests
- Social engineering/phishing

### Smart Contract Specific
- Third-party oracle data issues (not manipulation)
- Basic economic attacks (51% attacks)
- Liquidity impacts
- Sybil attacks
- Centralization risks

### Web/App Specific
- Theoretical impacts without demonstration
- Physical device access required
- Local network access required
- Self-XSS vulnerabilities
- CSRF without state modification
- Missing security headers (without impact)
- DDoS-only impacts
- Browser/plugin-specific bugs

---

## Program Types & Features

### Premium Programs
- Enhanced triage support
- Faster response times
- Higher bounty pools
- Additional protections

### Safe Harbor Programs
- Legal protection for researchers
- Clear rules of engagement
- Good faith research protection

### Triaged by Immunefi
- Expert security team validation
- Real-time bug assessment
- Quality assurance for both sides

### Immunefi Standard
- Standardized program structure
- Consistent rules and processes
- Baseline protection guarantees

---

## Key Platform Features

### For Researchers
- **Largest bounties globally**
- **Fastest response times**
- **Expert triage support**
- **Real-time bug submission**
- **Quality program curation**
- **Legal protections (Safe Harbor)**

### For Projects
- **Proven researcher community**
- **Expert marketing support**
- **Real-time vulnerability discovery**
- **Audit competition options**
- **Managed triaging services**
- **Speed to market optimization**

---

## Economic Model

### Bounty Distribution
- Based on severity classification
- Impact-weighted against other submissions
- Immediate payment upon validation
- Transparent reward structure

### Audit Competition Rewards
- Fixed pool distributed among participants
- Merit-based allocation
- Real-time bug value assessment
- End-of-competition summary reports

---

## Strategic Insights

### Platform Advantages
1. **Scale:** Largest Web3 security community
2. **Quality:** Proven track record with $25B+ protected
3. **Speed:** Industry-leading response times
4. **Innovation:** Audit competitions vs traditional bounties
5. **Expertise:** In-house security expert triaging

### Market Position
- Dominant in Web3/blockchain security
- Higher stakes than traditional platforms
- Revolutionary asset protection model
- Community-driven security approach

### Success Factors for Researchers
- **Deep protocol understanding**
- **Quick vulnerability identification**
- **Clear communication skills**
- **Persistence and thoroughness**
- **Real-time responsive research**

---

## Action Items for WhiteRabbit Integration

### Immediate Opportunities
1. **Profile Creation:** Set up research account
2. **Program Analysis:** Identify high-value targets matching our scanning capabilities
3. **Competition Monitoring:** Track upcoming audit competitions
4. **Scope Mapping:** Align our 6-stage pipeline with Immunefi requirements

### Strategic Integration
1. **Automated Scanning:** Deploy against in-scope contracts
2. **Real-time Submission:** Integrate with bugs.immunefi.com API
3. **Impact Assessment:** Enhance severity classification automation
4. **Report Generation:** Template our findings for Immunefi format

### Revenue Optimization
- Target critical/high severity vulnerabilities
- Focus on programs with highest bounty potential
- Participate in audit competitions for guaranteed rewards
- Build reputation through consistent high-quality submissions

---

*"Welcome to Web3, cybersecurity's most rewarding frontier"* - Immunefi

The hunt continues. The rabbit hole goes deeper. 🐇