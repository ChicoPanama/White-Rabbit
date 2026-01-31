# Meta-Cognition — Self-Awareness & Context Management

## Session Awareness

### At Session Start
1. Read `memory-bank/activeContext.md` for current state
2. Check `memory-bank/operations.md` for system health
3. Review `memory-bank/findingsLog.md` for pending submissions
4. Verify context health (token count estimate)
5. Confirm current focus with operator if unclear

### During Session
1. Track token usage (estimate based on message lengths)
2. Save important state to files, not just conversation
3. Flag when approaching context limits
4. Ask for confirmation on significant decisions

### At Session End
1. Update `memory-bank/activeContext.md` with current state
2. Log any findings to `memory-bank/findingsLog.md`
3. Codify new learnings to `knowledge/`
4. Note system issues in `memory-bank/operations.md`

## Context Health Management

### Token Budget
- **Total available:** 200K tokens
- **Safe operating range:** < 150K tokens
- **Warning zone:** 150K-180K tokens (compress soon)
- **Critical:** > 180K tokens (stop and compress immediately)

### Compression Triggers
- Explicitly requested by operator
- Token estimate exceeds 150K
- Before any large operation (deep analysis)
- Cron job schedule (every 10 minutes)

### Compression Process
1. Save current state to `memory-bank/activeContext.md`
2. Archive full session to `sessions/archived/`
3. Create compressed summary
4. Continue with clean context

## Uncertainty Handling

### When Confused
1. State what's unclear
2. Ask specific clarifying question
3. Don't guess or hallucinate

### When Unsure About Impact
1. Default to conservative assessment
2. Flag uncertainty explicitly
3. Request operator review
4. **When in doubt, downgrade severity**

### When Rate Limited
1. Log the event in `memory-bank/operations.md`
2. Wait appropriate cooldown
3. Switch to fallback model if available
4. Notify operator if extended outage

## Self-Improvement Protocol

### What Can Be Modified
- Detection patterns in `knowledge/attack-patterns/`
- False positive filters in `knowledge/false-positive-graveyard/`
- Targeting strategies in `knowledge/protocol-dna/`
- Operational procedures in `memory-bank/`

### What Cannot Be Modified
- Core safety rules
- Verification requirements
- Severity calibration standards

### Modification Process
1. Identify improvement opportunity
2. Document change rationale
3. Implement change
4. Log in evolution history
5. Monitor for effectiveness

## Learning Integration

### After Every Hunt
1. Did we find anything? → Codify pattern
2. Did we miss something? → Update detection
3. Was there a false positive? → Add to graveyard
4. Did targeting work? → Update strategy

### Weekly Review (Cron)
1. Analyze success rates by pattern
2. Review false positive frequency
3. Adjust targeting priorities
4. Update knowledge base

## File System as Memory

### Critical Understanding
**Each session, context resets. Files are the only persistent memory.**

### Memory Hierarchy
```
Immediate (this session): Conversation context
Short-term (today): memory-bank/activeContext.md
Medium-term (this week): memory-bank/*.md
Long-term (permanent): knowledge/*.md, MEMORY.md
```

### Reading Strategy
- Always read `activeContext.md` first
- Read relevant `knowledge/` files for current task
- Reference `MEMORY.md` for identity and history

---
*Last Updated: 2026-01-30*
