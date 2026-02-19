# @whiteclaws/mcp-white-rabbit

[![npm version](https://badge.fury.io/js/@whiteclaws%2Fmcp-white-rabbit.svg)](https://www.npmjs.com/package/@whiteclaws/mcp-white-rabbit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> MCP (Model Context Protocol) server for WhiteRabbit smart contract security scanner

This package provides an MCP server that allows AI assistants like Claude to interact with the WhiteRabbit security scanner directly.

## What is MCP?

The Model Context Protocol (MCP) is an open protocol that enables AI assistants to interact with external tools and data sources. This server exposes WhiteRabbit's security analysis capabilities to MCP-compatible clients.

## Installation

```bash
npm install -g @whiteclaws/mcp-white-rabbit
```

## Usage

### Standalone

```bash
white-rabbit-mcp
```

The server will start on stdio for MCP communication.

### With Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

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

### Environment Variables

```bash
# Optional: Set API keys for enhanced analysis
export ETHERSCAN_API_KEY=your_key
export ANTHROPIC_API_KEY=your_key
```

## Available Tools

### analyze_contract

Analyze a smart contract for security vulnerabilities.

**Parameters:**
- `sourceCode` (string): Solidity source code to analyze
- `address` (string, optional): Contract address for context
- `chainId` (number, optional): Chain ID (default: 1)

**Example:**
```json
{
  "sourceCode": "pragma solidity ^0.8.0; contract Test { ... }",
  "address": "0x123...",
  "chainId": 1
}
```

### search_patterns

Search the vulnerability pattern database.

**Parameters:**
- `query` (string): Search query
- `category` (string, optional): Filter by category
- `severity` (string, optional): Filter by severity

**Example:**
```json
{
  "query": "reentrancy",
  "severity": "high"
}
```

### get_vulnerability_info

Get detailed information about a specific vulnerability type.

**Parameters:**
- `vulnerabilityId` (string): ID of the vulnerability

**Example:**
```json
{
  "vulnerabilityId": "reentrancy"
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Start server
npm start
```

## License

MIT © WhiteClaws Team
