# Skill: @whiteclaws/white-rabbit

## Description

Smart contract security scanner that detects vulnerabilities in Ethereum smart contracts using multiple analysis engines (Slither, Mythril, Securify2, MAIAN) with AI-powered verification.

## Installation

```bash
npm install -g @whiteclaws/white-rabbit
pip install slither-analyzer  # Required for full analysis
```

Set environment variable:
```bash
export ETHERSCAN_API_KEY=your_key
```

## Usage

### Quick Scan
```bash
# Scan a contract quickly (Slither + Pattern)
white-rabbit quick 0x1234567890abcdef... --chain base
```

### Deep Scan
```bash
# Full analysis with all available tools
white-rabbit deep 0x1234567890abcdef... --chain ethereum
```

### Check Available Engines
```bash
white-rabbit engines
```

### Programmatic Usage
```typescript
import { WhiteRabbit } from '@whiteclaws/white-rabbit';

const scanner = new WhiteRabbit({ etherscanApiKey });
const findings = await scanner.quickScan(address, 'base');
```

## Capabilities

- **Vulnerability Detection**: Reentrancy, access control, oracle manipulation, integer overflow, etc.
- **Multi-Engine Analysis**: Slither (static), Mythril (symbolic), Securify2 (formal), MAIAN (dynamic)
- **AI Verification**: Reduces false positives using Claude
- **Multi-Chain Support**: Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche, and more
- **Output Formats**: JSON, SARIF, human-readable table

## Common Tasks

### Scan a contract before interacting with it
```bash
white-rabbit quick 0xContractAddress --chain base
```

### Audit a protocol's contracts
```bash
# Scan multiple contracts
for addr in 0x123... 0x456... 0x789...; do
  white-rabbit scan $addr --deep --output $addr.json
done
```

### CI/CD Integration
```bash
white-rabbit scan $CONTRACT_ADDRESS --format sarif --output scan.sarif
```

## Output Interpretation

Findings are categorized by severity:
- 🔴 **Critical**: Immediate exploit risk
- 🟠 **High**: Significant vulnerability
- 🟡 **Medium**: Moderate concern
- 🔵 **Low**: Minor issue
- ⚪ **Informational**: Best practice suggestion

Each finding includes:
- Detector name and tool that found it
- Severity and confidence level
- File location (line numbers)
- Code snippet
- Corroboration count (how many tools agree)

## MCP Tools (when using with @whiteclaws/mcp)

When integrated with the WhiteClaws MCP server, these tools are available:

### `wc_scan_contract`
Scan a contract and return findings.

```json
{
  "address": "0x1234...",
  "chain": "base",
  "quick": true
}
```

### `wc_analyze_source`
Analyze source code directly without on-chain contract.

```json
{
  "sourceCode": "contract Example { ... }",
  "compilerVersion": "0.8.19"
}
```

### `wc_verify_finding`
Verify a specific finding with AI analysis.

```json
{
  "findingId": "finding-ulid",
  "context": "This is a lending protocol that uses Chainlink oracles"
}
```

## References

- GitHub: https://github.com/ChicoPanama/White-Rabbit
- Documentation: https://whiteclaws.app/docs/white-rabbit
- npm: https://www.npmjs.com/package/@whiteclaws/white-rabbit
