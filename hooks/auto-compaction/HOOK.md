---
name: auto-compaction
description: "Automatic context overflow prevention - compacts session when approaching token limit"
enabled: true
metadata:
  {
    "clawdbot":
      {
        "emoji": "🗜️",
        "events": ["agent:bootstrap"],
        "always": true,
      },
  }
---

# Auto-Compaction Hook

Automatically prevents context overflow by monitoring session size before each agent run and triggering compaction when approaching the token limit.

## What It Does

Before each agent response:

1. **Checks session size** - Estimates tokens from session file (bytes / 4)
2. **If > 80,000 tokens**:
   - Extracts key findings (vulnerabilities, contracts, bounties) to `~/clawd/memory/session-findings-{date}.json`
   - Logs compaction trigger with before/after token counts
   - Allows the existing clawdbot compaction to handle the actual summarization
3. **Always allows request to proceed** - Never blocks, just prepares context

## Configuration

The hook uses these thresholds (configurable in handler.js):

- `TOKEN_THRESHOLD`: 80,000 (trigger compaction above this)
- `HISTORY_LIMIT`: 15 (keep last N messages after compaction)

## Files

- `handler.js` - Main hook logic
- `~/clawd/memory/session-findings-*.json` - Extracted findings archive

## Manual Trigger

Use `/compact` command to manually trigger compaction at any time.
