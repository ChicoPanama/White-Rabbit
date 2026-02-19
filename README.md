# White-Rabbit v2

[![npm version](https://badge.fury.io/js/@whiteclaws%2Fwhite-rabbit.svg)](https://www.npmjs.com/package/@whiteclaws/white-rabbit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()

> Portable smart contract security scanner for whiteclaws.app

White-Rabbit is a comprehensive security analysis toolkit for Ethereum smart contracts. It combines multiple industry-standard analysis engines with AI-powered verification to detect vulnerabilities before they reach production.

## What's New in v2

- **JSON Pattern Database** - External, versioned vulnerability patterns
- **Multi-Engine Analysis** - Slither, Mythril, Securify2, MAIAN + Pattern matching
- **MCP Server** - Model Context Protocol for AI assistants
- **30+ Chains** - Full EVM multi-chain support
- **TypeScript** - Complete type safety
- **npm Packages** - Install anywhere, use as library or CLI

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@whiteclaws/white-rabbit` | Core scanner | `npm i -g @whiteclaws/white-rabbit` |
| `@whiteclaws/mcp-white-rabbit` | MCP server | `npm i -g @whiteclaws/mcp-white-rabbit` |

## Features

- 🔍 **Multi-Engine Analysis** - Combines multiple analyzers
- 📦 **JSON Pattern Database** - Versioned vulnerability patterns
- ⚡ **Quick & Deep Modes** - Fast CI/CD or thorough auditing
- 🤖 **AI-Powered Verification** - LLM-based false positive reduction
- 🔗 **WhiteClaws Integration** - Queue scans via API
- 📊 **Multiple Output Formats** - JSON, SARIF, table
- 🌐 **Multi-Chain Support** - 30+ EVM chains
- 🏗️ **Programmatic API** - Use as library
- 🖥️ **MCP Server** - AI assistant integration

## Quick Start

### CLI Usage

```bash
# Install globally
npm install -g @whiteclaws/white-rabbit

# Set your API key
export ETHERSCAN_API_KEY=your_key_here

# Quick scan (PatternEngine only)
white-rabbit quick 0x1234... --chain ethereum

# Full scan with all available tools
white-rabbit scan 0x1234... --deep

# Analyze local file
white-rabbit analyze ./contract.sol

# Search vulnerability patterns
white-rabbit hunt reentrancy
```

### Programmatic Usage

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

## Vulnerability Detection

| Category | Severity | Patterns |
|----------|----------|----------|
| Reentrancy | 🔴 High | 5 patterns |
| Access Control | 🔴 High | 4 patterns |
| Oracle Manipulation | 🔴 Critical | 3 patterns |
| Flash Loan | 🔴 High | 4 patterns |
| Integer Overflow | 🟡 Medium | 3 patterns |
| Governance Attack | 🔴 High | 4 patterns |
| Price Manipulation | 🔴 Critical | 3 patterns |

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
| And 23 more... | | |

## Documentation

- [API Reference](packages/white-rabbit/API.md)
- [Contributing Guide](packages/white-rabbit/CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Release Process](RELEASING.md)

## Configuration

### Environment Variables

```bash
# Required for contract resolution
export ETHERSCAN_API_KEY=your_etherscan_key

# Optional
export WHITECLAWS_API_KEY=your_whiteclaws_key
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

## Development

```bash
# Clone
git clone https://github.com/whiteclaws/white-rabbit.git
cd white-rabbit

# Install
npm install

# Build
npm run build

# Test
npm test

# Benchmark
npm run benchmark
```

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

## Security

See [SECURITY.md](SECURITY.md) for:
- Security policy
- Vulnerability reporting
- Bug bounty program

## Contributing

We welcome contributions! See [CONTRIBUTING.md](packages/white-rabbit/CONTRIBUTING.md) for:
- Development setup
- Code style
- Testing guidelines
- Pull request process

## License

MIT © WhiteClaws Team

---

<p align="center">
  Built with ❤️ by <a href="https://whiteclaws.app">WhiteClaws</a>
</p>
