"""
WhiteRabbit Exploit Pattern Detection Engine
Comprehensive analysis and detection of DeFi exploit patterns
Based on $23.47B in analyzed exploit data
"""

import re
import json
import hashlib
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime, timedelta
import numpy as np

class ExploitCategory(Enum):
    LOGIC_ERROR = "logic_error"
    BRIDGE_EXPLOIT = "bridge_exploit" 
    ACCESS_CONTROL = "access_control"
    REENTRANCY = "reentrancy"
    SIGNATURE_REPLAY = "signature_replay"
    UPGRADE_VULNERABILITY = "upgrade_vulnerability"
    COMPILER_BUG = "compiler_bug"
    DONATION_ATTACK = "donation_attack"

class SeverityLevel(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class ExploitPattern:
    """Individual exploit pattern detection result"""
    pattern_id: str
    category: ExploitCategory
    severity: SeverityLevel
    location: str
    description: str
    exploit_potential: str
    financial_impact_estimate: str
    detection_confidence: float
    code_snippet: str
    recommendation: str

@dataclass
class ThreatIntelligence:
    """Threat intelligence data for specific exploits"""
    exploit_name: str
    attack_vector: str
    financial_loss: str
    timeline: str
    technical_details: str
    indicators: List[str]

class ExploitPatternDatabase:
    """Database of known exploit patterns and signatures"""
    
    def __init__(self):
        self.patterns = self._initialize_patterns()
        self.threat_intel = self._initialize_threat_intel()
        
    def _initialize_patterns(self) -> Dict[str, Dict]:
        """Initialize comprehensive exploit pattern signatures"""
        return {
            # Logic Error Patterns ($12.5B category)
            "LOGIC_PRECISION_DIVISION": {
                "regex": r"(\w+)\s*\/\s*(\w+)(?!\s*\*\s*(1e\d+|10\*\*\d+))",
                "category": ExploitCategory.LOGIC_ERROR,
                "severity": SeverityLevel.HIGH,
                "description": "Division without scaling factor - precision loss vulnerability",
                "exploit_examples": ["Uniswap V2 rounding", "Compound precision errors"],
                "financial_impact": "$50M-$500M potential per exploit"
            },
            
            "LOGIC_OVERFLOW_UNCHECKED": {
                "regex": r"(\w+\s*[\+\-\*\/]=\s*\w+)(?!.*require|.*SafeMath|.*unchecked)",
                "category": ExploitCategory.LOGIC_ERROR,
                "severity": SeverityLevel.CRITICAL,
                "description": "Arithmetic operations without overflow protection",
                "exploit_examples": ["Integer overflow attacks", "Underflow exploitation"],
                "financial_impact": "$100M+ potential"
            },
            
            "LOGIC_INVARIANT_VIOLATION": {
                "regex": r"(transfer|transferFrom)\([^)]+\)(?!.*require.*invariant|.*require.*balance)",
                "category": ExploitCategory.LOGIC_ERROR,
                "severity": SeverityLevel.HIGH,
                "description": "Token transfers without invariant checks",
                "exploit_examples": ["AMM invariant violations", "Pool drainage attacks"],
                "financial_impact": "$10M-$100M typical"
            },
            
            # Bridge Exploit Patterns ($4.7B category)
            "BRIDGE_WEAK_CONSENSUS": {
                "regex": r"require\(.*signatures?\.length\s*>=\s*[12]\)",
                "category": ExploitCategory.BRIDGE_EXPLOIT,
                "severity": SeverityLevel.CRITICAL,
                "description": "Insufficient validator threshold for bridge consensus",
                "exploit_examples": ["Ronin Bridge ($624M)", "Harmony Bridge ($100M)"],
                "financial_impact": "$100M-$624M proven"
            },
            
            "BRIDGE_UNRESTRICTED_CALL": {
                "regex": r"\.call\([^)]*\)(?!.*whitelist|.*authorized|.*onlyValidator)",
                "category": ExploitCategory.BRIDGE_EXPLOIT,
                "severity": SeverityLevel.CRITICAL,
                "description": "Unrestricted external calls in bridge contracts",
                "exploit_examples": ["Poly Network ($611M)", "Cross-chain message manipulation"],
                "financial_impact": "$300M-$611M proven"
            },
            
            "BRIDGE_MESSAGE_VALIDATION": {
                "regex": r"(executeMessage|processMessage)\([^)]*\)(?!.*validate|.*verify|.*authenticate)",
                "category": ExploitCategory.BRIDGE_EXPLOIT,
                "severity": SeverityLevel.HIGH,
                "description": "Missing message validation in cross-chain execution",
                "exploit_examples": ["Wormhole ($326M)", "Message replay attacks"],
                "financial_impact": "$200M-$400M typical"
            },
            
            # Access Control Patterns ($4.4B category)
            "ACCESS_MISSING_MODIFIER": {
                "regex": r"function\s+(\w+).*external(?!.*onlyOwner|.*onlyAdmin|.*authorized|.*private)",
                "category": ExploitCategory.ACCESS_CONTROL,
                "severity": SeverityLevel.HIGH,
                "description": "External functions without access control modifiers",
                "exploit_examples": ["Admin function exposure", "Privilege escalation"],
                "financial_impact": "$1M-$50M typical"
            },
            
            "ACCESS_DELEGATECALL_UNRESTRICTED": {
                "regex": r"\.delegatecall\([^)]*\)(?!.*onlyOwner|.*whitelist|.*authorized)",
                "category": ExploitCategory.ACCESS_CONTROL,
                "severity": SeverityLevel.CRITICAL,
                "description": "Unrestricted delegatecall enabling arbitrary code execution",
                "exploit_examples": ["Proxy implementation takeover", "Storage corruption"],
                "financial_impact": "$10M-$200M potential"
            },
            
            # Reentrancy Patterns ($419M category)
            "REENTRANCY_CLASSIC": {
                "regex": r"\.call\{value:[^}]*\}\([^)]*\)[^;]*;[^}]*(\w+\[[^\]]*\]\s*[-=]|\w+\s*[-=])",
                "category": ExploitCategory.REENTRANCY,
                "severity": SeverityLevel.HIGH,
                "description": "External call before state update - classic reentrancy",
                "exploit_examples": ["The DAO hack", "Cream Finance exploits"],
                "financial_impact": "$10M-$150M proven"
            },
            
            "REENTRANCY_CROSS_FUNCTION": {
                "regex": r"function\s+\w+.*external.*{[^}]*\.call[^}]*}(?=.*function\s+\w+.*external)",
                "category": ExploitCategory.REENTRANCY,
                "severity": SeverityLevel.MEDIUM,
                "description": "Cross-function reentrancy vulnerability",
                "exploit_examples": ["Uniswap V1 reentrancy", "Multi-function exploits"],
                "financial_impact": "$1M-$50M typical"
            },
            
            # Signature Replay Patterns ($407M category)
            "SIGNATURE_MISSING_NONCE": {
                "regex": r"(verify|ecrecover)\([^)]*signature[^)]*\)(?!.*nonce|.*deadline|.*timestamp)",
                "category": ExploitCategory.SIGNATURE_REPLAY,
                "severity": SeverityLevel.MEDIUM,
                "description": "Signature verification without nonce or timestamp",
                "exploit_examples": ["Meta-transaction replay", "Permit function abuse"],
                "financial_impact": "$1M-$20M typical"
            },
            
            "SIGNATURE_CHAIN_REPLAY": {
                "regex": r"(permit|executeMetaTx)\([^)]*\)(?!.*chainId|.*CHAIN_ID|.*DOMAIN_SEPARATOR)",
                "category": ExploitCategory.SIGNATURE_REPLAY,
                "severity": SeverityLevel.HIGH,
                "description": "Cross-chain signature replay vulnerability",
                "exploit_examples": ["Multi-chain permit abuse", "Domain separator bypass"],
                "financial_impact": "$5M-$50M potential"
            },
            
            # Upgrade Vulnerability Patterns ($328M category)
            "UPGRADE_UNPROTECTED": {
                "regex": r"(implementation\s*=|upgradeTo\(|setImplementation\()(?!.*onlyOwner|.*timelock|.*multisig)",
                "category": ExploitCategory.UPGRADE_VULNERABILITY,
                "severity": SeverityLevel.CRITICAL,
                "description": "Unprotected upgrade functions allowing implementation replacement",
                "exploit_examples": ["Proxy implementation takeover", "Malicious upgrades"],
                "financial_impact": "$50M-$200M potential"
            },
            
            "UPGRADE_STORAGE_COLLISION": {
                "regex": r"contract\s+\w*V\d+.*{[^}]*(mapping[^;]*;[^}]*uint256|uint256[^;]*;[^}]*mapping)",
                "category": ExploitCategory.UPGRADE_VULNERABILITY,
                "severity": SeverityLevel.HIGH,
                "description": "Storage layout changes causing slot collisions in upgrades",
                "exploit_examples": ["Storage corruption", "Variable overwrites"],
                "financial_impact": "$10M-$100M potential"
            },
            
            # Compiler Bug Patterns ($201M category)
            "COMPILER_ABI_ENCODER_V2": {
                "regex": r"pragma\s+experimental\s+ABIEncoderV2.*pragma\s+solidity.*0\.[45]\.",
                "category": ExploitCategory.COMPILER_BUG,
                "severity": SeverityLevel.MEDIUM,
                "description": "Vulnerable Solidity version with experimental ABI encoder",
                "exploit_examples": ["ABI encoding corruption", "Array manipulation bugs"],
                "financial_impact": "$1M-$50M potential"
            },
            
            "COMPILER_OPTIMIZER_LOOP": {
                "regex": r"for\s*\([^}]*\)\s*{[^}]*require\([^}]*\}.*pragma.*optimizer",
                "category": ExploitCategory.COMPILER_BUG,
                "severity": SeverityLevel.MEDIUM,
                "description": "Optimizer may remove necessary checks in loops",
                "exploit_examples": ["Loop optimization bugs", "Condition removal"],
                "financial_impact": "$5M-$25M potential"
            },
            
            # Donation Attack Patterns ($197M category)
            "DONATION_BALANCE_PRICE": {
                "regex": r"balanceOf\(address\(this\)\)[^;]*[\/\*][^;]*balanceOf\(address\(this\)\)",
                "category": ExploitCategory.DONATION_ATTACK,
                "severity": SeverityLevel.HIGH,
                "description": "Price calculation based on contract balance - donation manipulable",
                "exploit_examples": ["Flash loan price manipulation", "Oracle manipulation"],
                "financial_impact": "$10M-$100M typical"
            },
            
            "DONATION_VIRTUAL_PRICE": {
                "regex": r"(virtualPrice|getVirtualPrice)\([^)]*\)(?!.*sync|.*skim|.*update)",
                "category": ExploitCategory.DONATION_ATTACK,
                "severity": SeverityLevel.MEDIUM,
                "description": "Virtual price calculation without donation protection",
                "exploit_examples": ["Curve virtual price inflation", "LP token manipulation"],
                "financial_impact": "$5M-$50M typical"
            }
        }
    
    def _initialize_threat_intel(self) -> List[ThreatIntelligence]:
        """Initialize threat intelligence database"""
        return [
            ThreatIntelligence(
                exploit_name="Ronin Bridge Hack",
                attack_vector="Multi-signature validator compromise + social engineering",
                financial_loss="$624M",
                timeline="March 23-29, 2022",
                technical_details="Compromised 4/9 validators + forgotten Axie DAO whitelist access",
                indicators=[
                    "validators_compromised >= 4",
                    "threshold_percentage < 60",
                    "detection_delay > 5_days",
                    "centralized_validator_control"
                ]
            ),
            ThreatIntelligence(
                exploit_name="Poly Network Cross-Chain Exploit",
                attack_vector="Cross-chain message validation bypass",
                financial_loss="$611M", 
                timeline="August 10, 2021",
                technical_details="Exploited verifyHeaderAndExecuteTx to call privileged contracts",
                indicators=[
                    "cross_chain_message_manipulation",
                    "signature_hash_collision", 
                    "validator_key_replacement",
                    "privileged_contract_access"
                ]
            ),
            ThreatIntelligence(
                exploit_name="Wormhole Bridge Exploit",
                attack_vector="Signature verification logic flaw",
                financial_loss="$326M",
                timeline="February 2, 2022", 
                technical_details="Solana precompile vs Wormhole verification discrepancy",
                indicators=[
                    "signature_verification_bypass",
                    "fake_signatureset_creation",
                    "vaa_verification_forge",
                    "cross_chain_mint_abuse"
                ]
            ),
            ThreatIntelligence(
                exploit_name="Nomad Bridge Misconfiguration",
                attack_vector="Merkle root validation failure",
                financial_loss="$190M",
                timeline="August 1-3, 2022",
                technical_details="0x00 marked as trusted root during upgrade",
                indicators=[
                    "trusted_root_misconfiguration",
                    "empty_merkle_root_acceptance", 
                    "upgrade_validation_failure",
                    "copycat_exploit_pattern"
                ]
            ),
            ThreatIntelligence(
                exploit_name="Harmony Bridge Compromise", 
                attack_vector="Multi-signature private key theft",
                financial_loss="$100M",
                timeline="June 23-24, 2022",
                technical_details="2/5 multisig private keys compromised",
                indicators=[
                    "private_key_compromise",
                    "insufficient_key_security",
                    "hot_wallet_storage",
                    "rapid_fund_drainage"
                ]
            )
        ]

class WhiteRabbitDetectionEngine:
    """Main detection engine for exploit pattern analysis"""
    
    def __init__(self):
        self.pattern_db = ExploitPatternDatabase()
        self.detection_history = []
        self.risk_thresholds = {
            SeverityLevel.LOW: 25,
            SeverityLevel.MEDIUM: 50, 
            SeverityLevel.HIGH: 75,
            SeverityLevel.CRITICAL: 90
        }
    
    def analyze_contract(self, source_code: str, contract_address: str = None) -> Dict:
        """Comprehensive contract analysis for exploit patterns"""
        
        # Detect all patterns
        detected_patterns = []
        for pattern_id, pattern_data in self.pattern_db.patterns.items():
            matches = self._detect_pattern(source_code, pattern_id, pattern_data)
            detected_patterns.extend(matches)
        
        # Calculate risk metrics
        risk_score = self._calculate_risk_score(detected_patterns)
        exploit_scenarios = self._generate_exploit_scenarios(detected_patterns)
        
        # Generate actionable recommendations
        recommendations = self._generate_recommendations(detected_patterns)
        
        # Create analysis report
        analysis = {
            "contract_address": contract_address,
            "analysis_timestamp": datetime.now().isoformat(),
            "detected_patterns": [asdict(p) for p in detected_patterns],
            "risk_score": risk_score,
            "severity_breakdown": self._calculate_severity_breakdown(detected_patterns),
            "exploit_scenarios": exploit_scenarios,
            "recommendations": recommendations,
            "threat_intelligence": self._match_threat_intel(detected_patterns)
        }
        
        # Store in detection history
        self.detection_history.append(analysis)
        
        return analysis
    
    def _detect_pattern(self, source_code: str, pattern_id: str, pattern_data: Dict) -> List[ExploitPattern]:
        """Detect specific pattern in source code"""
        matches = []
        lines = source_code.split('\n')
        
        pattern_regex = pattern_data['regex']
        
        for line_num, line in enumerate(lines, 1):
            if re.search(pattern_regex, line, re.IGNORECASE):
                
                # Calculate detection confidence based on context
                confidence = self._calculate_detection_confidence(line, pattern_data)
                
                # Extract relevant code snippet  
                snippet = self._extract_code_snippet(lines, line_num, 3)
                
                match = ExploitPattern(
                    pattern_id=pattern_id,
                    category=pattern_data['category'],
                    severity=pattern_data['severity'], 
                    location=f"Line {line_num}",
                    description=pattern_data['description'],
                    exploit_potential=pattern_data.get('exploit_examples', ['Unknown'])[0],
                    financial_impact_estimate=pattern_data.get('financial_impact', 'Unknown'),
                    detection_confidence=confidence,
                    code_snippet=snippet,
                    recommendation=self._get_pattern_recommendation(pattern_id)
                )
                
                matches.append(match)
        
        return matches
    
    def _calculate_detection_confidence(self, line: str, pattern_data: Dict) -> float:
        """Calculate confidence score for pattern detection"""
        confidence = 0.7  # Base confidence
        
        # Increase confidence for critical patterns
        if pattern_data['severity'] == SeverityLevel.CRITICAL:
            confidence += 0.1
            
        # Decrease confidence if safe patterns present
        safe_indicators = ['require(', 'onlyOwner', 'nonReentrant', 'SafeMath']
        if any(indicator in line for indicator in safe_indicators):
            confidence -= 0.2
            
        # Increase confidence for known vulnerable patterns
        vuln_indicators = ['msg.sender.call', '.delegatecall(', 'balanceOf(address(this))']
        if any(indicator in line for indicator in vuln_indicators):
            confidence += 0.15
            
        return max(0.1, min(1.0, confidence))
    
    def _extract_code_snippet(self, lines: List[str], center_line: int, context: int) -> str:
        """Extract code snippet around detected pattern"""
        start = max(0, center_line - context - 1)
        end = min(len(lines), center_line + context)
        
        snippet_lines = []
        for i in range(start, end):
            prefix = ">>> " if i == center_line - 1 else "    "
            snippet_lines.append(f"{prefix}{i+1}: {lines[i]}")
            
        return '\n'.join(snippet_lines)
    
    def _calculate_risk_score(self, patterns: List[ExploitPattern]) -> float:
        """Calculate overall risk score (0-100)"""
        if not patterns:
            return 0.0
            
        # Weight by severity and confidence
        weighted_scores = []
        for pattern in patterns:
            severity_weight = pattern.severity.value / 4.0  # Normalize to 0-1
            confidence_weight = pattern.detection_confidence
            weighted_scores.append(severity_weight * confidence_weight * 100)
        
        # Use maximum risk approach with diminishing returns
        max_score = max(weighted_scores)
        avg_score = sum(weighted_scores) / len(weighted_scores)
        
        # Combine max and average with 70/30 weighting
        final_score = (max_score * 0.7) + (avg_score * 0.3)
        
        return min(100.0, final_score)
    
    def _calculate_severity_breakdown(self, patterns: List[ExploitPattern]) -> Dict:
        """Calculate breakdown by severity level"""
        breakdown = {level.name: 0 for level in SeverityLevel}
        
        for pattern in patterns:
            breakdown[pattern.severity.name] += 1
            
        return breakdown
    
    def _generate_exploit_scenarios(self, patterns: List[ExploitPattern]) -> List[Dict]:
        """Generate specific exploit scenarios based on detected patterns"""
        scenarios = []
        
        # Group patterns by category
        by_category = {}
        for pattern in patterns:
            if pattern.category not in by_category:
                by_category[pattern.category] = []
            by_category[pattern.category].append(pattern)
        
        # Generate scenarios for each category
        for category, category_patterns in by_category.items():
            if category == ExploitCategory.LOGIC_ERROR:
                scenarios.extend(self._generate_logic_error_scenarios(category_patterns))
            elif category == ExploitCategory.BRIDGE_EXPLOIT:
                scenarios.extend(self._generate_bridge_exploit_scenarios(category_patterns))
            elif category == ExploitCategory.REENTRANCY:
                scenarios.extend(self._generate_reentrancy_scenarios(category_patterns))
            # Add other categories as needed
                
        return scenarios
    
    def _generate_logic_error_scenarios(self, patterns: List[ExploitPattern]) -> List[Dict]:
        """Generate logic error exploit scenarios"""
        scenarios = []
        
        for pattern in patterns:
            if "PRECISION" in pattern.pattern_id:
                scenarios.append({
                    "scenario_type": "Precision Loss Exploit",
                    "attack_steps": [
                        "1. Deploy or interact with vulnerable contract",
                        "2. Make repeated small deposits/withdrawals to trigger rounding", 
                        "3. Accumulate rounded amounts over multiple transactions",
                        "4. Extract accumulated value through normal operations"
                    ],
                    "required_capital": "Low ($1,000-$10,000)",
                    "expected_profit": "High (10-1000x depending on volume)",
                    "timeframe": "Hours to days",
                    "detection_difficulty": "Medium"
                })
                
        return scenarios
    
    def _generate_bridge_exploit_scenarios(self, patterns: List[ExploitPattern]) -> List[Dict]:
        """Generate bridge exploit scenarios"""
        scenarios = []
        
        for pattern in patterns:
            if "CONSENSUS" in pattern.pattern_id:
                scenarios.append({
                    "scenario_type": "Bridge Validator Compromise",
                    "attack_steps": [
                        "1. Identify validator set composition and security practices",
                        "2. Target centralized validators through social engineering",
                        "3. Compromise sufficient validators to meet threshold", 
                        "4. Submit malicious cross-chain transactions",
                        "5. Extract maximum value before detection"
                    ],
                    "required_capital": "High ($100,000+ for sophisticated attacks)",
                    "expected_profit": "Massive ($100M+ potential)",
                    "timeframe": "Weeks to months for preparation, hours for execution",
                    "detection_difficulty": "High (may go undetected for days)"
                })
                
        return scenarios
    
    def _generate_reentrancy_scenarios(self, patterns: List[ExploitPattern]) -> List[Dict]:
        """Generate reentrancy exploit scenarios"""
        scenarios = []
        
        for pattern in patterns:
            scenarios.append({
                "scenario_type": "Reentrancy Drain Attack",
                "attack_steps": [
                    "1. Deploy malicious contract with fallback function",
                    "2. Call vulnerable function (withdraw/transfer)",
                    "3. In fallback, recursively call vulnerable function",
                    "4. Drain contract before state updates complete"
                ],
                "required_capital": "Medium ($10,000-$100,000)",
                "expected_profit": "High (limited by contract balance)",
                "timeframe": "Single transaction or block",
                "detection_difficulty": "Low to Medium"
            })
            
        return scenarios
    
    def _get_pattern_recommendation(self, pattern_id: str) -> str:
        """Get specific recommendation for pattern"""
        recommendations = {
            "LOGIC_PRECISION_DIVISION": "Use scaling factors (1e18) and SafeMath operations",
            "LOGIC_OVERFLOW_UNCHECKED": "Implement SafeMath or use Solidity 0.8+ with automatic checks",
            "BRIDGE_WEAK_CONSENSUS": "Increase validator threshold to at least 66% and add geographic distribution",
            "ACCESS_MISSING_MODIFIER": "Add access control modifiers (onlyOwner, onlyAdmin) to sensitive functions",
            "REENTRANCY_CLASSIC": "Use checks-effects-interactions pattern and reentrancy guards",
            "UPGRADE_UNPROTECTED": "Add timelock and multisig protection to upgrade functions"
        }
        return recommendations.get(pattern_id, "Review pattern and implement appropriate security measures")
    
    def _generate_recommendations(self, patterns: List[ExploitPattern]) -> List[str]:
        """Generate prioritized recommendations"""
        recommendations = []
        
        # Critical issues first
        critical_patterns = [p for p in patterns if p.severity == SeverityLevel.CRITICAL]
        if critical_patterns:
            recommendations.append("🚨 CRITICAL: Address critical vulnerabilities immediately before deployment")
            
        # Category-specific recommendations
        categories = set(p.category for p in patterns)
        
        if ExploitCategory.BRIDGE_EXPLOIT in categories:
            recommendations.append("🌉 Bridge Security: Implement multi-chain validation and increase decentralization")
            
        if ExploitCategory.ACCESS_CONTROL in categories:
            recommendations.append("🔐 Access Control: Add comprehensive permission checks and role management")
            
        if ExploitCategory.REENTRANCY in categories:
            recommendations.append("🔄 Reentrancy: Implement guards and follow checks-effects-interactions pattern")
            
        return recommendations
    
    def _match_threat_intel(self, patterns: List[ExploitPattern]) -> List[Dict]:
        """Match detected patterns to known threat intelligence"""
        matched_intel = []
        
        for pattern in patterns:
            for intel in self.pattern_db.threat_intel:
                # Simple matching based on category and severity
                if (pattern.category == ExploitCategory.BRIDGE_EXPLOIT and 
                    pattern.severity == SeverityLevel.CRITICAL and
                    "bridge" in intel.exploit_name.lower()):
                    matched_intel.append({
                        "threat_name": intel.exploit_name,
                        "historical_loss": intel.financial_loss,
                        "attack_method": intel.attack_vector,
                        "relevance_score": 0.8
                    })
                    
        return matched_intel

    def monitor_transaction_patterns(self, transactions: List[Dict]) -> Dict:
        """Monitor for exploitation patterns in transaction data"""
        alerts = []
        
        # Check for precision exploit patterns
        small_value_txs = [tx for tx in transactions if float(tx.get('value', 0)) < 0.001]
        if len(small_value_txs) > 100:
            alerts.append({
                "alert_type": "Potential Precision Exploit",
                "severity": "HIGH",
                "description": f"Detected {len(small_value_txs)} small-value transactions",
                "recommendation": "Investigate for rounding/precision attacks"
            })
            
        # Check for flash loan reentrancy
        for tx in transactions:
            if ('flashLoan' in str(tx.get('input', '')) and 
                'call' in str(tx.get('input', ''))):
                alerts.append({
                    "alert_type": "Flash Loan Reentrancy Risk", 
                    "severity": "HIGH",
                    "transaction": tx.get('hash'),
                    "description": "Flash loan with external call detected"
                })
        
        return {
            "timestamp": datetime.now().isoformat(),
            "analyzed_transactions": len(transactions),
            "alerts": alerts,
            "risk_level": "HIGH" if alerts else "LOW"
        }

# Example usage and testing
if __name__ == "__main__":
    # Initialize detection engine
    engine = WhiteRabbitDetectionEngine()
    
    # Example vulnerable contract
    vulnerable_contract = """
    pragma solidity ^0.8.0;
    
    contract VulnerableExample {
        mapping(address => uint256) public balances;
        uint256 public totalSupply = 1000000;
        
        function withdraw(uint256 amount) external {
            require(balances[msg.sender] >= amount);
            msg.sender.call{value: amount}("");  // Reentrancy vulnerability
            balances[msg.sender] -= amount;      // State change after external call
        }
        
        function calculateShares(uint256 amount) external view returns (uint256) {
            return amount / totalSupply;         // Precision loss vulnerability  
        }
        
        function setAdmin(address newAdmin) external {
            admin = newAdmin;                    // Missing access control
        }
        
        function getPrice() external view returns (uint256) {
            return token0.balanceOf(address(this)) / token1.balanceOf(address(this));  // Donation attack
        }
    }
    """
    
    # Analyze contract
    analysis = engine.analyze_contract(vulnerable_contract, "0x1234...5678")
    
    # Print analysis results
    print("=== WhiteRabbit Exploit Pattern Analysis ===")
    print(f"Risk Score: {analysis['risk_score']:.1f}/100")
    print(f"Detected Patterns: {len(analysis['detected_patterns'])}")
    print(f"Severity Breakdown: {analysis['severity_breakdown']}")
    
    print("\n=== Critical Vulnerabilities ===")
    for pattern in analysis['detected_patterns']:
        if pattern['severity'] == SeverityLevel.CRITICAL.value:
            print(f"- {pattern['description']}")
            print(f"  Location: {pattern['location']}")
            print(f"  Impact: {pattern['financial_impact_estimate']}")
            print(f"  Confidence: {pattern['detection_confidence']:.2f}")
            
    print("\n=== Recommendations ===")
    for rec in analysis['recommendations']:
        print(f"- {rec}")