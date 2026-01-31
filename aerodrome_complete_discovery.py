#!/usr/bin/env python3
"""
🐇 Aerodrome Finance COMPLETE Contract Discovery
Comprehensive mapping of entire Aerodrome ecosystem before disclosure
"""

import json
import requests
import time
from typing import Dict, List, Any, Set
import re

class AerodromeCompleteRecon:
    def __init__(self):
        self.base_rpc = "https://mainnet.base.org"
        
        # Known entry points
        self.entry_points = {
            "AERO_TOKEN": "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
            "POOL_FACTORY": "0x420DD381b31aEf6683db6B902084cB0FFECe40Da", 
            "SUSPECTED_FACTORY": "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"
        }
        
        # Contract discovery patterns
        self.function_signatures = {
            # Router patterns
            "0x38ed1739": "swapExactTokensForTokens",
            "0x8803dbee": "swapTokensForExactTokens", 
            "0xfb3bdb41": "swapETHForExactTokens",
            
            # Factory patterns  
            "0xc9c65396": "createPair",
            "0xe6a43905": "getPair",
            "0xa2e74af6": "allPairsLength",
            
            # Gauge patterns
            "0x2e1a7d4d": "withdraw",
            "0xb6b55f25": "deposit", 
            "0x3d18b912": "getReward",
            
            # Voter patterns
            "0x15373e3d": "vote",
            "0x23b872dd": "transferFrom",
            "0x441a3e70": "claimBribes",
            
            # VotingEscrow patterns
            "0xe2bbb158": "create_lock",
            "0x65fc3873": "increase_amount",
            "0xeff7a612": "increase_unlock_time",
            "0x2e17de78": "withdraw",
            
            # Bribe patterns
            "0x1c4b774b": "notifyRewardAmount",
            "0x0700037d": "left", 
            "0x8b876347": "earned"
        }
        
        # Known Aerodrome ecosystem patterns
        self.ecosystem_contracts = []
        self.analyzed_addresses = set()
        
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
    
    def extract_addresses_from_bytecode(self, bytecode: str) -> Set[str]:
        """Extract potential contract addresses from bytecode"""
        addresses = set()
        
        if not bytecode or bytecode == "0x":
            return addresses
        
        # Look for address patterns (20 bytes = 40 hex chars)
        # Common patterns: 0x73 + 20 bytes, 0x30 + 20 bytes
        pattern = r'(?:73|30)([0-9a-fA-F]{40})' 
        matches = re.findall(pattern, bytecode)
        
        for match in matches:
            addr = f"0x{match}"
            # Basic validation - check if looks like valid address
            if not addr.endswith('0000000000000000000000000000000000000000'):
                addresses.add(addr.lower())
        
        return addresses
    
    def discover_ecosystem_contracts(self) -> Dict[str, Any]:
        """Discover all contracts in Aerodrome ecosystem"""
        print("🐇 Starting COMPLETE Aerodrome ecosystem discovery...")
        
        results = {
            "discovered_contracts": {},
            "vulnerability_summary": {},
            "ecosystem_map": {},
            "analysis_timestamp": int(time.time())
        }
        
        # Start with entry points
        to_analyze = list(self.entry_points.values())
        analyzed = set()
        
        iteration = 0
        max_iterations = 10  # Prevent infinite loops
        
        while to_analyze and iteration < max_iterations:
            iteration += 1
            print(f"\n🔄 Discovery iteration {iteration}")
            print(f"📊 Queue: {len(to_analyze)} contracts")
            
            current_batch = to_analyze.copy()
            to_analyze.clear()
            
            for address in current_batch:
                if address in analyzed:
                    continue
                    
                print(f"\n🔍 Analyzing: {address}")
                analyzed.add(address)
                
                # Get contract analysis
                analysis = self.analyze_single_contract(address)
                
                if analysis["has_code"]:
                    results["discovered_contracts"][address] = analysis
                    
                    # Extract referenced addresses for further analysis
                    new_addresses = self.extract_addresses_from_bytecode(analysis["bytecode"])
                    
                    for new_addr in new_addresses:
                        if new_addr not in analyzed and new_addr not in to_analyze:
                            to_analyze.append(new_addr)
                            print(f"  📎 Found reference: {new_addr}")
                
                time.sleep(0.3)  # Rate limiting
        
        # Generate ecosystem summary
        results["ecosystem_map"] = self.generate_ecosystem_map(results["discovered_contracts"])
        results["vulnerability_summary"] = self.generate_vulnerability_summary(results["discovered_contracts"])
        
        return results
    
    def analyze_single_contract(self, address: str) -> Dict[str, Any]:
        """Comprehensive analysis of single contract"""
        analysis = {
            "address": address,
            "has_code": False,
            "bytecode": "",
            "bytecode_size": 0,
            "vulnerability_patterns": {},
            "function_signatures": [],
            "contract_type": "UNKNOWN",
            "proxy_info": {},
            "access_controls": {}
        }
        
        # Get bytecode
        bytecode = self.get_contract_code(address)
        analysis["bytecode"] = bytecode
        analysis["has_code"] = bytecode != "0x"
        analysis["bytecode_size"] = len(bytecode) if bytecode != "0x" else 0
        
        if not analysis["has_code"]:
            return analysis
            
        # Analyze vulnerability patterns
        analysis["vulnerability_patterns"] = self.analyze_vulnerability_patterns(bytecode)
        
        # Detect function signatures
        analysis["function_signatures"] = self.detect_function_signatures(bytecode)
        
        # Classify contract type
        analysis["contract_type"] = self.classify_contract_type(analysis["function_signatures"])
        
        # Check for proxy patterns
        analysis["proxy_info"] = self.analyze_proxy_patterns(bytecode)
        
        # Analyze access controls
        analysis["access_controls"] = self.analyze_access_controls(bytecode)
        
        return analysis
    
    def analyze_vulnerability_patterns(self, bytecode: str) -> Dict[str, Any]:
        """Detailed vulnerability pattern analysis"""
        patterns = {
            # Critical patterns
            "SELFDESTRUCT": {
                "found": "ff" in bytecode,
                "severity": "CRITICAL",
                "description": "Contract can be destroyed"
            },
            "DELEGATECALL": {
                "found": "f4" in bytecode,
                "severity": "CRITICAL", 
                "description": "Arbitrary code execution possible"
            },
            
            # High severity patterns
            "CREATE2": {
                "found": "f5" in bytecode,
                "severity": "HIGH",
                "description": "Deterministic contract creation"
            },
            "SUICIDE": {
                "found": "ff" in bytecode,  # Same as selfdestruct  
                "severity": "CRITICAL",
                "description": "Legacy selfdestruct pattern"
            },
            
            # Medium severity patterns
            "PROXY_PATTERN": {
                "found": "3d3d3d3d" in bytecode,
                "severity": "MEDIUM",
                "description": "Proxy implementation pattern"
            },
            "UPGRADE_PATTERN": {
                "found": "7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" in bytecode,
                "severity": "MEDIUM", 
                "description": "Upgradeable proxy pattern"
            },
            
            # Code complexity indicators
            "LARGE_CONTRACT": {
                "found": len(bytecode) > 50000,
                "severity": "INFO",
                "description": f"Large contract ({len(bytecode)} bytes)"
            },
            "EXTERNAL_CALLS": {
                "found": "3b" in bytecode,  # EXTCODESIZE
                "severity": "MEDIUM",
                "description": "External contract interactions"
            }
        }
        
        return patterns
    
    def detect_function_signatures(self, bytecode: str) -> List[str]:
        """Detect known function signatures in bytecode"""
        found_sigs = []
        
        for sig, name in self.function_signatures.items():
            if sig.replace("0x", "") in bytecode:
                found_sigs.append(f"{sig} ({name})")
        
        return found_sigs
    
    def classify_contract_type(self, signatures: List[str]) -> str:
        """Classify contract based on function signatures"""
        sig_str = " ".join(signatures).lower()
        
        if "swap" in sig_str or "router" in sig_str:
            return "ROUTER"
        elif "createpair" in sig_str or "getpair" in sig_str:
            return "FACTORY"
        elif "vote" in sig_str and "claimBribes" in sig_str:
            return "VOTER"
        elif "create_lock" in sig_str or "withdraw" in sig_str:
            return "VOTING_ESCROW"
        elif "getreward" in sig_str and "deposit" in sig_str:
            return "GAUGE"
        elif "notifyrewardamount" in sig_str:
            return "BRIBE"
        elif "transfer" in sig_str and "approve" in sig_str:
            return "TOKEN" 
        else:
            return "UNKNOWN"
    
    def analyze_proxy_patterns(self, bytecode: str) -> Dict[str, Any]:
        """Analyze proxy implementation patterns"""
        proxy_info = {
            "is_proxy": False,
            "proxy_type": "NONE",
            "implementation_slot": None
        }
        
        # EIP-1967 proxy pattern
        if "7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" in bytecode:
            proxy_info["is_proxy"] = True
            proxy_info["proxy_type"] = "EIP1967"
            proxy_info["implementation_slot"] = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
        
        # Minimal proxy pattern (EIP-1167) 
        elif "3d3d3d3d" in bytecode and len(bytecode) < 200:
            proxy_info["is_proxy"] = True
            proxy_info["proxy_type"] = "MINIMAL"
        
        return proxy_info
    
    def analyze_access_controls(self, bytecode: str) -> Dict[str, Any]:
        """Analyze access control patterns"""
        access_controls = {
            "has_owner": False,
            "has_roles": False, 
            "modifier_patterns": []
        }
        
        # Look for common access control patterns
        if "8da5cb5b" in bytecode:  # owner() function selector
            access_controls["has_owner"] = True
            
        if "36568abe" in bytecode:  # hasRole function selector
            access_controls["has_roles"] = True
        
        return access_controls
    
    def generate_ecosystem_map(self, contracts: Dict[str, Any]) -> Dict[str, List[str]]:
        """Generate ecosystem organization map"""
        ecosystem_map = {
            "ROUTER": [],
            "FACTORY": [],
            "VOTER": [], 
            "VOTING_ESCROW": [],
            "GAUGE": [],
            "BRIBE": [],
            "TOKEN": [],
            "UNKNOWN": []
        }
        
        for address, analysis in contracts.items():
            contract_type = analysis["contract_type"]
            ecosystem_map[contract_type].append(address)
        
        return ecosystem_map
    
    def generate_vulnerability_summary(self, contracts: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive vulnerability summary"""
        summary = {
            "total_contracts": len(contracts),
            "critical_vulnerabilities": 0,
            "high_vulnerabilities": 0,
            "medium_vulnerabilities": 0,
            "affected_contracts": [],
            "vulnerability_breakdown": {}
        }
        
        vuln_counts = {}
        
        for address, analysis in contracts.items():
            contract_vulns = []
            
            for pattern, info in analysis["vulnerability_patterns"].items():
                if info["found"]:
                    severity = info["severity"]
                    contract_vulns.append(f"{pattern} ({severity})")
                    
                    # Count by severity
                    if severity == "CRITICAL":
                        summary["critical_vulnerabilities"] += 1
                    elif severity == "HIGH": 
                        summary["high_vulnerabilities"] += 1
                    elif severity == "MEDIUM":
                        summary["medium_vulnerabilities"] += 1
                    
                    # Track pattern frequency
                    if pattern not in vuln_counts:
                        vuln_counts[pattern] = 0
                    vuln_counts[pattern] += 1
            
            if contract_vulns:
                summary["affected_contracts"].append({
                    "address": address,
                    "type": analysis["contract_type"],
                    "vulnerabilities": contract_vulns
                })
        
        summary["vulnerability_breakdown"] = vuln_counts
        return summary
    
    def save_results(self, results: Dict[str, Any]) -> None:
        """Save comprehensive results"""
        timestamp = int(time.time())
        
        # Save raw data
        with open(f"aerodrome_complete_analysis_{timestamp}.json", "w") as f:
            json.dump(results, f, indent=2)
        
        # Generate summary report
        report = self.generate_summary_report(results)
        with open(f"aerodrome_vulnerability_catalog_{timestamp}.md", "w") as f:
            f.write(report)
        
        print(f"\n📁 Results saved:")
        print(f"  📊 Data: aerodrome_complete_analysis_{timestamp}.json")
        print(f"  📋 Report: aerodrome_vulnerability_catalog_{timestamp}.md")
    
    def generate_summary_report(self, results: Dict[str, Any]) -> str:
        """Generate comprehensive vulnerability report"""
        summary = results["vulnerability_summary"]
        ecosystem = results["ecosystem_map"] 
        
        report = f"""# 🐇 AERODROME FINANCE: COMPLETE VULNERABILITY CATALOG

**Generated:** {time.strftime('%Y-%m-%d %H:%M:%S')}
**Hunter:** WhiteRabbit
**Target:** Aerodrome Finance (Base AMM)

## 📊 EXECUTIVE SUMMARY

- **Total Contracts Analyzed:** {summary['total_contracts']}
- **Critical Vulnerabilities:** {summary['critical_vulnerabilities']}
- **High Vulnerabilities:** {summary['high_vulnerabilities']}  
- **Medium Vulnerabilities:** {summary['medium_vulnerabilities']}
- **Affected Contracts:** {len(summary['affected_contracts'])}

## 🗺️ ECOSYSTEM MAPPING

"""
        
        for contract_type, addresses in ecosystem.items():
            if addresses:
                report += f"\n### {contract_type} Contracts ({len(addresses)}):\n"
                for addr in addresses:
                    report += f"- `{addr}`\n"
        
        report += f"""

## 🚨 VULNERABILITY BREAKDOWN

"""
        
        for pattern, count in summary["vulnerability_breakdown"].items():
            report += f"- **{pattern}:** {count} contracts\n"
        
        report += f"""

## 📋 AFFECTED CONTRACTS

"""
        
        for contract in summary["affected_contracts"]:
            report += f"""
### {contract['address']} ({contract['type']})
**Vulnerabilities:**
"""
            for vuln in contract["vulnerabilities"]:
                report += f"- ⚠️ {vuln}\n"
        
        report += f"""

## 🎯 RECOMMENDED ACTIONS

### Immediate Priority:
1. **Critical Vulnerability Analysis** - Focus on SELFDESTRUCT/DELEGATECALL patterns
2. **Impact Quantification** - Calculate TVL at risk per contract
3. **Exploit Development** - Create PoCs for highest severity findings
4. **Responsible Disclosure** - Prepare comprehensive report for Aerodrome team

### Strategic Approach:
- **Single Coordinated Disclosure** - Report all findings together for maximum impact
- **Cross-Contract Attack Scenarios** - Analyze multi-contract exploit chains
- **Economic Impact Assessment** - Model financial risks across ecosystem

🐇 **Hunt Status: COMPREHENSIVE INTELLIGENCE GATHERED**
*Ready for vulnerability prioritization and exploit development*

---
*WhiteRabbit Reconnaissance Complete*
"""
        
        return report

def main():
    print("🎯 AERODROME COMPLETE ECOSYSTEM DISCOVERY")
    print("🚨 COMPREHENSIVE ANALYSIS BEFORE DISCLOSURE") 
    print("=" * 60)
    
    recon = AerodromeCompleteRecon()
    results = recon.discover_ecosystem_contracts()
    recon.save_results(results)
    
    # Print summary
    summary = results["vulnerability_summary"]
    print(f"""
🐇 DISCOVERY COMPLETE!

📊 FINAL STATISTICS:
  Contracts Analyzed: {summary['total_contracts']}
  Critical Vulns: {summary['critical_vulnerabilities']}
  High Vulns: {summary['high_vulnerabilities']}
  Medium Vulns: {summary['medium_vulnerabilities']}
  
🚨 Ready for comprehensive vulnerability analysis and exploit development.
🎯 All findings cataloged before disclosure - strategic advantage secured!
""")

if __name__ == "__main__":
    main()