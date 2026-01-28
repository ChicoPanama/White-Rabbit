#!/usr/bin/env tsx
/**
 * extract-patterns.ts — Uses Claude AI to extract vulnerability patterns
 * from raw hack data. Reads raw-hacks.json, enriches each hack with:
 *  - Solidity code patterns (regex)
 *  - Slither detector names
 *  - Name keywords for fork hunting
 *  - Patch patterns
 *
 * Usage: npx tsx src/scripts/extract-patterns.ts [--max N] [--model claude-haiku-4-20250414]
 *
 * Requires ANTHROPIC_API_KEY env var.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

import type { RawHack } from './build-hack-db.js';

// ── Types ──

export interface EnrichedHack extends RawHack {
  /** Extracted vulnerability code patterns (regex strings) */
  codePatterns: string[];
  /** Slither detector names that can catch this vulnerability */
  detectors: string[];
  /** Keywords to search for in protocol/contract names */
  nameKeywords: string[];
  /** Patch detection patterns (regex strings) */
  patchPatterns: string[];
  /** Vulnerability description */
  vulnDescription: string;
  /** Patch description */
  patchDescription: string;
  /** Whether AI enrichment was successful */
  enriched: boolean;
  /** Number of bytecode signatures (optional, hex) */
  bytecodeSignatures: string[];
}

// ── Known Slither Detectors by vuln type ──

const VULN_TYPE_DETECTORS: Record<string, string[]> = {
  'reentrancy': ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
  'oracle-manipulation': ['oracle-manipulation', 'price-manipulation'],
  'flash-loan': ['oracle-manipulation', 'price-manipulation'],
  'access-control': ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall', 'suicidal'],
  'donation-attack': ['unchecked-transfer', 'reentrancy-no-eth'],
  'price-manipulation': ['price-manipulation', 'oracle-manipulation'],
  'upgrade-vulnerability': ['unprotected-upgrade', 'uninitialized-state'],
  'unchecked-return': ['unchecked-transfer', 'unchecked-lowlevel', 'unchecked-send'],
  'rounding-error': ['divide-before-multiply', 'unchecked-transfer'],
  'logic-error': ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
  'signature-replay': ['tx-origin', 'missing-zero-check'],
  'compiler-bug': ['reentrancy-eth'],
};

// ── AI Extraction ──

const EXTRACTION_PROMPT = `You are a smart contract security expert. Given a DeFi hack description, extract vulnerability patterns that can be used to find similar vulnerabilities in other contracts.

RESPOND ONLY WITH VALID JSON matching this exact schema (no markdown, no explanation):
{
  "vulnDescription": "string - concise description of what went wrong (1-2 sentences)",
  "codePatterns": ["string - Solidity regex patterns that match vulnerable code. Use valid JavaScript regex syntax. Focus on function signatures, missing guards, and vulnerable patterns. Max 4 patterns."],
  "nameKeywords": ["string - lowercase keywords to find similar protocols by name. Include protocol type, function names, and common fork names. Max 6 keywords."],
  "patchPatterns": ["string - regex patterns that indicate the vulnerability has been fixed. Max 3 patterns."],
  "patchDescription": "string - brief description of the fix (1 sentence)",
  "detectors": ["string - Slither detector names from this list that could catch it: reentrancy-eth, reentrancy-no-eth, reentrancy-benign, oracle-manipulation, price-manipulation, arbitrary-send-eth, unprotected-upgrade, uninitialized-state, controlled-delegatecall, suicidal, unchecked-transfer, unchecked-lowlevel, unchecked-send, missing-zero-check, tx-origin, divide-before-multiply, incorrect-equality, shadowing-state, locked-ether"]
}

RULES:
- Code patterns must be valid JavaScript regex (escape backslashes properly for JSON)
- Focus on Solidity patterns (function signatures, modifiers, state variable access)
- Name keywords should be lowercase, single words
- Include the protocol's category (lending, dex, bridge, vault, etc.) in nameKeywords
- Only include Slither detectors that are genuinely relevant
- If you can't determine patterns for a hack type (e.g., private key compromise), use empty arrays for codePatterns/patchPatterns`;

async function extractPatternsForHack(
  client: Anthropic,
  hack: RawHack,
  model: string,
): Promise<Partial<EnrichedHack> | null> {
  const prompt = `Hack: ${hack.name}
Date: ${hack.date}
Amount Lost: $${hack.amountLost.toLocaleString()}
Technique: ${hack.technique || 'Unknown'}
Classification: ${hack.classification || 'Unknown'}
Target Type: ${hack.targetType || 'Unknown'}
Vulnerability Type: ${hack.vulnType}
Chains: ${hack.chains.join(', ') || 'Unknown'}
Source: ${hack.sourceUrl || 'N/A'}

Extract vulnerability patterns for this hack.`;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`  [extract] No JSON in response for ${hack.name}`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      vulnDescription: string;
      codePatterns: string[];
      nameKeywords: string[];
      patchPatterns: string[];
      patchDescription: string;
      detectors: string[];
    };

    // Validate regex patterns
    const validCodePatterns = parsed.codePatterns.filter(p => {
      try { new RegExp(p); return true; } catch { return false; }
    });
    const validPatchPatterns = parsed.patchPatterns.filter(p => {
      try { new RegExp(p); return true; } catch { return false; }
    });

    return {
      codePatterns: validCodePatterns,
      detectors: parsed.detectors ?? [],
      nameKeywords: parsed.nameKeywords ?? [],
      patchPatterns: validPatchPatterns,
      vulnDescription: parsed.vulnDescription ?? '',
      patchDescription: parsed.patchDescription ?? '',
    };
  } catch (err) {
    console.error(`  [extract] AI error for ${hack.name}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function fallbackPatterns(hack: RawHack): Partial<EnrichedHack> {
  const detectors = VULN_TYPE_DETECTORS[hack.vulnType] ?? [];
  const nameKeywords = hack.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4);

  if (hack.targetType) {
    nameKeywords.push(hack.targetType.toLowerCase().split(/\s+/)[0]);
  }

  return {
    codePatterns: [],
    detectors,
    nameKeywords: [...new Set(nameKeywords)],
    patchPatterns: [],
    vulnDescription: `${hack.technique || hack.vulnType} exploit on ${hack.targetType || 'protocol'}`,
    patchDescription: '',
  };
}

// ── Rate limiting ──

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ──

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[extract-patterns] ANTHROPIC_API_KEY is required');
    console.error('  Set it in .env or as an environment variable');
    console.error('  Running in fallback mode (no AI, basic heuristics only)...\n');
  }

  const maxArg = process.argv.find(a => a.startsWith('--max='));
  const maxHacks = maxArg ? parseInt(maxArg.split('=')[1], 10) : Infinity;

  const modelArg = process.argv.find(a => a.startsWith('--model='));
  const model = modelArg ? modelArg.split('=')[1] : 'claude-haiku-4-20250414';

  const dataDir = resolve(__dirname, '../data');
  const inputPath = resolve(dataDir, 'raw-hacks.json');
  const outputPath = resolve(dataDir, 'enriched-hacks.json');

  if (!existsSync(inputPath)) {
    console.error(`[extract-patterns] Input file not found: ${inputPath}`);
    console.error('  Run build-hack-db.ts first: npx tsx src/scripts/build-hack-db.ts');
    process.exit(1);
  }

  const rawHacks: RawHack[] = JSON.parse(readFileSync(inputPath, 'utf-8'));
  console.log(`[extract-patterns] Loaded ${rawHacks.length} hacks from raw-hacks.json`);

  // Load existing enriched data for incremental processing
  let existing: EnrichedHack[] = [];
  if (existsSync(outputPath)) {
    existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
    console.log(`[extract-patterns] Found ${existing.length} previously enriched hacks`);
  }
  const enrichedMap = new Map(existing.map(h => [h.id, h]));

  const client = apiKey ? new Anthropic({ apiKey }) : null;
  let aiCalls = 0;
  let aiSuccesses = 0;
  let skipped = 0;

  const hacksToProcess = rawHacks.slice(0, maxHacks);

  for (let i = 0; i < hacksToProcess.length; i++) {
    const hack = hacksToProcess[i];

    // Skip already enriched
    if (enrichedMap.has(hack.id) && enrichedMap.get(hack.id)!.enriched) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${hacksToProcess.length}] ${hack.name} ($${(hack.amountLost / 1e6).toFixed(1)}M)... `);

    let patterns: Partial<EnrichedHack> | null = null;

    // Try AI extraction first
    if (client) {
      // Skip AI for private key / phishing / rug pulls (no code patterns)
      const skipAiTechniques = ['private key', 'phishing', 'social engineering', 'rug pull', 'rugpull', 'scam'];
      const shouldSkipAi = skipAiTechniques.some(t =>
        (hack.technique?.toLowerCase() ?? '').includes(t) ||
        (hack.classification?.toLowerCase() ?? '').includes(t)
      );

      if (!shouldSkipAi) {
        patterns = await extractPatternsForHack(client, hack, model);
        aiCalls++;
        if (patterns) {
          aiSuccesses++;
          console.log('AI OK');
        } else {
          console.log('AI failed, using fallback');
        }

        // Rate limit: 1 req/sec for Haiku
        await sleep(1000);
      } else {
        console.log('skipped (no code patterns for this type)');
      }
    } else {
      console.log('fallback (no API key)');
    }

    // Fallback to heuristic patterns
    if (!patterns) {
      patterns = fallbackPatterns(hack);
    }

    const enriched: EnrichedHack = {
      ...hack,
      codePatterns: patterns.codePatterns ?? [],
      detectors: patterns.detectors ?? [],
      nameKeywords: patterns.nameKeywords ?? [],
      patchPatterns: patterns.patchPatterns ?? [],
      vulnDescription: patterns.vulnDescription ?? '',
      patchDescription: patterns.patchDescription ?? '',
      enriched: (patterns.codePatterns?.length ?? 0) > 0,
      bytecodeSignatures: [],
    };

    enrichedMap.set(hack.id, enriched);
  }

  const allEnriched = Array.from(enrichedMap.values())
    .sort((a, b) => b.amountLost - a.amountLost);

  writeFileSync(outputPath, JSON.stringify(allEnriched, null, 2));

  const enrichedCount = allEnriched.filter(h => h.enriched).length;
  console.log(`\n[extract-patterns] Results:`);
  console.log(`  Total hacks: ${allEnriched.length}`);
  console.log(`  Enriched (with code patterns): ${enrichedCount}`);
  console.log(`  Skipped (already enriched): ${skipped}`);
  if (client) {
    console.log(`  AI calls: ${aiCalls} (${aiSuccesses} successful)`);
  }
  console.log(`  Output: ${outputPath}`);
}

main().catch(err => {
  console.error('[extract-patterns] Fatal error:', err);
  process.exit(1);
});
