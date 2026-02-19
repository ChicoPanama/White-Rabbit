# API Reference

Complete API documentation for @whiteclaws/white-rabbit

## Table of Contents

- [WhiteRabbit](#whiterabbit) - Main scanner class
- [AnalysisPipeline](#analysispipeline) - Multi-engine orchestrator
- [PatternEngine](#patternengine) - Pattern-based detection
- [ContractResolver](#contractresolver) - Input parsing
- [Connectors](#connectors) - External data sources
- [Types](#types) - TypeScript interfaces

---

## WhiteRabbit

Main entry point for contract scanning.

### Constructor

```typescript
constructor(config?: Partial<WhiteRabbitConfig>)
```

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| config | `Partial<WhiteRabbitConfig>` | `{}` | Scanner configuration |

**Config Options:**

```typescript
interface WhiteRabbitConfig {
  engines: {
    pattern?: boolean;      // Pattern-based detection
    slither?: boolean;      // Slither integration
    mythril?: boolean;      // Mythril symbolic execution
    securify?: boolean;     // Securify analyzer
    maian?: boolean;        // Maian detector
  };
  defaultDepth: 'quick' | 'standard' | 'deep';
  timeout: number;          // Analysis timeout in ms
}
```

### Methods

#### scan()

Scan a deployed contract by address.

```typescript
async scan(options: ScanOptions): Promise<ScanResult>
```

**Parameters:**

```typescript
interface ScanOptions {
  address: string;           // Contract address
  chainId?: number;          // Chain ID (default: 1)
  depth?: 'quick' | 'standard' | 'deep';
  includeAiAnalysis?: boolean;
}
```

**Returns:** `ScanResult`

```typescript
interface ScanResult {
  scanId: string;
  status: 'completed' | 'failed';
  contract: Contract;
  summary: ScanSummary;
  findings: Finding[];
  aiAnalysis?: AiAssessment;
}
```

**Example:**

```typescript
import { WhiteRabbit } from '@whiteclaws/white-rabbit';

const scanner = new WhiteRabbit();

const result = await scanner.scan({
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  chainId: 1,
  depth: 'standard',
});

console.log(`Found ${result.findings.length} issues`);
```

#### analyzeSource()

Analyze local Solidity source code.

```typescript
async analyzeSource(options: SourceAnalysisOptions): Promise<SourceAnalysisResult>
```

**Parameters:**

```typescript
interface SourceAnalysisOptions {
  sourceCode: string;        // Solidity source
  filename?: string;         // Optional filename
  compilerVersion?: string;  // e.g., '0.8.19'
}
```

**Example:**

```typescript
const result = await scanner.analyzeSource({
  sourceCode: fs.readFileSync('contract.sol', 'utf-8'),
  filename: 'MyContract.sol',
  compilerVersion: '0.8.19',
});
```

#### quickCheck()

Fast vulnerability check for a contract.

```typescript
async quickCheck(address: string, chainId?: number): Promise<QuickCheckResult>
```

**Returns:**

```typescript
interface QuickCheckResult {
  hasVulnerabilities: boolean;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  riskScore: number;         // 0-100
  recommendedAction: string;
}
```

#### checkEngines()

Check which analysis engines are available.

```typescript
async checkEngines(): Promise<Record<string, boolean>>
```

**Returns:**

```typescript
{
  pattern: true,    // Always available
  slither: false,   // Requires installation
  mythril: false,
  // ...
}
```

---

## AnalysisPipeline

Orchestrates multiple analysis engines.

### Constructor

```typescript
constructor(options?: PipelineOptions)
```

**Options:**

```typescript
interface PipelineOptions {
  enabledEngines: string[];  // ['pattern', 'slither']
  parallel?: boolean;        // Run engines in parallel
  failFast?: boolean;        // Stop on first error
}
```

### Methods

#### analyze()

Run all enabled engines on a contract.

```typescript
async analyze(contract: Contract): Promise<PipelineResult>
```

**Returns:**

```typescript
interface PipelineResult {
  pattern?: EngineResult;
  slither?: EngineResult;
  mythril?: EngineResult;
  // ... per-engine results
  aggregated: {
    findings: Finding[];
    errors: string[];
    duration: number;
  };
}
```

---

## PatternEngine

Pattern-based vulnerability detection.

### Constructor

```typescript
constructor(registry?: PatternRegistryLoader)
```

### Methods

#### analyze()

```typescript
async analyze(contract: Contract): Promise<EngineResult>
```

#### getCategories()

```typescript
getCategories(): string[]
```

Returns available vulnerability categories.

#### getPatternCount()

```typescript
getPatternCount(): number
```

Returns total number of loaded patterns.

---

## ContractResolver

Parse and validate contract inputs.

### Static Methods

#### parseInput()

```typescript
static parseInput(input: string): ParsedInput
```

**Returns:**

```typescript
interface ParsedInput {
  type: 'address' | 'etherscan' | 'github' | 'filepath';
  address?: string;
  chainId?: number;
  url?: string;
  path?: string;
}
```

**Examples:**

```typescript
// Address
ContractResolver.parseInput('0xabc...123');
// { type: 'address', address: '0xabc...123' }

// Etherscan URL
ContractResolver.parseInput('https://etherscan.io/address/0xabc...');
// { type: 'etherscan', address: '0xabc...', chainId: 1 }
```

#### isValidAddress()

```typescript
static isValidAddress(address: string): boolean
```

Validates Ethereum address checksum.

---

## Connectors

### WhiteClawsClient

API client for whiteclaws.app backend.

```typescript
const client = new WhiteClawsClient({
  baseUrl: 'https://api.whiteclaws.app',
  apiKey: 'your-api-key',
});

// Queue scan job
const { scanId } = await client.queueScan({
  address: '0x...',
  chainId: 1,
});

// Get results
const result = await client.getScanResult(scanId);
```

### ChainConnector

Multi-chain data provider.

```typescript
const chain = new ChainConnector({
  chainId: 1,  // Ethereum
});

const contract = await chain.getContract('0x...');
```

### ProtocolIntelligence

DeFi protocol data and risk metrics.

```typescript
const intel = new ProtocolIntelligence();

const protocol = await intel.getProtocolInfo('aave');
console.log(protocol.tvlUsd);
console.log(protocol.riskMetrics.auditCount);
```

---

## Types

### Finding

```typescript
interface Finding {
  id: string;
  detectorName: string;
  tool: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  codeSnippet?: string;
  lineStart?: number;
  lineEnd?: number;
}
```

### ScanSummary

```typescript
interface ScanSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  enginesUsed: string[];
  scanDuration: number;
}
```

---

## Error Handling

All async methods may throw:

```typescript
try {
  const result = await scanner.scan({ address: '0x...' });
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid input
  } else if (error instanceof EngineError) {
    // Analysis engine failed
  } else if (error instanceof NetworkError) {
    // API/chain connection issue
  }
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Scan (free) | 10/minute |
| Scan (pro) | 100/minute |
| Quick Check | 100/minute |
| Source Analysis | Unlimited (local) |

---

## Version

```typescript
import { VERSION } from '@whiteclaws/white-rabbit';
console.log(VERSION); // '2.0.0-alpha.1'
```
