# MEV Research & Analysis Framework

## Overview
Comprehensive research and analysis of Maximum Extractable Value (MEV) exploits, patterns, and detection mechanisms covering 2020-2025 data.

## Structure
- `data/` - Raw and processed MEV data
- `analysis/` - Analysis scripts and results  
- `tools/` - MEV detection and analysis tools
- `patterns/` - Exploitation pattern database
- `reports/` - Research findings and reports

## Key Focus Areas
1. **Sandwich Attacks** - Front/back-running exploitation
2. **Liquidation Bots** - DeFi liquidation MEV
3. **Arbitrage** - Cross-DEX price discrepancies
4. **Private Mempools** - MEV-Protect and private orderflow
5. **Advanced Techniques** - Sophisticated multi-block strategies

## Recent Developments (2024-2025)
- Migration from centralized builders to BuilderNet
- TEE-based private block building
- Parallel block building optimizations
- MEV as scaling bottleneck recognition
- L2 MEV via Rollup-Boost

## Getting Started
```bash
cd mev_research
python tools/mev_analyzer.py --help
```

See individual directories for detailed documentation.