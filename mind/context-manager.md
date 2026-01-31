# Context Self-Management Protocol

## Problem
Sessions overflow when context exceeds model capacity (~120k tokens configured).
Solution: Proactive compression and archival.

## Automatic Triggers
When responding, check token usage. If approaching 80% (~96k tokens):
1. Compress current conversation to key points
2. Save full conversation to ~/clawd/memory/archives/
3. Keep only: current task, recent decisions, key findings
4. Continue with compressed context

## Compression Format
Save to ~/clawd/memory/compressed/session-{date}.md:
```
# Session Summary: {date}
## Key Decisions Made
- {list}
## Findings
- {list}
## Open Questions
- {list}
## Tasks Started
- {list}
## Learnings
- {list}
```

## Recovery Protocol
When starting fresh session:
1. Read ~/clawd/memory/compressed/ for recent context
2. Read ~/clawd/memory/hunting-log.json for state
3. Read active task from ~/clawd/tasks/active-task.json
4. Continue seamlessly

## Self-Check Every Response
Before responding, mentally note:
- Am I approaching context limit?
- Should I compress and archive?
- Is there redundant information I can remove?
