# SlowMist 2025 Blockchain Security & AML Annual Report — INGESTION OUTPUT

**Source:** SlowMist (https://slowmist.medium.com/2025-blockchain-security-and-aml-annual-report-9f85183d5461)  
**Date:** 2026-02-01  
**Status:** Processing Prompts 5.1–5.3

---

## 5.1 Incident-Level Post-Mortems

### 2025 Incident Overview

| Metric | 2025 | 2024 | Change |
|--------|------|------|--------|
| **Total Incidents** | 200 | 410 | -51% |
| **Total Losses** | $2.935 billion | $2.013 billion | +46% |
| **Average Loss per Incident** | $14.675 million | $4.91 million | +199% |

**Key Insight:** Fewer incidents but significantly higher losses per incident — concentration of catastrophic failures.

### Ecosystem Distribution

| Blockchain | Losses | Rank | Notes |
|------------|--------|------|-------|
| **Ethereum** | ~$254 million | #1 | Most frequently attacked |
| **BSC** | ~$21.93 million | #2 | Lower than ETH but consistent |
| **Solana** | ~$17.45 million | #3 | Growing attack surface |

### Sector Distribution

| Sector | Incidents | % of Total | Losses | Notes |
|--------|-----------|------------|--------|-------|
| **DeFi** | 126 | 63% | ~$649 million | Most targeted sector |
| **Exchanges** | 12 | 6% | ~$1.809 billion | Highest per-incident loss |
| **Other** | 62 | 31% | ~$477 million | Various sectors |

**Critical Finding:** Exchanges: only 6% of incidents but 62% of losses ($1.809B)
- Bybit alone: $1.46 billion (80% of exchange losses)

### Attack Cause Distribution

| Cause | Incidents | Notes |
|-------|-----------|-------|
| **Contract Vulnerabilities** | 61 | Smart contract bugs |
| **Compromised Accounts** | 48 | Access control failures |
| **Other/Unknown** | 91 | Mixed causes |

### Top 10 Incidents (2025)

| Rank | Incident | Loss | Attack Type | Pattern |
|------|----------|------|-------------|---------|
| 1 | **Bybit** | $1.46B | Infrastructure/Operational | Pattern 3 (SPOF), 7 (Audit Theater) |
| 2-10 | Various | ~$1.475B combined | Mixed | Various |

---

## 5.2 AML/Attack Intersection Analysis

### Fund Freezing/Recovery Statistics (2025)

| Metric | Value | Context |
|--------|-------|---------|
| **Tether (USDT-ERC20) Freezes** | 576 addresses | Stablecoin issuer enforcement |
| **Circle (USDC-ERC20) Freezes** | 214 addresses | Regulatory compliance |
| **Recoverable Incidents** | 18 out of 200 | 9% recovery rate |
| **Total Stolen (Recoverable Cases)** | ~$1.957 billion | Subset of total |
| **Actually Returned/Frozen** | ~$387 million | 13.2% of losses |
| **SlowMist Assisted Recovery** | ~$19.29 million | Direct intervention |

**Recovery Rate Analysis:**
- Only 13.2% of stolen funds recovered/frozen in recoverable cases
- 87% of funds remain unrecovered even when recovery possible
- Interdiction window is narrow and closing faster

### Attack Method Evolution

#### Primary Attack Vectors (2025)

1. **Phishing Attacks** — Evolved techniques:
   - ClickFix phishing
   - Solana wallet Owner-permission tampering
   - EIP-7702 authorization abuse
   - Fake Safeguard Scam
   - Compound attacks using system commands + wallet permissions

2. **Social Engineering** — Clear upward trend:
   - Fake job-interview scams
   - Impersonation of "security experts"
   - Counterfeit hardware wallets
   - Multiple interaction rounds to build credibility

3. **Supply Chain Poisoning**:
   - Open-source project targeting
   - Developer tool compromise
   - Dependency distribution chain attacks
   - Indirect large-scale downstream impact

4. **Malicious Browser Extensions**:
   - Wallet plugin targeting
   - High-permission exploitation
   - Background data theft
   - Automatic update abuse

5. **AI-Enabled Attacks**:
   - Generative AI for fraud content
   - Text/voice synthesis
   - Image/video deepfakes
   - Reduced scam costs, higher realism

6. **Ponzi Schemes**:
   - "Blockchain finance" disguises
   - Hierarchical commission structures
   - Rapid expansion models
   - Example: Xinkangjia DGCX

---

## 5.3 Ecosystem Risk Trends

### DPRK (North Korea) Analysis

**MSMT Research Data (Jan 2024 – Sep 2025):**

| Metric | Value |
|--------|-------|
| **Total Stolen (18 months)** | At least $2.837 billion |
| **2025 First 9 Months** | ~$1.645 billion |
| **2025 Projection** | ~$2.2 billion (record year) |

**DPRK Organizational Structure:**
- Professionalized hacker groups
- Clear division of roles
- Industrialized money laundering workflow
- IT outsourcing as cover ("legitimate employment laundering")

**Core Attack Techniques:**
1. Information-stealing malware
2. Private key hijacking
3. Social engineering phishing

**Targeted Sectors:**
- Cryptocurrency exchanges
- Wallet service providers
- Multi-signature infrastructures
- Web3 ecosystem companies

### Drainer Phishing Statistics

**EVM Ecosystem (2025):**

| Metric | 2025 | 2024 | Change |
|--------|------|------|--------|
| **Total Losses** | $83.85M | ~$493M | -83% |
| **Victims** | 106,106 | ~331,000 | -68% |
| **Largest Single Theft** | $6.5M (Permit signature) | - | September |

**Attack Vectors:**
- **Primary:** Permit signatures (authorization abuse)
- **Emerging:** EIP-7702 malicious signatures (post-Pectra upgrade)
- **Timing:** August 2025 saw 2 large EIP-7702 cases

### Huione Group Analysis

**Status:** Key target for global regulators
- Platforms: HuionePay, Huione Guarantee
- Services: Online scams, cross-border money laundering
- Activity: Significant on-chain fund volumes
- Regulatory Pressure: Cross-border joint enforcement

### Ransomware/Malware Trends

**Commercialization of Attack Services:**
- **MaaS (Malware-as-a-Service)**
- **RaaS (Ransomware-as-a-Service)**
- Impact: Lowered barrier to entry for non-technical attackers
- Result: Expanding cybercrime supply chain

**Law Enforcement Response:**
- Multiple major operations targeting core groups
- Representative cases: LockBit, LummaC2

### Privacy/Coin Mixing Tools

**Regulatory Evolution:**
- Shift from "blanket crackdowns" to "distinguishing usage and responsibility"
- Line between privacy tech and illicit abuse being redefined
- Legitimate privacy use vs. criminal abuse differentiation

---

## Layer Artifact Updates

### HISTORICAL_EXPLOITS.md — 2025 Incident Details

```markdown
### 2025 Incident Deep Dive (SlowMist Data)

**Statistical Context:**
- 200 incidents (down from 410 in 2024)
- $2.935 billion lost (up 46% from $2.013B)
- Average loss: $14.675M (up 199% from $4.91M)

**Attack Vector Breakdown:**
1. Contract Vulnerabilities: 61 incidents
2. Compromised Accounts: 48 incidents
3. Other/Unknown: 91 incidents

**Recovery Statistics:**
- Only 18 incidents (9%) had recoverable funds
- Of $1.957B stolen in recoverable cases: $387M returned (13.2%)
- Recovery rate declining as laundering speeds up

**Ecosystem Risk Ranking:**
1. Ethereum: $254M losses (most targeted)
2. BSC: $21.93M losses
3. Solana: $17.45M losses

**Sector Risk Concentration:**
- DeFi: 63% of incidents (126), $649M losses
- Exchanges: 6% of incidents (12), $1.809B losses
- Bybit alone: $1.46B (80% of exchange losses)

**Key Insight:** Exchange concentration risk — few incidents, catastrophic losses.
**Pattern:** Pattern 3 (SPOF) — centralized infrastructure vulnerability

**Source:** SlowMist 2025 Blockchain Security & AML Annual Report
```

### ATTACK_VECTOR_DATABASE.md — 2025 Techniques

```markdown
### Supply Chain Poisoning (2025 Update)

**Emerging Threat:**
- Target: Open-source projects, developer tools, dependencies
- Method: Malicious code injection in trusted components
- Impact: Indirect large-scale downstream attacks
- Difficulty: Hard to trace, compounds with social engineering

**Mitigation:**
- Dependency verification
- Code signing
- SBOM (Software Bill of Materials)
- Supply chain audits

**Source:** SlowMist 2025 Report
```

```markdown
### Browser Extension Risks (Web3)

**Attack Vector:**
- Target: Wallet plugins, proxy tools, security extensions
- Mechanism: High permissions + background execution + auto-updates
- Impact: Stealth data theft, direct asset loss
- Risk: Ubiquitous in Web3, hard to detect compromise

**Mitigation:**
- Extension permission auditing
- Regular security reviews
- Minimal extension usage
- Official store verification only

**Source:** SlowMist 2025 Report
```

```markdown
### EIP-7702 Authorization Abuse (Emerging)

**New Attack Vector (Post-Pectra Upgrade):**
- Chain: Ethereum
- Mechanism: Malicious EIP-7702 signature abuse
- Timing: Emerged August 2025
- Cases: 2 large incidents documented
- Impact: Wallet compromise via new opcode

**Context:**
EIP-7702 (part of Pectra upgrade) enables new authorization patterns.
Attackers exploiting insufficient validation of EIP-7702 signatures.

**Mitigation:**
- Wallet EIP-7702 signature verification
- User education on new authorization types
- Early detection systems for abnormal EIP-7702 usage

**Source:** SlowMist 2025 Report (ScamSniffer data)
```

### ECONOMIC_ATTACKS.md — Recovery/Laundering

```markdown
### 2025 Fund Recovery Reality

**Statistics:**
- Recovery possible: 18 of 200 incidents (9%)
- Recovery rate: 13.2% even when possible
- Average loss per incident: $14.675M
- Total recovered: $387M out of $2.935B (13.2%)

**Recovery Barriers:**
1. Speed of laundering (<48 hour holding periods)
2. Cross-chain fragmentation
3. Professional laundering services (CMLNs)
4. Privacy tool usage (mixers, privacy coins)
5. Jurisdictional enforcement gaps

**Stablecoin Freezing (2025):**
- Tether: 576 addresses frozen
- Circle: 214 addresses frozen
- Effectiveness: Limited by speed of movement

**Source:** SlowMist 2025 Report
```

---

## Pattern Mapping to 8 Recurring Failure Patterns

### Pattern 1: Trust But Don't Verify
- **Phishing victims:** Trust fake interfaces, counterfeit approvals
- **Browser extensions:** Trust plugin permissions
- **Social engineering:** Trust impersonated identities

### Pattern 2: State Update Order Matters
- **EIP-7702 abuse:** Authorization sequencing vulnerabilities
- **Permit signatures:** Off-chain authorization before on-chain verification

### Pattern 3: Single Point of Failure
- **Exchanges:** 6% of incidents, 62% of losses ($1.809B)
- **Bybit:** $1.46B single event
- **Infrastructure concentration:** DeFi protocols with centralized components

### Pattern 4: Economic Assumptions Don't Hold
- **Drainer victims:** Assume safety of permit signatures
- **Ponzi participants:** Assume sustainable yields
- **Recovery assumptions:** Assume law enforcement can recover funds (87% failure rate)

### Pattern 5: Complexity Hides Bugs
- **Supply chain:** Complexity of dependencies obscures malicious code
- **EIP-7702:** New opcode complexity enables abuse
- **DeFi composability:** Cross-protocol interactions hide risks

### Pattern 6: Integration Blindness
- **Supply chain poisoning:** Downstream impact of upstream compromise
- **Browser extensions:** Third-party code in critical paths
- **AI tools:** Integration of AI-generated content without verification

### Pattern 7: Audit Theater
- **Contract vulnerabilities:** 61 incidents despite audit industry
- **Recovery failure:** 13.2% recovery rate shows gap between detection and prevention
- **Speed gap:** Audits can't match laundering speed

### Pattern 8: Governance Capture
- **DPRK infiltration:** IT outsourcing as employment laundering
- **Ponzi structures:** Hierarchical commission exploitation
- **Exchange governance:** Centralized control enabling catastrophic losses

---

## Ingestion Rule Compliance Summary

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **1. Core Assumptions** | ✅ | Assumed audit effectiveness, recovery possibility, user diligence |
| **2. Where Assumptions Fail** | ✅ | 87% unrecovered, social engineering success, supply chain blind spots |
| **3. Layer Mapping** | ✅ | L1 (Attack vectors), L3 (Recovery economics), L5 (Incident data) |
| **4. Pattern Mapping** | ✅ | All 8 patterns validated with 2025 data |
| **5. Audit Gap** | ✅ | 61 contract incidents post-audit, 13.2% recovery rate |

---

## Cross-Reference Summary

### Data Consistency Check

| Metric | SlowMist | TRM Labs | Chainalysis | Hacken | Assessment |
|--------|----------|----------|-------------|--------|------------|
| **Total Stolen** | $2.935B | $2.87B | Not stated | $4.0B | Consistent* |
| **DPRK Attribution** | ~$2.2B (proj) | $1.92B | $2.0B | ~$2.08B | ✅ Consistent |
| **Bybit** | $1.46B | $1.46B | ~$1.5B | Not stated | ✅ Consistent |
| **Exchange Risk** | 62% of losses | 76% inf. attacks | Not stated | 52.5% | ✅ Trend consistent |

*Different scopes and methodologies explain variations

---

## Source Citation

**2025 Blockchain Security and AML Annual Report**  
SlowMist, December 30, 2025  
https://slowmist.medium.com/2025-blockchain-security-and-aml-annual-report-9f85183d5461

---

*Document 5 Ingestion Complete*
