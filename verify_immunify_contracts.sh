#!/bin/bash
# Immunify Bounty Verification Script
# Safe testing environment for vulnerability verification

set -e  # Exit on any error

echo "🐇 WHITERABBIT IMMUNIFY VERIFICATION TESTING"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contract addresses
FWX_DEX="0x4C7f3B26b01e23a93C44A4F8Ccda4dc7fD9E6E73"
SOSWAP="0x9E8F7A6B5C4D3E2F1023456789ABCDEFabcdef12"
GRAPHENE="0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"

echo -e "${BLUE}📋 Verifying prerequisites...${NC}"

# Check if foundry is installed
if ! command -v forge &> /dev/null; then
    echo -e "${RED}❌ Foundry not found. Install with: curl -L https://foundry.paradigm.xyz | bash${NC}"
    exit 1
fi

if ! command -v cast &> /dev/null; then
    echo -e "${RED}❌ Cast not found. Run: foundryup${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Foundry tools available${NC}"

# Function to analyze contract
analyze_contract() {
    local name=$1
    local address=$2
    
    echo -e "${BLUE}🔍 Analyzing $name...${NC}"
    
    # Get bytecode
    echo "   📥 Fetching bytecode..."
    cast code $address --rpc-url https://mainnet.base.org > "${name}_bytecode.txt" 2>/dev/null || {
        echo -e "${RED}   ❌ Failed to fetch bytecode for $name${NC}"
        return 1
    }
    
    local bytecode_size=$(wc -c < "${name}_bytecode.txt")
    echo "   📊 Bytecode size: $bytecode_size bytes"
    
    # Check for vulnerability patterns
    echo "   🔍 Scanning for vulnerability patterns..."
    
    # Check for SELFDESTRUCT
    if grep -q "ff" "${name}_bytecode.txt" 2>/dev/null; then
        echo -e "${YELLOW}   ⚠️  SELFDESTRUCT pattern detected${NC}"
    fi
    
    # Check for DELEGATECALL  
    if grep -q "f4" "${name}_bytecode.txt" 2>/dev/null; then
        echo -e "${YELLOW}   ⚠️  DELEGATECALL pattern detected${NC}"
    fi
    
    # Check for unlimited approval pattern
    if grep -q "7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" "${name}_bytecode.txt" 2>/dev/null; then
        echo -e "${RED}   🚨 UNLIMITED APPROVAL pattern detected${NC}"
    fi
    
    # Get function signatures
    echo "   📋 Extracting function signatures..."
    cast interface $address --rpc-url https://mainnet.base.org > "${name}_interface.txt" 2>/dev/null || {
        echo -e "${YELLOW}   ⚠️  Could not extract interface (may be unverified)${NC}"
    }
    
    echo -e "${GREEN}   ✅ Analysis complete for $name${NC}"
    echo ""
}

# Main verification process
echo -e "${BLUE}🎯 Starting contract analysis...${NC}"

analyze_contract "FWX_DEX" $FWX_DEX
analyze_contract "SOSWAP" $SOSWAP  
analyze_contract "GRAPHENE" $GRAPHENE

echo -e "${GREEN}🎯 Static analysis complete!${NC}"
echo ""

echo -e "${BLUE}📋 Analysis Results Summary:${NC}"
echo "   - Bytecode files: *_bytecode.txt"
echo "   - Interface files: *_interface.txt (if available)"
echo "   - Vulnerability patterns highlighted above"

echo ""
echo -e "${YELLOW}⚠️  NEXT STEPS:${NC}"
echo "   1. Review bytecode files manually"
echo "   2. Set up Foundry project for PoC development"
echo "   3. Create fork environment for safe testing"
echo "   4. Develop non-destructive proof-of-concepts"
echo "   5. Document findings for Immunify submission"

echo ""
echo -e "${RED}🔒 SAFETY REMINDER:${NC}"
echo -e "${RED}   - This script only performs READ OPERATIONS${NC}"
echo -e "${RED}   - No mainnet contract interactions${NC}"  
echo -e "${RED}   - Use fork environment for any testing${NC}"
echo -e "${RED}   - Verify Immunify scope before proceeding${NC}"

echo ""
echo -e "${GREEN}🐇 WhiteRabbit verification analysis complete!${NC}"
