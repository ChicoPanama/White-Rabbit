# TRM Labs 2026 Crypto Crime Report — INGESTION OUTPUT

**Source:** TRM Labs (https://www.trmlabs.com/reports-and-whitepapers/2026-crypto-crime-report)  
**Date:** 2026-02-01  
**Status:** Processing Prompts 2.1–2.4

---

## 2.1 Illicit Activity Pattern Extraction

### 2025 Illicit Volume Statistics

| Metric | 2025 Value | 2024 Value | Change |
|--------|------------|------------|--------|
| **Total Illicit Volume** | USD 158 billion | USD 64.5 billion | +145% |
| **Illicit as % of Total** | 1.2% | 1.3% | -0.1pp |
| **Illicit Liquidity Capture** | 2.7% of VASP flows | 2.9% | -0.2pp |
| **Hacks/Thefts** | USD 2.87 billion | - | +31% |
| **Sanctions Activity** | USD 93 billion | - | +400% |
| **Fraud Schemes** | USD 35 billion | USD 38 billion | -8% |

### Key Pattern: Shift to Operational Infrastructure Attacks

**2025 Attack Vector Distribution:**

| Category | Incidents | Losses (USD) | % of Total | Avg per Incident |
|----------|-----------|--------------|------------|------------------|
| **Infrastructure Attacks** | 45 | $2.2 billion | 76% | $48.5M |
| **Code Exploits** | 52 | $350 million | 12.1% | $6.7M |
| **Protocol Attacks** | 25 | $277 million | 9.6% | $11.1M |
| **Other/Unknown** | - | - | ~2% | - |

**Critical Insight:** Infrastructure attacks (keys, wallets, access controls) drove 76% of losses despite being only 30% of incidents. Code exploits were most frequent (52 incidents) but lowest financial impact.

### Sanctions Evasion Patterns

**Russia-Linked Networks (A7):**
- **A7 Wallet Cluster:** USD 56+ billion in volume
- **A7A5 Token:** USD 72 billion (ruble-pegged stablecoin)
- **Method:** Cross-border payment platform with shell companies
- **Intermediaries:** China, Southeast Asia, South Africa
- **Infrastructure:** Shared hot wallets with Garantex/Grinex

**Key Mechanisms:**
1. **Rapid Rebranding:** Garantex → Grinex within days of sanctions
2. **Jurisdiction Hopping:** Kyrgyzstan-registered entities
3. **Stablecoin Preference:** 95% of sanctions flows in stablecoins (A7A5, USDT)
4. **OTC Broker Networks:** Professional laundering at scale

### Money Laundering Infrastructure

**Chinese Laundromat Networks:**
- **Volume:** USD 103 billion (2025) - 4x growth since 2022
- **Mechanism:** OTC brokers + underground banking
- **Services:** Escrow, guarantee marketplaces, cash-out
- **Hubs:** Huione Pay (~$73B), Haowang (~$7.3B), Xinbi (~$5.9B)
- **Settlement:** USDT on TRON (low fees, deep liquidity)

**Laundering Chain:**
```
Stolen Funds → Chinese OTC Brokers → Layering (chain-hopping) → 
Offshore Intermediaries → Cash Settlement (off-chain)
```

### Darknet Market Evolution

**Russian-Language DNMs:**
- **Volume:** USD 1.6 billion (90% of total DNM volume)
- **Trend:** 21 new markets in 2025 (reversing decline)
- **Privacy Shift:** ~50% of new markets are Monero (XMR)-only
- **Delivery Model:** Dead-drop expansion to Western markets (MoominMarket, Bazaar)
- **Violence Risk:** Dead-drop model requires "enforcers" (athletes/sportsmen)

---

## 2.2 Attacker Motivation & Failure Triggers

### North Korea (DPRK) — Industrialized Theft

**2025 Attribution:**
- **Total Stolen:** USD 1.92 billion (67% of all hack losses)
- **Bybit Alone:** USD 1.46 billion (single largest crypto hack ever)
- **Incidents:** ~150 hacks total

**Operational Model:**
1. **Targeting:** Centralized exchanges, infrastructure compromise
2. **Method:** Social engineering + operational compromise (not code exploits)
3. **Laundering:** "Chinese laundromat" networks for subcontracted laundering
4. **Speed:** Faster movement through intermediaries

**Key TTPs (Tactics, Techniques, Procedures):**
- Compromise developer environments
- Target keys/wallets rather than smart contracts
- Use professional laundering networks (OTC brokers)
- Chain-hopping and fragmentation to break traceability

**Motivation:** State-sponsored revenue generation (sanctions evasion, weapons programs)

### Fraud Networks — Organized Crime Model

**Scale:** USD 35 billion in victim funds (2025)

**Structural Characteristics:**
- Business-like organization
- Specialized teams (recruitment, technical, money laundering)
- Tool sharing and playbook reuse
- AI-enabled operations (+500% AI-enabled scam activity)

**Typology Convergence:**
- Romance scams → Investment fraud → Advance fee schemes
- Multi-phase victim journeys
- Deepfake technology (voice cloning, video)

**Geographic Concentration:**
- Pig butchering: Southeast Asia scam compounds
- Pyramid schemes: CBEX (Nigeria), Treasure NFT (India/Pakistan)
- Human trafficking/coercion in scam operations

### Ransomware — Fragmentation & Evolution

**2025 Statistics:**
- **New Variants:** 93 (94% increase from 2024)
- **Total Active:** 161 variants
- **Top Earner:** Akira (USD 150 million)

**Response to Disruptions:**
- LockBit, BlackBasta, ALPHV/BlackCat disruptions → affiliate displacement
- Rebranding and relaunching as survival strategy
- RaaS (Ransomware-as-a-Service) lowering barriers to entry

**Laundering Evolution (Akira Case Study):**
- Phase I (2023): Affiliate-based flows
- Phase II (mid-2024): WanChain bridge standardization
- Phase III (late 2024): Defiway bridge
- Phase IV (Aug 2025+): Unique intermediaries → consolidation → VASP

### Geopolitical Actors — State-Level Adoption

**Russia:**
- Institutionalized sanctions evasion
- A7 network as state-aligned financial infrastructure
- Stablecoin strategy (A7A5) to reduce USD dependence

**Iran:**
- ~USD 10 billion in crypto activity (2025)
- War resilience: 35% volume increase during June 2025 conflict
- Consolidation into fewer, larger transfers during crisis
- Internet shutdowns suppress retail activity (-60% volume)

**Venezuela:**
- 11th in global crypto adoption (2025)
- Stablecoins for retail payments, remittances
- Oil-linked trade settlement through intermediaries
- Hybrid formal/informal financial environment

---

## 2.3 Layer Mapping — Economic Crime Artifacts

### Updates to ECONOMIC_ATTACKS.md

#### Section: State-Sponsored Economic Attacks

```markdown
### DPRK Industrialized Theft Operations

**Characteristics:**
- State-sponsored, systematic cryptocurrency theft
- 2025 attribution: $1.92 billion (67% of global hack losses)
- Shift from code exploits to infrastructure compromise

**Attack Vectors:**
1. Operational compromise (keys, wallets, access controls)
2. Social engineering of exchange staff
3. Developer environment penetration
4. Supply chain attacks

**Laundering Infrastructure:**
- "Chinese laundromat" networks (professional OTC brokers)
- Subcontracted laundering model
- Chain-hopping across multiple blockchains
- Fragmentation to break traceability
- Settlement through APAC-based cash-out channels

**Key Incidents:**
- Bybit (Feb 2025): $1.46 billion (single largest crypto hack)
- Pattern: 76% of 2025 losses from infrastructure attacks vs. code exploits

**Detection Indicators:**
- Large exchange outflows following social engineering campaigns
- Rapid movement through intermediary wallets (<48 hours)
- Exposure to Chinese OTC broker networks
- TRON-based USDT preference (speed, low fees)

**Source:** TRM Labs 2026 Crypto Crime Report
```

#### Section: Sanctions Evasion Mechanisms

```markdown
### Professional Sanctions Evasion Networks (Russia Model)

**Network Structure: A7 Case Study**
- Centralized coordination (Kremlin-backed)
- Multi-jurisdictional shell companies
- Cross-border payment platform infrastructure
- $56+ billion in identified volume

**Mechanisms:**
1. **Stablecoin Settlement:** A7A5 (ruble-pegged), USDT
2. **Rapid Rebranding:** Garantex → Grinex (days)
3. **Jurisdiction Hopping:** Kyrgyzstan registration
4. **Intermediary Layers:** China, Southeast Asia, South Africa
5. **Shared Infrastructure:** Common hot wallets, backend systems

**Procurement Integration:**
- Electronics and logistics firms as counterparties
- Missile navigation components ($1.31M from Garantex to freight forwarder)
- Circular trade flows

**Detection:**
- On-chain clustering of shared infrastructure
- Wash trading patterns (34% of A7A5 volume artificial)
- Concentrated counterparty networks
- Offshore exchange coordination

**Mitigation:**
- Target infrastructure over brands
- Shared wallet heuristics
- Rapid designation and attribution
- Multi-jurisdictional coordination

**Source:** TRM Labs 2026 Crypto Crime Report
```

#### Section: Money Laundering Service Providers

```markdown
### Chinese Money Laundering Organizations (CMLOs)

**Scale:** $103 billion (2025), 4x growth since 2022

**Service Model:**
- OTC broker networks
- Underground banking ( escrow/guarantee marketplaces)
- Cross-border settlement USDT ↔ fiat
- Bridge between capital flight (China) and cartel cash (Americas)

**Key Hubs:**
1. **Huione Pay:** ~$73 billion (suspended Dec 2025)
2. **Haowang:** ~$7.3 billion (Telegram removed)
3. **Xinbi:** ~$5.9 billion (resilient, migrated to proprietary platform)
4. **Tudou:** ~$3.0 billion (benefited from Huione stake)

**Mechanism:**
- Cartel cash → CMLOs → China-based settlement
- Capital flight clients (high fees) subsidize cartel services (low fees)
- Trade-based money laundering (TBML)
- High-velocity, short-holding periods (<48 hours)

**Geographic Scope:**
- APAC primary
- Latin America cartel integration
- Africa ISIS affiliate connections

**Enforcement Impact:**
- Platform disruption forces migration
- Brand changes, infrastructure persists
- Behavioral signals more durable than static identifiers

**Source:** TRM Labs 2026 Crypto Crime Report
```

### Updates to INCENTIVE_MISALIGNMENT_PATTERNS.md

#### Section: Organized Crime Economics

```markdown
### Professionalized Fraud Operations

**Organizational Structure:**
- Enterprise-like operations
- Specialized teams (recruitment, technical, laundering)
- Standardized playbooks and tool sharing
- AI-as-a-service adoption (+500% growth)

**Victim Recruitment:**
- Pig butchering: Romance → Investment → Extortion
- Task/work-from-home scams: Micro-tasks → Deposit demands
- Impersonation: Deepfake celebrity endorsements
- Convergence: Multi-phase victim journeys

**Scale Economics:**
- $35 billion in victim funds (2025)
- Majority unreported (embarrassment, unawareness)
- High-volume, lower per-victim vs. concentrated investment fraud

**Geographic Concentration:**
- Operations: Southeast Asia scam compounds
- Targets: Global, developed markets primary
- Infrastructure: Chinese escrow services, APAC casinos

**Coercive Elements:**
- Human trafficking for scam labor
- Relationship with local power structures
- Violence in dead-drop distribution networks

**Source:** TRM Labs 2026 Crypto Crime Report
```

---

## 2.4 Ecosystem Threat Dynamics Analysis

### Systemic Risk Assessment

#### Concentration Risk

**Top 10 Incidents = 81% of Annual Losses**
- Bybit alone: 51% of total stolen value
- Structural vulnerability: Single points of failure in centralized exchanges
- Median incident: $1.3M vs. Average: $19.5M (widening gap)

**Implications:**
- Long-tail risk environment
- Mega-heists drive global loss figures
- Smaller incidents persistent but less visible

#### Infrastructure Centralization

**VASP Dependencies:**
- 95% of sanctions flows through stablecoins
- TRON network dominance (speed, low cost)
- Exchange concentration for cash-out

**Laundering Infrastructure:**
- Chinese escrow services as critical chokepoints
- Professionalization reduces interdiction windows
- Subcontracting creates attribution gaps

### Cross-Protocol Risk Vectors

**DeFi ↔ CeFi Interconnection:**
- Stolen DeFi funds laundered through centralized exchanges
- DEXs used for initial layering
- Bridge protocols for chain-hopping
- Custodial services as final off-ramps

**State Actor ↔ Criminal Network Overlap:**
- DPRK uses criminal laundering networks
- Russian state actors share infrastructure with cybercriminals
- ISIS affiliates use same escrow services as fraud networks

### Regulatory Response Patterns

**2025 Sanctions Developments:**
- 21 crypto-related designations (EU, UK, US)
- 16 included cryptocurrency addresses
- First EU address designations (19th Russia package)
- First transaction ban on token (A7A5)
- First delisting (Tornado.Cash)

**Shift in US Priorities:**
- 50% of 2025 designations: illicit drug market (fentanyl)
- Focus: TCOs, Western Hemisphere, cyber actors
- Iran and Venezuela emphasis for 2026

**Enforcement Effectiveness:**
- Improved attribution speed (Beacon Network)
- Faster freezing workflows (TRON-based stablecoins)
- On-chain investigation → off-chain asset seizure

### Emerging Threat Trajectories

#### AI-Enabled Crime
- +500% growth in AI-enabled fraud activity
- LLMs for multilingual outreach
- Deepfake video/voice for impersonation
- Reduced setup costs for scam operations

#### Privacy Coin Adoption
- ~50% of new DNMs are Monero-only
- Shift from Bitcoin to XMR in Western markets
- Enforcement pressure driving privacy adoption
- Traceability challenges for investigators

#### Geopolitical Integration
- Crypto as core financial infrastructure for sanctioned states
- State-aligned stablecoin development (A7A5 model)
- Cross-border settlement outside SWIFT
- Institutionalization of crypto rails

---

## Pattern Mapping to 8 Recurring Failure Patterns

### Pattern 1: Trust But Don't Verify
- **Exchange Trust:** Users trust exchange custody (Bybit compromise)
- **OTC Broker Trust:** Criminal networks trust laundering counterparties
- **Dead-Drop Trust:** Buyers trust vendor placement without verification

### Pattern 2: State Update Order Matters
- **Laundering Chains:** Sequence of moves through intermediaries
- **Exchange Withdrawal Processing:** Timing of confirmations vs. withdrawals
- **Sanctions Evasion:** Transaction timing to avoid detection windows

### Pattern 3: Single Point of Failure
- **Bybit:** Single compromise = $1.46B loss
- **Huione Pay:** Single hub = $73B throughput
- **Exchange Centralization:** Concentrated custody risk

### Pattern 4: Economic Assumptions Don't Hold
- **Selfish Mining Rationality:** Assumes honest majority, but subversion profitable
- **Scam Prevention:** Assumes victim awareness, but social engineering effective
- **Sanctions Compliance:** Assumes avoidance of designated entities, but rebranding rapid

### Pattern 5: Complexity Hides Bugs
- **Cross-Chain Laundering:** Complex routing obscures origin
- **Shell Company Networks:** Corporate complexity obscures beneficial ownership
- **RaaS Fragmentation:** Affiliate model obscures actor attribution

### Pattern 6: Integration Blindness
- **Exchange-DeFi Bridge:** Illicit flows between centralized and decentralized
- **State-Criminal Overlap:** Shared infrastructure between geopolitical and criminal actors
- **OTC-Exchange Integration:** Nested services within compliant platforms

### Pattern 7: Audit Theater
- **Exchange Security:** Audits didn't prevent Bybit compromise
- **Smart Contract Focus:** 76% of losses from infrastructure, not code
- **Compliance Gaps:** KYC/AML bypassed by professional launderers

### Pattern 8: Governance Capture
- **Mining Pool Centralization:** Administrator control of reward distribution
- **Sanctions Evasion Networks:** State capture of financial infrastructure
- **Scam Compounds:** Local power structure protection

---

## Ingestion Rule Compliance Summary

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **1. Core Assumptions** | ✅ | Assumed infrastructure security, exchange trust, economic rationality |
| **2. Where Assumptions Fail** | ✅ | Infrastructure compromise, social engineering, state-level subversion |
| **3. Layer Mapping** | ✅ | L3 (Economic), L4 (Systemic), L5 (Historical) |
| **4. Pattern Mapping** | ✅ | All 8 patterns mapped to TRM findings |
| **5. Audit Gap** | ✅ | Infrastructure attacks bypass smart contract audits; compliance gaps in OTC |

---

## Source Citation

**2026 Crypto Crime Report**  
TRM Labs, February 2026

---

*Document 2 Ingestion Complete*
