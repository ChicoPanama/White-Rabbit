# Quantum Risk Assessment & Migration Strategies (2025) — INGESTION OUTPUT

**Source:** arXiv:2501.11798  
**Date:** 2026-02-01  
**Status:** Processing Prompts 9.1–9.2

---

## 9.1 Risk Assessment Methodologies

### NIST-Aligned Risk Assessment Framework

**Four-Step Process (NIST SP 800-30):**
1. **Preparation** — Define scope, assumptions, risk model
2. **Conduct** — Identify threats, vulnerabilities, likelihood, impact
3. **Communication** — Report findings to stakeholders
4. **Maintenance** — Continuous monitoring and updates

**STRIDE-Based Threat Classification:**

| Threat | Description | Quantum Application |
|--------|-------------|---------------------|
| **S**poofing | Impersonating identity | Forge quantum-vulnerable signatures |
| **T**ampering | Modifying data | Alter transactions with broken crypto |
| **R**epudiation | Denying actions | Claim forged signatures are valid |
| **I**nformation Disclosure | Unauthorized access | Decrypt quantum-broken encryption |
| **D**enial of Service | System disruption | Quantum-accelerated DoS |
| **E**levation of Privilege | Unauthorized upgrade | Exploit quantum weaknesses |

### Likelihood Assessment Criteria

| Level | Criteria | Quantum Context |
|-------|----------|-----------------|
| **High (H)** | Remotely exploitable, no effective countermeasures | Shor's algorithm breaks ECC, widely deployed |
| **Medium (M)** | Requires physical access or specific conditions | Grover's algorithm needs large quantum computer |
| **Low (L)** | Complex attacks, effective countermeasures | Hash functions with sufficient output length |

### Quantum Threat Timeline (Expert Consensus)

| Timeframe | Likelihood | Quantum Capability |
|-----------|------------|-------------------|
| **Within 10 years** | Low | Early quantum computers, limited qubits |
| **Within 15 years** | Medium | Improved quantum computers, error correction |
| **Beyond 20 years** | High | Cryptographically relevant quantum computer (CRQC) |

**Definition of Quantum Threat:** Capability to break RSA-2048 within 24 hours using quantum computer.

---

## 9.2 Proactive Defense Patterns

### Hybrid Migration Architectures

**Composite Approach:**
- Combine classical and PQ cryptographic primitives
- Dual signatures (classical + PQ)
- Gradual transition strategy

**Non-Composite Approach:**
- Direct replacement of classical with PQ
- Hard fork required
- Clean break but higher disruption

### Platform-Specific Vulnerability Analysis

| Platform | Key Vulnerabilities | Migration Complexity |
|----------|--------------------|---------------------|
| **Bitcoin** | ECDSA, P2PK exposure, PoW | High (76-day migration) |
| **Ethereum** | ECDSA, BLS, KZG, VDF | Very High (multiple primitives) |
| **Ripple** | Ed25519, ECDSA | Medium |
| **Litecoin** | Similar to Bitcoin | High |
| **Zcash** | zk-SNARKs (ECC-based) | High (privacy preservation) |

### Component-Level Defense Strategies

#### 1. Blockchain Network Layer

| Threat | Quantum Risk | Mitigation |
|--------|--------------|------------|
| **Hash Function Vulnerability** | Grover's algorithm reduces collision resistance | Increase hash output length |
| **False Message Attacks** | Shor's breaks signatures, enables forgery | Deploy PQC signatures (ML-DSA) |
| **51% Attacks** | Grover's accelerates hash finding | Transition to PoS or hybrid consensus |
| **DoS Attacks** | Quantum parallelism amplifies scale | Rate limiting, distributed architecture |
| **Privacy Violations** | Breaks zk-SNARKs, exposes identities | Lattice-based ZKPs, ring signatures |

#### 2. Mining Pool Layer

| Threat | Quantum Risk | Mitigation |
|--------|--------------|------------|
| **Malicious Node Infiltration** | QC enables Sybil attacks at scale | BFT protocols, stake-based admission |
| **Reward Manipulation** | QC exploits deterministic algorithms | VRFs for randomness, transparent distribution |
| **PoW Disruption** | Grover's accelerates mining | Hybrid PoW/PoS, quantum-resistant PoW |

#### 3. Transaction Verification Layer

| Threat | Quantum Risk | Mitigation |
|--------|--------------|------------|
| **Double-Spending** | Grover's accelerates signature search | Faster confirmation, VDFs, sharding |
| **Transaction Malleability** | QC exploits signature malleability | PQC signatures, SegWit-like upgrades |
| **Signature Forgery** | Shor's breaks ECDSA | ML-DSA, FALCON migration |
| **Oracle Manipulation** | QC compromises oracle data | Decentralized oracles, quantum-secure providers |

#### 4. Smart Contract Layer

| Threat | Quantum Risk | Mitigation |
|--------|--------------|------------|
| **Code Vulnerability** | QC breaks cryptographic primitives | Quantum-aware code audits, formal verification |
| **State Manipulation** | Forged signatures alter contract state | PQC signature verification in contracts |

#### 5. User Wallet Layer

| Threat | Quantum Risk | Mitigation |
|--------|--------------|------------|
| **Private Key Theft** | Shor's derives key from public key | Hash-based addresses (P2PKH), key rotation |
| **Transaction Interception** | QC decrypts encrypted memos | Post-quantum encryption (Kyber) |

---

## Layer Artifact Updates

### SYSTEMIC_FAILURES.md — Migration Strategies

```markdown
### Post-Quantum Migration Strategies

**Timeline Pressure:**
- 10 years: Low quantum threat likelihood
- 15 years: Medium quantum threat likelihood  
- 20+ years: High quantum threat likelihood
- NIST deprecation: 2030
- NIST retirement: 2035

**Migration Approaches:**

#### 1. Hybrid (Composite) Approach
**Mechanism:**
- Maintain both classical and PQ signatures simultaneously
- Dual-signature transactions during transition period
- Gradual phase-out of classical

**Advantages:**
- Backward compatibility
- Gradual user migration
- Risk mitigation during transition

**Challenges:**
- Larger transaction sizes
- Increased complexity
- Longer transition period
- Security of classical component

**Example:** Bitcoin Post-Quantum (BPQ) with expanded block size

#### 2. Direct Replacement (Non-Composite)
**Mechanism:**
- Hard fork to pure PQ cryptography
- Single signature scheme (PQ only)
- Clean break from classical

**Advantages:**
- Simpler architecture
- Smaller signatures (eventually)
- Cleaner security model

**Challenges:**
- Hard fork contentiousness
- All users must migrate simultaneously
- No backward compatibility
- Higher disruption risk

**Example:** Ethereum 3.0 proposals

#### 3. Platform-Specific Strategies

**Bitcoin:**
- BPQ hard fork with XMSS signatures
- 32 MB block weight limit
- 76-day estimated migration downtime
- "pq1" address prefix

**Ethereum:**
- Account abstraction with FALCON
- EOF (Ethereum Object Format) for arbitrary validation
- Hybrid classical/PQ transition
- StarkNet FALCON demonstration

**Algorand:**
- FALCON for state proofs (deployed)
- LB-VRF for consensus randomness (research)
- 6-second finality maintained

**Monero:**
- FCMP++ protocol for privacy-preserving PQ
- 6-month hard fork schedule advantage
- Ring signature PQ research

**Risk Assessment Matrix:**

| Component | Likelihood | Impact | Risk Level |
|-----------|------------|--------|------------|
| Network (DoS, false msgs) | High | High | **Critical** |
| Mining (selfish mining) | High | High | **Critical** |
| Transactions (double-spend) | High | High | **Critical** |
| Wallets (key theft) | Medium | High | **High** |
| Smart contracts | Medium | High | **High** |

**Source:** Blockchain Security Risk Assessment in Quantum Era (Baseri et al., 2025)
```

### FOUNDATION_PRIMITIVES.md — NIST PQC Standards

```markdown
### NIST Post-Quantum Cryptography Standards (2024-2027)

**Standardized Algorithms:**

| Standard | Algorithm | Type | Security Basis | Status |
|----------|-----------|------|----------------|--------|
| **FIPS 203** | ML-KEM | Key Encapsulation | Lattice (M-LWE) | Finalized 2024 |
| **FIPS 204** | ML-DSA | Digital Signatures | Lattice (Dilithium) | Finalized 2024 |
| **FIPS 205** | SLH-DSA | Digital Signatures | Hash-based (SPHINCS+) | Finalized 2024 |
| **FIPS 207** | HQC | Key Encapsulation | Code-based | Draft 2026 |

**Performance Characteristics:**

| Algorithm | Sig Size | Key Size | Speed | Best For |
|-----------|----------|----------|-------|----------|
| **ML-DSA-44** | 2,420 B | 1,312 B | Fast | General purpose |
| **ML-DSA-65** | 3,293 B | 1,952 B | Fast | Higher security |
| **ML-DSA-87** | 4,595 B | 2,592 B | Fast | Maximum security |
| **FALCON** | ~666 B | ~897 B | Fast | Size-constrained |
| **SPHINCS+** | ~8,000 B | ~32 B | Slow | High assurance |

**Blockchain Suitability:**

- **ML-DSA:** Good balance, larger than ECDSA
- **FALCON:** Smallest signatures, good for constrained environments
- **SPHINCS+:** Stateless, conservative security, very large signatures

**Side-Channel Vulnerabilities:**
All PQC algorithms vulnerable to:
- Power analysis (SPA, DPA)
- Electromagnetic attacks
- Fault injection
- Timing attacks
- Cold-boot attacks

**Countermeasures:**
- Constant-time implementations
- Masking and secret sharing
- Fault detection and redundancy
- Shielding and noise injection

**Deprecation Timeline:**
- 2030: Deprecate RSA, ECDSA, EdDSA, DH, ECDH
- 2035: Full retirement of quantum-vulnerable algorithms

**Source:** NIST PQC Standards, Blockchain Security Risk Assessment (2025)
```

---

## Pattern Mapping to 8 Recurring Failure Patterns

### Pattern 1: Trust But Don't Verify
- **Assumption:** Current cryptography trustworthy indefinitely
- **Failure:** Quantum computers break ECC/RSA assumptions
- **Evidence:** P2PK addresses already expose public keys

### Pattern 2: State Update Order Matters
- **Migration Phases:** Classical → Hybrid → Pure PQ ordering critical
- **Consensus Timing:** Block propagation vs. quantum attack timing
- **Key Rotation:** Order of key updates matters for security

### Pattern 3: Single Point of Failure
- **NIST Standardization:** Centralized algorithm selection
- **First CRQC:** Single entity with quantum advantage
- **Migration Coordination:** Requires global synchronization

### Pattern 4: Economic Assumptions Don't Hold
- **Miner Economics:** Larger PQ blocks → higher orphan risk
- **Gas Costs:** PQC verification more expensive
- **Migration Incentives:** Users delay until forced

### Pattern 5: Complexity Hides Bugs
- **PQC Implementations:** Complex lattice mathematics
- **Side-Channel Attacks:** Implementation flaws exposed
- **Hybrid Systems:** Classical/PQ interaction complexity

### Pattern 6: Integration Blindness
- **Cross-Chain:** Different PQ readiness levels
- **Oracles:** Bridge between quantum-secure and vulnerable
- **Hardware Wallets:** Firmware update requirements

### Pattern 7: Audit Theater
- **PQC Code Audits:** Limited lattice crypto expertise
- **Side-Channel Testing:** Often omitted
- **Formal Verification:** Needed but scarce

### Pattern 8: Governance Capture
- **NIST Control:** Algorithm selection centralization
- **Core Dev Power:** Migration decisions concentrated
- **User Voice:** Limited input on cryptographic future

---

## Ingestion Rule Compliance

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **1. Core Assumptions** | ✅ | Assumed ECC permanent, migration reactive, standards sufficient |
| **2. Where Assumptions Fail** | ✅ | Quantum timeline uncertain, "harvest now decrypt later", side-channel attacks |
| **3. Layer Mapping** | ✅ | L0 (Crypto), L4 (Systemic migration), L2 (Audit gaps) |
| **4. Pattern Mapping** | ✅ | All 8 patterns apply to PQ transition |
| **5. Audit Gap** | ✅ | Side-channel testing, formal verification, implementation audits |

---

## Cross-Reference with Quantum Disruption SOK

### Complementary Coverage

| Topic | Quantum Disruption SOK | Risk Assessment Paper |
|-------|------------------------|----------------------|
| **Performance Impact** | Detailed TPS/storage analysis | Risk-based prioritization |
| **Platform Analysis** | 7 platforms (BTC, ETH, ALGO, etc.) | 5 platforms (BTC, ETH, XRP, LTC, ZEC) |
| **Migration Strategies** | BPQ, FALCON, W-OTS | Hybrid architectures, NIST roadmap |
| **Threat Timeline** | General quantum threat | Expert consensus: 10-20-30 year breakdown |
| **STRIDE Analysis** | Mentioned | Comprehensive STRIDE application |

**Consensus:** Both papers agree on:
1. 35-40× signature size increase
2. 59-92% TPS reduction
3. NIST 2030/2035 timeline
4. Urgency of proactive migration

---

## Source Citation

**Blockchain Security Risk Assessment in Quantum Era, Migration Strategies and Proactive Defense**  
Yaser Baseri et al., arXiv:2501.11798 [cs.CR], August 2025  
Also published: IEEE Communications Surveys & Tutorials (DOI: 10.1109/COMST.2025.3621113)

---

*Document 9 Ingestion Complete*
