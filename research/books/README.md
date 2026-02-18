# Book Sources - Layer 0 Foundation

## Downloaded for Research Mode Ingestion

### 1. Mastering Bitcoin (3rd Edition)
**Authors:** Andreas M. Antonopoulos, David A. Harding
**License:** CC BY-SA 4.0
**Source:** https://github.com/bitcoinbook/bitcoinbook
**Status:** ✅ Cloned locally
**Key Content:**
- Transaction structure and lifecycle
- Mining and consensus mechanisms  
- Proof-of-Work security model
- Bitcoin Script

### 2. Mastering Ethereum
**Authors:** Andreas M. Antonopoulos, Gavin Wood
**License:** CC BY-NC-ND 4.0 (free to read)
**Source:** https://github.com/ethereumbook/ethereumbook
**Status:** ✅ Cloned locally
**Key Content:**
- EVM architecture
- Smart contract execution
- Gas and metering
- State vs computation

### 3. Bitcoin and Cryptocurrency Technologies
**Authors:** Narayanan, Bonneau, Felten, Miller, Goldfeder
**License:** Free pre-publication draft (author-authorized)
**Source:** https://bitcoinbook.cs.princeton.edu/
**Status:** ✅ PDF downloaded (19MB)
**Key Content:**
- Distributed systems fundamentals
- Cryptographic primitives
- Formal security models
- Academic rigor

---

## Layer 1 - Smart Contract Failure Modes

### 4. Smart Contract Security Field Guide
**Author:** Dominik Muhs  
**License:** Free, independent  
**Source:** https://scsfg.io/  
**Status:** ✅ Web resource available  
**Key Content:**
- Reentrancy classes and defenses
- Access control patterns
- Oracle security
- Economic attack vectors

### 5. ConsenSys Smart Contract Best Practices
**Authors:** ConsenSys Diligence  
**License:** Open source  
**Source:** https://github.com/ConsenSys/smart-contract-best-practices  
**Status:** ✅ Cloned locally  
**Key Content:**
- Known attacks catalog
- Development recommendations
- Security tools
- Best practices

### 6. Solidity Patterns
**Author:** Franz Volland  
**License:** Open source  
**Source:** https://github.com/fravoll/solidity-patterns  
**Status:** ✅ Cloned locally  
**Key Content:**
- Security patterns (CEI, Access Restriction)
- Upgradeability patterns
- Behavioral patterns
- Gas vs security tradeoffs

### Additional Resources
- **Smart Contract Vulnerabilities** (kadenzipfel) - ✅ Cloned
- **Ethernaut** (OpenZeppelin) - ✅ Cloned
- **DeFiHackLabs** (SunWeb3Sec) - Reference for patterns

---

## Layer 2 - Formal Thinking (Why Bugs Exist)

### 7. Software Abstractions — Daniel Jackson (MIT)
**Focus:** Conceptual modeling and specification gaps  
**Key Content:**
- Abstract conceptual models
- Why specifications fail to capture intent
- State machine verification

### 8. Types and Programming Languages — Benjamin Pierce
**Source:** https://www.cis.upenn.edu/~bcpierce/tapl/  
**Key Content:**
- Type theory and formal semantics
- Type systems as specifications
- Formal proof techniques

### 9. Formal Verification Tools Collection

#### Halmos — a16z
**Source:** https://github.com/a16z/halmos  
**Status:** ✅ Cloned locally  
**Content:** Symbolic testing for EVM contracts

#### Z3 Theorem Prover — Microsoft Research
**Source:** https://github.com/Z3Prover/z3  
**Status:** ✅ Cloned locally  
**Content:** SMT solver, constraint satisfaction

#### Slither — Trail of Bits
**Source:** https://github.com/crytic/slither  
**Status:** ✅ Cloned locally  
**Content:** 100+ static analysis detectors

#### Mythril — ConsenSys
**Source:** https://github.com/ConsenSys/mythril  
**Content:** Symbolic execution engine

#### Dafny — Microsoft Research
**Source:** https://github.com/dafny-lang/dafny  
**Content:** Verification-aware programming

---

## Ingestion Status

### Layer 0: ✅ COMPLETE
Sources ingested into:
- FOUNDATION_PRIMITIVES.md
- TRUST_ASSUMPTIONS.md

### Layer 1: ✅ COMPLETE
Sources ingested into:
- ATTACK_VECTOR_DATABASE.md
- INVARIANT_FAILURES.md
- FALSE_POSITIVE_SIGNATURES.md

### Layer 2: ✅ COMPLETE
Sources ingested into:
- SPECIFICATION_GAPS.md
- WHY_AUDITS_MISS_THINGS.md

See research/library/LAYER_0_READING.md, LAYER_1_READING.md, and LAYER_2_READING.md for extraction methodology.

