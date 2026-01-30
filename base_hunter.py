#!/usr/bin/env python3
"""
Base Chain Protocol Hunter - $10K-$1M TVL Range
WhiteRabbit systematic hunting framework
"""

import json
import requests
from datetime import datetime

def discover_base_protocols():
    """Discover Base chain protocols in target TVL range"""
    print('🔍 DISCOVERING BASE CHAIN PROTOCOLS...')
    
    try:
        response = requests.get('https://api.llama.fi/protocols', timeout=30)
        protocols = response.json()
    except Exception as e:
        print(f'❌ Error fetching protocols: {e}')
        return []

    base_protocols = []
    for protocol in protocols:
        if 'base' in [chain.lower() for chain in protocol.get('chains', [])]:
            tvl = protocol.get('tvl', 0)
            if 10000 <= tvl <= 1000000:  # $10k to $1M range
                base_protocols.append({
                    'name': protocol.get('name'),
                    'tvl': tvl,
                    'category': protocol.get('category', 'Unknown'),
                    'url': protocol.get('url', ''),
                    'description': protocol.get('description', '')[:100] if protocol.get('description') else '',
                    'chains': protocol.get('chains', [])
                })

    # Sort by TVL ascending (lowest first)
    base_protocols.sort(key=lambda x: x['tvl'])

    print(f'\n🎯 FOUND {len(base_protocols)} BASE PROTOCOLS IN $10K-$1M RANGE:\n')
    for i, protocol in enumerate(base_protocols[:25], 1):
        name = protocol['name'][:25].ljust(25)
        tvl = f"${protocol['tvl']:>8,.0f}"
        category = protocol['category'][:15].ljust(15)
        desc = protocol['description'][:50] if protocol['description'] else 'No description'
        print(f'{i:2d}. {name} | {tvl} | {category} | {desc}')

    # Save to hunting targets
    with open('base-hunt-targets.json', 'w') as f:
        json.dump(base_protocols, f, indent=2)

    print(f'\n✅ TARGET LIST SAVED TO base-hunt-targets.json')
    print(f'📊 TOTAL PROTOCOLS: {len(base_protocols)}')
    if base_protocols:
        print(f'💰 TVL RANGE: ${base_protocols[0]["tvl"]:,.0f} - ${base_protocols[-1]["tvl"]:,.0f}')
    
    return base_protocols

def analyze_priority_targets(protocols):
    """Analyze protocols for vulnerability patterns"""
    print('\n🔍 ANALYZING TOP PRIORITY TARGETS:\n')
    
    # Focus on first 10 lowest TVL protocols
    priority_targets = protocols[:10]
    
    for i, protocol in enumerate(priority_targets, 1):
        print(f'🎯 TARGET {i}: {protocol["name"]}')
        print(f'   💰 TVL: ${protocol["tvl"]:,.0f}')
        print(f'   📂 Category: {protocol["category"]}')
        print(f'   🌐 URL: {protocol["url"]}')
        
        # Assess risk factors
        risk_factors = []
        if protocol['category'] in ['DEX', 'Dexes']:
            risk_factors.append('🔴 DEX: SwapNet approval pattern risk')
        if protocol['category'] in ['Lending', 'CDP']:
            risk_factors.append('🟠 Lending: Compound fork donation attack risk')
        if 'bridge' in protocol['name'].lower():
            risk_factors.append('🔴 Bridge: Cross-chain vulnerability risk')
        if protocol['tvl'] < 50000:
            risk_factors.append('🟡 Low TVL: Likely unaudited')
        
        if risk_factors:
            for factor in risk_factors:
                print(f'   {factor}')
        else:
            print('   ✅ Standard risk profile')
        print()

if __name__ == '__main__':
    print('🐇 WHITERABBIT BASE CHAIN HUNTER INITIATED')
    print('=' * 60)
    
    protocols = discover_base_protocols()
    
    if protocols:
        analyze_priority_targets(protocols)
        
        print('🎯 NEXT STEPS:')
        print('1. Contract address discovery for top targets')
        print('2. Source code verification check')
        print('3. Vulnerability pattern scanning')
        print('4. PoC development for confirmed findings')
        
        print(f'\n🐇 Hunt ready! {len(protocols)} Base protocols queued for systematic analysis.')
    else:
        print('❌ No protocols discovered. Check network connection.')