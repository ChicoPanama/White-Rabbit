---
name: task-chunking
description: Break large tasks into chunks that survive session resets. Use when a task has 3+ steps, spans multiple chains, or might exceed context limits.
---

# Task Chunking Skill

## When to Chunk
- Tasks with 3+ distinct steps
- Multi-chain operations
- Research + action combinations
- Output might exceed 4000 tokens

## Task File: ~/clawd/tasks/active-task.json
```json
{
  "id": "task-{timestamp}",
  "description": "Original task",
  "status": "planning|in_progress|complete",
  "totalChunks": 5,
  "currentChunk": 0,
  "chunks": [{"id": 1, "status": "pending", "description": "...", "result": null}],
  "finalSummary": null
}
```

## Protocol
1. Create task file with all chunks planned
2. Execute ONE chunk, save result to chunk.result, update currentChunk
3. Cron picks up next chunk on next cycle
4. When all chunks complete, write finalSummary and move to ~/clawd/tasks/completed/

## Memory Per Chunk
- Max 4000 tokens output per chunk
- Save results to files, not conversation
- Use head/tail/grep for large files
- Reference previous chunk results by reading the task file
