# Integer Overflow/Underflow Patterns

## VERIFIED PATTERN (SSV Network 2026-01-30)

### Critical Learning
**Solidity 0.8+ has built-in overflow protection.**
- **Pre-0.8:** Overflows wrap around silently → CRITICAL severity (fund extraction)
- **0.8+:** Overflows cause transaction REVERT → Medium severity (DoS only)

**ALWAYS check pragma solidity version before classifying severity.**

## Version Impact Matrix

| Solidity Version | Overflow Behavior | Attack Vector | Severity | Bounty Range |
|------------------|-------------------|---------------|----------|--------------|
| Pre-0.8 (no SafeMath) | Silent wraparound | Fund extraction | Critical | $100K-500K |
| Pre-0.8 (with SafeMath) | Revert | DoS | Medium | $10K-50K |
| 0.8+ (default) | Revert | DoS | Medium | $10K-50K |
| 0.8+ (unchecked{}) | Silent wraparound | Fund extraction | Critical | $100K-500K |

## Detection Signatures

### Slither Detectors
- `incorrect-equality`
- `divide-before-multiply`
- `unchecked-transfer`

### Code Patterns (High-Value Targets)
```solidity
// Multi-multiplication in small integer types
uint64 result = fee * count * blocks;  // Can overflow

// Accumulator patterns
balance += extremelyLargeValue;

// Check for unchecked blocks (pre-0.8 behavior in 0.8+)
unchecked {
    balance += value;  // Will wraparound
}
```

### Real Example: SSV Network
```solidity
// OperatorLib.updateSnapshot() - Solidity 0.8.24
uint64 blockDiffFee = (uint64(block.number) - snapshot.block) * fee;
snapshot.balance += blockDiffFee * validatorCount;  // OVERFLOW!
```
- **Trigger:** 50% fee + 65,536 validators + 500M block diff = 1.64e21 > uint64 max
- **Impact:** Permanent operator function blocking (DoS)
- **Severity:** Medium (0.8.24 = revert, not wraparound)

## Exploitation Requirements
- **Pre-0.8:** Just need to trigger arithmetic with controlled inputs
- **0.8+:** Need to find state where revert causes harm (DoS, stuck funds)

## False Positive Prevention
- [ ] Checked Solidity version first
- [ ] Checked if in `unchecked{}` block
- [ ] Verified actual behavior (revert vs wraparound)
- [ ] Confirmed impact matches severity claim

## Success Rate
- Pre-0.8 protocols: High value, rare to find now
- 0.8+ protocols: Medium value, look for DoS impact
- Audited protocols: Still findable (Quantstamp missed SSV overflow)

---
*Last Updated: 2026-01-30 | Status: VERIFIED*
