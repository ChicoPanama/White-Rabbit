#!/usr/bin/env bash
# audit.sh — Audit a single contract address
# Usage: ./scripts/audit.sh <address> [--chain <name>]
# Example: ./scripts/audit.sh 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

ADDRESS="${1:-}"

if [ -z "$ADDRESS" ]; then
  echo "Usage: audit.sh <address> [--chain <name>]"
  echo "Example: audit.sh 0x7a25...88D --chain ethereum"
  exit 1
fi

shift
echo "[White-Rabbit] Auditing $ADDRESS..."
cd "$PROJECT_DIR"
exec npx tsx src/cli.ts audit "$ADDRESS" "$@"
