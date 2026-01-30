#!/usr/bin/env python3
"""
Donation Attack Detection Rules
Advanced monitoring system for identifying donation attack vulnerabilities and exploits
"""

import json
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum

class AlertLevel(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH" 
    MEDIUM = "MEDIUM"
    LOW = "LOW"

@dataclass
class Alert:
    level: AlertLevel
    attack_type: str
    contract_address: str
    transaction_hash: str
    description: str
    confidence: float
    timestamp: int

class DonationAttackDetector:
    def __init__(self):
        self.alerts = []
        self.tracked_contracts = {}
        self.exchange_rate_history = {}
        
    def analyze_transaction(self, tx_data: Dict) -> List[Alert]:
        """Main analysis function for detecting donation attacks"""
        alerts = []
        
        # Rule 1: Direct donation detection
        alerts.extend(self._detect_direct_donations(tx_data))
        
        # Rule 2: Exchange rate manipulation
        alerts.extend(self._detect_rate_manipulation(tx_data))
        
        # Rule 3: Suspicious withdrawal patterns
        alerts.extend(self._detect_suspicious_withdrawals(tx_data))
        
        # Rule 4: Flash loan donation patterns
        alerts.extend(self._detect_flash_loan_donations(tx_data))
        
        # Rule 5: Share supply anomalies
        alerts.extend(self._detect_share_anomalies(tx_data))
        
        return alerts
    
    def _detect_direct_donations(self, tx_data: Dict) -> List[Alert]:
        """Detect direct token transfers to contracts without corresponding mint events"""
        alerts = []
        
        transfers = tx_data.get('transfers', [])
        events = tx_data.get('events', [])
        
        # Look for transfers to contracts that should trigger mints/deposits
        for transfer in transfers:
            to_address = transfer.get('to', '').lower()
            amount = int(transfer.get('amount', 0))
            token = transfer.get('token', '').lower()
            
            # Check if recipient is a known vault/pool contract
            if self._is_vault_contract(to_address):
                # Check if there's a corresponding mint/deposit event
                has_mint_event = any(
                    event.get('event_name') in ['Mint', 'Deposit', 'Transfer'] and
                    event.get('to') == transfer.get('from') and
                    int(event.get('amount', 0)) > 0
                    for event in events
                )
                
                if not has_mint_event and amount > 1000000:  # Large transfer threshold
                    alerts.append(Alert(
                        level=AlertLevel.HIGH,
                        attack_type="DIRECT_DONATION",
                        contract_address=to_address,
                        transaction_hash=tx_data.get('hash', ''),
                        description=f"Large transfer ({amount}) to vault without mint event",
                        confidence=0.8,
                        timestamp=tx_data.get('timestamp', 0)
                    ))
        
        return alerts
    
    def _detect_rate_manipulation(self, tx_data: Dict) -> List[Alert]:
        """Detect sudden exchange rate changes indicating manipulation"""
        alerts = []
        
        # Extract rate changes from events
        rate_events = [e for e in tx_data.get('events', []) 
                      if 'rate' in e.get('event_name', '').lower() or
                         'price' in e.get('event_name', '').lower()]
        
        for event in rate_events:
            contract = event.get('contract', '').lower()
            new_rate = float(event.get('new_rate', 0))
            
            if contract in self.exchange_rate_history:
                old_rate = self.exchange_rate_history[contract][-1] if self.exchange_rate_history[contract] else new_rate
                
                if old_rate > 0:
                    rate_change = (new_rate - old_rate) / old_rate
                    
                    # Flag significant rate increases
                    if rate_change > 0.05:  # 5% increase
                        confidence = min(0.9, rate_change * 10)  # Higher change = higher confidence
                        
                        alerts.append(Alert(
                            level=AlertLevel.CRITICAL if rate_change > 0.2 else AlertLevel.HIGH,
                            attack_type="EXCHANGE_RATE_MANIPULATION",
                            contract_address=contract,
                            transaction_hash=tx_data.get('hash', ''),
                            description=f"Exchange rate increased by {rate_change*100:.1f}%",
                            confidence=confidence,
                            timestamp=tx_data.get('timestamp', 0)
                        ))
            
            # Update rate history
            if contract not in self.exchange_rate_history:
                self.exchange_rate_history[contract] = []
            self.exchange_rate_history[contract].append(new_rate)
            
            # Keep only recent history (last 100 values)
            if len(self.exchange_rate_history[contract]) > 100:
                self.exchange_rate_history[contract] = self.exchange_rate_history[contract][-100:]
        
        return alerts
    
    def _detect_suspicious_withdrawals(self, tx_data: Dict) -> List[Alert]:
        """Detect withdrawals that exceed reasonable bounds relative to deposits"""
        alerts = []
        
        withdrawal_events = [e for e in tx_data.get('events', [])
                            if e.get('event_name', '').lower() in ['withdraw', 'redeem', 'burn']]
        
        for event in withdrawal_events:
            user = event.get('user', '').lower()
            amount = int(event.get('amount', 0))
            contract = event.get('contract', '').lower()
            
            # Check user's recent deposit history
            recent_deposits = self._get_recent_user_deposits(user, contract)
            total_deposits = sum(recent_deposits.values())
            
            if total_deposits > 0:
                withdrawal_ratio = amount / total_deposits
                
                if withdrawal_ratio > 1.1:  # Withdrawing 10% more than deposited
                    alerts.append(Alert(
                        level=AlertLevel.HIGH,
                        attack_type="SUSPICIOUS_WITHDRAWAL",
                        contract_address=contract,
                        transaction_hash=tx_data.get('hash', ''),
                        description=f"User withdrawing {withdrawal_ratio:.1f}x their deposits",
                        confidence=min(0.9, (withdrawal_ratio - 1) * 5),
                        timestamp=tx_data.get('timestamp', 0)
                    ))
        
        return alerts
    
    def _detect_flash_loan_donations(self, tx_data: Dict) -> List[Alert]:
        """Detect flash loan patterns combined with donations"""
        alerts = []
        
        events = tx_data.get('events', [])
        
        # Look for flash loan events
        flash_loan_events = [e for e in events if 'flashloan' in e.get('event_name', '').lower()]
        
        if flash_loan_events:
            # Check if transaction also contains donations
            transfers = tx_data.get('transfers', [])
            
            for loan_event in flash_loan_events:
                loan_amount = int(loan_event.get('amount', 0))
                loan_token = loan_event.get('token', '').lower()
                
                # Look for large transfers of same token to vault contracts
                for transfer in transfers:
                    if (transfer.get('token', '').lower() == loan_token and
                        int(transfer.get('amount', 0)) >= loan_amount * 0.5 and  # At least 50% of loan
                        self._is_vault_contract(transfer.get('to', '').lower())):
                        
                        alerts.append(Alert(
                            level=AlertLevel.CRITICAL,
                            attack_type="FLASH_LOAN_DONATION",
                            contract_address=transfer.get('to', '').lower(),
                            transaction_hash=tx_data.get('hash', ''),
                            description=f"Flash loan followed by large transfer to vault",
                            confidence=0.9,
                            timestamp=tx_data.get('timestamp', 0)
                        ))
        
        return alerts
    
    def _detect_share_anomalies(self, tx_data: Dict) -> List[Alert]:
        """Detect asset increases without corresponding share supply changes"""
        alerts = []
        
        events = tx_data.get('events', [])
        
        # Group events by contract
        contract_events = {}
        for event in events:
            contract = event.get('contract', '').lower()
            if contract not in contract_events:
                contract_events[contract] = []
            contract_events[contract].append(event)
        
        for contract, contract_event_list in contract_events.items():
            if not self._is_vault_contract(contract):
                continue
            
            asset_changes = 0
            share_changes = 0
            
            for event in contract_event_list:
                event_name = event.get('event_name', '').lower()
                amount = int(event.get('amount', 0))
                
                if 'transfer' in event_name and event.get('to', '').lower() == contract:
                    asset_changes += amount
                elif 'mint' in event_name or 'burn' in event_name:
                    if 'mint' in event_name:
                        share_changes += amount
                    else:
                        share_changes -= amount
            
            # Flag if significant asset increase without share changes
            if asset_changes > 1000000 and abs(share_changes) < asset_changes * 0.1:
                alerts.append(Alert(
                    level=AlertLevel.HIGH,
                    attack_type="SHARE_SUPPLY_ANOMALY",
                    contract_address=contract,
                    transaction_hash=tx_data.get('hash', ''),
                    description=f"Asset increase ({asset_changes}) without proportional share changes",
                    confidence=0.8,
                    timestamp=tx_data.get('timestamp', 0)
                ))
        
        return alerts
    
    def _is_vault_contract(self, address: str) -> bool:
        """Check if address is a known vault/pool contract"""
        # This would be populated with known contract addresses and patterns
        vault_patterns = [
            '0x',  # ERC4626 vaults often have specific patterns
            # Add known vault contract addresses
        ]
        
        # Check against known vault signatures or patterns
        # In production, this would query contract ABI/bytecode
        return True  # Simplified for example
    
    def _get_recent_user_deposits(self, user: str, contract: str) -> Dict[str, int]:
        """Get user's recent deposit history for a contract"""
        # This would query historical data
        # Simplified for example
        return {"recent": 1000000}

# Smart contract vulnerability patterns
VULNERABLE_PATTERNS = {
    "DIRECT_BALANCE_USAGE": [
        "totalAssets() returns asset.balanceOf(address(this))",
        "rewardPerToken() uses token.balanceOf(address(this))",
        "pricePerShare() calculated from balanceOf without accounting"
    ],
    
    "UNPROTECTED_SHARE_PRICE": [
        "No minimum share requirements",
        "No donation protection mechanisms", 
        "Direct asset/share division for pricing"
    ],
    
    "MISSING_REENTRANCY_PROTECTION": [
        "Withdraw functions without reentrancy guards",
        "State updates after external calls",
        "Multiple withdrawal paths without protection"
    ]
}

# Known vulnerable protocol patterns
VULNERABLE_PROTOCOLS = {
    "ERC4626_VAULTS": {
        "risk_level": "HIGH",
        "description": "Naive asset/share calculations vulnerable to donation",
        "detection_patterns": [
            "totalAssets() uses balanceOf()",
            "convertToShares() without donation protection"
        ]
    },
    
    "YIELD_FARMS": {
        "risk_level": "MEDIUM", 
        "description": "Reward calculations based on contract balance",
        "detection_patterns": [
            "rewardRate calculated from balance",
            "stakingToken.balanceOf() for total staked"
        ]
    },
    
    "AMM_POOLS": {
        "risk_level": "MEDIUM",
        "description": "Price calculations affected by donations",
        "detection_patterns": [
            "getReserves() includes donated tokens",
            "Price oracles based on pool balances"
        ]
    }
}

def generate_monitoring_config() -> Dict:
    """Generate configuration for monitoring infrastructure"""
    return {
        "watch_contracts": {
            "erc4626_vaults": ["0x..."],  # Known vault addresses
            "yield_farms": ["0x..."],     # Known farm addresses
            "amm_pools": ["0x..."]        # Known pool addresses
        },
        
        "alert_thresholds": {
            "exchange_rate_change": 0.05,    # 5% change
            "withdrawal_ratio": 1.1,         # 110% of deposits
            "donation_amount": 1000000,      # Minimum donation to flag
            "time_window": 300               # 5 minutes for rate changes
        },
        
        "monitoring_rules": {
            "track_all_transfers": True,
            "monitor_exchange_rates": True,
            "flag_flash_loans": True,
            "analyze_share_supply": True
        }
    }

if __name__ == "__main__":
    detector = DonationAttackDetector()
    
    # Example transaction analysis
    sample_tx = {
        "hash": "0x123...",
        "timestamp": 1640995200,
        "transfers": [
            {
                "from": "0xattacker...",
                "to": "0xvault...", 
                "token": "0xusdc...",
                "amount": "10000000000"  # Large donation
            }
        ],
        "events": [
            {
                "event_name": "RateUpdate",
                "contract": "0xvault...",
                "new_rate": "1.2",
                "old_rate": "1.0"
            }
        ]
    }
    
    alerts = detector.analyze_transaction(sample_tx)
    for alert in alerts:
        print(f"[{alert.level.value}] {alert.attack_type}: {alert.description}")