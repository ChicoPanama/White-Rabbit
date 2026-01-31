#!/usr/bin/env node
/**
 * Auto-Compaction Middleware
 *
 * Standalone module for context overflow prevention.
 * Can be used programmatically or via CLI.
 *
 * Usage:
 *   node auto-compaction.js                    # Check all sessions
 *   node auto-compaction.js --session <key>    # Check specific session
 *   node auto-compaction.js --compact          # Actually trigger compaction
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

// Configuration
const CONFIG = {
  TOKEN_THRESHOLD: 80000,      // Trigger compaction above this
  CRITICAL_THRESHOLD: 100000,  // Force compaction above this
  BYTES_PER_TOKEN: 4,          // 4 bytes ≈ 1 token estimate
  HISTORY_LIMIT: 15,           // Keep last N messages
  STATE_DIR: path.join(os.homedir(), '.clawdbot'),
  MEMORY_DIR: path.join(os.homedir(), 'clawd', 'memory'),
};

// Extraction patterns for key findings
const EXTRACTION_PATTERNS = [
  { regex: /CRITICAL.*?vulnerability/gi, type: 'vulnerability', severity: 'critical' },
  { regex: /HIGH.*?severity/gi, type: 'vulnerability', severity: 'high' },
  { regex: /MEDIUM.*?severity/gi, type: 'vulnerability', severity: 'medium' },
  { regex: /\$[\d,]+[KMB]?\+?\s*bounty/gi, type: 'bounty_estimate' },
  { regex: /0x[a-fA-F0-9]{40}/g, type: 'contract_address' },
  { regex: /FOUND:.*$/gm, type: 'finding' },
  { regex: /EXPLOIT:.*$/gm, type: 'exploit' },
  { regex: /PoC.*?(?:validated?|confirmed?|working)/gi, type: 'poc_status' },
  { regex: /reentrancy|overflow|underflow|access.?control|front.?run|flash.?loan|oracle/gi, type: 'vuln_type' },
  { regex: /Immunefi|HackerOne|Code4rena|Sherlock/gi, type: 'platform' },
];

/**
 * List all session files across all agents
 */
export function listSessionFiles() {
  const sessions = [];
  const agentsDir = path.join(CONFIG.STATE_DIR, 'agents');

  if (!fs.existsSync(agentsDir)) {
    return sessions;
  }

  const agents = fs.readdirSync(agentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const agentId of agents) {
    const sessionsDir = path.join(agentsDir, agentId, 'sessions');
    const storeFile = path.join(sessionsDir, 'sessions.json');

    if (!fs.existsSync(storeFile)) continue;

    try {
      const store = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));

      for (const [key, entry] of Object.entries(store)) {
        if (!entry.sessionId) continue;

        const sessionFile = entry.sessionFile ||
          path.join(sessionsDir, `${entry.sessionId}.jsonl`);

        if (fs.existsSync(sessionFile)) {
          const stats = fs.statSync(sessionFile);
          const tokens = Math.ceil(stats.size / CONFIG.BYTES_PER_TOKEN);

          sessions.push({
            key,
            agentId,
            sessionId: entry.sessionId,
            sessionFile,
            sizeBytes: stats.size,
            estimatedTokens: tokens,
            updatedAt: entry.updatedAt,
            needsCompaction: tokens > CONFIG.TOKEN_THRESHOLD,
            critical: tokens > CONFIG.CRITICAL_THRESHOLD,
          });
        }
      }
    } catch (err) {
      console.error(`Failed to read sessions for ${agentId}: ${err.message}`);
    }
  }

  return sessions.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}

/**
 * Extract key findings from session content
 */
export function extractFindings(content) {
  const findings = {
    vulnerabilities: [],
    contracts: new Set(),
    bountyEstimates: [],
    exploits: [],
    vulnTypes: new Set(),
    platforms: new Set(),
    rawFindings: [],
    pocStatuses: [],
  };

  for (const pattern of EXTRACTION_PATTERNS) {
    const matches = content.match(pattern.regex) || [];

    for (const match of matches) {
      switch (pattern.type) {
        case 'contract_address':
          findings.contracts.add(match.toLowerCase());
          break;
        case 'bounty_estimate':
          if (!findings.bountyEstimates.includes(match)) {
            findings.bountyEstimates.push(match);
          }
          break;
        case 'vulnerability':
          findings.vulnerabilities.push({
            text: match.slice(0, 200),  // Limit length
            severity: pattern.severity,
          });
          break;
        case 'exploit':
          findings.exploits.push(match.slice(0, 200));
          break;
        case 'vuln_type':
          findings.vulnTypes.add(match.toLowerCase());
          break;
        case 'platform':
          findings.platforms.add(match);
          break;
        case 'finding':
          findings.rawFindings.push(match.slice(0, 200));
          break;
        case 'poc_status':
          findings.pocStatuses.push(match);
          break;
      }
    }
  }

  // Convert Sets to Arrays
  findings.contracts = [...findings.contracts];
  findings.vulnTypes = [...findings.vulnTypes];
  findings.platforms = [...findings.platforms];

  return findings;
}

/**
 * Save findings to memory archive
 */
export function saveFindings(findings, sessionKey, tokens) {
  fs.mkdirSync(CONFIG.MEMORY_DIR, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();
  const filename = `session-findings-${date}-${timestamp}.json`;
  const filePath = path.join(CONFIG.MEMORY_DIR, filename);

  const archive = {
    sessionKey,
    extractedAt: new Date().toISOString(),
    tokensBefore: tokens,
    findings,
  };

  fs.writeFileSync(filePath, JSON.stringify(archive, null, 2));
  return filePath;
}

/**
 * Check session and extract findings if over threshold
 */
export function checkSession(sessionInfo) {
  const result = {
    sessionKey: sessionInfo.key,
    tokens: sessionInfo.estimatedTokens,
    needsCompaction: sessionInfo.needsCompaction,
    critical: sessionInfo.critical,
    findingsExtracted: false,
    findingsFile: null,
  };

  if (!sessionInfo.needsCompaction) {
    return result;
  }

  try {
    const content = fs.readFileSync(sessionInfo.sessionFile, 'utf-8');
    const findings = extractFindings(content);

    // Check if there's anything worth saving
    const hasFindings =
      findings.vulnerabilities.length > 0 ||
      findings.contracts.length > 0 ||
      findings.bountyEstimates.length > 0 ||
      findings.exploits.length > 0;

    if (hasFindings) {
      result.findingsFile = saveFindings(findings, sessionInfo.key, sessionInfo.estimatedTokens);
      result.findingsExtracted = true;
      result.findingsSummary = {
        vulnerabilities: findings.vulnerabilities.length,
        contracts: findings.contracts.length,
        bountyEstimates: findings.bountyEstimates.length,
        exploits: findings.exploits.length,
      };
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Trigger compaction for a session
 *
 * Note: Direct CLI compaction isn't supported. Options:
 * 1. Send /compact command via Telegram
 * 2. Use clawdbot message send to trigger compaction
 * 3. Let the hook + dmHistoryLimit handle it automatically
 */
export function triggerCompaction(sessionKey) {
  // Parse session key to get channel info
  const match = sessionKey.match(/agent:([^:]+):dm:(\d+)/);
  if (!match) {
    return { success: false, error: 'Cannot parse session key for compaction' };
  }

  const [, agentId, peerId] = match;

  try {
    // Try to send /compact via clawdbot message
    const result = execSync(
      `clawdbot message send --channel telegram --target "${peerId}" --message "/compact"`,
      {
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    return { success: true, output: result, method: 'telegram-message' };
  } catch (err) {
    // Compaction via message failed - provide manual instructions
    return {
      success: false,
      error: err.message,
      instructions: `Send "/compact" manually in Telegram to trigger compaction for session ${sessionKey}`,
    };
  }
}

/**
 * Main check and compact routine
 */
export function autoCompact(options = {}) {
  const sessions = listSessionFiles();
  const results = [];

  for (const session of sessions) {
    if (options.sessionKey && session.key !== options.sessionKey) {
      continue;
    }

    const result = checkSession(session);

    if (result.needsCompaction) {
      console.log(`[auto-compaction] Session ${session.key}: ${result.tokens} tokens (over threshold)`);

      if (result.findingsExtracted) {
        console.log(`  -> Extracted findings to: ${result.findingsFile}`);
      }

      if (options.compact && result.critical) {
        console.log(`  -> Triggering compaction (critical threshold exceeded)`);
        const compactResult = triggerCompaction(session.key);
        result.compactionTriggered = true;
        result.compactionResult = compactResult;
      }
    }

    results.push(result);
  }

  return results;
}

// CLI interface
if (process.argv[1] === import.meta.url.replace('file://', '') ||
    process.argv[1]?.endsWith('auto-compaction.js')) {
  const args = process.argv.slice(2);
  const sessionKey = args.includes('--session') ?
    args[args.indexOf('--session') + 1] : null;
  const doCompact = args.includes('--compact');

  console.log('=== Auto-Compaction Check ===\n');

  const results = autoCompact({ sessionKey, compact: doCompact });

  const overThreshold = results.filter(r => r.needsCompaction);
  const critical = results.filter(r => r.critical);

  console.log(`\n=== Summary ===`);
  console.log(`Total sessions checked: ${results.length}`);
  console.log(`Over threshold (${CONFIG.TOKEN_THRESHOLD}): ${overThreshold.length}`);
  console.log(`Critical (${CONFIG.CRITICAL_THRESHOLD}): ${critical.length}`);

  if (overThreshold.length > 0 && !doCompact) {
    console.log(`\nRun with --compact to trigger compaction for critical sessions`);
  }
}
