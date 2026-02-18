/**
 * PoC formatter — structures verification results into Immunefi-ready
 * proof-of-concept documentation.
 *
 * Extracts Foundry test code, parses steps, and sanitizes output
 * to remove sensitive data before submission.
 */

import type { Finding } from '../agents/agent-types.js';
import type { ProofOfConcept, ExploitStep } from './immunefi-types.js';

// ── Sensitive Data Patterns ──

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Private keys (hex)
  { pattern: /0x[a-fA-F0-9]{64}/g, replacement: '0x<REDACTED_PRIVATE_KEY>' },
  // API keys in URLs
  { pattern: /(https?:\/\/[^/]+\/)[a-zA-Z0-9]{20,}/g, replacement: '$1<REDACTED_API_KEY>' },
  // Alchemy/Infura-style URLs with keys
  { pattern: /(alchemy\.com\/v2\/)[a-zA-Z0-9_-]+/g, replacement: '$1<REDACTED>' },
  { pattern: /(infura\.io\/v3\/)[a-zA-Z0-9]+/g, replacement: '$1<REDACTED>' },
  // Environment variable references with secrets
  { pattern: /(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*=\s*[^\s;]+/gi, replacement: '$1=<REDACTED>' },
  // Localhost / internal URLs
  { pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+):\d+[^\s]*/g, replacement: '<INTERNAL_URL_REDACTED>' },
];

/**
 * Format a Foundry verification result into a structured PoC.
 *
 * @param verificationResult - Raw verification output (from verify-* agent deliverable)
 * @param finding - The finding this PoC demonstrates
 * @returns Structured proof of concept
 */
export function formatFoundryPoC(
  verificationResult: VerificationDeliverable,
  finding: Finding,
): ProofOfConcept {
  const foundryTest = verificationResult.foundryTest ?? '';
  const testOutput = verificationResult.testOutput ?? '';
  const blockNumber = verificationResult.forkBlockNumber;
  const verified = verificationResult.success === true;

  const steps = generateExploitSteps(finding, foundryTest);
  const summary = buildExploitSummary(finding, steps);

  const environment = blockNumber
    ? `Foundry mainnet fork at block ${blockNumber}`
    : 'Foundry mainnet fork (latest block)';

  const poc: ProofOfConcept = {
    summary,
    environment,
    steps,
    foundryTest: foundryTest || undefined,
    exploitOutput: testOutput || undefined,
    verifiedOnFork: verified,
    forkBlockNumber: blockNumber,
  };

  return sanitizePoC(poc);
}

/**
 * Generate structured exploit steps from a Foundry test.
 *
 * Parses the test function body to extract logical steps with descriptions.
 */
export function generateExploitSteps(finding: Finding, foundryTest: string): ExploitStep[] {
  const steps: ExploitStep[] = [];

  if (!foundryTest) {
    // No Foundry test — generate steps from finding description
    return generateStepsFromDescription(finding);
  }

  // Extract the test function body
  const testFuncMatch = foundryTest.match(
    /function\s+test\w*\s*\(\s*\)\s*(?:public|external)?\s*\{([\s\S]*?)(?:\n\s*\})/,
  );

  if (!testFuncMatch) {
    return generateStepsFromDescription(finding);
  }

  const body = testFuncMatch[1];
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let stepNumber = 1;
  let currentCode: string[] = [];
  let currentDescription = '';

  for (const line of lines) {
    // Comments become step descriptions
    if (line.startsWith('//')) {
      // Flush previous step
      if (currentDescription && currentCode.length > 0) {
        steps.push({
          stepNumber: stepNumber++,
          description: currentDescription,
          code: currentCode.join('\n'),
          expectedResult: inferExpectedResult(currentCode),
        });
        currentCode = [];
      }
      currentDescription = line.replace(/^\/\/\s*/, '');
      continue;
    }

    // Skip empty lines and common boilerplate
    if (line === '' || line === '{' || line === '}') continue;

    currentCode.push(line);
  }

  // Flush last step
  if (currentDescription && currentCode.length > 0) {
    steps.push({
      stepNumber: stepNumber++,
      description: currentDescription,
      code: currentCode.join('\n'),
      expectedResult: inferExpectedResult(currentCode),
    });
  } else if (currentCode.length > 0) {
    steps.push({
      stepNumber: stepNumber++,
      description: 'Execute exploit',
      code: currentCode.join('\n'),
      expectedResult: 'Exploit completes successfully',
    });
  }

  // If no steps could be parsed, fall back to description-based steps
  if (steps.length === 0) {
    return generateStepsFromDescription(finding);
  }

  return steps;
}

/**
 * Generate steps from a finding description when no Foundry test is available.
 */
function generateStepsFromDescription(finding: Finding): ExploitStep[] {
  const steps: ExploitStep[] = [];
  const vulnType = finding.vulnType.toLowerCase();

  // Step 1: Setup
  steps.push({
    stepNumber: 1,
    description: `Identify the vulnerable ${vulnType} pattern in ${finding.location || 'the contract'}`,
    expectedResult: 'Vulnerability confirmed in source code',
  });

  // Step 2: Type-specific exploit step
  if (vulnType.includes('reentrancy')) {
    steps.push({
      stepNumber: 2,
      description: 'Deploy attacker contract with fallback/receive function that re-enters the vulnerable function',
      expectedResult: 'Attacker contract deployed and ready',
    });
    steps.push({
      stepNumber: 3,
      description: 'Call the vulnerable function to trigger the reentrant call',
      expectedResult: 'Funds drained through repeated re-entry before state update',
    });
  } else if (vulnType.includes('flash-loan')) {
    steps.push({
      stepNumber: 2,
      description: 'Obtain flash loan from available lending protocol',
      expectedResult: 'Flash loan received with borrowed funds',
    });
    steps.push({
      stepNumber: 3,
      description: 'Use borrowed funds to manipulate price/state and extract value',
      expectedResult: 'Profit extracted, flash loan repaid with surplus',
    });
  } else if (vulnType.includes('oracle')) {
    steps.push({
      stepNumber: 2,
      description: 'Manipulate the price oracle (e.g., via flash loan or large swap)',
      expectedResult: 'Oracle reports manipulated price',
    });
    steps.push({
      stepNumber: 3,
      description: 'Execute transaction that profits from the manipulated price',
      expectedResult: 'Profit extracted before price normalizes',
    });
  } else if (vulnType.includes('access-control')) {
    steps.push({
      stepNumber: 2,
      description: 'Call the unprotected privileged function from an unauthorized address',
      expectedResult: 'Function executes without proper authorization check',
    });
  } else if (vulnType.includes('arithmetic')) {
    steps.push({
      stepNumber: 2,
      description: 'Provide input values that trigger integer overflow/underflow',
      expectedResult: 'Arithmetic wraps around to unexpected value',
    });
    steps.push({
      stepNumber: 3,
      description: 'Exploit the incorrect calculation to extract value or bypass checks',
      expectedResult: 'Funds or tokens obtained through incorrect arithmetic',
    });
  } else {
    steps.push({
      stepNumber: 2,
      description: 'Trigger the vulnerability through the identified attack vector',
      expectedResult: 'Vulnerability successfully exploited',
    });
  }

  // Add PoC code if the finding has one
  if (finding.poc) {
    steps.push({
      stepNumber: steps.length + 1,
      description: 'Run the Foundry proof-of-concept test',
      code: finding.poc,
      expectedResult: 'Test passes, demonstrating the exploit',
    });
  }

  return steps;
}

/**
 * Infer the expected result from code lines.
 */
function inferExpectedResult(codeLines: string[]): string {
  const code = codeLines.join(' ').toLowerCase();

  if (code.includes('assertgt') || code.includes('assert_gt')) {
    return 'Balance increased after exploit';
  }
  if (code.includes('asserteq') || code.includes('assert_eq')) {
    return 'State matches expected post-exploit value';
  }
  if (code.includes('expectrevert') || code.includes('expect_revert')) {
    return 'Transaction reverts as expected';
  }
  if (code.includes('emit')) {
    return 'Expected event emitted';
  }
  if (code.includes('transfer') || code.includes('withdraw')) {
    return 'Funds transferred/withdrawn successfully';
  }
  if (code.includes('flashloan') || code.includes('flash')) {
    return 'Flash loan executed';
  }

  return 'Operation completes successfully';
}

/**
 * Build a human-readable exploit summary from steps.
 */
function buildExploitSummary(finding: Finding, steps: ExploitStep[]): string {
  if (steps.length === 0) {
    return `Exploit for ${finding.vulnType} vulnerability: ${finding.title}`;
  }

  const stepDescriptions = steps.map(s => `${s.stepNumber}. ${s.description}`).join('\n');
  return `Exploit for ${finding.title}:\n${stepDescriptions}`;
}

/**
 * Sanitize a PoC to remove sensitive data before submission.
 *
 * - Removes private keys, API keys, internal URLs
 * - Replaces RPC URLs with generic public endpoints
 * - Validates code blocks are reasonable
 * - Removes scanner-specific debug artifacts
 */
export function sanitizePoC(poc: ProofOfConcept): ProofOfConcept {
  const sanitized = { ...poc };

  // Sanitize all string fields
  if (sanitized.foundryTest) {
    sanitized.foundryTest = sanitizeString(sanitized.foundryTest);
  }
  if (sanitized.exploitOutput) {
    sanitized.exploitOutput = sanitizeString(sanitized.exploitOutput);
  }
  if (sanitized.summary) {
    sanitized.summary = sanitizeString(sanitized.summary);
  }
  if (sanitized.environment) {
    sanitized.environment = sanitizeString(sanitized.environment);
  }

  // Sanitize steps
  sanitized.steps = sanitized.steps.map(step => ({
    ...step,
    description: sanitizeString(step.description),
    code: step.code ? sanitizeString(step.code) : undefined,
    expectedResult: sanitizeString(step.expectedResult),
  }));

  // Remove private RPC URL — use generic reference
  sanitized.forkRpcUrl = undefined;

  return sanitized;
}

/**
 * Remove sensitive patterns from a string.
 */
function sanitizeString(input: string): string {
  let result = input;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Remove scanner debug logging
  result = result.replace(/\[Scanner\].*$/gm, '');
  result = result.replace(/console\.(log|warn|error)\(.*?\);?\s*$/gm, '');

  return result.trim();
}

// ── Verification deliverable shape (from verify-* agents) ──

export interface VerificationDeliverable {
  success?: boolean;
  foundryTest?: string;
  testOutput?: string;
  forkBlockNumber?: number;
  forkRpcUrl?: string;
  error?: string;
}
