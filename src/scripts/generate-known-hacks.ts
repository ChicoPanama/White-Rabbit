#!/usr/bin/env tsx
/**
 * generate-known-hacks.ts — Converts enriched-hacks.json into TypeScript
 * source code (known-hacks.ts). Merges with existing manual entries,
 * preserving hand-tuned patterns while adding AI-extracted ones.
 *
 * Usage: npx tsx src/scripts/generate-known-hacks.ts [--min-amount 500000]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import type { EnrichedHack } from './extract-patterns.js';
import type { VulnerabilityType } from '../data/known-hacks.js';

// ── Config ──

const VALID_VULN_TYPES: VulnerabilityType[] = [
  'reentrancy', 'oracle-manipulation', 'flash-loan', 'access-control',
  'donation-attack', 'price-manipulation', 'upgrade-vulnerability',
  'unchecked-return', 'rounding-error', 'logic-error', 'signature-replay',
  'compiler-bug',
];

// IDs of manually curated entries that should NOT be overwritten
const MANUAL_IDS = new Set([
  'cream-reentrancy-2021',
  'vyper-curve-reentrancy-2023',
  'siren-reentrancy-2021',
  'read-only-reentrancy-2023',
  'harvest-oracle-2020',
  'bonq-oracle-2023',
  'mango-markets-oracle-2022',
  'pancakebunny-flashloan-2021',
  'xtoken-flashloan-2021',
  'ronin-access-control-2022',
  'beanstalk-governance-2022',
  'wintermute-vanity-2022',
  'euler-donation-2023',
  'erc4626-inflation-2023',
  'wormhole-uninitialized-2022',
  'audius-proxy-2022',
  'platypus-2023',
  'level-finance-2023',
  'defrost-unchecked-2022',
  'li-fi-2022',
  'hundred-finance-2023',
  'nomad-bridge-2022',
  'deus-oracle-2022',
  'sentiment-reentrancy-2023',
  'safemoon-burn-2023',
  'multichain-access-2023',
  'kyberswap-precision-2023',
]);

// ── Helpers ──

function escapeRegexForTs(pattern: string): string {
  // The pattern is already a regex string; we need to escape it for a TS RegExp literal
  // Replace backslash sequences that would be invalid in a regex literal
  return pattern
    .replace(/\\/g, '\\\\')  // Double-escape backslashes for string context
    .replace(/'/g, "\\'");   // Escape single quotes
}

/** Sanitize a string for safe embedding in a TypeScript single-quoted string literal. */
function sanitizeForTs(str: string): string {
  return str
    .replace(/[\r\n]+/g, ' ')  // Replace newlines with space
    .replace(/\\/g, '\\\\')    // Escape backslashes
    .replace(/'/g, "\\'")      // Escape single quotes
    .trim();
}

function validateVulnType(type: string): VulnerabilityType {
  if (VALID_VULN_TYPES.includes(type as VulnerabilityType)) {
    return type as VulnerabilityType;
  }
  return 'logic-error'; // Default fallback
}

function generateId(hack: EnrichedHack): string {
  // Use existing ID or generate from name + date
  if (hack.id && hack.id.length > 0) return hack.id;
  const slug = hack.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const year = hack.date.split('-')[0];
  return `${slug}-${year}`;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(line => pad + line).join('\n');
}

// ── Code Generation ──

function generateHackEntry(hack: EnrichedHack): string {
  const id = generateId(hack);
  const vulnType = validateVulnType(hack.vulnType);
  const codePatterns = hack.codePatterns
    .filter(p => {
      try { new RegExp(p); return true; } catch { return false; }
    })
    .slice(0, 4);
  const patchPatterns = hack.patchPatterns
    .filter(p => {
      try { new RegExp(p); return true; } catch { return false; }
    })
    .slice(0, 3);
  const nameKeywords = hack.nameKeywords.slice(0, 6);
  const detectors = hack.detectors.slice(0, 4);
  const sources = hack.sourceUrl ? [hack.sourceUrl] : [];

  // Skip hacks with no useful patterns
  if (codePatterns.length === 0 && detectors.length === 0) {
    return '';
  }

  const codePatternsStr = codePatterns.length > 0
    ? codePatterns.map(p => `        new RegExp('${escapeRegexForTs(p)}'),`).join('\n')
    : '        // No code patterns extracted';

  const patchPatternsStr = patchPatterns.length > 0
    ? patchPatterns.map(p => `        new RegExp('${escapeRegexForTs(p)}'),`).join('\n')
    : '        // No patch patterns extracted';

  return `  {
    id: '${sanitizeForTs(id)}',
    name: '${sanitizeForTs(hack.name)}',
    date: '${hack.date}',
    amountLost: ${hack.amountLost.toLocaleString('en-US', { useGrouping: false })},
    vulnerability: {
      type: '${vulnType}',
      description: '${sanitizeForTs(hack.vulnDescription || hack.technique || 'Unknown vulnerability')}',
      detectors: [${detectors.map(d => `'${sanitizeForTs(d)}'`).join(', ')}],
      codePatterns: [
${codePatternsStr}
      ],
      nameKeywords: [${nameKeywords.map(k => `'${sanitizeForTs(k.toLowerCase())}'`).join(', ')}],
    },
    patch: {
      description: '${sanitizeForTs(hack.patchDescription || 'Fix applied')}',
      codePatterns: [
${patchPatternsStr}
      ],
    },
    sources: [${sources.map(s => `'${sanitizeForTs(s)}'`).join(', ')}],
  }`;
}

function generateKnownHacksFile(manualSection: string, generatedEntries: string[]): string {
  return `/**
 * Known Hacks Database — curated list of major DeFi exploits with
 * vulnerability signatures, patch detection patterns, and Slither detectors.
 *
 * Used by ForkHunterV2 to find unpatched forks of hacked protocols.
 * Sources: rekt.news leaderboard, DeFiLlama hacks API, post-mortems, and audit reports.
 *
 * GENERATED FILE — Manual entries preserved, auto-generated entries appended.
 * To regenerate: npx tsx src/scripts/generate-known-hacks.ts
 * To update raw data: npx tsx src/scripts/build-hack-db.ts
 * Full pipeline: npm run build:hacks
 */

export interface KnownHack {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Date of exploit (YYYY-MM-DD) */
  date: string;
  /** Amount lost in USD */
  amountLost: number;
  vulnerability: {
    /** Vulnerability category */
    type: VulnerabilityType;
    /** What went wrong */
    description: string;
    /** Slither detector(s) that catch it */
    detectors: string[];
    /** Regex to identify vulnerable code in source */
    codePatterns: RegExp[];
    /** Function selectors or bytecode fragments (hex, optional) */
    bytecodeSignatures?: string[];
    /** Keywords to search for in contract/protocol names */
    nameKeywords: string[];
  };
  patch: {
    /** What the fix looks like */
    description: string;
    /** Regex patterns indicating the contract has been patched */
    codePatterns: RegExp[];
  };
  /** Reference links (post-mortems, rekt.news, etc.) */
  sources: string[];
}

export type VulnerabilityType =
  | 'reentrancy'
  | 'oracle-manipulation'
  | 'flash-loan'
  | 'access-control'
  | 'donation-attack'
  | 'price-manipulation'
  | 'upgrade-vulnerability'
  | 'unchecked-return'
  | 'rounding-error'
  | 'logic-error'
  | 'signature-replay'
  | 'compiler-bug';

/**
 * Priority score for vulnerability types — higher means more likely
 * to have unpatched forks in the wild.
 */
export const VULN_TYPE_FORK_SCORE: Record<VulnerabilityType, number> = {
  'reentrancy': 10,
  'access-control': 9,
  'oracle-manipulation': 8,
  'flash-loan': 7,
  'price-manipulation': 7,
  'donation-attack': 6,
  'upgrade-vulnerability': 6,
  'unchecked-return': 5,
  'logic-error': 5,
  'rounding-error': 4,
  'signature-replay': 4,
  'compiler-bug': 3,
};

// ════════════════════════════════════════════════════════════════
// MANUAL ENTRIES — hand-tuned patterns, do not auto-overwrite
// ════════════════════════════════════════════════════════════════

${manualSection}

// ════════════════════════════════════════════════════════════════
// AUTO-GENERATED ENTRIES — from DeFiLlama + AI pattern extraction
// Re-generated by: npm run build:hacks
// ════════════════════════════════════════════════════════════════

const GENERATED_HACKS: KnownHack[] = [
${generatedEntries.join(',\n')}
];

export const KNOWN_HACKS: KnownHack[] = [...MANUAL_HACKS, ...GENERATED_HACKS];

/**
 * Get hacks sorted by priority for fork hunting.
 * Prioritizes by: vulnerability type fork-likelihood, then amount lost.
 */
export function getPriorityHacks(minAmountLost = 1_000_000): KnownHack[] {
  return KNOWN_HACKS
    .filter(h => h.amountLost >= minAmountLost)
    .filter(h => h.vulnerability.type !== 'compiler-bug') // Compiler bugs less likely to fork
    .sort((a, b) => {
      const scoreA = VULN_TYPE_FORK_SCORE[a.vulnerability.type] ?? 5;
      const scoreB = VULN_TYPE_FORK_SCORE[b.vulnerability.type] ?? 5;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.amountLost - a.amountLost;
    });
}
`;
}

// ── Extract manual entries from existing known-hacks.ts ──

function extractManualSection(existingSource: string): string {
  // The existing file has all entries in a single KNOWN_HACKS array.
  // We need to extract the array contents and wrap them as MANUAL_HACKS.
  const arrayMatch = existingSource.match(
    /export const KNOWN_HACKS:\s*KnownHack\[\]\s*=\s*\[([\s\S]*?)\];/
  );

  if (!arrayMatch) {
    console.warn('[generate] Could not extract existing KNOWN_HACKS array');
    return 'const MANUAL_HACKS: KnownHack[] = [];';
  }

  return `const MANUAL_HACKS: KnownHack[] = [${arrayMatch[1]}];`;
}

// ── Main ──

async function main() {
  const minAmountArg = process.argv.find(a => a.startsWith('--min-amount='));
  const minAmount = minAmountArg ? parseInt(minAmountArg.split('=')[1], 10) : 500_000;

  const dataDir = resolve(__dirname, '../data');
  const enrichedPath = resolve(dataDir, 'enriched-hacks.json');
  const existingPath = resolve(dataDir, 'known-hacks.ts');
  const outputPath = existingPath; // Overwrite in place

  if (!existsSync(enrichedPath)) {
    console.error(`[generate] Input file not found: ${enrichedPath}`);
    console.error('  Run extract-patterns.ts first: npx tsx src/scripts/extract-patterns.ts');
    process.exit(1);
  }

  // Read enriched hacks
  const enrichedHacks: EnrichedHack[] = JSON.parse(readFileSync(enrichedPath, 'utf-8'));
  console.log(`[generate] Loaded ${enrichedHacks.length} enriched hacks`);

  // Read existing known-hacks.ts for manual entries
  let manualSection = 'const MANUAL_HACKS: KnownHack[] = [];';
  if (existsSync(existingPath)) {
    const existingSource = readFileSync(existingPath, 'utf-8');

    // Check if it already has MANUAL_HACKS (previously generated)
    if (existingSource.includes('MANUAL_HACKS')) {
      const manualMatch = existingSource.match(
        /const MANUAL_HACKS:\s*KnownHack\[\]\s*=\s*\[[\s\S]*?\n\];/
      );
      if (manualMatch) {
        manualSection = manualMatch[0];
        console.log('[generate] Preserved existing MANUAL_HACKS section');
      }
    } else {
      // First run — extract from old-style single array
      manualSection = extractManualSection(existingSource);
      console.log('[generate] Extracted manual entries from existing known-hacks.ts');
    }
  }

  // Count existing manual IDs from the manual section
  const manualIdMatches = manualSection.matchAll(/id:\s*'([^']+)'/g);
  const existingManualIds = new Set(Array.from(manualIdMatches, m => m[1]));
  console.log(`[generate] Manual entries: ${existingManualIds.size}`);

  // Filter enriched hacks: skip manual IDs, skip below amount threshold
  const generated = enrichedHacks
    .filter(h => !existingManualIds.has(h.id))
    .filter(h => !MANUAL_IDS.has(h.id))
    .filter(h => h.amountLost >= minAmount)
    .filter(h => h.enriched || h.detectors.length > 0);

  console.log(`[generate] Generating ${generated.length} auto entries (excluding ${existingManualIds.size} manual)`);

  // Generate TypeScript entries
  const entries = generated
    .map(h => generateHackEntry(h))
    .filter(e => e.length > 0);

  console.log(`[generate] ${entries.length} entries with usable patterns`);

  // Write output
  const output = generateKnownHacksFile(manualSection, entries);
  writeFileSync(outputPath, output);

  const totalEntries = existingManualIds.size + entries.length;
  console.log(`\n[generate] Wrote ${totalEntries} total entries to ${outputPath}`);
  console.log(`  Manual: ${existingManualIds.size}`);
  console.log(`  Generated: ${entries.length}`);
}

main().catch(err => {
  console.error('[generate] Fatal error:', err);
  process.exit(1);
});
