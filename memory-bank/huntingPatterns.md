# Hunting Patterns — Active Detection Signatures

## High-Priority Patterns

### 1. Integer Overflow (VERIFIED PATTERN - SSV Success)
**Severity:** Critical (if pre-0.8) / Medium-DoS (if 0.8+)
**Detection:** Slither arithmetic checks + manual review

**CRITICAL RULE:**
- Solidity 0.8+ has built-in overflow protection - reverts instead of wrapping
- Pre-0.8 without SafeMath: Overflow wraps around (fund extraction possible)
- 0.8+ overflow: Transaction REVERT (DoS only, no fund extraction)

**Proven Pattern (SSV Network 2026-01-30):**
- `blockDiffFee * validatorCount` in uint64 exceeded max
- Solidity 0.8.24 = revert on overflow = permanent operator blocking
- Classified as Medium (DoS/Griefing), NOT Critical

**Detection Signatures:**
```solidity
// Look for multi-multiplication in small integer types
uint64 result = fee * count * blocks;  // Can overflow

// Check if in unchecked block
unchecked { balance += value; }  // Intentionally allows overflow
```

### 2. Reentrancy
**Severity:** Critical
**Detection:** Slither reentrancy detectors
**Patterns:**
- External calls before state updates
- Missing reentrancy guards
- Cross-function reentrancy

### 3. Access Control
**Severity:** High-Critical
**Detection:** Missing onlyOwner, public sensitive functions
**Patterns:**
- Unprotected initialize()
- Missing access modifiers on admin functions
- Default visibility on critical functions

### 4. Oracle Manipulation
**Severity:** Critical
**Detection:** Price feed usage without TWAP, single-block reads
**Patterns:**
- Spot price reliance
- Missing staleness checks
- Single oracle dependency (no fallback)

### 5. Flash Loan Vectors
**Severity:** Critical
**Detection:** Large balance assumptions, price impact calculations
**Patterns:**
- Governance attacks (large token acquisition)
- Liquidity manipulation
- Collateral factor manipulation

### 6. Donation Attacks (Compound Forks)
**Severity:** Critical
**Detection:** Exchange rate manipulation via large token donations
**Patterns:**
- First depositor advantage
- Rounding errors in share calculation
- hToken/cToken donation attacks

## Detection Pipeline
1. Slither static analysis (all detectors)
2. Custom pattern matching from knowledge/attack-patterns/
3. AI analysis with hypothesis generation
4. Manual verification on mainnet fork

## False Positive Filters
See: `knowledge/false-positive-graveyard/` for documented FPs

Common FPs to skip:
- `0xff` bytes = compiler padding, NOT SELFDESTRUCT
- `0xf4` in proxies = legitimate DELEGATECALL for upgrades
- High pattern counts (2,559+) usually = false positives
- Precision limits often = intentional design choices

---
*Last Updated: 2026-01-30T22:40:00Z*
