# Quantum Disruption SOK (2025) — INGESTION OUTPUT

**Source:** arXiv:2512.13333  
**Date:** 2026-02-01  
**Status:** Processing Prompts 7.1–7.2

---

## 7.1 Post-Quantum Cryptographic Threats

### Quantum Vulnerabilities by Blockchain

| Blockchain | Primary Vulnerability | Quantum Threat | Current Safeguards |
|------------|----------------------|----------------|-------------------|
| **Bitcoin** | ECDSA, Schnorr signatures | Shor's algorithm breaks discrete log | None (P2PKH offers partial protection) |
| **Ethereum** | ECDSA, BLS, KZG, VDF | Multiple ECC-dependent primitives | None (W-OTS, FALCON research ongoing) |
| **Algorand** | VRF (ECVRF) | Breaks randomness/unpredictability | FALCON for state proofs |
| **Solana** | EdDSA, SHA-256, VDF | Signature forgery, hash acceleration | Optional W-OTS vaults |
| **Avalanche** | secp256k1 (ECDSA) | Key derivation, signature forgery | None (lattice research ongoing) |
| **Monero** | Ed25519, ring signatures | Breaks anonymity, linkability | None (FCMP++ research) |
| **XRPL** | Ed25519, ECDSA | Signature forgery | None (lattice research) |

### Critical Vulnerability: P2PK Addresses (Bitcoin)

**Exposure:** Public keys visible on-chain
**Attack:** Quantum computer derives private key via Shor's algorithm
**Timeline:** ~66 seconds to recover key with 1 kHz quantum clock
**Mitigation:** Migrate to P2PKH (hash of public key)

**Migration Challenge:**
- Estimated downtime: 76 days (full network)
- Or 152 days (50% bandwidth utilization)
- Must migrate ALL unspent coins

### Transaction Exposure Window

**Vulnerability Period:** Transaction broadcast → Block confirmation

| Blockchain | Block Time | Quantum Attack Window | Risk Level |
|------------|------------|----------------------|------------|
| **Bitcoin** | 10 min | ~10 minutes | Medium |
| **Ethereum** | 12 sec | ~12 seconds | Lower |
| **Avalanche** | 2 sec | ~2 seconds | Low (but still vulnerable) |

**Key Insight:** Even "secure" P2PKH addresses expose public keys during spending

### Consensus Mechanism Vulnerabilities

**Proof of Work (Bitcoin, Monero):**
- Grover's algorithm → quadratic speedup in hash computation
- Quantum miners: 2x faster hash finding
- Risk: Mining centralization, 51% attacks by quantum-capable entities

**Proof of Stake (Ethereum, Algorand):**
- VDF (Verifiable Delay Function) manipulation
- Quantum computers execute VDFs faster
- Risk: Validator selection manipulation, consensus disruption

**Pure Proof of Stake (Algorand):**
- VRF (Verifiable Random Function) compromise
- Breaks unpredictability of validator selection
- Risk: Malicious actor predicts/manipulates consensus

---

## 7.2 Migration Strategy Patterns

### NIST Standardization Timeline

| Standard | Algorithm | Type | Status |
|----------|-----------|------|--------|
| **FIPS 203** | ML-KEM | Lattice-based KEM | Finalized 2024 |
| **FIPS 204** | ML-DSA | Lattice-based signatures | Finalized 2024 |
| **FIPS 205** | SLH-DSA | Hash-based signatures | Finalized 2024 |
| **HQC** | HQC | Non-lattice KEM | Draft 2026, Final 2027 |

**Deprecation Schedule (NIST IR 8547):**
- 2030: Deprecate RSA, ECDSA, EdDSA, DH, ECDH
- 2035: Full retirement of quantum-vulnerable algorithms

### Blockchain-Specific Migration Strategies

#### Bitcoin: Bitcoin Post-Quantum (BPQ)

**Approach:** Hard fork with XMSS signatures

**Technical Details:**
- Signature scheme: XMSS (Extended Merkle Signature Scheme)
- Based on: Winternitz One-Time Signatures (W-OTS)
- Message chunks: 67 × 256-bit chunks
- Signature size: 4× to 32× larger than ECDSA
- Block weight limit: Expanded from 4 MB to 32 MB
- Address prefix: "pq1" (post-quantum compliant)
- PoW modification: Birthday problem-based (limits Grover advantage)

**Challenges:**
- Hard fork required (contentious)
- Large signature overhead
- State management for one-time signatures

#### Ethereum: Multi-Pronged Approach

**Research Areas:**
1. **Account Abstraction with FALCON:**
   - FALCON verifier contract for signature validation
   - Higher gas consumption
   - EIP-7592 for FALCON integration

2. **Hard Fork (New Transaction Type):**
   - Replace BLS with FALCON
   - Risk: Architecture bound to single scheme
   - Limits future upgrade flexibility

3. **Ethereum Object Format (EOF):**
   - Arbitrary EVM code for transaction validation
   - Supports multiple PQ schemes
   - Risk: DoS attacks via expensive verification

4. **Signature Aggregation:**
   - Native aggregation or quantum-safe SNARKs/STARKs
   - Reduce effective signature size
   - Balances security with scalability

**BTQ + StarkWare Collaboration:**
- First FALCON signature verification on StarkNet (L2)
- Demonstrates quantum-safe infrastructure feasibility

#### Algorand: LB-VRF Development

**Post-Quantum VRF Research:**

| VRF Model | Status | Issue |
|-----------|--------|-------|
| **X-VRF** | Broken (2024) | Vulnerabilities under adversarial conditions |
| **LB-VRF** | Promising | Lattice-based, 84-byte result, 5KB proof |

**LB-VRF Performance:**
- Evaluation: 3 milliseconds
- Verification: 1 millisecond
- Scaling limit: ~1000 nodes (current)
- Data overhead: ~8 MB per instance
- Constraint: Short-lived key pairs (limited outputs before rotation)

**Already Deployed:**
- FALCON for state proofs (cross-chain verification)

#### Solana: Winternitz Vault (Optional)

**Current Status:**
- Optional quantum-resistant vault mechanism
- Non-default (majority of funds remain vulnerable)
- Strategy unclear, shifted focus to scalability

**Technical Details:**
- W-OTS (Winternitz One-Time Signature) scheme
- Keccak-256 hashing
- PDA (Program-Derived Address) derivation
- Split account structure (outgoing/refund)
- One-time keypair per transaction

**Limitations:**
- ML-DSA-44 signatures exceed Solana's 1,232-byte transaction limit
- FALCON might fit but CU (compute unit) cost uncertain
- Throughput impact: Definite reduction, magnitude unknown

#### Monero: FCMP++ Protocol

**Privacy-Preserving PQ Research:**

| Protocol | Status | Characteristics |
|----------|--------|-----------------|
| **Seraphis** | Limited PQ | Modular framework, migration challenges |
| **FCMP++** | Promising | Full-chain membership proofs, quantum resilience |
| **MatRiCT** | Fast (~23ms) | Confidential transactions, smaller proofs |
| **GLYPH** | Hash-based | Ring PQ signatures, Monero-compatible |

**FCMP++ Advantages:**
- Full-set privacy within RingCT model
- Transaction chaining support
- Outgoing view keys
- Forward secrecy
- Scalability improvements

**Monero Advantage:** 6-month hard fork schedule enables rapid PQ adoption

#### XRPL: Ripple Blockchain Collaboratory

**Partnership:**
- ADAPT Research Centre + Trinity College Dublin
- Ripple UBRI funding

**Research Areas:**
- Post-quantum cryptography
- Zero-knowledge proofs
- Secure validator infrastructure

**Status:** Early research phase, no deployed safeguards

---

## Performance Impact Analysis

### Transaction Throughput (TPS) Impact

| Blockchain | Classical TPS | PQ TPS (ML-DSA-44) | Reduction |
|------------|---------------|-------------------|-----------|
| **Bitcoin** | ~15.2 | ~2.4 | **84%** |
| **Algorand** | ~8,771 | ~686 | **92%** |
| **Monero** | Baseline | ~41% of baseline | **59%** |
| **XRPL** | Baseline | ~15% of baseline | **85%** |
| **Ethereum** | ~119 | Gas recalibration needed | Significant |
| **Avalanche** | Same as ETH | Gas recalibration needed | Significant |

**Solana:** ML-DSA-44 exceeds 1,232-byte transaction limit (incompatible)

### Storage Impact

| Component | Classical | PQ (ML-DSA-44) | Increase |
|-----------|-----------|----------------|----------|
| **Signature Size** | 64-73 bytes | ~2,420 bytes | **35-40×** |
| **Public Key Size** | 32-33 bytes | ~1,312 bytes | **40×** |

**Storage Multiplier:** 35-40× for signature-heavy data

### Consensus Convergence Impact

**Block Size → Propagation Delay → Fork Risk:**

| Block Size Increase | Propagation Delay | Fork Probability (Bitcoin) |
|--------------------|--------------------|---------------------------|
| 1× (baseline) | 11.6 sec | 1.9% |
| 10× | 116 sec | **17.6%** |

**Implications:**
- Larger PQ signatures require bigger blocks
- Bigger blocks propagate slower
- Slower propagation → higher fork rates
- More confirmations needed for finality

**Solana Specific:**
- Turbine broadcast layer already experiences skipped slots from propagation delays
- Larger PQ blocks → more missed slots → reduced consensus efficiency

### Economic Incentive Impact

**Miner/Validator Profit Model:**

Profit = (1 - OrphanProbability) × Fees

**Trade-offs:**
- Larger blocks = more fees
- But larger blocks = higher orphan probability
- Optimal block size exists where marginal fee gain = marginal orphan risk

**PQ Impact:**
- Slower propagation increases orphan probability
- Reduces expected payoff for same block reward
- Miners may adopt more conservative (smaller) block sizes
- Or withdraw if profitability declines
- Centralization pressure toward low-latency nodes

---

## Layer Artifact Updates

### FOUNDATION_PRIMITIVES.md — Post-Quantum Threats

```markdown
### Post-Quantum Cryptography Threats (Emerging)

**Timeline:** NIST deprecation by 2030, full retirement by 2035

**Vulnerable Primitives:**
| Primitive | Used In | Quantum Attack | Status |
|-----------|---------|----------------|--------|
| ECDSA | Bitcoin, Ethereum | Shor's algorithm | Vulnerable |
| EdDSA | Solana, XRPL, Monero | Shor's algorithm | Vulnerable |
| BLS Signatures | Ethereum PoS | Shor's algorithm | Vulnerable |
| VDF | Ethereum, Solana | Faster execution | Vulnerable |
| VRF | Algorand | Forgery/prediction | Vulnerable |
| SHA-256 | Bitcoin PoW | Grover's speedup | Partial |

**Attack Capabilities:**
1. **Shor's Algorithm:** Breaks ECC (discrete logarithm problems)
   - Derives private keys from public keys
   - Forges signatures
   - Compromises confidentiality

2. **Grover's Algorithm:** Quadratic speedup for hash/search
   - 2× faster hash computation
   - Mining centralization risk
   - Brute force acceleration

**Timeline Estimates:**
- Quantum computers with 1 kHz clock: ~66 seconds to break ECDSA
- Practical quantum advantage: Estimated 10-20 years
- Cryptographically relevant quantum computer (CRQC): Unknown

**Mitigation Approaches:**
1. **Lattice-based:** ML-DSA, FALCON (NIST standardized)
2. **Hash-based:** SPHINCS+, XMSS (proven security)
3. **Hybrid approaches:** Classical + PQ combined

**Blockchain Migration Challenges:**
- Bitcoin: 76-day network downtime for full migration
- Ethereum: Complex due to multiple primitives (ECDSA, BLS, KZG, VDF)
- Solana: ML-DSA-44 exceeds transaction size limits
- All: 35-40× signature size increase → storage, throughput impacts

**Source:** Quantum Disruption SOK (2025)
```

### SYSTEMIC_FAILURES.md — Quantum Systemic Risks

```markdown
### Post-Quantum Migration Systemic Risks

**Performance Degradation:**
| Metric | Impact | Mitigation |
|--------|--------|------------|
| TPS | 59-92% reduction | Signature aggregation, L2 scaling |
| Storage | 35-40× increase | Pruning, compression, archival nodes |
| Propagation | Slower block propagation | Network optimization, larger blocks |
| Fork Rate | 10× increase (with 10× block size) | Consensus parameter tuning |

**Economic Risks:**
1. **Miner/Validator Centralization:**
   - Low-latency nodes have advantage
   - High-cost PQ validation favors large operators
   - Reduced decentralization

2. **Profitability Decline:**
   - Higher orphan rates reduce expected rewards
   - May drive validators out of network
   - Reduced security budget

3. **Migration Coordination:**
   - Hard forks required
   - Governance challenges
   - User adoption friction

**Consensus Risks:**
- Larger blocks → slower convergence
- Missed slots/rounds in PoS/PoH
- Increased finality time
- Degraded user experience

**Timeline Pressure:**
- NIST: Deprecate by 2030, retire by 2035
- Unknown CRQC arrival date
- "Harvest now, decrypt later" attacks already occurring

**Source:** Quantum Disruption SOK (2025)
```

### SPECIFICATION_GAPS.md — Quantum Migration Gaps

```markdown
### Post-Quantum Migration Specification Gaps

**Unstated Assumptions:**
1. Cryptographic primitives remain secure indefinitely
2. Migration can happen reactively (after quantum threat)
3. Signature size/performance trade-offs acceptable
4. All users can migrate funds proactively

**Reality:**
1. ECC vulnerable to Shor's algorithm (known since 1994)
2. "Harvest now, decrypt later" requires proactive migration
3. 35-40× size increase breaks many protocol assumptions
4. Lost keys = unmigrateable funds = permanent loss

**Specification Gaps:**
1. **No Standard Migration Mechanism:**
   - How to prove ownership without revealing vulnerable keys?
   - How to handle lost keys?
   - How to coordinate mass migration?

2. **Hybrid Period Undefined:**
   - Classical and PQ credentials must coexist
   - Attack surface during transition unclear
   - ZKP integration complex

3. **Confidentiality Mechanisms:**
   - Ring signatures (Monero) need PQ redesign
   - ZK proofs need lattice-based alternatives
   - Homomorphic encryption needs PQ variants

4. **Communication Protocols:**
   - PQ-TLS impact on consensus messaging
   - Validator coordination overhead
   - P2P layer security

**Research Directions:**
- ZK-based ownership proofs without key disclosure
- Automatic migration for active accounts
- Graceful degradation for unmigrated funds
- Consensus-aware PQ primitive selection

**Source:** Quantum Disruption SOK (2025)
```

---

## Pattern Mapping to 8 Recurring Failure Patterns

### Pattern 1: Trust But Don't Verify
- **Assumption:** Current cryptography trustworthy indefinitely
- **Failure:** Quantum computers break ECC assumptions
- **Evidence:** P2PK addresses already expose public keys

### Pattern 2: State Update Order Matters
- **Migration Ordering:** Classical → Hybrid → Pure PQ phases
- **Race Conditions:** "Harvest now, decrypt later" vs. migration speed
- **Coordination:** Global migration requires synchronized updates

### Pattern 3: Single Point of Failure
- **NIST Standardization:** Centralized algorithm selection
- **Quantum Advantage:** First CRQC owner has massive asymmetric power
- **Migration Deadline:** Hard cutoff creates coordination risk

### Pattern 4: Economic Assumptions Don't Hold
- **Miner Economics:** Orphan risk vs. fee revenue with larger blocks
- **Validator Profitability:** Higher costs, lower throughput
- **Migration Incentives:** Users may delay until forced

### Pattern 5: Complexity Hides Bugs
- **PQ Signature Schemes:** Complex lattice mathematics
- **Implementation Bugs:** New code = new vulnerabilities
- **Hybrid Systems:** Classical + PQ interaction complexity

### Pattern 6: Integration Blindness
- **Cross-Chain Impact:** PQ migration affects bridges
- **L1/L2 Interaction:** Different PQ readiness levels
- **Hardware Wallets:** Firmware update requirements

### Pattern 7: Audit Theater
- **PQ Code Audits:** Limited expertise in lattice cryptography
- **Formal Verification:** Needed but scarce for PQ primitives
- **Testing:** Quantum-safe testing environments don't exist

### Pattern 8: Governance Capture
- **NIST Control:** Algorithm selection centralization
- **Core Dev Power:** Migration decisions concentrated
- **User Voice:** Limited input on cryptographic direction

---

## Ingestion Rule Compliance

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **1. Core Assumptions** | ✅ | Assumed ECC security permanent, migration straightforward |
| **2. Where Assumptions Fail** | ✅ | Shor's algorithm, 35-40× overhead, coordination challenges |
| **3. Layer Mapping** | ✅ | L0 (Crypto foundations), L4 (Systemic), L2 (Spec gaps) |
| **4. Pattern Mapping** | ✅ | All 8 patterns apply to PQ migration |
| **5. Audit Gap** | ✅ | Limited PQ expertise, formal verification gaps |

---

## Source Citation

**Quantum Disruption: An SoK of How Post-Quantum Attackers Reshape Blockchain Security and Performance**  
Tushin Mallick et al., arXiv:2512.13333 [cs.CR], December 2025

---

*Document 7 Ingestion Complete*
