#!/usr/bin/env python3
"""
Custom Slither Detectors for SSV Network Specific Vulnerabilities
"""

from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.core.declarations import Function, Contract
from slither.slithir.operations import (
    Assignment, 
    Binary, 
    Condition,
    HighLevelCall,
    Index,
    Member,
    NewContract,
    Return,
    Send,
    Transfer,
    TypeConversion
)
from slither.core.variables.state_variable import StateVariable
from slither.core.solidity_types import ElementaryType
from slither.utils.output import Output
from typing import List, Dict, Tuple, Any


class SSVOperatorFeeManipulation(AbstractDetector):
    """
    Detects potential operator fee manipulation vulnerabilities
    """
    
    ARGUMENT = "ssv-operator-fee-manipulation"
    HELP = "Operator fee manipulation vulnerabilities"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM
    
    WIKI = "https://github.com/bloxapp/ssv-network/security"
    WIKI_TITLE = "SSV Operator Fee Manipulation"
    WIKI_DESCRIPTION = "Detects functions that modify operator fees without proper validation"
    WIKI_EXPLOIT_SCENARIO = """
    An operator could manipulate their fees in ways that damage other participants:
    - Setting extremely high fees to grief validators
    - Rapidly changing fees to create unpredictable costs
    - Setting fees beyond maximum allowed values
    """
    WIKI_RECOMMENDATION = "Implement proper fee validation with bounds checking and rate limiting"

    def _detect(self) -> List[Output]:
        results = []
        
        for contract in self.compilation_unit.contracts:
            if self._is_ssv_contract(contract):
                for function in contract.functions:
                    if self._modifies_operator_fees(function):
                        if not self._has_proper_fee_validation(function):
                            info = [
                                function,
                                " modifies operator fees without proper validation\n"
                            ]
                            
                            res = self.generate_result(info)
                            results.append(res)
        
        return results
    
    def _is_ssv_contract(self, contract: Contract) -> bool:
        """Check if this is an SSV-related contract"""
        ssv_indicators = ['operator', 'validator', 'cluster', 'ssv', 'fee']
        contract_name_lower = contract.name.lower()
        return any(indicator in contract_name_lower for indicator in ssv_indicators)
    
    def _modifies_operator_fees(self, function: Function) -> bool:
        """Check if function modifies operator fee-related state"""
        fee_related_vars = ['fee', 'operatorFee', 'fees']
        
        for node in function.nodes:
            for ir in node.irs:
                if isinstance(ir, Assignment):
                    if hasattr(ir.lvalue, 'name'):
                        if any(fee_var in ir.lvalue.name.lower() for fee_var in fee_related_vars):
                            return True
        return False
    
    def _has_proper_fee_validation(self, function: Function) -> bool:
        """Check if function has proper fee validation"""
        has_bounds_check = False
        has_sender_check = False
        
        for node in function.nodes:
            for ir in node.irs:
                if isinstance(ir, Condition):
                    # Check for bounds validation
                    if self._contains_bounds_check(ir):
                        has_bounds_check = True
                    
                    # Check for sender validation
                    if self._contains_sender_check(ir):
                        has_sender_check = True
        
        return has_bounds_check and has_sender_check
    
    def _contains_bounds_check(self, ir) -> bool:
        """Check if IR contains bounds checking logic"""
        # Simplified check - in practice would need more sophisticated analysis
        return False
    
    def _contains_sender_check(self, ir) -> bool:
        """Check if IR contains sender validation"""
        # Simplified check - in practice would need more sophisticated analysis
        return False


class SSVClusterStateCorruption(AbstractDetector):
    """
    Detects potential cluster state corruption vulnerabilities
    """
    
    ARGUMENT = "ssv-cluster-state-corruption"
    HELP = "Cluster state corruption vulnerabilities"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.HIGH
    
    WIKI = "https://github.com/bloxapp/ssv-network/security"
    WIKI_TITLE = "SSV Cluster State Corruption"
    WIKI_DESCRIPTION = "Detects functions that can corrupt cluster state through improper validation"
    WIKI_EXPLOIT_SCENARIO = """
    An attacker could corrupt cluster state by:
    - Modifying cluster validator counts incorrectly
    - Setting invalid operator combinations
    - Manipulating network fee indices
    """
    WIKI_RECOMMENDATION = "Implement comprehensive cluster state validation"

    def _detect(self) -> List[Output]:
        results = []
        
        for contract in self.compilation_unit.contracts:
            if self._is_cluster_contract(contract):
                for function in contract.functions:
                    if self._modifies_cluster_state(function):
                        if not self._has_cluster_validation(function):
                            info = [
                                function,
                                " modifies cluster state without proper validation\n"
                            ]
                            
                            res = self.generate_result(info)
                            results.append(res)
        
        return results
    
    def _is_cluster_contract(self, contract: Contract) -> bool:
        """Check if this is a cluster-related contract"""
        return 'cluster' in contract.name.lower()
    
    def _modifies_cluster_state(self, function: Function) -> bool:
        """Check if function modifies cluster state"""
        cluster_vars = ['cluster', 'validatorCount', 'operators', 'networkFeeIndex']
        
        for node in function.nodes:
            for ir in node.irs:
                if isinstance(ir, Assignment):
                    if hasattr(ir.lvalue, 'name'):
                        if any(var in ir.lvalue.name for var in cluster_vars):
                            return True
        return False
    
    def _has_cluster_validation(self, function: Function) -> bool:
        """Check if function properly validates cluster modifications"""
        # Simplified validation check
        return False


class SSVSignatureReplayAttack(AbstractDetector):
    """
    Detects potential signature replay attack vulnerabilities
    """
    
    ARGUMENT = "ssv-signature-replay"
    HELP = "Signature replay attack vulnerabilities"
    IMPACT = DetectorClassification.CRITICAL
    CONFIDENCE = DetectorClassification.HIGH
    
    WIKI = "https://github.com/bloxapp/ssv-network/security"
    WIKI_TITLE = "SSV Signature Replay Attack"
    WIKI_DESCRIPTION = "Detects functions vulnerable to signature replay attacks"
    WIKI_EXPLOIT_SCENARIO = """
    An attacker could replay valid signatures to:
    - Execute operations multiple times
    - Bypass signature verification
    - Manipulate validator operations
    """
    WIKI_RECOMMENDATION = "Implement nonce-based replay protection for all signature operations"

    def _detect(self) -> List[Output]:
        results = []
        
        for contract in self.compilation_unit.contracts:
            for function in contract.functions:
                if self._uses_signatures(function):
                    if not self._has_replay_protection(function):
                        info = [
                            function,
                            " uses signatures without replay protection\n"
                        ]
                        
                        res = self.generate_result(info)
                        results.append(res)
        
        return results
    
    def _uses_signatures(self, function: Function) -> bool:
        """Check if function uses signature verification"""
        signature_indicators = ['signature', 'ecrecover', 'verify', 'keccak256']
        
        # Check function parameters
        for param in function.parameters:
            if any(indicator in param.name.lower() for indicator in signature_indicators):
                return True
        
        # Check function body
        for node in function.nodes:
            for ir in node.irs:
                if isinstance(ir, HighLevelCall):
                    if hasattr(ir.function, 'name'):
                        if any(indicator in ir.function.name.lower() for indicator in signature_indicators):
                            return True
        
        return False
    
    def _has_replay_protection(self, function: Function) -> bool:
        """Check if function has signature replay protection"""
        nonce_indicators = ['nonce', 'used', 'processed', 'executed']
        
        for node in function.nodes:
            for ir in node.irs:
                if isinstance(ir, Assignment):
                    if hasattr(ir.lvalue, 'name'):
                        if any(indicator in ir.lvalue.name.lower() for indicator in nonce_indicators):
                            return True
        
        return False


class SSVTimestampDependency(AbstractDetector):
    """
    Detects dangerous timestamp dependencies in SSV contracts
    """
    
    ARGUMENT = "ssv-timestamp-dependency"
    HELP = "Dangerous timestamp dependencies"
    IMPACT = DetectorClassification.MEDIUM
    CONFIDENCE = DetectorClassification.HIGH
    
    WIKI = "https://github.com/bloxapp/ssv-network/security"
    WIKI_TITLE = "SSV Timestamp Dependency"
    WIKI_DESCRIPTION = "Detects reliance on block.timestamp which can be manipulated by miners"
    WIKI_EXPLOIT_SCENARIO = """
    Miners can manipulate block.timestamp within certain bounds, potentially:
    - Affecting time-based fee calculations
    - Manipulating validator timing requirements
    - Bypassing time-based restrictions
    """
    WIKI_RECOMMENDATION = "Use block numbers instead of timestamps, or implement tolerance ranges"

    def _detect(self) -> List[Output]:
        results = []
        
        for contract in self.compilation_unit.contracts:
            for function in contract.functions:
                timestamp_uses = self._find_timestamp_uses(function)
                
                for node in timestamp_uses:
                    info = [
                        function,
                        f" uses block.timestamp at line {node.source_mapping.start}",
                        " which can be manipulated by miners\n"
                    ]
                    
                    res = self.generate_result(info)
                    results.append(res)
        
        return results
    
    def _find_timestamp_uses(self, function: Function) -> List:
        """Find nodes that use block.timestamp"""
        timestamp_nodes = []
        
        for node in function.nodes:
            if node.source_mapping:
                source_code = node.source_mapping.content
                if 'block.timestamp' in source_code or 'now' in source_code:
                    timestamp_nodes.append(node)
        
        return timestamp_nodes


class SSVReentrancyGuard(AbstractDetector):
    """
    Detects missing reentrancy guards in SSV critical functions
    """
    
    ARGUMENT = "ssv-reentrancy-guard"
    HELP = "Missing reentrancy guards in critical functions"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM
    
    WIKI = "https://github.com/bloxapp/ssv-network/security"
    WIKI_TITLE = "SSV Reentrancy Guard"
    WIKI_DESCRIPTION = "Detects functions that should have reentrancy guards"
    WIKI_EXPLOIT_SCENARIO = """
    Functions that make external calls and modify state are vulnerable to reentrancy:
    - Fee withdrawal functions
    - Operator registration functions
    - Validator management functions
    """
    WIKI_RECOMMENDATION = "Add reentrancy guards to all functions that make external calls"

    def _detect(self) -> List[Output]:
        results = []
        
        for contract in self.compilation_unit.contracts:
            for function in contract.functions:
                if self._needs_reentrancy_guard(function):
                    if not self._has_reentrancy_guard(function):
                        info = [
                            function,
                            " makes external calls without reentrancy protection\n"
                        ]
                        
                        res = self.generate_result(info)
                        results.append(res)
        
        return results
    
    def _needs_reentrancy_guard(self, function: Function) -> bool:
        """Check if function needs reentrancy guard"""
        makes_external_call = False
        modifies_state = False
        
        for node in function.nodes:
            for ir in node.irs:
                # Check for external calls
                if isinstance(ir, (HighLevelCall, Send, Transfer)):
                    makes_external_call = True
                
                # Check for state modifications
                if isinstance(ir, Assignment):
                    if isinstance(ir.lvalue, StateVariable):
                        modifies_state = True
        
        return makes_external_call and modifies_state
    
    def _has_reentrancy_guard(self, function: Function) -> bool:
        """Check if function has reentrancy guard"""
        # Check for nonReentrant modifier
        for modifier in function.modifiers:
            if 'nonReentrant' in modifier.name or 'ReentrancyGuard' in modifier.name:
                return True
        
        return False


class SSVAccessControlBypass(AbstractDetector):
    """
    Detects potential access control bypass vulnerabilities
    """
    
    ARGUMENT = "ssv-access-control-bypass"
    HELP = "Access control bypass vulnerabilities"
    IMPACT = DetectorClassification.CRITICAL
    CONFIDENCE = DetectorClassification.HIGH
    
    WIKI = "https://github.com/bloxapp/ssv-network/security"
    WIKI_TITLE = "SSV Access Control Bypass"
    WIKI_DESCRIPTION = "Detects improper access control implementations"
    WIKI_EXPLOIT_SCENARIO = """
    Improper access controls could allow:
    - Unauthorized operator registration
    - Unauthorized fee modifications
    - Unauthorized cluster modifications
    """
    WIKI_RECOMMENDATION = "Implement proper role-based access controls with clear hierarchies"

    def _detect(self) -> List[Output]:
        results = []
        
        for contract in self.compilation_unit.contracts:
            for function in contract.functions:
                if self._is_privileged_function(function):
                    if not self._has_proper_access_control(function):
                        info = [
                            function,
                            " lacks proper access control for privileged operations\n"
                        ]
                        
                        res = self.generate_result(info)
                        results.append(res)
        
        return results
    
    def _is_privileged_function(self, function: Function) -> bool:
        """Check if function performs privileged operations"""
        privileged_keywords = [
            'owner', 'admin', 'operator', 'withdraw', 'deposit',
            'register', 'update', 'set', 'modify', 'change'
        ]
        
        return any(keyword in function.name.lower() for keyword in privileged_keywords)
    
    def _has_proper_access_control(self, function: Function) -> bool:
        """Check if function has proper access control"""
        # Check for access control modifiers
        access_modifiers = ['onlyOwner', 'onlyAdmin', 'onlyOperator']
        
        for modifier in function.modifiers:
            if any(access_mod in modifier.name for access_mod in access_modifiers):
                return True
        
        # Check for require statements with msg.sender
        for node in function.nodes:
            if 'msg.sender' in str(node) and 'require' in str(node):
                return True
        
        return False


def create_ssv_detector_suite() -> List[type]:
    """Create a suite of SSV-specific detectors"""
    return [
        SSVOperatorFeeManipulation,
        SSVClusterStateCorruption,
        SSVSignatureReplayAttack,
        SSVTimestampDependency,
        SSVReentrancyGuard,
        SSVAccessControlBypass
    ]


if __name__ == "__main__":
    print("SSV Network Custom Slither Detectors")
    print("=====================================")
    
    detectors = create_ssv_detector_suite()
    
    print(f"Created {len(detectors)} custom SSV detectors:")
    for detector in detectors:
        print(f"  - {detector.ARGUMENT}: {detector.HELP}")
    
    print("\nTo use these detectors with Slither:")
    print("slither your_contract.sol --detect ssv-operator-fee-manipulation,ssv-cluster-state-corruption,...")