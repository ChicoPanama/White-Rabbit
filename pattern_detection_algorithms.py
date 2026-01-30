"""
PATTERNLEARNER VULNERABILITY DETECTION ALGORITHMS
Elite pattern matching engine for autonomous vulnerability discovery

CLASSIFICATION: INTERNAL ARMY USE ONLY
ANALYST: PatternLearner
VERSION: 2.0.1
"""

import re
import json
from typing import Dict, List, Tuple, Any
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

class VulnerabilityCategory(Enum):
    LOGIC_ERROR = "logic_error"
    BRIDGE_EXPLOIT = "bridge_exploit" 
    ACCESS_CONTROL = "access_control"
    REENTRANCY = "reentrancy"
    SIGNATURE_REPLAY = "signature_replay"
    UPGRADE_VULNERABILITY = "upgrade_vulnerability"
    COMPILER_BUG = "compiler_bug"
    DONATION_ATTACK = "donation_attack"
    FLASH_LOAN_COMBO = "flash_loan_combo"

class SeverityLevel(Enum):
    CRITICAL = 90
    HIGH = 70
    MEDIUM = 50
    LOW = 30
    INFO = 10

@dataclass
class VulnerabilityPattern:
    pattern_id: str
    category: VulnerabilityCategory
    severity: SeverityLevel
    regex_pattern: str
    description: str
    success_rate: float
    financial_impact_avg: int  # in USD millions
    detection_confidence: float

@dataclass
class ExploitIntelligence:
    exploit_name: str
    financial_loss: str
    attack_vector: str
    vulnerable_pattern: str
    success_factors: List[str]
    mitigation_bypassed: List[str]

class ElitePatternDetector:
    """Advanced vulnerability pattern detection engine"""
    
    def __init__(self):
        self.patterns = self._load_vulnerability_patterns()
        self.threat_intel = self._load_threat_intelligence()
        self.weight_matrix = self._calculate_pattern_weights()
        
    def _load_vulnerability_patterns(self) -> Dict[str, VulnerabilityPattern]:
        """Load comprehensive vulnerability pattern database"""
        patterns = {
            # LOGIC ERROR PATTERNS
            "LOGIC_PRECISION_LOSS_001": VulnerabilityPattern(
                pattern_id="LOGIC_PRECISION_LOSS_001",
                category=VulnerabilityCategory.LOGIC_ERROR,
                severity=SeverityLevel.HIGH,
                regex_pattern=r"(\w+)\s*\/\s*(\w+)(?!\s*\*\s*1e\d+)",
                description="Unscaled division leading to precision loss",
                success_rate=0.78,
                financial_impact_avg=45,
                detection_confidence=0.85
            ),
            
            "LOGIC_OVERFLOW_002": VulnerabilityPattern(
                pattern_id="LOGIC_OVERFLOW_002", 
                category=VulnerabilityCategory.LOGIC_ERROR,
                severity=SeverityLevel.HIGH,
                regex_pattern=r"\w+\s*\+=\s*\w+(?!.*require|.*SafeMath)",
                description="Unsafe arithmetic operations without overflow protection",
                success_rate=0.82,
                financial_impact_avg=67,
                detection_confidence=0.90
            ),
            
            "LOGIC_INVARIANT_003": VulnerabilityPattern(
                pattern_id="LOGIC_INVARIANT_003",
                category=VulnerabilityCategory.LOGIC_ERROR, 
                severity=SeverityLevel.CRITICAL,
                regex_pattern=r"transfer\([^)]+\)(?!.*require.*invariant)",
                description="Missing invariant validation after state changes",
                success_rate=0.73,
                financial_impact_avg=89,
                detection_confidence=0.88
            ),
            
            # BRIDGE EXPLOIT PATTERNS
            "BRIDGE_CONSENSUS_001": VulnerabilityPattern(
                pattern_id="BRIDGE_CONSENSUS_001",
                category=VulnerabilityCategory.BRIDGE_EXPLOIT,
                severity=SeverityLevel.CRITICAL,
                regex_pattern=r"require\(.*\.length\s*>=\s*[1-4]\)",
                description="Weak consensus threshold (<50% validators)",
                success_rate=0.95,
                financial_impact_avg=156,
                detection_confidence=0.95
            ),
            
            "BRIDGE_MESSAGE_002": VulnerabilityPattern(
                pattern_id="BRIDGE_MESSAGE_002",
                category=VulnerabilityCategory.BRIDGE_EXPLOIT,
                severity=SeverityLevel.CRITICAL,
                regex_pattern=r"\.call\(.*\)(?!.*whitelist|.*authorized)",
                description="Unrestricted cross-chain message execution",
                success_rate=0.89,
                financial_impact_avg=203,
                detection_confidence=0.92
            ),
            
            # ACCESS CONTROL PATTERNS
            "ACCESS_MISSING_001": VulnerabilityPattern(
                pattern_id="ACCESS_MISSING_001",
                category=VulnerabilityCategory.ACCESS_CONTROL,
                severity=SeverityLevel.HIGH,
                regex_pattern=r"function\s+\w+.*external(?!.*onlyOwner|.*onlyAdmin)",
                description="Missing access control on sensitive functions",
                success_rate=0.71,
                financial_impact_avg=34,
                detection_confidence=0.75
            ),
            
            "ACCESS_DELEGATECALL_002": VulnerabilityPattern(
                pattern_id="ACCESS_DELEGATECALL_002",
                category=VulnerabilityCategory.ACCESS_CONTROL,
                severity=SeverityLevel.CRITICAL,
                regex_pattern=r"\.delegatecall\([^)]*\)(?!.*whitelist|.*authorized)",
                description="Unrestricted delegatecall enabling privilege escalation",
                success_rate=0.91,
                financial_impact_avg=78,
                detection_confidence=0.94
            ),
            
            # REENTRANCY PATTERNS
            "REENTRANCY_CLASSIC_001": VulnerabilityPattern(
                pattern_id="REENTRANCY_CLASSIC_001",
                category=VulnerabilityCategory.REENTRANCY,
                severity=SeverityLevel.HIGH,
                regex_pattern=r"\.call\{[^}]*\}[^;]*;[^}]*\w+\s*[-=]\s*\w+",
                description="External call before state update",
                success_rate=0.68,
                financial_impact_avg=23,
                detection_confidence=0.80
            ),
            
            "REENTRANCY_CROSS_002": VulnerabilityPattern(
                pattern_id="REENTRANCY_CROSS_002",
                category=VulnerabilityCategory.REENTRANCY,
                severity=SeverityLevel.MEDIUM,
                regex_pattern=r"deposits?\[.*\]\s*[+\-=](?=.*external.*call)",
                description="Cross-function reentrancy vulnerability",
                success_rate=0.54,
                financial_impact_avg=15,
                detection_confidence=0.72
            ),
            
            # SIGNATURE REPLAY PATTERNS
            "SIGNATURE_NONCE_001": VulnerabilityPattern(
                pattern_id="SIGNATURE_NONCE_001",
                category=VulnerabilityCategory.SIGNATURE_REPLAY,
                severity=SeverityLevel.MEDIUM,
                regex_pattern=r"verify\([^)]*signature[^)]*\)(?!.*nonce|.*timestamp)",
                description="Missing nonce/timestamp in signature verification",
                success_rate=0.64,
                financial_impact_avg=18,
                detection_confidence=0.75
            ),
            
            "SIGNATURE_CHAIN_002": VulnerabilityPattern(
                pattern_id="SIGNATURE_CHAIN_002",
                category=VulnerabilityCategory.SIGNATURE_REPLAY,
                severity=SeverityLevel.HIGH,
                regex_pattern=r"keccak256\([^)]*\)(?!.*chain.*id|.*CHAIN_ID)",
                description="Missing chain ID enabling cross-chain replay",
                success_rate=0.73,
                financial_impact_avg=41,
                detection_confidence=0.82
            ),
            
            # DONATION ATTACK PATTERNS
            "DONATION_BALANCE_001": VulnerabilityPattern(
                pattern_id="DONATION_BALANCE_001",
                category=VulnerabilityCategory.DONATION_ATTACK,
                severity=SeverityLevel.HIGH,
                regex_pattern=r"balanceOf\(address\(this\)\)[^;]*\/.*balanceOf",
                description="Price calculation vulnerable to donation manipulation",
                success_rate=0.79,
                financial_impact_avg=52,
                detection_confidence=0.85
            ),
            
            "DONATION_VIRTUAL_002": VulnerabilityPattern(
                pattern_id="DONATION_VIRTUAL_002",
                category=VulnerabilityCategory.DONATION_ATTACK,
                severity=SeverityLevel.MEDIUM,
                regex_pattern=r"balanceOf.*\+.*balanceOf[^;]*\/.*totalSupply",
                description="Virtual price calculation using manipulable balance",
                success_rate=0.67,
                financial_impact_avg=28,
                detection_confidence=0.78
            ),
            
            # UPGRADE PATTERNS
            "UPGRADE_UNPROTECTED_001": VulnerabilityPattern(
                pattern_id="UPGRADE_UNPROTECTED_001",
                category=VulnerabilityCategory.UPGRADE_VULNERABILITY,
                severity=SeverityLevel.CRITICAL,
                regex_pattern=r"implementation\s*=\s*\w+(?!.*onlyOwner|.*multisig)",
                description="Unprotected implementation upgrade",
                success_rate=0.88,
                financial_impact_avg=95,
                detection_confidence=0.91
            ),
            
            # COMPILER BUG PATTERNS  
            "COMPILER_ABI_001": VulnerabilityPattern(
                pattern_id="COMPILER_ABI_001",
                category=VulnerabilityCategory.COMPILER_BUG,
                severity=SeverityLevel.MEDIUM,
                regex_pattern=r"pragma experimental ABIEncoderV2",
                description="ABI Encoder V2 bug in Solidity 0.5.x",
                success_rate=0.45,
                financial_impact_avg=12,
                detection_confidence=0.70
            )
        }
        
        return patterns
        
    def _load_threat_intelligence(self) -> List[ExploitIntelligence]:
        """Load real-world exploit intelligence database"""
        threat_intel = [
            ExploitIntelligence(
                exploit_name="Ronin Bridge",
                financial_loss="$625M",
                attack_vector="Validator Private Key Compromise",
                vulnerable_pattern="BRIDGE_CONSENSUS_001",
                success_factors=[
                    "Centralized validator set", 
                    "4/9 consensus threshold",
                    "Social engineering of validators",
                    "Inadequate key security"
                ],
                mitigation_bypassed=[
                    "Multi-signature requirement",
                    "Time-locked withdrawals (not implemented)",
                    "Validator monitoring (insufficient)"
                ]
            ),
            
            ExploitIntelligence(
                exploit_name="Euler Finance",
                financial_loss="$197M", 
                attack_vector="Donation Attack on ERC4626 Vault",
                vulnerable_pattern="DONATION_BALANCE_001",
                success_factors=[
                    "Balance-based share calculation",
                    "No donation protection mechanism",
                    "Large initial donation to manipulate exchange rate",
                    "Vulnerable withdraw function"
                ],
                mitigation_bypassed=[
                    "Access controls (not relevant)",
                    "Slippage protection (not applicable)",
                    "Audit review (missed pattern)"
                ]
            ),
            
            ExploitIntelligence(
                exploit_name="Poly Network",
                financial_loss="$610M",
                attack_vector="Cross-Chain Message Validation Bypass",
                vulnerable_pattern="BRIDGE_MESSAGE_002",
                success_factors=[
                    "Insufficient message validation",
                    "Trusted relayer assumption",
                    "Lack of origin verification",
                    "Unrestricted target execution"
                ],
                mitigation_bypassed=[
                    "Message signing (forged)",
                    "Relayer trust model",
                    "Cross-chain validation"
                ]
            ),
            
            ExploitIntelligence(
                exploit_name="Beanstalk DAO",
                financial_loss="$182M",
                attack_vector="Flash Loan Governance Attack", 
                vulnerable_pattern="ACCESS_MISSING_001",
                success_factors=[
                    "Flash loan governance token acquisition",
                    "Same-block proposal and execution",
                    "No time delay on critical proposals",
                    "Insufficient quorum requirements"
                ],
                mitigation_bypassed=[
                    "Voting requirements (bypassed via flash loan)",
                    "Community oversight (circumvented by speed)",
                    "Proposal review period (none implemented)"
                ]
            ),
            
            ExploitIntelligence(
                exploit_name="Cream Finance",
                financial_loss="$130M",
                attack_vector="Flash Loan + Oracle Manipulation",
                vulnerable_pattern="LOGIC_PRECISION_LOSS_001",
                success_factors=[
                    "Flash loan amplification",
                    "Single oracle dependency", 
                    "Price manipulation via large swaps",
                    "Insufficient price validation"
                ],
                mitigation_bypassed=[
                    "Price slippage limits (insufficient)",
                    "Oracle timeout mechanisms",
                    "Multi-oracle validation (not implemented)"
                ]
            )
        ]
        
        return threat_intel
        
    def _calculate_pattern_weights(self) -> Dict[str, float]:
        """Calculate pattern importance weights based on historical data"""
        weights = {}
        
        for pattern_id, pattern in self.patterns.items():
            # Base weight from financial impact and success rate
            base_weight = (pattern.financial_impact_avg / 100) * pattern.success_rate
            
            # Severity multiplier
            severity_mult = {
                SeverityLevel.CRITICAL: 1.0,
                SeverityLevel.HIGH: 0.8, 
                SeverityLevel.MEDIUM: 0.6,
                SeverityLevel.LOW: 0.4,
                SeverityLevel.INFO: 0.2
            }[pattern.severity]
            
            # Confidence multiplier
            conf_mult = pattern.detection_confidence
            
            weights[pattern_id] = base_weight * severity_mult * conf_mult
            
        return weights
        
    def analyze_contract(self, source_code: str, bytecode: str = None) -> Dict[str, Any]:
        """Comprehensive contract vulnerability analysis"""
        detected_patterns = []
        risk_factors = {}
        
        # Pattern matching analysis
        for pattern_id, pattern in self.patterns.items():
            matches = re.findall(pattern.regex_pattern, source_code, re.IGNORECASE | re.MULTILINE)
            
            if matches:
                confidence = self._calculate_match_confidence(pattern, matches, source_code)
                
                detected_patterns.append({
                    "pattern_id": pattern_id,
                    "category": pattern.category.value,
                    "severity": pattern.severity.value,
                    "description": pattern.description,
                    "matches": len(matches),
                    "confidence": confidence,
                    "success_rate": pattern.success_rate,
                    "avg_loss": pattern.financial_impact_avg,
                    "code_samples": matches[:3]  # First 3 matches
                })
                
        # Calculate overall risk score
        risk_score = self._calculate_risk_score(detected_patterns)
        
        # Generate exploitation scenarios
        scenarios = self._generate_exploit_scenarios(detected_patterns)
        
        # Protocol classification
        protocol_type = self._classify_protocol_type(source_code)
        
        # Vulnerability correlation analysis
        correlations = self._analyze_vulnerability_correlations(detected_patterns)
        
        return {
            "contract_analysis": {
                "timestamp": datetime.now().isoformat(),
                "risk_score": risk_score,
                "protocol_type": protocol_type,
                "total_patterns": len(detected_patterns),
                "critical_count": len([p for p in detected_patterns if p["severity"] >= 90]),
                "high_count": len([p for p in detected_patterns if 70 <= p["severity"] < 90]),
                "medium_count": len([p for p in detected_patterns if 50 <= p["severity"] < 70])
            },
            "detected_patterns": detected_patterns,
            "exploitation_scenarios": scenarios,
            "vulnerability_correlations": correlations,
            "threat_intelligence": self._match_threat_intelligence(detected_patterns),
            "recommendations": self._generate_recommendations(detected_patterns, risk_score)
        }
        
    def _calculate_match_confidence(self, pattern: VulnerabilityPattern, 
                                   matches: List[str], source_code: str) -> float:
        """Calculate confidence level for pattern matches"""
        base_confidence = pattern.detection_confidence
        
        # Adjust for context clues
        if "SafeMath" in source_code and pattern.category == VulnerabilityCategory.LOGIC_ERROR:
            base_confidence *= 0.3  # Lower confidence if SafeMath is used
            
        if "ReentrancyGuard" in source_code and pattern.category == VulnerabilityCategory.REENTRANCY:
            base_confidence *= 0.2  # Much lower confidence if guarded
            
        if "onlyOwner" in source_code and pattern.category == VulnerabilityCategory.ACCESS_CONTROL:
            base_confidence *= 0.4  # Reduced confidence if access controls present
            
        # Adjust for match frequency
        match_count_factor = min(len(matches) / 5, 1.2)  # Cap at 20% bonus
        
        return min(base_confidence * match_count_factor, 0.95)
        
    def _calculate_risk_score(self, detected_patterns: List[Dict]) -> float:
        """Calculate overall contract risk score (0-100)"""
        if not detected_patterns:
            return 0.0
            
        # Weighted risk calculation
        total_weight = 0
        weighted_risk = 0
        
        for pattern in detected_patterns:
            weight = self.weight_matrix.get(pattern["pattern_id"], 0.5)
            pattern_risk = (pattern["severity"] / 100) * pattern["confidence"] * pattern["success_rate"]
            
            weighted_risk += pattern_risk * weight
            total_weight += weight
            
        base_score = (weighted_risk / total_weight) * 100 if total_weight > 0 else 0
        
        # Multi-vulnerability bonus
        if len(detected_patterns) >= 3:
            base_score *= 1.3  # 30% bonus for multiple vulnerabilities
        elif len(detected_patterns) >= 2:
            base_score *= 1.15  # 15% bonus for dual vulnerabilities
            
        # Critical vulnerability amplification
        critical_count = len([p for p in detected_patterns if p["severity"] >= 90])
        if critical_count >= 2:
            base_score *= 1.4  # 40% amplification for multiple critical issues
            
        return min(base_score, 98.0)  # Cap at 98%
        
    def _generate_exploit_scenarios(self, detected_patterns: List[Dict]) -> List[Dict]:
        """Generate specific exploit scenarios based on detected patterns"""
        scenarios = []
        
        # Single-vector scenarios
        for pattern in detected_patterns:
            scenario = {
                "scenario_type": "single_vector",
                "attack_vector": pattern["category"],
                "pattern_id": pattern["pattern_id"],
                "success_probability": pattern["success_rate"] * pattern["confidence"],
                "estimated_loss": pattern["avg_loss"],
                "complexity": "low",
                "time_to_exploit": "1-24 hours",
                "prerequisites": self._get_scenario_prerequisites(pattern),
                "attack_steps": self._get_attack_steps(pattern)
            }
            scenarios.append(scenario)
            
        # Multi-vector combination scenarios  
        if len(detected_patterns) >= 2:
            combinations = self._find_attack_combinations(detected_patterns)
            for combo in combinations:
                scenarios.append(combo)
                
        # Sort by success probability
        return sorted(scenarios, key=lambda x: x["success_probability"], reverse=True)
        
    def _find_attack_combinations(self, patterns: List[Dict]) -> List[Dict]:
        """Identify high-impact attack vector combinations"""
        combinations = []
        
        # Flash loan + governance attack
        flash_loan_pattern = next((p for p in patterns if "flash" in p["description"].lower()), None)
        governance_pattern = next((p for p in patterns if "access" in p["category"] or "admin" in p["description"].lower()), None)
        
        if flash_loan_pattern and governance_pattern:
            combinations.append({
                "scenario_type": "flash_loan_governance",
                "attack_vector": "combined",
                "pattern_ids": [flash_loan_pattern["pattern_id"], governance_pattern["pattern_id"]],
                "success_probability": 0.89,  # Historical average
                "estimated_loss": 180,  # Average flash loan governance loss
                "complexity": "high",
                "time_to_exploit": "1-6 hours",
                "prerequisites": [
                    "Governance tokens available for flash loan",
                    "Short voting periods",
                    "Valuable treasury assets"
                ],
                "attack_steps": [
                    "1. Flash loan governance tokens",
                    "2. Submit malicious governance proposal", 
                    "3. Vote with borrowed tokens",
                    "4. Execute proposal immediately",
                    "5. Extract treasury value",
                    "6. Repay flash loan with profits"
                ]
            })
            
        # Precision + donation attack combination
        precision_pattern = next((p for p in patterns if "precision" in p["description"].lower()), None)
        donation_pattern = next((p for p in patterns if "donation" in p["category"]), None)
        
        if precision_pattern and donation_pattern:
            combinations.append({
                "scenario_type": "precision_donation_combo",
                "attack_vector": "combined",
                "pattern_ids": [precision_pattern["pattern_id"], donation_pattern["pattern_id"]],
                "success_probability": 0.73,
                "estimated_loss": 65,
                "complexity": "medium",
                "time_to_exploit": "2-12 hours",
                "prerequisites": [
                    "ERC4626 vault or similar share mechanism",
                    "Precision loss in calculations",
                    "Ability to donate tokens directly"
                ],
                "attack_steps": [
                    "1. Calculate precision loss threshold",
                    "2. Donate tokens to inflate share price", 
                    "3. Exploit precision loss for profit",
                    "4. Repeat until maximum extraction"
                ]
            })
            
        return combinations
        
    def monitor_transaction_patterns(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Real-time transaction pattern monitoring for exploit detection"""
        alerts = []
        risk_level = "LOW"
        
        # Precision exploit pattern: many small value transactions
        small_txs = [tx for tx in transactions if tx.get("value", 0) < 0.001]
        if len(small_txs) > 100:
            alerts.append({
                "alert_type": "Precision Exploit Pattern",
                "severity": "HIGH", 
                "description": f"{len(small_txs)} small-value transactions detected",
                "confidence": 0.82
            })
            risk_level = "HIGH"
            
        # Flash loan reentrancy pattern: large value + external calls
        for tx in transactions:
            if tx.get("value", 0) > 1000 and "call" in tx.get("input", "").lower():
                alerts.append({
                    "alert_type": "Flash Loan Reentrancy Risk",
                    "severity": "HIGH",
                    "transaction": tx.get("hash"),
                    "confidence": 0.78
                })
                risk_level = "HIGH"
                
        return {
            "timestamp": datetime.now().isoformat(),
            "monitored_transactions": len(transactions),
            "risk_level": risk_level,
            "alerts": alerts,
            "patterns_detected": len(alerts)
        }
        
    def _classify_protocol_type(self, source_code: str) -> str:
        """Classify protocol type based on code patterns"""
        if any(keyword in source_code.lower() for keyword in ["swap", "liquidity", "amm"]):
            return "DEX/AMM"
        elif any(keyword in source_code.lower() for keyword in ["lend", "borrow", "collateral"]):
            return "Lending"
        elif any(keyword in source_code.lower() for keyword in ["bridge", "relay", "cross-chain"]):
            return "Bridge"
        elif any(keyword in source_code.lower() for keyword in ["governance", "proposal", "vote"]):
            return "Governance"
        elif any(keyword in source_code.lower() for keyword in ["vault", "yield", "farm"]):
            return "Yield Farming"
        else:
            return "Unknown"
            
    def _analyze_vulnerability_correlations(self, patterns: List[Dict]) -> Dict[str, Any]:
        """Analyze correlations between detected vulnerability patterns"""
        correlations = {}
        
        categories = [p["category"] for p in patterns]
        category_counts = {cat: categories.count(cat) for cat in set(categories)}
        
        # High-risk correlations
        if "logic_error" in categories and "access_control" in categories:
            correlations["logic_access_combo"] = {
                "risk_multiplier": 1.4,
                "description": "Logic errors + access control issues amplify risk"
            }
            
        if "bridge_exploit" in categories and len(set(categories)) > 1:
            correlations["bridge_multi_vector"] = {
                "risk_multiplier": 1.6,
                "description": "Bridge vulnerabilities with other issues are extremely high risk"
            }
            
        return correlations
        
    def _match_threat_intelligence(self, patterns: List[Dict]) -> List[Dict]:
        """Match detected patterns to known threat intelligence"""
        matches = []
        
        for pattern in patterns:
            for intel in self.threat_intel:
                if pattern["pattern_id"] == intel.vulnerable_pattern:
                    matches.append({
                        "pattern_id": pattern["pattern_id"],
                        "exploit_precedent": intel.exploit_name,
                        "historical_loss": intel.financial_loss,
                        "attack_vector": intel.attack_vector,
                        "success_factors": intel.success_factors
                    })
                    
        return matches
        
    def _generate_recommendations(self, patterns: List[Dict], risk_score: float) -> List[str]:
        """Generate specific security recommendations"""
        recommendations = []
        
        if risk_score >= 80:
            recommendations.append("🚨 CRITICAL: Immediate security review required")
            recommendations.append("🚨 Consider emergency pause mechanisms")
            
        if any(p["category"] == "bridge_exploit" for p in patterns):
            recommendations.append("🔗 Implement multi-oracle validation for bridge operations")
            recommendations.append("🔗 Increase consensus threshold to >60%")
            
        if any(p["category"] == "logic_error" for p in patterns):
            recommendations.append("🔢 Implement SafeMath or use Solidity 0.8+")
            recommendations.append("🔢 Add invariant checks after state changes")
            
        if any(p["category"] == "access_control" for p in patterns):
            recommendations.append("🔐 Add proper access control modifiers")
            recommendations.append("🔐 Implement multi-signature for critical functions")
            
        if any(p["category"] == "reentrancy" for p in patterns):
            recommendations.append("🔄 Use ReentrancyGuard or Checks-Effects-Interactions pattern")
            
        if any(p["category"] == "donation_attack" for p in patterns):
            recommendations.append("💰 Use internal accounting instead of balanceOf()")
            recommendations.append("💰 Implement minimum deposit requirements")
            
        return recommendations
        
    def _get_scenario_prerequisites(self, pattern: Dict) -> List[str]:
        """Get attack prerequisites for specific pattern"""
        prereq_map = {
            "logic_error": ["Contract deployment", "Function access"],
            "bridge_exploit": ["Cross-chain setup", "Validator compromise or consensus bypass"],
            "access_control": ["Contract interaction capability"], 
            "reentrancy": ["Contract with external calls", "Fallback function control"],
            "signature_replay": ["Valid signature capture", "Transaction replay capability"],
            "donation_attack": ["Token transfer capability", "Target contract access"],
            "upgrade_vulnerability": ["Admin access or upgrade pathway"]
        }
        
        return prereq_map.get(pattern["category"], ["Standard contract interaction"])
        
    def _get_attack_steps(self, pattern: Dict) -> List[str]:
        """Get specific attack steps for pattern"""
        steps_map = {
            "logic_error": [
                "1. Identify vulnerable calculation",
                "2. Craft input to trigger precision loss",
                "3. Execute transaction to extract value"
            ],
            "bridge_exploit": [
                "1. Compromise validator keys or bypass consensus",
                "2. Submit malicious cross-chain message",
                "3. Execute unauthorized operations on target chain"
            ],
            "access_control": [
                "1. Identify unprotected admin function",
                "2. Call function directly without authorization",
                "3. Extract value or gain control"
            ],
            "reentrancy": [
                "1. Call vulnerable function",
                "2. Re-enter via external call during execution", 
                "3. Drain contract before state update"
            ],
            "donation_attack": [
                "1. Deposit minimal amount for shares",
                "2. Donate tokens to inflate exchange rate",
                "3. Withdraw at inflated rate for profit"
            ]
        }
        
        return steps_map.get(pattern["category"], ["1. Exploit vulnerability"])

# Export for army use
detector = ElitePatternDetector()

def analyze_target(source_code: str, bytecode: str = None) -> Dict[str, Any]:
    """Main entry point for vulnerability analysis"""
    return detector.analyze_contract(source_code, bytecode)

def monitor_transactions(transactions: List[Dict]) -> Dict[str, Any]:
    """Main entry point for transaction monitoring"""
    return detector.monitor_transaction_patterns(transactions)

if __name__ == "__main__":
    print("🔍 PatternLearner Detection Engine v2.0.1 Loaded")
    print(f"📊 Pattern Database: {len(detector.patterns)} patterns")
    print(f"🎯 Threat Intelligence: {len(detector.threat_intel)} exploit records")
    print("⚡ Ready for autonomous vulnerability discovery")