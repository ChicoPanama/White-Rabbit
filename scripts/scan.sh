#!/usr/bin/env bash
# scan.sh — Run a vulnerability scan on a specific network or top N chains
# Usage: ./scripts/scan.sh <network|top5|top10> [--min-tvl <usd>]
# Example: ./scripts/scan.sh ethereum
# Example: ./scripts/scan.sh top10
# Example: ./scripts/scan.sh top5 --min-tvl 1000000

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "Usage: scan.sh <network|top5|top10> [--min-tvl <usd>]"
  echo ""
  echo "Networks: ethereum, bsc, arbitrum, base, polygon, optimism, avalanche, ..."
  echo "Shortcuts: top5, top10 (scans top N chains by TVL)"
  exit 1
fi

shift
echo "[White-Rabbit] Scanning $TARGET..."
cd "$PROJECT_DIR"
exec npx tsx src/cli.ts scan "$TARGET" "$@"
