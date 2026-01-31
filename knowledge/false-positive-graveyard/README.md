# False Positive Graveyard

**Purpose:** Document false positives to prevent wasting time on the same mistakes.

Every false positive should answer:
1. Why did it look like a real vulnerability?
2. Why wasn't it actually exploitable?
3. How do we avoid this false positive in the future?

## Index
- `solidity-0.8-overflow.md` - Overflow that reverts instead of wrapping
- `precision-loss-design.md` - Intentional design choices
- `compiler-artifacts.md` - Bytecode patterns that look suspicious
- `proxy-delegatecall.md` - Legitimate upgrade mechanisms

## False Positive Statistics
```
Total FPs Caught: 3+
Time Saved: ~10+ hours
Reputation Protected: Priceless
```

## Golden Rule
**Better to catch FPs before submission than damage credibility after.**

---
*Updated: 2026-01-30*
