# Immunefi Submission Mastery

## Platform Overview
- **$180B+** Protected across Web3
- **$110M+** Total bounties paid
- **276** Active bounty programs
- **$162M** Available in bounties

## Submission Process

### 5-Step Form Structure
1. **Assets & Impact:** Program → Manual name typing → Asset → Impact → Acknowledgment
2. **Severity Level:** Radio selection → Acknowledgment
3. **Main Report:** Title → Description → PoC → Acknowledgment
4. **Wallet Address:** Complex verification (requires manual setup)
5. **Review:** Final confirmation

### Critical Form Insights
- Hidden progressive fields appear only after completing previous steps
- ALL sub-steps within each main step must be completed
- Wallet setup blocks progression (technical limitation)
- JavaScript content injection required for large markdown/code content

## Report Template

```markdown
## Summary
[1-2 sentence vulnerability description]

## Vulnerability Details
### Root Cause
[Technical explanation of the bug]

### Affected Functions
[List functions and contracts]

### Attack Vector
[Step-by-step exploitation]

## Impact
[Concrete impact with numbers]

## Proof of Concept
[Working code or mathematical proof]

## Recommended Fix
[Suggested mitigation]
```

## Automation Success Rate
- **75% Full Automation:** Steps 1-3 completely automated
- **25% Manual:** Wallet verification requires human
- **100% Content Accuracy:** Verified report content reaches fields

## Best Practices

### DO
- Read scope carefully first
- Provide clear, reproducible PoC
- Use structured reporting format
- Include impact assessment with numbers
- Double-check severity classification

### DON'T
- Overclaim severity
- Submit design choices as vulnerabilities
- Use AI attribution in reports
- Submit duplicate findings
- Rush without verification

## Out of Scope (Default)
- Self-exploited vulnerabilities
- Attacks requiring leaked credentials
- Third-party oracle data issues
- Basic economic attacks (51%)
- Theoretical impacts without demonstration

---
*Last Updated: 2026-01-30*
