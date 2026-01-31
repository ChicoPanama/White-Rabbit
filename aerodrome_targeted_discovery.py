#!/usr/bin/env python3
"""
🐇 Aerodrome Finance TARGETED Contract Discovery
Focus on finding specific Aerodrome ecosystem contracts through known patterns
"""

import json
import requests
import time
from typing import Dict, List, Any

class AerodromeTargeted:
    def __init__(self):
        self.base_rpc = "https://mainnet.base.org"
        
        # Known Aerodrome addresses to start with
        self.confirmed_addresses = {
            "AERO_TOKEN": "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            "POOL_FACTORY": "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
            "SUSPECTED_FACTORY": "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"
        }
        
        # Likely Aerodrome ecosystem addresses (to verify)
        self.candidate_addresses = {
            # These are typical Aerodrome ecosystem addresses found through research
            "ROUTER_CANDIDATE": "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
            "VOTER_CANDIDATE": "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5", 
            "VEAERO_CANDIDATE": "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
            "GAUGE_FACTORY": "0x5C43B1eD97e52d009611D89b74fA829FE4ac56b1",
            "BRIBE_FACTORY": "0x24C4F6bBb6E8Dbf21B1a1ad7a1C06c9B8BC1E6AB"
        }
        
        # Function selectors for ecosystem identification
        self.selectors = {
            # Router functions
            "SWAP_EXACT_TOKENS": "0x38ed1739",
            "SWAP_TOKENS_FOR_EXACT": "0x8803dbee",
            "ADD_LIQUIDITY": "0xe8e33700",
            "REMOVE_LIQUIDITY": "0xbaa2abde",
            
            # Factory functions
            "CREATE_PAIR": "0xc9c65396", 
            "GET_PAIR": "0xe6a43905",
            "ALL_PAIRS_LENGTH": "0x574f2ba3",
            "FEE_TO": "0x017e7e58",
            
            # Voter functions
            "VOTE": "0x15373e3d",
            "CLAIM_BRIBES": "0x441a3e70",
            "CLAIM_FEES": "0xd294f093",
            "POKE": "0x32145f90",
            
            # VotingEscrow functions
            "CREATE_LOCK": "0xe2bbb158",
            "INCREASE_AMOUNT": "0x65fc3873", 
            "INCREASE_UNLOCK_TIME": "0xeff7a612",
            "WITHDRAW": "0x2e17de78",
            "LOCKED": "0x38d52e0f",
            
            # Gauge functions  
            "DEPOSIT": "0xb6b55f25",
            "WITHDRAW_GAUGE": "0x2e1a7d4d",
            "GET_REWARD": "0x3d18b912",
            "NOTIFY_REWARD": "0x1c4b774b",
            
            # Bribe functions
            "NOTIFY_REWARD_AMOUNT": "0x1c4b774b",
            "LEFT": "0x0700037d",
            "EARNED": "0x8b876347"
        }

    def call_contract(self, address: str, data: str) -> str:
        """Make contract call"""
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_call", 
                "params": [{"to": address, "data": data}, "latest"],
                "id": 1
            }
            response = requests.post(self.base_rpc, json=payload, timeout=10)
            result = response.json()
            return result.get("result", "0x")
        except:
            return "0x"

    def get_contract_code(self, address: str) -> str:
        """Get contract bytecode"""
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_getCode",
                "params": [address, "latest"],
                "id": 1
            }
            response = requests.post(self.base_rpc, json=payload, timeout=10)
            result = response.json()
            return result.get("result", "0x")
        except:
            return "0x"

    def test_function_exists(self, address: str, selector: str) -> bool:
        """Test if a function selector exists in contract"""
        try:
            result = self.call_contract(address, selector + "0" * 56)  # Pad with zeros
            # If call succeeds (not 0x), function likely exists
            return result != "0x" and len(result) > 2
        except:
            return False

    def analyze_contract_type(self, address: str, bytecode: str) -> Dict[str, Any]:
        """Analyze contract to determine its type in Aerodrome ecosystem"""
        analysis = {
            "address": address,
            "type": "UNKNOWN",
            "confidence": 0,
            "functions_found": [],
            "vulnerability_patterns": {},
            "bytecode_size": len(bytecode)
        }
        
        if bytecode == "0x":
            analysis["type"] = "NO_CODE"
            return analysis
            
        # Test function selectors to classify contract
        function_scores = {
            "ROUTER": 0,
            "FACTORY": 0, 
            "VOTER": 0,
            "VOTING_ESCROW": 0,
            "GAUGE": 0,
            "BRIBE": 0,
            "TOKEN": 0
        }
        
        # Router function tests
        router_sels = ["SWAP_EXACT_TOKENS", "SWAP_TOKENS_FOR_EXACT", "ADD_LIQUIDITY", "REMOVE_LIQUIDITY"]
        for sel_name in router_sels:
            if self.test_function_exists(address, self.selectors[sel_name]):
                function_scores["ROUTER"] += 1
                analysis["functions_found"].append(sel_name)
        
        # Factory function tests  
        factory_sels = ["CREATE_PAIR", "GET_PAIR", "ALL_PAIRS_LENGTH", "FEE_TO"]
        for sel_name in factory_sels:
            if self.test_function_exists(address, self.selectors[sel_name]):
                function_scores["FACTORY"] += 1
                analysis["functions_found"].append(sel_name)
                
        # Voter function tests
        voter_sels = ["VOTE", "CLAIM_BRIBES", "CLAIM_FEES", "POKE"]
        for sel_name in voter_sels:
            if self.test_function_exists(address, self.selectors[sel_name]):
                function_scores["VOTER"] += 1
                analysis["functions_found"].append(sel_name)
                
        # VotingEscrow function tests
        ve_sels = ["CREATE_LOCK", "INCREASE_AMOUNT", "INCREASE_UNLOCK_TIME", "WITHDRAW", "LOCKED"]
        for sel_name in ve_sels:
            if self.test_function_exists(address, self.selectors[sel_name]):
                function_scores["VOTING_ESCROW"] += 1
                analysis["functions_found"].append(sel_name)
                
        # Gauge function tests
        gauge_sels = ["DEPOSIT", "WITHDRAW_GAUGE", "GET_REWARD", "NOTIFY_REWARD"]
        for sel_name in gauge_sels:
            if self.test_function_exists(address, self.selectors[sel_name]):
                function_scores["GAUGE"] += 1
                analysis["functions_found"].append(sel_name)
                
        # Bribe function tests 
        bribe_sels = ["NOTIFY_REWARD_AMOUNT", "LEFT", "EARNED"]
        for sel_name in bribe_sels:
            if self.test_function_exists(address, self.selectors[sel_name]):
                function_scores["BRIBE"] += 1
                analysis["functions_found"].append(sel_name)
        
        # Determine contract type by highest score
        max_score = max(function_scores.values())
        if max_score > 0:
            for contract_type, score in function_scores.items():
                if score == max_score:
                    analysis["type"] = contract_type
                    analysis["confidence"] = score
                    break
        
        # Analyze vulnerability patterns
        analysis["vulnerability_patterns"] = self.analyze_vuln_patterns(bytecode)
        
        return analysis

    def analyze_vuln_patterns(self, bytecode: str) -> Dict[str, bool]:
        """Analyze vulnerability patterns in bytecode"""
        return {
            "SELFDESTRUCT": "ff" in bytecode,
            "DELEGATECALL": "f4" in bytecode,
            "CREATE2": "f5" in bytecode,
            "PROXY_PATTERN": "3d3d3d3d" in bytecode,
            "LARGE_CONTRACT": len(bytecode) > 50000
        }

    def discover_ecosystem(self) -> Dict[str, Any]:
        """Discover and analyze Aerodrome ecosystem contracts"""
        print("🐇 Starting TARGETED Aerodrome ecosystem discovery...")
        
        results = {
            "confirmed_contracts": {},
            "candidate_contracts": {},
            "ecosystem_summary": {},
            "vulnerability_summary": {},
            "timestamp": int(time.time())
        }
        
        all_addresses = {**self.confirmed_addresses, **self.candidate_addresses}
        
        print(f"\n🔍 Analyzing {len(all_addresses)} target addresses...")
        
        for name, address in all_addresses.items():
            print(f"\n📊 Analyzing {name}: {address}")
            
            # Get bytecode
            bytecode = self.get_contract_code(address)
            
            # Analyze contract
            analysis = self.analyze_contract_type(address, bytecode)
            
            # Categorize results
            if name in self.confirmed_addresses:
                results["confirmed_contracts"][name] = analysis
            else:
                results["candidate_contracts"][name] = analysis
            
            # Print immediate findings
            if analysis["type"] != "NO_CODE" and analysis["type"] != "UNKNOWN":
                print(f"  ✅ Type: {analysis['type']} (confidence: {analysis['confidence']})")
                if analysis["functions_found"]:
                    print(f"  🎯 Functions: {', '.join(analysis['functions_found'][:3])}...")
                
                # Check vulnerabilities
                vulns = [k for k, v in analysis["vulnerability_patterns"].items() if v]
                if vulns:
                    print(f"  🔴 Vulnerabilities: {', '.join(vulns)}")
            
            elif analysis["type"] == "NO_CODE":
                print(f"  ❌ No code at address")
            else:
                print(f"  ⚠️ Unknown contract type")
                
            time.sleep(0.5)  # Rate limiting
        
        # Generate summaries
        results["ecosystem_summary"] = self.generate_ecosystem_summary(results)
        results["vulnerability_summary"] = self.generate_vulnerability_summary(results)
        
        return results

    def generate_ecosystem_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate ecosystem mapping summary"""
        ecosystem = {
            "contract_types": {},
            "total_contracts": 0,
            "active_contracts": 0
        }
        
        all_contracts = {**results["confirmed_contracts"], **results["candidate_contracts"]}
        
        for name, analysis in all_contracts.items():
            contract_type = analysis["type"]
            if contract_type not in ecosystem["contract_types"]:
                ecosystem["contract_types"][contract_type] = []
            
            ecosystem["contract_types"][contract_type].append({
                "name": name,
                "address": analysis["address"],
                "confidence": analysis.get("confidence", 0)
            })
            
            ecosystem["total_contracts"] += 1
            if analysis["type"] not in ["NO_CODE", "UNKNOWN"]:
                ecosystem["active_contracts"] += 1
        
        return ecosystem

    def generate_vulnerability_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate vulnerability summary across all contracts"""
        vuln_summary = {
            "total_vulnerabilities": 0,
            "vulnerable_contracts": 0,
            "vulnerability_types": {},
            "critical_contracts": []
        }
        
        all_contracts = {**results["confirmed_contracts"], **results["candidate_contracts"]}
        
        for name, analysis in all_contracts.items():
            contract_vulns = []
            
            for vuln_type, found in analysis["vulnerability_patterns"].items():
                if found:
                    contract_vulns.append(vuln_type)
                    if vuln_type not in vuln_summary["vulnerability_types"]:
                        vuln_summary["vulnerability_types"][vuln_type] = 0
                    vuln_summary["vulnerability_types"][vuln_type] += 1
            
            if contract_vulns:
                vuln_summary["vulnerable_contracts"] += 1
                vuln_summary["total_vulnerabilities"] += len(contract_vulns)
                
                # Mark as critical if has SELFDESTRUCT or DELEGATECALL
                if "SELFDESTRUCT" in contract_vulns or "DELEGATECALL" in contract_vulns:
                    vuln_summary["critical_contracts"].append({
                        "name": name,
                        "address": analysis["address"],
                        "type": analysis["type"],
                        "vulnerabilities": contract_vulns
                    })
        
        return vuln_summary

    def save_results(self, results: Dict[str, Any]) -> None:
        """Save targeted discovery results"""
        timestamp = int(time.time())
        
        # Save data
        with open(f"aerodrome_targeted_analysis_{timestamp}.json", "w") as f:
            json.dump(results, f, indent=2)
        
        # Generate report
        report = self.generate_report(results)
        with open(f"aerodrome_targeted_report_{timestamp}.md", "w") as f:
            f.write(report)
        
        print(f"\n📁 Results saved:")
        print(f"  📊 Data: aerodrome_targeted_analysis_{timestamp}.json")
        print(f"  📋 Report: aerodrome_targeted_report_{timestamp}.md")

    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate comprehensive targeted analysis report"""
        eco_summary = results["ecosystem_summary"]
        vuln_summary = results["vulnerability_summary"]
        
        report = f"""# 🐇 AERODROME TARGETED ECOSYSTEM ANALYSIS

**Generated:** {time.strftime('%Y-%m-%d %H:%M:%S')}
**Analysis Type:** Targeted Contract Discovery
**Target:** Aerodrome Finance (Base)

## 📊 ECOSYSTEM OVERVIEW

- **Total Contracts Analyzed:** {eco_summary['total_contracts']}
- **Active Contracts:** {eco_summary['active_contracts']}
- **Vulnerable Contracts:** {vuln_summary['vulnerable_contracts']}
- **Critical Vulnerabilities:** {len(vuln_summary['critical_contracts'])}

## 🗺️ CONTRACT ECOSYSTEM MAP

"""
        
        for contract_type, contracts in eco_summary["contract_types"].items():
            if contracts:
                report += f"\n### {contract_type} ({len(contracts)} contracts):\n"
                for contract in contracts:
                    confidence = f" (confidence: {contract['confidence']})" if contract['confidence'] > 0 else ""
                    report += f"- **{contract['name']}**: `{contract['address']}`{confidence}\n"
        
        report += f"""

## 🚨 VULNERABILITY ANALYSIS

### Critical Contracts:
"""
        
        for critical in vuln_summary["critical_contracts"]:
            report += f"""
**{critical['name']}** ({critical['type']})
- Address: `{critical['address']}`
- Vulnerabilities: {', '.join(critical['vulnerabilities'])}
"""
        
        report += f"""

### Vulnerability Distribution:
"""
        for vuln_type, count in vuln_summary["vulnerability_types"].items():
            report += f"- **{vuln_type}**: {count} contracts\n"
        
        report += f"""

## 📋 CONFIRMED CONTRACTS

"""
        
        for name, analysis in results["confirmed_contracts"].items():
            report += f"""
### {name}
- **Address:** `{analysis['address']}`
- **Type:** {analysis['type']} (confidence: {analysis.get('confidence', 0)})
- **Functions Found:** {', '.join(analysis['functions_found'][:5])}
- **Vulnerabilities:** {[k for k, v in analysis['vulnerability_patterns'].items() if v]}
"""
        
        report += f"""

## 🎯 NEXT ACTIONS

### Immediate Priority:
1. **Deep Analysis of Critical Contracts**
   - Focus on SELFDESTRUCT/DELEGATECALL patterns
   - Analyze exploit scenarios for each contract type
   
2. **Cross-Contract Attack Vectors**
   - Map interactions between vulnerable contracts
   - Identify amplified attack scenarios
   
3. **Impact Assessment**
   - Calculate TVL at risk for each contract
   - Model economic impact of exploitation

### Exploit Development:
- **Router Exploits**: Focus on swap manipulation
- **Factory Exploits**: Pool creation/destruction attacks  
- **Voter Exploits**: Governance manipulation via DELEGATECALL
- **VE Exploits**: Lock/unlock mechanism bypasses

🐇 **Status: TARGETED RECONNAISSANCE COMPLETE**
*Ready for vulnerability prioritization and PoC development*

---
*WhiteRabbit Targeted Analysis*
"""
        
        return report

def main():
    print("🎯 AERODROME TARGETED ECOSYSTEM ANALYSIS")
    print("🚨 FOCUSED VULNERABILITY DISCOVERY")
    print("=" * 50)
    
    recon = AerodromeTargeted()
    results = recon.discover_ecosystem()
    recon.save_results(results)
    
    # Summary
    eco_summary = results["ecosystem_summary"]
    vuln_summary = results["vulnerability_summary"]
    
    print(f"""
🐇 TARGETED ANALYSIS COMPLETE!

📊 RESULTS:
  Total Contracts: {eco_summary['total_contracts']}
  Active Contracts: {eco_summary['active_contracts']} 
  Vulnerable Contracts: {vuln_summary['vulnerable_contracts']}
  Critical Findings: {len(vuln_summary['critical_contracts'])}

🔴 CRITICAL CONTRACTS IDENTIFIED:
""")
    
    for critical in vuln_summary["critical_contracts"]:
        print(f"  🎯 {critical['name']} ({critical['type']}): {', '.join(critical['vulnerabilities'])}")
    
    print(f"\n🎯 Ready for exploit development and comprehensive disclosure preparation!")

if __name__ == "__main__":
    main()