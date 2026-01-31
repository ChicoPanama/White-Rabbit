# Knowledge Graph Schema

## Entities

### Protocol
- name: string
- category: string (DEX, lending, bridge, yield, etc.)
- chains: string[] (deployed chains)
- tvl: number (total value locked)
- auditStatus: string (audited, unaudited, partially-audited)
- lastAuditDate: date
- govModel: string (multisig, DAO, single-admin)
- forkOf: Protocol? (parent protocol if fork)

### Contract
- address: string
- chain: string
- protocol: Protocol
- type: string (proxy, implementation, token, vault, etc.)
- deployDate: date
- compilerVersion: string
- verified: boolean
- codeHash: string
- structureHash: string

### Vulnerability
- id: string
- type: string (reentrancy, oracle-manipulation, access-control, etc.)
- severity: string (critical, high, medium, low)
- contract: Contract
- detector: string (slither detector name)
- confidence: number (0-100)
- exploitableValue: number (USD)
- verificationStatus: string (verified, likely-real, needs-review, likely-false, false-positive)
- pocResult: string? (succeeded, failed, not-tested)

### Pattern
- id: string
- type: string (vulnerability type)
- codeSignature: string (regex or hash)
- accuracy: number (0-1)
- instances: Contract[] (confirmed instances)
- discoveryDate: date
- lastMatchDate: date

### Hack
- id: string
- date: date
- protocol: Protocol
- amountLost: number (USD)
- technique: string
- chain: string
- postMortemUrl: string?

## Relationships

```
Protocol --deploys--> Contract
Protocol --fork-of--> Protocol
Contract --has-vulnerability--> Vulnerability
Vulnerability --matches-pattern--> Pattern
Pattern --found-in--> Contract
Protocol --was-hacked--> Hack
Hack --used-technique--> VulnerabilityType
Contract --interacts-with--> Contract
Protocol --uses-oracle--> Protocol
Protocol --deposits-into--> Protocol
```

## Query Patterns

### "Find all forks of a hacked protocol"
```
Protocol[hacked=true] --> fork-of --> Protocol[] --> deploys --> Contract[]
```

### "Find contracts with known vulnerability patterns"
```
Pattern[accuracy > 0.8] --> found-in --> Contract[] --> protocol --> Protocol[tvl > 1M]
```

### "Map oracle dependencies for a protocol"
```
Protocol --> uses-oracle --> Protocol --> deploys --> Contract[type=oracle]
```

### "Find cascade risk"
```
Protocol --> deposits-into --> Protocol --> has-vulnerability --> Vulnerability
```
