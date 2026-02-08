# White Hat Security Research & Audit Report Presentation

A comprehensive skill for agents conducting ethical smart contract security research and presenting professional audit reports to protocols. Based on methodologies from the White-Rabbit autonomous vulnerability scanner.

## Trigger Conditions

Use this skill when:
- Conducting smart contract security audits
- Preparing vulnerability reports for protocols
- Performing responsible disclosure
- Setting up white hat hunting workflows
- Presenting findings to bug bounty programs
- Learning DeFi security research best practices

## Core Principles of White Hat Hacking

### 1. Ethical Foundation

**Golden Rules:**
- Never test vulnerabilities on mainnet - always use forked state
- Never exploit vulnerabilities for personal gain
- Always follow responsible disclosure timelines (14-45 days)
- Document everything with timestamps and evidence
- Respect CFAA good-faith security research guidelines

**Legal Compliance:**
- Operate within bug bounty program scope
- Obtain written authorization when testing outside bounty programs
- Maintain audit trails for legal defense
- Never access systems beyond what's necessary to prove vulnerability

### 2. Vulnerability Research Methodology

**The 6-Stage Verification Pipeline:**

```
Stage 1: Context Gathering
├── Check protocol's audit history
├── Identify known security patterns
├── Review similar protocol exploits
└── Understand business logic

Stage 2: Static Analysis
├── Run Slither for automated detection
├── AI-assisted business logic review
├── Manual code review of critical paths
└── Dependency and import analysis

Stage 3: False Positive Filtering
├── Apply known FP pattern matching
├── Cross-reference with audit history
├── Verify exploitability conditions
└── Check for existing mitigations

Stage 4: Verification (Forked Mainnet)
├── Build proof-of-concept exploit
├── Test on forked state ONLY
├── Document exact reproduction steps
└── Calculate potential impact

Stage 5: Risk Scoring
├── Assess likelihood of exploitation
├── Estimate financial impact
├── Evaluate ease of exploitation
└── Consider affected user count

Stage 6: Report Preparation
├── Professional documentation
├── Clear remediation guidance
├── Impact quantification
└── Supporting evidence
```

### 3. Priority Vulnerability Categories

**By Financial Impact (Historical Data):**

| Category | Historical Loss | Case Count | Priority |
|----------|-----------------|------------|----------|
| Logic Errors | $12.5B | 298 | Critical |
| Access Control | $4.4B | 36 | Critical |
| Reentrancy | $419M | 39 | High |
| Signature Replay | $407M | 2 | High |
| Upgrade Vulnerabilities | $328M | 2 | High |
| Compiler Bugs | $201M | 3 | Medium |
| Donation Attacks | $197M | 2 | Medium |

**Logic Errors (65% of losses):**
- Input validation bypasses
- Business logic flaws
- State transition errors
- Oracle manipulation
- Price calculation errors

**Access Control:**
- Admin key compromise
- Governance attacks
- Multi-signature exploits
- Role-based access bypasses

## Audit Report Structure

### Professional Report Template

```markdown
# Security Audit Report: [Protocol Name]

## Executive Summary
- **Auditor:** [Your Name/Organization]
- **Date:** [Report Date]
- **Scope:** [Contracts/Commit Hash]
- **Severity Summary:** [Critical: X, High: X, Medium: X, Low: X]

## Scope & Methodology
### Contracts Reviewed
- [Contract addresses or file paths]
- [Commit hash / Version]

### Tools & Techniques
- Static analysis (Slither, Mythril, etc.)
- Manual code review
- Forked mainnet testing
- Formal verification (if applicable)

## Findings

### [CRITICAL-01] Vulnerability Title
**Severity:** Critical
**Status:** Open / Acknowledged / Fixed
**Location:** `Contract.sol:L42-L58`

#### Description
[Clear, technical description of the vulnerability]

#### Impact
[Specific impact: funds at risk, user exposure, protocol integrity]

#### Proof of Concept
```solidity
// PoC code demonstrating the vulnerability
// Tested on forked mainnet at block [X]
```

#### Recommended Remediation
```solidity
// Suggested fix with code example
```

#### References
- [Link to similar historical exploit]
- [Relevant security standard]

---

### [HIGH-01] Next Finding...
[Continue pattern for each finding]

## Appendix
### A. Test Environment
- Chain: [Mainnet Fork / Testnet]
- Block Number: [X]
- Tools Used: [List]

### B. Verification Results
[PoC execution logs and evidence]

### C. Disclaimer
This audit is not a guarantee of security. Smart contracts
carry inherent risks. The findings represent the auditor's
assessment at the time of review.
```

## Responsible Disclosure Process

### Step 1: Pre-Disclosure Checklist
- [ ] Verify vulnerability is real (PoC on fork)
- [ ] Document full reproduction steps
- [ ] Estimate financial impact
- [ ] Check for existing bug bounty program
- [ ] Prepare professional report

### Step 2: Contact Protocol
**Priority Order:**
1. **Bug Bounty Platform** (Immunefi, HackerOne, Code4rena)
   - Submit through official platform
   - Follow their disclosure guidelines
   - Await triaging and response

2. **Direct Security Contact**
   - Look for `security@protocol.com`
   - Check for security.txt file
   - Use encrypted communication (PGP if available)

3. **Official Channels** (if no security contact)
   - Discord: Tag core team members privately
   - Contact through official website
   - Do NOT disclose publicly

### Step 3: Disclosure Timeline

```
Day 0:     Initial report submitted
Day 1-3:   Await acknowledgment
Day 7:     Follow up if no response
Day 14:    Standard minimum disclosure window
Day 45:    Maximum disclosure window for critical DeFi
Day 45+:   Public disclosure (if unresolved)
```

**Timeline Adjustments:**
- Extend if team is actively working on fix
- Shorten if vulnerability is being actively exploited
- Coordinate with team on patch release timing

### Step 4: Communication Best Practices

**DO:**
- Be professional and courteous
- Provide clear reproduction steps
- Offer remediation suggestions
- Maintain confidentiality during process
- Document all communications

**DON'T:**
- Threaten or demand payment
- Set unreasonable deadlines
- Disclose to third parties
- Exploit the vulnerability
- Exaggerate impact

## Report Presentation Tips

### For Bug Bounty Submissions

**Title:** Clear, specific, severity-indicating
```
Good: "Critical: Unrestricted withdrawal allows draining all LP funds"
Bad:  "Found a bug in the contract"
```

**Impact Statement:** Lead with business impact
```
Good: "An attacker can drain the entire $50M TVL in a single transaction
       by exploiting the unchecked return value in withdraw()"
Bad:  "The withdraw function doesn't check returns"
```

**Proof of Concept:** Executable, documented
```solidity
// PoC: Drain all LP funds
// Tested on Ethereum mainnet fork at block 18500000
// Expected result: Attacker balance increases by pool TVL

function testExploit() public {
    // Setup
    vm.createSelectFork("mainnet", 18500000);

    // Execute exploit
    vulnerable.withdraw(type(uint256).max);

    // Verify
    assertGt(token.balanceOf(attacker), 0);
}
```

### Severity Classification

**Critical (Immediate threat):**
- Direct theft of funds possible
- Protocol-wide impact
- No user action required to exploit

**High (Significant risk):**
- Funds at risk under certain conditions
- Major protocol disruption possible
- Requires specific circumstances

**Medium (Moderate risk):**
- Limited funds exposure
- Requires unlikely conditions
- Partial protocol impact

**Low (Minor issue):**
- No direct fund risk
- Best practice violations
- Minor inefficiencies

**Informational:**
- Code quality suggestions
- Gas optimizations
- Documentation improvements

## Tools & Resources

### Static Analysis
- **Slither** - Solidity static analyzer
- **Mythril** - Security analysis tool
- **Echidna** - Fuzzing tool
- **Foundry** - Testing and PoC framework

### Research Resources
- DeFiLlama - TVL and protocol data
- Rekt News - Historical exploits
- Immunefi - Bug bounty platform
- Code4rena - Competitive audits

### Verification Environment
- Foundry forked mainnet testing
- Hardhat with mainnet fork
- Tenderly for simulation

## Example Workflow

```bash
# 1. Identify target protocol
# Check TVL, audit history, bounty program

# 2. Clone and analyze
git clone [protocol-repo]
slither . --print human-summary

# 3. Manual review of findings
# Focus on logic errors, access control, reentrancy

# 4. Build PoC on fork
forge test --fork-url $RPC_URL --fork-block-number $BLOCK

# 5. Document and prepare report
# Use template above

# 6. Submit through appropriate channel
# Bug bounty > Security email > Discord
```

## Key Reminders

1. **Ethics First**: Your reputation is your most valuable asset
2. **Document Everything**: Timestamps protect you legally
3. **Fork Testing Only**: Never touch mainnet with exploits
4. **Professional Communication**: You're building relationships
5. **Follow Timelines**: Respect the disclosure process
6. **Quality Over Quantity**: One well-documented critical beats ten poorly documented lows

---

*This skill is based on white hat security research methodologies from the White-Rabbit project. Always conduct security research ethically and within legal boundaries.*
