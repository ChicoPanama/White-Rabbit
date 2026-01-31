#!/bin/bash
# Test White-Rabbit Memory System

echo "============================================="
echo "White-Rabbit Memory System Test"
echo "============================================="
echo ""

# Check if memory server is running
echo "1. Checking memory server health..."
HEALTH=$(curl -s http://localhost:8787/healthz 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "   Memory server: RUNNING"
  echo "   Response: $HEALTH"
else
  echo "   Memory server: NOT RUNNING"
  echo "   Start with: WR_MEMORY_HTTP_ENABLED=true npx tsx src/memory-server.ts"
fi
echo ""

# Test CLI memory command
echo "2. Testing CLI memory lookup..."
echo "   Command: npx tsx src/cli.ts memory 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum --includeSummaries --includeSimilar"
echo ""

cd ~/White-Rabbit
RESULT=$(npx tsx src/cli.ts memory 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum --includeSummaries --includeSimilar 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "   CLI memory lookup: SUCCESS"
  # Parse confidence score
  CONFIDENCE=$(echo "$RESULT" | grep -o '"score": [0-9.]*' | head -1 | cut -d: -f2)
  RECOMMENDATION=$(echo "$RESULT" | grep -o '"recommendation": "[^"]*"' | head -1 | cut -d: -f2)
  echo "   Confidence score:$CONFIDENCE"
  echo "   Recommendation:$RECOMMENDATION"
else
  echo "   CLI memory lookup: FAILED (this may be expected if no data exists)"
fi
echo ""

# Test determinism
echo "3. Testing confidence determinism..."
echo "   Running 3 iterations to verify same input = same output..."
SCORES=()
for i in 1 2 3; do
  S=$(npx tsx src/cli.ts memory 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum 2>/dev/null | grep -o '"score": [0-9.]*' | head -1 | cut -d: -f2)
  SCORES+=("$S")
  echo "   Iteration $i: score=$S"
done

if [ "${SCORES[0]}" == "${SCORES[1]}" ] && [ "${SCORES[1]}" == "${SCORES[2]}" ]; then
  echo "   Determinism: PASS (all scores match)"
else
  echo "   Determinism: FAIL (scores differ)"
fi
echo ""

echo "============================================="
echo "Test complete"
echo "============================================="
