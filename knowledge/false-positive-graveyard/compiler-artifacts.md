# False Positive: Compiler Artifacts in Bytecode

## The Mistake
Pattern matching on bytecode flagged thousands of "SELFDESTRUCT" and "DELEGATECALL" vulnerabilities.

## Why It Looked Real
- Found 2,559 occurrences of `0xff` (SELFDESTRUCT opcode)
- Found multiple `0xf4` (DELEGATECALL opcode)
- Pattern matching hit on expected vulnerability signatures

## Why It Wasn't Exploitable
**Compiler padding and legitimate patterns:**
- `0xff` bytes = compiler padding/fill, NOT SELFDESTRUCT instructions
- `0xf4` in proxy contracts = legitimate upgrade mechanism
- High pattern counts usually indicate false positives

## Prevention Rules
**When pattern matching bytecode:**
1. High counts (100+) = almost certainly false positive
2. `0xff` bytes = compiler artifact, not SELFDESTRUCT
3. DELEGATECALL in proxies = legitimate upgrade pattern
4. Context matters more than raw pattern detection

## Indicators of False Positive
- Pattern count > 100 occurrences
- Found in well-audited, production contracts
- No unusual access patterns around the opcodes
- Located in standard contract sections

## Verification Checklist Added
- [ ] Pattern count reasonable (not thousands)
- [ ] Context analysis performed
- [ ] Not a standard compiler artifact
- [ ] Not a legitimate proxy/upgrade pattern

## Time Saved by This Knowledge
~4+ hours per hunt by not chasing bytecode ghosts

---
*Documented: 2026-01-29*
