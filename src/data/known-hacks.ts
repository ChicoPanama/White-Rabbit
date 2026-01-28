/**
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

const MANUAL_HACKS: KnownHack[] = [
  // ── Reentrancy Exploits ──
  {
    id: 'cream-reentrancy-2021',
    name: 'Cream Finance Reentrancy',
    date: '2021-08-30',
    amountLost: 18_800_000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Missing reentrancy guard on borrow() allowing re-entry during token transfer callback',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth'],
      codePatterns: [
        /function\s+borrow\s*\([^)]*\)[^{]*\{(?![\s\S]*nonReentrant)/,
        /function\s+borrow(?:Fresh|Internal)\s*\([^)]*\)[^{]*\{[\s\S]*?\.transfer\(/,
      ],
      nameKeywords: ['cream', 'lending', 'compound', 'ctoken', 'cerc20'],
    },
    patch: {
      description: 'Added nonReentrant modifier to borrow()',
      codePatterns: [
        /function\s+borrow\s*\([^)]*\)[^{]*nonReentrant/,
      ],
    },
    sources: ['https://rekt.news/cream-rekt-2/'],
  },
  {
    id: 'vyper-curve-reentrancy-2023',
    name: 'Vyper Curve Pool Reentrancy',
    date: '2023-07-30',
    amountLost: 70_000_000,
    vulnerability: {
      type: 'compiler-bug',
      description: 'Vyper compiler bug in versions <0.3.9 broke cross-function reentrancy locks on pools',
      detectors: ['reentrancy-eth'],
      codePatterns: [
        /@version\s+0\.([0-2]\.|3\.[0-8]\b)/,
      ],
      nameKeywords: ['curve', 'pool', 'vyper', 'stableswap'],
    },
    patch: {
      description: 'Upgrade to Vyper >=0.3.9',
      codePatterns: [
        /@version\s+0\.(3\.(9|[1-9]\d)|[4-9]\.)/,
      ],
    },
    sources: ['https://rekt.news/curve-vyper-rekt/'],
  },
  {
    id: 'siren-reentrancy-2021',
    name: 'Siren Protocol Reentrancy',
    date: '2021-09-04',
    amountLost: 3_500_000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Missing reentrancy guard on claimCollateral() with ERC777 callback',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth'],
      codePatterns: [
        /function\s+claimCollateral\s*\([^)]*\)[^{]*\{(?![\s\S]*nonReentrant)/,
        /function\s+exerciseOption\s*\([^)]*\)[^{]*\{[\s\S]*?\.transfer\(/,
      ],
      nameKeywords: ['siren', 'option', 'amm'],
    },
    patch: {
      description: 'Added nonReentrant modifier to collateral functions',
      codePatterns: [
        /function\s+claimCollateral\s*\([^)]*\)[^{]*nonReentrant/,
      ],
    },
    sources: ['https://rekt.news/siren-rekt/'],
  },
  {
    id: 'read-only-reentrancy-2023',
    name: 'Read-Only Reentrancy (Balancer/Euler pattern)',
    date: '2023-01-12',
    amountLost: 11_600_000,
    vulnerability: {
      type: 'reentrancy',
      description: 'View functions return stale values during reentrancy, enabling price manipulation via flash loan',
      detectors: ['reentrancy-no-eth', 'reentrancy-benign'],
      codePatterns: [
        /function\s+getRate\s*\([^)]*\)\s+(?:external|public)\s+view/,
        /function\s+get(?:Virtual)?Price\s*\([^)]*\)\s+(?:external|public)\s+view/,
      ],
      nameKeywords: ['balancer', 'pool', 'vault', 'rate', 'oracle'],
    },
    patch: {
      description: 'Added reentrancy check on view functions or used ensureNotInVaultContext()',
      codePatterns: [
        /ensureNotInVaultContext|_ensureNotReentrant|nonReentrantView/,
      ],
    },
    sources: ['https://rekt.news/balancer-rekt/'],
  },

  // ── Oracle Manipulation ──
  {
    id: 'harvest-oracle-2020',
    name: 'Harvest Finance Oracle Manipulation',
    date: '2020-10-26',
    amountLost: 34_000_000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Used spot price from Curve pool as oracle, vulnerable to flash loan manipulation',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        /\.get_virtual_price\(\)/,
        /function\s+(?:get|calc)PricePerFullShare\s*\(/,
        /Curve.*\.get_dy\(/,
      ],
      nameKeywords: ['harvest', 'vault', 'strategy', 'farm'],
    },
    patch: {
      description: 'Use TWAP oracle instead of spot price',
      codePatterns: [
        /TWAP|twap|timeWeightedAverage|observe\s*\(|IUniswapV3Pool.*observe/,
      ],
    },
    sources: ['https://rekt.news/harvest-finance-rekt/'],
  },
  {
    id: 'bonq-oracle-2023',
    name: 'BonqDAO Oracle Manipulation',
    date: '2023-02-01',
    amountLost: 120_000_000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Allowed anyone to update oracle price with minimal collateral via Tellor',
      detectors: ['oracle-manipulation'],
      codePatterns: [
        /function\s+updatePrice\s*\([^)]*\)[^{]*\{(?![\s\S]*onlyRole)/,
        /function\s+submitValue\s*\([^)]*\)\s+(?:external|public)(?![\s\S]*stake)/,
      ],
      nameKeywords: ['bonq', 'trove', 'tellor', 'cdp'],
    },
    patch: {
      description: 'Added price deviation checks and minimum stake requirements',
      codePatterns: [
        /priceDeviation|maxPriceChange|minStake|disputePeriod/,
      ],
    },
    sources: ['https://rekt.news/bonq-rekt/'],
  },
  {
    id: 'mango-markets-oracle-2022',
    name: 'Mango Markets Oracle Manipulation',
    date: '2022-10-11',
    amountLost: 114_000_000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Manipulated thin-liquidity perpetual market price to inflate collateral value',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        /function\s+updateIndex\s*\([^)]*\)\s+(?:external|public)(?![\s\S]*onlyOracle)/,
        /function\s+(?:deposit|borrow)\s*\([^)]*\)[\s\S]*?getOraclePrice/,
      ],
      nameKeywords: ['mango', 'perp', 'perpetual', 'margin'],
    },
    patch: {
      description: 'Added oracle staleness checks and price impact limits',
      codePatterns: [
        /oracleConfidence|maxDeviation|impactLimit|stalenessTolerance/,
      ],
    },
    sources: ['https://rekt.news/mango-markets-rekt/'],
  },

  // ── Flash Loan Attacks ──
  {
    id: 'pancakebunny-flashloan-2021',
    name: 'PancakeBunny Flash Loan',
    date: '2021-05-20',
    amountLost: 45_000_000,
    vulnerability: {
      type: 'flash-loan',
      description: 'Used AMM spot price to calculate mint amount, manipulable via flash loan',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        /function\s+(?:getReward|mint)\s*\([^)]*\)[\s\S]*?getAmountOut/,
        /function\s+(?:deposit|stake)\s*\([^)]*\)[\s\S]*?balanceOf\([^)]*\)\s*[*/]/,
      ],
      nameKeywords: ['bunny', 'vault', 'farm', 'pancake', 'reward'],
    },
    patch: {
      description: 'Use TWAP or Chainlink for price feeds, add flash loan protection',
      codePatterns: [
        /flashLoanGuard|blockNumber\s*!=|lastDepositBlock/,
      ],
    },
    sources: ['https://rekt.news/pancakebunny-rekt/'],
  },
  {
    id: 'xtoken-flashloan-2021',
    name: 'xToken Flash Loan',
    date: '2021-05-12',
    amountLost: 24_500_000,
    vulnerability: {
      type: 'flash-loan',
      description: 'Governance token price manipulated via flash loan to drain treasury',
      detectors: ['price-manipulation'],
      codePatterns: [
        /function\s+mint\s*\([^)]*\)[\s\S]*?balanceOf\([^)]*\)\s*\//,
        /function\s+getNav\s*\([^)]*\)[\s\S]*?\.balanceOf\(/,
      ],
      nameKeywords: ['xtoken', 'xsnx', 'xaave', 'xbnt'],
    },
    patch: {
      description: 'Use time-weighted oracle for NAV calculation',
      codePatterns: [
        /TWAP|oraclePrice|chainlinkPrice/,
      ],
    },
    sources: ['https://rekt.news/xtoken-rekt/'],
  },

  // ── Access Control Exploits ──
  {
    id: 'ronin-access-control-2022',
    name: 'Ronin Bridge Access Control',
    date: '2022-03-23',
    amountLost: 624_000_000,
    vulnerability: {
      type: 'access-control',
      description: 'Bridge validator threshold too low, compromised keys could sign withdrawals',
      detectors: ['missing-zero-check', 'unprotected-upgrade'],
      codePatterns: [
        /function\s+(?:withdraw|bridge)\s*\([^)]*\)[\s\S]*?threshold\s*<=\s*\d/,
        /require\s*\(\s*signatures\.length\s*>=\s*(?:3|4|5)\b/,
      ],
      nameKeywords: ['bridge', 'validator', 'multisig', 'ronin'],
    },
    patch: {
      description: 'Increased validator threshold and added timelock',
      codePatterns: [
        /threshold\s*>=\s*(?:7|8|9|\d{2})/,
        /timelock|TimelockController/,
      ],
    },
    sources: ['https://rekt.news/ronin-rekt/'],
  },
  {
    id: 'beanstalk-governance-2022',
    name: 'Beanstalk Governance Attack',
    date: '2022-04-17',
    amountLost: 181_000_000,
    vulnerability: {
      type: 'access-control',
      description: 'Flash loan used to gain instant governance majority and pass malicious proposal',
      detectors: ['price-manipulation'],
      codePatterns: [
        /function\s+(?:propose|vote)\s*\([^)]*\)[\s\S]*?balanceOf/,
        /function\s+(?:execute|emergencyCommit)\s*\([^)]*\)[^{]*\{(?![\s\S]*timelock)/,
      ],
      nameKeywords: ['beanstalk', 'governance', 'silo', 'stalk'],
    },
    patch: {
      description: 'Added timelock and snapshot-based voting (prevent flash loan governance)',
      codePatterns: [
        /snapshotBlock|votingDelay\s*>\s*0|_snapshot|timelock/,
      ],
    },
    sources: ['https://rekt.news/beanstalk-rekt/'],
  },
  {
    id: 'wintermute-vanity-2022',
    name: 'Wintermute Vanity Address',
    date: '2022-09-20',
    amountLost: 160_000_000,
    vulnerability: {
      type: 'access-control',
      description: 'Admin address generated with Profanity vanity tool, vulnerable to brute-force key recovery',
      detectors: ['missing-zero-check'],
      codePatterns: [
        /0x0000000[0-9a-f]{33}/i,
      ],
      nameKeywords: ['wintermute', 'market', 'maker'],
    },
    patch: {
      description: 'Rotated to non-vanity admin address',
      codePatterns: [
        /onlyOwner|AccessControl/,
      ],
    },
    sources: ['https://rekt.news/wintermute-rekt/'],
  },

  // ── Donation/Inflation Attacks ──
  {
    id: 'euler-donation-2023',
    name: 'Euler Finance Donation Attack',
    date: '2023-03-13',
    amountLost: 197_000_000,
    vulnerability: {
      type: 'donation-attack',
      description: 'Missing health check after donateToReserves, allowing self-liquidation at profit',
      detectors: ['unchecked-transfer', 'reentrancy-no-eth'],
      codePatterns: [
        /function\s+donateToReserves?\s*\([^)]*\)[^{]*\{(?![\s\S]*checkHealth|checkLiquidity)/,
        /function\s+donate\s*\([^)]*\)\s+(?:external|public)(?![\s\S]*checkHealth)/,
      ],
      nameKeywords: ['euler', 'lending', 'etoken', 'dtoken'],
    },
    patch: {
      description: 'Added health check after donation',
      codePatterns: [
        /donateToReserves[\s\S]*?check(?:Health|Liquidity|Account)/,
        /function\s+donateToReserves[\s\S]*?require\s*\(\s*isHealthy/,
      ],
    },
    sources: ['https://rekt.news/euler-rekt/'],
  },
  {
    id: 'erc4626-inflation-2023',
    name: 'ERC-4626 Vault Inflation Attack',
    date: '2023-01-15',
    amountLost: 11_000_000,
    vulnerability: {
      type: 'donation-attack',
      description: 'First depositor inflates share price by donating to empty vault, stealing from subsequent depositors',
      detectors: ['unchecked-transfer'],
      codePatterns: [
        /function\s+deposit\s*\([^)]*\)[\s\S]*?totalSupply\s*==\s*0/,
        /function\s+convertToShares\s*\([^)]*\)[\s\S]*?totalSupply[^}]*totalAssets/,
      ],
      nameKeywords: ['vault', 'erc4626', 'shares', 'deposit'],
    },
    patch: {
      description: 'Use virtual shares/assets offset (OpenZeppelin pattern) or enforce minimum deposit',
      codePatterns: [
        /_decimalsOffset|virtualAssets|virtualShares|_initialConvertToShares/,
        /require\s*\([^)]*shares\s*>=?\s*MIN_SHARES/,
      ],
    },
    sources: ['https://blog.openzeppelin.com/a-]novel-defense-against-erc4626-inflation-attacks'],
  },

  // ── Upgrade Vulnerabilities ──
  {
    id: 'wormhole-uninitialized-2022',
    name: 'Wormhole Bridge Uninitialized Proxy',
    date: '2022-02-02',
    amountLost: 326_000_000,
    vulnerability: {
      type: 'upgrade-vulnerability',
      description: 'Implementation contract not initialized, allowing attacker to call initialize() and take ownership',
      detectors: ['unprotected-upgrade', 'uninitialized-state'],
      codePatterns: [
        /function\s+initialize\s*\([^)]*\)\s+(?:external|public)(?![\s\S]*initializer)/,
        /implementation\(\)[\s\S]*?\.initialize\(/,
      ],
      nameKeywords: ['wormhole', 'bridge', 'guardian', 'proxy'],
    },
    patch: {
      description: 'Added initializer modifier and called _disableInitializers() in constructor',
      codePatterns: [
        /constructor\s*\([^)]*\)[^{]*\{[\s\S]*?_disableInitializers/,
        /function\s+initialize\s*\([^)]*\)[^{]*initializer/,
      ],
    },
    sources: ['https://rekt.news/wormhole-rekt/'],
  },
  {
    id: 'audius-proxy-2022',
    name: 'Audius Governance Proxy',
    date: '2022-07-24',
    amountLost: 6_000_000,
    vulnerability: {
      type: 'upgrade-vulnerability',
      description: 'Governance proxy allowed re-initialization, enabling attacker to take over governance',
      detectors: ['unprotected-upgrade', 'uninitialized-state'],
      codePatterns: [
        /function\s+initialize\s*\([^)]*\)\s+(?:external|public)(?![\s\S]*(?:initializer|initialized))/,
      ],
      nameKeywords: ['audius', 'governance', 'staking', 'proxy'],
    },
    patch: {
      description: 'Added proper initialization guard',
      codePatterns: [
        /initializer|initialized\s*==\s*true|require\s*\(!initialized\)/,
      ],
    },
    sources: ['https://rekt.news/audius-rekt/'],
  },

  // ── Price Manipulation ──
  {
    id: 'platypus-2023',
    name: 'Platypus Finance',
    date: '2023-02-16',
    amountLost: 8_500_000,
    vulnerability: {
      type: 'logic-error',
      description: 'emergencyWithdraw did not check borrow position, allowing withdrawal without repaying debt',
      detectors: ['unchecked-transfer', 'reentrancy-no-eth'],
      codePatterns: [
        /function\s+emergencyWithdraw\s*\([^)]*\)[^{]*\{(?![\s\S]*(?:borrowBalance|debtOf|checkBorrow))/,
      ],
      nameKeywords: ['platypus', 'stableswap', 'masterplatypus'],
    },
    patch: {
      description: 'Added borrow balance check to emergencyWithdraw',
      codePatterns: [
        /function\s+emergencyWithdraw[\s\S]*?(?:borrowBalance|debtOf|isBorrowing)/,
      ],
    },
    sources: ['https://rekt.news/platypus-rekt/'],
  },
  {
    id: 'level-finance-2023',
    name: 'Level Finance Referral Exploit',
    date: '2023-05-01',
    amountLost: 1_100_000,
    vulnerability: {
      type: 'logic-error',
      description: 'Referral reward claiming had no deduplication, allowing repeated claims for same referral',
      detectors: ['reentrancy-no-eth'],
      codePatterns: [
        /function\s+claim(?:Reward|Referral)\s*\([^)]*\)[^{]*\{(?![\s\S]*claimed\[)/,
        /function\s+claimMultiple\s*\([^)]*\)[\s\S]*?\.transfer\(/,
      ],
      nameKeywords: ['level', 'referral', 'reward', 'perp'],
    },
    patch: {
      description: 'Added claimed mapping to prevent double-claims',
      codePatterns: [
        /claimed\s*\[[\s\S]*?\]\s*=\s*true/,
        /require\s*\(\s*!claimed\s*\[/,
      ],
    },
    sources: ['https://rekt.news/level-finance-rekt/'],
  },

  // ── Unchecked Return Values ──
  {
    id: 'defrost-unchecked-2022',
    name: 'Defrost Finance',
    date: '2022-12-25',
    amountLost: 12_000_000,
    vulnerability: {
      type: 'access-control',
      description: 'Owner could add fake collateral token via privileged function, then drain real assets',
      detectors: ['arbitrary-send-eth', 'controlled-delegatecall'],
      codePatterns: [
        /function\s+addCollateral\s*\([^)]*\)\s+(?:external|public)\s+onlyOwner/,
        /function\s+(?:setOracle|addToken)\s*\([^)]*\)\s+(?:external|public)\s+onlyOwner/,
      ],
      nameKeywords: ['defrost', 'collateral', 'vault', 'cdp'],
    },
    patch: {
      description: 'Added timelock and multisig for admin functions; token whitelist',
      codePatterns: [
        /timelock|TimelockController|onlyMultisig/,
      ],
    },
    sources: ['https://rekt.news/defrost-rekt/'],
  },

  // ── Signature Replay ──
  {
    id: 'li-fi-2022',
    name: 'Li.Fi Bridge Arbitrary Call',
    date: '2022-03-20',
    amountLost: 600_000,
    vulnerability: {
      type: 'logic-error',
      description: 'Bridge contract allowed arbitrary external calls via user-controlled calldata',
      detectors: ['controlled-delegatecall', 'arbitrary-send-eth'],
      codePatterns: [
        /\.call\{value:\s*\w+\}\s*\(\s*(?:_callData|callData|data)\s*\)/,
        /function\s+swap\w*\s*\([^)]*\)[\s\S]*?\.call\(/,
      ],
      nameKeywords: ['lifi', 'bridge', 'swap', 'aggregator', 'router'],
    },
    patch: {
      description: 'Added whitelist for allowed call targets and function selectors',
      codePatterns: [
        /allowedTargets|whitelistedSelectors|isAllowedAddress/,
      ],
    },
    sources: ['https://rekt.news/lifi-rekt/'],
  },

  // ── Rounding Errors ──
  {
    id: 'hundred-finance-2023',
    name: 'Hundred Finance Rounding',
    date: '2023-04-15',
    amountLost: 7_400_000,
    vulnerability: {
      type: 'rounding-error',
      description: 'Empty market with zero totalSupply allowed inflating exchange rate via donation + borrow loop',
      detectors: ['unchecked-transfer'],
      codePatterns: [
        /exchangeRate[\s\S]*?totalSupply\s*==\s*0/,
        /function\s+exchangeRateStored\s*\([^)]*\)[\s\S]*?totalSupply[^}]*cash/,
      ],
      nameKeywords: ['hundred', 'compound', 'ctoken', 'htoken'],
    },
    patch: {
      description: 'Added minimum supply check and exchange rate floor',
      codePatterns: [
        /initialExchangeRate|MIN_SUPPLY|require\s*\(\s*totalSupply\s*>/,
      ],
    },
    sources: ['https://rekt.news/hundred-finance-rekt/'],
  },

  // ── More Major Hacks ──
  {
    id: 'nomad-bridge-2022',
    name: 'Nomad Bridge Verification Bypass',
    date: '2022-08-01',
    amountLost: 190_000_000,
    vulnerability: {
      type: 'logic-error',
      description: 'Faulty upgrade set zero hash as trusted root, allowing anyone to prove arbitrary messages',
      detectors: ['unprotected-upgrade'],
      codePatterns: [
        /function\s+process\s*\([^)]*\)[\s\S]*?acceptableRoot\s*\(/,
        /confirmAt\s*\[\s*0x0+\s*\]/,
      ],
      nameKeywords: ['nomad', 'bridge', 'replica', 'message'],
    },
    patch: {
      description: 'Added zero-hash exclusion and proper root validation',
      codePatterns: [
        /require\s*\(\s*_root\s*!=\s*0|bytes32\(0\)/,
      ],
    },
    sources: ['https://rekt.news/nomad-rekt/'],
  },
  {
    id: 'deus-oracle-2022',
    name: 'Deus Finance Oracle',
    date: '2022-04-28',
    amountLost: 13_400_000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Used single-block spot price from pair as oracle, flash-loan manipulable',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        /IUniswapV2Pair\([^)]*\)\.getReserves\(\)/,
        /reserve[01]\s*[*/]\s*(?:1e\d+|10\s*\*\*)/,
      ],
      nameKeywords: ['deus', 'dei', 'oracle', 'lender'],
    },
    patch: {
      description: 'Use TWAP oracle or Chainlink price feed',
      codePatterns: [
        /TWAP|twap|observe\(|AggregatorV3Interface/,
      ],
    },
    sources: ['https://rekt.news/deus-dao-rekt-2/'],
  },
  {
    id: 'sentiment-reentrancy-2023',
    name: 'Sentiment Protocol Reentrancy',
    date: '2023-04-04',
    amountLost: 1_000_000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Read-only reentrancy via Balancer vault callback allowed oracle manipulation',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth'],
      codePatterns: [
        /IBalancerVault.*join|exit.*Pool/,
        /function\s+get(?:Rate|Price)\s*\([^)]*\)\s+(?:external|public)\s+view/,
      ],
      nameKeywords: ['sentiment', 'lending', 'account', 'balancer'],
    },
    patch: {
      description: 'Added reentrancy check before reading Balancer pool rates',
      codePatterns: [
        /ensureNotInVaultContext|checkReentrancy.*balancer/i,
      ],
    },
    sources: ['https://rekt.news/sentiment-rekt/'],
  },
  {
    id: 'safemoon-burn-2023',
    name: 'SafeMoon Burn Exploit',
    date: '2023-03-28',
    amountLost: 8_900_000,
    vulnerability: {
      type: 'access-control',
      description: 'Public burn function allowed burning LP tokens directly from pair contract, manipulating price',
      detectors: ['arbitrary-send-eth'],
      codePatterns: [
        /function\s+burn\s*\(\s*address\s+\w+\s*,\s*uint256\s+\w+\s*\)\s+(?:external|public)(?![\s\S]*onlyOwner)/,
        /function\s+burn\s*\([^)]*\)[^{]*\{(?![\s\S]*msg\.sender\s*==)/,
      ],
      nameKeywords: ['safemoon', 'token', 'burn', 'reflect'],
    },
    patch: {
      description: 'Restricted burn to msg.sender only (can only burn own tokens)',
      codePatterns: [
        /function\s+burn\s*\([^)]*\)[\s\S]*?_burn\s*\(\s*msg\.sender/,
        /require\s*\(\s*from\s*==\s*msg\.sender/,
      ],
    },
    sources: ['https://rekt.news/safemoon-rekt/'],
  },
  {
    id: 'multichain-access-2023',
    name: 'Multichain Bridge Compromise',
    date: '2023-07-07',
    amountLost: 126_000_000,
    vulnerability: {
      type: 'access-control',
      description: 'Centralized MPC key management allowed extraction of bridge funds',
      detectors: ['arbitrary-send-eth'],
      codePatterns: [
        /function\s+anySwapOut\s*\([^)]*\)\s+(?:external|public)/,
        /function\s+(?:transferOut|bridgeOut)\s*\([^)]*\)[\s\S]*?onlyMPC/,
      ],
      nameKeywords: ['multichain', 'anyswap', 'bridge', 'router'],
    },
    patch: {
      description: 'Decentralized key management with threshold signatures',
      codePatterns: [
        /threshold\s*>=\s*\d{2}|decentralized.*key/i,
      ],
    },
    sources: ['https://rekt.news/multichain-rekt/'],
  },
  {
    id: 'kyberswap-precision-2023',
    name: 'KyberSwap Elastic Precision',
    date: '2023-11-22',
    amountLost: 48_800_000,
    vulnerability: {
      type: 'rounding-error',
      description: 'Tick boundary precision issue in concentrated liquidity pool allowed double-counting liquidity',
      detectors: ['price-manipulation'],
      codePatterns: [
        /function\s+swap\s*\([^)]*\)[\s\S]*?cross(?:Tick|Step)/,
        /sqrtPrice.*nextTick|computeSwapStep/,
      ],
      nameKeywords: ['kyber', 'elastic', 'concentrated', 'tick'],
    },
    patch: {
      description: 'Fixed tick crossing boundary condition and liquidity accounting',
      codePatterns: [
        /crossTick[\s\S]*?(?:require|assert)\s*\(\s*liquidity/,
      ],
    },
    sources: ['https://rekt.news/kyberswap-elastic-rekt/'],
  },
];

// ════════════════════════════════════════════════════════════════
// AUTO-GENERATED ENTRIES — from DeFiLlama + AI pattern extraction
// Re-generated by: npm run build:hacks
// ════════════════════════════════════════════════════════════════

const GENERATED_HACKS: KnownHack[] = [
  {
    id: 'lubian-2020-12-28',
    name: 'LuBian',
    date: '2020-12-28',
    amountLost: 3500000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Brute Force) exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lubian', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/arkham/status/1951729790299394113'],
  },
  {
    id: 'bybit-2025-02-21',
    name: 'Bybit',
    date: '2025-02-21',
    amountLost: 1400000000,
    vulnerability: {
      type: 'access-control',
      description: 'Safe Multisig wallet Phishing Exploit exploit on CEX',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bybit', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/benbybit/status/1892963530422505586'],
  },
  {
    id: 'ronin-bridge-2022-03-23',
    name: 'Ronin Bridge',
    date: '2022-03-23',
    amountLost: 624000000,
    vulnerability: {
      type: 'access-control',
      description: 'Private Key Compromised (Social Engineering) exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ronin', 'bridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://roninblockchain.substack.com/p/back-to-building-ronin-security-breach'],
  },
  {
    id: 'ronin-network-2022-03-23',
    name: 'Ronin Network',
    date: '2022-03-23',
    amountLost: 624000000,
    vulnerability: {
      type: 'access-control',
      description: 'Admin Key Compromise exploit on Bridge',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ronin', 'network', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/ronin-rekt/'],
  },
  {
    id: 'poly-network-2021-08-10',
    name: 'Poly Network',
    date: '2021-08-10',
    amountLost: 611000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['poly', 'network', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://slowmist.medium.com/the-root-cause-of-poly-network-being-hacked-ec2ee1b0c68f'],
  },
  {
    id: 'bnb-bridge-2022-10-07',
    name: 'BNB Bridge',
    date: '2022-10-07',
    amountLost: 586000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Logic Error exploit on Bridge',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bnb', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/bnb-bridge-rekt/'],
  },
  {
    id: 'binance-bridge-2022-10-06',
    name: 'Binance Bridge',
    date: '2022-10-06',
    amountLost: 570000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Proof Verifier Bug exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['binance', 'bridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/samczsun/status/1578167198203289600'],
  },
  {
    id: 'coincheck-2018-01-26',
    name: 'Coincheck',
    date: '2018-01-26',
    amountLost: 534000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['coincheck', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.bbc.com/news/world-asia-42845505'],
  },
  {
    id: 'ftx-2022-11-12',
    name: 'FTX',
    date: '2022-11-12',
    amountLost: 450000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ftx', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/zachxbt/status/1591475246250733568?s=20&t=jbwCEhQZKfWFnLPtCwErAg'],
  },
  {
    id: 'portal-2022-02-02',
    name: 'Portal',
    date: '2022-02-02',
    amountLost: 326000000,
    vulnerability: {
      type: 'signature-replay',
      description: 'Signature Exploit exploit on DeFi Protocol',
      detectors: ['tx-origin', 'missing-zero-check'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['portal', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/samczsun/status/1489044939732406275?s=20&t=kfhTtvHGRyDbj-2P7f_hpA'],
  },
  {
    id: 'wormhole-2022-02-02',
    name: 'Wormhole',
    date: '2022-02-02',
    amountLost: 326000000,
    vulnerability: {
      type: 'upgrade-vulnerability',
      description: 'Uninitialized Proxy exploit on Bridge',
      detectors: ['unprotected-upgrade', 'uninitialized-state'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['wormhole', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/wormhole-rekt/'],
  },
  {
    id: 'dmm-bitcoin-2024-05-31',
    name: 'DMM Bitcoin',
    date: '2024-05-31',
    amountLost: 305000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dmm', 'bitcoin', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Cointelegraph/status/1796544899606524310'],
  },
  {
    id: 'parity-wallet-2017-11-06',
    name: 'Parity Wallet',
    date: '2017-11-06',
    amountLost: 281000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control exploit on Wallet',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['parity', 'wallet'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/parity-rekt/'],
  },
  {
    id: 'gate-2018-04-21',
    name: 'Gate',
    date: '2018-04-21',
    amountLost: 235000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gate', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.justice.gov/opa/press-release/file/1253491/download'],
  },
  {
    id: 'wazirx-india-2024-07-18',
    name: 'WazirX: India',
    date: '2024-07-18',
    amountLost: 234900000,
    vulnerability: {
      type: 'access-control',
      description: 'Safe Multisig wallet Phishing Exploit exploit on CEX',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['wazirx', 'india', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1813834131165286464'],
  },
  {
    id: 'cetus-clmm-2025-05-22',
    name: 'Cetus CLMM',
    date: '2025-05-22',
    amountLost: 223000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Spoof Token Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cetus', 'clmm', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/markets/2025/05/22/sui-networks-cetus-protocol-hit-in-apparent-hack-sending-token-prices-down-90'],
  },
  {
    id: 'mixin-network-2023-09-23',
    name: 'Mixin Network',
    date: '2023-09-23',
    amountLost: 200000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Database Attack exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['mixin', 'network', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/MixinKernel/status/1706139175018529139'],
  },
  {
    id: 'euler-v1-2023-03-13',
    name: 'Euler V1',
    date: '2023-03-13',
    amountLost: 197000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Donate Function Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['euler', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1635229594596036608?s=20'],
  },
  {
    id: 'euler-finance-2023-03-13',
    name: 'Euler Finance',
    date: '2023-03-13',
    amountLost: 197000000,
    vulnerability: {
      type: 'donation-attack',
      description: 'Donation Attack exploit on Lending',
      detectors: ['unchecked-transfer', 'reentrancy-no-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['euler', 'finance', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/euler-rekt/'],
  },
  {
    id: 'bitmart-2021-12-04',
    name: 'Bitmart',
    date: '2021-12-04',
    amountLost: 196000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bitmart', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/bitmart-rekt/'],
  },
  {
    id: 'nomad-2022-08-01',
    name: 'Nomad',
    date: '2022-08-01',
    amountLost: 190000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Trusted Root Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['nomad', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/samczsun/status/1554252024723546112?s=20&t=mesLZTckBsl_X2_KbGcEHQ'],
  },
  {
    id: 'nomad-bridge-2022-08-01',
    name: 'Nomad Bridge',
    date: '2022-08-01',
    amountLost: 190000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Logic Error exploit on Bridge',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['nomad', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/nomad-rekt/'],
  },
  {
    id: 'beanstalk-2022-04-17',
    name: 'Beanstalk',
    date: '2022-04-17',
    amountLost: 181000000,
    vulnerability: {
      type: 'access-control',
      description: 'Flashloan Governance Attack exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['beanstalk', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1515693895887294466?s=20'],
  },
  {
    id: 'wintermute-2022-09-20',
    name: 'Wintermute',
    date: '2022-09-20',
    amountLost: 160000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Brute Force) exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['wintermute', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://slowmist.medium.com/the-real-cause-of-the-wintermute-exploit-10da7e404b3b'],
  },
  {
    id: 'parity-multisig-2017-11-09',
    name: 'Parity Multisig',
    date: '2017-11-09',
    amountLost: 150000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Contract not initialized exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['parity', 'multisig', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://blog.openzeppelin.com/on-the-parity-wallet-multisig-hack-405a8c12e8f7'],
  },
  {
    id: 'compound-v2-2021-09-29',
    name: 'Compound V2',
    date: '2021-09-29',
    amountLost: 147000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Math Mistake Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['compound', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/compound-rekt/'],
  },
  {
    id: 'vulcan-forged-2021-12-13',
    name: 'Vulcan Forged',
    date: '2021-12-13',
    amountLost: 140000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['vulcan', 'forged', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/vulcan-forged-rekt/'],
  },
  {
    id: 'cream-lending-2021-10-27',
    name: 'CREAM Lending',
    date: '2021-10-27',
    amountLost: 130000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cream', 'lending', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/cream-rekt-2/'],
  },
  {
    id: 'cream-finance-2021-10-27',
    name: 'Cream Finance',
    date: '2021-10-27',
    amountLost: 130000000,
    vulnerability: {
      type: 'flash-loan',
      description: 'Flash Loan Attack exploit on Lending',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cream', 'finance', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/cream-rekt-2/'],
  },
  {
    id: 'balancer-v2-2025-11-03',
    name: 'Balancer V2',
    date: '2025-11-03',
    amountLost: 128000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Composable Stable Pools Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['balancer', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/lookonchain/status/1985258890863501820'],
  },
  {
    id: 'poloniex-2023-11-10',
    name: 'Poloniex',
    date: '2023-11-10',
    amountLost: 126000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['poloniex', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1722931275764474329'],
  },
  {
    id: 'multichain-2023-07-07',
    name: 'Multichain',
    date: '2023-07-07',
    amountLost: 126000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['multichain', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/tayvano_/status/1677106407131475968?t=VKQSi0VcSbv_Jgi8Q58SqQ&s=19'],
  },
  {
    id: 'badger-dao-2021-12-02',
    name: 'Badger DAO',
    date: '2021-12-02',
    amountLost: 120000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Cloudflare Key Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['badger', 'dao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://badger.com/technical-post-mortem'],
  },
  {
    id: 'bonqdao-2023-02-01',
    name: 'BonqDAO',
    date: '2023-02-01',
    amountLost: 120000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bonqdao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1620917292514299904?s=20&t=ZroERzkeCrxy3gHxtboQeA'],
  },
  {
    id: 'mango-markets-v3-2022-10-11',
    name: 'Mango Markets V3',
    date: '2022-10-11',
    amountLost: 115000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['mango', 'markets', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/joshua_j_lim/status/1579987648546246658?s=20&t=AFj8CwRWo5dFo_A1-A-18Q'],
  },
  {
    id: 'mango-markets-2022-10-11',
    name: 'Mango Markets',
    date: '2022-10-11',
    amountLost: 114000000,
    vulnerability: {
      type: 'price-manipulation',
      description: 'Price Manipulation exploit on Perp DEX',
      detectors: ['price-manipulation', 'oracle-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['mango', 'markets', 'perp'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/mango-markets-rekt/'],
  },
  {
    id: 'atomic-wallet-2023-06-03',
    name: 'Atomic Wallet',
    date: '2023-06-03',
    amountLost: 100000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on Wallet',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['atomic', 'wallet'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/tayvano_/status/1668778031790587905?t=ZXAVt7ExhHZcGIzs5ZD33w&s=19'],
  },
  {
    id: 'bitget-2025-04-20',
    name: 'Bitget',
    date: '2025-04-20',
    amountLost: 100000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Market-Making Bot Exploit exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bitget', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/0xDamix/status/1913918706985623945'],
  },
  {
    id: 'harmony-bridge-2022-06-23',
    name: 'Harmony Bridge',
    date: '2022-06-23',
    amountLost: 100000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['harmony', 'bridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/harmony-rekt/'],
  },
  {
    id: 'mirror-2021-10-08',
    name: 'Mirror',
    date: '2021-10-08',
    amountLost: 90000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Outdated Oracle Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['mirror', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FatManTerra/status/1531365988809293825?s=20&t=o8YSLZ0o7gAdHOxdVeuPcg'],
  },
  {
    id: 'heco-bridge-2023-11-22',
    name: 'Heco Bridge',
    date: '2023-11-22',
    amountLost: 86600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['heco', 'bridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/TheBlock__/status/1727397707843621201'],
  },
  {
    id: 'phemex-2025-01-23',
    name: 'Phemex',
    date: '2025-01-23',
    amountLost: 85000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['phemex', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/1882776555312869830'],
  },
  {
    id: 'nobitex-2025-06-18',
    name: 'Nobitex',
    date: '2025-06-18',
    amountLost: 82000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Hot wallet hack exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['nobitex', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/QuillAudits_AI/status/1935237054155444611'],
  },
  {
    id: 'orbit-bridge-2023-12-31',
    name: 'Orbit Bridge',
    date: '2023-12-31',
    amountLost: 81700000,
    vulnerability: {
      type: 'signature-replay',
      description: 'Signature Exploit exploit on DeFi Protocol',
      detectors: ['tx-origin', 'missing-zero-check'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['orbit', 'bridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/cross-chain-protocol-orbit-bridge-suffers-exploit-hack'],
  },
  {
    id: 'orbit-chain-2024-01-01',
    name: 'Orbit Chain',
    date: '2024-01-01',
    amountLost: 81500000,
    vulnerability: {
      type: 'access-control',
      description: 'Admin Key Compromise exploit on Bridge',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['orbit', 'chain', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/orbit-chain-rekt/'],
  },
  {
    id: 'qubit-2022-01-28',
    name: 'Qubit',
    date: '2022-01-28',
    amountLost: 80000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Transfer Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['qubit', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/@QubitFin/protocol-exploit-report-305c34540fa3'],
  },
  {
    id: 'rari-capital-2022-05-01',
    name: 'Rari Capital',
    date: '2022-05-01',
    amountLost: 80000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rari', 'capital', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Hacxyk/status/1520370421773725698?s=20&t=3ZdC2UMcxHaD73SwrcnudQ'],
  },
  {
    id: 'qubit-finance-2022-01-28',
    name: 'Qubit Finance',
    date: '2022-01-28',
    amountLost: 80000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Logic Error exploit on Bridge',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['qubit', 'finance', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/qubit-rekt/'],
  },
  {
    id: 'rari-fei-2022-04-30',
    name: 'Rari/Fei',
    date: '2022-04-30',
    amountLost: 80000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on Lending',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rarifei', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/fei-rari-rekt/'],
  },
  {
    id: 'ascendex-2021-12-11',
    name: 'AscenDEX',
    date: '2021-12-11',
    amountLost: 77000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ascendex', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/ascendex-rekt/'],
  },
  {
    id: 'curve-vyper-2023-07-30',
    name: 'Curve/Vyper',
    date: '2023-07-30',
    amountLost: 70000000,
    vulnerability: {
      type: 'compiler-bug',
      description: 'Compiler Bug exploit on DEX',
      detectors: ['reentrancy-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['curvevyper', 'dex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/curve-vyper-rekt/'],
  },
  {
    id: 'vyper-curve-crv-2023-07-30',
    name: 'Vyper/Curve (CRV)',
    date: '2023-07-30',
    amountLost: 70000000,
    vulnerability: {
      type: 'compiler-bug',
      description: 'Compiler Bug exploit on DEX',
      detectors: ['reentrancy-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['vypercurve', 'crv', 'dex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/curve-vyper-rekt/'],
  },
  {
    id: 'munchables-2024-03-26',
    name: 'Munchables',
    date: '2024-03-26',
    amountLost: 62500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Storage Slot Exploit exploit on Gaming',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['munchables', 'gaming'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/_munchables_/status/1772739713687752761'],
  },
  {
    id: 'curve-dex-2023-07-30',
    name: 'Curve DEX',
    date: '2023-07-30',
    amountLost: 61700000,
    vulnerability: {
      type: 'compiler-bug',
      description: 'Vyper Compiler Bug exploit on DeFi Protocol',
      detectors: ['reentrancy-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['curve', 'dex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/spreekaway/status/1685669149911990273'],
  },
  {
    id: 'alphapo-2023-07-26',
    name: 'AlphaPo',
    date: '2023-07-26',
    amountLost: 60000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['alphapo', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/alphapo-rekt/'],
  },
  {
    id: 'the-dao-2016-06-17',
    name: 'The DAO',
    date: '2016-06-17',
    amountLost: 60000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['the', 'dao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://ogucluturk.medium.com/the-dao-hack-explained-unfortunate-take-off-of-smart-contracts-2bd8c8db3562'],
  },
  {
    id: 'anubisdao-2021-10-29',
    name: 'AnubisDAO',
    date: '2021-10-29',
    amountLost: 60000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['anubisdao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://decrypt.co/84924/anubisdao-investors-lose-60-million-in-alleged-rug-pull'],
  },
  {
    id: 'easyfi-2021-04-19',
    name: 'EasyFi',
    date: '2021-04-19',
    amountLost: 59000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['easyfi', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/easify-network/easyfi-security-incident-pre-post-mortem-33f2942016e9'],
  },
  {
    id: 'uranium-finance-2021-04-28',
    name: 'Uranium Finance',
    date: '2021-04-28',
    amountLost: 57200000,
    vulnerability: {
      type: 'logic-error',
      description: 'Math Mistake Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['uranium', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/uranium-rekt/'],
  },
  {
    id: 'coinex-2023-09-12',
    name: 'CoinEx',
    date: '2023-09-12',
    amountLost: 55000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['coinex', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/tech/2023/09/13/north-korean-attackers-linked-to-54m-coinex-hack-blockchain-data-suggests/'],
  },
  {
    id: 'ooki-2021-11-05',
    name: 'Ooki',
    date: '2021-11-05',
    amountLost: 55000000,
    vulnerability: {
      type: 'access-control',
      description: 'Private Key Compromised (Phishing) exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ooki', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/tidal-finance/bzx-incident-report-e36828347a86'],
  },
  {
    id: 'btcturk-2024-06-22',
    name: 'BtcTurk',
    date: '2024-06-22',
    amountLost: 54000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['btcturk', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/wublockchain/status/1804487593062752260'],
  },
  {
    id: 'radiant-v2-2024-10-16',
    name: 'Radiant V2',
    date: '2024-10-16',
    amountLost: 53000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['radiant', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/AnciliaInc/status/1846618258163761551'],
  },
  {
    id: 'infini-2025-02-24',
    name: 'Infini',
    date: '2025-02-24',
    amountLost: 49500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Dev Privilege Oversight Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['infini', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/peckshieldalert/status/1893874770803851454'],
  },
  {
    id: 'kyberswap-2023-11-22',
    name: 'KyberSwap',
    date: '2023-11-22',
    amountLost: 48800000,
    vulnerability: {
      type: 'rounding-error',
      description: 'Precision Loss exploit on DEX',
      detectors: ['divide-before-multiply', 'unchecked-transfer'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kyberswap', 'dex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/kyberswap-elastic-rekt/'],
  },
  {
    id: 'btcturk-2025-08-14',
    name: 'BtcTurk',
    date: '2025-08-14',
    amountLost: 48000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['btcturk', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1955967877602803929'],
  },
  {
    id: 'kyberswap-elastic-2023-11-22',
    name: 'KyberSwap Elastic',
    date: '2023-11-22',
    amountLost: 48000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Swap Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kyberswap', 'elastic', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/KyberNetwork/status/1727475235342217682'],
  },
  {
    id: 'cashio-2022-03-23',
    name: 'Cashio',
    date: '2022-03-23',
    amountLost: 48000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Collateral Validation Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cashio', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/samczsun/status/1506578902331768832?s=20&t=UL8INfwfJ5hgY7Vq9M3Sbw'],
  },
  {
    id: 'kucoin-2020-09-29',
    name: 'KuCoin',
    date: '2020-09-29',
    amountLost: 45000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kucoin', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/epic-hack-homie/'],
  },
  {
    id: 'bunny-2021-05-19',
    name: 'Bunny',
    date: '2021-05-19',
    amountLost: 45000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bunny', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://peckshield.medium.com/pancakebunny-incident-root-cause-analysis-7099f413cc9b'],
  },
  {
    id: 'pancakebunny-2021-05-20',
    name: 'PancakeBunny',
    date: '2021-05-20',
    amountLost: 45000000,
    vulnerability: {
      type: 'flash-loan',
      description: 'Flash Loan Attack exploit on Yield',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['pancakebunny', 'yield'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/pancakebunny-rekt/'],
  },
  {
    id: 'hedgey-2024-04-19',
    name: 'Hedgey',
    date: '2024-04-19',
    amountLost: 44700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Claim Contract Flashloan Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hedgey', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/hedgeyfinance/status/1781257581488418862'],
  },
  {
    id: 'hedgey-finance-2024-04-19',
    name: 'Hedgey Finance',
    date: '2024-04-19',
    amountLost: 44700000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control exploit on Vesting',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hedgey', 'finance', 'vesting'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/hedgey-rekt/'],
  },
  {
    id: 'coindcx-2025-07-19',
    name: 'CoinDCX',
    date: '2025-07-19',
    amountLost: 44200000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['coindcx', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CryptooIndia/status/1946596846052458548'],
  },
  {
    id: 'bingx-2024-09-20',
    name: 'BingX',
    date: '2024-09-20',
    amountLost: 43300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Hot wallet hack exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bingx', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/OnchainDataNerd/status/1836977341094150398'],
  },
  {
    id: 'gmx-v1-perps-2025-07-09',
    name: 'GMX V1 Perps',
    date: '2025-07-09',
    amountLost: 42000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Re-entrancy Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gmx', 'perps', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/peckshield/status/1942947860645134450'],
  },
  {
    id: 'swissborg-2025-09-09',
    name: 'SwissBorg',
    date: '2025-09-09',
    amountLost: 41500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Third-party API compromise exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['swissborg', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/rishabhsrishi/status/1965115870042263828'],
  },
  {
    id: 'stake-com-2023-09-04',
    name: 'Stake.com',
    date: '2023-09-04',
    amountLost: 41300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['stakecom', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/web3isgreat/status/1698750534025441678'],
  },
  {
    id: 'alpha-finance-2021-02-13',
    name: 'Alpha Finance',
    date: '2021-02-13',
    amountLost: 37500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Pool Shares Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['alpha', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://blog.alphaventuredao.io/alpha-homora-v2-post-mortem/'],
  },
  {
    id: 'coinspaid-2023-07-22',
    name: 'CoinsPaid',
    date: '2023-07-22',
    amountLost: 37300000,
    vulnerability: {
      type: 'access-control',
      description: 'Social Engineering exploit on Other',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['coinspaid', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/coinspaid/status/1684297537010774017'],
  },
  {
    id: 'upbit-2025-11-26',
    name: 'Upbit',
    date: '2025-11-26',
    amountLost: 36000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['upbit', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/layerggofficial/status/1993893233064333343'],
  },
  {
    id: 'harvest-finance-2020-10-26',
    name: 'Harvest Finance',
    date: '2020-10-26',
    amountLost: 34000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['harvest', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/harvest-finance-rekt/'],
  },
  {
    id: 'vee-finance-2021-09-21',
    name: 'Vee Finance',
    date: '2021-09-21',
    amountLost: 34000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['vee', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://veefi.medium.com/vee-finance-attack-analysis-a4839724e085'],
  },
  {
    id: 'crypto-com-2022-01-18',
    name: 'Crypto.com',
    date: '2022-01-18',
    amountLost: 33700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cryptocom', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/cryptocom-rekt/'],
  },
  {
    id: 'meerkat-finance-2021-03-04',
    name: 'Meerkat Finance',
    date: '2021-03-04',
    amountLost: 32000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['meerkat', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/meerkat-finance-bsc-rekt/'],
  },
  {
    id: 'monox-2021-11-30',
    name: 'MonoX',
    date: '2021-11-30',
    amountLost: 31400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Swap Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['monox', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/BlockSecTeam/status/1465690478414761992'],
  },
  {
    id: 'spartan-2021-05-02',
    name: 'Spartan',
    date: '2021-05-02',
    amountLost: 30500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Pool Shares Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['spartan', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://peckshield-94632.medium.com/the-spartan-incident-root-cause-analysis-b14135d3415f'],
  },
  {
    id: 'grim-finance-2021-12-18',
    name: 'Grim Finance',
    date: '2021-12-18',
    amountLost: 30000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['grim', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/RugDocIO/status/1472293717725913089'],
  },
  {
    id: 'deribit-2022-11-01',
    name: 'Deribit',
    date: '2022-11-01',
    amountLost: 28000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['deribit', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/DeribitExchange/status/1587701883778523136'],
  },
  {
    id: 'wintermute-2022-06-05',
    name: 'Wintermute',
    date: '2022-06-05',
    amountLost: 27600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Cross Chain Multisig Deployment Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['wintermute', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://banteg.mirror.xyz/iZAsBNL3j_5NIAY2Erav1r7Q4ecc7SC76AfMjyScs34'],
  },
  {
    id: 'stablemagnet-2021-06-23',
    name: 'StableMagnet',
    date: '2021-06-23',
    amountLost: 27000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts and User Wallets exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['stablemagnet', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/RugDocIO/status/1407830298251964427?s=20&t=ABcGHyHjFWrkOL8Ya2qfKQ'],
  },
  {
    id: 'paid-network-2021-03-05',
    name: 'Paid Network',
    date: '2021-03-05',
    amountLost: 27000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['paid', 'network', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/paid-rekt/'],
  },
  {
    id: 'penpie-2024-09-03',
    name: 'Penpie',
    date: '2024-09-03',
    amountLost: 27000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['penpie', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/shoucccc/status/1831044487323529639'],
  },
  {
    id: 'truebit-2026-01-08',
    name: 'Truebit',
    date: '2026-01-08',
    amountLost: 26400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Bonding Curve Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['truebit', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/2009298780877713715'],
  },
  {
    id: 'huobi-2023-11-22',
    name: 'Huobi',
    date: '2023-11-22',
    amountLost: 26400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['huobi', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/TheBlock__/status/1727397707843621201'],
  },
  {
    id: 'fixedfloat-2024-02-18',
    name: 'FixedFloat',
    date: '2024-02-18',
    amountLost: 26100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['fixedfloat', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/fixed-float-confirms-26m-exploit-bitcoin-ether'],
  },
  {
    id: 'kronos-research-2023-11-18',
    name: 'Kronos Research',
    date: '2023-11-18',
    amountLost: 26000000,
    vulnerability: {
      type: 'logic-error',
      description: 'API Key unauthorized access exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kronos', 'research', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/ResearchKronos/status/1726013733888041376'],
  },
  {
    id: 'thalaswap-2024-11-15',
    name: 'ThalaSwap',
    date: '2024-11-15',
    amountLost: 25500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Liquidity Pool exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['thalaswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/thala-recovers-25-million-exploiter-hacker-caught'],
  },
  {
    id: 'indodax-2024-09-10',
    name: 'Indodax',
    date: '2024-09-10',
    amountLost: 25200000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on CEX',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['indodax', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://news.bitcoin.com/indonesian-crypto-exchange-hit-by-20-5m-hack-lazarus-group-suspected/'],
  },
  {
    id: 'dforce-lending-2020-04-19',
    name: 'dForce Lending',
    date: '2020-04-19',
    amountLost: 25000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dforce', 'lending', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://decrypt.co/26033/dforce-lendfme-defi-hack-25m'],
  },
  {
    id: 'xtoken-2021-05-12',
    name: 'xToken',
    date: '2021-05-12',
    amountLost: 24500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['xtoken', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1392515198674681863?s=20'],
  },
  {
    id: 'sbi-crypto-2025-09-24',
    name: 'SBI Crypto',
    date: '2025-09-24',
    amountLost: 24000000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sbi', 'crypto', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/business/2025/10/01/sbi-crypto-reportedly-hit-by-usd21m-hack-with-suspected-dprk-links'],
  },
  {
    id: 'bald-2023-08-02',
    name: 'Bald',
    date: '2023-08-02',
    amountLost: 23000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Liquidity Pool exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bald', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/1686225428649062400'],
  },
  {
    id: 'bitrue-2023-04-14',
    name: 'Bitrue',
    date: '2023-04-14',
    amountLost: 23000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Hot wallet hack exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bitrue', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/BTCTN/status/1646915702907973632'],
  },
  {
    id: 'elephant-money-2022-04-12',
    name: 'Elephant Money',
    date: '2022-04-12',
    amountLost: 22200000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['elephant', 'money', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/BlockSecTeam/status/1513966074357698563'],
  },
  {
    id: 'gala-2024-05-20',
    name: 'Gala',
    date: '2024-05-20',
    amountLost: 22000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gala', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Thatguysgems/status/1792679865164128743'],
  },
  {
    id: 'pando-rings-2022-11-06',
    name: 'Pando Rings',
    date: '2022-11-06',
    amountLost: 22000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['pando', 'rings', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://pando.im/news/2022/2022-11-06-alert-to-pando-community-hack-of-pando-rings/'],
  },
  {
    id: 'blizz-finance-2022-05-13',
    name: 'Blizz Finance',
    date: '2022-05-13',
    amountLost: 21800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Outdated Oracle Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['blizz', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/venus-blizz-rekt/'],
  },
  {
    id: 'dexx-2024-11-16',
    name: 'DEXX',
    date: '2024-11-16',
    amountLost: 21000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Stored Publicly) exploit on Wallet',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dexx', 'wallet'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/DEXXai_EN/status/1857830993656418763'],
  },
  {
    id: 'transit-swap-2022-10-02',
    name: 'Transit Swap',
    date: '2022-10-02',
    amountLost: 21000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Transfer Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['transit', 'swap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/transit-swap-rekt/'],
  },
  {
    id: 'popsicle-finance-2021-08-03',
    name: 'Popsicle Finance',
    date: '2021-08-03',
    amountLost: 20000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Incentive Rewards Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['popsicle', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Mudit__Gupta/status/1422797923037814786?s=20&t=bZ-0VnJ8b4SQbx5PkaOGYg'],
  },
  {
    id: 'sonne-finance-2024-05-15',
    name: 'Sonne Finance',
    date: '2024-05-15',
    amountLost: 20000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Donate Function Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sonne', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/@SonneFinance/post-mortem-sonne-finance-exploit-12f3daa82b06'],
  },
  {
    id: 'us-government-crypto-wallet-2024-10-24',
    name: 'US Government Crypto Wallet',
    date: '2024-10-24',
    amountLost: 20000000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['government', 'crypto', 'wallet', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/decryptmedia/status/1849540098607415441'],
  },
  {
    id: 'uwu-lend-2024-06-13',
    name: 'UwU Lend',
    date: '2024-06-13',
    amountLost: 20000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['uwu', 'lend', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/TheBlock__/status/1801177660946612664'],
  },
  {
    id: 'ankr-helio-2022-12-02',
    name: 'Ankr/Helio',
    date: '2022-12-02',
    amountLost: 20000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control exploit on Staking',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ankrhelio', 'staking'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/ankr-helio-rekt/'],
  },
  {
    id: 'pickle-2020-11-22',
    name: 'Pickle',
    date: '2020-11-22',
    amountLost: 19700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Vault Swap Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['pickle', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://github.com/banteg/evil-jar/blob/master/readme.md'],
  },
  {
    id: 'cream-lending-2021-08-30',
    name: 'CREAM Lending',
    date: '2021-08-30',
    amountLost: 18800000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cream', 'lending', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1432249600002478081'],
  },
  {
    id: 'snowdog-2021-11-25',
    name: 'Snowdog',
    date: '2021-11-25',
    amountLost: 18100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['snowdog', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/snowdog-rekt/'],
  },
  {
    id: 'bearnfi-2021-05-17',
    name: 'BearnFi',
    date: '2021-05-17',
    amountLost: 18000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Withdraw Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bearnfi', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://peckshield.medium.com/bearn-fi-incident-inconsistent-asset-denomination-between-vault-strategy-9b24b68ab1c0'],
  },
  {
    id: 'swapnet-2026-01-26',
    name: 'SwapNet',
    date: '2026-01-26',
    amountLost: 16800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Unlimited Approval Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['swapnet', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/2015608261119217671'],
  },
  {
    id: 'curio-2024-03-25',
    name: 'Curio',
    date: '2024-03-25',
    amountLost: 16000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Voting Power Inflation exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['curio', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1772216818645565673'],
  },
  {
    id: 'indexed-finance-2021-10-14',
    name: 'Indexed Finance',
    date: '2021-10-14',
    amountLost: 16000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['indexed', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://ndxfi.medium.com/indexed-attack-post-mortem-b006094f0bdc'],
  },
  {
    id: 'team-finance-2022-10-27',
    name: 'Team Finance',
    date: '2022-10-27',
    amountLost: 15800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Migrate Function Mistake Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['team', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1585587858978623491?s=20&t=vAGSJQ0ivXGoOv80bGx4iQ'],
  },
  {
    id: 'inverse-finance-frontier-2022-04-02',
    name: 'Inverse Finance Frontier',
    date: '2022-04-02',
    amountLost: 15600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['inverse', 'finance', 'frontier', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1510239094777032713?s=20&t=RBNXo-6wEDCiBE5a9nO0-Q'],
  },
  {
    id: 'eminence-2020-09-28',
    name: 'Eminence',
    date: '2020-09-28',
    amountLost: 15000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['eminence', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/eminence-rekt-in-prod/'],
  },
  {
    id: 'rain-2024-04-29',
    name: 'Rain',
    date: '2024-04-29',
    amountLost: 14800000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rain', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/CoinDesk/status/1790197230915194916'],
  },
  {
    id: 'furucombo-2021-02-27',
    name: 'Furucombo',
    date: '2021-02-27',
    amountLost: 14000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Delegatecall Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['furucombo', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Kurt_M_Barry/status/1365876788757471234?s=20&t=LObPnVPhVbkYv7U9e-AL7w'],
  },
  {
    id: 'woo-x-2025-07-24',
    name: 'WOO X',
    date: '2025-07-24',
    amountLost: 14000000,
    vulnerability: {
      type: 'access-control',
      description: 'Social Engineering exploit on CEX',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['woo', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/BlockscopeCo/status/1948793062076940512'],
  },
  {
    id: 'gdac-2023-04-08',
    name: 'GDAC',
    date: '2023-04-08',
    amountLost: 13900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Hot wallet hack exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gdac', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/MetaSleuth/status/1645692516401033216'],
  },
  {
    id: 'm2-exchange-2024-10-31',
    name: 'M2 Exchange',
    date: '2024-10-31',
    amountLost: 13700000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on CEX',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['exchange', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1852303223903633572'],
  },
  {
    id: 'deus-finance-2022-04-28',
    name: 'DEUS Finance',
    date: '2022-04-28',
    amountLost: 13400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['deus', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1519530463337250817?s=20&t=Mr6sVLBWq_A0ej9Y3-qstA'],
  },
  {
    id: 'pnetwork-2021-10-04',
    name: 'pNetwork',
    date: '2021-10-04',
    amountLost: 13000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Log Spoofing exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['pnetwork', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.halborn.com/blog/post/explained-the-pnetwork-hack-september-2021'],
  },
  {
    id: 'abracadabra-spell-2025-03-25',
    name: 'Abracadabra Spell',
    date: '2025-03-25',
    amountLost: 13000000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['abracadabra', 'spell', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/peckshield/status/1904501599848038490'],
  },
  {
    id: 'polter-finance-2024-11-16',
    name: 'Polter Finance',
    date: '2024-11-16',
    amountLost: 12000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['polter', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/polter-finance-12m-hack-response'],
  },
  {
    id: 'ronin-bridge-2024-08-06',
    name: 'Ronin Bridge',
    date: '2024-08-06',
    amountLost: 12000000,
    vulnerability: {
      type: 'logic-error',
      description: 'MEV bot manipulation exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ronin', 'bridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Ronin_Network/status/1820804772917588339'],
  },
  {
    id: 'cork-v1-2025-05-28',
    name: 'Cork V1',
    date: '2025-05-28',
    amountLost: 12000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access control bypass via hook exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cork', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1927701403092316254'],
  },
  {
    id: 'compounder-finance-2020-12-02',
    name: 'Compounder Finance',
    date: '2020-12-02',
    amountLost: 12000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['compounder', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/deathbed-confessions-c3pr/'],
  },
  {
    id: 'defrost-finance-2022-12-25',
    name: 'Defrost Finance',
    date: '2022-12-25',
    amountLost: 12000000,
    vulnerability: {
      type: 'access-control',
      description: 'Rug Pull exploit on Lending',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['defrost', 'finance', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/defrost-rekt/'],
  },
  {
    id: 'prismalst-2024-03-28',
    name: 'PrismaLST',
    date: '2024-03-28',
    amountLost: 11600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Trove Manipulation exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['prismalst', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/PeckShieldAlert/status/1773345454832378109'],
  },
  {
    id: 'prisma-finance-2024-03-28',
    name: 'Prisma Finance',
    date: '2024-03-28',
    amountLost: 11600000,
    vulnerability: {
      type: 'flash-loan',
      description: 'Flash Loan Attack exploit on Lending',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['prisma', 'finance', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/prisma-finance-rekt/'],
  },
  {
    id: 'yearn-finance-2023-04-13',
    name: 'Yearn Finance',
    date: '2023-04-13',
    amountLost: 11539000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Misconfiguration Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['yearn', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/osec_io/status/1646411672175939585?s=20'],
  },
  {
    id: 'uxlink-2025-09-22',
    name: 'UXLINK',
    date: '2025-09-22',
    amountLost: 11300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Delegatecall Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['uxlink', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1970167036002132425'],
  },
  {
    id: 'saddle-finance-2022-04-30',
    name: 'Saddle Finance',
    date: '2022-04-30',
    amountLost: 11000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Swap Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['saddle', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/saddle-finance-rekt2/'],
  },
  {
    id: 'valuedefi-2021-05-07',
    name: 'ValueDefi',
    date: '2021-05-07',
    amountLost: 11000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Math Mistake Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['valuedefi', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1390905494844313602?s=20'],
  },
  {
    id: 'yearn-finance-2021-02-05',
    name: 'Yearn Finance',
    date: '2021-02-05',
    amountLost: 11000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['yearn', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/yearn-rekt/'],
  },
  {
    id: 'garden-2025-10-30',
    name: 'Garden',
    date: '2025-10-30',
    amountLost: 10800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['garden', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/QuillAudits_AI/status/1983910001350783316'],
  },
  {
    id: 'rari-capital-2021-05-08',
    name: 'Rari Capital',
    date: '2021-05-08',
    amountLost: 10000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rari', 'capital', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1391087260125188099'],
  },
  {
    id: 'arbix-finance-2022-01-04',
    name: 'Arbix Finance',
    date: '2022-01-04',
    amountLost: 10000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['arbix', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/arbix-rekt/'],
  },
  {
    id: 'dego-finance-2022-02-10',
    name: 'Dego Finance',
    date: '2022-02-10',
    amountLost: 10000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dego', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/dego-finance-rekt/'],
  },
  {
    id: 'dogwiftools-2025-01-28',
    name: 'DogWifTools',
    date: '2025-01-28',
    amountLost: 10000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Malware) exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dogwiftools', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/kookcapitalllc/status/1884285558635323437'],
  },
  {
    id: 'lifi-finance-2024-07-16',
    name: 'LiFi Finance',
    date: '2024-07-16',
    amountLost: 9730000,
    vulnerability: {
      type: 'logic-error',
      description: 'Router Exploit via Infinite Approvals exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lifi', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/RektHQ/status/1813329331105726812'],
  },
  {
    id: 'resupply-2025-06-25',
    name: 'Resupply',
    date: '2025-06-25',
    amountLost: 9600000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Price Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['resupply', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/peckshield/status/1938061948647817647'],
  },
  {
    id: 'zklend-2025-02-11',
    name: 'zkLend',
    date: '2025-02-11',
    amountLost: 9550000,
    vulnerability: {
      type: 'logic-error',
      description: 'Empty Market Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['zklend', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/zkLend/status/1889515118368829559'],
  },
  {
    id: 'cover-protocol-2020-12-29',
    name: 'Cover Protocol',
    date: '2020-12-29',
    amountLost: 9400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Incentives Function Mistake exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cover', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://coverprotocol.medium.com/12-28-post-mortem-34c5f9f718d4'],
  },
  {
    id: 'myalgo-2023-02-27',
    name: 'MyAlgo',
    date: '2023-02-27',
    amountLost: 9200000,
    vulnerability: {
      type: 'logic-error',
      description: 'Cloudflare Key Compromised exploit on Wallet',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['myalgo', 'wallet'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/zachxbt/status/1630375691886686208?s=20'],
  },
  {
    id: 'yearn-ether-2025-11-30',
    name: 'Yearn Ether',
    date: '2025-11-30',
    amountLost: 9000000,
    vulnerability: {
      type: 'logic-error',
      description: 'yETH stablepool Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['yearn', 'ether', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Togbe0x/status/1995240261816070482'],
  },
  {
    id: 'dydx-v3-2023-11-18',
    name: 'dYdX V3',
    date: '2023-11-18',
    amountLost: 9000000,
    vulnerability: {
      type: 'price-manipulation',
      description: 'Price Manipulation Attack exploit on DeFi Protocol',
      detectors: ['price-manipulation', 'oracle-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dydx', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/AntonioMJuliano/status/1725926693440045389'],
  },
  {
    id: 'punk-protocol-2021-08-10',
    name: 'Punk Protocol',
    date: '2021-08-10',
    amountLost: 8950000,
    vulnerability: {
      type: 'logic-error',
      description: 'Delegatecall Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['punk', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/punkprotocol/punk-finance-fair-launch-incident-report-984d9e340eb'],
  },
  {
    id: 'safemoon-2023-03-28',
    name: 'Safemoon',
    date: '2023-03-28',
    amountLost: 8900000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['safemoon', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/MoonMark_/status/1640844732082290688?s=20'],
  },
  {
    id: 'zoth-zeusd-2025-03-21',
    name: 'Zoth ZeUSD',
    date: '2025-03-21',
    amountLost: 8850000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['zoth', 'zeusd', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/1903029531558154725'],
  },
  {
    id: 'crema-finance-2022-07-02',
    name: 'Crema Finance',
    date: '2022-07-02',
    amountLost: 8800000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['crema', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Crema_Finance/status/1543638844410499073?s=20&t=tjkZ9crEBqMSfzI2BMG_oQ'],
  },
  {
    id: 'superfluid-2022-02-08',
    name: 'Superfluid',
    date: '2022-02-08',
    amountLost: 8700000,
    vulnerability: {
      type: 'logic-error',
      description: 'CTX Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['superfluid', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/superfluid-rekt/'],
  },
  {
    id: 'woofi-swap-2024-03-05',
    name: 'WOOFi Swap',
    date: '2024-03-05',
    amountLost: 8500000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Price Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['woofi', 'swap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshieldalert/status/1765054155478175943'],
  },
  {
    id: 'platypus-finance-2023-02-16',
    name: 'Platypus Finance',
    date: '2023-02-16',
    amountLost: 8500000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['platypus', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/CertiKAlert/status/1626318821840629763'],
  },
  {
    id: 'moola-market-2022-10-18',
    name: 'Moola Market',
    date: '2022-10-18',
    amountLost: 8400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['moola', 'market', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1582448720985014273?s=20&t=vRg4YjjP30kMjt_V7I0gfg'],
  },
  {
    id: 'bunni-v2-2025-09-02',
    name: 'Bunni V2',
    date: '2025-09-02',
    amountLost: 8400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Liquidity Distribution Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bunni', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1962755574283768308'],
  },
  {
    id: 'alex-2025-06-06',
    name: 'ALEX',
    date: '2025-06-06',
    amountLost: 8373000,
    vulnerability: {
      type: 'logic-error',
      description: 'malicious transfer() method exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['alex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/ALEXLabBTC/status/1931014419133169734'],
  },
  {
    id: 'gamma-2021-12-21',
    name: 'Gamma',
    date: '2021-12-21',
    amountLost: 8200000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gamma', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/visorfinance/post-mortem-for-vvisr-staking-contract-exploit-and-upcoming-migration-7920e1dee55a'],
  },
  {
    id: 'thorchain-dex-2021-07-22',
    name: 'Thorchain DEX',
    date: '2021-07-22',
    amountLost: 8000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Refund Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['thorchain', 'dex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/thorchain-rekt2/'],
  },
  {
    id: 'bittensor-2024-07-02',
    name: 'Bittensor',
    date: '2024-07-02',
    amountLost: 8000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Supply Chain Attack) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bittensor', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/vishal4c/status/1808332836484927677'],
  },
  {
    id: 'origin-protocol-2020-11-17',
    name: 'Origin Protocol',
    date: '2020-11-17',
    amountLost: 8000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['origin', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/hack-epidemic/'],
  },
  {
    id: 'htx-2023-09-25',
    name: 'HTX',
    date: '2023-09-25',
    amountLost: 8000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['htx', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/justinsuntron/status/1706311251024822748?t=saJprSiK51MMd2GUBTnDsQ&s=19'],
  },
  {
    id: 'lcx-2022-01-08',
    name: 'LCX',
    date: '2022-01-08',
    amountLost: 7940000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lcx', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.lcx.com/hot-wallet-incident-report/'],
  },
  {
    id: 'multichain-2021-07-10',
    name: 'Multichain',
    date: '2021-07-10',
    amountLost: 7900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Bad ECDSA Implementation) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['multichain', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/anyswap-rekt/'],
  },
  {
    id: 'warp-protocol-2020-12-18',
    name: 'Warp Protocol',
    date: '2020-12-18',
    amountLost: 7800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['warp', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/warp-finance-rekt/'],
  },
  {
    id: 'meter-2022-02-06',
    name: 'Meter',
    date: '2022-02-06',
    amountLost: 7700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Deposit Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['meter', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/ishwinder/status/1490227406824685569?s=20&t=_Ypi0s4w213ow0Rdgp4tmw'],
  },
  {
    id: 'coindash-2017-07-18',
    name: 'CoinDash',
    date: '2017-07-18',
    amountLost: 7700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Frontend Attack exploit on ICO',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['coindash', 'ico'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/markets/2017/07/17/7-million-lost-in-coindash-ico-hack/'],
  },
  {
    id: 'rho-markets-2024-07-19',
    name: 'Rho Markets',
    date: '2024-07-19',
    amountLost: 7600000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Price Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rho', 'markets', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/DLNewsInfo/status/1814302008213410292'],
  },
  {
    id: 'exactly-protocol-2023-08-18',
    name: 'Exactly Protocol',
    date: '2023-08-18',
    amountLost: 7600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Logic Error exploit on Lending',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['exactly', 'protocol', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/exactly-rekt/'],
  },
  {
    id: 'bns-2022-02-01',
    name: 'BNS',
    date: '2022-02-01',
    amountLost: 7500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bns', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/zachxbt/status/1630665458134163476'],
  },
  {
    id: 'kiloex-2025-04-14',
    name: 'KiloEx',
    date: '2025-04-14',
    amountLost: 7500000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Price Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kiloex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/shoucccc/status/1911862514440376446'],
  },
  {
    id: 'jimbos-protocol-2023-05-28',
    name: 'Jimbos Protocol',
    date: '2023-05-28',
    amountLost: 7500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Slippage Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['jimbos', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1662650673731624961?s=20'],
  },
  {
    id: 'hundred-finance-2023-04-15',
    name: 'Hundred Finance',
    date: '2023-04-15',
    amountLost: 7400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Donate Function Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hundred', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/hundred-rekt2/'],
  },
  {
    id: 'burgerswap-2021-05-28',
    name: 'BurgerSwap',
    date: '2021-05-28',
    amountLost: 7200000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['burgerswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1398114924337971201?s=20&t=vVNaBlQNJ9WXRT54vvCZ8w'],
  },
  {
    id: 'exactly-2023-08-18',
    name: 'Exactly',
    date: '2023-08-18',
    amountLost: 7200000,
    vulnerability: {
      type: 'logic-error',
      description: 'DebtManager Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['exactly', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/DeDotFiSecurity/status/1692549866713407912'],
  },
  {
    id: 'dao-maker-vesting-2021-08-12',
    name: 'DAO Maker Vesting',
    date: '2021-08-12',
    amountLost: 7000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dao', 'maker', 'vesting', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/dao-maker-crowdfunding-platform-loses-7m-in-latest-defi-exploit'],
  },
  {
    id: 'odin-fun-2025-08-12',
    name: 'Odin.Fun',
    date: '2025-08-12',
    amountLost: 7000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Liquidity Manipulation Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['odinfun', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://uk.finance.yahoo.com/news/memecoin-launchpad-odin-fun-suffers-103510880.html'],
  },
  {
    id: 'valuedefi-2020-11-14',
    name: 'ValueDefi',
    date: '2020-11-14',
    amountLost: 7000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['valuedefi', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/value-defi-rekt/'],
  },
  {
    id: 'saga-2026-01-21',
    name: 'Saga',
    date: '2026-01-21',
    amountLost: 7000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on Chain',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['saga', 'chain'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/SpecterAnalyst/status/2014007596605214995'],
  },
  {
    id: 'trust-wallet-2025-12-25',
    name: 'Trust Wallet',
    date: '2025-12-25',
    amountLost: 7000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Supply Chain Attack) exploit on Wallet',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['trust', 'wallet'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/zachxbt/status/2004298839625195720'],
  },
  {
    id: 'lodestar-v0-2022-12-10',
    name: 'Lodestar V0',
    date: '2022-12-10',
    amountLost: 6900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lodestar', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/BowTiedPickle/status/1601650177369993216?s=20&t=lv-ruhz34Xz7S_fZVFZj7w'],
  },
  {
    id: 'velocore-v2-2024-06-02',
    name: 'Velocore V2',
    date: '2024-06-02',
    amountLost: 6800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Fee Overflow Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['velocore', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/velocorexyz/status/1797229772399067587'],
  },
  {
    id: 'holograph-2024-06-13',
    name: 'Holograph',
    date: '2024-06-13',
    amountLost: 6700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['holograph', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/tech/2024/06/13/hlg-down-over-60-as-exploiter-mints-1-billion-new-tokens/'],
  },
  {
    id: 'abracadabra-spell-2024-01-30',
    name: 'Abracadabra Spell',
    date: '2024-01-30',
    amountLost: 6500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Borrow Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['abracadabra', 'spell', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1752279373779194011'],
  },
  {
    id: 'alchemix-2021-06-16',
    name: 'Alchemix',
    date: '2021-06-16',
    amountLost: 6500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Borrow Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['alchemix', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://forum.alchemix.fi/public/d/137-incident-report-06162021'],
  },
  {
    id: 'seneca-2024-02-28',
    name: 'Seneca',
    date: '2024-02-28',
    amountLost: 6500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Token approval exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['seneca', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/spreekaway/status/1762857769714012217'],
  },
  {
    id: 'deus-finance-2023-05-05',
    name: 'DEUS Finance',
    date: '2023-05-05',
    amountLost: 6500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Burn Function Mistake exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['deus', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/storming0x/status/1654561199999135747?s=20'],
  },
  {
    id: 'abracadabra-2024-01-30',
    name: 'Abracadabra',
    date: '2024-01-30',
    amountLost: 6500000,
    vulnerability: {
      type: 'rounding-error',
      description: 'Rounding Error exploit on Lending',
      detectors: ['divide-before-multiply', 'unchecked-transfer'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['abracadabra', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/abracadabra-rekt-2/'],
  },
  {
    id: 'magnate-finance-2023-08-25',
    name: 'Magnate Finance',
    date: '2023-08-25',
    amountLost: 6400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['magnate', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/PeckShieldAlert/status/1694946221788729440'],
  },
  {
    id: 'seneca-protocol-2024-02-28',
    name: 'Seneca Protocol',
    date: '2024-02-28',
    amountLost: 6400000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control exploit on Lending',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['seneca', 'protocol', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/seneca-rekt/'],
  },
  {
    id: 'belt-finance-2021-05-29',
    name: 'Belt Finance',
    date: '2021-05-29',
    amountLost: 6300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['belt', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/belt-rekt/'],
  },
  {
    id: 'hundred-finance-2022-03-15',
    name: 'Hundred Finance',
    date: '2022-03-15',
    amountLost: 6200000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hundred', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/agave-hundred-rekt/'],
  },
  {
    id: 'gamma-strategies-2024-01-04',
    name: 'Gamma Strategies',
    date: '2024-01-04',
    amountLost: 6200000,
    vulnerability: {
      type: 'price-manipulation',
      description: 'Price Manipulation exploit on Yield',
      detectors: ['price-manipulation', 'oracle-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gamma', 'strategies', 'yield'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/gamma-strategies-rekt/'],
  },
  {
    id: 'defrost-2022-12-24',
    name: 'Defrost',
    date: '2022-12-24',
    amountLost: 6000000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['defrost', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://de.fi/blog/exclusive-the-defrost-team-rug-pulled-12m-7m-999b24c13f47'],
  },
  {
    id: 'lendhub-2023-01-16',
    name: 'LendHub',
    date: '2023-01-16',
    amountLost: 6000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Collateral Offboarding Mistake exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lendhub', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/SlowMist_Team/status/1613906590574198784?s=20'],
  },
  {
    id: 'audius-2022-07-25',
    name: 'Audius',
    date: '2022-07-25',
    amountLost: 6000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Malicious Governance Proposal exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['audius', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/audius-rekt/'],
  },
  {
    id: 'deltaprime-2024-09-16',
    name: 'DeltaPrime',
    date: '2024-09-16',
    amountLost: 5980000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['deltaprime', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CryptoTimes_io/status/1835620537055514652'],
  },
  {
    id: 'bondly-2021-07-15',
    name: 'Bondly',
    date: '2021-07-15',
    amountLost: 5900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bondly', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/bondly-rekt/'],
  },
  {
    id: 'loopscale-2025-04-26',
    name: 'Loopscale',
    date: '2025-04-26',
    amountLost: 5800000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Price Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['loopscale', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/LoopscaleLabs/status/1916183179469246626'],
  },
  {
    id: 'inverse-finance-frontier-2022-06-16',
    name: 'Inverse Finance Frontier',
    date: '2022-06-16',
    amountLost: 5800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['inverse', 'finance', 'frontier', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1537382891230883841?s=20&t=uxBt2fIcD_f82MM2VD3pCg'],
  },
  {
    id: 'roll-2021-03-14',
    name: 'Roll',
    date: '2021-03-14',
    amountLost: 5700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['roll', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/roll-rekt/'],
  },
  {
    id: 'agave-2022-03-15',
    name: 'Agave',
    date: '2022-03-15',
    amountLost: 5500000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['agave', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/agave-hundred-rekt/'],
  },
  {
    id: 'slope-wallet-2022-08-02',
    name: 'Slope Wallet',
    date: '2022-08-02',
    amountLost: 5300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Stored Publicly) exploit on Wallet',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['slope', 'wallet'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://solana.com/news/8-2-2022-application-wallet-incident'],
  },
  {
    id: 'betterbank-2025-08-26',
    name: 'BetterBank',
    date: '2025-08-26',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['betterbank', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/BetterBank_io/status/1960409391628189749'],
  },
  {
    id: 'truflation-2024-09-25',
    name: 'Truflation',
    date: '2024-09-25',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Malware) exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['truflation', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.theblock.co/post/318209/coinbase-ventures-backed-truflation-hacked-for-about-5-million-says-zachxbt'],
  },
  {
    id: 'zksync-2025-04-15',
    name: 'ZKsync',
    date: '2025-04-15',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['zksync', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/WuBlockchain/status/1912142777229754611'],
  },
  {
    id: 'paraspace-lending-v1-2023-03-17',
    name: 'ParaSpace Lending V1',
    date: '2023-03-17',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Borrow Logic Exploit exploit on NFTfi',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['paraspace', 'lending', 'nftfi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/BlockSecTeam/status/1636650252844294144?s=20'],
  },
  {
    id: 'polynetwork-2024-08-12',
    name: 'PolyNetwork',
    date: '2024-08-12',
    amountLost: 5000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['polynetwork', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/flamingo-finance/poly-network-bridge-exploit-and-the-asset-support-initiative-c80c636255bb'],
  },
  {
    id: 'ankr-2022-12-02',
    name: 'Ankr',
    date: '2022-12-02',
    amountLost: 5000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ankr', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/ankr/status/1598503332477280256'],
  },
  {
    id: 'terra-2-0-2024-07-31',
    name: 'Terra 2.0',
    date: '2024-07-31',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'IBC hooks exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['terra', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/@Rarma_/terra-ibc-hooks-exploit-21cca87d70a4'],
  },
  {
    id: 'loopring-2024-06-09',
    name: 'Loopring',
    date: '2024-06-09',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Guardian 2FA service exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['loopring', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/loopringorg/status/1799791898296451515'],
  },
  {
    id: '1inch-2025-03-07',
    name: '1inch',
    date: '2025-03-07',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Calldata underflow and resolver hijack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['1inch', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://blog.1inch.io/vulnerability-discovered-in-resolver-contract/'],
  },
  {
    id: 'poly-network-2023-07-02',
    name: 'Poly Network',
    date: '2023-07-02',
    amountLost: 5000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['poly', 'network', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/dedaub/status/1675516729349292032?s=20'],
  },
  {
    id: 'ocelotdex-2024-09-20',
    name: 'OcelotDex',
    date: '2024-09-20',
    amountLost: 4900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ocelotdex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/BlockscopeInc/status/1839049867987206329'],
  },
  {
    id: 'super-sushi-samurai-2024-03-22',
    name: 'Super Sushi Samurai',
    date: '2024-03-22',
    amountLost: 4800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on Gaming',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['super', 'sushi', 'samurai', 'gaming'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/sss-rekt/'],
  },
  {
    id: 'deltaprime-2024-11-11',
    name: 'DeltaPrime',
    date: '2024-11-11',
    amountLost: 4800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Debt Swap Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['deltaprime', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/peckshield/status/1855900790063607929'],
  },
  {
    id: 'tapioca-dao-2024-10-18',
    name: 'Tapioca DAO',
    date: '2024-10-18',
    amountLost: 4700000,
    vulnerability: {
      type: 'access-control',
      description: 'Private Key Compromised (Social Engineering) exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['tapioca', 'dao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/tapioca_dao/status/1847330264139145361'],
  },
  {
    id: 'duelbits-2024-02-13',
    name: 'DuelBits',
    date: '2024-02-13',
    amountLost: 4600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['duelbits', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1757681640384381238'],
  },
  {
    id: 'pnetwork-2022-11-03',
    name: 'pNetwork',
    date: '2022-11-03',
    amountLost: 4589449,
    vulnerability: {
      type: 'logic-error',
      description: 'Misconfiguration exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['pnetwork', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/pNetworkDeFi/status/1588956872664829952'],
  },
  {
    id: 'credix-2025-08-04',
    name: 'CrediX',
    date: '2025-08-04',
    amountLost: 4500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['credix', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1952299850650747079'],
  },
  {
    id: 'xtoken-2021-08-29',
    name: 'xToken',
    date: '2021-08-29',
    amountLost: 4500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['xtoken', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/xtoken/xsnx-post-mortem-666d35071f38'],
  },
  {
    id: 'gamma-2024-01-04',
    name: 'Gamma',
    date: '2024-01-04',
    amountLost: 4500000,
    vulnerability: {
      type: 'price-manipulation',
      description: 'Price Manipulation Attack exploit on DeFi Protocol',
      detectors: ['price-manipulation', 'oracle-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gamma', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshieldalert/status/1742753372334399513'],
  },
  {
    id: 'eleven-finance-2021-06-22',
    name: 'Eleven Finance',
    date: '2021-06-22',
    amountLost: 4500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Burn Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['eleven', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/11-rekt/'],
  },
  {
    id: 'radiant-v2-2024-01-02',
    name: 'Radiant V2',
    date: '2024-01-02',
    amountLost: 4500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan New Market Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['radiant', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1742334242120466580'],
  },
  {
    id: 'radiant-capital-2024-01-02',
    name: 'Radiant Capital',
    date: '2024-01-02',
    amountLost: 4500000,
    vulnerability: {
      type: 'flash-loan',
      description: 'Flash Loan Attack exploit on Lending',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['radiant', 'capital', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/radiant-capital-rekt/'],
  },
  {
    id: 'raydium-amm-2022-12-16',
    name: 'Raydium AMM',
    date: '2022-12-16',
    amountLost: 4400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['raydium', 'amm', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/osec_io/status/1603763023151509505?s=20&t=_J9Y8NV-o0QeXHtnkyR-4A'],
  },
  {
    id: 'chainswap-2021-11-07',
    name: 'ChainSwap',
    date: '2021-11-07',
    amountLost: 4400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Exploit Weak Authentication Check exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['chainswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://chain-swap.medium.com/chainswap-exploit-11-july-2021-post-mortem-6e4e346e5a32'],
  },
  {
    id: 'alex-2024-05-16',
    name: 'ALEX',
    date: '2024-05-16',
    amountLost: 4300000,
    vulnerability: {
      type: 'access-control',
      description: 'Private Key Compromised (Phishing) exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['alex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/alexlab-rekt/'],
  },
  {
    id: 'makina-2026-01-19',
    name: 'Makina',
    date: '2026-01-19',
    amountLost: 4200000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['makina', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/TenArmorAlert/status/2013460083078836342'],
  },
  {
    id: 'dao-maker-vesting-2021-09-04',
    name: 'DAO Maker Vesting',
    date: '2021-09-04',
    amountLost: 4000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dao', 'maker', 'vesting', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Mudit__Gupta/status/1434059922774237185?s=20&t=aoOtJLS6FHimjAE1anc1mg'],
  },
  {
    id: 'ionic-protocol-2025-02-04',
    name: 'Ionic Protocol',
    date: '2025-02-04',
    amountLost: 4000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Fake Collateral Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ionic', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1886829735130407065'],
  },
  {
    id: 'kokomo-finance-2023-03-27',
    name: 'Kokomo Finance',
    date: '2023-03-27',
    amountLost: 4000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kokomo', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1640118618548568069'],
  },
  {
    id: 'ola-finance-2022-03-31',
    name: 'Ola Finance',
    date: '2022-03-31',
    amountLost: 4000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ola', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/tech/2022/03/31/ola-finance-exploited-for-36m-in-re-entrancy-attack/'],
  },
  {
    id: 'surgebnb-2021-08-17',
    name: 'SurgeBNB',
    date: '2021-08-17',
    amountLost: 4000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['surgebnb', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://beosin.medium.com/a-sweet-blow-fb0a5e08657d'],
  },
  {
    id: 'onyx-v2-2024-09-26',
    name: 'Onyx V2',
    date: '2024-09-26',
    amountLost: 4000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Liquidation Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['onyx', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/blocksecteam/status/1839314277359849484'],
  },
  {
    id: 'dfx-v2-2022-11-10',
    name: 'DFX V2',
    date: '2022-11-10',
    amountLost: 4000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dfx', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1590831589004816384?s=20&t=0ylCEXp_O5DBIbFTAHA9vA'],
  },
  {
    id: 'unleash-protocol-2025-12-30',
    name: 'Unleash Protocol',
    date: '2025-12-30',
    amountLost: 3900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Multisig Governance Hack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['unleash', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/UnleashProtocol/status/2005907998691229933'],
  },
  {
    id: 'forcebridge-2025-06-06',
    name: 'ForceBridge',
    date: '2025-06-06',
    amountLost: 3900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Acces Control Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['forcebridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/hackenclub/status/1929451310060892202'],
  },
  {
    id: 'flow-2025-12-27',
    name: 'Flow',
    date: '2025-12-27',
    amountLost: 3900000,
    vulnerability: {
      type: 'logic-error',
      description: 'mint-and-dump Hack exploit on Layer 1',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['flow', 'layer'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/flow_blockchain/status/2005021612714668518'],
  },
  {
    id: 'yo-protocol-2026-01-13',
    name: 'YO Protocol',
    date: '2026-01-13',
    amountLost: 3730000,
    vulnerability: {
      type: 'logic-error',
      description: 'Slippage Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/2011069662377980147'],
  },
  {
    id: 'dforce-lending-2023-02-10',
    name: 'dForce Lending',
    date: '2023-02-10',
    amountLost: 3650000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dforce', 'lending', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1623902441992523776'],
  },
  {
    id: 'hypervault-2025-09-26',
    name: 'HyperVault',
    date: '2025-09-26',
    amountLost: 3600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drain Vaults exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hypervault', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/1971476404173930660'],
  },
  {
    id: 'dragoma-2022-08-08',
    name: 'Dragoma',
    date: '2022-08-08',
    amountLost: 3500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drain Vaults exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dragoma', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/business/2022/08/08/polygon-based-web3-game-dragoma-supporters-fall-victim-to-35m-rug-pull-peckshield/'],
  },
  {
    id: 'nirvana-v1-2022-07-28',
    name: 'Nirvana V1',
    date: '2022-07-28',
    amountLost: 3500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['nirvana', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/osec_io/status/1552589378719207424?s=20&t=I8QXz7iG0z7hjvfCA579LA'],
  },
  {
    id: 'siren-protocol-2021-09-04',
    name: 'Siren Protocol',
    date: '2021-09-04',
    amountLost: 3500000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on Options',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['siren', 'protocol', 'options'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/siren-rekt/'],
  },
  {
    id: 'siren-2021-09-03',
    name: 'Siren',
    date: '2021-09-03',
    amountLost: 3450000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['siren', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/BlockSecTeam/status/1433682132090568705?s=20&t=yoeOhpvaWABdrYwfwtTJ0Q'],
  },
  {
    id: 'squid-games-2021-11-03',
    name: 'Squid Games',
    date: '2021-11-03',
    amountLost: 3400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Liquidity Pool exploit on Gaming',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['squid', 'games', 'gaming'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/__tricck/status/1455083308702834690'],
  },
  {
    id: 'typus-perp-2025-10-15',
    name: 'Typus Perp',
    date: '2025-10-15',
    amountLost: 3400000,
    vulnerability: {
      type: 'logic-error',
      description: 'TLP Contract Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['typus', 'perp', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/TypusFinance/status/1978465485395304778'],
  },
  {
    id: 'eralend-2023-07-25',
    name: 'EraLend',
    date: '2023-07-25',
    amountLost: 3400000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['eralend', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/DLNewsInfo/status/1683870083272130562'],
  },
  {
    id: 'vesper-finance-2021-11-03',
    name: 'Vesper Finance',
    date: '2021-11-03',
    amountLost: 3370000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['vesper', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/VesperFi/status/1455567032536248324'],
  },
  {
    id: 'shido-2024-02-29',
    name: 'Shido',
    date: '2024-02-29',
    amountLost: 3300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['shido', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/shido-token-plummet-attacker-drains-staking-contract'],
  },
  {
    id: 'bungee-2024-01-16',
    name: 'Bungee',
    date: '2024-01-16',
    amountLost: 3300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Missing Input Validation exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bungee', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.dlnews.com/articles/defi/hacker-swipes-33m-from-bungee-crypto-bridge-users/'],
  },
  {
    id: 'raft-2023-11-10',
    name: 'Raft',
    date: '2023-11-10',
    amountLost: 3300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['raft', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/AnciliaInc/status/1723055359034568828'],
  },
  {
    id: 'cheesebank-2020-11-16',
    name: 'CheeseBank',
    date: '2020-11-16',
    amountLost: 3300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cheesebank', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/CheeseBank2020/status/1328343819201380353?s=20&t=qtl30Yo9ErEoVr8v3T20dg'],
  },
  {
    id: 'sushiswap-2023-04-10',
    name: 'SushiSwap',
    date: '2023-04-10',
    amountLost: 3300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Missing Input Validation exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sushiswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/ernestognw/status/1645113041430757378'],
  },
  {
    id: 'socket-2024-01-16',
    name: 'Socket',
    date: '2024-01-16',
    amountLost: 3300000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control exploit on Bridge',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['socket', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/socket-rekt/'],
  },
  {
    id: 'conic-finance-2023-07-21',
    name: 'Conic Finance',
    date: '2023-07-21',
    amountLost: 3260000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['conic', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/ConicFinance/status/1682385596700844032?t=4a-w-I06_7EcbwpKWbPZHA&s=19'],
  },
  {
    id: 'zabu-finance-2021-09-12',
    name: 'Zabu Finance',
    date: '2021-09-12',
    amountLost: 3200000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['zabu', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.immunebytes.com/blog/zabu-finance-hack-sep-12-2021-detailed-analysis-report/'],
  },
  {
    id: 'aperture-lm-2026-01-25',
    name: 'Aperture LM',
    date: '2026-01-25',
    amountLost: 3200000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['aperture', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/ApertureFinance/status/2015565097884864850'],
  },
  {
    id: 'jaypegs-automart-2021-09-17',
    name: 'JayPegs Automart',
    date: '2021-09-17',
    amountLost: 3100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Redirected Deposits exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['jaypegs', 'automart', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/jaypegs-automart-rekt/'],
  },
  {
    id: 'gana-payment-2025-11-20',
    name: 'GANA Payment',
    date: '2025-11-20',
    amountLost: 3100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gana', 'payment', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.theblock.co/post/379619/gana-payment-exploit'],
  },
  {
    id: 'orion-pools-2023-02-02',
    name: 'Orion Pools',
    date: '2023-02-02',
    amountLost: 3000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['orion', 'pools', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1621337925228306433?s=20&t=ZroERzkeCrxy3gHxtboQeA'],
  },
  {
    id: 'skyward-finance-2022-11-02',
    name: 'Skyward Finance',
    date: '2022-11-02',
    amountLost: 3000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['skyward', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/skywardfinance/status/1587947957789331457'],
  },
  {
    id: 'fortress-loans-2022-05-08',
    name: 'Fortress Loans',
    date: '2022-05-08',
    amountLost: 3000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Governance and Oracle Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['fortress', 'loans', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/fortress-rekt/'],
  },
  {
    id: 'shibarium-2025-09-13',
    name: 'Shibarium',
    date: '2025-09-13',
    amountLost: 3000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Validator Stake Manipulation by Flashloan exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['shibarium', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/0xZilayo/status/1966785029968724351'],
  },
  {
    id: 'deus-finance-2021-03-15',
    name: 'DEUS Finance',
    date: '2021-03-15',
    amountLost: 3000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['deus', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1503632734299701250'],
  },
  {
    id: 'griffinai-2025-09-24',
    name: 'GriffinAI',
    date: '2025-09-24',
    amountLost: 3000000,
    vulnerability: {
      type: 'logic-error',
      description: 'False Peer Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['griffinai', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1971053766540657069'],
  },
  {
    id: 'banana-gun-2024-09-19',
    name: 'Banana Gun',
    date: '2024-09-19',
    amountLost: 3000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Front-end vulnerability exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['banana', 'gun', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/BananaGunBot/status/1838660010387116484'],
  },
  {
    id: 'swaprum-2023-05-19',
    name: 'Swaprum',
    date: '2023-05-19',
    amountLost: 3000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['swaprum', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.dlnews.com/articles/defi/defi-protocol-swaprum-in-3m-rug-pull-was-certik-audited/?utm_campaign='],
  },
  {
    id: 'arena-socialfi-2023-10-07',
    name: 'Arena SocialFi',
    date: '2023-10-07',
    amountLost: 2900000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on Other',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['arena', 'socialfi', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1710555944269292009?t=Al_-cDBwoNs3vpKqcpJ0Jw&s=19'],
  },
  {
    id: 'sunray-finance-2024-10-30',
    name: 'SUNRAY·FINANCE',
    date: '2024-10-30',
    amountLost: 2855000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sunrayfinance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1851816489286041885'],
  },
  {
    id: 'remitano-2023-09-15',
    name: 'Remitano',
    date: '2023-09-15',
    amountLost: 2700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['remitano', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/CyversAlerts/status/1702348063145165016/photo/1'],
  },
  {
    id: 'ribbon-2025-12-12',
    name: 'Ribbon',
    date: '2025-12-12',
    amountLost: 2700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ribbon', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/specteranalyst/status/1999532982411854109'],
  },
  {
    id: 'okx-dex-2023-12-13',
    name: 'OKX DEX',
    date: '2023-12-13',
    amountLost: 2700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['okx', 'dex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/TheBlock__/status/1734921504523956630'],
  },
  {
    id: 'turtle-dex-2021-03-20',
    name: 'Turtle Dex',
    date: '2021-03-20',
    amountLost: 2500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['turtle', 'dex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/binance-smart-chain-s-turtledex-rugpulls-shortly-after-launch'],
  },
  {
    id: 'arcadia-v2-2025-07-15',
    name: 'Arcadia V2',
    date: '2025-07-15',
    amountLost: 2500000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Rebalancer contract reentrancy hack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['arcadia', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/ArcadiaFi/status/1944984622183370867'],
  },
  {
    id: 'coinspot-2023-11-09',
    name: 'CoinSpot',
    date: '2023-11-09',
    amountLost: 2400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['coinspot', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/PeckShieldAlert/status/1722412658404843691'],
  },
  {
    id: 'bunny-2021-07-16',
    name: 'Bunny',
    date: '2021-07-16',
    amountLost: 2400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Incentive Rewards Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bunny', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://pancakebunny.medium.com/polybunny-post-mortem-compensation-42b5c35ce957'],
  },
  {
    id: 'nemo-yield-trading-2025-09-08',
    name: 'Nemo Yield Trading',
    date: '2025-09-08',
    amountLost: 2400000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Price Oracle Manipulation exploit on DeFi Protocol',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['nemo', 'yield', 'trading', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1964942965098656034'],
  },
  {
    id: 'trinity-wallet-2020-02-12',
    name: 'Trinity Wallet',
    date: '2020-02-12',
    amountLost: 2350000,
    vulnerability: {
      type: 'logic-error',
      description: 'Cloudflare Key Compromised exploit on Wallet',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['trinity', 'wallet'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://blog.iota.org/trinity-attack-incident-part-1-summary-and-next-steps-8c7ccc4d81e8/'],
  },
  {
    id: 'templedao-2022-10-11',
    name: 'TempleDAO',
    date: '2022-10-11',
    amountLost: 2300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Exploit Lack of Input Authentication exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['templedao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/FrankResearcher/status/1579840347647414272?s=20&t=Ld2QjyQea4YYyVt3BKyJsA'],
  },
  {
    id: 'fantasm-finance-2022-03-09',
    name: 'Fantasm Finance',
    date: '2022-03-09',
    amountLost: 2260000,
    vulnerability: {
      type: 'logic-error',
      description: 'Missing Condition Check exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['fantasm', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://quadrigainitiative.com/cryptocurrencyhackscamfraudwiki/index.php?title=Fantasm_Finance_Contract_Vulnerabilities'],
  },
  {
    id: 'texture-2025-07-09',
    name: 'Texture',
    date: '2025-07-09',
    amountLost: 2200000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['texture', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/texture_fi/status/1942972150631002245'],
  },
  {
    id: 'coinstats-2024-07-12',
    name: 'CoinStats',
    date: '2024-07-12',
    amountLost: 2200000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on Other',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['coinstats', 'other'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CoinStats/status/1811706273395622063'],
  },
  {
    id: 'platypus-finance-2023-10-13',
    name: 'Platypus Finance',
    date: '2023-10-13',
    amountLost: 2200000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['platypus', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/platypus-rekt2/'],
  },
  {
    id: 'mobius-token-2025-05-11',
    name: 'Mobius Token',
    date: '2025-05-11',
    amountLost: 2160000,
    vulnerability: {
      type: 'logic-error',
      description: 'Decimal Miscalculation Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['mobius', 'token', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.certik.com/resources/blog/mobius-token-incident-analysis'],
  },
  {
    id: 'unizen-2024-03-08',
    name: 'Unizen',
    date: '2024-03-08',
    amountLost: 2100000,
    vulnerability: {
      type: 'logic-error',
      description: 'External Call Vulnerability exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['unizen', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1766210445415727608'],
  },
  {
    id: 'onyx-protocol-2023-11-01',
    name: 'Onyx Protocol',
    date: '2023-11-01',
    amountLost: 2100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Donate Function Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['onyx', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/decurityhq/status/1719657969925677161'],
  },
  {
    id: 'ethtrustfund-2024-07-22',
    name: 'ETHTrustFund',
    date: '2024-07-22',
    amountLost: 2100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Transferred Treasury to Mixers exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ethtrustfund', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/ethtrustfund-dao-transfers-treasury-apparent-rug-pull'],
  },
  {
    id: 'zunami-protocol-2023-08-13',
    name: 'Zunami Protocol',
    date: '2023-08-13',
    amountLost: 2100000,
    vulnerability: {
      type: 'price-manipulation',
      description: 'Price Manipulation Attack exploit on DeFi Protocol',
      detectors: ['price-manipulation', 'oracle-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['zunami', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/decryptmedia/status/1690946389323157504'],
  },
  {
    id: 'gym-network-2022-06-08',
    name: 'Gym Network',
    date: '2022-06-08',
    amountLost: 2100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Deposit Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gym', 'network', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/gymnet-rekt/'],
  },
  {
    id: 'revest-finance-2022-03-27',
    name: 'Revest Finance',
    date: '2022-03-27',
    amountLost: 2010000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['revest', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/BlockSecTeam/status/1508065573250678793?s=20&t=NXJmfrEeRP3-fqmOwjOAGQ'],
  },
  {
    id: 'mangofarmsol-2024-01-07',
    name: 'MangoFarmSol',
    date: '2024-01-07',
    amountLost: 2000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Frontend Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['mangofarmsol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/funds-mangofarmsol-drained-community-rug-pull'],
  },
  {
    id: 'pump-fun-2024-05-16',
    name: 'pump.fun',
    date: '2024-05-16',
    amountLost: 2000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['pumpfun', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/FrankResearcher/status/1791164323047293325'],
  },
  {
    id: 'sirio-finance-2025-02-01',
    name: 'Sirio Finance',
    date: '2025-02-01',
    amountLost: 2000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sirio', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/SirioFinance/status/1885800736967024957'],
  },
  {
    id: 'dexible-v2-2023-02-20',
    name: 'Dexible V2',
    date: '2023-02-20',
    amountLost: 2000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Arbitrary External Call exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dexible', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/RektHQ/status/1628030868043300865'],
  },
  {
    id: 'olaxbt-2025-09-01',
    name: 'OlaXBT',
    date: '2025-09-01',
    amountLost: 2000000,
    vulnerability: {
      type: 'access-control',
      description: 'Multisig wallet Social Engineering Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['olaxbt', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1962439772280094975'],
  },
  {
    id: 'dodo-amm-2021-03-09',
    name: 'DODO AMM',
    date: '2021-03-09',
    amountLost: 2000000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dodo', 'amm', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/au-dodo-rekt/'],
  },
  {
    id: 'mm-finance-cronos-2022-05-04',
    name: 'MM Finance Cronos',
    date: '2022-05-04',
    amountLost: 2000000,
    vulnerability: {
      type: 'logic-error',
      description: 'DNS Spoofing exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['finance', 'cronos', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://medium.com/@MMFinance/dns-hi-jacking-post-mortem-compensation-3e2b5bb21183'],
  },
  {
    id: 'rari-capital-2025-12-18',
    name: 'Rari Capital',
    date: '2025-12-18',
    amountLost: 2000000,
    vulnerability: {
      type: 'upgrade-vulnerability',
      description: 'Uninitialized Proxy Hijack exploit on DeFi Protocol',
      detectors: ['unprotected-upgrade', 'uninitialized-state'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rari', 'capital', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/zmtO21/status/2001585158106026270'],
  },
  {
    id: '0vix-2023-04-28',
    name: '0vix',
    date: '2023-04-28',
    amountLost: 2000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Donate Function Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['0vix', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1651923235603361793?s=20'],
  },
  {
    id: 'akropolis-2020-11-12',
    name: 'Akropolis',
    date: '2020-11-12',
    amountLost: 2000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['akropolis', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/akropolis-rekt/'],
  },
  {
    id: 'gempad-2024-12-17',
    name: 'GemPad',
    date: '2024-12-17',
    amountLost: 2000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gempad', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CyversAlerts/status/1869000606955782305'],
  },
  {
    id: 'dough-finance-2024-07-12',
    name: 'Dough Finance',
    date: '2024-07-12',
    amountLost: 1960000,
    vulnerability: {
      type: 'logic-error',
      description: 'Unvalidated call data exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dough', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/dough-finance-loses-1-8m-flash-loan-attack'],
  },
  {
    id: 'omm-2023-01-21',
    name: 'Omm',
    date: '2023-01-21',
    amountLost: 1891000,
    vulnerability: {
      type: 'logic-error',
      description: 'Redeem Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['omm', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://forum.omm.finance/t/omm-exploit-postmortem-january-2023/266'],
  },
  {
    id: 'hope-finance-2023-02-20',
    name: 'Hope Finance',
    date: '2023-02-20',
    amountLost: 1860000,
    vulnerability: {
      type: 'logic-error',
      description: 'Router Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hope', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Cointelegraph/status/1627976451814490113'],
  },
  {
    id: 'merlin-dex-2023-04-25',
    name: 'MERLIN DEX',
    date: '2023-04-25',
    amountLost: 1820000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['merlin', 'dex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/TheMerlinDEX/status/1651281814395187200?t=p0udX-ZR1mQfkhNS9KCfEQ&s=19'],
  },
  {
    id: 'xbridge-2024-04-24',
    name: 'XBridge',
    date: '2024-04-24',
    amountLost: 1800000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['xbridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: [],
  },
  {
    id: 'nexera-2024-08-07',
    name: 'Nexera',
    date: '2024-08-07',
    amountLost: 1800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Ownership Override Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['nexera', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coindesk.com/business/2024/08/07/blockchain-protocol-nexara-suffers-18m-exploit-nxra-tumbles-40/'],
  },
  {
    id: 'dolomite-2024-03-20',
    name: 'Dolomite',
    date: '2024-03-20',
    amountLost: 1800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Acces Control Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['dolomite', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.cryptotimes.io/2024/03/21/hacker-exploits-flaw-in-dolomite-project/'],
  },
  {
    id: '8ightdao-2021-12-08',
    name: '8ightDAO',
    date: '2021-12-08',
    amountLost: 1750000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['8ightdao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/8ight-finance-rekt/'],
  },
  {
    id: 'bent-finance-2021-12-21',
    name: 'Bent Finance',
    date: '2021-12-21',
    amountLost: 1750000,
    vulnerability: {
      type: 'logic-error',
      description: 'User Balances Manually Updated exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bent', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/bent-finance/'],
  },
  {
    id: 'concentric-2024-01-22',
    name: 'Concentric',
    date: '2024-01-22',
    amountLost: 1720000,
    vulnerability: {
      type: 'access-control',
      description: 'Private Key Compromised (Social Engineering) exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['concentric', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/ConcentricFi/status/1749418658818830622'],
  },
  {
    id: 'grand-base-2024-04-15',
    name: 'Grand Base',
    date: '2024-04-15',
    amountLost: 1700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['grand', 'base', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/PeckShieldAlert/status/1779796368732872856'],
  },
  {
    id: 'abracadabra-spell-2025-10-04',
    name: 'Abracadabra Spell',
    date: '2025-10-04',
    amountLost: 1700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Sequential State Manipulation Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['abracadabra', 'spell', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Phalcon_xyz/status/1974533451408986417'],
  },
  {
    id: 'unibtc-2024-09-26',
    name: 'uniBTC',
    date: '2024-09-26',
    amountLost: 1700000,
    vulnerability: {
      type: 'logic-error',
      description: 'Minting Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['unibtc', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/phtevenstrong/status/1839389432975397017'],
  },
  {
    id: 'paraluni-masterchef-2022-03-13',
    name: 'Paraluni Masterchef',
    date: '2022-03-13',
    amountLost: 1700000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['paraluni', 'masterchef', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://slowmist.medium.com/paraluni-incident-analysis-58be442a4f99'],
  },
  {
    id: 'xt-exchange-2024-11-28',
    name: 'XT Exchange',
    date: '2024-11-28',
    amountLost: 1700000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on CEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['exchange', 'cex'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/protos/status/1862100763570294837'],
  },
  {
    id: 'tender-finance-2023-03-07',
    name: 'Tender Finance',
    date: '2023-03-07',
    amountLost: 1600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Outdated Oracle Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['tender', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/wasgiventhatday/status/1633056446278426624?s=20'],
  },
  {
    id: 'acala-network-2021-08-13',
    name: 'Acala Network',
    date: '2021-08-13',
    amountLost: 1600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Incentives Function Mistake exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['acala', 'network', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/alice_und_bob/status/1558959878475075584'],
  },
  {
    id: 'pike-2024-04-30',
    name: 'Pike',
    date: '2024-04-30',
    amountLost: 1600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Storage Misalignment Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['pike', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/PikeFinance/status/1785572875124330644'],
  },
  {
    id: 'kinto-bridge-2025-07-10',
    name: 'Kinto Bridge',
    date: '2025-07-10',
    amountLost: 1550000,
    vulnerability: {
      type: 'logic-error',
      description: 'ERC1967Proxy Backdoor Hijack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kinto', 'bridge', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/ramonrecuero/status/1943426114468352006'],
  },
  {
    id: 'levyathan-2021-07-30',
    name: 'Levyathan',
    date: '2021-07-30',
    amountLost: 1500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Stored Publicly) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['levyathan', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/levyathan-rekt/'],
  },
  {
    id: 'yolo-games-2024-06-11',
    name: 'YOLO Games',
    date: '2024-06-11',
    amountLost: 1500000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['yolo', 'games', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/shoucccc/status/1800353122159833195'],
  },
  {
    id: 'moby-2025-01-08',
    name: 'Moby',
    date: '2025-01-08',
    amountLost: 1470000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['moby', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Moby_trade/status/1877096336140677458'],
  },
  {
    id: 'florence-finance-2023-11-30',
    name: 'Florence Finance',
    date: '2023-11-30',
    amountLost: 1450000,
    vulnerability: {
      type: 'logic-error',
      description: 'Address Poisoning exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['florence', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/PeckShieldAlert/status/1730045158509727968'],
  },
  {
    id: 'rubic-2022-12-25',
    name: 'Rubic',
    date: '2022-12-25',
    amountLost: 1410000,
    vulnerability: {
      type: 'logic-error',
      description: 'Router Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rubic', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1606937055761952770?s=20&t=Vdvjv2C7zUazmgvQ2SOQow'],
  },
  {
    id: 'solareum-2024-03-29',
    name: 'Solareum',
    date: '2024-03-29',
    amountLost: 1400000,
    vulnerability: {
      type: 'access-control',
      description: 'Private Key Compromised (Social Engineering) exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['solareum', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: [],
  },
  {
    id: 'treasure-2022-03-03',
    name: 'Treasure',
    date: '2022-03-03',
    amountLost: 1400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Buy Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['treasure', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/sniko_/status/1499202361180442627?s=20&t=PmAlFn3y2dhQSStkXyDCDA'],
  },
  {
    id: 'tmx-tribe-2026-01-05',
    name: 'TMX TRIBE',
    date: '2026-01-05',
    amountLost: 1400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Mint & Stake Loop Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['tmx', 'tribe', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/certikalert/status/2008360565010559045'],
  },
  {
    id: 'minterest-2024-07-15',
    name: 'Minterest',
    date: '2024-07-15',
    amountLost: 1400000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['minterest', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Minterest/status/1812540672248820033'],
  },
  {
    id: 'blueberry-2024-02-24',
    name: 'BlueBerry',
    date: '2024-02-24',
    amountLost: 1400000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['blueberry', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/blueberryFDN/status/1760872935982879030'],
  },
  {
    id: 'blueberry-protocol-2024-02-22',
    name: 'Blueberry Protocol',
    date: '2024-02-22',
    amountLost: 1350000,
    vulnerability: {
      type: 'oracle-manipulation',
      description: 'Oracle Manipulation exploit on Lending',
      detectors: ['oracle-manipulation', 'price-manipulation'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['blueberry', 'protocol', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/blueberry-rekt/'],
  },
  {
    id: 'kame-aggregator-2025-09-12',
    name: 'Kame Aggregator',
    date: '2025-09-12',
    amountLost: 1300000,
    vulnerability: {
      type: 'logic-error',
      description: 'swap() Function Flaw exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kame', 'aggregator', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/kame_agg/status/1967782820589568114'],
  },
  {
    id: 'growth-defi-2021-02-09',
    name: 'Growth DeFi',
    date: '2021-02-09',
    amountLost: 1300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['growth', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/the-big-combo/'],
  },
  {
    id: 'bitcoin-mission-2025-04-22',
    name: 'Bitcoin Mission',
    date: '2025-04-22',
    amountLost: 1300000,
    vulnerability: {
      type: 'logic-error',
      description: 'overPaper Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['bitcoin', 'mission', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/officer_cia/status/1914690926695362685'],
  },
  {
    id: 'monoswap-2024-07-31',
    name: 'Monoswap',
    date: '2024-07-31',
    amountLost: 1300000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Malware) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['monoswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/monoswapio/status/1816151998267547851'],
  },
  {
    id: 'riskonblast-2024-02-25',
    name: 'RiskOnBlast',
    date: '2024-02-25',
    amountLost: 1300000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['riskonblast', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.certik.com/resources/blog/risk-on-blast-incident-analysis'],
  },
  {
    id: 'lnd-2025-05-09',
    name: 'LND',
    date: '2025-05-09',
    amountLost: 1300000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lnd', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Lnd_fi/status/1920705062143250845'],
  },
  {
    id: 'geniusai-2024-05-05',
    name: 'GeniusAI',
    date: '2024-05-05',
    amountLost: 1270000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Discord Hack) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['geniusai', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cointelegraph.com/news/gnus-discord-hack-causes-1-27-million-losses'],
  },
  {
    id: 'aperocket-2021-07-14',
    name: 'ApeRocket',
    date: '2021-07-14',
    amountLost: 1260000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Incentive Rewards Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['aperocket', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.google.com/search?q=aperocketfi+hack&oq=aperocketfi+hack&aqs=chrome..69i57j33i10i160j33i21.3640j0j4&sourceid=chrome&ie=UTF-8'],
  },
  {
    id: 'save-2022-11-02',
    name: 'Save',
    date: '2022-11-02',
    amountLost: 1260000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['save', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/solendprotocol/status/1587671511137398784'],
  },
  {
    id: 'lendf-me-2020-04-19',
    name: 'Lendf.me',
    date: '2020-04-19',
    amountLost: 1200000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lendfme', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://slowmist.medium.com/slowmist-details-of-lendf-me-reentrancy-attack-3e168ab5f2b1'],
  },
  {
    id: 'steadefi-2023-08-08',
    name: 'Steadefi',
    date: '2023-08-08',
    amountLost: 1157000,
    vulnerability: {
      type: 'logic-error',
      description: 'Deployer Wallet Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['steadefi', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/steadefi/status/1688919583707877376'],
  },
  {
    id: 'kannagi-2023-07-30',
    name: 'Kannagi',
    date: '2023-07-30',
    amountLost: 1100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['kannagi', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/1685162644653973510'],
  },
  {
    id: 'levana-perps-2023-12-27',
    name: 'Levana Perps',
    date: '2023-12-27',
    amountLost: 1100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['levana', 'perps', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Levana_protocol/status/1740071199483543819'],
  },
  {
    id: 'sovryn-2022-10-04',
    name: 'Sovryn',
    date: '2022-10-04',
    amountLost: 1100000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sovryn', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.halborn.com/blog/post/explained-the-sovryn-hack-october-2022'],
  },
  {
    id: 'level-finance-2023-05-01',
    name: 'Level Finance',
    date: '2023-05-01',
    amountLost: 1100000,
    vulnerability: {
      type: 'logic-error',
      description: 'Logic Error exploit on Perp DEX',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['level', 'finance', 'perp'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/level-finance-rekt/'],
  },
  {
    id: 'cypher-2023-08-07',
    name: 'Cypher',
    date: '2023-08-07',
    amountLost: 1035000,
    vulnerability: {
      type: 'logic-error',
      description: 'Unknown exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['cypher', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/cypher_protocol/status/1688641036476731393'],
  },
  {
    id: 'level-perps-2023-05-01',
    name: 'Level Perps',
    date: '2023-05-01',
    amountLost: 1000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Referral Claims Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['level', 'perps', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1653149493133729794?t=ojjCnRcDogo3lOKIy8cKgA&s=19'],
  },
  {
    id: 'nowswap-2021-09-15',
    name: 'NowSwap',
    date: '2021-09-15',
    amountLost: 1000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Inconsistent Value in Code exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['nowswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/BlockSecTeam/status/1438100688215560192'],
  },
  {
    id: 'deltaprime-2024-07-23',
    name: 'DeltaPrime',
    date: '2024-07-23',
    amountLost: 1000000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['deltaprime', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/DeltaPrimeDefi/status/1815536737206026346'],
  },
  {
    id: 'sentiment-2023-04-04',
    name: 'Sentiment',
    date: '2023-04-04',
    amountLost: 1000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sentiment', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/spreekaway/status/1643314142214758410?t=Lsj87_GeYV3YDlVXX4bFHQ&s=19'],
  },
  {
    id: 'moonwell-lending-2025-11-04',
    name: 'Moonwell Lending',
    date: '2025-11-04',
    amountLost: 1000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Oracle Price Feed Manipulation exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['moonwell', 'lending', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/getfailsafe/status/1985628261913919702'],
  },
  {
    id: 'seedify-2025-09-23',
    name: 'Seedify',
    date: '2025-09-23',
    amountLost: 1000000,
    vulnerability: {
      type: 'logic-error',
      description: 'Infinite Mint and Dump exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['seedify', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/meta_alchemist/status/1970470733017968841'],
  },
  {
    id: 'us-permissionless-dollar-2025-12-04',
    name: 'US Permissionless Dollar',
    date: '2025-12-04',
    amountLost: 1000000,
    vulnerability: {
      type: 'logic-error',
      description: '"CPIMP" proxy front-run exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['permissionless', 'dollar', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/USPD_io/status/1996711283446464598'],
  },
  {
    id: 'sentinel-protocol-2023-04-04',
    name: 'Sentinel Protocol',
    date: '2023-04-04',
    amountLost: 1000000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on Lending',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sentinel', 'protocol', 'lending'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/sentiment-rekt/'],
  },
  {
    id: 'mars-perps-2025-12-14',
    name: 'Mars Perps',
    date: '2025-12-14',
    amountLost: 960000,
    vulnerability: {
      type: 'logic-error',
      description: 'Thin-Market Skew Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['mars', 'perps', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/mars_protocol/status/2000283619361800307'],
  },
  {
    id: 'venus-core-pool-2025-03-29',
    name: 'Venus Core Pool',
    date: '2025-03-29',
    amountLost: 902000,
    vulnerability: {
      type: 'donation-attack',
      description: 'Donation Attack exploit on DeFi Protocol',
      detectors: ['unchecked-transfer', 'reentrancy-no-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['venus', 'core', 'pool', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/yonikesel/status/1905993100738134408'],
  },
  {
    id: 'fegex-2024-12-29',
    name: 'Fegex',
    date: '2024-12-29',
    amountLost: 900000,
    vulnerability: {
      type: 'access-control',
      description: 'Missing Access Control exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['fegex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/Phalcon_xyz/status/1873634026444968034'],
  },
  {
    id: 'palmswap-2023-07-24',
    name: 'Palmswap',
    date: '2023-07-24',
    amountLost: 900000,
    vulnerability: {
      type: 'logic-error',
      description: 'Inflationary Accounting Manipulation exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['palmswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1683609019334950912'],
  },
  {
    id: 'rocketswap-base-2023-08-15',
    name: 'RocketSwap Base',
    date: '2023-08-15',
    amountLost: 865000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Brute Force) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['rocketswap', 'base', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Cointelegraph/status/1691316548932456448'],
  },
  {
    id: 'elasticswap-2022-12-13',
    name: 'ElasticSwap',
    date: '2022-12-13',
    amountLost: 854000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['elasticswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/ElasticSwap/status/1602582495819694081'],
  },
  {
    id: 'orange-finance-2025-01-08',
    name: 'Orange Finance',
    date: '2025-01-08',
    amountLost: 840000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Unknown Method) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['orange', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/0xorangefinance/status/1876863611458801890'],
  },
  {
    id: 'gmbl-computer-2023-09-06',
    name: 'GMBL.COMPUTER',
    date: '2023-09-06',
    amountLost: 815000,
    vulnerability: {
      type: 'logic-error',
      description: 'Referral Claims Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gmblcomputer', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/ImmuneBytes/status/1699338311230214536'],
  },
  {
    id: 'sudorare-2022-08-23',
    name: 'SudoRare',
    date: '2022-08-23',
    amountLost: 800000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sudorare', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.theblock.co/post/164970/nft-exchange-sudorare-suffers-800000-rug-pull-six-hours-after-launch'],
  },
  {
    id: 'balancer-v2-2023-08-27',
    name: 'Balancer V2',
    date: '2023-08-27',
    amountLost: 800000,
    vulnerability: {
      type: 'logic-error',
      description: 'logic-error exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['balancer', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/mevrefund/status/1695792040531960116'],
  },
  {
    id: 'hyperdrive-hl-2025-09-27',
    name: 'Hyperdrive HL',
    date: '2025-09-27',
    amountLost: 773000,
    vulnerability: {
      type: 'logic-error',
      description: 'Router Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hyperdrive', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/PeckShieldAlert/status/1972119238178754651'],
  },
  {
    id: 'sturdy-v1-2023-06-12',
    name: 'Sturdy V1',
    date: '2023-06-12',
    amountLost: 770000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['sturdy', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/blocksecteam/status/1668084629654638592'],
  },
  {
    id: 'autoshark-2021-05-24',
    name: 'AutoShark',
    date: '2021-05-24',
    amountLost: 745000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Incentive Rewards Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['autoshark', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://watchpug.medium.com/sharkfinance-performance-fee-minting-incident-analysis-4b2e3bd03923'],
  },
  {
    id: 'superrare-2025-07-28',
    name: 'SuperRare',
    date: '2025-07-28',
    amountLost: 730000,
    vulnerability: {
      type: 'access-control',
      description: 'updateMerkleRoot Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['superrare', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1949772114309132363'],
  },
  {
    id: '1inch-2024-10-31',
    name: '1inch',
    date: '2024-10-31',
    amountLost: 720000,
    vulnerability: {
      type: 'logic-error',
      description: 'Private Key Compromised (Supply Chain Attack) exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['1inch', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/1inch/status/1851832307746742686'],
  },
  {
    id: 'launchzone-2023-02-27',
    name: 'LaunchZone',
    date: '2023-02-27',
    amountLost: 700000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control Exploit exploit on DeFi Protocol',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['launchzone', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/immunefi/status/1630210901360951296?s=20'],
  },
  {
    id: 'merlin-2021-05-26',
    name: 'Merlin',
    date: '2021-05-26',
    amountLost: 680000,
    vulnerability: {
      type: 'logic-error',
      description: 'Math Mistake Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['merlin', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/merlin2-rekt/'],
  },
  {
    id: 'midas-capital-2023-01-17',
    name: 'Midas Capital',
    date: '2023-01-17',
    amountLost: 660000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Flashloan Reentrancy Attack exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['midas', 'capital', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/midas-capital-rekt/'],
  },
  {
    id: 'hector-lending-2023-06-02',
    name: 'Hector Lending',
    date: '2023-06-02',
    amountLost: 653000,
    vulnerability: {
      type: 'logic-error',
      description: 'Unknown exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hector', 'lending', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/Hector_Network/status/1664720154595414019'],
  },
  {
    id: 'ooki-2020-02-15',
    name: 'Ooki',
    date: '2020-02-15',
    amountLost: 650000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Slippage Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['ooki', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://www.coinbase.com/blog/around-the-block-analysis-on-the-bzx-attack-defi-vulnerabilities-the-state-of-debit-cards-in'],
  },
  {
    id: 'allbridge-core-2023-04-02',
    name: 'Allbridge Core',
    date: '2023-04-02',
    amountLost: 650000,
    vulnerability: {
      type: 'logic-error',
      description: 'Flashloan Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['allbridge', 'core', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://allbridge.medium.com/allbridge-core-updates-following-the-relaunch-9f7716eeb5da'],
  },
  {
    id: 'unibot-2023-10-31',
    name: 'Unibot',
    date: '2023-10-31',
    amountLost: 640000,
    vulnerability: {
      type: 'logic-error',
      description: 'Token approval exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['unibot', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1719223437024284978'],
  },
  {
    id: 'leetswap-2023-08-01',
    name: 'LeetSwap',
    date: '2023-08-01',
    amountLost: 620000,
    vulnerability: {
      type: 'logic-error',
      description: 'Liquidity Pools Compromised exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['leetswap', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/TheBlock__/status/1686201265758326784'],
  },
  {
    id: 'midas-capital-2023-06-17',
    name: 'Midas Capital',
    date: '2023-06-17',
    amountLost: 600000,
    vulnerability: {
      type: 'rounding-error',
      description: 'Redeem Rounding Error Exploit exploit on DeFi Protocol',
      detectors: ['divide-before-multiply', 'unchecked-transfer'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['midas', 'capital', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/peckshield/status/1670148905810403330?s=20'],
  },
  {
    id: 'blur-finance-2022-08-10',
    name: 'Blur Finance',
    date: '2022-08-10',
    amountLost: 600000,
    vulnerability: {
      type: 'logic-error',
      description: 'Drained Contracts exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['blur', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://cryptoslate.com/blur-finance-allegedly-rug-pulled-investors-at-a-combined-600k-loss/'],
  },
  {
    id: 'li-fi-2022-03-20',
    name: 'Li.Fi',
    date: '2022-03-20',
    amountLost: 600000,
    vulnerability: {
      type: 'access-control',
      description: 'Access Control exploit on Bridge Aggregator',
      detectors: ['arbitrary-send-eth', 'unprotected-upgrade', 'missing-zero-check', 'controlled-delegatecall'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['lifi', 'bridge'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/lifi-rekt/'],
  },
  {
    id: 'curve-dex-2022-08-09',
    name: 'Curve DEX',
    date: '2022-08-09',
    amountLost: 575000,
    vulnerability: {
      type: 'logic-error',
      description: 'DNS Spoofing exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['curve', 'dex', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/curve-finance-rekt/'],
  },
  {
    id: 'astera-fi-2025-10-09',
    name: 'Astera.fi',
    date: '2025-10-09',
    amountLost: 573000,
    vulnerability: {
      type: 'logic-error',
      description: 'Oracle Price Feed Manipulation exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['asterafi', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/hklst4r/status/1976296543872233508'],
  },
  {
    id: 'gmx-v1-perps-2022-09-18',
    name: 'GMX V1 Perps',
    date: '2022-09-18',
    amountLost: 565000,
    vulnerability: {
      type: 'logic-error',
      description: 'Price Oracle Attack exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['gmx', 'perps', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/jayantkrish/status/1571893643178569728?s=20&t=O--bs-V1Xnkmzm2JZOdZsw'],
  },
  {
    id: 'silo-finance-2025-06-25',
    name: 'Silo Finance',
    date: '2025-06-25',
    amountLost: 546000,
    vulnerability: {
      type: 'logic-error',
      description: 'fillQuote silo.borrow() Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['silo', 'finance', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1937882770216452174'],
  },
  {
    id: 'earning-farm-2023-08-09',
    name: 'Earning.Farm',
    date: '2023-08-09',
    amountLost: 540000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['earningfarm', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://twitter.com/CyversAlerts/status/1689193286420795393'],
  },
  {
    id: '0g-labs-2025-12-11',
    name: '0G Labs',
    date: '2025-12-11',
    amountLost: 516000,
    vulnerability: {
      type: 'logic-error',
      description: 'emergencyWithdraw Function Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['labs', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/CertiKAlert/status/1999481982858715247'],
  },
  {
    id: 'hedera-2023-03-10',
    name: 'Hedera',
    date: '2023-03-10',
    amountLost: 515000,
    vulnerability: {
      type: 'logic-error',
      description: 'Unknown exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['hedera', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://rekt.news/hedera-rekt/'],
  },
  {
    id: 'zunami-protocol-2025-05-15',
    name: 'Zunami Protocol',
    date: '2025-05-15',
    amountLost: 500000,
    vulnerability: {
      type: 'logic-error',
      description: 'withdrawStuckToken() exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['zunami', 'protocol', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/ZunamiProtocol/status/1922993510925435267'],
  },
  {
    id: 'clober-liquidity-vault-2024-12-10',
    name: 'Clober Liquidity Vault',
    date: '2024-12-10',
    amountLost: 500000,
    vulnerability: {
      type: 'reentrancy',
      description: 'Reentrancy exploit on DeFi Protocol',
      detectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['clober', 'liquidity', 'vault', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/peckshieldalert/status/1866434326596112705'],
  },
  {
    id: 'vestra-dao-2024-12-04',
    name: 'Vestra DAO',
    date: '2024-12-04',
    amountLost: 500000,
    vulnerability: {
      type: 'logic-error',
      description: 'Staking Logic Exploit exploit on DeFi Protocol',
      detectors: ['incorrect-equality', 'unchecked-transfer', 'arbitrary-send-eth'],
      codePatterns: [
        // No code patterns extracted
      ],
      nameKeywords: ['vestra', 'dao', 'defi'],
    },
    patch: {
      description: 'Fix applied',
      codePatterns: [
        // No patch patterns extracted
      ],
    },
    sources: ['https://x.com/_czepluch/status/1866112404242743590'],
  }
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
