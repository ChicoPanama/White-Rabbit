/**
 * Run All E2E Tests
 */

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const testFiles = readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.ts'));

console.log('Running E2E Test Suite');
console.log('='.repeat(60));
console.log(`Found ${testFiles.length} test files\n`);

let totalPassed = 0;
let totalFailed = 0;

for (const testFile of testFiles.sort()) {
  console.log(`\n📋 ${testFile}`);
  console.log('-'.repeat(40));
  
  let output = '';
  try {
    output = execSync(
      `npx tsx ${join(__dirname, testFile)}`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 }
    );
  } catch (error: any) {
    output = error.stdout || '';
  }
  
  // Parse results (support multiple formats)
  // Format 1: "Results: 14 passed, 0 failed"
  // Format 2: "Passed: 25 ✓"
  // Format 3: "passed: 13"
  // Format 4: "✅ 13 passed"
  const passMatch = output.match(/(\d+)\s*passed/i) || output.match(/Passed:\s*(\d+)/i);
  const failMatch = output.match(/(\d+)\s*failed/i) || output.match(/Failed:\s*(\d+)/i);
  
  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;
  
  totalPassed += passed;
  totalFailed += failed;
  
  if (failed === 0) {
    console.log(`  ✅ ${passed} passed`);
  } else {
    console.log(`  ✅ ${passed} passed, ❌ ${failed} failed`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 Final Results');
console.log(`   Total Passed: ${totalPassed}`);
console.log(`   Total Failed: ${totalFailed}`);
console.log(`   Success Rate: ${((totalPassed / (totalPassed + totalFailed || 1)) * 100).toFixed(1)}%`);

if (totalFailed === 0) {
  console.log('\n🎉 All tests passed!');
} else {
  console.log('\n⚠️  Some tests failed');
  process.exit(1);
}
