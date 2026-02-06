#!/bin/bash
set -e

# Start Temporal infrastructure for White-Rabbit scanner.
# Usage: ./temporal-start.sh [--no-worker]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

NO_WORKER=false
if [ "$1" = "--no-worker" ]; then
  NO_WORKER=true
fi

echo "=== White-Rabbit Temporal Infrastructure ==="
echo ""

# Start Temporal server + DB + UI
echo "[1/3] Starting Temporal infrastructure..."
docker compose -f docker-compose.temporal.yml up -d temporal-db temporal temporal-ui

# Wait for Temporal to be healthy
echo "[2/3] Waiting for Temporal server to be ready..."
MAX_RETRIES=30
RETRY=0
until docker compose -f docker-compose.temporal.yml exec -T temporal temporal operator cluster health 2>/dev/null | grep -q SERVING; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: Temporal server failed to start after ${MAX_RETRIES} retries"
    echo "Check logs: docker compose -f docker-compose.temporal.yml logs temporal"
    exit 1
  fi
  echo "  Waiting... ($RETRY/$MAX_RETRIES)"
  sleep 2
done
echo "  Temporal server is ready."

# Create namespace if it doesn't exist
echo "[3/3] Ensuring namespace exists..."
docker compose -f docker-compose.temporal.yml exec -T temporal temporal operator namespace describe white-rabbit 2>/dev/null || \
  docker compose -f docker-compose.temporal.yml exec -T temporal temporal operator namespace create white-rabbit 2>/dev/null || true

echo ""
echo "=== Temporal Infrastructure Ready ==="
echo ""
echo "  Server:  localhost:7233"
echo "  Web UI:  http://localhost:8233"
echo "  DB:      localhost:5433"
echo ""

if [ "$NO_WORKER" = false ]; then
  echo "Starting scanner worker..."
  echo "  (Press Ctrl+C to stop)"
  echo ""
  npx tsx src/temporal/worker.ts
else
  echo "Worker not started (--no-worker flag)."
  echo "Start manually with: npx tsx src/temporal/worker.ts"
fi
