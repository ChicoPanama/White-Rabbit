# Etherscan Auditor v2

An autonomous white-hat smart contract vulnerability scanner for [Clawd](https://clawd.bot) with **multi-layer verification to minimize false positives**.

## What Makes This Different

Most automated scanners flood you with false positives. This one doesn't.

**The Verification Pipeline:**

```
Stage 1: CONTEXT           Stage 2: STATIC ANALYSIS
  - Audit history             - Slither
  - Contract age              - AI patterns
  - Security patterns         - Business logic flaws
         |                           |
         v                           v
Stage 3: FALSE POSITIVE    Stage 4: VERIFICATION
  FILTERING
  - Known FP patterns         - PoC on fork
  - Audit check               - Tool consensus
  - Code patterns             - Confidence scoring
         |                           |
         v                           v
Stage 5: RISK SCORING      Stage 6: SMART ALERTING
  - Weighted by                - Only verified
    verification               or likely real
  - Context adjusted           findings alert
```

## Key Features

| Feature | Description |
|---------|-------------|
| **TVL Filtering** | Only scans protocols with significant TVL via DeFiLlama |
| **Multi-Tool Analysis** | Slither static analysis + AI business logic detection |
| **PoC Verification** | Generates exploits on forked mainnet using Foundry |
| **FP Filtering** | Removes known false positive patterns automatically |
| **Confidence Scoring** | Tool consensus + verification status = confidence % |
| **Smart Alerts** | Only alerts on verified/likely-real findings |
| **Multi-Chain** | Ethereum, Base, Arbitrum, Polygon, Optimism |

## Verification Statuses

| Status | What It Means | Will Alert? |
|--------|---------------|-------------|
| **Verified** | PoC exploit succeeded on fork | **YES** |
| **Likely Real** | 2+ tools agree, high confidence | **YES** |
| **Needs Review** | Single tool, medium confidence | No (logged) |
| **Likely False** | PoC failed or low confidence | No |
| **False Positive** | Matches known FP pattern | No |

## Quick Start

### 1. Install

```bash
git clone https://github.com/yourname/etherscan-auditor
cd etherscan-auditor
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required:
- `ETHERSCAN_API_KEY` - [Get free key](https://etherscan.io/apis)

Recommended:
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` - For alerts
- `ETH_RPC_URL` etc. - For PoC verification

### 3. Run

```bash
# Audit a single contract
npm run audit -- 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

# Scan a network
npm run scan -- base

# List high-TVL protocols
npm run protocols -- ethereum --min-tvl 10000000

# Start autonomous scanning
npm run dev -- auto --networks ethereum,base --min-tvl 1000000
```

## With Clawd

```
You: start autonomous vulnerability scan, focus on base and arbitrum
     with at least 1 million TVL, alert me on telegram

Clawd: Starting autonomous scanner...
       Networks: base, arbitrum
       Min TVL: $1,000,000
       Verification: PoC generation + Multi-tool consensus

       I'll only alert you when I find verified or high-confidence issues.
       No false positive spam, promise!
```

## Architecture

```
src/
├── services/
│   ├── context.ts      # Audit history & FP detection
│   └── verifier.ts     # PoC generation & verification
├── clients/
│   ├── etherscan.ts    # Etherscan V2 API client
│   └── defillama.ts    # DeFiLlama TVL data
├── analyzers/
│   ├── slither.ts      # Static analysis runner
│   ├── ai-analyzer.ts  # AI business logic analysis
│   └── deduplicator.ts # Cross-tool finding dedup
├── alerts/
│   └── telegram.ts     # Alert service
├── queue/
│   ├── queues.ts       # BullMQ queue definitions
│   └── workers.ts      # Worker processors
├── utils/
│   └── helpers.ts      # Utility functions
├── types/
│   └── index.ts        # Type definitions
├── scanner.ts          # Main orchestrator (6-stage pipeline)
├── database.ts         # PostgreSQL persistence
├── config.ts           # Environment configuration
├── cli.ts              # Command-line interface
├── index.ts            # Main entry point
└── worker.ts           # Background worker entry point
```

## How Verification Works

### 1. Context Gathering

Before analyzing, we gather context:
- Is this contract from a known audited protocol? (Uniswap, Aave, etc.)
- Does it use security patterns? (ReentrancyGuard, AccessControl)
- Does it use oracles? TWAP?

### 2. False Positive Pattern Matching

Known FP patterns that get filtered:
- `reentrancy-eth` + `ReentrancyGuard` present = likely FP
- `arbitrary-send-eth` + `onlyOwner` present = likely FP
- `oracle-manipulation` + `TWAP` present = likely FP
- Plus 7 more patterns (see `src/services/context.ts`)

### 3. PoC Generation

For critical/high findings, we try to exploit them on a forked mainnet using Foundry:

```solidity
// Example: Reentrancy PoC
contract ReentrancyPoC is Test {
    function testReentrancy() public {
        deal(address(this), 1 ether);
        target.deposit{value: 0.1 ether}();
        target.withdraw();
        assertTrue(address(this).balance > 0.1 ether);
    }

    receive() external payable {
        if (attackCount < 5) {
            attackCount++;
            target.withdraw();
        }
    }
}
```

- PoC succeeds = **Verified** (+40 confidence)
- PoC fails = **Likely false** (-30 confidence)

### 4. Tool Consensus & Confidence Scoring

| Factor | Score Impact |
|--------|-------------|
| High tool confidence | +60 base |
| Medium tool confidence | +40 base |
| 3+ tools agree | +30 |
| 2 tools agree | +20 |
| PoC succeeded | +40 |
| PoC failed | -30 |
| Known audited protocol | -20 |
| Battle-tested (>1yr) | -10 |
| ReentrancyGuard + reentrancy detector | -30 |

## Vulnerability Detection

### Static Analysis (Slither)

- Reentrancy (ETH and tokens)
- Arbitrary sends
- Access control issues
- Integer overflow/underflow
- Uninitialized storage
- Timestamp dependence

### AI Analysis

- Flash loan attack vectors
- Oracle manipulation
- MEV exposure (frontrunning, sandwich)
- Cross-contract reentrancy
- Privilege escalation
- Economic attacks

## Dependencies

### Required
- Node.js 20+
- Etherscan API key

### Recommended
- **Slither** - Static analysis (10.9% false positive rate)
  ```bash
  pip install slither-analyzer
  ```
- **Foundry** - PoC verification on forks
  ```bash
  curl -L https://foundry.paradigm.xyz | bash && foundryup
  ```

## Responsible Disclosure

This tool is for **white hat security research only**.

When you find vulnerabilities:

1. Check for bug bounty programs (Immunefi, HackerOne)
2. Contact protocol team through official channels
3. Document findings professionally
4. Wait for acknowledgment
5. Follow responsible disclosure timelines (14-45 days)

## License

MIT - Use responsibly.
