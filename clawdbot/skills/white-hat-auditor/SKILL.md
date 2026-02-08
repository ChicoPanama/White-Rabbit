---
name: white-hat-auditor
description: White hat security research methodology and professional audit report presentation
requires:
  bins: []
  env: []
emoji: 🎩
---

## Instructions

Comprehensive guide for ethical smart contract security research and professional audit report presentation. Based on White-Rabbit's 6-stage verification pipeline methodology.

### Core Principles

1. **Never test on mainnet** — Always use forked state for PoC verification
2. **Responsible disclosure** — Follow 14-45 day timelines before public disclosure
3. **Bug bounty first** — Check Immunefi/HackerOne before direct contact
4. **Document everything** — Timestamps and evidence for legal protection
5. **CFAA compliance** — Good-faith security research guidelines

### Verification Pipeline

| Stage | Purpose |
|-------|---------|
| 1. Context | Audit history, security patterns, known protocols |
| 2. Static Analysis | Slither (90+ detectors) + AI business logic review |
| 3. FP Filtering | Known patterns + AI removal + deduplication |
| 4. Verification | PoC exploit on forked mainnet (never mainnet) |
| 5. Risk Scoring | Confidence 0-100, tool consensus, PoC results |
| 6. Report Prep | Professional documentation, remediation guidance |

### Vulnerability Priorities (by historical loss)

| Category | Loss | Cases | Focus |
|----------|------|-------|-------|
| Logic Errors | $12.5B | 298 | Input validation, state transitions |
| Access Control | $4.4B | 36 | Admin keys, governance, multisig |
| Reentrancy | $419M | 39 | Flash loan combos, cross-function |
| Signature Replay | $407M | 2 | Bridge protocols |
| Upgrade Vulns | $328M | 2 | Proxy hijacking |

### Report Structure

```markdown
# Security Audit Report: [Protocol]

## Executive Summary
- Auditor, date, scope, severity summary

## Findings
### [SEVERITY-01] Title
- Severity, status, location
- Description, impact, PoC
- Recommended remediation

## Appendix
- Test environment, verification results, disclaimer
```

### Severity Classification

| Level | Criteria |
|-------|----------|
| **Critical** | Direct theft possible, protocol-wide, no user action needed |
| **High** | Funds at risk under conditions, major disruption |
| **Medium** | Limited exposure, unlikely conditions |
| **Low** | No direct fund risk, best practice violations |
| **Info** | Gas optimizations, code quality |

### Disclosure Timeline

| Day | Action |
|-----|--------|
| 0 | Submit report |
| 1-3 | Await acknowledgment |
| 7 | Follow up if no response |
| 14 | Minimum disclosure window |
| 45 | Maximum for critical DeFi |
| 45+ | Public disclosure if unresolved |

### Contact Priority

1. **Bug Bounty Platform** — Immunefi, HackerOne, Code4rena
2. **Security Email** — security@protocol.com, security.txt
3. **Official Channels** — Discord (private), official website

### Tools

| Category | Tools |
|----------|-------|
| Static Analysis | Slither, Mythril, Echidna |
| Testing | Foundry, Hardhat |
| Simulation | Tenderly |
| Research | DeFiLlama, Rekt News |

### References

- Full methodology: `clawdbot/skills/white-hat-auditor/README.md`
- Structured config: `clawdbot/skills/white-hat-auditor/skill.json`
- White-Rabbit scanner: `clawdbot/skills/white-rabbit/SKILL.md`
