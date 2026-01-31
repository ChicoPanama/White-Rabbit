# Severity Calibration Guide

## Core Principle
**When in doubt, downgrade. Reputation > single bounty.**

Submitting an overclaimed vulnerability damages credibility with the platform and protocol.

## Immunefi Severity Criteria (v2.3)

### Critical ($50K-500K)
- Direct theft of funds without user interaction
- Permanent freezing of funds
- Protocol insolvency
- Governance manipulation

**Requirements:**
- No special conditions (or very minimal)
- Immediate, significant financial impact
- Reproducible PoC
- Affects mainnet deployed contracts

### High ($10K-50K)
- Theft of unclaimed yield/fees
- Temporary freezing of funds
- Theft requiring specific conditions

**Requirements:**
- Realistic attack conditions
- Significant but not catastrophic impact
- May require specific state or timing

### Medium ($2K-10K)
- Smart contract unable to operate (DoS)
- Griefing attacks with limited impact
- Theft of small amounts
- Block stuffing attacks

**Requirements:**
- Impact is real but limited
- May require unlikely conditions
- Often includes DoS-style attacks

### Low ($500-2K)
- Contract fails to deliver promised returns
- Informational issues
- Minor operational impacts

## Calibration Checklist

Before submitting, verify:
- [ ] Impact matches claimed severity with evidence
- [ ] Attack conditions are realistic (not just theoretical)
- [ ] PoC demonstrates the actual claimed impact
- [ ] Similar past submissions at this severity (check disclosed reports)
- [ ] Solidity version checked for arithmetic bugs

## Lessons Learned

### SSV Network (2026-01-30)
- **Initial assessment:** Critical (overflow manipulation)
- **Corrected assessment:** Medium (DoS via revert)
- **Reason:** Solidity 0.8+ overflow protection
- **Outcome:** Still submitted, still valuable, credibility intact

### Key Insight
**Technical possibility ≠ practical exploitability**

Same mathematical vulnerability:
- Pre-0.8: Critical ($100K-500K)
- 0.8+: Medium ($10K-50K)

## Bounty Value Multipliers

### Positive Multipliers
- **Audit Miss:** +50% (Quantstamp missed this)
- **Novel Method:** +25% (new attack vector)
- **Infrastructure Critical:** +50% (core protocol)
- **Long Exposure:** +25% (existed for years)

### Negative Multipliers
- **Complex Conditions:** -25% (unlikely scenario)
- **Limited Impact:** -25% (affects few users)
- **Already Mitigated:** -50% (partial fix exists)

---
*Last Updated: 2026-01-30*
