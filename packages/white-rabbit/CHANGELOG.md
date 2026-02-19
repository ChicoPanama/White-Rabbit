# Changelog

All notable changes to `@whiteclaws/white-rabbit` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

## [2.0.0-alpha.1] - 2024-02-19

### Added
- Initial alpha release of WhiteRabbit 2.0
- Complete TypeScript rewrite with full type safety
- JSON Pattern Database for vulnerability detection
  - Reentrancy patterns
  - Access control patterns
  - Oracle manipulation patterns
  - Flash loan patterns
  - Integer overflow patterns
  - Governance attack patterns
  - Price manipulation patterns
- PatternRegistryLoader for dynamic pattern loading
- Multi-engine analysis pipeline
  - PatternEngine (always available)
  - Slither integration (optional)
  - Mythril integration (optional)
  - Securify integration (optional)
- Extended CLI with 10+ commands
  - `scan` - Full contract scan
  - `quick` - Fast pattern-only scan
  - `deep` - Comprehensive analysis
  - `analyze` - Local file analysis
  - `hunt` - Search vulnerability patterns
  - `submit` - Submit for audit
  - `status` - Check scan status
  - `engines` - List available engines
  - `chains` - List supported chains
  - `config` - Configuration management
- WhiteClaws Connector integration
  - ChainConnector (30+ chains)
  - DeFiLlama integration
  - ProtocolIntelligence
  - Known vulnerability database
- Server-side infrastructure
  - Supabase integration
  - ServerWorker for job processing
  - API routes for Next.js
- MCP (Model Context Protocol) server
  - `analyze_contract` tool
  - `search_patterns` tool
  - `get_vulnerability_info` tool
- Comprehensive test suite (36+ tests)
- Full documentation (README, API, SECURITY, CONTRIBUTING)
- CI/CD with GitHub Actions
- Automated security scanning

### Changed
- Complete architecture redesign for modularity
- Improved performance (50ms for small contracts)
- Better error handling and reporting

### Security
- Pattern-based detection with safe-pattern recognition
- No hardcoded secrets
- Automated secret scanning in CI/CD
- npm provenance enabled

## [1.0.0] - 2024-01-01

### Added
- Initial release (legacy version)

[Unreleased]: https://github.com/whiteclaws/white-rabbit/compare/v2.0.0-alpha.1...HEAD
[2.0.0-alpha.1]: https://github.com/whiteclaws/white-rabbit/releases/tag/v2.0.0-alpha.1
[1.0.0]: https://github.com/whiteclaws/white-rabbit/releases/tag/v1.0.0
