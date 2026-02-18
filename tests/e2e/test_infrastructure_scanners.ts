/**
 * E2E Tests for Infrastructure Security Scanners
 * 
 * Tests Kubescape, CloudSploit, and Nili scanners plus the infrastructure pipeline.
 */

import { strict as assert } from 'assert';
import {
  KubescapeScanner,
  CloudSploitScanner,
  NiliScanner,
  InfrastructureAnalysisPipeline,
  type KubernetesTarget,
  type AWSTarget,
  type NetworkTarget,
} from '../../src/infrastructure/index.js';

// Test constants
const E2E_TEST_TIMEOUT = 60000;

// Mock targets for testing
const createK8sTarget = (): KubernetesTarget => ({
  id: 'test-k8s-cluster',
  type: 'kubernetes',
  name: 'Test Kubernetes Cluster',
  metadata: {
    clusterName: 'test-cluster',
    version: '1.28.0',
    nodeCount: 3,
    podCount: 25,
  },
});

const createAWSTarget = (): AWSTarget => ({
  id: 'test-aws-account',
  type: 'aws',
  name: 'Test AWS Account',
  metadata: {
    accountId: '123456789012',
    regions: ['us-east-1', 'eu-west-1'],
    services: ['EC2', 'S3', 'RDS'],
  },
});

const createNetworkTarget = (): NetworkTarget => ({
  id: 'test-network',
  type: 'network',
  name: 'Test Network Target',
  metadata: {
    host: 'scanme.nmap.org',
    ports: [80, 443],
    protocol: 'tcp',
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
console.log('Infrastructure Security Scanners E2E Tests');
console.log('='.repeat(60));

async function runTests() {

// ============================================================================
// KUBESCAPE SCANNER TESTS
// ============================================================================

console.log('\n📦 Kubescape Scanner');
console.log('-'.repeat(40));

await test('Kubescape scanner instantiation', async () => {
  const scanner = new KubescapeScanner();
  assert.strictEqual(scanner.name, 'kubescape');
  assert.strictEqual(scanner.supportedTargets.length, 1);
  assert.strictEqual(scanner.supportedTargets[0], 'kubernetes');
});

await test('Kubescape getAvailableChecks returns controls', async () => {
  const scanner = new KubescapeScanner();
  const checks = await scanner.getAvailableChecks();
  
  assert(checks.length > 0, 'Should return control checks');
  assert(checks.some(c => c.id === 'C-0001'), 'Should include privileged container check');
  assert(checks.some(c => c.id === 'C-0015'), 'Should include secrets check');
  assert(checks.some(c => c.id === 'C-0063'), 'Should include anonymous access check');
});

await test('Kubescape checks have required fields', async () => {
  const scanner = new KubescapeScanner();
  const checks = await scanner.getAvailableChecks();
  
  for (const check of checks) {
    assert(check.id, 'Check should have ID');
    assert(check.name, 'Check should have name');
    assert(check.description, 'Check should have description');
    assert(check.severity, 'Check should have severity');
    assert(check.category, 'Check should have category');
  }
});

await test('Kubescape validates K8s target', async () => {
  const scanner = new KubescapeScanner();
  const target = createK8sTarget();
  
  // Will fail without actual cluster, but tests the method exists
  const isValid = await scanner.validateTarget(target);
  // Result depends on environment having kubectl configured
  assert(typeof isValid === 'boolean', 'Should return boolean');
});

await test('Kubescape includes NSA/CISA framework checks', async () => {
  const scanner = new KubescapeScanner();
  const checks = await scanner.getAvailableChecks();
  
  // Critical NSA/CISA controls
  const criticalControls = ['C-0001', 'C-0007', 'C-0014', 'C-0063', 'C-0066'];
  for (const control of criticalControls) {
    assert(checks.some(c => c.id === control), `Should include ${control}`);
  }
});

// ============================================================================
// CLOUDSPLOIT SCANNER TESTS
// ============================================================================

console.log('\n📦 CloudSploit Scanner');
console.log('-'.repeat(40));

await test('CloudSploit scanner instantiation', async () => {
  const scanner = new CloudSploitScanner();
  assert.strictEqual(scanner.name, 'cloudsploit');
  assert.strictEqual(scanner.supportedTargets.length, 1);
  assert.strictEqual(scanner.supportedTargets[0], 'aws');
});

await test('CloudSploit getAvailableChecks returns AWS checks', async () => {
  const scanner = new CloudSploitScanner();
  const checks = await scanner.getAvailableChecks();
  
  assert(checks.length > 0, 'Should return AWS checks');
  
  // Should include various AWS service checks
  const categories = [...new Set(checks.map(c => c.category))];
  assert(categories.includes('IAM'), 'Should include IAM checks');
  assert(categories.includes('S3'), 'Should include S3 checks');
  assert(categories.includes('EC2'), 'Should include EC2 checks');
});

await test('CloudSploit includes critical security checks', async () => {
  const scanner = new CloudSploitScanner();
  const checks = await scanner.getAvailableChecks();
  
  // Critical security checks
  const criticalChecks = [
    'iam-root-account-mfa',
    'iam-root-access-keys',
    's3-bucket-all-users-policy',
    'ec2-open-ssh',
    'ec2-open-rdp',
    'rds-publicly-accessible',
  ];
  
  for (const checkId of criticalChecks) {
    const found = checks.find(c => c.id === checkId);
    assert(found, `Should include ${checkId}`);
    assert(found.severity === 'critical' || found.severity === 'high', 
      `${checkId} should be critical/high severity`);
  }
});

await test('CloudSploit checks cover compliance frameworks', async () => {
  const scanner = new CloudSploitScanner();
  const checks = await scanner.getAvailableChecks();
  
  // Checks that map to compliance frameworks
  const complianceChecks = [
    'cloudtrail-enabled', // SOC2, PCI-DSS
    's3-bucket-encryption', // PCI-DSS
    'rds-encryption-enabled', // PCI-DSS
    'kms-key-rotation', // PCI-DSS
  ];
  
  for (const checkId of complianceChecks) {
    assert(checks.some(c => c.id === checkId), `Should include ${checkId}`);
  }
});

await test('CloudSploit validates AWS target', async () => {
  const scanner = new CloudSploitScanner();
  const target = createAWSTarget();
  
  const isValid = await scanner.validateTarget(target);
  assert(typeof isValid === 'boolean', 'Should return boolean');
});

// ============================================================================
// NILI NETWORK SCANNER TESTS
// ============================================================================

console.log('\n📦 Nili Network Scanner');
console.log('-'.repeat(40));

await test('Nili scanner instantiation', async () => {
  const scanner = new NiliScanner();
  assert.strictEqual(scanner.name, 'nili');
  assert.strictEqual(scanner.supportedTargets.length, 1);
  assert.strictEqual(scanner.supportedTargets[0], 'network');
});

await test('Nili getAvailableChecks returns network checks', async () => {
  const scanner = new NiliScanner();
  const checks = await scanner.getAvailableChecks();
  
  assert(checks.length > 0, 'Should return network checks');
  
  // Check categories
  const categories = [...new Set(checks.map(c => c.category))];
  assert(categories.includes('port-scanning'), 'Should include port scanning');
  assert(categories.includes('ssl-tls'), 'Should include SSL/TLS checks');
});

await test('Nili includes SSL/TLS vulnerability checks', async () => {
  const scanner = new NiliScanner();
  const checks = await scanner.getAvailableChecks();
  
  // SSL/TLS vulnerability checks
  const sslChecks = [
    'nili-ssl-expired',
    'nili-ssl-self-signed',
    'nili-ssl-weak-cipher',
    'nili-ssl-old-protocol',
    'nili-ssl-heartbleed',
    'nili-ssl-poodle',
  ];
  
  for (const checkId of sslChecks) {
    assert(checks.some(c => c.id === checkId), `Should include ${checkId}`);
  }
});

await test('Nili validates network target', async () => {
  const scanner = new NiliScanner();
  const target = createNetworkTarget();
  
  const isValid = await scanner.validateTarget(target);
  assert(typeof isValid === 'boolean', 'Should return boolean');
});

await test('Nili detects sensitive ports', async () => {
  const scanner = new NiliScanner();
  const checks = await scanner.getAvailableChecks();
  
  const sensitivePortCheck = checks.find(c => c.id === 'nili-port-sensitive');
  assert(sensitivePortCheck, 'Should have sensitive port check');
  assert.strictEqual(sensitivePortCheck.severity, 'high');
});

await test('Nili detects cleartext protocols', async () => {
  const scanner = new NiliScanner();
  const checks = await scanner.getAvailableChecks();
  
  const cleartextCheck = checks.find(c => c.id === 'nili-protocol-cleartext');
  assert(cleartextCheck, 'Should have cleartext protocol check');
});

// ============================================================================
// INFRASTRUCTURE PIPELINE TESTS
// ============================================================================

console.log('\n📦 Infrastructure Analysis Pipeline');
console.log('-'.repeat(40));

await test('Pipeline instantiation', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  assert(pipeline, 'Pipeline should be instantiated');
});

await test('Pipeline with custom config', async () => {
  const pipeline = new InfrastructureAnalysisPipeline({
    enabledScanners: ['kubescape', 'nili'],
    alerting: { minSeverity: 'high', channels: ['email'] },
  });
  
  assert.strictEqual(pipeline['config'].enabledScanners.length, 2);
  assert(pipeline['config'].enabledScanners.includes('kubescape'));
});

await test('Pipeline selects correct scanners for K8s target', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  const target = createK8sTarget();
  
  const scanners = (pipeline as any).selectScanners(target);
  
  assert(scanners.length > 0, 'Should select scanners for K8s');
  assert(scanners.some((s: any) => s.name === 'kubescape'), 'Should include Kubescape');
});

await test('Pipeline selects correct scanners for AWS target', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  const target = createAWSTarget();
  
  const scanners = (pipeline as any).selectScanners(target);
  
  assert(scanners.length > 0, 'Should select scanners for AWS');
  assert(scanners.some((s: any) => s.name === 'cloudsploit'), 'Should include CloudSploit');
});

await test('Pipeline selects correct scanners for network target', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  const target = createNetworkTarget();
  
  const scanners = (pipeline as any).selectScanners(target);
  
  assert(scanners.length > 0, 'Should select scanners for network');
  assert(scanners.some((s: any) => s.name === 'nili'), 'Should include Nili');
});

await test('Pipeline filters findings by severity', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  const findings = [
    { detectorName: 'test-1', severity: 'critical', description: 'Critical issue' },
    { detectorName: 'test-2', severity: 'high', description: 'High issue' },
    { detectorName: 'test-3', severity: 'medium', description: 'Medium issue' },
    { detectorName: 'test-4', severity: 'low', description: 'Low issue' },
  ] as any;
  
  const filtered = pipeline.filterFindings(findings, 'high');
  
  assert.strictEqual(filtered.length, 2, 'Should filter to critical and high');
  assert(filtered.every(f => f.severity === 'critical' || f.severity === 'high'));
});

await test('Pipeline groups findings by resource', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  const findings = [
    { detectorName: 'test-1', severity: 'high', resource: { type: 'pod', name: 'app-1' } },
    { detectorName: 'test-2', severity: 'medium', resource: { type: 'pod', name: 'app-2' } },
    { detectorName: 'test-3', severity: 'high', resource: { type: 'service', name: 'svc-1' } },
    { detectorName: 'test-4', severity: 'low' }, // No resource
  ] as any;
  
  const grouped = pipeline.groupByResource(findings);
  
  assert('pod' in grouped, 'Should have pod group');
  assert('service' in grouped, 'Should have service group');
  assert('unknown' in grouped, 'Should have unknown group for findings without resource');
});

await test('Pipeline calculates summary correctly', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  const findings = [
    { severity: 'critical' },
    { severity: 'critical' },
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'medium' },
    { severity: 'medium' },
    { severity: 'low' },
    { severity: 'informational' },
  ] as any;
  
  const summary = (pipeline as any).calculateSummary(findings);
  
  assert.strictEqual(summary.total, 8);
  assert.strictEqual(summary.critical, 2);
  assert.strictEqual(summary.high, 1);
  assert.strictEqual(summary.medium, 3);
  assert.strictEqual(summary.low, 1);
  assert.strictEqual(summary.info, 1);
});

await test('Pipeline getAvailableChecks returns all scanner checks', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  const checks = await pipeline.getAvailableChecks();
  
  assert('kubescape' in checks, 'Should include Kubescape checks');
  assert('cloudsploit' in checks, 'Should include CloudSploit checks');
  assert('nili' in checks, 'Should include Nili checks');
  
  assert(checks.kubescape.length > 0, 'Kubescape should have checks');
  assert(checks.cloudsploit.length > 0, 'CloudSploit should have checks');
  assert(checks.nili.length > 0, 'Nili should have checks');
});

await test('Pipeline respects disabled scanners', async () => {
  const pipeline = new InfrastructureAnalysisPipeline({
    enabledScanners: ['kubescape'], // Only enable Kubescape
  });
  
  const checks = await pipeline.getAvailableChecks();
  
  assert('kubescape' in checks, 'Should include Kubescape');
  assert(!('cloudsploit' in checks), 'Should not include CloudSploit');
  assert(!('nili' in checks), 'Should not include Nili');
});

await test('Pipeline deduplicates findings', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  const findings = [
    { detectorName: 'test-1', tool: 'scanner-a', severity: 'high', description: 'Issue 1', targetId: 't1' },
    { detectorName: 'test-1', tool: 'scanner-a', severity: 'high', description: 'Issue 1', targetId: 't1' }, // Duplicate
    { detectorName: 'test-2', tool: 'scanner-b', severity: 'medium', description: 'Issue 2', targetId: 't1' },
  ] as any;
  
  const deduplicated = (pipeline as any).deduplicateFindings(findings);
  
  assert.strictEqual(deduplicated.length, 2, 'Should remove duplicate');
});

// ============================================================================
// COMPLIANCE MAPPING TESTS
// ============================================================================

console.log('\n📦 Compliance Mapping');
console.log('-'.repeat(40));

await test('Pipeline groups findings by compliance framework', async () => {
  const pipeline = new InfrastructureAnalysisPipeline();
  
  // Create findings with compliance-related check IDs
  const findings = [
    { detectorName: 'kubescape-C-0001', tool: 'kubescape', framework: { checkId: 'C-0001' } },
    { detectorName: 'kubescape-C-0007', tool: 'kubescape', framework: { checkId: 'C-0007' } },
    { detectorName: 'cloudsploit-s3-bucket-encryption', tool: 'cloudsploit', framework: { checkId: 's3-bucket-encryption' } },
    { detectorName: 'cloudsploit-cloudtrail-enabled', tool: 'cloudsploit', framework: { checkId: 'cloudtrail-enabled' } },
  ] as any;
  
  const grouped = pipeline.groupByCompliance(findings);
  
  assert('nsa-cisa' in grouped, 'Should have NSA/CISA group');
  assert('cis' in grouped, 'Should have CIS group');
  assert('soc2' in grouped, 'Should have SOC2 group');
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

console.log('\n📦 Integration Tests');
console.log('-'.repeat(40));

await test('All scanners have consistent interface', async () => {
  const kubescape = new KubescapeScanner();
  const cloudsploit = new CloudSploitScanner();
  const nili = new NiliScanner();
  
  const scanners = [kubescape, cloudsploit, nili];
  
  for (const scanner of scanners) {
    assert(scanner.name, 'Scanner should have name');
    assert(scanner.version, 'Scanner should have version');
    assert(Array.isArray(scanner.supportedTargets), 'Scanner should have supportedTargets');
    assert(typeof scanner.getAvailableChecks === 'function', 'Scanner should have getAvailableChecks');
    assert(typeof scanner.validateTarget === 'function', 'Scanner should have validateTarget');
    assert(typeof scanner.scan === 'function', 'Scanner should have scan');
  }
});

await test('Scanner severity levels are valid', async () => {
  const kubescape = new KubescapeScanner();
  const checks = await kubescape.getAvailableChecks();
  
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
  
  for (const check of checks) {
    assert(validSeverities.includes(check.severity), 
      `${check.id} has invalid severity: ${check.severity}`);
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`Results: ${passCount} passed, ${failCount} failed`);

}

runTests().then(() => process.exit(failCount > 0 ? 1 : 0));
