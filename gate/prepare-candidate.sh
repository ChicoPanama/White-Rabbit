#!/bin/bash
# Creates a candidate directory for gate verification
# Usage: ./prepare-candidate.sh <protocol> <vuln-name> <chain-id> <target-address>

PROTOCOL="$1"
VULN_NAME="$2"
CHAIN_ID="${3:-1}"
TARGET_ADDRESS="${4:-}"

CANDIDATE_DIR="/home/ubuntu/clawd/candidates/${PROTOCOL}/${VULN_NAME}"

mkdir -p "$CANDIDATE_DIR"

# Create metadata
cat > "$CANDIDATE_DIR/metadata.json" << EOF
{
  "protocol": "$PROTOCOL",
  "vulnerabilityName": "$VULN_NAME",
  "chainId": $CHAIN_ID,
  "targetAddress": "$TARGET_ADDRESS",
  "discoveredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "unverified"
}
EOF

echo "Candidate directory created: $CANDIDATE_DIR"
echo ""
echo "Next steps:"
echo " 1. Write poc.sol in $CANDIDATE_DIR/"
echo " 2. (Optional) Write bounds-check.sh"
echo " 3. (Optional) Write design-check.json"
echo " 4. Run: /home/ubuntu/clawd/gate/run-gate.sh $CANDIDATE_DIR"
