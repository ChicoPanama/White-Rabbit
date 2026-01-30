#!/usr/bin/env python3
"""
LogicHunter-Alpha: Autonomous Business Logic Vulnerability Scanner
Targets $50M+ TVL DeFi protocols for critical logic vulnerabilities
"""

import asyncio
import aiohttp
import json
import re
from web3 import Web3
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class VulnerabilityAlert:
    protocol_name: str
    contract_address: str
    vulnerability_type: str
    risk_score: int
    description: str
    potential_impact: str
    chain: str
    detection_timestamp: datetime

class LogicHunterScanner:
    def __init__(self):
        self.chains = {
            'ethereum': {
                'rpc': 'https://eth.llamarpc.com',
                'chain_id': 1,
                'min_tvl': 50_000_000
            },
            'bsc': {
                'rpc': 'https://bsc-dataseed.binance.org',
                'chain_id': 56,
                'min_tvl': 50_000_000
            },
            'polygon': {
                'rpc': 'https://polygon-rpc.com',
                'chain_id': 137,
                'min_tvl': 30_000_000
            },
            'arbitrum': {
                'rpc': 'https://arb1.arbitrum.io/rpc',
                'chain_id': 42161,
                'min_tvl': 20_000_000
            },
            'avalanche': {
                'rpc': 'https://api.avax.network/ext/bc/C/rpc',
                'chain_id': 43114,
                'min_tvl': 20_000_000
            }
        }
        self.alerts = []
        
        # Critical vulnerability patterns from historical analysis
        self.vulnerability_patterns = {
            'input_validation_bypass': {
                'patterns': [
                    r'require\s*\(\s*[^;]*\s*==\s*0\s*\)',  # Zero value checks
                    r'if\s*\(\s*\w+\s*==\s*0x[0]+\s*\)',   # Zero address checks
                    r'assert\s*\(\s*[^;]*\s*>\s*0\s*\)'     # Positive value assertions
                ],
                'risk_score': 9,
                'description': 'Potential input validation bypass similar to Nomad Bridge'
            },
            'state_machine_exploit': {
                'patterns': [
                    r'mapping\s*\(\s*\w+\s*=>\s*bool\s*\)',  # State tracking
                    r'modifier\s+\w*\s*\{[^}]*require',      # Access modifiers
                    r'function\s+\w*\s*\([^)]*\)\s*\w*\s*\{[^}]*state'  # State changes
                ],
                'risk_score': 8,
                'description': 'Complex state management potentially vulnerable to manipulation'
            },
            'signature_verification': {
                'patterns': [
                    r'ecrecover\s*\(',                       # Signature recovery
                    r'verify.*signature',                    # Signature verification
                    r'keccak256\s*\(\s*abi\.encode'         # Hash verification
                ],
                'risk_score': 9,
                'description': 'Signature verification logic potentially bypassable like Wormhole'
            },
            'economic_exploit': {
                'patterns': [
                    r'price\s*\*\s*amount',                  # Price calculations
                    r'swap\s*\(',                            # Trading functions
                    r'liquidity.*pool',                      # Liquidity mechanics
                    r'reward.*calculate'                     # Reward calculations
                ],
                'risk_score': 7,
                'description': 'Economic model calculations susceptible to manipulation'
            },
            'bridge_verification': {
                'patterns': [
                    r'proof\s*\.\s*verify',                  # Proof verification
                    r'merkle.*root',                         # Merkle tree verification
                    r'cross.*chain',                         # Cross-chain operations
                    r'deposit.*withdraw'                     # Bridge operations
                ],
                'risk_score': 10,
                'description': 'Cross-chain bridge logic - highest risk category'
            }
        }
        
        # High-risk function signatures
        self.critical_functions = [
            '0xa9059cbb',  # transfer
            '0x23b872dd',  # transferFrom
            '0x095ea7b3',  # approve
            '0x40c10f19',  # mint
            '0x42966c68',  # burn
            '0x8da5cb5b',  # owner
            '0x13af4035',  # setOwner
        ]

    async def get_high_tvl_protocols(self, chain: str) -> List[Dict]:
        """Fetch high-TVL protocols for target scanning"""
        protocols = []
        
        # Mock protocol discovery - in production, integrate with DefiLlama API
        known_protocols = {
            'ethereum': [
                {'name': 'Compound V3', 'address': '0xc3d688B66703497DAA19211EEdff47f25384cdc3', 'tvl': 2_000_000_000},
                {'name': 'Aave V3', 'address': '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', 'tvl': 15_000_000_000},
                {'name': 'Curve Finance', 'address': '0xD533a949740bb3306d119CC777fa900bA034cd52', 'tvl': 3_500_000_000},
                {'name': 'Uniswap V3', 'address': '0xE592427A0AEce92De3Edee1F18E0157C05861564', 'tvl': 4_000_000_000}
            ],
            'bsc': [
                {'name': 'Venus Protocol', 'address': '0xfD36E2c2a6789Db23113685031d7F16329158384', 'tvl': 800_000_000},
                {'name': 'PancakeSwap V3', 'address': '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', 'tvl': 1_200_000_000}
            ],
            'polygon': [
                {'name': 'Aave Polygon', 'address': '0x794a61358D6845594F94dc1DB02A252b5b4814aD', 'tvl': 500_000_000}
            ],
            'arbitrum': [
                {'name': 'GMX', 'address': '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', 'tvl': 600_000_000}
            ],
            'avalanche': [
                {'name': 'Trader Joe', 'address': '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', 'tvl': 300_000_000}
            ]
        }
        
        chain_protocols = known_protocols.get(chain, [])
        min_tvl = self.chains[chain]['min_tvl']
        
        return [p for p in chain_protocols if p['tvl'] >= min_tvl]

    async def analyze_contract(self, chain: str, contract_address: str, protocol_name: str) -> List[VulnerabilityAlert]:
        """Analyze a smart contract for logic vulnerabilities"""
        alerts = []
        
        try:
            # Connect to blockchain
            w3 = Web3(Web3.HTTPProvider(self.chains[chain]['rpc']))
            if not w3.is_connected():
                logger.error(f"Failed to connect to {chain}")
                return alerts

            # Get contract bytecode
            bytecode = w3.eth.get_code(Web3.to_checksum_address(contract_address))
            if not bytecode or bytecode == '0x':
                logger.warning(f"No bytecode found for {contract_address}")
                return alerts

            # Attempt to get contract source (mock - would need Etherscan API in production)
            source_code = await self.get_contract_source(chain, contract_address)
            
            if source_code:
                # Analyze source code for vulnerability patterns
                for vuln_type, config in self.vulnerability_patterns.items():
                    for pattern in config['patterns']:
                        if re.search(pattern, source_code, re.IGNORECASE):
                            alert = VulnerabilityAlert(
                                protocol_name=protocol_name,
                                contract_address=contract_address,
                                vulnerability_type=vuln_type,
                                risk_score=config['risk_score'],
                                description=config['description'],
                                potential_impact=self.calculate_impact(config['risk_score']),
                                chain=chain,
                                detection_timestamp=datetime.now()
                            )
                            alerts.append(alert)
                            logger.warning(f"🚨 CRITICAL VULNERABILITY DETECTED: {vuln_type} in {protocol_name}")

            # Analyze transaction patterns
            recent_alerts = await self.analyze_transaction_patterns(w3, contract_address, protocol_name, chain)
            alerts.extend(recent_alerts)

        except Exception as e:
            logger.error(f"Error analyzing contract {contract_address}: {e}")

        return alerts

    async def get_contract_source(self, chain: str, address: str) -> Optional[str]:
        """Mock contract source retrieval - integrate with Etherscan API in production"""
        # This is a placeholder - in production, integrate with:
        # - Etherscan API for Ethereum
        # - BscScan API for BSC  
        # - PolygonScan API for Polygon
        # etc.
        return None

    async def analyze_transaction_patterns(self, w3: Web3, contract_address: str, protocol_name: str, chain: str) -> List[VulnerabilityAlert]:
        """Analyze recent transactions for suspicious patterns"""
        alerts = []
        
        try:
            # Get recent transactions (last 100 blocks)
            current_block = w3.eth.block_number
            start_block = max(0, current_block - 100)
            
            # Look for unusual transaction patterns
            for block_num in range(start_block, current_block):
                try:
                    block = w3.eth.get_block(block_num, full_transactions=True)
                    
                    for tx in block.transactions:
                        if tx.to and tx.to.lower() == contract_address.lower():
                            # Analyze transaction for suspicious patterns
                            suspicious_patterns = await self.check_suspicious_transaction(tx)
                            
                            for pattern in suspicious_patterns:
                                alert = VulnerabilityAlert(
                                    protocol_name=protocol_name,
                                    contract_address=contract_address,
                                    vulnerability_type=f"suspicious_pattern_{pattern}",
                                    risk_score=6,
                                    description=f"Detected suspicious transaction pattern: {pattern}",
                                    potential_impact="Medium - Transaction pattern analysis",
                                    chain=chain,
                                    detection_timestamp=datetime.now()
                                )
                                alerts.append(alert)
                
                except Exception as e:
                    # Continue if individual block fails
                    continue
                    
        except Exception as e:
            logger.error(f"Error analyzing transaction patterns: {e}")
            
        return alerts

    async def check_suspicious_transaction(self, tx) -> List[str]:
        """Check individual transaction for suspicious patterns"""
        patterns = []
        
        # Check for unusually high gas usage
        if tx.gas > 1_000_000:
            patterns.append("high_gas_usage")
            
        # Check for unusual value transfers
        if tx.value > Web3.to_wei(1000, 'ether'):
            patterns.append("large_value_transfer")
            
        # Check for function calls to critical functions
        if tx.input and len(tx.input) >= 10:
            function_sig = tx.input[:10]
            if function_sig in self.critical_functions:
                patterns.append("critical_function_call")
                
        return patterns

    def calculate_impact(self, risk_score: int) -> str:
        """Calculate potential economic impact based on risk score"""
        if risk_score >= 9:
            return "CRITICAL: $100M+ potential loss"
        elif risk_score >= 7:
            return "HIGH: $10M-100M potential loss"
        elif risk_score >= 5:
            return "MEDIUM: $1M-10M potential loss"
        else:
            return "LOW: <$1M potential loss"

    async def scan_chain(self, chain: str) -> List[VulnerabilityAlert]:
        """Scan all high-TVL protocols on a specific chain"""
        logger.info(f"🔍 Starting scan on {chain} chain...")
        
        protocols = await self.get_high_tvl_protocols(chain)
        chain_alerts = []
        
        for protocol in protocols:
            logger.info(f"Analyzing {protocol['name']} (TVL: ${protocol['tvl']:,})")
            
            alerts = await self.analyze_contract(
                chain, 
                protocol['address'], 
                protocol['name']
            )
            
            chain_alerts.extend(alerts)
            
            # Rate limiting
            await asyncio.sleep(1)
            
        return chain_alerts

    async def hunt_vulnerabilities(self) -> List[VulnerabilityAlert]:
        """Main hunting function - scan all target chains"""
        logger.info("🎯 LogicHunter-Alpha activated - Beginning autonomous vulnerability hunt")
        
        all_alerts = []
        
        # Prioritize chains by TVL and vulnerability history
        chain_priority = ['ethereum', 'bsc', 'arbitrum', 'polygon', 'avalanche']
        
        for chain in chain_priority:
            try:
                chain_alerts = await self.scan_chain(chain)
                all_alerts.extend(chain_alerts)
                
                logger.info(f"✅ Completed {chain} scan: {len(chain_alerts)} alerts generated")
                
            except Exception as e:
                logger.error(f"❌ Failed to scan {chain}: {e}")
                continue
        
        # Sort alerts by risk score
        all_alerts.sort(key=lambda x: x.risk_score, reverse=True)
        
        # Store alerts
        self.alerts = all_alerts
        
        return all_alerts

    async def generate_report(self) -> str:
        """Generate comprehensive vulnerability report"""
        if not self.alerts:
            return "No vulnerabilities detected in current scan."
            
        critical_alerts = [a for a in self.alerts if a.risk_score >= 9]
        high_alerts = [a for a in self.alerts if 7 <= a.risk_score < 9]
        
        report = f"""
🚨 LogicHunter-Alpha Vulnerability Report 🚨
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}

SUMMARY:
- Total Vulnerabilities: {len(self.alerts)}
- Critical Risk (Score 9-10): {len(critical_alerts)}
- High Risk (Score 7-8): {len(high_alerts)}
- Protocols Scanned: {len(set(a.protocol_name for a in self.alerts))}

CRITICAL VULNERABILITIES:
"""
        
        for alert in critical_alerts:
            report += f"""
Protocol: {alert.protocol_name}
Contract: {alert.contract_address}
Chain: {alert.chain}
Type: {alert.vulnerability_type}
Risk Score: {alert.risk_score}/10
Impact: {alert.potential_impact}
Description: {alert.description}
Detected: {alert.detection_timestamp.strftime('%Y-%m-%d %H:%M:%S')}
---
"""
        
        report += f"""

HIGH PRIORITY TARGETS:
"""
        for alert in high_alerts[:5]:  # Top 5 high-risk
            report += f"- {alert.protocol_name} ({alert.chain}): {alert.vulnerability_type}\n"
            
        return report

async def main():
    """Main execution function"""
    scanner = LogicHunterScanner()
    
    try:
        # Execute vulnerability hunt
        alerts = await scanner.hunt_vulnerabilities()
        
        # Generate and display report
        report = await scanner.generate_report()
        print(report)
        
        # Save report to file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = f"/home/ubuntu/clawd/logichunter_report_{timestamp}.txt"
        
        with open(report_file, 'w') as f:
            f.write(report)
            
        logger.info(f"📊 Report saved to {report_file}")
        
        # Alert on critical findings
        critical_count = sum(1 for a in alerts if a.risk_score >= 9)
        if critical_count > 0:
            logger.warning(f"🔥 {critical_count} CRITICAL vulnerabilities detected requiring immediate attention!")
            
    except Exception as e:
        logger.error(f"Hunt failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())