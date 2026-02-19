# Contributing to WhiteRabbit

Thank you for your interest in contributing to WhiteRabbit! This document provides guidelines for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Testing](#testing)
- [Adding New Patterns](#adding-new-patterns)
- [Pull Request Process](#pull-request-process)

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm 9+ or pnpm 8+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/whiteclaws/white-rabbit.git
cd white-rabbit

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

### Monorepo Structure

```
white-rabbit/
├── packages/
│   ├── white-rabbit/        # Core scanner package
│   │   ├── src/
│   │   │   ├── cli/         # CLI commands
│   │   │   ├── core/        # Core classes
│   │   │   ├── engines/     # Analysis engines
│   │   │   ├── connectors/  # API connectors
│   │   │   ├── intelligence/# Protocol intel
│   │   │   └── tests/       # Test files
│   │   ├── data/
│   │   │   └── patterns/    # JSON pattern files
│   │   └── package.json
│   └── mcp-white-rabbit/    # MCP server package
├── app/                     # Next.js web app
└── package.json            # Root workspace config
```

## Project Structure

### Key Files

| File | Purpose |
|------|---------|
| `src/core/white-rabbit.ts` | Main scanner class |
| `src/engines/pattern.ts` | Pattern detection engine |
| `src/engines/pattern-registry-compat.ts` | Pattern loader |
| `data/patterns/*.json` | Vulnerability patterns |
| `src/cli/commands/*.ts` | CLI command implementations |

### Pattern Files

Pattern files are in `data/patterns/`:

```json
{
  "id": "reentrancy",
  "name": "Reentrancy Vulnerability",
  "version": "1.0.0",
  "cwe": "CWE-841",
  "severity": "high",
  "detectors": [
    {
      "id": "external-call-before-state",
      "name": "External Call Before State Change",
      "pattern": "regex-pattern-here",
      "safePatterns": ["nonReentrant"]
    }
  ]
}
```

## Code Style

### TypeScript

- Use strict TypeScript (`strict: true`)
- Explicit return types on public methods
- JSDoc comments for public APIs

```typescript
/**
 * Analyzes a contract for vulnerabilities
 * @param contract - The contract to analyze
 * @returns Engine results with findings
 */
async analyze(contract: Contract): Promise<EngineResult> {
  // Implementation
}
```

### Naming Conventions

- `PascalCase` for classes and interfaces
- `camelCase` for variables and functions
- `SCREAMING_SNAKE_CASE` for constants
- `kebab-case` for file names

### Comments

Use the header style for major sections:

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// Section Name
// ═══════════════════════════════════════════════════════════════════════════════
```

## Testing

### Running Tests

```bash
# All tests
npm test

# Specific test file
node --test dist/tests/integration.test.js

# With coverage (future)
npm run test:coverage
```

### Writing Tests

Use Node.js built-in test runner:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Feature Name', async () => {
  test('should do something', async () => {
    const result = await something();
    assert.strictEqual(result, expected);
  });
});
```

### Test Categories

1. **Unit Tests** - Individual functions/classes
2. **Integration Tests** - Full workflows
3. **Pattern Tests** - Vulnerability detection accuracy

### Test Fixtures

Place test contracts in `src/tests/fixtures/`:

```solidity
// VulnerableReentrancy.sol
contract Vulnerable {
  function withdraw() public {
    msg.sender.call{value: 1 ether}("");  // Vulnerable
  }
}
```

## Adding New Patterns

### 1. Create Pattern File

Create `data/patterns/your-pattern.json`:

```json
{
  "id": "your-pattern-id",
  "name": "Human Readable Name",
  "version": "1.0.0",
  "description": "What this vulnerability is",
  "cwe": "CWE-XXX",
  "severity": "high",
  "confidence": "medium",
  "detectors": [
    {
      "id": "specific-detector",
      "name": "Detector Name",
      "description": "What this detector looks for",
      "pattern": "regex-pattern",
      "flags": "i",
      "safePatterns": ["safe-indicator"],
      "examples": [
        "vulnerable code example"
      ]
    }
  ],
  "remediation": "How to fix this issue",
  "references": [
    "https://swcregistry.io/..."
  ],
  "historical": [
    {
      "protocol": "ProtocolName",
      "date": "2023-01-01",
      "loss": "$X,XXX,XXX",
      "description": "What happened"
    }
  ]
}
```

### 2. Update Registry

Add to `data/patterns/index.json`:

```json
{
  "patterns": [
    {
      "id": "your-pattern-id",
      "file": "your-pattern.json",
      "category": "category-name",
      "severity": "high",
      "cwe": "CWE-XXX",
      "detectorCount": 1
    }
  ],
  "categories": {
    "category-name": {
      "name": "Category Name",
      "patterns": ["your-pattern-id"]
    }
  }
}
```

### 3. Add Tests

Create test in `src/tests/patterns/`:

```typescript
test('should detect your vulnerability', async () => {
  const engine = new PatternEngine();
  const contract = createTestContract('Test', `
    contract Test {
      function vulnerable() public {
        // vulnerable code
      }
    }
  `);
  
  const result = await engine.analyze(contract);
  const finding = result.findings.find(f => f.detectorName === 'your-detector');
  assert.ok(finding);
});
```

### 4. Document

Update API.md and README.md with new pattern information.

## Pull Request Process

### Before Submitting

1. **Tests Pass**
   ```bash
   npm run build
   npm test
   ```

2. **Lint Clean**
   ```bash
   npm run lint
   ```

3. **Type Check**
   ```bash
   npm run typecheck
   ```

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Commit messages are descriptive
- [ ] No breaking changes (or clearly documented)

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Build/config

Examples:
```
feat(pattern): add flash loan detection patterns

Add 3 new detectors for flash loan vulnerabilities
including balancer, aave, and uniswap variants.

Closes #123
```

### Review Process

1. PR submitted
2. CI checks run
3. Code review by maintainer
4. Changes requested (if any)
5. Approved and merged

## Release Process

Maintainers handle releases:

1. Version bump in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag
4. Publish to npm
5. Create GitHub release

## Getting Help

- 📖 [Documentation](./API.md)
- 💬 [Discord](https://discord.gg/whiteclaws)
- 🐛 [Issue Tracker](https://github.com/whiteclaws/white-rabbit/issues)

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what's best for the community
- Show empathy towards others

Thank you for contributing! 🎉
