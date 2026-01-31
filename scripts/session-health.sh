#!/bin/bash
# Session health monitor

SESSION_DIR="$HOME/.clawdbot/agents/white-rabbit/sessions"
ACTIVE_SESSION=$(jq -r '."agent:white-rabbit:dm:1309504379".sessionId' "$SESSION_DIR/sessions.json" 2>/dev/null)

echo "=== Session Health Report ==="
echo "Active Session: $ACTIVE_SESSION"

if [ -n "$ACTIVE_SESSION" ] && [ "$ACTIVE_SESSION" != "null" ]; then
  SESSION_FILE="$SESSION_DIR/$ACTIVE_SESSION.jsonl"
  if [ -f "$SESSION_FILE" ]; then
    SIZE=$(stat -c%s "$SESSION_FILE")
    LINES=$(wc -l < "$SESSION_FILE")
    TOKENS=$((SIZE / 4))

    echo "Size: $(numfmt --to=iec $SIZE)"
    echo "Messages: $LINES"
    echo "Est. Tokens: $TOKENS"

    if [ $TOKENS -gt 80000 ]; then
      echo "⚠️  WARNING: Approaching context limit!"
    elif [ $TOKENS -gt 60000 ]; then
      echo "⚡ NOTICE: Session growing large"
    else
      echo "✅ Healthy"
    fi
  fi
fi

echo ""
echo "=== Largest Sessions ==="
ls -lhS "$SESSION_DIR"/*.jsonl 2>/dev/null | head -5

echo ""
echo "=== Backed Up Sessions ==="
ls -lh "$SESSION_DIR/backups/" 2>/dev/null | tail -5
