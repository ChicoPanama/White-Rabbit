# /research Command Specification

## Purpose
Explicitly activate Research Mode for audit, paper, and protocol analysis without triggering active scanning or exploitation.

## Syntax

```
/research <target> [--source <type>] [--depth <level>] [--output <format>]
```

### Parameters

| Parameter | Required | Options | Description |
|-----------|----------|---------|-------------|
| `target` | Yes | URL, protocol name, or "audit:<name>" | What to research |
| `--source` | No | `audit`, `paper`, `protocol`, `exploit`, `comparison` | Type of research material |
| `--depth` | No | `surface` (patterns only), `deep` (methodology + gaps), `full` (cross-reference + trends) | Analysis depth |
| `--output` | No | `summary`, `detailed`, `patterns-only` | Output format |

## Examples

```
/research quantstamp-api3 --source audit --depth deep
/research https://arxiv.org/abs/1234 --source paper --depth surface
/research compound-forks --source comparison --depth full
/research euler-finance-exploit --source exploit --output patterns-only
```

## Research Mode Safety Checks

When `/research` is invoked, the system MUST:

1. ✅ **Verify** - Confirm target is documentation/audit/report (not live contract)
2. ✅ **Constrain** - Disable all scanning, PoC generation, and on-chain tools
3. ✅ **Log** - Record research session start with parameters
4. ✅ **Isolate** - Ensure findings are stored in `research/` only
5. ✅ **Gate** - Block any user attempt to pivot to exploitation mid-research

## Output Structure

```markdown
# Research: [Target Name]
**Source:** [audit|paper|protocol|exploit]  
**Depth:** [surface|deep|full]  
**Date:** [timestamp]

## Executive Summary
[2-3 sentences on key findings]

## Patterns Extracted
| Pattern | Severity | Confidence | Source Finding |
|---------|----------|------------|----------------|
| [name] | High/Med/Low | % | [reference] |

## Methodology Gaps Identified
- [List of audit blind spots or under-assessed areas]

## Cross-Protocol Correlations
- [Similar patterns found in other protocols]

## Storage Location
- Full analysis: `research/[target]-[date].md`
- Patterns indexed: `ATTACK_VECTOR_DATABASE.md` (if applicable)
- Memory updated: `memory/[YYYY-MM-DD].md`
```

## Boundary Enforcement

**If user mid-research asks for:**
- "Scan this contract" → Response: "Research Mode prohibits live scanning. Use /hunt or exit Research Mode."
- "Create exploit" → Response: "Research Mode prohibits PoC generation. Analysis only."
- "Deploy test" → Response: "Research Mode is documentation analysis only."

## Integration Points

1. **Git Integration:** Research outputs auto-committed to `research/` branch
2. **Knowledge Base:** Patterns auto-indexed if confidence > 70%
3. **Memory System:** Research sessions logged in daily memory
4. **Alert Suppression:** No bounty alerts, no TVL calculations, no exploit value estimates

## Success Criteria

- [ ] Command parser recognizes `/research` prefix
- [ ] Research Mode activates only on explicit command
- [ ] All safety constraints enforced
- [ ] Structured output generated
- [ ] Findings stored in correct directories
- [ ] Cannot pivot to exploitation without explicit mode change

---
*Research Mode: Knowledge extraction without execution.*
