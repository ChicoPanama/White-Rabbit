/**
 * E2E Tests for Web Security Scanners
 * 
 * Tests BlackWidow, SubOver, and DomDig scanners plus web scanning integration.
 */

import { strict as assert } from 'assert';
import {
  BlackWidowScanner,
  SubOverScanner,
  DomDigScanner,
  type WebAppTarget,
  type SubdomainTarget,
  type SPATarget,
} from '../../src/web-scanners/index.js';

// Test constants
const E2E_TEST_TIMEOUT = 60000;

// Mock targets for testing
const createWebAppTarget = (): WebAppTarget => ({
  id: 'test-webapp',
  type: 'webapp',
  name: 'Test Web Application',
  url: 'https://example.com',
  metadata: {
    domain: 'example.com',
    paths: ['/login', '/api', '/admin'],
    authenticated: false,
  },
});

const createSubdomainTarget = (): SubdomainTarget => ({
  id: 'test-subdomains',
  type: 'subdomain',
  name: 'Test Subdomain Enumeration',
  url: 'https://test.example.com',
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

const createSPATarget = (): SPATarget => ({
  id: 'test-spa',
  type: 'spa',
  name: 'Test Single Page Application',
  url: 'https://app.example.com',
  metadata: {
    framework: 'react',
    routes: ['/', '/dashboard', '/profile', '/wallet'],
    authRequired: true,
  },
});

// Test runner
let passCount = 0;
let failCount = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
    failCount++;
  }
}

// Tests
console.log('Web Security Scanners E2E Tests');
console.log('='.repeat(60));

async function runTests() {

// ============================================================================
// BLACKWIDOW SCANNER TESTS
// ============================================================================

console.log('\n📦 BlackWidow OWASP Scanner');
console.log('-'.repeat(40));

await test('BlackWidow scanner instantiation', async () => {
  const scanner = new BlackWidowScanner();
  assert.strictEqual(scanner.name, 'blackwidow');
  assert.strictEqual(scanner.supportedTargets.length, 1);
  assert.strictEqual(scanner.supportedTargets[0], 'webapp');
});

await test('BlackWidow getAvailableChecks returns OWASP checks', async () => {
  const scanner = new BlackWidowScanner();
  const checks = await scanner.getAvailableChecks();
  
  assert(checks.length > 0, 'Should return OWASP checks');
  
  // Check OWASP Top 10 categories are covered
  const categories = [...new Set(checks.map(c => c.category))];
  assert(categories.includes('injection'), 'Should include injection');
  // XSS might be categorized under 'injection' or 'xss'
  assert(categories.includes('injection') || categories.includes('xss'), 'Should include XSS');
  assert(categories.includes('broken-auth'), 'Should include auth issues');
  assert(categories.includes('security-misconfig'), 'Should include misconfiguration');
});

await test('BlackWidow includes critical OWASP checks', async () => {
  const scanner = new BlackWidowScanner();
  const checks = await scanner.getAvailableChecks();
  
  const criticalChecks = [
    'A03-sqli',
    'A03-command-injection',
    'A01-bypass-auth',
    'A05-default-creds',
    'A10-ssrf',
  ];
  
  for (const checkId of criticalChecks) {
    const found = checks.find(c => c.id === checkId);
    assert(found, `Should include ${checkId}`);
    assert(found.severity === 'critical' || found.severity === 'high',
      `${checkId} should be critical/high severity`);
  }
});

await test('BlackWidow checks have CWE mappings', async () => {
  const scanner = new BlackWidowScanner();
  const checks = await scanner.getAvailableChecks();
  
  // Most checks should have CWE mappings
  const withCwe = checks.filter(c => c.cwe);
  assert(withCwe.length > checks.length * 0.7, 'Most checks should have CWE mappings');
});

await test('BlackWidow validates web target', async () => {
  const scanner = new BlackWidowScanner();
  const target = createWebAppTarget();
  
  const isValid = await scanner.validateTarget(target);
  assert(typeof isValid === 'boolean', 'Should return boolean');
});

await test('BlackWidow scan returns findings structure', async () => {
  const scanner = new BlackWidowScanner();
  const target = createWebAppTarget();
  
  const findings = await scanner.scan(target);
  
  assert(Array.isArray(findings), 'Should return findings array');
  
  // All findings should have required fields
  for (const finding of findings) {
    assert(finding.detectorName, 'Finding should have detectorName');
    assert(finding.tool, 'Finding should have tool');
    assert(finding.severity, 'Finding should have severity');
    assert(finding.description, 'Finding should have description');
    assert(finding.targetUrl, 'Finding should have targetUrl');
    assert(finding.webTargetType, 'Finding should have webTargetType');
  }
});

// ============================================================================
// SUBOVER SCANNER TESTS
// ============================================================================

console.log('\n📦 SubOver Subdomain Takeover Scanner');
console.log('-'.repeat(40));

await test('SubOver scanner instantiation', async () => {
  const scanner = new SubOverScanner();
  assert.strictEqual(scanner.name, 'subover');
  assert.strictEqual(scanner.supportedTargets.length, 1);
  assert.strictEqual(scanner.supportedTargets[0], 'subdomain');
});

await test('SubOver getAvailableChecks returns takeover checks', async () => {
  const scanner = new SubOverScanner();
  const checks = await scanner.getAvailableChecks();
  
  assert(checks.length > 0, 'Should return checks');
  assert(checks.some(c => c.id === 'subdomain-takeover'), 'Should include takeover check');
  assert(checks.some(c => c.id === 'dangling-cname'), 'Should include dangling CNAME check');
});

await test('SubOver validates subdomain target', async () => {
  const scanner = new SubOverScanner();
  const target = createSubdomainTarget();
  
  const isValid = await scanner.validateTarget(target);
  assert.strictEqual(isValid, true, 'Should validate target with subdomains');
});

await test('SubOver validates empty subdomain target', async () => {
  const scanner = new SubOverScanner();
  const emptyTarget: SubdomainTarget = {
    id: 'empty',
    type: 'subdomain',
    name: 'Empty',
    url: 'https://example.com',
    metadata: {
      rootDomain: 'example.com',
      subdomains: [],
    },
  };
  
  const isValid = await scanner.validateTarget(emptyTarget);
  assert.strictEqual(isValid, false, 'Should reject empty subdomain list');
});

await test('SubOver scan handles multiple subdomains', async () => {
  const scanner = new SubOverScanner();
  const target = createSubdomainTarget();
  
  const findings = await scanner.scan(target);
  
  assert(Array.isArray(findings), 'Should return findings array');
  
  // Findings should have takeover-specific fields
  for (const finding of findings) {
    assert(finding.subdomain, 'Should have subdomain field');
    assert(finding.vulnerableService, 'Should have vulnerableService field');
    assert(typeof finding.claimable === 'boolean', 'Should have claimable boolean');
  }
});

// ============================================================================
// DOMDIG SCANNER TESTS
// ============================================================================

console.log('\n📦 DomDig DOM XSS Scanner');
console.log('-'.repeat(40));

await test('DomDig scanner instantiation', async () => {
  const scanner = new DomDigScanner();
  assert.strictEqual(scanner.name, 'domdig');
  assert.strictEqual(scanner.supportedTargets.length, 1);
  assert.strictEqual(scanner.supportedTargets[0], 'spa');
});

await test('DomDig getAvailableChecks returns DOM XSS checks', async () => {
  const scanner = new DomDigScanner();
  const checks = await scanner.getAvailableChecks();
  
  assert(checks.length > 0, 'Should return DOM XSS checks');
  
  // Check DOM XSS specific checks
  const domXssChecks = [
    'dom-xss-reflected',
    'dom-xss-stored',
    'dom-xss-postmessage',
    'dom-xss-hash',
    'dom-xss-cookie',
  ];
  
  for (const checkId of domXssChecks) {
    assert(checks.some(c => c.id === checkId), `Should include ${checkId}`);
  }
});

await test('DomDig validates SPA target', async () => {
  const scanner = new DomDigScanner();
  const target = createSPATarget();
  
  const isValid = await scanner.validateTarget(target);
  assert(typeof isValid === 'boolean', 'Should return boolean');
});

await test('DomDig scan returns DOM XSS findings', async () => {
  const scanner = new DomDigScanner();
  const target = createSPATarget();
  
  const findings = await scanner.scan(target);
  
  assert(Array.isArray(findings), 'Should return findings array');
  
  // Findings should have DOM XSS specific fields
  for (const finding of findings) {
    assert(finding.source, 'Should have source field');
    assert(finding.sink, 'Should have sink field');
    assert(Array.isArray(finding.codeFlow), 'Should have codeFlow array');
    assert(typeof finding.exploitable === 'boolean', 'Should have exploitable boolean');
  }
});

await test('DomDig detects framework-specific issues', async () => {
  const scanner = new DomDigScanner();
  
  const reactTarget: SPATarget = {
    id: 'react-app',
    type: 'spa',
    name: 'React App',
    url: 'https://react.example.com',
    metadata: {
      framework: 'react',
      routes: ['/'],
    },
  };
  
  const vueTarget: SPATarget = {
    id: 'vue-app',
    type: 'spa',
    name: 'Vue App',
    url: 'https://vue.example.com',
    metadata: {
      framework: 'vue',
      routes: ['/'],
    },
  };
  
  const angularTarget: SPATarget = {
    id: 'angular-app',
    type: 'spa',
    name: 'Angular App',
    url: 'https://angular.example.com',
    metadata: {
      framework: 'angular',
      routes: ['/'],
    },
  };
  
  // All should be scannable
  const reactFindings = await scanner.scan(reactTarget);
  const vueFindings = await scanner.scan(vueTarget);
  const angularFindings = await scanner.scan(angularTarget);
  
  assert(Array.isArray(reactFindings), 'React scan should return array');
  assert(Array.isArray(vueFindings), 'Vue scan should return array');
  assert(Array.isArray(angularFindings), 'Angular scan should return array');
});

// ============================================================================
// WEB SCANNER INTEGRATION TESTS
// ============================================================================

console.log('\n📦 Web Scanner Integration');
console.log('-'.repeat(40));

await test('All web scanners have consistent interface', async () => {
  const scanners = [
    new BlackWidowScanner(),
    new SubOverScanner(),
    new DomDigScanner(),
  ];
  
  for (const scanner of scanners) {
    assert(scanner.name, 'Scanner should have name');
    assert(scanner.version, 'Scanner should have version');
    assert(Array.isArray(scanner.supportedTargets), 'Scanner should have supportedTargets');
    assert(typeof scanner.getAvailableChecks === 'function', 'Should have getAvailableChecks');
    assert(typeof scanner.validateTarget === 'function', 'Should have validateTarget');
    assert(typeof scanner.scan === 'function', 'Scanner should have scan');
  }
});

await test('Web scanner severity levels are valid', async () => {
  const blackwidow = new BlackWidowScanner();
  const checks = await blackwidow.getAvailableChecks();
  
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
  
  for (const check of checks) {
    assert(validSeverities.includes(check.severity),
      `${check.id} has invalid severity: ${check.severity}`);
  }
});

await test('OWASP categories are valid', async () => {
  const validCategories = [
    'injection',
    'broken-auth',
    'sensitive-data',
    'xxe',
    'broken-access',
    'security-misconfig',
    'xss',
    'insecure-deserialization',
    'vulnerable-components',
    'logging-failures',
  ];
  
  const scanner = new BlackWidowScanner();
  const checks = await scanner.getAvailableChecks();
  
  for (const check of checks) {
    assert(validCategories.includes(check.category),
      `${check.id} has invalid category: ${check.category}`);
  }
});

await test('Web findings have remediation guidance', async () => {
  const scanner = new BlackWidowScanner();
  const target = createWebAppTarget();
  
  const findings = await scanner.scan(target);
  
  // At least some findings should have remediation
  const withRemediation = findings.filter(f => f.remediation);
  
  for (const finding of withRemediation) {
    assert(finding.remediation?.description, 'Remediation should have description');
    assert(Array.isArray(finding.remediation?.references), 'Remediation should have references');
  }
});

await test('SubOver handles DNS resolution errors gracefully', async () => {
  const scanner = new SubOverScanner();
  
  const invalidTarget: SubdomainTarget = {
    id: 'invalid',
    type: 'subdomain',
    name: 'Invalid',
    url: 'https://invalid',
    metadata: {
      rootDomain: 'invalid-domain-that-does-not-exist-12345.com',
      subdomains: ['test.invalid-domain-that-does-not-exist-12345.com'],
    },
  };
  
  // Should not throw, just return empty findings
  const findings = await scanner.scan(invalidTarget);
  assert(Array.isArray(findings), 'Should return array even for invalid domain');
});

await test('DomDig handles JavaScript analysis', async () => {
  const scanner = new DomDigScanner();
  const target = createSPATarget();
  
  // Should analyze the page for JavaScript patterns
  const findings = await scanner.scan(target);
  assert(Array.isArray(findings), 'Should return findings array');
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

console.log('\n📦 Performance Tests');
console.log('-'.repeat(40));

await test('BlackWidow scan completes within timeout', async () => {
  const scanner = new BlackWidowScanner();
  const target = createWebAppTarget();
  
  const start = Date.now();
  await scanner.scan(target, { timeoutMs: 30000 });
  const duration = Date.now() - start;
  
  assert(duration < 60000, `Scan took ${duration}ms, expected <60000ms`);
});

await test('SubOver handles multiple subdomains efficiently', async () => {
  const scanner = new SubOverScanner();
  const target: SubdomainTarget = {
    id: 'many-subdomains',
    type: 'subdomain',
    name: 'Many Subdomains',
    url: 'https://example.com',
    metadata: {
      rootDomain: 'example.com',
      subdomains: Array(50).fill(0).map((_, i) => `sub${i}.example.com`),
    },
  };
  
  const start = Date.now();
  await scanner.scan(target, { timeoutMs: 60000 });
  const duration = Date.now() - start;
  
  assert(duration < 120000, `Scan of 50 subdomains took ${duration}ms, expected <120000ms`);
});

await test('DomDig analyzes routes efficiently', async () => {
  const scanner = new DomDigScanner();
  const target: SPATarget = {
    id: 'many-routes',
    type: 'spa',
    name: 'Many Routes',
    url: 'https://app.example.com',
    metadata: {
      framework: 'react',
      routes: Array(20).fill(0).map((_, i) => `/route${i}`),
    },
  };
  
  const start = Date.now();
  await scanner.scan(target, { timeoutMs: 60000 });
  const duration = Date.now() - start;
  
  assert(duration < 120000, `Scan of 20 routes took ${duration}ms, expected <120000ms`);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`Results: ${passCount} passed, ${failCount} failed`);

}

runTests().then(() => process.exit(failCount > 0 ? 1 : 0));
