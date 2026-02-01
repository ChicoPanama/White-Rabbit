# Layer 0: Foundation Primitives

**Layer Question:** "How is the system supposed to work?"

---

## 1. Consensus Basics

### What is Consensus?
A mechanism for distributed nodes to agree on a single state of the blockchain without a central authority.

### Key Primitives:
- **Block Production:** How new blocks are created and validated
- **Fork Choice Rule:** How nodes decide which chain is "canonical" when forks occur
- **Finality:** When can we consider a transaction irreversible?
- **Byzantine Fault Tolerance:** System continues working even if some nodes are malicious

### Trust Assumptions:
- Honest majority of validators/stakers (typically 2/3+ for BFT)
- Network synchrony (messages arrive within bounded time)
- Cryptographic primitives hold (hashing, signatures)

---

## 2. State vs Computation

### State
The complete "world state" of the blockchain at any block height:
- Account balances
- Contract storage
- Nonce values
- Code at addresses

### Computation
The execution of transactions that transform state:
- EVM bytecode execution
- Gas metering
- State transitions

### Key Invariant:
State(N+1) = State(N) + Apply(Transaction, State(N))

### Trust Assumptions:
- Execution is deterministic (same input → same output on all nodes)
- Gas limits prevent infinite loops
- Opcode pricing reflects computational cost

---

## 3. Transaction Lifecycle

### Stages:
1. **Mempool:** Pending transactions waiting to be included
2. **Block Inclusion:** Miner/validator selects transactions
3. **Execution:** EVM runs transaction code
4. **State Update:** New state is calculated
5. **Consensus:** Network agrees on the new state
6. **Finality:** Block becomes irreversible

### Key Properties:
- **Atomicity:** Transaction either fully succeeds or fully fails
- **Ordering:** Transactions in a block have strict sequential order
- **Censorship Resistance:** Anyone can submit transactions (though inclusion not guaranteed)

---

## 4. Trust Assumptions by Layer

### Layer 1 (Base Chain):
- Consensus mechanism is secure
- Economic security is sufficient (cost to attack > value to steal)
- Validators act rationally (won't slash themselves)

### Layer 2 (Rollups, etc.):
- L1 is secure
- L2 state transition function is correct
- Data availability on L1
- Honest prover/sequencer assumption (varies by type)

### Smart Contract Level:
- Compiler is correct
- Bytecode matches source code (if verified)
- VM implements EVM spec correctly

### Application Level:
- Oracle data is accurate
- External dependencies are available
- Economic incentives align with desired behavior

---

## 5. Cryptographic Primitives (Conceptual)

### Hash Functions:
- **Purpose:** Create unique, fixed-size fingerprints of data
- **Properties:** Deterministic, collision-resistant, pre-image resistant
- **Use:** Block hashes, Merkle trees, address derivation

### Digital Signatures:
- **Purpose:** Prove ownership and authorize state changes
- **ECDSA:** Ethereum's signature scheme
- **Properties:** Non-repudiation, unforgeable with private key

### Merkle Trees:
- **Purpose:** Efficient verification that data is included in a set
- **Use:** State roots, transaction inclusion proofs

---

## 6. Account Model (Ethereum)

### Externally Owned Accounts (EOAs):
- Controlled by private key
- Can initiate transactions
- Has nonce (transaction counter)
- Has balance

### Contract Accounts:
- Controlled by code
- Cannot initiate transactions (only respond)
- Has storage, code, balance
- Address derived from deployer + nonce

### Key Invariant:
Only EOAs with valid signatures can initiate state-changing transactions.

---

## 7. Gas and Resource Metering

### Purpose:
Prevent spam and infinite loops by charging for computation.

### Key Concepts:
- **Gas:** Unit of computational work
- **Gas Price:** Cost per unit of gas (in wei)
- **Gas Limit:** Maximum gas a transaction can use
- **Block Gas Limit:** Maximum gas all transactions in a block can use

### Trust Assumptions:
- Gas costs reflect actual computational work
- Block gas limit prevents DoS
- Priority fee mechanism works for transaction ordering

---

*This is Layer 0: No vulnerabilities, no attacks — only how things work.*
