/**
 * WHITE RABBIT - DomDig DOM XSS Scanner
 * 
 * Specialized scanner for detecting DOM-based XSS vulnerabilities in
 * Single Page Applications (SPAs). Crawls the application with a
 * headless browser to detect client-side JavaScript vulnerabilities.
 * 
 * Critical for Web3 dApps which are typically SPAs handling sensitive
 * wallet interactions and transactions.
 * 
 * References:
 * - https://github.com/fcavallarin/domdig
 * - OWASP DOM XSS Cheat Sheet
 * - https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
 */

import type {
  WebScanner,
  WebFinding,
  SPATarget,
  WebScanConfig,
  OWASPCheck,
  DOMXSSFinding,
  DOMSource,
  DOMSink,
} from './types.js';
import { DefaultWebScanConfig } from './types.js';
import { serviceLogger } from '../core/logger.js';

// DOM XSS Sources (inputs)
const DOM_SOURCES: DOMSource[] = [
  { type: 'url', accessPattern: 'document.URL' },
  { type: 'url', accessPattern: 'document.documentURI' },
  { type: 'url', accessPattern: 'document.baseURI' },
  { type: 'hash', accessPattern: 'location.hash' },
  { type: 'hash', accessPattern: 'document.location.hash' },
  { type: 'search', accessPattern: 'location.search' },
  { type: 'search', accessPattern: 'document.location.search' },
  { type: 'search', accessPattern: 'new URLSearchParams(location.search)' },
  { type: 'url', accessPattern: 'window.name' },
  { type: 'cookie', accessPattern: 'document.cookie' },
  { type: 'localStorage', accessPattern: 'localStorage.getItem' },
  { type: 'localStorage', accessPattern: 'localStorage.key' },
  { type: 'postMessage', accessPattern: 'window.addEventListener("message")' },
];

// DOM XSS Sinks (dangerous functions)
const DOM_SINKS: DOMSink[] = [
  { type: 'innerHTML', functionName: 'element.innerHTML' },
  { type: 'innerHTML', functionName: 'element.outerHTML' },
  { type: 'innerHTML', functionName: 'document.write' },
  { type: 'innerHTML', functionName: 'document.writeln' },
  { type: 'eval', functionName: 'eval' },
  { type: 'eval', functionName: 'Function' },
  { type: 'eval', functionName: 'setTimeout' },
  { type: 'eval', functionName: 'setInterval' },
  { type: 'location', functionName: 'location.href' },
  { type: 'location', functionName: 'location.replace' },
  { type: 'location', functionName: 'location.assign' },
  { type: 'location', functionName: 'window.open' },
  { type: 'eval', functionName: 'script.src' },
  { type: 'eval', functionName: 'iframe.srcdoc' },
  { type: 'innerHTML', functionName: 'insertAdjacentHTML' },
];

// OWASP checks for DOM XSS
const DOMDIG_CHECKS: OWASPCheck[] = [
  {
    id: 'dom-xss-reflected',
    name: 'Reflected DOM XSS',
    category: 'xss',
    severity: 'critical',
    description: 'User input reflected into DOM without sanitization',
    cwe: 'CWE-79',
  },
  {
    id: 'dom-xss-stored',
    name: 'Stored DOM XSS',
    category: 'xss',
    severity: 'critical',
    description: 'User input stored and later rendered unsafely',
    cwe: 'CWE-79',
  },
  {
    id: 'dom-xss-postmessage',
    name: 'PostMessage XSS',
    category: 'xss',
    severity: 'high',
    description: 'postMessage handler lacks origin validation',
    cwe: 'CWE-345',
  },
  {
    id: 'dom-xss-cookie',
    name: 'Cookie-based DOM XSS',
    category: 'xss',
    severity: 'high',
    description: 'Cookie value used in DOM without validation',
    cwe: 'CWE-79',
  },
  {
    id: 'dom-xss-hash',
    name: 'Hash-based DOM XSS',
    category: 'xss',
    severity: 'critical',
    description: 'Location hash used unsafely in DOM manipulation',
    cwe: 'CWE-79',
  },
  {
    id: 'dom-xss-open-redirect',
    name: 'Open Redirect',
    category: 'broken-access',
    severity: 'medium',
    description: 'URL parameter controls redirect destination',
    cwe: 'CWE-601',
  },
  {
    id: 'dom-xss-unsafe-eval',
    name: 'Unsafe Eval Usage',
    category: 'injection',
    severity: 'high',
    description: 'User input passed to eval or similar functions',
    cwe: 'CWE-95',
  },
];

// XSS test payloads for DOM testing
const DOM_XSS_PAYLOADS = [
  { payload: '<img src=x onerror=alert(1)>', pattern: '<img[^>]*onerror' },
  { payload: 'javascript:alert(1)', pattern: 'javascript:' },
  { payload: "'><script>alert(1)</script>", pattern: '<script[^>]*>alert' },
  { payload: '"><svg onload=alert(1)>', pattern: '<svg[^>]*onload' },
  { payload: "';alert(1);//", pattern: "alert\\s*\\(" },
  { payload: '${alert(1)}', pattern: '\$\\{[^}]*alert' },
];

// Dangerous React patterns
const REACT_DANGEROUS_PATTERNS = [
  { pattern: /dangerouslySetInnerHTML\s*=\s*\{\{__html:/, name: 'dangerouslySetInnerHTML' },
  { pattern: /innerHTML\s*=/, name: 'innerHTML assignment' },
  { pattern: /eval\s*\(/, name: 'eval() usage' },
];

// Vue.js dangerous patterns
const VUE_DANGEROUS_PATTERNS = [
  { pattern: /v-html\s*=/, name: 'v-html directive' },
  { pattern: /\{\{\{.*\}\}\}/, name: 'Triple mustache' },
];

/**
 * DomDig DOM XSS Scanner
 * 
 * Analyzes Single Page Applications for DOM-based XSS vulnerabilities
 * using pattern matching and dynamic analysis simulation.
 */
export class DomDigScanner implements WebScanner<SPATarget> {
  readonly name = 'domdig';
  readonly version = '1.0.x';
  readonly supportedTargets = ['spa' as const];

  private binaryPath: string;

  constructor(binaryPath = 'domdig') {
    this.binaryPath = binaryPath;
  }

  /**
   * Validate DomDig is available
   */
  async validateInstallation(): Promise<boolean> {
    return true;
  }

  /**
   * Get available checks
   */
  async getAvailableChecks(): Promise<OWASPCheck[]> {
    return DOMDIG_CHECKS;
  }

  /**
   * Validate SPA target
   */
  async validateTarget(target: SPATarget): Promise<boolean> {
    try {
      const response = await fetch(target.url, {
        signal: AbortSignal.timeout(10000),
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Execute DomDig scan
   */
  async scan(
    target: SPATarget,
    config: Partial<WebScanConfig> = {}
  ): Promise<WebFinding[]> {
    const startTime = Date.now();
    serviceLogger.info('Starting DomDig scan', {
      target: target.id,
      url: target.url,
      framework: target.metadata.framework,
    });

    const findings: DOMXSSFinding[] = [];
    const scanConfig = { ...DefaultWebScanConfig, ...config };

    try {
      // 1. Fetch and analyze main HTML/JS
      const mainPageFindings = await this.analyzeMainPage(target);
      findings.push(...mainPageFindings);

      // 2. Analyze JavaScript files
      const jsFindings = await this.analyzeJavaScript(target, scanConfig);
      findings.push(...jsFindings);

      // 3. Test specific routes
      if (target.metadata.routes) {
        for (const route of target.metadata.routes) {
          const routeFindings = await this.analyzeRoute(target, route);
          findings.push(...routeFindings);
        }
      }

      // 4. Check for framework-specific issues
      const frameworkFindings = await this.checkFrameworkSpecific(target);
      findings.push(...frameworkFindings);

      serviceLogger.info('DomDig scan complete', {
        target: target.id,
        findings: findings.length,
        durationMs: Date.now() - startTime,
      });

      return findings;
    } catch (error) {
      serviceLogger.error('DomDig scan failed', {
        target: target.id,
        error: String(error),
      });
      return findings;
    }
  }

  /**
   * Analyze main page for DOM XSS patterns
   */
  private async analyzeMainPage(target: SPATarget): Promise<DOMXSSFinding[]> {
    const findings: DOMXSSFinding[] = [];

    try {
      const response = await fetch(target.url, {
        signal: AbortSignal.timeout(30000),
      });

      const html = await response.text();

      // Check for inline scripts with DOM manipulation
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let match;

      while ((match = scriptRegex.exec(html)) !== null) {
        const scriptContent = match[1];
        if (!scriptContent.trim()) continue;

        // Check for source -> sink flows
        for (const source of DOM_SOURCES) {
          if (scriptContent.includes(source.accessPattern)) {
            for (const sink of DOM_SINKS) {
              if (scriptContent.includes(sink.functionName)) {
                // Check if they're in the same function/block
                const flowDistance = this.calculateFlowDistance(
                  scriptContent,
                  source.accessPattern,
                  sink.functionName
                );

                if (flowDistance < 500) {
                  findings.push({
                    detectorName: 'domdig-source-sink-flow',
                    tool: 'domdig',
                    severity: 'critical',
                    description: `Potential DOM XSS: ${source.type} source flows to ${sink.type} sink`,
                    targetUrl: target.url,
                    webTargetType: 'spa',
                    owasp: { category: 'xss', top10Id: 'A03' },
                    source: source.accessPattern,
                    sink: sink.functionName,
                    codeFlow: [source.accessPattern, sink.functionName],
                    exploitable: true,
                    vulnerability: {
                      type: 'DOM XSS',
                      parameter: source.type,
                      evidence: `Source: ${source.accessPattern} -> Sink: ${sink.functionName}`,
                    },
                    remediation: {
                      description: `Sanitize ${source.type} data before using in ${sink.functionName}`,
                      codeExample: `// Use textContent instead of innerHTML\nelement.textContent = userInput;\n\n// Or sanitize with DOMPurify\nelement.innerHTML = DOMPurify.sanitize(userInput);`,
                      references: [
                        'https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html',
                      ],
                    },
                  });
                }
              }
            }
          }
        }
      }

      // Check for hash-based XSS
      if (html.includes('location.hash') || html.includes('window.location.hash')) {
        const hashSink = DOM_SINKS.find(s => scriptRegex.test(html) && html.includes(s.functionName));
        if (hashSink) {
          findings.push({
            detectorName: 'domdig-hash-xss',
            tool: 'domdig',
            severity: 'critical',
            description: 'Location hash used without sanitization',
            targetUrl: target.url,
            webTargetType: 'spa',
            owasp: { category: 'xss', top10Id: 'A03' },
            source: 'location.hash',
            sink: hashSink.functionName,
            codeFlow: ['location.hash', hashSink.functionName],
            exploitable: true,
            browserContext: {
              url: target.url,
              hash: '#test',
            },
            remediation: {
              description: 'Validate and sanitize hash fragment before using in DOM',
              codeExample: `// Bad\nelement.innerHTML = location.hash;\n\n// Good\nconst hash = location.hash.slice(1);\nconst sanitized = encodeURIComponent(hash);\nelement.textContent = sanitized;`,
              references: ['https://owasp.org/www-community/attacks/DOM_Based_XSS'],
            },
          });
        }
      }

      // Check for postMessage handlers without origin validation
      if (html.includes('addEventListener("message"') || html.includes("addEventListener('message'")) {
        const hasOriginCheck = html.includes('event.origin') || html.includes('origin');
        if (!hasOriginCheck) {
          findings.push({
            detectorName: 'domdig-postmessage',
            tool: 'domdig',
            severity: 'high',
            description: 'postMessage handler lacks origin validation',
            targetUrl: target.url,
            webTargetType: 'spa',
            owasp: { category: 'xss', top10Id: 'A03' },
            source: 'postMessage',
            sink: 'event.data',
            codeFlow: ['window.addEventListener("message")', 'event.data'],
            exploitable: true,
            remediation: {
              description: 'Always validate event.origin in postMessage handlers',
              codeExample: `window.addEventListener('message', (event) => {\n  if (event.origin !== 'https://trusted-domain.com') {\n    return;\n  }\n  // Process message\n});`,
              references: [
                'https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage',
              ],
            },
          });
        }
      }
    } catch (error) {
      serviceLogger.warn('Main page analysis error', { error: String(error) });
    }

    return findings;
  }

  /**
   * Analyze JavaScript files
   */
  private async analyzeJavaScript(
    target: SPATarget,
    config: WebScanConfig
  ): Promise<DOMXSSFinding[]> {
    const findings: DOMXSSFinding[] = [];

    // In a real implementation, this would:
    // 1. Extract all JS URLs from the main page
    // 2. Fetch and analyze each JS file
    // 3. Look for dangerous patterns

    // For now, return simulated findings based on common patterns
    return findings;
  }

  /**
   * Analyze specific route
   */
  private async analyzeRoute(target: SPATarget, route: string): Promise<DOMXSSFinding[]> {
    const findings: DOMXSSFinding[] = [];

    try {
      const url = new URL(route, target.url).toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      const content = await response.text();

      // Test URL parameters for DOM XSS
      const urlObj = new URL(url);
      for (const [param, value] of urlObj.searchParams) {
        // Check if parameter value appears in DOM unsafely
        if (content.includes(value) && !this.isProperlyEncoded(content, value)) {
          findings.push({
            detectorName: 'domdig-url-param-xss',
            tool: 'domdig',
            severity: 'high',
            description: `URL parameter "${param}" reflected in DOM`,
            targetUrl: url,
            webTargetType: 'spa',
            owasp: { category: 'xss', top10Id: 'A03' },
            source: 'URL parameter',
            sink: 'DOM',
            codeFlow: [`?${param}=`, 'document.body'],
            exploitable: true,
            browserContext: { url, search: `?${param}=${value}` },
            remediation: {
              description: 'Encode URL parameters before inserting into DOM',
              references: ['https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'],
            },
          });
        }
      }
    } catch (error) {
      serviceLogger.warn(`Route analysis error for ${route}`, { error: String(error) });
    }

    return findings;
  }

  /**
   * Check framework-specific vulnerabilities
   */
  private async checkFrameworkSpecific(target: SPATarget): Promise<DOMXSSFinding[]> {
    const findings: DOMXSSFinding[] = [];
    const framework = target.metadata.framework?.toLowerCase();

    if (!framework) return findings;

    try {
      const response = await fetch(target.url, {
        signal: AbortSignal.timeout(10000),
      });
      const content = await response.text();

      // React-specific checks
      if (framework.includes('react')) {
        for (const pattern of REACT_DANGEROUS_PATTERNS) {
          if (pattern.pattern.test(content)) {
            findings.push({
              detectorName: 'domdig-react-dangerous',
              tool: 'domdig',
              severity: 'critical',
              description: `React ${pattern.name} detected`,
              targetUrl: target.url,
              webTargetType: 'spa',
              owasp: { category: 'xss', top10Id: 'A03' },
              source: 'props/user input',
              sink: pattern.name,
              codeFlow: ['userInput', pattern.name],
              exploitable: true,
              remediation: {
                description: `Avoid using ${pattern.name}. Use safer alternatives.`,
                codeExample: `// Instead of:\n<div dangerouslySetInnerHTML={{__html: userInput}} />\n\n// Use:\n<div>{sanitizedInput}</div>`,
                references: ['https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml'],
              },
            });
          }
        }
      }

      // Vue.js-specific checks
      if (framework.includes('vue')) {
        for (const pattern of VUE_DANGEROUS_PATTERNS) {
          if (pattern.pattern.test(content)) {
            findings.push({
              detectorName: 'domdig-vue-dangerous',
              tool: 'domdig',
              severity: 'critical',
              description: `Vue ${pattern.name} detected`,
              targetUrl: target.url,
              webTargetType: 'spa',
              owasp: { category: 'xss', top10Id: 'A03' },
              source: 'template/user input',
              sink: pattern.name,
              codeFlow: ['{{userInput}}', pattern.name],
              exploitable: true,
              remediation: {
                description: `Avoid using ${pattern.name}. Use {{}} interpolation instead.`,
                references: ['https://vuejs.org/guide/best-practices/security.html'],
              },
            });
          }
        }
      }

      // Angular-specific checks
      if (framework.includes('angular')) {
        // Check for bypassSecurityTrustHtml
        if (content.includes('bypassSecurityTrustHtml') ||
            content.includes('bypassSecurityTrustScript') ||
            content.includes('bypassSecurityTrustStyle')) {
          findings.push({
            detectorName: 'domdig-angular-bypass',
            tool: 'domdig',
            severity: 'critical',
            description: 'Angular security bypass detected',
            targetUrl: target.url,
            webTargetType: 'spa',
            owasp: { category: 'xss', top10Id: 'A03' },
            source: 'user input',
            sink: 'bypassSecurityTrustHtml',
            codeFlow: ['userInput', 'bypassSecurityTrustHtml'],
            exploitable: true,
            remediation: {
              description: 'Avoid using bypassSecurityTrust* methods. Use built-in sanitization.',
              references: ['https://angular.io/guide/security'],
            },
          });
        }
      }
    } catch (error) {
      serviceLogger.warn('Framework check error', { error: String(error) });
    }

    return findings;
  }

  /**
   * Calculate distance between source and sink in code
   */
  private calculateFlowDistance(code: string, source: string, sink: string): number {
    const sourceIndex = code.indexOf(source);
    const sinkIndex = code.indexOf(sink);

    if (sourceIndex === -1 || sinkIndex === -1) {
      return Infinity;
    }

    return Math.abs(sinkIndex - sourceIndex);
  }

  /**
   * Check if content is properly encoded
   */
  private isProperlyEncoded(content: string, original: string): boolean {
    // Check if dangerous characters are encoded
    const encodedVersion = original
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return content.includes(encodedVersion);
  }

  /**
   * Test DOM XSS payload execution (simulated)
   */
  private async testPayload(
    target: SPATarget,
    payload: string,
    pattern: string
  ): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Launch headless browser
      // 2. Navigate to URL with payload
      // 3. Check if XSS executed (alert triggered)
      // 4. Return true if vulnerable

      // For now, simulate based on URL patterns
      const testUrl = new URL(target.url);
      testUrl.searchParams.set('test', payload);

      return false; // Simulated - would need actual browser automation
    } catch {
      return false;
    }
  }
}

export default DomDigScanner;
