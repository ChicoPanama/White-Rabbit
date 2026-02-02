# TOOLS.md - Vulnerability Hunting Setup

## Foundry/Forge
- **Path**: `/home/ubuntu/.foundry/bin/`
- **Status**: ✅ Installed
- **Tools**: forge, cast, anvil, chisel, foundryup
- **Usage**: `/home/ubuntu/.foundry/bin/forge test --fork-url <RPC>`

## RPC Endpoints
| Chain | URL | Notes |
|-------|-----|-------|
| Base | https://base-rpc.publicnode.com | Pinto lives here |
| Ethereum | https://eth.llamarpc.com | Backup |

## Quick Commands
```bash
# Run fork test
~/.foundry/bin/forge test --fork-url https://base-rpc.publicnode.com

# Cast call
~/.foundry/bin/cast call <contract> <sig> --rpc-url <url>
```

## Gate System
- **Location**: `/home/ubuntu/clawd/gate/`
- **Prepare**: `gate/prepare-candidate.sh <protocol> <finding> <chain> <contract>`
- **Run**: `gate/run-gate.sh <candidate-dir>`
- **Results**: `gate-results.json`

---
*Last updated: 2026-02-02*
