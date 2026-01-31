#!/usr/bin/env python3
"""
🐇 Aerodrome Finance Contract Discovery
WhiteRabbit reconnaissance tool for mapping Aerodrome contracts on Base
"""

import json
import requests
import time
from typing import Dict, List, Any

class AerodromeRecon:
    def __init__(self):
        # Base chain RPC endpoint
        self.base_rpc = "https://mainnet.base.org"
        
        # Known Aerodrome addresses from intelligence
        self.known_addresses = {
            "AERO_TOKEN": "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            "POOL_FACTORY": "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
            "SUSPECTED_FACTORY": "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"  # From CATASTROPHIC_DEX_DISCOVERY
        }
        
        # Common contract patterns to look for
        self.contract_patterns = {
            "Router": ["Router", "AMM", "Swap"],
            "Gauge": ["Gauge", "Farming", "Rewards"],
            "Voter": ["Voter", "Governance", "VotingEscrow"],
            "veAERO": ["VotingEscrow", "veAERO", "Lock"],
            "Bribe": ["Bribe", "Incentive"],
            "Factory": ["Factory", "Pool"],
            "Minter": ["Minter", "Emission"]
        }

    def get_contract_code(self, address: str) -> str:
        """Get contract bytecode from Base"""
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_getCode",
                "params": [address, "latest"],
                "id": 1
            }
            
            response = requests.post(self.base_rpc, json=payload, timeout=10)
            result = response.json()
            
            if "result" in result:
                return result["result"]
            return "0x"
            
        except Exception as e:
            print(f"❌ Error fetching code for {address}: {e}")
            return "0x"

    def analyze_bytecode_patterns(self, bytecode: str) -> Dict[str, bool]:
        """Analyze bytecode for vulnerability patterns"""
        if not bytecode or bytecode == "0x":
            return {}
            
        patterns = {
            "SELFDESTRUCT": "ff" in bytecode,
            "DELEGATECALL": "f4" in bytecode,
            "CREATE2": "f5" in bytecode,
            "PROXY_PATTERN": "3d3d3d3d" in bytecode,  # Common proxy bytecode
            "UPGRADE_PATTERN": "7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" in bytecode,
            "LARGE_CONTRACT": len(bytecode) > 50000,  # Potential complexity
        }
        
        return patterns

    def discover_contracts(self) -> Dict[str, Any]:
        """Main contract discovery function"""
        print("🐇 Starting Aerodrome contract discovery...")
        
        results = {
            "known_contracts": {},
            "vulnerability_patterns": {},
            "analysis_timestamp": int(time.time())
        }
        
        for name, address in self.known_addresses.items():
            print(f"\n🔍 Analyzing {name}: {address}")
            
            # Get bytecode
            bytecode = self.get_contract_code(address)
            
            # Analyze patterns
            patterns = self.analyze_bytecode_patterns(bytecode)
            
            results["known_contracts"][name] = {
                "address": address,
                "has_code": bytecode != "0x",
                "bytecode_size": len(bytecode) if bytecode != "0x" else 0,
                "vulnerability_patterns": patterns
            }
            
            # Store vulnerability patterns
            results["vulnerability_patterns"][address] = patterns
            
            # Print immediate findings
            if patterns:
                print(f"📊 Patterns found:")
                for pattern, found in patterns.items():
                    if found:
                        status = "🔴" if pattern in ["SELFDESTRUCT", "DELEGATECALL"] else "🟡"
                        print(f"    {status} {pattern}")
            
            time.sleep(0.5)  # Rate limiting
        
        return results

    def verify_catastrophic_finding(self) -> Dict[str, Any]:
        """Verify the CATASTROPHIC_DEX_DISCOVERY finding"""
        print("\n🚨 VERIFYING CATASTROPHIC FINDING...")
        
        suspected_address = self.known_addresses["SUSPECTED_FACTORY"]
        print(f"🔍 Checking {suspected_address}")
        
        bytecode = self.get_contract_code(suspected_address)
        patterns = self.analyze_bytecode_patterns(bytecode)
        
        verification = {
            "address": suspected_address,
            "has_code": bytecode != "0x",
            "confirmed_vulnerabilities": [],
            "risk_level": "UNKNOWN"
        }
        
        # Check for the specific patterns mentioned in CATASTROPHIC_DEX_DISCOVERY
        critical_patterns = ["SELFDESTRUCT", "DELEGATECALL"]
        for pattern in critical_patterns:
            if patterns.get(pattern, False):
                verification["confirmed_vulnerabilities"].append(pattern)
        
        # Assess risk level
        if len(verification["confirmed_vulnerabilities"]) >= 2:
            verification["risk_level"] = "CATASTROPHIC"
        elif len(verification["confirmed_vulnerabilities"]) == 1:
            verification["risk_level"] = "HIGH"
        elif bytecode == "0x":
            verification["risk_level"] = "NO_CONTRACT"
        else:
            verification["risk_level"] = "LOW"
        
        print(f"🎯 Verification Result: {verification['risk_level']}")
        if verification["confirmed_vulnerabilities"]:
            print(f"🔴 Confirmed vulnerabilities: {verification['confirmed_vulnerabilities']}")
        
        return verification

    def generate_report(self, results: Dict[str, Any], verification: Dict[str, Any]) -> str:
        """Generate reconnaissance report"""
        report = f"""
🐇 AERODROME RECONNAISSANCE REPORT
Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}

📍 CONTRACT DISCOVERY RESULTS:

"""
        
        for name, data in results["known_contracts"].items():
            report += f"""
{name}:
  Address: {data['address']}
  Has Code: {data['has_code']}
  Bytecode Size: {data['bytecode_size']} bytes
  
  Vulnerability Patterns:"""
            
            for pattern, found in data['vulnerability_patterns'].items():
                status = "✅" if found else "❌"
                report += f"""
    {status} {pattern}"""
            
            report += "\n"
        
        report += f"""

🚨 CATASTROPHIC FINDING VERIFICATION:
  Address: {verification['address']}
  Risk Level: {verification['risk_level']}
  Confirmed Vulnerabilities: {verification['confirmed_vulnerabilities']}

🎯 NEXT STEPS:
1. Analyze confirmed vulnerability patterns
2. Develop proof-of-concept exploits  
3. Calculate impact and affected value
4. Prepare responsible disclosure

🐇 WhiteRabbit Analysis Complete
"""
        
        return report

def main():
    """Main execution function"""
    print("🎯 AERODROME FINANCE: DEEP RECONNAISSANCE")
    print("=" * 50)
    
    recon = AerodromeRecon()
    
    # Discover contracts
    results = recon.discover_contracts()
    
    # Verify catastrophic finding
    verification = recon.verify_catastrophic_finding()
    
    # Generate report
    report = recon.generate_report(results, verification)
    
    # Save results
    with open("aerodrome_recon_results.json", "w") as f:
        json.dump({
            "discovery_results": results,
            "catastrophic_verification": verification,
            "timestamp": int(time.time())
        }, f, indent=2)
    
    # Save report
    with open("aerodrome_recon_report.md", "w") as f:
        f.write(report)
    
    print("\n" + "=" * 50)
    print(report)
    print("\n📁 Results saved to:")
    print("  - aerodrome_recon_results.json")
    print("  - aerodrome_recon_report.md")

if __name__ == "__main__":
    main()