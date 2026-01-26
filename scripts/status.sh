#!/usr/bin/env bash
# status.sh — Show scanner status and recent findings
# Usage: ./scripts/status.sh [findings] [--limit <n>]
# Example: ./scripts/status.sh
# Example: ./scripts/status.sh findings --limit 20

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

SUBCMD="${1:-stats}"

cd "$PROJECT_DIR"

case "$SUBCMD" in
  findings|f)
    shift
    exec npx tsx src/cli.ts findings "$@"
    ;;
  stats|status|s|*)
    exec npx tsx src/cli.ts stats
    ;;
esac
