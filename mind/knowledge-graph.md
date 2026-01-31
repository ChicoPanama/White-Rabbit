# Knowledge Graph Schema

## Entities
- Vulnerabilities (with root causes, not just names)
- Protocols (with their forks and versions)
- Contracts (with their relationships)
- Patterns (code patterns that indicate risk)
- Chains (with their specific quirks)

## Relationships
- Vulnerability --EXPLOITS--> Protocol
- Protocol --FORKED_FROM--> Protocol
- Pattern --INDICATES--> Vulnerability
- Contract --CALLS--> Contract
- Contract --TRUSTS--> Contract

## Key Queries
- "Find all protocols that forked from X and haven't patched vulnerability Y"
- "What patterns co-occur with reentrancy vulnerabilities?"
- "Which contracts trust this oracle?"
