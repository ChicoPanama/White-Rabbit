#!/usr/bin/env bash
# install-clawd.sh — Install White Rabbit as a Clawd bot skill
# Sets up config, symlinks, cron jobs, and validates environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLAWD_DIR="$HOME/.clawdbot"
CLAWD_SKILLS="$CLAWD_DIR/skills"
STATE_DIR="$HOME/.etherscan-auditor"

echo "================================================"
echo "  White Rabbit - Clawd Bot Installation"
echo "================================================"
echo ""

# ── Step 1: Create directories ──
echo "[1/6] Creating directories..."
mkdir -p "$CLAWD_DIR"
mkdir -p "$CLAWD_SKILLS/contract-scanner"
mkdir -p "$STATE_DIR"
echo "  Created $CLAWD_DIR"
echo "  Created $CLAWD_SKILLS/contract-scanner"
echo "  Created $STATE_DIR"

# ── Step 2: Copy/symlink config ──
echo ""
echo "[2/6] Installing Clawd config..."
cp "$SCRIPT_DIR/clawdbot.json" "$CLAWD_DIR/clawdbot.json"
echo "  Installed clawdbot.json"

# Symlink SKILL.md
ln -sf "$PROJECT_DIR/skills/contract-scanner/SKILL.md" "$CLAWD_SKILLS/contract-scanner/SKILL.md"
echo "  Linked SKILL.md"

# ── Step 3: Install Node dependencies ──
echo ""
echo "[3/6] Installing Node dependencies..."
cd "$PROJECT_DIR"
if [ -f "package-lock.json" ]; then
  npm ci --silent 2>/dev/null || npm install --silent
else
  npm install --silent
fi
echo "  Dependencies installed"

# ── Step 4: Validate environment ──
echo ""
echo "[4/6] Validating environment..."

MISSING_REQUIRED=()
MISSING_RECOMMENDED=()

# Required
for var in ETHERSCAN_API_KEY TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID; do
  if [ -z "${!var:-}" ]; then
    MISSING_REQUIRED+=("$var")
  fi
done

# Recommended
for var in ANTHROPIC_API_KEY ETH_RPC_URL DATABASE_URL REDIS_URL; do
  if [ -z "${!var:-}" ]; then
    MISSING_RECOMMENDED+=("$var")
  fi
done

if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
  echo "  WARNING: Missing required env vars:"
  for var in "${MISSING_REQUIRED[@]}"; do
    echo "    - $var"
  done
  echo ""
  echo "  Set these in $PROJECT_DIR/.env or export them."
  echo "  See $PROJECT_DIR/.env.example for reference."
else
  echo "  All required env vars present"
fi

if [ ${#MISSING_RECOMMENDED[@]} -gt 0 ]; then
  echo "  Note: Missing recommended env vars:"
  for var in "${MISSING_RECOMMENDED[@]}"; do
    echo "    - $var"
  done
fi

# ── Step 5: Check tools ──
echo ""
echo "[5/6] Checking tools..."

check_tool() {
  if command -v "$1" &>/dev/null; then
    echo "  [OK] $1"
    return 0
  else
    echo "  [MISSING] $1 - $2"
    return 1
  fi
}

check_tool "node" "Install from https://nodejs.org" || true
check_tool "npx" "Included with Node.js" || true
check_tool "slither" "pip install slither-analyzer" || true
check_tool "forge" "curl -L https://foundry.paradigm.xyz | bash && foundryup" || true
check_tool "solc" "solc-select install 0.8.20 && solc-select use 0.8.20" || true

# ── Step 6: Initialize state ──
echo ""
echo "[6/6] Initializing scanner state..."
if [ ! -f "$STATE_DIR/state.json" ]; then
  cat > "$STATE_DIR/state.json" << 'STATEJSON'
{
  "autonomous": {
    "enabled": false,
    "startedAt": null,
    "pid": null
  },
  "config": {
    "networks": ["ethereum", "base", "arbitrum"],
    "minTvlUsd": 10000000,
    "intervalMinutes": 30,
    "alertThreshold": "medium"
  },
  "stats": {
    "totalScans": 0,
    "contractsScanned": 0,
    "verifiedVulns": 0,
    "likelyRealVulns": 0,
    "falsePositivesFiltered": 0,
    "alertsSent": 0,
    "lastScanAt": null,
    "lastScanPerNetwork": {}
  },
  "recentFindings": []
}
STATEJSON
  echo "  Created initial state at $STATE_DIR/state.json"
else
  echo "  State file already exists (preserved)"
fi

# ── Done ──
echo ""
echo "================================================"
echo "  Installation complete!"
echo "================================================"
echo ""
echo "Quick start:"
echo "  ./scripts/hunt.sh                    # Start autonomous scanning"
echo "  ./scripts/audit.sh 0xADDRESS         # Audit a contract"
echo "  ./scripts/scan.sh ethereum            # Scan a network"
echo "  ./scripts/status.sh                   # Check status"
echo ""
echo "Clawd bot commands:"
echo '  "start hunting"                       # Begin autonomous mode'
echo '  "scan ethereum"                       # Scan specific network'
echo '  "audit 0x..."                         # Audit specific contract'
echo '  "status"                              # Scanner status'
echo '  "what did you find"                   # Recent findings'
echo ""

if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
  echo "NOTE: Set missing required env vars before running scans."
  exit 1
fi
