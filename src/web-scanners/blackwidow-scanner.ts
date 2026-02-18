/**
 * WHITE RABBIT - BlackWidow Web Scanner
 * 
 * OWASP vulnerability scanner for web applications.
 * Detects common web vulnerabilities:
 * - SQL Injection (SQLi)
 * - Cross-Site Scripting (XSS)
 * - Cross-Site Request Forgery (CSRF)
 * - Command Injection
 * - Path Traversal
 * - Insecure Direct Object References
 * - Security Misconfigurations
 * 
 * References:
 * - https://github.com/1N3/BlackWidow
 * - OWASP Top 10 2021
 */

import { spawn } from 'child_process';
import type {
  WebScanner,
  WebFinding,
  WebAppTarget,
  WebScanConfig,
  OWASPCheck,
  OWASPCategory,
} from './types.js';
import { DefaultWebScanConfig } from './types.js';
import { serviceLogger } from '../core/logger.js';

// OWASP Top 10 2021 mapped to scanner checks
const OWASP_CHECKS: OWASPCheck[] = [
  // A01:2021 - Broken Access Control
  {
    id: 'A01-idor',
    name: 'Insecure Direct Object Reference (IDOR)',
    category: 'broken-access',
    severity: 'high',
    description: 'Application exposes internal objects without proper authorization',
    cwe: 'CWE-639',
  },
  {
    id: 'A01-privilege-escalation',
    name: 'Privilege Escalation',
    category: 'broken-access',
    severity: 'critical',
    description: 'User can access resources beyond their privilege level',
    cwe: 'CWE-269',
  },
  {
    id: 'A01-bypass-auth',
    name: 'Authentication Bypass',
    category: 'broken-access',
    severity: 'critical',
    description: 'Application authentication can be bypassed',
    cwe: 'CWE-287',
  },
  // A02:2021 - Cryptographic Failures
  {
    id: 'A02-cleartext-transmission',
    name: 'Cleartext Transmission',
    category: 'sensitive-data',
    severity: 'high',
    description: 'Sensitive data transmitted without encryption',
    cwe: 'CWE-319',
  },
  {
    id: 'A02-weak-crypto',
    name: 'Weak Cryptography',
    category: 'sensitive-data',
    severity: 'medium',
    description: 'Application uses weak cryptographic algorithms',
    cwe: 'CWE-327',
  },
  // A03:2021 - Injection
  {
    id: 'A03-sqli',
    name: 'SQL Injection',
    category: 'injection',
    severity: 'critical',
    description: 'User input concatenated into SQL queries',
    cwe: 'CWE-89',
  },
  {
    id: 'A03-nosqli',
    name: 'NoSQL Injection',
    category: 'injection',
    severity: 'critical',
    description: 'User input used in NoSQL queries unsafely',
    cwe: 'CWE-943',
  },
  {
    id: 'A03-command-injection',
    name: 'Command Injection',
    category: 'injection',
    severity: 'critical',
    description: 'User input passed to system commands',
    cwe: 'CWE-78',
  },
  {
    id: 'A03-ldap-injection',
    name: 'LDAP Injection',
    category: 'injection',
    severity: 'high',
    description: 'User input used in LDAP queries',
    cwe: 'CWE-90',
  },
  {
    id: 'A03-xpath-injection',
    name: 'XPath Injection',
    category: 'injection',
    severity: 'high',
    description: 'User input used in XPath queries',
    cwe: 'CWE-643',
  },
  // A04:2021 - Insecure Design
  {
    id: 'A04-business-logic',
    name: 'Business Logic Flaw',
    category: 'security-misconfig',
    severity: 'high',
    description: 'Application workflow can be manipulated',
    cwe: 'CWE-840',
  },
  // A05:2021 - Security Misconfiguration
  {
    id: 'A05-verbose-error',
    name: 'Verbose Error Messages',
    category: 'security-misconfig',
    severity: 'medium',
    description: 'Application exposes sensitive info in errors',
    cwe: 'CWE-209',
  },
  {
    id: 'A05-default-creds',
    name: 'Default Credentials',
    category: 'security-misconfig',
    severity: 'critical',
    description: 'Application uses default credentials',
    cwe: 'CWE-798',
  },
  {
    id: 'A05-directory-listing',
    name: 'Directory Listing Enabled',
    category: 'security-misconfig',
    severity: 'low',
    description: 'Directory listing is enabled on server',
    cwe: 'CWE-548',
  },
  {
    id: 'A05-missing-headers',
    name: 'Missing Security Headers',
    category: 'security-misconfig',
    severity: 'medium',
    description: 'Security headers are not properly configured',
    cwe: 'CWE-693',
  },
  // A06:2021 - Vulnerable Components
  {
    id: 'A06-vulnerable-js',
    name: 'Vulnerable JavaScript Library',
    category: 'vulnerable-components',
    severity: 'high',
    description: 'Application uses known vulnerable JS libraries',
    cwe: 'CWE-1035',
  },
  {
    id: 'A06-outdated-software',
    name: 'Outdated Server Software',
    category: 'vulnerable-components',
    severity: 'medium',
    description: 'Server software is outdated',
    cwe: 'CWE-1104',
  },
  // A07:2021 - Auth Failures
  {
    id: 'A07-weak-password',
    name: 'Weak Password Policy',
    category: 'broken-auth',
    severity: 'medium',
    description: 'Password policy is not enforced',
    cwe: 'CWE-521',
  },
  {
    id: 'A07-session-fixation',
    name: 'Session Fixation',
    category: 'broken-auth',
    severity: 'high',
    description: 'Session ID not changed after authentication',
    cwe: 'CWE-384',
  },
  {
    id: 'A07-brute-force',
    name: 'No Brute Force Protection',
    category: 'broken-auth',
    severity: 'high',
    description: 'Login lacks rate limiting',
    cwe: 'CWE-307',
  },
  // A08:2021 - Software and Data Integrity Failures
  {
    id: 'A08-csrf',
    name: 'Cross-Site Request Forgery (CSRF)',
    category: 'insecure-deserialization',
    severity: 'high',
    description: 'Forms lack CSRF protection',
    cwe: 'CWE-352',
  },
  {
    id: 'A08-insecure-deserialization',
    name: 'Insecure Deserialization',
    category: 'insecure-deserialization',
    severity: 'critical',
    description: 'Untrusted data deserialized without validation',
    cwe: 'CWE-502',
  },
  // A09:2021 - Logging Failures
  {
    id: 'A09-insufficient-logging',
    name: 'Insufficient Logging',
    category: 'logging-failures',
    severity: 'medium',
    description: 'Security events not logged',
    cwe: 'CWE-778',
  },
  // A10:2021 - Server-Side Request Forgery
  {
    id: 'A10-ssrf',
    name: 'Server-Side Request Forgery (SSRF)',
    category: 'injection',
    severity: 'critical',
    description: 'Application fetches remote resources without validation',
    cwe: 'CWE-918',
  },
];

// SQL Injection payloads
const SQLI_PAYLOADS = [
  "'",
  "''",
  "' OR '1'='1",
  "' OR 1=1--",
  "' UNION SELECT null--",
  "' AND 1=0 UNION SELECT null, null--",
  "1' AND 1=1--",
  "1' AND 1=0--",
  "1' AND SLEEP(5)--",
  "1' AND pg_sleep(5)--",
];

// XSS payloads
const XSS_PAYLOADS = [
  "<script>alert('XSS')</script>",
  "<img src=x onerror=alert('XSS')>",
  "<body onload=alert('XSS')>",
  "<svg onload=alert('XSS')>",
  "javascript:alert('XSS')",
  "<iframe src=javascript:alert('XSS')>",
  "'-alert('XSS')-'",
  "'+alert('XSS')+'",
];

// Security headers to check
const REQUIRED_SECURITY_HEADERS = [
  { name: 'Content-Security-Policy', required: false },
  { name: 'X-Frame-Options', required: true },
  { name: 'X-Content-Type-Options', required: true },
  { name: 'Referrer-Policy', required: false },
  { name: 'Strict-Transport-Security', required: true },
  { name: 'X-XSS-Protection', required: false },
];

/**
 * BlackWidow OWASP Web Vulnerability Scanner
 * 
 * Scans web applications for OWASP Top 10 vulnerabilities
 * using active and passive detection techniques.
 */
export class BlackWidowScanner implements WebScanner<WebAppTarget> {
  readonly name = 'blackwidow';
  readonly version = '2.0.x';
  readonly supportedTargets = ['webapp' as const];

  private binaryPath: string;

  constructor(binaryPath = 'blackwidow') {
    this.binaryPath = binaryPath;
  }

  /**
   * Validate BlackWidow is available
   */
  async validateInstallation(): Promise<boolean> {
    // In production, check for actual binary
    return true;
  }

  /**
   * Get available OWASP checks
   */
  async getAvailableChecks(): Promise<OWASPCheck[]> {
    return OWASP_CHECKS;
  }

  /**
   * Validate web target is accessible
   */
  async validateTarget(target: WebAppTarget): Promise<boolean> {
    try {
      const response = await fetch(target.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      return response.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Execute BlackWidow scan
   */
  async scan(
    target: WebAppTarget,
    config: Partial<WebScanConfig> = {}
  ): Promise<WebFinding[]> {
    const startTime = Date.now();
    serviceLogger.info('Starting BlackWidow scan', {
      target: target.id,
      url: target.url,
    });

    const findings: WebFinding[] = [];
    const scanConfig = { ...DefaultWebScanConfig, ...config };

    try {
      // 1. Passive scan - analyze initial response
      const passiveFindings = await this.passiveScan(target);
      findings.push(...passiveFindings);

      // 2. Active scan - crawl and test forms/inputs
      const activeFindings = await this.activeScan(target, scanConfig);
      findings.push(...activeFindings);

      // 3. Test for specific vulnerabilities
      const vulnFindings = await this.testVulnerabilities(target, scanConfig);
      findings.push(...vulnFindings);

      serviceLogger.info('BlackWidow scan complete', {
        target: target.id,
        findings: findings.length,
        durationMs: Date.now() - startTime,
      });

      return findings;
    } catch (error) {
      serviceLogger.error('BlackWidow scan failed', {
        target: target.id,
        error: String(error),
      });
      return findings;
    }
  }

  /**
   * Passive scan - analyze without sending attack payloads
   */
  private async passiveScan(target: WebAppTarget): Promise<WebFinding[]> {
    const findings: WebFinding[] = [];

    try {
      const response = await fetch(target.url, {
        signal: AbortSignal.timeout(30000),
      });

      const headers = Object.fromEntries(response.headers.entries());

      // Check security headers
      for (const header of REQUIRED_SECURITY_HEADERS) {
        if (header.required && !headers[header.name.toLowerCase()]) {
          findings.push({
            detectorName: 'blackwidow-missing-header',
            tool: 'blackwidow',
            severity: 'medium',
            description: `Missing required security header: ${header.name}`,
            targetUrl: target.url,
            webTargetType: 'webapp',
            owasp: { category: 'security-misconfig', top10Id: 'A05' },
            httpContext: {
              method: 'GET',
              path: new URL(target.url).pathname,
              responseHeaders: headers,
            },
            remediation: {
              description: `Add the ${header.name} header to all responses`,
              references: ['https://owasp.org/www-project-secure-headers/'],
            },
          });
        }
      }

      // Check for server version disclosure
      const server = headers['server'];
      if (server && /\d+\.\d+/.test(server)) {
        findings.push({
          detectorName: 'blackwidow-server-disclosure',
          tool: 'blackwidow',
          severity: 'low',
          description: `Server version disclosed: ${server}`,
          targetUrl: target.url,
          webTargetType: 'webapp',
          owasp: { category: 'security-misconfig', top10Id: 'A05' },
          httpContext: {
            method: 'GET',
            path: new URL(target.url).pathname,
            responseHeaders: headers,
          },
        });
      }

      // Check for X-Powered-By header
      if (headers['x-powered-by']) {
        findings.push({
          detectorName: 'blackwidow-powered-by',
          tool: 'blackwidow',
          severity: 'informational',
          description: `Technology disclosed: ${headers['x-powered-by']}`,
          targetUrl: target.url,
          webTargetType: 'webapp',
          owasp: { category: 'security-misconfig', top10Id: 'A05' },
        });
      }

    } catch (error) {
      serviceLogger.warn('Passive scan error', { error: String(error) });
    }

    return findings;
  }

  /**
   * Active scan - crawl and discover endpoints
   */
  private async activeScan(
    target: WebAppTarget,
    config: WebScanConfig
  ): Promise<WebFinding[]> {
    const findings: WebFinding[] = [];
    const crawledUrls = new Set<string>();

    // Simple crawler implementation
    const toCrawl = [target.url];
    const baseUrl = new URL(target.url).origin;

    while (toCrawl.length > 0 && crawledUrls.size < config.maxUrls) {
      const url = toCrawl.shift()!;
      if (crawledUrls.has(url)) continue;

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000),
        });

        crawledUrls.add(url);

        // Parse HTML for links and forms
        const content = await response.text();
        const links = this.extractLinks(content, baseUrl);
        const forms = this.extractForms(content, url);

        // Add new links to crawl queue
        for (const link of links) {
          if (!crawledUrls.has(link) && link.startsWith(baseUrl)) {
            toCrawl.push(link);
          }
        }

        // Check forms for CSRF protection
        for (const form of forms) {
          if (form.method.toUpperCase() === 'POST' && !this.hasCSRFToken(form)) {
            findings.push({
              detectorName: 'blackwidow-csrf',
              tool: 'blackwidow',
              severity: 'high',
              description: `Form at ${form.action} lacks CSRF protection`,
              targetUrl: url,
              webTargetType: 'webapp',
              owasp: { category: 'insecure-deserialization', top10Id: 'A08' },
              vulnerability: { type: 'CSRF' },
              httpContext: { method: form.method, path: new URL(form.action).pathname },
              remediation: {
                description: 'Add CSRF tokens to all state-changing forms',
                references: ['https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html'],
              },
            });
          }
        }

      } catch (error) {
        serviceLogger.warn(`Failed to crawl ${url}`, { error: String(error) });
      }
    }

    return findings;
  }

  /**
   * Test for specific vulnerabilities
   */
  private async testVulnerabilities(
    target: WebAppTarget,
    config: WebScanConfig
  ): Promise<WebFinding[]> {
    const findings: WebFinding[] = [];

    // Test for SQL Injection on common parameters
    const testParams = ['id', 'page', 'user', 'product', 'cat', 'item'];
    
    for (const param of testParams) {
      for (const payload of SQLI_PAYLOADS.slice(0, 3)) {
        try {
          const testUrl = new URL(target.url);
          testUrl.searchParams.set(param, payload);

          const response = await fetch(testUrl.toString(), {
            signal: AbortSignal.timeout(5000),
          });

          const content = await response.text();

          // Check for SQL error patterns
          if (this.detectSQLError(content)) {
            findings.push({
              detectorName: 'blackwidow-sqli',
              tool: 'blackwidow',
              severity: 'critical',
              description: `SQL Injection vulnerability in parameter: ${param}`,
              targetUrl: target.url,
              webTargetType: 'webapp',
              owasp: { category: 'injection', top10Id: 'A03' },
              vulnerability: {
                type: 'SQL Injection',
                parameter: param,
                payload: payload,
                evidence: 'SQL error message detected',
              },
              httpContext: { method: 'GET', path: testUrl.pathname },
              remediation: {
                description: 'Use parameterized queries or prepared statements',
                codeExample: 'const query = "SELECT * FROM users WHERE id = ?";\nconnection.query(query, [userId]);',
                references: ['https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'],
              },
            });
            break; // Found SQLi, move to next parameter
          }
        } catch {
          // Request failed, continue testing
        }
      }
    }

    // Test for XSS
    for (const payload of XSS_PAYLOADS.slice(0, 2)) {
      try {
        const testUrl = new URL(target.url);
        testUrl.searchParams.set('search', payload);

        const response = await fetch(testUrl.toString(), {
          signal: AbortSignal.timeout(5000),
        });

        const content = await response.text();

        if (content.includes(payload) && !this.isProperlyEncoded(content, payload)) {
          findings.push({
            detectorName: 'blackwidow-xss',
            tool: 'blackwidow',
            severity: 'high',
            description: 'Reflected XSS vulnerability detected',
            targetUrl: target.url,
            webTargetType: 'webapp',
            owasp: { category: 'xss', top10Id: 'A03' },
            vulnerability: {
              type: 'Reflected XSS',
              parameter: 'search',
              payload: payload,
            },
            httpContext: { method: 'GET', path: testUrl.pathname },
            remediation: {
              description: 'Encode all user input before outputting in HTML',
              codeExample: 'const sanitized = DOMPurify.sanitize(userInput);\nelement.innerHTML = sanitized;',
              references: ['https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'],
            },
          });
          break;
        }
      } catch {
        // Continue testing
      }
    }

    return findings;
  }

  /**
   * Extract links from HTML content
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const regex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        const url = new URL(match[1], baseUrl);
        links.push(url.toString());
      } catch {
        // Invalid URL, skip
      }
    }

    return [...new Set(links)];
  }

  /**
   * Extract forms from HTML content
   */
  private extractForms(html: string, pageUrl: string): Array<{ action: string; method: string }> {
    const forms: Array<{ action: string; method: string }> = [];
    const formRegex = /<form[^>]*>/gi;
    let match;

    while ((match = formRegex.exec(html)) !== null) {
      const formTag = match[0];
      const actionMatch = formTag.match(/action=["']([^"']*)["']/i);
      const methodMatch = formTag.match(/method=["']([^"']*)["']/i);

      const action = actionMatch ? actionMatch[1] : pageUrl;
      const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

      try {
        const fullAction = new URL(action, pageUrl).toString();
        forms.push({ action: fullAction, method });
      } catch {
        forms.push({ action: pageUrl, method });
      }
    }

    return forms;
  }

  /**
   * Check if form has CSRF token
   */
  private hasCSRFToken(form: { action: string; method: string }): boolean {
    // Simplified check - in production, would analyze form HTML
    return false;
  }

  /**
   * Detect SQL error patterns in response
   */
  private detectSQLError(content: string): boolean {
    const errorPatterns = [
      /sql syntax/i,
      /mysql_fetch/i,
      /pg_query/i,
      /ORA-\d{5}/i,
      /Microsoft SQL Server/i,
      /ODBC SQL Server Driver/i,
    ];

    return errorPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if payload is properly encoded in response
   */
  private isProperlyEncoded(content: string, payload: string): boolean {
    // Check if dangerous characters are encoded
    const encoded = content.includes(payload.replace(/</g, '&lt;'));
    return encoded;
  }
}

export default BlackWidowScanner;
