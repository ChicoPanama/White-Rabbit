#!/usr/bin/env tsx
/**
 * build-hack-db.ts — Scrapes DeFi hack data from DeFiLlama and rekt.news,
 * deduplicates, classifies by vulnerability type, and writes raw-hacks.json.
 *
 * Usage: npx tsx src/scripts/build-hack-db.ts [--min-amount 500000]
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ── Types ──

export interface RawHack {
  /** Unique ID (lowercase slug) */
  id: string;
  /** Human-readable name */
  name: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Amount lost in USD */
  amountLost: number;
  /** Amount returned (if any) */
  returnedFunds: number;
  /** EVM chains affected */
  chains: string[];
  /** Vulnerability classification */
  classification: string;
  /** Attack technique */
  technique: string;
  /** Target type (e.g. "Bridge", "Lending", "DEX") */
  targetType: string;
  /** Source language (Solidity, Vyper, etc.) */
  language: string;
  /** Was this a bridge hack? */
  bridgeHack: boolean;
  /** Source URL (post-mortem or report) */
  sourceUrl: string;
  /** DeFiLlama ID */
  defillamaId: string | null;
  /** Inferred vulnerability type */
  vulnType: string;
  /** Data source */
  source: 'defillama' | 'rekt' | 'manual';
}

interface DeFiLlamaHack {
  date: number; // Unix timestamp
  name: string;
  classification?: string;
  technique?: string;
  amount: number;
  chain?: string[];
  bridgeHack?: boolean;
  targetType?: string;
  source?: string;
  returnedFunds?: number;
  defillamaId?: string;
  language?: string;
}

// ── Vulnerability Classification ──

const TECHNIQUE_TO_VULN: Record<string, string> = {
  'Reentrancy': 'reentrancy',
  'Flash Loan Attack': 'flash-loan',
  'Flash loan attack': 'flash-loan',
  'Price Manipulation': 'price-manipulation',
  'Price Oracle Manipulation': 'oracle-manipulation',
  'Oracle Manipulation': 'oracle-manipulation',
  'Access Control': 'access-control',
  'Access Control Exploit': 'access-control',
  'Privilege Escalation': 'access-control',
  'Admin Key Compromise': 'access-control',
  'Private Key Leak': 'access-control',
  'Key Leak': 'access-control',
  'Phishing': 'access-control',
  'Social Engineering': 'access-control',
  'Rugpull': 'access-control',
  'Rug Pull': 'access-control',
  'Logic Error': 'logic-error',
  'Business Logic': 'logic-error',
  'Contract Bug': 'logic-error',
  'Smart Contract Bug': 'logic-error',
  'Rounding Error': 'rounding-error',
  'Precision Loss': 'rounding-error',
  'Upgrade Exploit': 'upgrade-vulnerability',
  'Uninitialized Proxy': 'upgrade-vulnerability',
  'Governance Attack': 'access-control',
  'Front-running': 'logic-error',
  'Frontrunning': 'logic-error',
  'Signature Replay': 'signature-replay',
  'Signature Exploit': 'signature-replay',
  'Donation Attack': 'donation-attack',
  'Inflation Attack': 'donation-attack',
  'Compiler Bug': 'compiler-bug',
  'Bridge Exploit': 'logic-error',
  'Cross-chain': 'logic-error',
};

const CLASSIFICATION_TO_VULN: Record<string, string> = {
  'Exploit': 'logic-error',
  'Flash Loan': 'flash-loan',
  'Rug Pull': 'access-control',
  'Access Control': 'access-control',
  'Bridge Hack': 'logic-error',
};

function classifyVulnerability(technique: string, classification: string, name: string): string {
  // Try technique first (most specific)
  if (technique) {
    for (const [key, vuln] of Object.entries(TECHNIQUE_TO_VULN)) {
      if (technique.toLowerCase().includes(key.toLowerCase())) {
        return vuln;
      }
    }
  }

  // Try classification
  if (classification) {
    for (const [key, vuln] of Object.entries(CLASSIFICATION_TO_VULN)) {
      if (classification.toLowerCase().includes(key.toLowerCase())) {
        return vuln;
      }
    }
  }

  // Heuristic from name
  const nameLower = name.toLowerCase();
  if (nameLower.includes('reentrancy') || nameLower.includes('reentrant')) return 'reentrancy';
  if (nameLower.includes('flash')) return 'flash-loan';
  if (nameLower.includes('oracle')) return 'oracle-manipulation';
  if (nameLower.includes('bridge')) return 'logic-error';
  if (nameLower.includes('rug')) return 'access-control';

  return 'logic-error'; // Default
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function unixToDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toISOString().split('T')[0];
}

// EVM chains we care about (lowercase)
const EVM_CHAINS = new Set([
  'ethereum', 'bsc', 'binance', 'polygon', 'arbitrum', 'optimism',
  'avalanche', 'fantom', 'cronos', 'gnosis', 'base', 'linea',
  'scroll', 'blast', 'zksync', 'mantle', 'manta', 'mode',
  'celo', 'moonbeam', 'moonriver', 'harmony', 'aurora', 'metis',
  'boba', 'kava', 'klaytn', 'okx', 'heco', 'fuse',
  'multi-chain', 'multichain', 'various',
]);

function normalizeChains(rawChains: string[] | undefined): string[] {
  if (!rawChains || rawChains.length === 0) return [];
  return rawChains
    .map(c => c.toLowerCase().trim())
    .filter(c => {
      // Filter to EVM-compatible or generic
      for (const evm of EVM_CHAINS) {
        if (c.includes(evm)) return true;
      }
      return false;
    });
}

// ── DeFiLlama Fetcher ──

async function fetchDeFiLlamaHacks(): Promise<RawHack[]> {
  console.log('[build-hack-db] Fetching DeFiLlama hacks API...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch('https://api.llama.fi/hacks', {
      signal: controller.signal,
      headers: { 'User-Agent': 'white-rabbit-scanner/1.0' },
    });

    if (!res.ok) {
      throw new Error(`DeFiLlama API returned ${res.status}`);
    }

    const data = await res.json() as DeFiLlamaHack[];
    console.log(`[build-hack-db] Got ${data.length} hacks from DeFiLlama`);

    return data.map(h => {
      const date = unixToDate(h.date);
      const technique = h.technique ?? '';
      const classification = h.classification ?? '';

      return {
        id: slugify(`${h.name}-${date}`),
        name: h.name,
        date,
        amountLost: h.amount ?? 0,
        returnedFunds: h.returnedFunds ?? 0,
        chains: normalizeChains(h.chain),
        classification,
        technique,
        targetType: h.targetType ?? '',
        language: h.language ?? '',
        bridgeHack: h.bridgeHack ?? false,
        sourceUrl: h.source ?? '',
        defillamaId: h.defillamaId ?? null,
        vulnType: classifyVulnerability(technique, classification, h.name),
        source: 'defillama' as const,
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ── Top rekt.news hacks (supplemental, hardcoded from leaderboard) ──
// These cover the biggest hacks that may have extra context

const REKT_TOP_HACKS: Partial<RawHack>[] = [
  { name: 'Ronin Network', date: '2022-03-23', amountLost: 624_000_000, technique: 'Admin Key Compromise', targetType: 'Bridge', chains: ['ethereum'], sourceUrl: 'https://rekt.news/ronin-rekt/' },
  { name: 'Poly Network', date: '2021-08-10', amountLost: 611_000_000, technique: 'Access Control', targetType: 'Bridge', chains: ['ethereum', 'bsc', 'polygon'], sourceUrl: 'https://rekt.news/polynetwork-rekt/' },
  { name: 'BNB Bridge', date: '2022-10-07', amountLost: 586_000_000, technique: 'Logic Error', targetType: 'Bridge', chains: ['bsc'], sourceUrl: 'https://rekt.news/bnb-bridge-rekt/' },
  { name: 'Wormhole', date: '2022-02-02', amountLost: 326_000_000, technique: 'Uninitialized Proxy', targetType: 'Bridge', chains: ['ethereum'], sourceUrl: 'https://rekt.news/wormhole-rekt/' },
  { name: 'Euler Finance', date: '2023-03-13', amountLost: 197_000_000, technique: 'Donation Attack', targetType: 'Lending', chains: ['ethereum'], sourceUrl: 'https://rekt.news/euler-rekt/' },
  { name: 'Nomad Bridge', date: '2022-08-01', amountLost: 190_000_000, technique: 'Logic Error', targetType: 'Bridge', chains: ['ethereum'], sourceUrl: 'https://rekt.news/nomad-rekt/' },
  { name: 'Beanstalk', date: '2022-04-17', amountLost: 181_000_000, technique: 'Governance Attack', targetType: 'Stablecoin', chains: ['ethereum'], sourceUrl: 'https://rekt.news/beanstalk-rekt/' },
  { name: 'Wintermute', date: '2022-09-20', amountLost: 160_000_000, technique: 'Private Key Leak', targetType: 'Market Maker', chains: ['ethereum'], sourceUrl: 'https://rekt.news/wintermute-rekt/' },
  { name: 'Multichain', date: '2023-07-07', amountLost: 126_000_000, technique: 'Admin Key Compromise', targetType: 'Bridge', chains: ['ethereum', 'fantom'], sourceUrl: 'https://rekt.news/multichain-rekt/' },
  { name: 'BonqDAO', date: '2023-02-01', amountLost: 120_000_000, technique: 'Oracle Manipulation', targetType: 'Lending', chains: ['polygon'], sourceUrl: 'https://rekt.news/bonq-rekt/' },
  { name: 'Mango Markets', date: '2022-10-11', amountLost: 114_000_000, technique: 'Price Manipulation', targetType: 'Perp DEX', chains: [], sourceUrl: 'https://rekt.news/mango-markets-rekt/' },
  { name: 'Cream Finance', date: '2021-10-27', amountLost: 130_000_000, technique: 'Flash Loan Attack', targetType: 'Lending', chains: ['ethereum'], sourceUrl: 'https://rekt.news/cream-rekt-2/' },
  { name: 'Badger DAO', date: '2021-12-02', amountLost: 120_000_000, technique: 'Phishing', targetType: 'Yield', chains: ['ethereum'], sourceUrl: 'https://rekt.news/badger-rekt/' },
  { name: 'Curve/Vyper', date: '2023-07-30', amountLost: 70_000_000, technique: 'Compiler Bug', targetType: 'DEX', chains: ['ethereum'], sourceUrl: 'https://rekt.news/curve-vyper-rekt/' },
  { name: 'Harmony Bridge', date: '2022-06-24', amountLost: 100_000_000, technique: 'Admin Key Compromise', targetType: 'Bridge', chains: ['harmony', 'ethereum'], sourceUrl: 'https://rekt.news/harmony-rekt/' },
  { name: 'Qubit Finance', date: '2022-01-28', amountLost: 80_000_000, technique: 'Logic Error', targetType: 'Bridge', chains: ['bsc'], sourceUrl: 'https://rekt.news/qubit-rekt/' },
  { name: 'Rari/Fei', date: '2022-04-30', amountLost: 80_000_000, technique: 'Reentrancy', targetType: 'Lending', chains: ['ethereum'], sourceUrl: 'https://rekt.news/fei-rari-rekt/' },
  { name: 'KyberSwap', date: '2023-11-22', amountLost: 48_800_000, technique: 'Precision Loss', targetType: 'DEX', chains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'avalanche'], sourceUrl: 'https://rekt.news/kyberswap-elastic-rekt/' },
  { name: 'PancakeBunny', date: '2021-05-20', amountLost: 45_000_000, technique: 'Flash Loan Attack', targetType: 'Yield', chains: ['bsc'], sourceUrl: 'https://rekt.news/pancakebunny-rekt/' },
  { name: 'Harvest Finance', date: '2020-10-26', amountLost: 34_000_000, technique: 'Oracle Manipulation', targetType: 'Yield', chains: ['ethereum'], sourceUrl: 'https://rekt.news/harvest-finance-rekt/' },
  { name: 'Parity Wallet', date: '2017-11-06', amountLost: 281_000_000, technique: 'Access Control', targetType: 'Wallet', chains: ['ethereum'], sourceUrl: 'https://rekt.news/parity-rekt/' },
  { name: 'The DAO', date: '2016-06-17', amountLost: 60_000_000, technique: 'Reentrancy', targetType: 'DAO', chains: ['ethereum'], sourceUrl: 'https://rekt.news/the-dao-rekt/' },
  { name: 'Platypus Finance', date: '2023-02-16', amountLost: 8_500_000, technique: 'Logic Error', targetType: 'DEX', chains: ['avalanche'], sourceUrl: 'https://rekt.news/platypus-rekt/' },
  { name: 'Hundred Finance', date: '2023-04-15', amountLost: 7_400_000, technique: 'Rounding Error', targetType: 'Lending', chains: ['optimism'], sourceUrl: 'https://rekt.news/hundred-finance-rekt/' },
  { name: 'Sentinel Protocol', date: '2023-04-04', amountLost: 1_000_000, technique: 'Reentrancy', targetType: 'Lending', chains: ['arbitrum'], sourceUrl: 'https://rekt.news/sentiment-rekt/' },
  { name: 'Level Finance', date: '2023-05-01', amountLost: 1_100_000, technique: 'Logic Error', targetType: 'Perp DEX', chains: ['bsc'], sourceUrl: 'https://rekt.news/level-finance-rekt/' },
  { name: 'SafeMoon', date: '2023-03-28', amountLost: 8_900_000, technique: 'Access Control', targetType: 'Token', chains: ['bsc'], sourceUrl: 'https://rekt.news/safemoon-rekt/' },
  { name: 'Deus Finance', date: '2022-04-28', amountLost: 13_400_000, technique: 'Oracle Manipulation', targetType: 'Lending', chains: ['fantom'], sourceUrl: 'https://rekt.news/deus-dao-rekt-2/' },
  { name: 'Ankr/Helio', date: '2022-12-02', amountLost: 20_000_000, technique: 'Access Control', targetType: 'Staking', chains: ['bsc'], sourceUrl: 'https://rekt.news/ankr-helio-rekt/' },
  { name: 'Team Finance', date: '2022-10-27', amountLost: 14_500_000, technique: 'Logic Error', targetType: 'Locker', chains: ['ethereum'], sourceUrl: 'https://rekt.news/team-finance-rekt/' },
  { name: 'Transit Swap', date: '2022-10-01', amountLost: 21_000_000, technique: 'Access Control', targetType: 'DEX Aggregator', chains: ['bsc'], sourceUrl: 'https://rekt.news/transit-swap-rekt/' },
  { name: 'Conic Finance', date: '2023-07-21', amountLost: 3_260_000, technique: 'Reentrancy', targetType: 'Yield', chains: ['ethereum'], sourceUrl: 'https://rekt.news/conic-finance-rekt/' },
  { name: 'EraLend', date: '2023-07-25', amountLost: 3_400_000, technique: 'Reentrancy', targetType: 'Lending', chains: ['zksync'], sourceUrl: 'https://rekt.news/eralend-rekt/' },
  { name: 'Exactly Protocol', date: '2023-08-18', amountLost: 7_600_000, technique: 'Logic Error', targetType: 'Lending', chains: ['optimism'], sourceUrl: 'https://rekt.news/exactly-rekt/' },
  { name: 'Zunami Protocol', date: '2023-08-13', amountLost: 2_100_000, technique: 'Price Manipulation', targetType: 'Yield', chains: ['ethereum'], sourceUrl: 'https://rekt.news/zunami-rekt/' },
  { name: 'Vyper/Curve (CRV)', date: '2023-07-30', amountLost: 70_000_000, technique: 'Compiler Bug', targetType: 'DEX', chains: ['ethereum'], sourceUrl: 'https://rekt.news/curve-vyper-rekt/' },
  { name: 'Li.Fi', date: '2022-03-20', amountLost: 600_000, technique: 'Access Control', targetType: 'Bridge Aggregator', chains: ['ethereum'], sourceUrl: 'https://rekt.news/lifi-rekt/' },
  { name: 'Defrost Finance', date: '2022-12-25', amountLost: 12_000_000, technique: 'Rug Pull', targetType: 'Lending', chains: ['avalanche'], sourceUrl: 'https://rekt.news/defrost-rekt/' },
  { name: 'Audius', date: '2022-07-24', amountLost: 6_000_000, technique: 'Upgrade Exploit', targetType: 'Governance', chains: ['ethereum'], sourceUrl: 'https://rekt.news/audius-rekt/' },
  { name: 'xToken', date: '2021-05-12', amountLost: 24_500_000, technique: 'Flash Loan Attack', targetType: 'Yield', chains: ['ethereum'], sourceUrl: 'https://rekt.news/xtoken-rekt/' },
  { name: 'Siren Protocol', date: '2021-09-04', amountLost: 3_500_000, technique: 'Reentrancy', targetType: 'Options', chains: ['ethereum'], sourceUrl: 'https://rekt.news/siren-rekt/' },
  { name: 'Radiant Capital', date: '2024-01-02', amountLost: 4_500_000, technique: 'Flash Loan Attack', targetType: 'Lending', chains: ['arbitrum'], sourceUrl: 'https://rekt.news/radiant-capital-rekt/' },
  { name: 'Socket', date: '2024-01-16', amountLost: 3_300_000, technique: 'Access Control', targetType: 'Bridge', chains: ['ethereum'], sourceUrl: 'https://rekt.news/socket-rekt/' },
  { name: 'Abracadabra', date: '2024-01-30', amountLost: 6_500_000, technique: 'Rounding Error', targetType: 'Lending', chains: ['ethereum'], sourceUrl: 'https://rekt.news/abracadabra-rekt-2/' },
  { name: 'Gamma Strategies', date: '2024-01-04', amountLost: 6_200_000, technique: 'Price Manipulation', targetType: 'Yield', chains: ['arbitrum'], sourceUrl: 'https://rekt.news/gamma-strategies-rekt/' },
  { name: 'Orbit Chain', date: '2024-01-01', amountLost: 81_500_000, technique: 'Admin Key Compromise', targetType: 'Bridge', chains: ['ethereum'], sourceUrl: 'https://rekt.news/orbit-chain-rekt/' },
  { name: 'Seneca Protocol', date: '2024-02-28', amountLost: 6_400_000, technique: 'Access Control', targetType: 'Lending', chains: ['ethereum', 'arbitrum'], sourceUrl: 'https://rekt.news/seneca-rekt/' },
  { name: 'Blueberry Protocol', date: '2024-02-22', amountLost: 1_350_000, technique: 'Oracle Manipulation', targetType: 'Lending', chains: ['ethereum'], sourceUrl: 'https://rekt.news/blueberry-rekt/' },
  { name: 'Prisma Finance', date: '2024-03-28', amountLost: 11_600_000, technique: 'Flash Loan Attack', targetType: 'Lending', chains: ['ethereum'], sourceUrl: 'https://rekt.news/prisma-finance-rekt/' },
  { name: 'Hedgey Finance', date: '2024-04-19', amountLost: 44_700_000, technique: 'Access Control', targetType: 'Vesting', chains: ['ethereum', 'arbitrum'], sourceUrl: 'https://rekt.news/hedgey-rekt/' },
];

function buildRektEntries(): RawHack[] {
  return REKT_TOP_HACKS.map(h => ({
    id: slugify(`${h.name!}-${h.date!}`),
    name: h.name!,
    date: h.date!,
    amountLost: h.amountLost!,
    returnedFunds: 0,
    chains: h.chains ?? [],
    classification: '',
    technique: h.technique ?? '',
    targetType: h.targetType ?? '',
    language: 'Solidity',
    bridgeHack: (h.targetType ?? '').toLowerCase().includes('bridge'),
    sourceUrl: h.sourceUrl ?? '',
    defillamaId: null,
    vulnType: classifyVulnerability(h.technique ?? '', '', h.name!),
    source: 'rekt' as const,
  }));
}

// ── Deduplication ──

function deduplicateHacks(hacks: RawHack[]): RawHack[] {
  const seen = new Map<string, RawHack>();

  for (const hack of hacks) {
    // Generate a matching key from name + approximate date
    const nameKey = hack.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const monthKey = hack.date.slice(0, 7); // YYYY-MM
    const dedupeKey = `${nameKey}-${monthKey}`;

    const existing = seen.get(dedupeKey);
    if (existing) {
      // Merge: prefer DeFiLlama data but supplement with rekt.news
      if (!existing.sourceUrl && hack.sourceUrl) {
        existing.sourceUrl = hack.sourceUrl;
      }
      if (!existing.technique && hack.technique) {
        existing.technique = hack.technique;
        existing.vulnType = classifyVulnerability(hack.technique, hack.classification, hack.name);
      }
      if (existing.chains.length === 0 && hack.chains.length > 0) {
        existing.chains = hack.chains;
      }
      if (!existing.targetType && hack.targetType) {
        existing.targetType = hack.targetType;
      }
      // Keep higher amount
      if (hack.amountLost > existing.amountLost) {
        existing.amountLost = hack.amountLost;
      }
    } else {
      seen.set(dedupeKey, { ...hack });
    }
  }

  return Array.from(seen.values());
}

// ── Main ──

async function main() {
  const minAmount = parseInt(process.argv.find(a => a.startsWith('--min-amount='))?.split('=')[1] ?? '500000', 10);

  console.log(`[build-hack-db] Building hack database (min amount: $${minAmount.toLocaleString()})...`);

  // Fetch from DeFiLlama
  let defillamaHacks: RawHack[] = [];
  try {
    defillamaHacks = await fetchDeFiLlamaHacks();
  } catch (err) {
    console.error(`[build-hack-db] DeFiLlama fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Build rekt.news supplemental entries
  const rektHacks = buildRektEntries();

  // Merge all sources
  const allHacks = [...defillamaHacks, ...rektHacks];
  console.log(`[build-hack-db] Total raw entries: ${allHacks.length}`);

  // Deduplicate
  const deduplicated = deduplicateHacks(allHacks);
  console.log(`[build-hack-db] After dedup: ${deduplicated.length}`);

  // Filter by minimum amount
  const filtered = deduplicated
    .filter(h => h.amountLost >= minAmount)
    .sort((a, b) => b.amountLost - a.amountLost);

  console.log(`[build-hack-db] After min-amount filter ($${minAmount.toLocaleString()}): ${filtered.length}`);

  // Stats
  const vulnTypeCounts: Record<string, number> = {};
  for (const h of filtered) {
    vulnTypeCounts[h.vulnType] = (vulnTypeCounts[h.vulnType] ?? 0) + 1;
  }
  console.log('\n[build-hack-db] Vulnerability type distribution:');
  for (const [type, count] of Object.entries(vulnTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  const totalLost = filtered.reduce((sum, h) => sum + h.amountLost, 0);
  console.log(`\n[build-hack-db] Total value lost: $${(totalLost / 1e9).toFixed(2)}B`);

  // Write output
  const outPath = resolve(__dirname, '../data/raw-hacks.json');
  writeFileSync(outPath, JSON.stringify(filtered, null, 2));
  console.log(`\n[build-hack-db] Wrote ${filtered.length} hacks to ${outPath}`);
}

main().catch(err => {
  console.error('[build-hack-db] Fatal error:', err);
  process.exit(1);
});
