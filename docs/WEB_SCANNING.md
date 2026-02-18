# White Rabbit - Web Security Scanning

This document describes the web application and website security scanning capabilities added to White Rabbit.

## Overview

White Rabbit now includes comprehensive web security scanning to protect dApp frontends and web interfaces:

- **BlackWidow** - OWASP Top 10 vulnerability scanner
- **SubOver** - Subdomain takeover detection
- **DomDig** - DOM XSS scanner for Single Page Applications

## Why Web Security Matters for Web3

Web3 dApps typically have three layers that need protection:

```
┌─────────────────────────────────────────────────────────────┐
│                     dApp Architecture                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (SPA)   │   Smart Contracts   │   Infrastructure │
│  ─────────────    │   ───────────────   │   ─────────────  │
│  • React/Vue      │   • Solidity        │   • K8s/AWS      │
│  • DOM XSS        │   • Reentrancy      │   • Misconfigs   │
│  • CSRF           │   • Access Control  │   • Network      │
│  • API vulns      │   • Integer Overflow│   • Secrets      │
└─────────────────────────────────────────────────────────────┘
         │                    │                   │
         └────────────────────┼───────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │   White Rabbit     │
                    │   Unified Scanner  │
                    └────────────────────┘
```

Web vulnerabilities can compromise:
- Wallet connections
- Transaction signing
- User session tokens
- Private key storage (in browser)

## Scanners

### BlackWidow (OWASP Scanner)

**Purpose**: Comprehensive web vulnerability scanning based on OWASP Top 10 2021.

**Coverage**:

| OWASP Category | Checks | Severity |
|----------------|--------|----------|
| **A01: Broken Access Control** | IDOR, privilege escalation, auth bypass | Critical/High |
| **A02: Cryptographic Failures** | Cleartext transmission, weak crypto | High/Medium |
| **A03: Injection** | SQLi, NoSQLi, command injection, LDAP injection | Critical |
| **A05: Security Misconfiguration** | Missing headers, verbose errors, default creds | Medium |
| **A06: Vulnerable Components** | Outdated libraries, server software | High |
| **A07: Auth Failures** | Weak passwords, session fixation, brute force | High |
| **A08: Data Integrity** | CSRF, insecure deserialization | Critical/High |
| **A10: SSRF** | Server-side request forgery | Critical |

**Usage**:
```typescript
import { BlackWidowScanner } from './src/web-scanners/index.js';

const scanner = new BlackWidowScanner();
const findings = await scanner.scan({
  id: 'dapp-frontend',
  type: 'webapp',
  name: 'DeFi Frontend',
  url: 'https://app.example.com',
  metadata: {
    domain: 'app.example.com',
    paths: ['/swap', '/pool', '/stake'],
  },
});
```

**Security Headers Checked**:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Referrer-Policy
- X-XSS-Protection

### SubOver (Subdomain Takeover)

**Purpose**: Detect subdomain takeover vulnerabilities where DNS records point to unclaimed cloud resources.

**Attack Scenario**:
```
1. Company creates subdomain: staging.example.com
2. Points CNAME to: example.herokuapp.com
3. Heroku app is deleted but DNS record remains
4. Attacker claims example.herokuapp.com
5. Now controls staging.example.com!
```

**Supported Services** (30+ platforms):
- AWS (S3, Elastic Beanstalk, CloudFront)
- GitHub Pages
- Heroku
- Vercel
- Netlify
- Azure
- Google Cloud
- Shopify
- Tumblr
- WordPress.com
- And more...

**Usage**:
```typescript
import { SubOverScanner } from './src/web-scanners/index.js';

const scanner = new SubOverScanner();
const findings = await scanner.scan({
  id: 'domain-security',
  type: 'subdomain',
  name: 'Example Domain Security',
  url: 'https://example.com',
  metadata: {
    rootDomain: 'example.com',
    subdomains: [
      'www.example.com',
      'api.example.com',
      'staging.example.com',
      'blog.example.com',
    ],
  },
});
```

**Detection Process**:
1. Resolve DNS records for each subdomain
2. Identify CNAMEs pointing to cloud services
3. Check if the service is claimable
4. Verify vulnerability via HTTP fingerprinting
5. Report with remediation steps

### DomDig (DOM XSS Scanner)

**Purpose**: Detect DOM-based XSS vulnerabilities in Single Page Applications (SPAs).

**Why DOM XSS is Critical for dApps**:
- dApps are typically SPAs (React, Vue, Angular)
- Handle sensitive wallet interactions
- Process blockchain transactions
- Store private keys in browser

**DOM Sources Tracked**:
```javascript
// URL-based
location.hash
location.search
document.URL

// Storage-based
document.cookie
localStorage
sessionStorage

// Messaging
window.addEventListener('message')

// Element properties
element.innerHTML
document.write
eval()
```

**Framework-Specific Detection**:

| Framework | Dangerous Patterns Detected |
|-----------|---------------------------|
| **React** | `dangerouslySetInnerHTML`, `innerHTML=` |
| **Vue** | `v-html`, triple mustache `{{{}}}` |
| **Angular** | `bypassSecurityTrustHtml`, `bypassSecurityTrustScript` |

**Usage**:
```typescript
import { DomDigScanner } from './src/web-scanners/index.js';

const scanner = new DomDigScanner();
const findings = await scanner.scan({
  id: 'spa-frontend',
  type: 'spa',
  name: 'DeFi SPA',
  url: 'https://app.example.com',
  metadata: {
    framework: 'react',
    routes: ['/', '/swap', '/pool', '/governance'],
    authRequired: true,
  },
});
```

**XSS Payloads Tested**:
- `<img src=x onerror=alert(1)>`
- `<svg onload=alert(1)>`
- `javascript:alert(1)`
- `<script>alert(1)</script>`

## Integration with Infrastructure Pipeline

Web scanners integrate seamlessly with the existing infrastructure scanning pipeline:

```typescript
import { InfrastructureAnalysisPipeline } from './src/infrastructure/index.js';

const pipeline = new InfrastructureAnalysisPipeline({
  enabledScanners: ['blackwidow', 'subover', 'domdig'],
});

// Web application scan
const webResult = await pipeline.analyzeWebTarget({
  id: 'dapp-web',
  type: 'webapp',
  name: 'DeFi Web',
  url: 'https://app.defiprotocol.com',
});

// Subdomain scan
const subdomainResult = await pipeline.analyzeWebTarget({
  id: 'domain-security',
  type: 'subdomain',
  name: 'Protocol Domains',
  url: 'https://defiprotocol.com',
  metadata: {
    rootDomain: 'defiprotocol.com',
    subdomains: ['app', 'api', 'staging', 'docs'],
  },
});

// SPA scan
const spaResult = await pipeline.analyzeWebTarget({
  id: 'spa-dapp',
  type: 'spa',
  name: 'DeFi SPA',
  url: 'https://app.defiprotocol.com',
  metadata: {
    framework: 'react',
    routes: ['/', '/swap', '/pool'],
  },
});
```

## Batch Scanning

```typescript
// Scan multiple web targets
const targets = [
  { id: 'main-site', type: 'webapp', url: 'https://example.com' },
  { id: 'api-docs', type: 'webapp', url: 'https://docs.example.com' },
  { id: 'app', type: 'spa', url: 'https://app.example.com' },
];

const results = await pipeline.analyzeWebBatch(targets);
```

## Finding Structure

### BlackWidow Finding

```typescript
interface BlackWidowFinding {
  detectorName: 'blackwidow-sqli';
  tool: 'blackwidow';
  severity: 'critical';
  description: 'SQL Injection vulnerability in parameter: id';
  targetUrl: 'https://example.com';
  webTargetType: 'webapp';
  owasp: {
    category: 'injection';
    top10Id: 'A03';
  };
  vulnerability: {
    type: 'SQL Injection';
    parameter: 'id';
    payload: "' OR 1=1--";
    evidence: 'SQL error message detected';
  };
  httpContext: {
    method: 'GET';
    path: '/api/users';
  };
  remediation: {
    description: 'Use parameterized queries';
    codeExample: 'const query = "SELECT * FROM users WHERE id = ?"';
    references: ['https://cheatsheetseries.owasp.org/...'];
  };
}
```

### SubOver Finding

```typescript
interface SubOverFinding {
  detectorName: 'subover-takeover';
  tool: 'subover';
  severity: 'critical';
  description: 'Subdomain takeover possible on staging.example.com via Heroku';
  subdomain: 'staging.example.com';
  vulnerableService: 'Heroku';
  cnameRecord: 'example-app.herokuapp.com';
  claimable: true;
  remediation: {
    description: 'Immediately claim the resource or remove DNS record';
  };
}
```

### DomDig Finding

```typescript
interface DomDigFinding {
  detectorName: 'domdig-source-sink-flow';
  tool: 'domdig';
  severity: 'critical';
  description: 'Potential DOM XSS: hash source flows to innerHTML sink';
  source: 'location.hash';
  sink: 'element.innerHTML';
  codeFlow: ['location.hash', 'element.innerHTML'];
  exploitable: true;
  browserContext: {
    url: 'https://app.example.com';
    hash: '#/evil-payload';
  };
  remediation: {
    description: 'Sanitize hash data before using in innerHTML';
    codeExample: 'element.textContent = sanitizedInput';
  };
}
```

## Configuration

### Scan Configuration

```typescript
const config = {
  severityThreshold: 'medium',
  includeChecks: ['A03-sqli', 'A07-brute-force'],
  excludeChecks: ['A05-directory-listing'],
  timeoutMs: 300000,
  maxDepth: 3,
  maxUrls: 100,
  parallelRequests: 5,
  userAgent: 'WhiteRabbit-Security-Scanner/1.0',
  headers: {
    'Authorization': 'Bearer token',
  },
};
```

### Authentication

```typescript
// Bearer token
const target = {
  ...baseTarget,
  auth: {
    type: 'bearer',
    credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
};

// Cookie-based
const target = {
  ...baseTarget,
  cookies: {
    'session': 'abc123',
    'auth': 'token',
  },
};
```

## Continuous Monitoring

```typescript
import { schedule } from 'node-cron';

// Daily subdomain takeover scan
schedule('0 0 * * *', async () => {
  const scanner = new SubOverScanner();
  const findings = await scanner.scan(subdomainTarget);
  
  if (findings.some(f => f.claimable)) {
    await alertTeam('Subdomain takeover vulnerability detected!');
  }
});

// Weekly OWASP scan
schedule('0 0 * * 0', async () => {
  const scanner = new BlackWidowScanner();
  const findings = await scanner.scan(webTarget);
  
  await generateReport(findings);
});
```

## CI/CD Integration

```yaml
# .github/workflows/security-scan.yml
name: Web Security Scan
on: [push, pull_request]

jobs:
  web-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run BlackWidow Scan
        run: |
          npx tsx scripts/scan-web.ts \
            --target https://staging.example.com \
            --fail-on critical
      
      - name: Check for Subdomain Takeover
        run: |
          npx tsx scripts/scan-subdomains.ts \
            --domain example.com
```

## Best Practices

### 1. Scan All Environments
- Production (continuous monitoring)
- Staging (before release)
- Development (catch issues early)

### 2. Prioritize by Risk
```typescript
const criticalFindings = findings.filter(f => 
  f.severity === 'critical' && 
  (f.owasp?.top10Id === 'A03' || f.claimable === true)
);
```

### 3. Track Remediation
```typescript
// Store findings in database
await db.insert(findings.map(f => ({
  ...f,
  status: 'open',
  assignedTo: null,
  remediatedAt: null,
})));
```

### 4. False Positive Management
```typescript
const fpFilter = new FindingFilter();
fpFilter.addExclusion({
  detector: 'blackwidow-missing-header',
  url: '/health',
  reason: 'Health endpoint intentionally minimal',
});
```

## Troubleshooting

### BlackWidow
- Ensure target URL is accessible
- Check for rate limiting (add delays)
- Verify authentication if required

### SubOver
- DNS resolution requires network access
- Some services block DNS queries
- Use internal DNS for private domains

### DomDig
- JavaScript-heavy apps may need longer timeouts
- Framework detection requires access to HTML
- Route analysis needs proper URL structure

## Future Enhancements

- [ ] WebSocket security scanning
- [ ] GraphQL vulnerability detection
- [ ] API security testing (OWASP API Top 10)
- [ ] Screenshot capture for visual verification
- [ ] Credential stuffing detection
- [ ] Content Security Policy evaluator
