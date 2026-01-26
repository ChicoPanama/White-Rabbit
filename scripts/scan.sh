#!/usr/bin/env bash
# scan.sh — Run a vulnerability scan on a specific network
# Usage: ./scripts/scan.sh <network>
# Example: ./scripts/scan.sh ethereum

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

NETWORK="${1:-}"

if [ -z "$NETWORK" ]; then
  echo "Usage: scan.sh <network>"
  echo "Available networks: ethereum, base, arbitrum, polygon, optimism"
  exit 1
fi

echo "[White-Rabbit] Scanning $NETWORK..."
cd "$PROJECT_DIR"
exec npx tsx src/cli.ts scan "$NETWORK"
