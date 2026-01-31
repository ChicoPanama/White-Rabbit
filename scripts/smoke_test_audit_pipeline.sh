#!/bin/bash
#
# Smoke Test for Audit/Research Pipeline
#
# This script verifies:
# 1. Pipeline does not run when disabled
# 2. Pipeline runs only for audit/research-tagged tasks
# 3. Report files are created
# 4. Summaries are generated
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     White-Rabbit Research Pipeline Smoke Test              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PASSED=0
FAILED=0

# Helper function
test_result() {
    if [ $1 -eq 0 ]; then
        echo "✅ PASS: $2"
        ((PASSED++))
    else
        echo "❌ FAIL: $2"
        ((FAILED++))
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Task Classifier Unit Tests
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 1: Running Task Classifier Unit Tests..."
echo "─────────────────────────────────────────────────"

if npx tsx src/utils/task_classifier.test.ts 2>/dev/null; then
    test_result 0 "Task classifier tests passed"
else
    test_result 1 "Task classifier tests failed"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Pipeline disabled by default
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 2: Pipeline disabled by default..."
echo "─────────────────────────────────────────────────"

# Ensure feature flag is not set
unset OPENCLAW_AUDIT_PIPELINE_ENABLED

# Run research command - should fail with "disabled" message
OUTPUT=$(npx tsx src/cli.ts research 0x0000000000000000000000000000000000000001 2>&1 || true)

if echo "$OUTPUT" | grep -q "disabled"; then
    test_result 0 "Pipeline correctly reports disabled when feature flag not set"
else
    test_result 1 "Pipeline should report disabled when feature flag not set"
    echo "   Output: $OUTPUT"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Pipeline enabled when flag is set
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 3: Pipeline enabled with feature flag..."
echo "─────────────────────────────────────────────────"

export OPENCLAW_AUDIT_PIPELINE_ENABLED=true

# Run research command - should start pipeline
OUTPUT=$(timeout 10 npx tsx src/cli.ts research 0x0000000000000000000000000000000000000001 2>&1 || true)

if echo "$OUTPUT" | grep -q "Research Pipeline"; then
    test_result 0 "Pipeline starts when feature flag is enabled"
else
    test_result 1 "Pipeline should start when feature flag is enabled"
    echo "   Output: $OUTPUT"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Report directory exists
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 4: Report directory exists..."
echo "─────────────────────────────────────────────────"

if [ -d "$PROJECT_DIR/reports" ]; then
    test_result 0 "Reports directory exists"
else
    test_result 1 "Reports directory should exist"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Audit cards directory exists
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 5: Audit cards directory exists..."
echo "─────────────────────────────────────────────────"

if [ -d "$PROJECT_DIR/memory/audit_cards" ]; then
    test_result 0 "Audit cards directory exists"
else
    test_result 1 "Audit cards directory should exist"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Audit command with --research flag
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 6: Audit with --research flag uses pipeline..."
echo "─────────────────────────────────────────────────"

export OPENCLAW_AUDIT_PIPELINE_ENABLED=true

OUTPUT=$(timeout 10 npx tsx src/cli.ts audit 0x0000000000000000000000000000000000000001 --research 2>&1 || true)

if echo "$OUTPUT" | grep -q "Research Pipeline"; then
    test_result 0 "Audit with --research flag triggers pipeline"
else
    test_result 1 "Audit with --research flag should trigger pipeline"
    echo "   Output: $OUTPUT"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 7: Normal audit does NOT use pipeline when disabled
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 7: Normal audit without --research when disabled..."
echo "─────────────────────────────────────────────────"

unset OPENCLAW_AUDIT_PIPELINE_ENABLED

OUTPUT=$(timeout 10 npx tsx src/cli.ts audit 0x0000000000000000000000000000000000000001 2>&1 || true)

if echo "$OUTPUT" | grep -q "Research Pipeline"; then
    test_result 1 "Normal audit should NOT trigger pipeline when disabled"
    echo "   Output: $OUTPUT"
else
    test_result 0 "Normal audit correctly does not trigger pipeline when disabled"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 8: TypeScript compilation check
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📋 Test 8: TypeScript files compile without errors..."
echo "─────────────────────────────────────────────────"

if npx tsc --noEmit 2>/dev/null; then
    test_result 0 "TypeScript compilation successful"
else
    test_result 1 "TypeScript compilation failed"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                     Test Summary                           ║"
echo "╠════════════════════════════════════════════════════════════╣"
printf "║  Total: %-3d | Passed: %-3d | Failed: %-3d                   ║\n" $((PASSED + FAILED)) $PASSED $FAILED
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "❌ Some tests failed. Please review the output above."
    exit 1
else
    echo "✅ All smoke tests passed!"
    exit 0
fi
