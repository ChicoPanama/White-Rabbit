/**
 * Known Hacks Database — curated list of major DeFi exploits with
 * vulnerability signatures, patch detection patterns, and Slither detectors.
 *
 * Used by ForkHunterV2 to find unpatched forks of hacked protocols.
 * Sources: rekt.news leaderboard, post-mortems, and audit reports.
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

export const KNOWN_HACKS: KnownHack[] = [
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
