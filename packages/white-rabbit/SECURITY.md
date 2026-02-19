# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.0.x   | :x:                |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in WhiteRabbit, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue
2. Email security@whiteclaws.app with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Fix & Disclosure**: Coordinated disclosure after fix

### Bug Bounty

Eligible vulnerabilities may qualify for bug bounty rewards:

| Severity | Reward Range |
|----------|-------------|
| Critical | $1,000 - $5,000 |
| High | $500 - $1,000 |
| Medium | $100 - $500 |
| Low | Swag / Recognition |

## Security Features

### Pattern Detection

WhiteRabbit detects the following vulnerability categories:

| Category | Severity | Patterns |
|----------|----------|----------|
| Reentrancy | High | 5 patterns |
| Access Control | High | 4 patterns |
| Oracle Manipulation | Critical | 3 patterns |
| Flash Loan | High | 4 patterns |
| Integer Overflow | Medium | 3 patterns |
| Governance Attack | High | 4 patterns |
| Price Manipulation | Critical | 3 patterns |

### Safe Pattern Detection

WhiteRabbit recognizes security patterns that mitigate vulnerabilities:

- `ReentrancyGuard` / `nonReentrant` modifier
- `onlyOwner` / `onlyRole` access control
- Checks-Effects-Interactions pattern
- SafeMath usage

### Limitations

**IMPORTANT**: WhiteRabbit is a static analysis tool with inherent limitations:

1. **False Positives**: Pattern matching may flag safe code
2. **False Negatives**: Complex vulnerabilities may be missed
3. **No Runtime Analysis**: Cannot detect logic errors requiring execution
4. **Not a Replacement for Audit**: Always get professional audits for production

### Confidence Levels

Each finding includes a confidence rating:

- **High**: Strong indicators, likely a real issue
- **Medium**: Possible issue, requires manual review
- **Low**: Weak indicators, may be false positive

## Best Practices for Users

### Before Deployment

1. Run WhiteRabbit scan
2. Review all HIGH and CRITICAL findings
3. Get professional audit for contracts > $100K TVL
4. Use formal verification for critical logic
5. Deploy to testnet first

### Continuous Monitoring

1. Re-scan after any code changes
2. Monitor deployed contracts for new vulnerability patterns
3. Subscribe to security advisories

## Vulnerability History

| Date | CVE | Description | Status |
|------|-----|-------------|--------|
| - | - | No vulnerabilities reported | - |

## Security Architecture

### Sandboxing

- PatternEngine runs in isolated context
- No external network calls during analysis
- Resource limits enforced

### Input Validation

- All inputs sanitized before processing
- Maximum source code size: 1MB
- Timeout protection: 30 seconds per scan

### Output Sanitization

- No raw code execution
- Findings don't include sensitive data
- Stack traces sanitized

## Contact

- Security Team: security@whiteclaws.app
- PGP Key: [security@whiteclaws.asc](https://whiteclaws.app/security.asc)
