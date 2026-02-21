# White-Rabbit

> An AI-powered tool that reads smart contract code and finds security bugs — automatically, across 30+ blockchains.

[![npm](https://img.shields.io/npm/v/@whiteclaws/white-rabbit)](https://www.npmjs.com/package/@whiteclaws/white-rabbit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-87%20passing-brightgreen)]()
[![Chains](https://img.shields.io/badge/EVM%20Chains-30+-blue)]()

---

## What Is White-Rabbit?

**Smart contracts** are programs that run on blockchains and handle real money. If there's a bug, hackers can drain millions. White-Rabbit is a security scanner that reads these programs and finds vulnerabilities before hackers do.

Think of it like an antivirus, but for blockchain code.

### What It Does

1. **Fetches** a smart contract's source code from the blockchain (or reads a local file)
2. **Runs** the code through up to 5 different analysis engines simultaneously
3. **Finds** potential vulnerabilities (reentrancy attacks, access control bugs, price manipulation, etc.)
4. **Deduplicates** results across engines so you don't get the same bug reported 5 times
5. **Submits** confirmed findings to [WhiteClaws](https://whiteclaws.app) for bounty payouts

You can use it as a **command-line tool**, a **JavaScript library**, or through an **AI assistant** (via MCP).

### How It Connects to WhiteClaws

White-Rabbit is the scanner. WhiteClaws is the marketplace. Together they form a pipeline:

```
White-Rabbit finds a bug
        │
        ▼
Submits it to WhiteClaws ──▶ Protocol team reviews it
                                      │
                              ┌───────▼───────┐
                              │   Accepted?   │
                              │   YES → Payout│
                              │   NO → Reject │
                              └───────────────┘
```

---

## Key Concepts

| Term | What It Means |
|------|---------------|
| **Smart Contract** | A program on a blockchain that handles money automatically. Can't be changed once deployed. |
| **Vulnerability** | A bug in a smart contract that could be exploited to steal funds or break things. |
| **EVM Chain** | Any blockchain that runs Ethereum-compatible code (Ethereum, Base, Arbitrum, Polygon, etc.). White-Rabbit supports 30+. |
| **Static Analysis** | Reading code without running it, looking for known bad patterns. Like a spell-checker for security. |
| **Symbolic Execution** | Testing code with mathematical symbols instead of real values, to explore every possible path. |
| **Pattern Matching** | Comparing code against a database of known vulnerability patterns (like checking fingerprints). |
| **False Positive** | When the scanner says there's a bug, but there actually isn't. White-Rabbit uses multiple engines to reduce these. |
| **MCP** | Model Context Protocol — a way for AI assistants (like Claude) to use external tools. White-Rabbit has an MCP server so AI can scan contracts directly. |
| **Telemetry** | Data about what the scanner did — what it scanned, what it found, how long it took. Sent to WhiteClaws for analytics. |

---

## How The Scanner Works

```
You give White-Rabbit a contract address (or a .sol file)
        │
        ▼
┌─ Step 1: Resolve ────────────────────────────────────────────┐
│  Fetches the source code from the blockchain using            │
│  Etherscan V2 API. Works with 30+ chains automatically.      │
│  (If you gave it a local file, this step is skipped.)        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─ Step 2: Analyze ────────────────────────────────────────────┐
│  Runs the code through up to 5 analysis engines:              │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ │
│  │ Pattern  │ │ Slither  │ │ Mythril  │ │Securify│ │MAIAN │ │
│  │          │ │          │ │          │ │        │ │      │ │
│  │ Checks   │ │ Reads    │ │ Tries    │ │ Proves │ │Tests │ │
│  │ against  │ │ code     │ │ every    │ │ safety │ │real  │ │
│  │ known    │ │ structure│ │ possible │ │ proper-│ │behav-│ │
│  │ vuln     │ │ for 90+  │ │ execution│ │ ties   │ │ior   │ │
│  │ patterns │ │ bug types│ │ path     │ │ math-  │ │      │ │
│  │          │ │          │ │          │ │ ematic-│ │      │ │
│  │ Always   │ │ Needs    │ │ Needs    │ │ ally   │ │Needs │ │
│  │ available│ │ install  │ │ install  │ │        │ │inst. │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ └──────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─ Step 3: Deduplicate ────────────────────────────────────────┐
│  Multiple engines often find the same bug. This step          │
│  merges duplicates so you get one clean list.                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─ Step 4: Report ─────────────────────────────────────────────┐
│  Returns findings with severity, description, affected code,  │
│  and which engine(s) found it. Optionally submits to          │
│  WhiteClaws for bounty processing.                            │
└──────────────────────────────────────────────────────────────┘
```

### The Five Engines

| Engine | What It Does | Needs Install? |
|--------|-------------|----------------|
| **Pattern** | Matches code against a JSON database of known vulnerability fingerprints. Pure JavaScript — works everywhere. | No (always available) |
| **Slither** | Static analyzer built by Trail of Bits. Reads Solidity code structure and checks 90+ detector rules. Industry standard. | Yes (`pip install slither-analyzer`) |
| **Mythril** | Symbolic execution engine. Explores every possible execution path to find bugs that only trigger under specific conditions. | Yes (`pip install mythril`) |
| **Securify2** | Formal verification tool. Mathematically proves whether security properties hold or can be violated. | Yes (Docker) |
| **MAIAN** | Dynamic analysis. Actually runs the contract in a sandbox to observe runtime behavior. | Yes (Docker) |

The **Pattern engine** is always available and doesn't need anything installed. The others are optional — enable whichever ones you have installed.

### What It Finds

| Vulnerability Type | Severity | What It Means |
|-------------------|----------|---------------|
| **Reentrancy** | High | An attacker can call a function repeatedly before it finishes, draining funds. The #1 cause of DeFi hacks. |
| **Access Control** | High | Functions that should be restricted (like withdrawals) can be called by anyone. |
| **Oracle Manipulation** | Critical | An attacker can manipulate price feeds to trick the protocol into wrong calculations. |
| **Flash Loan Attack** | High | Using borrowed funds (repaid in the same transaction) to manipulate the protocol. |
| **Integer Overflow** | Medium | Math calculations wrap around (like an odometer going from 999999 to 000000), causing wrong amounts. |
| **Governance Attack** | High | An attacker gains enough voting power to pass malicious proposals. |
| **Price Manipulation** | Critical | Direct manipulation of token prices through trades or liquidity changes. |

---

## Getting Started

### Option 1: Command Line (CLI)

Install it globally and scan from your terminal:

```bash
# Install
npm install -g @whiteclaws/white-rabbit

# Set your Etherscan API key (free at etherscan.io)
export ETHERSCAN_API_KEY=your_key_here

# Quick scan (Pattern engine only — fast, no extra tools needed)
white-rabbit quick 0x1234...abcd --chain ethereum

# Full scan with all installed engines
white-rabbit scan 0x1234...abcd --deep

# Analyze a local Solidity file
white-rabbit analyze ./MyContract.sol

# Search for specific vulnerability patterns
white-rabbit hunt reentrancy

# Get intelligence about a protocol before scanning
white-rabbit intel aave
```

### Option 2: JavaScript/TypeScript Library

Use it in your own code:

```typescript
import { WhiteRabbit } from '@whiteclaws/white-rabbit';

// Create a scanner (enable whichever engines you have installed)
const scanner = new WhiteRabbit({
  engines: { pattern: true, slither: true },
});

// Scan a local file
const result = await scanner.analyzeSource({
  sourceCode: fs.readFileSync('contract.sol', 'utf-8'),
  filename: 'MyContract.sol',
});

// Print results
console.log(`Found ${result.findings.length} issues`);
for (const finding of result.findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.title}`);
}
```

### Option 3: AI Assistant (MCP Server)

Let AI assistants like Claude use White-Rabbit as a tool:

```bash
npm install -g @whiteclaws/mcp-white-rabbit
```

Add to your Claude Desktop config:

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

Now Claude can scan contracts for you when you ask.

---

## CLI Commands

| Command | What It Does |
|---------|-------------|
| `white-rabbit init` | Interactive setup wizard — creates your config file |
| `white-rabbit scan <address>` | Full scan of a deployed contract |
| `white-rabbit quick <address>` | Fast scan using only the Pattern engine |
| `white-rabbit deep <address>` | Thorough scan using every available engine |
| `white-rabbit analyze <file>` | Scan a local Solidity file |
| `white-rabbit hunt <keyword>` | Search the vulnerability pattern database |
| `white-rabbit intel <protocol>` | Show intelligence about a protocol (TVL, risks, known vulns) |
| `white-rabbit status <scanId>` | Check progress of a running scan |
| `white-rabbit submit <file>` | Submit a finding to WhiteClaws for bounty processing |

### Common Options

| Option | What It Does |
|--------|-------------|
| `--chain ethereum` | Target a specific blockchain (default: ethereum) |
| `--deep` | Enable all installed engines |
| `--format json` | Output format: `json`, `sarif`, or `table` |
| `--output results.json` | Save results to a file |
| `--min-severity high` | Only show findings of this severity or higher |

---

## Supported Blockchains (30+)

White-Rabbit can scan contracts on any of these chains:

| Blockchain | Chain ID | What It Is |
|-----------|----------|------------|
| Ethereum | 1 | The original smart contract platform |
| Base | 8453 | Coinbase's Layer 2, fast and cheap |
| Arbitrum | 42161 | Ethereum Layer 2 with lower fees |
| Optimism | 10 | Another Ethereum Layer 2 |
| Polygon | 137 | Sidechain popular with gaming and NFTs |
| BSC (BNB Chain) | 56 | Binance's chain, lots of DeFi |
| Avalanche | 43114 | Fast finality blockchain |
| Fantom | 250 | High-speed DeFi chain |
| zkSync Era | 324 | Zero-knowledge Ethereum Layer 2 |
| Gnosis | 100 | Community-owned Ethereum sidechain |
| And 20+ more... | | Cronos, Mantle, Manta, Scroll, Linea, Blast, Celo, Moonbeam, etc. |

All chains have pre-configured API endpoints. Just pass `--chain <name>` and it works.

---

## How Telemetry Works

White-Rabbit tracks what it does during scans and sends that data to WhiteClaws for analytics. This helps improve the scanner over time.

```
Scanner runs ──▶ Events buffered locally
                        │
                        ▼ (every 25 events)
                  Batch sent to WhiteClaws
                  POST /api/telemetry/ingest
                        │
                        ▼
                  If API unreachable:
                  Saved to ~/.white-rabbit/telemetry/*.jsonl
                  (retried later)
```

### What Gets Tracked

| Event | What It Means |
|-------|---------------|
| `scan_started` | A new scan began |
| `contract_classified` | The contract type was identified (lending, DEX, governance, etc.) |
| `patterns_loaded` | Vulnerability patterns were loaded from the database |
| `vulnerability_detected` | A potential bug was found |
| `false_positive_filtered` | A finding was removed because it's a known false alarm |
| `verification_result` | A finding was confirmed or rejected |
| `scan_complete` | The scan finished |

Telemetry is **optional** and can be disabled. No source code or private data is ever sent — only metadata about the scan process.

---

## Packages

White-Rabbit is a monorepo with two publishable packages:

| Package | What It Is | Install |
|---------|-----------|---------|
| `@whiteclaws/white-rabbit` | The scanner itself (CLI + library) | `npm i -g @whiteclaws/white-rabbit` |
| `@whiteclaws/mcp-white-rabbit` | MCP server so AI assistants can use the scanner | `npm i -g @whiteclaws/mcp-white-rabbit` |

---

## Project Structure

```
White-Rabbit/
│
├── packages/
│   ├── white-rabbit/              # The main scanner package
│   │   ├── src/
│   │   │   ├── core/              # WhiteRabbit class (the main API)
│   │   │   ├── engines/           # 5 analysis engines
│   │   │   ├── connectors/        # Chain RPC, DeFiLlama, WhiteClaws API
│   │   │   ├── intelligence/      # Protocol intel, known vulnerability database
│   │   │   ├── telemetry/         # Scan event tracking
│   │   │   ├── cli/               # Command-line interface
│   │   │   ├── types.ts           # Type definitions (30+ chain configs)
│   │   │   └── tests/             # 7 test files
│   │   └── data/                  # Vulnerability pattern databases
│   │
│   └── mcp/                       # MCP server for AI assistants
│
├── research/                      # Security research library
│   └── books/                     # 9 reference repos (Slither, Z3, Ethernaut, etc.)
│                                  # + Princeton Bitcoin Book PDF
│
├── .github/workflows/             # CI/CD (build, test, publish, security scan)
└── package.json                   # Monorepo root
```

---

## Configuration

### Environment Variables

```bash
# Required — get a free key at etherscan.io
export ETHERSCAN_API_KEY=your_key

# Optional — for WhiteClaws integration
export WHITECLAWS_API_KEY=wc_...

# Optional — custom RPC endpoint
export ETH_RPC_URL=https://eth.llamarpc.com
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

## For Developers

### Setup

```bash
git clone https://github.com/ChicoPanama/White-Rabbit.git
cd White-Rabbit
npm install        # Installs both packages (npm workspaces)
npm run build      # Builds everything
npm test           # Runs all tests
npm run typecheck  # TypeScript type checking
npm run lint       # Code style checking
```

### CI/CD

GitHub Actions runs on every push and PR:
- **Build & Test** on Node 18 and 20
- **Lint & Type Check**
- **Security Audit** (dependency scanning + secret detection via TruffleHog)

### Using as a Library

```typescript
import {
  WhiteRabbit,           // Main scanner class
  PatternEngine,         // Pattern-based detection
  WhiteClawsClient,      // WhiteClaws API client
  TelemetryEmitter,      // Scan telemetry
  ProtocolIntelligence,  // Protocol enrichment data
  VERSION,               // Package version
} from '@whiteclaws/white-rabbit';
```

---

## Research Library

The `research/` directory contains curated security research, organized into 6 layers:

| Layer | Topic | Example Sources |
|-------|-------|-----------------|
| 0 | Foundations | Mastering Ethereum, Mastering Bitcoin, Princeton Bitcoin Book |
| 1 | How Bugs Happen | SWC Registry, smart contract vulnerability catalogs |
| 2 | Formal Thinking | Halmos (formal verification), Z3 (mathematical proofs) |
| 3 | Economic Attacks | Flash loan vectors, oracle manipulation techniques |
| 4 | System Failures | Bridge exploits, governance attacks |
| 5 | Historical Data | 430+ real exploit entries from DeFiLlama |

Plus 10 industry reports from Q1 2026 (TRM Labs, Chainalysis, SlowMist, Hacken, Kroll, and more).

---

## License

MIT

---

<p align="center">
  Built by <a href="https://whiteclaws.app">WhiteClaws</a>
</p>
