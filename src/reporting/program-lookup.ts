/**
 * Immunefi program lookup utility.
 *
 * Matches scanned contracts to Immunefi bounty programs by address/chain.
 * Uses a local cache (data/immunefi-programs.json) that can be periodically
 * updated from the Immunefi API.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from '../agents/agent-types.js';
import type { ProgramInfo, ProgramAsset, ImmunefiSeverity } from './immunefi-types.js';

// ── Paths ──

const PROGRAMS_PATH = path.resolve(process.cwd(), 'data', 'immunefi-programs.json');

// ── Cache ──

let programCache: ProgramInfo[] | null = null;

/**
 * Load the programs cache from disk.
 */
function loadCache(): ProgramInfo[] {
  if (programCache) return programCache;

  if (!fs.existsSync(PROGRAMS_PATH)) {
    programCache = [];
    return programCache;
  }

  try {
    const raw = fs.readFileSync(PROGRAMS_PATH, 'utf-8');
    const data = JSON.parse(raw);
    programCache = Array.isArray(data.programs) ? data.programs : [];
  } catch {
    programCache = [];
  }

  return programCache;
}

/**
 * Clear the in-memory cache (for testing or after updates).
 */
export function clearProgramCache(): void {
  programCache = null;
}

// ── Lookup ──

/**
 * Look up an Immunefi bounty program by contract address and chain.
 *
 * @param contractAddress - The contract address (case-insensitive)
 * @param chain - The blockchain name (e.g., 'ethereum', 'arbitrum')
 * @returns Matching program info or null if not found
 */
export function lookupProgram(contractAddress: string, chain: string): ProgramInfo | null {
  const programs = loadCache();
  const normalizedAddress = contractAddress.toLowerCase();
  const normalizedChain = chain.toLowerCase();

  for (const program of programs) {
    for (const asset of program.assets) {
      if (
        asset.address.toLowerCase() === normalizedAddress &&
        asset.chain.toLowerCase() === normalizedChain
      ) {
        return program;
      }
    }
  }

  return null;
}

/**
 * Look up a program by name or slug.
 */
export function lookupProgramByName(name: string): ProgramInfo | null {
  const programs = loadCache();
  const normalizedName = name.toLowerCase();

  return programs.find(p =>
    p.name.toLowerCase() === normalizedName ||
    p.slug.toLowerCase() === normalizedName
  ) ?? null;
}

// ── Scope Validation ──

/**
 * Validate whether a finding is in scope for a given Immunefi program.
 *
 * Checks:
 * 1. Contract address is in the program's asset list
 * 2. Chain matches
 * 3. Asset type is 'smart_contract'
 *
 * @returns true if the finding is in scope
 */
export function validateInScope(
  finding: Finding,
  program: ProgramInfo,
  contractAddress: string,
  chain: string,
): boolean {
  const normalizedAddress = contractAddress.toLowerCase();
  const normalizedChain = chain.toLowerCase();

  // Check if the contract is in the program's asset scope
  const assetMatch = program.assets.some(asset =>
    asset.type === 'smart_contract' &&
    asset.address.toLowerCase() === normalizedAddress &&
    asset.chain.toLowerCase() === normalizedChain
  );

  if (!assetMatch) return false;

  // The finding itself is in scope if the vulnerability type is not explicitly excluded
  // (Immunefi programs generally don't exclude specific vuln types from smart_contract scope)
  return true;
}

// ── Bounty Estimation ──

/** Bounty payout ranges by severity, as percentage of max bounty. */
const BOUNTY_RANGES: Record<ImmunefiSeverity, { minPct: number; maxPct: number }> = {
  Critical: { minPct: 0.20, maxPct: 1.00 },
  High:     { minPct: 0.05, maxPct: 0.30 },
  Medium:   { minPct: 0.01, maxPct: 0.10 },
  Low:      { minPct: 0.001, maxPct: 0.02 },
};

/**
 * Estimate the bounty payout for a finding based on its severity
 * and the program's maximum bounty.
 *
 * @returns Estimated range string like "$5,000 - $50,000"
 */
export function estimateBounty(
  severity: ImmunefiSeverity,
  program: ProgramInfo,
): string {
  const maxBounty = program.maxBounty;
  if (maxBounty <= 0) return 'Unknown';

  const range = BOUNTY_RANGES[severity];
  const minPayout = Math.floor(maxBounty * range.minPct);
  const maxPayout = Math.floor(maxBounty * range.maxPct);

  return `$${minPayout.toLocaleString()} - $${maxPayout.toLocaleString()}`;
}

// ── Program Cache Management ──

/**
 * Save programs to the local cache file.
 */
export function saveProgramCache(programs: ProgramInfo[]): void {
  const dir = path.dirname(PROGRAMS_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const data = {
    _schema: 'immunefi-programs-v1',
    _description: 'Local cache of Immunefi bug bounty programs. Run updateProgramCache() to refresh.',
    _updatedAt: new Date().toISOString(),
    programs,
  };

  fs.writeFileSync(PROGRAMS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  programCache = programs;
}

/**
 * Update the program cache by fetching from Immunefi.
 *
 * This is a placeholder — real implementation would fetch from
 * Immunefi's API or scrape their program listing. Should be
 * run periodically (e.g., daily), not on every scan.
 */
export async function updateProgramCache(): Promise<{ count: number; updatedAt: string }> {
  // Placeholder: In production, this would:
  // 1. Fetch https://immunefi.com/explore/ or use their API
  // 2. Parse program details (name, assets, max bounty, scope)
  // 3. Save to data/immunefi-programs.json
  //
  // For now, just return the current cache info
  const programs = loadCache();
  const updatedAt = new Date().toISOString();

  if (programs.length > 0) {
    saveProgramCache(programs);
  }

  return { count: programs.length, updatedAt };
}

/**
 * Get cache statistics.
 */
export function getProgramCacheStats(): {
  programCount: number;
  assetCount: number;
  exists: boolean;
  lastUpdated: string | null;
} {
  const exists = fs.existsSync(PROGRAMS_PATH);
  if (!exists) {
    return { programCount: 0, assetCount: 0, exists: false, lastUpdated: null };
  }

  try {
    const raw = fs.readFileSync(PROGRAMS_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const programs: ProgramInfo[] = data.programs ?? [];
    const assetCount = programs.reduce((sum, p) => sum + p.assets.length, 0);

    return {
      programCount: programs.length,
      assetCount,
      exists: true,
      lastUpdated: data._updatedAt ?? null,
    };
  } catch {
    return { programCount: 0, assetCount: 0, exists: true, lastUpdated: null };
  }
}
