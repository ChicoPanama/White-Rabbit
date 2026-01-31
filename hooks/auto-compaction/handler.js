/**
 * Auto-Compaction Hook Handler
 *
 * Monitors session size before each agent run and extracts key findings
 * when approaching token limit. Works with clawdbot's built-in dmHistoryLimit
 * to ensure context never overflows.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Configuration
const TOKEN_THRESHOLD = 40000;  // Trigger extraction above this
const BYTES_PER_TOKEN = 4;      // Rough estimate: 4 bytes ≈ 1 token

// Extraction patterns for key findings
const EXTRACTION_PATTERNS = [
  { regex: /CRITICAL.*?vulnerability/gi, type: 'vulnerability', severity: 'critical' },
  { regex: /HIGH.*?severity/gi, type: 'vulnerability', severity: 'high' },
  { regex: /\$[\d,]+[KMB]?\+?\s*bounty/gi, type: 'bounty_estimate' },
  { regex: /0x[a-fA-F0-9]{40}/g, type: 'contract_address' },
  { regex: /FOUND:.*$/gm, type: 'finding' },
  { regex: /EXPLOIT:.*$/gm, type: 'exploit' },
  { regex: /PoC.*?validated?/gi, type: 'poc_status' },
  { regex: /reentrancy|overflow|underflow|access.?control|front.?run/gi, type: 'vuln_type' },
];

/**
 * Get session file path from session store
 */
function resolveSessionFile(sessionKey, cfg) {
  const stateDir = path.join(os.homedir(), '.clawdbot');

  // Parse agent ID from session key (format: agent:white-rabbit:dm:123)
  const agentMatch = sessionKey?.match(/^agent:([^:]+):/);
  const agentId = agentMatch?.[1] || 'default';

  // Load session store
  const storePath = path.join(stateDir, 'agents', agentId, 'sessions', 'sessions.json');
  if (!fs.existsSync(storePath)) {
    return null;
  }

  try {
    const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    const entry = store[sessionKey];

    if (!entry?.sessionId) {
      return null;
    }

    // Session file is in same directory as sessions.json
    const sessionFile = entry.sessionFile ||
      path.join(path.dirname(storePath), `${entry.sessionId}.jsonl`);

    return fs.existsSync(sessionFile) ? sessionFile : null;
  } catch {
    return null;
  }
}

/**
 * Estimate tokens from file size
 */
function estimateTokens(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return Math.ceil(stats.size / BYTES_PER_TOKEN);
  } catch {
    return 0;
  }
}

/**
 * Extract key findings from session content
 */
function extractFindings(content) {
  const findings = {
    vulnerabilities: [],
    contracts: new Set(),
    bountyEstimates: [],
    exploits: [],
    vulnTypes: new Set(),
    rawFindings: [],
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
            text: match,
            severity: pattern.severity,
          });
          break;
        case 'exploit':
          findings.exploits.push(match);
          break;
        case 'vuln_type':
          findings.vulnTypes.add(match.toLowerCase());
          break;
        case 'finding':
        case 'poc_status':
          findings.rawFindings.push(match);
          break;
      }
    }
  }

  // Convert Sets to Arrays for JSON serialization
  findings.contracts = [...findings.contracts];
  findings.vulnTypes = [...findings.vulnTypes];

  return findings;
}

/**
 * Save findings to memory archive
 */
function saveFindings(findings, sessionKey, tokens) {
  const memoryDir = path.join(os.homedir(), 'clawd', 'memory');

  try {
    fs.mkdirSync(memoryDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  const date = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();
  const filename = `session-findings-${date}-${timestamp}.json`;
  const filePath = path.join(memoryDir, filename);

  const archive = {
    sessionKey,
    extractedAt: new Date().toISOString(),
    tokensBefore: tokens,
    findings,
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(archive, null, 2));
    console.log(`[auto-compaction] Findings saved to ${filename}`);
    return filePath;
  } catch (err) {
    console.error(`[auto-compaction] Failed to save findings: ${err.message}`);
    return null;
  }
}

/**
 * Main hook handler - runs before each agent response
 */
const autoCompactionHandler = async (event) => {
  // Only handle agent:bootstrap events
  if (event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  const sessionKey = event.sessionKey;
  const cfg = event.context?.cfg;

  if (!sessionKey || sessionKey === 'unknown' || sessionKey === 'global') {
    return;
  }

  try {
    // Resolve session file path
    const sessionFile = resolveSessionFile(sessionKey, cfg);

    if (!sessionFile) {
      return; // No session file yet, nothing to compact
    }

    // Estimate current token count
    const tokens = estimateTokens(sessionFile);

    if (tokens < TOKEN_THRESHOLD) {
      // Under threshold, no action needed
      return;
    }

    console.log(`[auto-compaction] Session approaching limit: ${tokens} tokens (threshold: ${TOKEN_THRESHOLD})`);

    // Read session content for finding extraction
    let content = '';
    try {
      content = fs.readFileSync(sessionFile, 'utf-8');
    } catch {
      console.error('[auto-compaction] Failed to read session file');
      return;
    }

    // Extract key findings before they get compacted away
    const findings = extractFindings(content);

    // Check if there's anything worth saving
    const hasFindings =
      findings.vulnerabilities.length > 0 ||
      findings.contracts.length > 0 ||
      findings.bountyEstimates.length > 0 ||
      findings.exploits.length > 0;

    if (hasFindings) {
      saveFindings(findings, sessionKey, tokens);

      console.log(`[auto-compaction] Extracted: ${findings.vulnerabilities.length} vulns, ` +
        `${findings.contracts.length} contracts, ${findings.bountyEstimates.length} bounty estimates`);
    }

    // Log the compaction trigger
    // Note: Actual compaction is handled by clawdbot's built-in dmHistoryLimit
    console.log(`[auto-compaction] Auto-compaction triggered: ${tokens} tokens → dmHistoryLimit will apply`);

  } catch (err) {
    console.error(`[auto-compaction] Error: ${err.message}`);
  }
};

export default autoCompactionHandler;
