# Red Team Self — Adversarial Self-Testing

## Core Principle

Regularly challenge your own analysis. What are you missing? What blind spots do you have? If an attacker saw the same contract, what would they do differently?

## Self-Testing Protocol

### After Each Major Scan Cycle

1. **Blind Spot Check**
   - What vulnerability types did you NOT check for?
   - What chains did you NOT scan?
   - What contract types did you skip?
   - Are there emerging attack vectors you're not detecting?

2. **FP Analysis**
   - Review the last 20 false positives
   - Why were they flagged? What went wrong?
   - Can the FP filter be improved?
   - Are you being too aggressive (filtering real findings)?

3. **FN Estimation**
   - Check recent hacks — did you scan those protocols?
   - If you scanned them, did you catch the vulnerability?
   - If not, why? What detector would have caught it?
   - Add the missing pattern to your detection rules

4. **Attack Surface Review**
   - Are there new DeFi primitives you don't understand?
   - New token standards? (ERC-4626, ERC-6909, etc.)
   - New oracle designs?
   - New bridge architectures?

### Weekly Red Team Exercise

Pick 3 contracts you classified as "safe" and challenge that classification:

1. **Assume it's vulnerable** — What could the vulnerability be?
2. **Enumerate attack surfaces** — External calls, oracle dependencies, admin functions
3. **Flash loan test** — Could unlimited capital create an exploit?
4. **Composability test** — Could interaction with another protocol create risk?
5. **Document findings** — Even if you conclude it's safe, document why

### Monthly Strategy Review

1. **Detection coverage** — What % of known vulnerability types do you detect?
2. **Tool effectiveness** — Slither vs AI vs pattern matching: which catches the most?
3. **Chain coverage** — Are you spending time proportional to TVL per chain?
4. **Value accuracy** — How accurate are your exploitable value estimates?
5. **Response time** — How quickly do you react to new hack news?

## Adversarial Mindset Prompts

When analyzing code, ask:
- "If I had $100M in flash loans, how would I drain this?"
- "What's the cheapest way to manipulate this contract's state?"
- "Can I make this contract believe something false?"
- "What happens if I call these functions in an unexpected order?"
- "What happens if the oracle returns 0? Returns MAX_UINT?"
- "Can I re-enter this contract mid-execution?"
- "What if I deploy a malicious contract that this one calls?"

## Tracking

Log red team exercises in `~/clawd/mind/reflections/`:

```markdown
# Red Team Exercise — [Date]

## Contracts Reviewed
- [address] on [chain] — Originally classified: [safe/needs review]

## Findings
- [Any new vulnerabilities discovered]

## Blind Spots Identified
- [What was missed and why]

## Action Items
- [Improvements to make]
```
