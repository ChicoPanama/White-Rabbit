# @whiteclaws/white-rabbit

[![npm version](https://badge.fury.io/js/@whiteclaws%2Fwhite-rabbit.svg)](https://www.npmjs.com/package/@whiteclaws/white-rabbit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-27%2F27%20passing-brightgreen)]()

> Portable smart contract security scanner for whiteclaws.app

White-Rabbit is a comprehensive security analysis toolkit for Ethereum smart contracts. It combines multiple industry-standard analysis engines (Slither, Mythril, Securify2, MAIAN) with pattern-based detection and AI-powered verification to detect vulnerabilities before they reach production.

## Features

- 🔍 **Multi-Engine Analysis** - Combines Slither, pattern matching, and optional deep analysis
- 📦 **JSON Pattern Database** - External, versioned vulnerability patterns for easy updates
- ⚡ **Quick & Deep Modes** - Fast scanning for CI/CD, thorough analysis for audits
- 🤖 **AI-Powered Verification** - Reduces false positives with LLM analysis
- 🔗 **WhiteClaws Integration** - Queue scans via whiteclaws.app API
- 📊 **Multiple Output Formats** - JSON, SARIF, and human-readable table formats
- 🌐 **Multi-Chain Support** - Ethereum, Base, Arbitrum, Optimism, Polygon, and 30+ chains
- 🏗️ **Programmatic API** - Use as a library in your Node.js applications
- 🖥️ **MCP Server** - Model Context Protocol for AI assistants

## Installation

### Global CLI

```bash
npm install -g @whiteclaws/white-rabbit
```

### Local Project

```bash
npm install @whiteclaws/white-rabbit
```

### As Library

```bash
npm install @whiteclaws/white-rabbit
```

## Prerequisites

### Required
- Node.js 18+
- [Slither](https://github.com/crytic/slither) (optional, for full analysis)
  ```bash
  pip install slither-analyzer
  ```

### Optional (for deep analysis)
- [Mythril](https://github.com/ConsenSys/mythril) - Symbolic execution
  ```bash
  pip install mythril
  ```
- [Securify2](https://github.com/eth-sri/securify2) - Formal verification (via Docker)
- [MAIAN](https://github.com/ivicanikolicsg/MAIAN) - Dynamic analysis

## Quick Start

### CLI Usage

```bash
# Set your API keys
export ETHERSCAN_API_KEY=your_key_here

# Quick scan (PatternEngine only)
white-rabbit quick 0x1234... --chain ethereum

# Full scan with all available tools
white-rabbit scan 0x1234... --deep

# Analyze local file
white-rabbit analyze ./contract.sol

# Check which engines are available
white-rabbit engines

# List supported chains
white-rabbit chains

# Search vulnerability patterns
white-rabbit hunt reentrancy
```

### Programmatic Usage

```typescript
import { WhiteRabbit } from '@whiteclaws/white-rabbit';

const scanner = new WhiteRabbit({
  engines: { pattern: true, slither: true },
  defaultDepth: 'standard',
});

// Analyze source code
const result = await scanner.analyzeSource({
  sourceCode: fs.readFileSync('contract.sol', 'utf-8'),
  filename: 'MyContract.sol',
});

console.log(`Found ${result.findings.length} issues`);

// Review findings
for (const finding of result.findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.title}`);
  console.log(`  ${finding.description}`);
  if (finding.lineStart) {
    console.log(`  Line ${finding.lineStart}`);
  }
}
```

### MCP Server (for AI Assistants)

```bash
# Install MCP server
npm install -g @whiteclaws/mcp-white-rabbit

# Configure in Claude Desktop
# Add to claude_desktop_config.json:
{
  "mcpServers": {
    "white-rabbit": {
      "command": "npx",
      "args": ["-y", "@whiteclaws/mcp-white-rabbit"]
    }
  }
}
```

## API Reference

### `WhiteRabbit` Class

Main entry point for contract scanning.

```typescript
import { WhiteRabbit } from '@whiteclaws/white-rabbit';

const scanner = new WhiteRabbit({
  engines: {
    pattern: true,    // Pattern-based detection (always available)
    slither: true,    // Requires slither-analyzer
    mythril: false,   // Requires mythril
  },
  defaultDepth: 'standard',  // 'quick' | 'standard' | 'deep'
});
```

#### Methods

| Method | Description |
|--------|-------------|
| `scan(options)` | Scan a deployed contract by address |
| `analyzeSource(options)` | Analyze local Solidity source code |
| `quickCheck(address, chainId)` | Fast vulnerability check |
| `checkEngines()` | Check which engines are available |

See [API.md](./API.md) for complete documentation.

## CLI Commands

| Command | Description |
|---------|-------------|
| `white-rabbit init` | Interactive configuration wizard |
| `white-rabbit scan <address>` | Full contract scan |
| `white-rabbit quick <address>` | Quick scan (Pattern only) |
| `white-rabbit deep <address>` | Deep scan (all engines) |
| `white-rabbit analyze <file>` | Analyze local Solidity file |
| `white-rabbit hunt <keyword>` | Search vulnerability patterns |
| `white-rabbit status <scanId>` | Check scan status |
| `white-rabbit engines` | List available engines |
| `white-rabbit chains` | List supported chains |
| `white-rabbit config` | Show configuration |

## Configuration

### Environment Variables

```bash
# Required for contract resolution
export ETHERSCAN_API_KEY=your_etherscan_key

# Optional
export WHITECLAWS_API_KEY=your_whiteclaws_key
export ETH_RPC_URL=https://eth.llamarpc.com
export BASE_RPC_URL=https://base.llamarpc.com
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
  },
  "outputFormat": "table"
}
```

## Supported Chains (30+)

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum | 1 | ✅ Full |
| Base | 8453 | ✅ Full |
| Arbitrum | 42161 | ✅ Full |
| Optimism | 10 | ✅ Full |
| Polygon | 137 | ✅ Full |
| BSC | 56 | ✅ Full |
| Avalanche | 43114 | ✅ Full |
| Fantom | 250 | ✅ Full |
| And 23 more... | | |

## Vulnerability Detection

### Detected Vulnerability Categories

| Category | Severity | Patterns |
|----------|----------|----------|
| Reentrancy | 🔴 High | 5 patterns |
| Access Control | 🔴 High | 4 patterns |
| Oracle Manipulation | 🔴 Critical | 3 patterns |
| Flash Loan | 🔴 High | 4 patterns |
| Integer Overflow | 🟡 Medium | 3 patterns |
| Governance Attack | 🔴 High | 4 patterns |
| Price Manipulation | 🔴 Critical | 3 patterns |

### Confidence Levels

- **High**: Strong indicators, likely a real issue
- **Medium**: Possible issue, requires manual review
- **Low**: Weak indicators, may be false positive

## Output Formats

### Table (Default)

```
┌─────────────────────────────────────────────────────────────┐
│ WhiteRabbit Security Scan                                   │
├──────────┬──────────────────────────────┬──────────┬────────┤
│ Severity │ Title                        │ Tool     │ Line   │
├──────────┼──────────────────────────────┼──────────┼────────┤
│ HIGH     │ Reentrancy Vulnerability     │ pattern  │ 42     │
│ MEDIUM   │ tx.origin Authentication     │ pattern  │ 15     │
│ LOW      │ Unchecked External Call      │ pattern  │ 38     │
└──────────┴──────────────────────────────┴──────────┴────────┘
```

### JSON

```bash
white-rabbit scan 0x1234... --format json --output results.json
```

### SARIF

```bash
white-rabbit scan 0x1234... --format sarif --output results.sarif
```

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
          node-version: '18'
      - run: npm install -g @whiteclaws/white-rabbit
      - run: white-rabbit analyze ./contracts --format sarif --output results.sarif
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

## Performance

| Contract Size | PatternEngine | With Slither |
|--------------|---------------|--------------|
| Small (<100 lines) | <50ms | 2-5s |
| Medium (100-500 lines) | <100ms | 5-15s |
| Large (500+ lines) | <500ms | 15-60s |

Run benchmarks:
```bash
npm run benchmark
```

## Security

See [SECURITY.md](./SECURITY.md) for:
- Security policy
- Vulnerability reporting
- Supported versions
- Bug bounty program

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WhiteRabbit Scanner                      │
├─────────────────────────────────────────────────────────────┤
│  CLI │ Library │ MCP Server │ API Routes                   │
├─────────────────────────────────────────────────────────────┤
│                    Analysis Pipeline                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Pattern  │ │ Slither  │ │ Mythril  │ │ Securify │ ...   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│                JSON Pattern Database                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Reentrancy  │ │ Access Ctrl │ │ Oracle Manipulation │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                 Connectors & Intelligence                   │
│  Chain │ DeFiLlama │ Protocol Intel │ Known Vulns         │
└─────────────────────────────────────────────────────────────┘
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Code style
- Testing guidelines
- Pull request process

### Development

```bash
# Clone
git clone https://github.com/whiteclaws/white-rabbit.git
cd white-rabbit/packages/white-rabbit

# Install
npm install

# Build
npm run build

# Test
npm test

# Watch mode
npm run dev
```

## License

MIT © WhiteClaws Team

## Related Packages

| Package | Description |
|---------|-------------|
| `@whiteclaws/white-rabbit` | Core scanner (this package) |
| `@whiteclaws/mcp-white-rabbit` | MCP server for AI assistants |

---

<p align="center">
  Built with ❤️ by <a href="https://whiteclaws.app">WhiteClaws</a>
</p>
