---
name: self-evolution
description: Self-modification capabilities for improving the vulnerability scanner
requires:
  bins: [node, npm, git]
emoji: 🧬
---

## Instructions

You have permission to modify your own code, skills, and scanner to improve vulnerability detection accuracy, add new capabilities, fix bugs, and optimize performance.

### What You Can Modify

| Path | Purpose | Examples |
|------|---------|---------|
| ~/White-Rabbit/src/ | Scanner source code | Bug fixes, new detectors, accuracy improvements, chain support |
| ~/clawd/ | Workspace and memory | Hunting logs, patterns, analysis results |
| ~/.clawdbot/skills/ | Skill definitions | New commands, improved descriptions, new skills |

### When to Self-Modify

- **Bug fix** — Scanner crashes, incorrect behavior, API errors
- **New pattern** — Discovered a vulnerability pattern not yet codified
- **Accuracy improvement** — Reduce false positives or false negatives
- **New chain support** — Add support for a new EVM chain
- **Performance** — Reduce scan time, optimize API calls
- **New detector** — Add detection for a new vulnerability class

### Self-Modification Protocol

1. **Identify** — Document the issue or improvement opportunity
2. **Plan** — Design the change, identify affected files
3. **Backup** — Create a backup of files being modified
4. **Edit** — Make the change using precise file edits
5. **Rebuild** — Run `cd ~/White-Rabbit && npm run build`
6. **Test** — Verify the change works (run a scan or audit)
7. **Log** — Record the change in ~/clawd/memory/evolution-log.json
8. **Rollback** — If build/test fails, restore from backup

### Code Modification Examples

```bash
# Read current code
cat ~/White-Rabbit/src/services/context.ts

# Make a targeted edit (prefer surgical edits over file rewrites)
# Use the write/edit tools, not sed

# Rebuild after changes
cd ~/White-Rabbit && npm run build

# Test with a quick audit
cd ~/White-Rabbit && npx tsx src/cli.ts audit 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D --chain ethereum

# Restart scanner if needed
pm2 restart white-rabbit-scanner
```

### Evolution Log Format

Log each modification to `~/clawd/memory/evolution-log.json`:

```json
{
  "timestamp": "2025-01-28T12:00:00Z",
  "type": "bug-fix|new-pattern|accuracy|chain-support|performance|new-detector",
  "description": "What was changed and why",
  "files": ["src/services/context.ts"],
  "backup": "~/clawd/backups/context.ts.20250128",
  "buildSuccess": true,
  "testSuccess": true,
  "result": "Description of outcome"
}
```

### Safety Rules

1. **Always backup** before modifying any file
2. **Always rebuild** after TypeScript changes (`npm run build`)
3. **Always test** after changes (run a scan or audit)
4. **Log everything** to evolution-log.json
5. **Stop after 3 consecutive failures** — alert the operator
6. **Maximum 5 changes per day** — quality over quantity
7. **Never modify** credentials, .env files, or encryption keys
8. **Never modify** database migrations or schema without operator approval
9. **Never push** to git remote without explicit permission
10. **Never delete** backup files until confirmed working
11. **Prefer surgical edits** — change specific lines, not entire files
12. **Follow existing patterns** — match the codebase's style and conventions
