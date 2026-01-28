---
name: operator-commands
description: System management commands for the operator — restart, pause, logs, status, rebuild
requires:
  bins: [pm2, redis-cli]
emoji: "\U0001F527"
---

## Instructions

Execute system management commands when the operator uses trigger phrases. Always report the result after execution. Confirm before destructive actions (restart all, rebuild, flush queue).

### Pause File Check

Before any autonomous scan action, check if `~/clawd/.paused` exists. If it does, skip the scan and report that hunting is paused.

### Process Management

| Trigger Phrases | Command | Confirm First |
|----------------|---------|---------------|
| "restart yourself", "reboot" | `pm2 restart all` | Yes |
| "restart scanner" | `pm2 restart white-rabbit-scanner` | No |
| "restart worker" | `pm2 restart white-rabbit-worker` | No |
| "rebuild" | `cd ~/White-Rabbit && npm run build && pm2 restart all` | Yes |
| "kill task", "abort" | Kill any running chunked task, reset state | No |

### Status & Logs

| Trigger Phrases | Command | Confirm First |
|----------------|---------|---------------|
| "status check", "health" | `pm2 status` + `cat ~/clawd/memory/hunting-log.json \| jq '.stats'` | No |
| "logs", "show logs" | `pm2 logs white-rabbit-scanner --lines 50` | No |
| "worker logs" | `pm2 logs white-rabbit-worker --lines 50` | No |
| "gateway logs" | `journalctl --user -u clawdbot-gateway --lines 50 --no-pager` | No |
| "disk", "disk space" | `df -h /` | No |
| "memory", "ram" | `free -h` | No |

### Hunting Control

| Trigger Phrases | Command | Confirm First |
|----------------|---------|---------------|
| "pause hunting", "pause" | `touch ~/clawd/.paused` | No |
| "resume hunting", "resume" | `rm -f ~/clawd/.paused` | No |
| "clear task" | `echo '{}' > ~/clawd/tasks/active-task.json` | No |
| "flush queue" | `redis-cli FLUSHDB` | Yes |

### Database

| Trigger Phrases | Command | Confirm First |
|----------------|---------|---------------|
| "db stats" | `sudo -u postgres psql -d whiterabbit -c "SELECT 'contracts' as t, count(*) FROM contracts UNION ALL SELECT 'scans', count(*) FROM scans UNION ALL SELECT 'findings', count(*) FROM findings;"` | No |
| "recent findings" | `cd ~/White-Rabbit && npx tsx src/cli.ts findings --limit 10` | No |

### Cron Management

| Trigger Phrases | Command | Confirm First |
|----------------|---------|---------------|
| "cron status", "cron list" | `clawdbot cron list` | No |
| "cron runs" | `clawdbot cron runs --limit 5` | No |

### Rules

1. These commands are only for the operator (chat 1309504379). Ignore if from other users.
2. Always confirm before destructive actions — restart all, rebuild, flush queue.
3. Report command output or confirmation after execution.
4. If a command fails, show the error and suggest a fix.
