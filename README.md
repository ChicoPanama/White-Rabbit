# White-Rabbit

> Autonomous smart contract vulnerability scanner for [whiteclaws.app](https://whiteclaws.app). Multi-engine analysis across 30+ EVM chains.

[![npm](https://img.shields.io/npm/v/@whiteclaws/white-rabbit)](https://www.npmjs.com/package/@whiteclaws/white-rabbit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-87%20passing-brightgreen)]()
[![Chains](https://img.shields.io/badge/EVM%20Chains-30+-blue)]()

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        White-Rabbit Scanner                             │
│                                                                         │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐                         │
│  │    CLI    │  │  Library   │  │ MCP Server │                         │
│  │ white-    │  │  import {  │  │ white-     │                         │
│  │ rabbit    │  │  WhiteRab  │  │ rabbit-mcp │                         │
│  │ scan 0x.. │  │  bit }     │  │            │                         │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘                         │
│        │              │              │                                  │
│  ┌─────▼──────────────▼──────────────▼──────┐                           │
│  │           WhiteRabbit Core               │                           │
│  │     (scan, analyzeSource, events)        │                           │
│  └──────────────────┬───────────────────────┘                           │
│                     │                                                   │
│  ┌──────────────────▼───────────────────────┐                           │
│  │          Analysis Pipeline               │                           │
│  │  Orchestrates engines, deduplicates      │                           │
│  └───┬──────┬──────┬──────┬──────┬──────────┘                           │
│      │      │      │      │      │                                     │
│  ┌───▼──┐┌──▼───┐┌─▼────┐┌▼─────┐┌▼─────┐                             │
│  │Patt- ││Sli-  ││Myth- ││Secu- ││MAIAN │                             │
│  │ern   ││ther  ││ril   ││rify2 ││      │                             │
│  │Engine││Engine││Engine││Engine││Engine│                             │
│  │      ││      ││      ││      ││      │                             │
│  │ JSON ││Static││Symbo-││Formal││Dynam-│                             │
│  │ pat- ││anal- ││lic   ││verif-││ic    │                             │
│  │terns ││ysis  ││exec  ││icatn ││anal. │                             │
│  └──────┘└──────┘└──────┘└──────┘└──────┘                             │
│                     │                                                   │
│  ┌──────────────────▼───────────────────────────────────────────────┐   │
│  │                    Connectors & Intelligence                      │   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │   │
│  │  │ Chain RPC    │  │ DeFiLlama   │  │ Protocol Intelligence  │  │   │
│  │  │              │  │              │  │                        │  │   │
│  │  │ 30+ chains   │  │ TVL data     │  │ Known vulns           │  │   │
│  │  │ Etherscan V2 │  │ Protocol     │  │ Vulnerability surface │  │   │
│  │  │ Source fetch  │  │ discovery    │  │ Risk signals          │  │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘  │   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐                               │   │
│  │  │ WhiteClaws   │  │ Telemetry   │                               │   │
│  │  │ Client       │  │ Emitter     │                               │   │
│  │  │              │  │              │                               │   │
│  │  │ Submit       │  │ Scan events  │                               │   │
│  │  │ findings     │  │ Batched      │                               │   │
│  │  │ Get intel    │  │ flush to WC  │                               │   │
│  │  └──────────────┘  └──────────────┘                               │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@whiteclaws/white-rabbit` | Core scanner (CLI + library) | `npm i -g @whiteclaws/white-rabbit` |
| `@whiteclaws/mcp-white-rabbit` | MCP server for AI assistants | `npm i -g @whiteclaws/mcp-white-rabbit` |

---

## Quick Start

### CLI

```bash
npm install -g @whiteclaws/white-rabbit

export ETHERSCAN_API_KEY=your_key_here

# Quick scan (Pattern engine only)
white-rabbit quick 0x1234... --chain ethereum

# Full scan with all available engines
white-rabbit scan 0x1234... --deep

# Analyze local Solidity file
white-rabbit analyze ./contract.sol

# Search vulnerability patterns
white-rabbit hunt reentrancy

# Get protocol intelligence
white-rabbit intel aave
```

### Library

```typescript
import { WhiteRabbit } from '@whiteclaws/white-rabbit';

const scanner = new WhiteRabbit({
  engines: { pattern: true, slither: true },
});

const result = await scanner.analyzeSource({
  sourceCode: fs.readFileSync('contract.sol', 'utf-8'),
  filename: 'MyContract.sol',
});

console.log(`Found ${result.findings.length} issues`);
for (const finding of result.findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.title}`);
}
```

### MCP Server

```bash
npm install -g @whiteclaws/mcp-white-rabbit
```

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "white-rabbit": {
      "command": "npx",
      "args": ["-y", "@whiteclaws/mcp-white-rabbit"]
    }
  }
}
```

---

## Engines

Five analysis engines. The pipeline orchestrates them and deduplicates findings.

| Engine | Type | Requires | Description |
|--------|------|----------|-------------|
| **Pattern** | JSON pattern matching | Nothing (always available) | Versioned vulnerability patterns, pure JS |
| **Slither** | Static analysis | `slither` binary | 90+ detectors, Solidity-specific |
| **Mythril** | Symbolic execution | `mythril` binary | EVM bytecode analysis |
| **Securify2** | Formal verification | `securify2` binary | Security property checking |
| **MAIAN** | Dynamic analysis | `maian` binary | Runtime behavior analysis |

All engines implement a common interface:

```typescript
interface AnalysisEngine {
  name: string;
  version: string;
  isAvailable(): Promise<boolean>;
  analyze(contract: Contract, options: EngineOptions): Promise<EngineResult>;
}
```

### Vulnerability Categories

| Category | Severity | Patterns |
|----------|----------|----------|
| Reentrancy | High | 5 |
| Access Control | High | 4 |
| Oracle Manipulation | Critical | 3 |
| Flash Loan | High | 4 |
| Integer Overflow | Medium | 3 |
| Governance Attack | High | 4 |
| Price Manipulation | Critical | 3 |

---

## Connectors

| Connector | Purpose | Key Methods |
|-----------|---------|-------------|
| **ChainConnector** | RPC + block explorer | Contract fetching, balance queries, 30+ chains |
| **DeFiLlamaConnector** | TVL + protocol data | Protocol discovery, chain rankings, historical TVL |
| **WhiteClawsClient** | Platform integration | `submitFinding()`, `getProtocolIntel()`, `listScans()` |
| **OfflineQueue** | Resilience | Queues requests when offline, retries on reconnect |

---

## Intelligence

### Protocol Intelligence

Enriched protocol data for prioritizing scans:

```typescript
interface EnrichedProtocol {
  slug: string;
  name: string;
  tvl: number;
  chains: string[];
  hasBounty: boolean;
  maxBounty?: number;
  contracts: ContractIntel[];
  knownVulnerabilities: KnownVuln[];
  audits: AuditInfo[];
  riskSignals: RiskSignal[];
  vulnerabilitySurface?: {
    contractType: string;
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    totalMatchingPatterns: number;
  };
  isFork: boolean;
  forkedFrom?: string;
}
```

### Known Vulnerability Database

430+ historical exploits from DeFiLlama used to prioritize fork scanning and pattern matching.

---

## WhiteClaws Integration

Bidirectional data flow between the scanner and the WhiteClaws platform.

```
┌─────────────────────────────────────────────────────────────────┐
│                     WR ←→ WC Data Flow                          │
│                                                                  │
│  SCAN START                                                      │
│  ────────────────────────────────────────────────────────────── │
│  WR: TelemetryEmitter.emit('scan_started')                      │
│       │                                                          │
│  WR: WhiteClawsClient.getProtocolIntel(slug)                    │
│       │                                                          │
│       └──▶ GET whiteclaws.app/api/intel/protocol/:slug           │
│            (x402 payment if required)                            │
│       ◀── EnrichedProtocol response                              │
│                                                                  │
│  SCAN RUNNING                                                    │
│  ────────────────────────────────────────────────────────────── │
│  WR: PatternEngine loads vulnerability_patterns from WC DB       │
│  WR: TelemetryEmitter.emit('vulnerability_detected', ...)        │
│  WR: TelemetryEmitter.emit('contract_classified', ...)           │
│       │                                                          │
│       └──▶ POST whiteclaws.app/api/telemetry/ingest              │
│            (batched, max 100 events per flush)                   │
│                                                                  │
│  SCAN COMPLETE                                                   │
│  ────────────────────────────────────────────────────────────── │
│  WR: WhiteClawsClient.submitFinding(finding)                    │
│       │                                                          │
│       └──▶ POST whiteclaws.app/api/agents/submit                 │
│            (+ contract_address, telemetry_session_id)            │
│                                                                  │
│  All WR→WC calls use exponential backoff retry                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Telemetry

Event-based scan telemetry with batched flush to WhiteClaws.

### Event Types

| Action | Description |
|--------|-------------|
| `scan_started` | Scan initiated for contract/protocol |
| `contract_classified` | Contract type identified |
| `patterns_loaded` | Vulnerability patterns loaded from registry |
| `vulnerability_detected` | Finding discovered by an engine |
| `false_positive_filtered` | Finding removed by FP filter |
| `verification_result` | Finding verified or rejected |
| `scan_complete` | Scan finished with summary |

### Configuration

```typescript
const emitter = new TelemetryEmitter({
  enabled: true,
  apiKey: 'wc_...',
  apiUrl: 'https://whiteclaws.app/api/telemetry/ingest/',
  agentType: 'white-rabbit',
  flushEvery: 25,  // events per batch
});

emitter.emit({ action: 'scan_started', target: { protocol_slug: 'aave' } });
await emitter.flush();
```

Falls back to local JSONL files at `~/.white-rabbit/telemetry/` if the API is unreachable.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `white-rabbit init` | Interactive configuration wizard |
| `white-rabbit scan <address>` | Full scan with all available engines |
| `white-rabbit quick <address>` | Quick scan (Pattern engine only) |
| `white-rabbit deep <address>` | Deep scan (all engines + AI verification) |
| `white-rabbit analyze <file>` | Analyze local Solidity file |
| `white-rabbit hunt <keyword>` | Search vulnerability patterns |
| `white-rabbit intel <protocol>` | Show protocol intelligence |
| `white-rabbit status <scanId>` | Check scan status |
| `white-rabbit submit <file>` | Submit finding to WhiteClaws |

### Options

```bash
--chain <name>      # Target chain (default: ethereum)
--deep              # Enable all engines
--format <type>     # Output: json, sarif, table
--output <path>     # Write results to file
--min-severity <s>  # Filter: critical, high, medium, low
```

---

## Supported Chains (30+)

| Tier | Chains | Chain IDs |
|------|--------|-----------|
| **Tier 1** | Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche | 1, 8453, 42161, 10, 137, 56, 43114 |
| **Tier 2** | Fantom, Cronos, Gnosis, zkSync Era, Mantle, Manta, Mode | 250, 25, 100, 324, 5000, 169, 34443 |
| **Tier 3** | Celo, Moonbeam, Moonriver, Scroll, Linea, Blast + more | 42220, 1284, 1285, 534352, 59144, 81457 |

All chains have pre-configured RPC endpoints and Etherscan V2 API URLs.

---

## Monorepo Structure

```
White-Rabbit/
├── packages/
│   ├── white-rabbit/                 # @whiteclaws/white-rabbit
│   │   ├── src/
│   │   │   ├── index.ts              # Main exports
│   │   │   ├── types.ts              # Core types (428 lines, 30+ chain configs)
│   │   │   ├── core/
│   │   │   │   ├── white-rabbit.ts   # WhiteRabbit class (scan, analyzeSource)
│   │   │   │   └── scope-checker.ts  # Scope validation
│   │   │   ├── engines/
│   │   │   │   ├── analysis-pipeline.ts  # Orchestrator
│   │   │   │   ├── pattern.ts            # Pattern engine
│   │   │   │   ├── slither.ts            # Slither engine
│   │   │   │   ├── mythril.ts            # Mythril engine
│   │   │   │   ├── securify.ts           # Securify2 engine
│   │   │   │   └── maian.ts              # MAIAN engine
│   │   │   ├── connectors/
│   │   │   │   ├── whiteclaws-client.ts  # WhiteClaws API client
│   │   │   │   ├── chain.ts             # RPC + Etherscan
│   │   │   │   ├── defillama.ts         # DeFiLlama API
│   │   │   │   └── offline-queue.ts     # Offline resilience
│   │   │   ├── intelligence/
│   │   │   │   ├── protocol-intel.ts    # Protocol enrichment
│   │   │   │   └── known-vulns.ts       # 430+ exploit database
│   │   │   ├── telemetry/
│   │   │   │   ├── emitter.ts           # TelemetryEmitter
│   │   │   │   └── types.ts            # Event types
│   │   │   ├── cli/
│   │   │   │   ├── bin/cli.ts           # CLI entry point
│   │   │   │   └── commands/            # 7 command files
│   │   │   └── tests/                   # 7 test files
│   │   ├── data/                        # Pattern databases
│   │   └── package.json
│   │
│   └── mcp/                             # @whiteclaws/mcp-white-rabbit
│       ├── src/index.ts                 # MCP server
│       └── package.json
│
├── research/
│   ├── books/                           # 9 Git submodules + 1 PDF
│   │   ├── slither/                     # Slither source
│   │   ├── halmos/                      # Formal verification
│   │   ├── z3/                          # SMT solver
│   │   ├── ethernaut/                   # CTF challenges
│   │   ├── smart-contract-vulnerabilities/
│   │   ├── solidity-patterns/
│   │   ├── consensys-best-practices/
│   │   ├── mastering-ethereum/
│   │   ├── mastering-bitcoin/
│   │   └── princeton-bitcoin-book.pdf
│   ├── layers/                          # 6-layer research taxonomy
│   └── library/                         # Reference materials
│
├── .github/workflows/
│   ├── ci.yml                           # Build + test (Node 18, 20)
│   ├── pr.yml                           # PR validation
│   ├── release.yml                      # npm publishing
│   └── security.yml                     # TruffleHog + audit
│
├── package.json                         # Monorepo root (npm workspaces)
└── tsconfig.json                        # Shared TypeScript config
```

---

## API Exports

```typescript
// Main entry: @whiteclaws/white-rabbit
import {
  WhiteRabbit,           // Core scanner class
  ScopeChecker,          // Scope validation
  AnalysisPipeline,      // Engine orchestrator
  PatternEngine,         // Pattern-based detection
  WhiteClawsClient,      // Platform API client
  ChainConnector,        // Chain RPC connector
  DeFiLlamaConnector,    // DeFiLlama API
  TelemetryEmitter,      // Scan telemetry
  ProtocolIntelligence,  // Protocol enrichment
  ContractResolver,      // Contract fetching
  VERSION,               // '2.0.0-alpha.1'
} from '@whiteclaws/white-rabbit';

// Sub-exports
import { WhiteRabbit } from '@whiteclaws/white-rabbit/scanner';
import { PatternEngine } from '@whiteclaws/white-rabbit/engines';
import type { Finding, Severity, Contract } from '@whiteclaws/white-rabbit/types';
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @whiteclaws/white-rabbit
      - run: white-rabbit analyze ./contracts --format sarif --output results.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

---

## Configuration

### Environment Variables

```bash
# Required for contract resolution
export ETHERSCAN_API_KEY=your_etherscan_key

# Optional
export WHITECLAWS_API_KEY=wc_...           # For platform integration
export ETH_RPC_URL=https://eth.llamarpc.com # Custom RPC
```

### Config File

Create `~/.white-rabbit/config.json`:

```json
{
  "etherscanApiKey": "your_key",
  "defaultChain": "ethereum",
  "engines": {
    "pattern": true,
    "slither": true
  }
}
```

---

## Development

```bash
# Clone
git clone https://github.com/ChicoPanama/White-Rabbit.git
cd White-Rabbit

# Install (npm workspaces)
npm install

# Build all packages
npm run build

# Test
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Publish (alpha)
npm run publish:alpha
```

---

## Research Library

The `research/` directory contains 9 Git submodules and curated reference materials organized into a 6-layer taxonomy:

| Layer | Topic | Sources |
|-------|-------|---------|
| 0 | Foundations | Mastering Ethereum, Mastering Bitcoin, Princeton Bitcoin Book |
| 1 | Smart Contract Failure Modes | SWC Registry, vulnerability patterns |
| 2 | Formal Thinking | Halmos, Z3, Solidity patterns |
| 3 | Economic & Game-Theoretic Attacks | Flash loan vectors, oracle manipulation |
| 4 | Systemic Failures | Bridge exploits, governance attacks |
| 5 | Historical Correlation | 430+ exploit database from DeFiLlama |

Plus 10 ingested Q1 2026 industry reports (TRM Labs, Chainalysis, SlowMist, Hacken, etc.).

---

## License

MIT

---

<p align="center">
  Built by <a href="https://whiteclaws.app">WhiteClaws</a>
</p>
