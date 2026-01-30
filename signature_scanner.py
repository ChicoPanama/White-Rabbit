#!/usr/bin/env python3
"""
SignatureForgery Scanner - Hunt for signature vulnerabilities in smart contracts
"""

import re
import json
from typing import List, Dict, Set

class SignatureVulnerabilityScanner:
    def __init__(self):
        self.vulnerability_patterns = {
            'missing_nonce': [
                r'ecrecover\([^)]*\)\s*==\s*\w+(?!.*nonce)',
                r'function.*Signature.*{[^}]*ecrecover(?!.*nonce).*}',
            ],
            'weak_domain_separator': [
                r'keccak256\(abi\.encode\([^)]*"EIP712Domain"[^)]*\)(?!.*chainId)',
                r'DOMAIN_SEPARATOR.*=.*keccak256(?!.*chainId)',
            ],
            'permit_bypass': [
                r'function\s+permit\s*\([^{]*{[^}]*(?!.*require\([^}]*deadline)',
                r'permit.*ecrecover(?!.*deadline.*require)',
            ],
            'signature_replay': [
                r'ecrecover\([^)]*\)(?!.*chain|.*nonce)',
                r'executeMetaTransaction(?!.*nonce)',
            ],
            'zero_address_bypass': [
                r'ecrecover\([^)]*\)\s*==\s*\w+(?!.*require\([^}]*!=\s*address\(0\))',
            ],
            'cross_chain_replay': [
                r'bridge.*signature(?!.*chainId)',
                r'relay.*signature(?!.*chain)',
            ]
        }
    
    def scan_contract_source(self, source_code: str, contract_name: str = "Unknown") -> Dict:
        """Scan contract source code for signature vulnerabilities"""
        results = {
            'contract': contract_name,
            'vulnerabilities': [],
            'risk_score': 0,
            'critical_issues': []
        }
        
        for vuln_type, patterns in self.vulnerability_patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, source_code, re.IGNORECASE | re.DOTALL)
                for match in matches:
                    line_num = source_code[:match.start()].count('\n') + 1
                    vulnerability = {
                        'type': vuln_type,
                        'line': line_num,
                        'code': match.group(0)[:100] + '...' if len(match.group(0)) > 100 else match.group(0),
                        'severity': self._get_severity(vuln_type),
                        'description': self._get_description(vuln_type)
                    }
                    results['vulnerabilities'].append(vulnerability)
                    
                    if vulnerability['severity'] == 'CRITICAL':
                        results['critical_issues'].append(vulnerability)
        
        results['risk_score'] = self._calculate_risk_score(results['vulnerabilities'])
        return results
    
    def _get_severity(self, vuln_type: str) -> str:
        severity_map = {
            'missing_nonce': 'CRITICAL',
            'weak_domain_separator': 'HIGH',
            'permit_bypass': 'CRITICAL',
            'signature_replay': 'CRITICAL',
            'zero_address_bypass': 'HIGH',
            'cross_chain_replay': 'CRITICAL'
        }
        return severity_map.get(vuln_type, 'MEDIUM')
    
    def _get_description(self, vuln_type: str) -> str:
        descriptions = {
            'missing_nonce': 'Signature verification without nonce validation - enables replay attacks',
            'weak_domain_separator': 'EIP-712 domain separator missing chain ID - cross-chain replay risk',
            'permit_bypass': 'Permit function missing deadline validation - expired permits accepted',
            'signature_replay': 'Signature can be replayed multiple times',
            'zero_address_bypass': 'ecrecover returning 0x0 not properly handled',
            'cross_chain_replay': 'Cross-chain signature without proper chain ID protection'
        }
        return descriptions.get(vuln_type, 'Unknown vulnerability pattern')
    
    def _calculate_risk_score(self, vulnerabilities: List[Dict]) -> int:
        score = 0
        for vuln in vulnerabilities:
            if vuln['severity'] == 'CRITICAL':
                score += 10
            elif vuln['severity'] == 'HIGH':
                score += 7
            elif vuln['severity'] == 'MEDIUM':
                score += 3
        return min(score, 100)
    
    def scan_permit_implementation(self, source_code: str) -> Dict:
        """Specialized scan for EIP-2612 permit implementation flaws"""
        permit_issues = []
        
        # Check for missing deadline validation
        if re.search(r'function\s+permit', source_code, re.IGNORECASE):
            if not re.search(r'require\([^}]*deadline[^}]*block\.timestamp', source_code, re.IGNORECASE):
                permit_issues.append({
                    'issue': 'Missing deadline validation',
                    'severity': 'CRITICAL',
                    'description': 'Permit function does not validate deadline against block.timestamp'
                })
        
        # Check for nonce handling
        if re.search(r'nonces\[.*\]\+\+', source_code):
            if not re.search(r'nonces\[owner\]\+\+', source_code):
                permit_issues.append({
                    'issue': 'Incorrect nonce increment',
                    'severity': 'HIGH',
                    'description': 'Nonce increment may not use correct owner address'
                })
        
        return {
            'permit_specific_issues': permit_issues,
            'has_permit': bool(re.search(r'function\s+permit', source_code, re.IGNORECASE))
        }

# Example vulnerable contracts for testing
VULNERABLE_EXAMPLES = {
    'replay_vulnerable': '''
    contract VulnerableMetaTx {
        mapping(address => bool) public executed;
        
        function executeMetaTransaction(
            address user,
            bytes calldata functionSignature,
            bytes32 r, bytes32 s, uint8 v
        ) external {
            bytes32 hash = keccak256(abi.encodePacked(user, functionSignature));
            require(ecrecover(hash, v, r, s) == user, "Invalid signature");
            // VULNERABLE: No nonce validation
            executed[user] = true;
        }
    }
    ''',
    
    'permit_vulnerable': '''
    contract VulnerableToken {
        mapping(address => mapping(address => uint256)) public allowances;
        mapping(address => uint256) public nonces;
        
        function permit(
            address owner, address spender, uint256 value,
            uint256 deadline, uint8 v, bytes32 r, bytes32 s
        ) external {
            // VULNERABLE: Missing deadline validation
            bytes32 digest = keccak256(abi.encodePacked(
                "\\x19\\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline))
            ));
            require(ecrecover(digest, v, r, s) == owner, "Invalid signature");
            allowances[owner][spender] = value;
        }
    }
    ''',
    
    'weak_domain': '''
    contract WeakDomainSeparator {
        bytes32 constant DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version)"),
            keccak256("MyProtocol"),
            keccak256("1")
            // VULNERABLE: Missing chainId and verifyingContract
        ));
    }
    '''
}

if __name__ == "__main__":
    scanner = SignatureVulnerabilityScanner()
    
    print("=== SignatureForgery Vulnerability Scanner ===\\n")
    
    for name, contract in VULNERABLE_EXAMPLES.items():
        print(f"Scanning {name}...")
        results = scanner.scan_contract_source(contract, name)
        
        print(f"Risk Score: {results['risk_score']}/100")
        print(f"Critical Issues: {len(results['critical_issues'])}")
        
        for vuln in results['vulnerabilities']:
            print(f"  [{vuln['severity']}] Line {vuln['line']}: {vuln['description']}")
        
        permit_results = scanner.scan_permit_implementation(contract)
        if permit_results['has_permit']:
            print("  Permit-specific analysis:")
            for issue in permit_results['permit_specific_issues']:
                print(f"    [{issue['severity']}] {issue['issue']}: {issue['description']}")
        
        print()