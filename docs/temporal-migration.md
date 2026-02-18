# Temporal Migration Guide

## Overview

White-Rabbit supports two orchestration modes:

| Mode | Env Var | Stack | Status |
|------|---------|-------|--------|
| **Legacy** | `ORCHESTRATOR=legacy` | PM2 + BullMQ + Redis | Default, battle-tested |
| **Temporal** | `ORCHESTRATOR=temporal` | Temporal Server + Worker | New, recommended for production |

## Quick Start (Temporal)

```bash
# 1. Start Temporal infrastructure (Docker)
./temporal-start.sh --no-worker

# 2. Start the scanner worker (separate terminal)
npx tsx src/temporal/worker.ts

# 3. Run a scan
./scanner start --address 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum

# 4. Check status
./scanner status <session-id>

# 5. List recent scans
./scanner list
```

## Architecture

### Legacy Mode (PM2 + BullMQ)
```
PM2 ──► index.ts (one-shot) ──► Scanner.runFullScan() ──► BullMQ workers
```

### Temporal Mode
```
Client ──► Temporal Server ──► Worker ──► Workflow (5 phases)
                                              │
                                              ├── discoveryActivity
                                              ├── staticAnalysisActivity
                                              ├── vulnerabilityHypothesisActivity (x6 parallel)
                                              ├── verificationActivity (parallel, only with findings)
                                              └── reportActivity
```

## Configuration

### Environment Variables

```bash
# Choose orchestrator
ORCHESTRATOR=temporal          # or 'legacy' (default)

# Temporal connection
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=white-rabbit
TEMPORAL_TASK_QUEUE=scanner-queue
```

### Docker Infrastructure

```bash
# Start everything (Temporal server + DB + UI + worker)
docker compose -f docker-compose.temporal.yml up -d

# Start infrastructure only (run worker locally for development)
./temporal-start.sh --no-worker

# Stop
docker compose -f docker-compose.temporal.yml down
```

### Web UI

The Temporal Web UI is available at `http://localhost:8233` when infrastructure is running.
You can view workflow history, progress, and debug failed activities there.

## CLI Reference

### `./scanner` (unified CLI)

| Command | Description |
|---------|-------------|
| `./scanner start [opts]` | Start a scan workflow |
| `./scanner status <id>` | Query workflow progress |
| `./scanner result <id>` | Wait for scan result |
| `./scanner list [limit]` | List recent workflows |
| `./scanner cancel <id>` | Cancel running scan |
| `./scanner worker` | Start Temporal worker |
| `./scanner infra` | Start Docker infrastructure |
| `./scanner legacy [args]` | Run legacy PM2 scanner |

### Start Options

| Flag | Description |
|------|-------------|
| `--address <addr>` | Contract address to scan |
| `--chain <chain>` | Target chain (default: ethereum) |
| `--protocol <name>` | Protocol name for context |
| `--config <path>` | YAML config file |
| `--dry-run` | Skip external API calls |
| `--session <id>` | Custom session ID |

### Query Tool (direct)

```bash
npx tsx src/temporal/query.ts progress <sessionId>
npx tsx src/temporal/query.ts describe <sessionId>
npx tsx src/temporal/query.ts list [limit]
npx tsx src/temporal/query.ts result <sessionId>
npx tsx src/temporal/query.ts cancel <sessionId>
```

## Workflow Phases

| Phase | Activity | Parallelism | Timeout | Retries |
|-------|----------|-------------|---------|---------|
| 1. Discovery | `discoveryActivity` | Sequential | 10 min | 3 |
| 2. Static Analysis | `staticAnalysisActivity` | Sequential | 10 min | 3 |
| 3. Vuln Hypothesis | `vulnerabilityHypothesisActivity` | 6x parallel | 10 min each | 3 |
| 4. Verification | `verificationActivity` | Parallel (findings only) | 10 min each | 3 |
| 5. Report | `reportActivity` | Sequential | 10 min | 3 |

## Error Handling

- **Non-retryable errors** (`ConfigError`, `ValidationError`, `TemplateNotFoundError`) immediately fail without retry
- **Retryable errors** get 3 attempts with 5s initial backoff, 2x coefficient, 2min max interval
- **Activity heartbeats** every 60s — Temporal detects stuck activities
- **Workflow timeout** is 1 hour for the entire pipeline
- **Partial failures** — the pipeline continues even if some vuln types fail

## Migration Checklist

1. [ ] Install Temporal dependencies: `npm install`
2. [ ] Start Docker infrastructure: `./temporal-start.sh --no-worker`
3. [ ] Verify Temporal UI at `http://localhost:8233`
4. [ ] Test with dry run: `./scanner start --dry-run --config configs/default-config.yaml`
5. [ ] Set `ORCHESTRATOR=temporal` in `.env`
6. [ ] Start worker: `./scanner worker` (or via PM2/systemd)
7. [ ] Run a real scan: `./scanner start --address <addr> --chain ethereum`
8. [ ] Monitor at `http://localhost:8233`

## Rollback

To switch back to the legacy pipeline:

```bash
# In .env
ORCHESTRATOR=legacy

# Or just use the legacy subcommand
./scanner legacy audit 0xADDRESS
```

No data migration is needed — both modes write to the same deliverables directory and database.
