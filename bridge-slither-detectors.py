#!/usr/bin/env python3
"""
CrossChainHunter Bridge-Specific Slither Detectors
Specialized detectors for bridge vulnerability patterns from the $4.7B attack class
"""

from slither import Slither
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
import re


class BridgeSignatureBypassDetector(AbstractDetector):
    """
    Detects signature validation bypass vulnerabilities in bridge contracts
    Based on Wormhole ($326M) and Portal Finance ($326M) attack patterns
    """
    
    ARGUMENT = 'bridge-signature-bypass'
    HELP = 'Bridge signature validation bypass vulnerability'
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.HIGH

    WIKI = 'https://github.com/crytic/slither/wiki/bridge-signature-bypass'
    WIKI_TITLE = 'Bridge signature validation bypass'
    WIKI_DESCRIPTION = 'Bridge accepts invalid or missing signatures'
    WIKI_EXPLOIT_SCENARIO = """
```solidity
function verifySignatures(bytes32 hash, Signature[] memory signatures) {
    if (signatures.length == 0) return; // BUG: No signatures required
    for (uint i = 0; i < signatures.length; i++) {
        address signer = ecrecover(hash, signatures[i]);
        if (signer == address(0)) continue; // BUG: Ignores invalid signatures
        validSignatures++;
    }
    require(validSignatures >= threshold); // May pass with 0 valid signatures
}
```
An attacker can submit empty signature array or invalid signatures to bypass validation.
"""
    WIKI_RECOMMENDATION = 'Always validate signature count and reject invalid signatures'

    def _detect(self):
        results = []
        
        for contract in self.compilation_unit.contracts:
            for function in contract.functions:
                # Look for signature verification functions
                if any(keyword in function.name.lower() for keyword in 
                      ['verify', 'validate', 'check', 'signature', 'sign']):
                    
                    source_code = str(function.source_mapping)
                    
                    # Pattern 1: Empty signature array bypass
                    if re.search(r'if\s*\(\s*signatures?\.length\s*==\s*0\s*\)\s*return', source_code, re.IGNORECASE):
                        results.append([function, "Empty signature array bypasses validation"])
                    
                    # Pattern 2: Zero address from ecrecover not handled
                    if 'ecrecover' in source_code and 'address(0)' not in source_code:
                        results.append([function, "ecrecover zero address not validated"])
                    
                    # Pattern 3: Continue on invalid signature instead of reject
                    if re.search(r'if\s*\([^)]*address\(0\)[^)]*\)\s*continue', source_code):
                        results.append([function, "Invalid signatures ignored instead of rejected"])
                        
        return results


class BridgeMerkleProofBypassDetector(AbstractDetector):
    """
    Detects merkle proof verification bypass vulnerabilities 
    Based on BNB Bridge ($586M) attack pattern
    """
    
    ARGUMENT = 'bridge-merkle-bypass'
    HELP = 'Bridge merkle proof verification bypass'
    IMPACT = DetectorClassification.CRITICAL
    CONFIDENCE = DetectorClassification.HIGH

    def _detect(self):
        results = []
        
        for contract in self.compilation_unit.contracts:
            for function in contract.functions:
                if any(keyword in function.name.lower() for keyword in 
                      ['proof', 'merkle', 'verify', 'withdraw', 'process']):
                    
                    source_code = str(function.source_mapping)
                    
                    # Pattern 1: Empty proof bypasses validation  
                    if re.search(r'if\s*\(\s*proof\.length\s*==\s*0\s*\)\s*return\s+true', source_code):
                        results.append([function, "Empty proof bypasses merkle verification"])
                    
                    # Pattern 2: MerkleProof.verify return value not checked
                    if 'MerkleProof.verify' in source_code:
                        if not re.search(r'require\s*\(\s*MerkleProof\.verify', source_code):
                            results.append([function, "MerkleProof.verify return value not validated"])
                    
                    # Pattern 3: Zero merkle root accepted
                    if re.search(r'merkleRoot\s*==\s*bytes32\s*\(\s*0\s*\)', source_code):
                        results.append([function, "Zero merkle root may be accepted"])
                        
        return results


class BridgeReplayAttackDetector(AbstractDetector):
    """
    Detects missing replay protection in cross-chain message processing
    Critical for preventing cross-chain replay attacks
    """
    
    ARGUMENT = 'bridge-replay-attack'
    HELP = 'Bridge cross-chain replay attack vulnerability'
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM

    def _detect(self):
        results = []
        
        for contract in self.compilation_unit.contracts:
            # Look for message processing functions
            message_functions = []
            nonce_mappings = []
            
            for function in contract.functions:
                if any(keyword in function.name.lower() for keyword in 
                      ['process', 'execute', 'message', 'bridge', 'relay']):
                    message_functions.append(function)
            
            # Check for nonce/used tracking
            for variable in contract.state_variables:
                if 'nonce' in variable.name.lower() or 'used' in variable.name.lower():
                    nonce_mappings.append(variable)
            
            # If message processing exists but no replay protection
            if message_functions and not nonce_mappings:
                for func in message_functions:
                    results.append([func, "Cross-chain message processing without replay protection"])
                    
        return results


class BridgeValidatorThresholdDetector(AbstractDetector):
    """
    Detects insufficient validator thresholds in bridge consensus
    Based on Ronin Bridge ($625M) attack pattern
    """
    
    ARGUMENT = 'bridge-validator-threshold'
    HELP = 'Bridge validator threshold vulnerability'
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM

    def _detect(self):
        results = []
        
        for contract in self.compilation_unit.contracts:
            for variable in contract.state_variables:
                if any(keyword in variable.name.lower() for keyword in 
                      ['threshold', 'required', 'minimum', 'quorum']):
                    
                    # Check for hardcoded low thresholds
                    if hasattr(variable, 'expression') and variable.expression:
                        expr_str = str(variable.expression)
                        
                        # Look for suspiciously low thresholds
                        if re.search(r'\b[1-3]\b', expr_str):  # Threshold of 1-3
                            results.append([variable, f"Low validator threshold detected: {expr_str}"])
                        
                        # Look for percentage less than 51%
                        if re.search(r'\/\s*[2-9]', expr_str):  # Division by 2 or more (50% or less)
                            results.append([variable, f"Threshold below majority detected: {expr_str}"])
                            
        return results


class BridgeFinalityBypassDetector(AbstractDetector):
    """
    Detects finality assumption violations in optimistic rollup bridges
    """
    
    ARGUMENT = 'bridge-finality-bypass'
    HELP = 'Bridge finality assumption bypass'
    IMPACT = DetectorClassification.MEDIUM
    CONFIDENCE = DetectorClassification.LOW

    def _detect(self):
        results = []
        
        for contract in self.compilation_unit.contracts:
            for function in contract.functions:
                if any(keyword in function.name.lower() for keyword in 
                      ['withdraw', 'finalize', 'challenge', 'dispute']):
                    
                    source_code = str(function.source_mapping)
                    
                    # Pattern 1: Immediate withdrawal without delay
                    if 'immediateWithdraw' in source_code or 'instantWithdraw' in source_code:
                        results.append([function, "Immediate withdrawal bypasses finality period"])
                    
                    # Pattern 2: Short challenge period
                    if re.search(r'challengePeriod\s*=\s*[0-9]+\s*minutes', source_code):
                        results.append([function, "Challenge period may be too short"])
                        
        return results


def run_bridge_detector_analysis(target_path):
    """
    Run all bridge-specific detectors on a target contract
    """
    print(f"🔍 Running bridge-specific analysis on: {target_path}")
    
    try:
        slither = Slither(target_path)
        
        # Initialize bridge-specific detectors
        detectors = [
            BridgeSignatureBypassDetector(slither),
            BridgeMerkleProofBypassDetector(slither),
            BridgeReplayAttackDetector(slither),
            BridgeValidatorThresholdDetector(slither), 
            BridgeFinalityBypassDetector(slither)
        ]
        
        all_results = []
        
        for detector in detectors:
            print(f"   Running {detector.ARGUMENT} detector...")
            results = detector.detect()
            
            if results:
                print(f"   ⚠️  {len(results)} findings from {detector.ARGUMENT}")
                for result in results:
                    print(f"      🚨 {result[1] if len(result) > 1 else 'Bridge vulnerability detected'}")
                all_results.extend(results)
            else:
                print(f"   ✅ No findings from {detector.ARGUMENT}")
        
        return all_results
        
    except Exception as e:
        print(f"   ❌ Error analyzing {target_path}: {str(e)}")
        return []


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 bridge-slither-detectors.py <contract_path>")
        sys.exit(1)
    
    target = sys.argv[1]
    results = run_bridge_detector_analysis(target)
    
    if results:
        print(f"\n🚨 BRIDGE VULNERABILITY ANALYSIS COMPLETE")
        print(f"   Total findings: {len(results)}")
        print(f"   Target: {target}")
        print("\n💀 Ready for exploitation vector development...")
    else:
        print(f"\n✅ No bridge vulnerabilities detected in {target}")