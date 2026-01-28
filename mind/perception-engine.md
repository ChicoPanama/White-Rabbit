# Perception Engine — How Clawd Sees the Blockchain

## Data Ingestion Hierarchy

### Level 1: Raw Chain Data
- Block headers, transactions, logs, traces
- State changes, storage slots
- Mempool monitoring (pending transactions)

### Level 2: Decoded Semantics
- Function calls decoded via ABI
- Event emissions mapped to actions
- Value flows traced through transfers

### Level 3: Contextual Understanding
- Protocol identification (Uniswap, Aave, etc.)
- Role identification (user, admin, oracle, keeper)
- Intent inference (swap, borrow, liquidate, attack?)

## Contract Analysis Pipeline

### Static Analysis Layer
```
Source Code → AST → Control Flow Graph → Data Flow Graph
    ↓
Slither Detectors → Raw Findings
    ↓
Pattern Matching → Known Vulnerability Signatures
    ↓
Semantic Analysis → Understanding of Logic
```

### Dynamic Analysis Layer
```
Contract → Fork Simulation → State Exploration
    ↓
Symbolic Execution → Path Enumeration
    ↓
Fuzzing → Edge Case Discovery
    ↓
Invariant Testing → Property Violations
```

## Real-Time Monitoring Triggers

### Immediate Alerts (< 1 block)
- Large value transfers (> $1M)
- Flash loan initiations
- Governance proposal executions
- Oracle price deviations (> 5%)
- New contract deployments by known attackers

### Short-Term Patterns (< 1 hour)
- Unusual gas price spikes on specific contracts
- Repeated failed transactions (probing?)
- Liquidity removal patterns
- Approval farming

### Long-Term Signals (days/weeks)
- TVL decline trends
- Developer activity changes
- Governance token accumulation
- Social sentiment shifts

## Multi-Chain Perception

### Chain-Specific Quirks

| Chain | Block Time | Finality | Unique Risks |
|-------|-----------|----------|--------------|
| ETH | 12s | ~15 min | MEV, high gas |
| BSC | 3s | ~15 blocks | Centralized validators |
| Polygon | 2s | Checkpoints | Reorg risk |
| Arbitrum | Variable | L1 finality | Sequencer trust |
| Base | 2s | L1 finality | Young ecosystem |

### Cross-Chain Attack Vectors
- Bridge exploits (message verification)
- Oracle lag between chains
- Liquidity fragmentation attacks
- Replay attacks on forks

## Perception Priorities

1. New deployments on chains with >$10M TVL protocols
2. Forks of previously hacked protocols
3. Contracts receiving sudden TVL inflows
4. Upgrades to proxy implementations
5. Oracle changes or new price feed integrations

## Implementation Framework

### Data Stream Processing
```typescript
class PerceptionEngine {
  async processTransaction(tx: Transaction): Promise<PerceptionResult> {
    const level1 = await this.rawDataExtraction(tx);
    const level2 = await this.semanticDecoding(level1);
    const level3 = await this.contextualUnderstanding(level2);
    
    return {
      rawData: level1,
      semantics: level2,
      context: level3,
      alerts: await this.generateAlerts(level3)
    };
  }
}
```

### Anomaly Detection
```typescript
class AnomalyDetector {
  detectPatterns(data: PerceptionData[]): AnomalyAlert[] {
    const alerts = [];
    
    // Statistical anomalies
    alerts.push(...this.statisticalAnomalies(data));
    
    // Pattern-based anomalies
    alerts.push(...this.patternAnomalies(data));
    
    // Behavioral anomalies
    alerts.push(...this.behavioralAnomalies(data));
    
    return alerts;
  }
}
```

## Continuous Learning Integration

## Output Format Implementation

### Perception Event Logging
Every perception event logged to `~/White-Rabbit/memory/perception-log.jsonl`:

```json
{
  "timestamp": "2026-01-28T07:22:34.567Z",
  "chain": "ethereum",
  "type": "new_deployment|upgrade|large_transfer|anomaly|flash_loan|governance|oracle_deviation",
  "contract": "0x1234567890123456789012345678901234567890",
  "relevance_score": 0.85,
  "details": {
    "transaction_hash": "0xabcdef...",
    "block_number": 19234567,
    "value": "1000000000000000000000",
    "gas_used": 234567,
    "function_called": "deposit(uint256)",
    "anomaly_type": "unusual_gas_pattern",
    "risk_indicators": ["high_value", "new_contract", "complex_logic"]
  },
  "action_recommended": "scan|monitor|ignore",
  "priority_score": 8.5,
  "related_protocols": ["uniswap", "aave"],
  "cross_chain_implications": false
}
```

### Perception Event Types

```typescript
type PerceptionEventType =
  | 'new_deployment'        // New contract deployment
  | 'upgrade'              // Proxy upgrade or implementation change
  | 'large_transfer'       // Value transfer > threshold
  | 'anomaly'              // Statistical anomaly in behavior
  | 'flash_loan'           // Flash loan initiation
  | 'governance'           // Governance proposal or execution
  | 'oracle_deviation'     // Price oracle significant change
  | 'liquidity_drain'      // Large liquidity removal
  | 'approval_farming'     // Unusual approval patterns
  | 'mei_sandwich'         // MEV sandwich attack detection
  | 'reentrancy_attempt'   // Potential reentrancy attack
  | 'access_violation'     // Attempted unauthorized access
```

### Real-Time Perception Pipeline

```typescript
class PerceptionLogger {
  async logPerceptionEvent(event: PerceptionEvent): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      chain: event.chain,
      type: event.type,
      contract: event.contract,
      relevance_score: this.calculateRelevanceScore(event),
      details: this.extractEventDetails(event),
      action_recommended: this.recommendAction(event),
      priority_score: this.calculatePriorityScore(event),
      related_protocols: await this.identifyRelatedProtocols(event),
      cross_chain_implications: await this.analyzeCrossChainImplications(event)
    };
    
    await this.appendToPerceptionLog(logEntry);
    
    // Trigger immediate action if high priority
    if (logEntry.priority_score >= 8.0) {
      await this.triggerImmediateAnalysis(logEntry);
    }
  }
  
  private calculateRelevanceScore(event: PerceptionEvent): number {
    let score = 0.0;
    
    // Base score by event type
    const typeScores = {
      new_deployment: 0.7,
      upgrade: 0.8,
      large_transfer: 0.6,
      anomaly: 0.9,
      flash_loan: 0.85,
      governance: 0.75,
      oracle_deviation: 0.8
    };
    
    score += typeScores[event.type] || 0.5;
    
    // Adjust for value at risk
    if (event.value > 1000000 * 1e18) score += 0.15; // >$1M
    if (event.value > 100000000 * 1e18) score += 0.1; // >$100M
    
    // Adjust for contract novelty
    if (event.contract_age < 86400 * 7) score += 0.1; // <1 week old
    if (event.contract_age < 86400) score += 0.1; // <1 day old
    
    // Adjust for protocol significance
    if (event.protocol_tvl > 1000000000 * 1e18) score += 0.05; // >$1B TVL
    
    return Math.min(1.0, score);
  }
}
```

The perception engine feeds observations to the learning module for pattern refinement and anomaly threshold adjustment.