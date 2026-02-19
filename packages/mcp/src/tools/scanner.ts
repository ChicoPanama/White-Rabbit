// ═══════════════════════════════════════════════════════════════════════════════
// MCP Scanner Tools
// Three tools for White-Rabbit integration:
// 1. wc_scan_contract - Scan a deployed contract
// 2. wc_analyze_source - Analyze source code directly
// 3. wc_verify_finding - Verify a finding with AI
// ═══════════════════════════════════════════════════════════════════════════════

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Tool, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { WhiteRabbit, PatternEngine, Finding, VerifiedFinding } from '@whiteclaws/white-rabbit';

let scanner: WhiteRabbit | null = null;

function getScanner(): WhiteRabbit {
  if (!scanner) {
    scanner = new WhiteRabbit({
      etherscanApiKey: process.env.ETHERSCAN_API_KEY,
      whiteclawsApiKey: process.env.WHITECLAWS_API_KEY,
    });
  }
  return scanner;
}

export function registerScannerTools(tools: Tool[], server: Server): void {
  // ═══════════════════════════════════════════════════════════════════════════
  // Tool 1: wc_scan_contract
  // ═══════════════════════════════════════════════════════════════════════════
  tools.push({
    name: 'wc_scan_contract',
    description: `Scan a deployed smart contract for security vulnerabilities.
    
This tool analyzes a contract at a specific address on a blockchain.
It uses multiple analysis engines (Slither, Pattern matching, etc.) to detect issues.

Parameters:
- address: The contract address (0x...)
- chain: Chain name (ethereum, base, arbitrum, optimism, polygon, bsc, avalanche, etc.)
- quick: If true, uses only Pattern engine (faster). If false, uses all available engines.
- min_severity: Minimum severity to report (critical, high, medium, low, informational)

Returns: List of findings with severity, confidence, description, and code location.`,
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Contract address (0x...)',
        },
        chain: {
          type: 'string',
          description: 'Chain name (ethereum, base, arbitrum, optimism, polygon)',
          default: 'ethereum',
        },
        quick: {
          type: 'boolean',
          description: 'Quick scan (Pattern only) vs full scan (all engines)',
          default: true,
        },
        min_severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'informational'],
          description: 'Minimum severity level to report',
          default: 'low',
        },
      },
      required: ['address'],
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Tool 2: wc_analyze_source
  // ═══════════════════════════════════════════════════════════════════════════
  tools.push({
    name: 'wc_analyze_source',
    description: `Analyze smart contract source code directly without on-chain lookup.
    
This tool is useful when you have the source code but not the deployed address,
or when you want to analyze code before deployment.

Parameters:
- source_code: The Solidity source code to analyze
- compiler_version: Solidity compiler version (e.g., "0.8.19")
- contract_name: Name of the contract (optional)

Returns: List of findings from pattern analysis.`,
    inputSchema: {
      type: 'object',
      properties: {
        source_code: {
          type: 'string',
          description: 'Solidity source code',
        },
        compiler_version: {
          type: 'string',
          description: 'Solidity compiler version (e.g., 0.8.19)',
          default: '0.8.19',
        },
        contract_name: {
          type: 'string',
          description: 'Contract name (optional)',
          default: 'Contract',
        },
      },
      required: ['source_code'],
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Tool 3: wc_verify_finding
  // ═══════════════════════════════════════════════════════════════════════════
  tools.push({
    name: 'wc_verify_finding',
    description: `Verify and assess a specific security finding with additional context.
    
This tool helps determine if a finding is a true positive or false positive
by analyzing the code context and contract purpose.

Parameters:
- finding: The finding object from a previous scan
- context: Additional context about the contract (e.g., "This is a lending protocol...")
- code_snippet: The relevant code snippet for analysis

Returns: Assessment of whether the finding is exploitable, with confidence score.`,
    inputSchema: {
      type: 'object',
      properties: {
        detector_name: {
          type: 'string',
          description: 'Name of the detector that found the issue',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'informational'],
          description: 'Severity level',
        },
        code_snippet: {
          type: 'string',
          description: 'Code snippet containing the potential vulnerability',
        },
        context: {
          type: 'string',
          description: 'Additional context about the contract and its purpose',
        },
      },
      required: ['detector_name', 'code_snippet'],
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Handle tool calls
  // ═══════════════════════════════════════════════════════════════════════════
  server.setRequestHandler('tools/call' as any, async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'wc_scan_contract':
          return await handleScanContract(args);
        case 'wc_analyze_source':
          return await handleAnalyzeSource(args);
        case 'wc_verify_finding':
          return await handleVerifyFinding(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const content: TextContent[] = [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }];
      return { content, isError: true };
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Tool Handlers
// ═════════════════════════════════════════════════════════════════════════════

async function handleScanContract(args: any) {
  const address = args.address as string;
  const chain = (args.chain as string) || 'ethereum';
  const quick = (args.quick as boolean) ?? true;
  const minSeverity = (args.min_severity as string) || 'low';

  // Validate address
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const scanOptions = {
    chain,
    deep: !quick,
    minSeverity: minSeverity as any,
  };

  // Note: This requires ETHERSCAN_API_KEY to resolve contracts
  // For MCP use, we might want to cache or use whiteclaws API
  const findings = await getScanner().scan(address, scanOptions);

  // Filter by severity
  const severityOrder: Record<string, number> = {
    critical: 4, high: 3, medium: 2, low: 1, informational: 0,
  };
  const minLevel = severityOrder[minSeverity] || 0;
  const filtered = findings.filter(f => severityOrder[f.severity] >= minLevel);

  const content: TextContent[] = [{
    type: 'text',
    text: formatFindings(filtered, address, chain),
  }];

  return { content };
}

async function handleAnalyzeSource(args: any) {
  const sourceCode = args.source_code as string;
  const compilerVersion = (args.compiler_version as string) || '0.8.19';
  const contractName = (args.contract_name as string) || 'Contract';

  const engine = new PatternEngine();
  const result = await engine.analyze({
    id: 'mcp-analysis',
    address: '0x0000000000000000000000000000000000000000',
    chainId: 1,
    name: contractName,
    sourceCode,
    abi: [],
    compilerVersion,
    isProxy: false,
    implementationAddress: null,
    tvlUsd: null,
    protocolName: null,
  });

  if (!result.success) {
    throw new Error(`Analysis failed: ${result.errors.join(', ')}`);
  }

  const content: TextContent[] = [{
    type: 'text',
    text: formatSourceFindings(result.findings),
  }];

  return { content };
}

async function handleVerifyFinding(args: any) {
  const detectorName = args.detector_name as string;
  const codeSnippet = args.code_snippet as string;
  const context = (args.context as string) || '';
  const severity = (args.severity as string) || 'medium';

  // Simple heuristic-based verification
  // In production, this would use Claude or other AI for assessment
  const verification = verifyFindingHeuristic(detectorName, codeSnippet, context);

  const content: TextContent[] = [{
    type: 'text',
    text: `## Finding Verification

**Detector:** ${detectorName}
**Original Severity:** ${severity}

### Code Analyzed
\`\`\`solidity
${codeSnippet}
\`\`\`

### Assessment
**Verdict:** ${verification.isExploitable ? '⚠️ LIKELY EXPLOITABLE' : '✅ LIKELY FALSE POSITIVE'}
**Confidence:** ${verification.confidence}%
**Adjusted Severity:** ${verification.adjustedSeverity}

### Reasoning
${verification.reasoning}

### Recommendations
${verification.recommendations.map(r => `- ${r}`).join('\n') || '- No specific recommendations'}
`,
  }];

  return { content };
}

// ═════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═════════════════════════════════════════════════════════════════════════════

function formatFindings(findings: VerifiedFinding[], address: string, chain: string): string {
  if (findings.length === 0) {
    return `✅ No security issues found for ${address} on ${chain}`;
  }

  const bySeverity: Record<string, VerifiedFinding[]> = {};
  for (const f of findings) {
    bySeverity[f.severity] = bySeverity[f.severity] || [];
    bySeverity[f.severity].push(f);
  }

  let output = `# Security Scan Results\n\n`;
  output += `**Contract:** \`${address}\`\n`;
  output += `**Chain:** ${chain}\n`;
  output += `**Total Findings:** ${findings.length}\n\n`;

  const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];
  const icons: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    informational: '⚪',
  };

  for (const sev of severityOrder) {
    const group = bySeverity[sev];
    if (!group || group.length === 0) continue;

    output += `## ${icons[sev]} ${sev.toUpperCase()} (${group.length})\n\n`;

    for (const f of group) {
      output += `### ${f.title}\n`;
      output += `- **Tool:** ${f.tool}\n`;
      output += `- **Confidence:** ${f.confidence}`;
      if (f.corroboratedBy && f.corroboratedBy.length > 1) {
        output += ` (confirmed by ${f.corroboratedBy.length} tools)`;
      }
      output += '\n';
      if (f.filePath) {
        output += `- **Location:** ${f.filePath}:${f.lineStart}${f.lineEnd && f.lineEnd !== f.lineStart ? `-${f.lineEnd}` : ''}\n`;
      }
      output += `- **Description:** ${f.description}\n`;
      if (f.codeSnippet) {
        output += `- **Code:** \`${f.codeSnippet.slice(0, 100)}${f.codeSnippet.length > 100 ? '...' : ''}\`\n`;
      }
      output += '\n';
    }
  }

  return output;
}

function formatSourceFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return '✅ No security issues found in source code';
  }

  let output = `# Source Code Analysis Results\n\n`;
  output += `**Total Findings:** ${findings.length}\n\n`;

  const bySeverity: Record<string, Finding[]> = {};
  for (const f of findings) {
    bySeverity[f.severity] = bySeverity[f.severity] || [];
    bySeverity[f.severity].push(f);
  }

  const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];
  const icons: Record<string, string> = {
    critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', informational: '⚪',
  };

  for (const sev of severityOrder) {
    const group = bySeverity[sev];
    if (!group || group.length === 0) continue;

    output += `## ${icons[sev]} ${sev.toUpperCase()} (${group.length})\n\n`;

    for (const f of group) {
      output += `### ${f.title}\n`;
      output += `- **Confidence:** ${f.confidence}\n`;
      if (f.lineStart) {
        output += `- **Line:** ${f.lineStart}\n`;
      }
      output += `- **Description:** ${f.description}\n`;
      if (f.codeSnippet) {
        output += `\n\`\`\`solidity\n${f.codeSnippet}\n\`\`\`\n`;
      }
      output += '\n';
    }
  }

  return output;
}

interface VerificationResult {
  isExploitable: boolean;
  confidence: number;
  adjustedSeverity: string;
  reasoning: string;
  recommendations: string[];
}

function verifyFindingHeuristic(
  detectorName: string,
  codeSnippet: string,
  context: string
): VerificationResult {
  const lowerCode = codeSnippet.toLowerCase();
  const lowerContext = context.toLowerCase();

  // Reentrancy checks
  if (detectorName.includes('reentrancy')) {
    const hasGuard = /reentrancyguard|nonreentrant/.test(lowerCode);
    const hasChecksEffects = /balances\[.*\] = 0|balances\[.*\] -=/.test(lowerCode);
    
    if (hasGuard) {
      return {
        isExploitable: false,
        confidence: 85,
        adjustedSeverity: 'low',
        reasoning: 'Contract uses ReentrancyGuard or nonReentrant modifier, which provides protection against reentrancy attacks.',
        recommendations: ['Verify the modifier is applied to all external functions that transfer value'],
      };
    }
    
    if (hasChecksEffects) {
      return {
        isExploitable: false,
        confidence: 70,
        adjustedSeverity: 'low',
        reasoning: 'Contract appears to follow checks-effects-interactions pattern, updating state before external calls.',
        recommendations: ['Verify all state changes occur before external calls'],
      };
    }
  }

  // tx.origin checks
  if (detectorName.includes('tx.origin')) {
    const isAuthCheck = /owner|admin|only/.test(lowerContext) || /owner|admin/.test(lowerCode);
    
    return {
      isExploitable: isAuthCheck,
      confidence: isAuthCheck ? 80 : 60,
      adjustedSeverity: isAuthCheck ? 'high' : 'medium',
      reasoning: isAuthCheck
        ? 'Using tx.origin for authorization is dangerous as it can be exploited through phishing attacks.'
        : 'tx.origin usage detected but context suggests it may not be for authorization.',
      recommendations: [
        'Replace tx.origin with msg.sender for authorization',
        'If used for other purposes, verify it cannot be exploited',
      ],
    };
  }

  // Default verification
  return {
    isExploitable: true,
    confidence: 50,
    adjustedSeverity: 'medium',
    reasoning: 'Unable to automatically verify this finding. Manual review recommended.',
    recommendations: ['Perform manual code review', 'Consider creating a test case'],
  };
}
