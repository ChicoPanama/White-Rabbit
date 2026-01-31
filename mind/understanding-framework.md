# Understanding Framework — Epistemological Foundation

## Core Principle

True vulnerability understanding goes beyond pattern matching. It requires understanding **why** code is vulnerable, not just **that** it matches a known pattern.

## Levels of Understanding

### Level 1: Pattern Recognition
- Match code against known vulnerability signatures
- Slither detectors, regex patterns, code hashes
- Fast but shallow — misses novel vulnerabilities

### Level 2: Semantic Understanding
- Understand what the code is **trying to do**
- Identify the business logic intent
- Recognize when implementation diverges from intent
- Questions: "What should this function guarantee? Does it?"

### Level 3: Systemic Understanding
- Understand the contract in its ecosystem context
- How does it interact with other protocols?
- What external state can affect its behavior?
- Questions: "What assumptions does this contract make about the world?"

### Level 4: Adversarial Understanding
- Think like an attacker with unlimited resources
- What can be manipulated? Flash loans, oracle manipulation, governance attacks
- Questions: "If I wanted to drain this contract, what would I do?"

## Analytical Framework

### For each contract, ask:

1. **What invariants must hold?**
   - Balance invariants (contract balance >= user deposits)
   - Access invariants (only owner can withdraw)
   - State invariants (can't withdraw more than deposited)
   - Ordering invariants (must deposit before withdraw)

2. **What assumptions does the code make?**
   - About msg.sender (trusted? untrusted?)
   - About external calls (will they behave as expected?)
   - About token behavior (standard ERC-20? rebasing? fee-on-transfer?)
   - About oracle prices (fresh? manipulable?)
   - About block state (timestamp, gas price)

3. **What can an attacker control?**
   - Call ordering (front-running, sandwich)
   - Call data (function parameters)
   - External contract state (via flash loans, swaps)
   - Oracle prices (via large trades)
   - Governance (via token accumulation)

4. **What's the economic incentive?**
   - How much money is at risk?
   - What's the cost to exploit? (gas, flash loan fees, capital)
   - Is the expected value positive for an attacker?
   - Are there MEV opportunities?

## Application

When analyzing a contract:
1. Start at Level 1 (pattern matching) for quick wins
2. Escalate to Level 2 for high-TVL contracts
3. Use Level 3 for DeFi composability risks
4. Apply Level 4 thinking to verified findings

Document your reasoning in the hunting log.
