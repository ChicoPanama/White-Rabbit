#!/usr/bin/env bash
# chains.sh — Show top chains ranked by TVL from DeFiLlama
# Usage: ./scripts/chains.sh [--top <n>]
# Example: ./scripts/chains.sh
# Example: ./scripts/chains.sh --top 20

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

cd "$PROJECT_DIR"
exec npx tsx src/cli.ts chains "$@"
