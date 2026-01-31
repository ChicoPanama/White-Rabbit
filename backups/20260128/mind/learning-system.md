# Learning System — Continuous Improvement Loop

## Core Principle

Every scan, every finding, every false positive is training data. The scanner should get smarter with every cycle.

## Learning Loop

```
Scan → Findings → Classification → Feedback → Pattern Update → Improved Scan
```

### 1. Scan Phase
- Run Slither + AI analysis on target contracts
- Record all raw findings with metadata

### 2. Classification Phase
- Apply FP filters (known patterns, context, AI)
- Score confidence (0-100)
- Classify: Verified, Likely Real, Needs Review, Likely False, False Positive

### 3. Feedback Phase
- **True Positive confirmed:**
  - Extract vulnerability pattern (code signature, function layout)
  - Generate contract fingerprint for fork detection
  - Record in pattern cache
- **False Positive confirmed:**
  - Extract FP pattern (what made this look like a vulnerability?)
  - Add to FP filter list
  - Reduce confidence for similar future findings

### 4. Pattern Update Phase
- Refine existing patterns with new data
- Discover new patterns from audit history
- Prune low-accuracy patterns
- Update chain priorities based on finding density

### 5. Accuracy Tracking

Track these metrics over time:
- **True Positive Rate:** verified findings / total findings
- **False Positive Rate:** confirmed FPs / total findings
- **Pattern Accuracy:** correct pattern matches / total pattern matches
- **Fork Detection Rate:** forks found / forks existing (estimated)
- **Value Accuracy:** actual exploitable / estimated exploitable

## Learning Data Sources

### Internal
- Slither scan results (all findings, all contracts)
- PoC verification results (succeeded/failed)
- AI analysis results (assessment, FP flags)
- Pattern cache (learned signatures, fingerprints)

### External
- DeFiLlama hack database (real exploits, techniques, amounts)
- Audit reports (known vulnerabilities, remediation patterns)
- Rekt.news (hack post-mortems, root cause analysis)
- Bug bounty disclosures (Immunefi, Code4rena)

## Memory Architecture

### Short-term (hunting-log.json)
- Current scan queue and priorities
- Recent findings (last 100)
- Active hypotheses
- Session state

### Medium-term (pattern cache — SQLite)
- Learned vulnerability patterns with accuracy scores
- Contract fingerprints for fork detection
- FP signatures for filter improvement

### Long-term (PostgreSQL)
- Complete audit history
- All findings with classifications
- Protocol metadata and TVL history
- Scan performance metrics

## Self-Assessment

Weekly, ask yourself:
1. How many findings were verified vs false positive this week?
2. Which patterns had the highest accuracy?
3. Which chains produced the most findings?
4. What types of vulnerabilities am I missing?
5. What can I improve about my scanning strategy?

Record answers in `~/clawd/mind/reflections/`.
