#!/usr/bin/env bash
# hunt.sh — Start autonomous scanning loop
# Usage: ./scripts/hunt.sh [--top-chains <n>] [--networks <list>] [--interval <min>] [--min-tvl <usd>]
# Example: ./scripts/hunt.sh --top-chains 10
# Example: ./scripts/hunt.sh --networks ethereum,base --interval 30
# Example: ./scripts/hunt.sh --top-chains 5 --min-tvl 1000000

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

echo "[White-Rabbit] Starting autonomous hunting mode..."
echo "  Press Ctrl+C to stop"
echo ""

cd "$PROJECT_DIR"
exec npx tsx src/cli.ts auto "$@"
