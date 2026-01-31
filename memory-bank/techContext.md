# Tech Context — Infrastructure Configuration

## Servers

### AWS EC2 (White-Rabbit Scanner)
- **Instance:** t2.medium (2 vCPU, 3.8 GB RAM)
- **OS:** Ubuntu 24.04.3 LTS
- **Node.js:** v22.22.0
- **Disk:** 29 GB total, ~20% used
- **Location:** ~/White-Rabbit (scanner code)
- **Working Dir:** ~/clawd (memory & intelligence)

## Services

### PM2 Managed
```
white-rabbit-scanner (id: 2) - Scan loop (one-shot design)
white-rabbit-worker (id: 1) - BullMQ job queue
```

### Systemd Managed
```
clawdbot-gateway.service - Telegram bot + orchestration
```

## API Configuration

### AI Models (OpenRouter)
```json
{
  "primary": "openrouter/anthropic/claude-sonnet-4",
  "fallbacks": ["openrouter/anthropic/claude-3.5-haiku"]
}
```
- Auth: OPENROUTER_API_KEY in systemd environment

### External APIs
| Service | Status | Notes |
|---------|--------|-------|
| OpenRouter | Active | Claude Sonnet + Haiku |
| Etherscan | Active | V2 API (all chains) |
| Telegram | Active | @WhiteRabbitClawdBot |
| Brave Search | Not Set | BRAVE_API_KEY missing |

## Database

### PostgreSQL
- Database: whiterabbit
- Tables: contracts (19+), scans (409+), findings (2,848+)
- Access: `sudo -u postgres psql -d whiterabbit`

### Redis
- Purpose: BullMQ queue backend
- Status: Active

## RPC Configuration
Primary provider: PublicNode (free, no rate limits)

### Tier 1 (Major Networks)
- Ethereum: https://ethereum-rpc.publicnode.com
- BSC: https://bsc-rpc.publicnode.com
- Polygon: https://polygon-bor-rpc.publicnode.com
- Arbitrum: https://arbitrum-one-rpc.publicnode.com
- Base: https://base-rpc.publicnode.com

### Tier 2 (Secondary Networks)
- Optimism: https://optimism-rpc.publicnode.com
- Avalanche: https://avalanche-c-chain-rpc.publicnode.com
- Fantom: https://fantom-rpc.publicnode.com

## Analysis Tools

| Tool | Status | Purpose |
|------|--------|---------|
| Slither | v0.11.5 (pip) | Static analysis |
| Foundry (forge) | Not Installed | PoC verification |

## Token Limits
- Context window: 200K tokens
- Safe threshold: 150K tokens (trigger compression above this)
- Max output: 2048 tokens (prevent runaway responses)

## Service Commands
```bash
# Scanner
pm2 logs white-rabbit-scanner --lines 50
pm2 restart white-rabbit-scanner

# Clawdbot
systemctl --user status clawdbot-gateway
systemctl --user restart clawdbot-gateway

# Database
sudo -u postgres psql -d whiterabbit
```

---
*Last Updated: 2026-01-30T22:40:00Z*
