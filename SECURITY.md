# Security Policy

## Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, please report security issues via:

- Email: security@whiteclaws.app
- Encrypted: Use our [PGP key](https://whiteclaws.app/security.asc)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 5 business days  
- **Fix & Disclosure**: Coordinated disclosure after fix

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | ✅ Yes    |
| 1.x.x   | ❌ No     |

## Security Measures

### Code Security

- All commits are signed
- Dependencies are automatically audited
- Secrets scanning in CI/CD
- No secrets in repository

### Package Security

- npm provenance enabled
- SBOM generation
- Dependency pinning

## Security-Related Configuration

### Required Secrets (GitHub)

Set these in your repository settings:

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `NPM_TOKEN` | npm publishing | Releases |

### Environment Variables

See `.env.example` for required environment variables.

**NEVER** commit `.env` files to git.

## Security Scanning

We use automated security scanning:

- **TruffleHog**: Secret detection
- **npm audit**: Dependency vulnerabilities
- **GitHub Advanced Security**: Code scanning

## Bug Bounty

We offer bug bounties for security vulnerabilities:

| Severity | Bounty |
|----------|--------|
| Critical | $1,000 - $5,000 |
| High | $500 - $1,000 |
| Medium | $100 - $500 |

Eligibility determined on a case-by-case basis.

## Security Best Practices for Users

1. Always verify contract addresses
2. Use the latest version of our packages
3. Enable 2FA on your accounts
4. Keep API keys secure
5. Monitor for security advisories
