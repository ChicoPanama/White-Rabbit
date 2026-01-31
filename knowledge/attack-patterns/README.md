# Attack Patterns Knowledge Base

This directory contains verified vulnerability patterns extracted from:
- Successful bounty submissions
- Analyzed DeFi hacks
- Professional audit reports (Quantstamp, ConsenSys, Trail of Bits)
- WhiteRabbit research

## How to Use
1. **Before hunting:** Review relevant patterns for target protocol type
2. **After finding:** Extract new pattern and add here
3. **Weekly:** Review and refine patterns based on success rates

## Pattern Index
- `integer-overflow.md` - Arithmetic vulnerabilities (VERIFIED - SSV success)
- `reentrancy.md` - Reentrancy attacks
- `access-control.md` - Permission vulnerabilities
- `oracle-manipulation.md` - Price feed attacks
- `flash-loan.md` - Flash loan vectors
- `donation-attack.md` - Compound fork donation attacks

## High-Value Research Areas (Often Missed by Audits)
| Area | Audit Coverage | Research Opportunity |
|------|----------------|---------------------|
| Mathematical DoS | Low | **HIGH** |
| Parameter Combinations | Low | **HIGH** |
| Time-Based Attacks | Low | **HIGH** |
| Function Edge Cases | Low | **HIGH** |

---
*Updated: 2026-01-30*
