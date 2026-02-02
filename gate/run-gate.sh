#!/bin/bash
# VERIFICATION GATE — Hard enforcement
# Usage: ./run-gate.sh <candidate-dir>
# Exit 0 = ALL CHECKS PASSED (verified)
# Exit 1 = ANY CHECK FAILED (rejected)

set -euo pipefail

# Ensure Foundry is in PATH
export PATH="$PATH:/home/ubuntu/.foundry/bin:$HOME/.foundry/bin"

CANDIDATE_DIR="$1"
GATE_LOG="$CANDIDATE_DIR/gate-results.json"
PASSED=0
FAILED=0
RESULTS=()

echo "══════════════════════════════════════════"
echo " VERIFICATION GATE — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "══════════════════════════════════════════"

# ── CHECK 1: Does the PoC exist and compile? ──
echo ""
echo "CHECK 1: PoC Compilation"
if [ -f "$CANDIDATE_DIR/poc.sol" ]; then
    # Save current directory and cd to candidate
    pushd "$CANDIDATE_DIR" > /dev/null
    
    # Initialize Foundry project if needed
    if [ ! -f "foundry.toml" ]; then
        cat > foundry.toml << 'EOF'
[profile.default]
src = "."
out = "out"
libs = ["lib"]
EOF
    fi
    
    # Try to compile
    if forge build --contracts poc.sol 2>compile-errors.txt; then
        echo " ✅ PASS — PoC compiles"
        RESULTS+=('{"check":"compilation","status":"pass"}')
        ((PASSED++))
    else
        echo " ❌ FAIL — PoC does not compile"
        if [ -f compile-errors.txt ]; then
            echo " Errors: $(cat compile-errors.txt | tail -5)"
        fi
        RESULTS+=('{"check":"compilation","status":"fail","errors":"see compile-errors.txt"}')
        ((FAILED++))
    fi
    
    popd > /dev/null
else
    echo " ❌ FAIL — No poc.sol found in $CANDIDATE_DIR"
    RESULTS+=('{"check":"compilation","status":"fail","reason":"no poc.sol"}')
    ((FAILED++))
fi

# ── CHECK 2: Does the PoC pass on mainnet fork? ──
echo ""
echo "CHECK 2: Mainnet Fork Execution"

# Read chain RPC from candidate metadata
RPC_URL=""
if [ -f "$CANDIDATE_DIR/metadata.json" ]; then
    CHAIN_ID=$(cat "$CANDIDATE_DIR/metadata.json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('chainId', 1))" 2>/dev/null || echo "1")
    case "$CHAIN_ID" in
        1) RPC_URL="${ETH_RPC_URL:-https://ethereum-rpc.publicnode.com}" ;;
        8453) RPC_URL="${BASE_RPC_URL:-https://base-rpc.publicnode.com}" ;;
        42161) RPC_URL="${ARB_RPC_URL:-https://arbitrum-one-rpc.publicnode.com}" ;;
        10) RPC_URL="${OP_RPC_URL:-https://optimism-rpc.publicnode.com}" ;;
        *) RPC_URL="https://ethereum-rpc.publicnode.com" ;;
    esac
fi

if [ -n "$RPC_URL" ] && [ -f "$CANDIDATE_DIR/poc.sol" ]; then
    pushd "$CANDIDATE_DIR" > /dev/null
    if forge test --fork-url "$RPC_URL" --match-contract "Poc\|PoC\|POC\|Exploit\|Test" -vv 2>fork-errors.txt; then
        echo " ✅ PASS — Exploit succeeds on mainnet fork"
        RESULTS+=('{"check":"fork_execution","status":"pass"}')
        ((PASSED++))
    else
        echo " ❌ FAIL — Exploit fails on mainnet fork"
        if [ -f fork-errors.txt ]; then
            echo " Errors: $(cat fork-errors.txt | tail -10)"
        fi
        RESULTS+=('{"check":"fork_execution","status":"fail","errors":"see fork-errors.txt"}')
        ((FAILED++))
    fi
    popd > /dev/null
else
    echo " ❌ FAIL — Cannot run fork test (missing RPC or poc.sol)"
    RESULTS+=('{"check":"fork_execution","status":"fail","reason":"missing prerequisites"}')
    ((FAILED++))
fi

# ── CHECK 3: Parameter bounds — are the trigger values reachable? ──
echo ""
echo "CHECK 3: Parameter Bounds"
if [ -f "$CANDIDATE_DIR/bounds-check.sh" ]; then
    if bash "$CANDIDATE_DIR/bounds-check.sh" 2>"$CANDIDATE_DIR/bounds-errors.txt"; then
        echo " ✅ PASS — Trigger parameters are reachable"
        RESULTS+=('{"check":"parameter_bounds","status":"pass"}')
        ((PASSED++))
    else
        echo " ❌ FAIL — Trigger parameters NOT reachable under protocol constraints"
        RESULTS+=('{"check":"parameter_bounds","status":"fail","errors":"see bounds-errors.txt"}')
        ((FAILED++))
    fi
else
    echo " ⚠️ SKIP — No bounds-check.sh (manual review required)"
    RESULTS+=('{"check":"parameter_bounds","status":"skip","reason":"no bounds-check.sh"}')
    # Skipped checks don't fail the gate, but get flagged
fi

# ── CHECK 4: Not a known design choice ──
echo ""
echo "CHECK 4: Design Choice Filter"
if [ -f "$CANDIDATE_DIR/design-check.json" ]; then
    IS_DESIGN=$(cat "$CANDIDATE_DIR/design-check.json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('isIntentional') or d.get('auditApproved') else 'false')" 2>/dev/null || echo "unknown")
    if [ "$IS_DESIGN" = "true" ]; then
        echo " ❌ FAIL — Flagged as intentional design choice or audit-approved"
        RESULTS+=('{"check":"design_choice","status":"fail","reason":"intentional_design"}')
        ((FAILED++))
    elif [ "$IS_DESIGN" = "false" ]; then
        echo " ✅ PASS — Not a known design choice"
        RESULTS+=('{"check":"design_choice","status":"pass"}')
        ((PASSED++))
    else
        echo " ⚠️ SKIP — Could not determine (manual review required)"
        RESULTS+=('{"check":"design_choice","status":"skip"}')
    fi
else
    echo " ⚠️ SKIP — No design-check.json"
    RESULTS+=('{"check":"design_choice","status":"skip","reason":"no design-check.json"}')
fi

# ══════════════════════════════════════════
# GATE VERDICT
# ══════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════"

# Write results to JSON
RESULTS_JSON=$(printf '%s,' "${RESULTS[@]}" | sed 's/,$//')
cat > "$GATE_LOG" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "candidate": "$CANDIDATE_DIR",
  "passed": $PASSED,
  "failed": $FAILED,
  "verdict": "$([ $FAILED -eq 0 ] && echo 'VERIFIED' || echo 'REJECTED')",
  "checks": [$RESULTS_JSON]
}
EOF

if [ "$FAILED" -eq 0 ]; then
    echo " ✅ GATE VERDICT: VERIFIED ($PASSED checks passed, $FAILED failed)"
    echo "══════════════════════════════════════════"
    exit 0
else
    echo " ❌ GATE VERDICT: REJECTED ($PASSED checks passed, $FAILED failed)"
    echo "══════════════════════════════════════════"
    exit 1
fi
