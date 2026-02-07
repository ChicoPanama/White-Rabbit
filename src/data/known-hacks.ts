/**
 * Known Hacks Database
 *
 * A curated database of known smart contract vulnerabilities from real exploits.
 * Each entry contains:
 * - codePatterns: Regex patterns that match vulnerable code
 * - patchPatterns: Regex patterns that indicate the vulnerability was patched
 * - severity: Expected severity if matched
 * - exploitType: Category of the vulnerability
 * - exploitValue: Historical or estimated value at risk
 * - references: Links to post-mortems or analysis
 */

export interface KnownHack {
  id: string;
  name: string;
  exploitType: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  codePatterns: RegExp[];
  patchPatterns: RegExp[];
  functionPatterns?: RegExp[];
  exploitValue?: number;
  dateDiscovered?: string;
  affectedProtocols?: string[];
  references?: string[];
  attackVector: string;
  exploitTemplate?: string;
}

export const KNOWN_HACKS: KnownHack[] = [
  // ═══════════════════════════════════════════════════════════════════
  // REENTRANCY VULNERABILITIES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'reentrancy-eth-transfer-before-state',
    name: 'ETH Transfer Before State Update (Classic DAO)',
    exploitType: 'reentrancy',
    severity: 'critical',
    description: 'ETH sent before state variables are updated, allowing recursive calls',
    codePatterns: [
      // Pattern: call{value: ...}() before state update
      /\.call\{value:\s*[^}]+\}\s*\([^)]*\)[^;]*;[^}]*\b\w+\s*=\s*0/s,
      /\.call\{value:\s*[^}]+\}\s*\([^)]*\)[^;]*;[^}]*\b\w+\s*-=/s,
      // Pattern: transfer/send before balance update
      /\.transfer\([^)]+\)[^;]*;[^}]*balances?\[[^\]]+\]\s*=\s*0/s,
      /\.send\([^)]+\)[^;]*;[^}]*balances?\[[^\]]+\]\s*=\s*0/s,
    ],
    patchPatterns: [
      /balances?\[[^\]]+\]\s*=\s*0[^;]*;[^}]*\.call\{value:/s,
      /\bnonReentrant\b/,
      /ReentrancyGuard/,
      /_status\s*=\s*_ENTERED/,
    ],
    attackVector: 'reentrancy',
    exploitValue: 60_000_000,
    dateDiscovered: '2016-06-17',
    affectedProtocols: ['The DAO'],
    references: ['https://blog.ethereum.org/2016/06/17/critical-update-re-dao-vulnerability'],
  },
  {
    id: 'read-only-reentrancy',
    name: 'Read-Only Reentrancy (Curve-style)',
    exploitType: 'reentrancy',
    severity: 'high',
    description: 'Reentrant call during callback reads stale state used by external contracts',
    codePatterns: [
      // Pattern: get_virtual_price() or similar view function called externally
      /function\s+get_virtual_price\s*\([^)]*\)\s*(public|external)\s+view/,
      /function\s+getRate\s*\([^)]*\)\s*(public|external)\s+view/,
      // Pattern: raw_call with callback and external view dependency
      /raw_call\([^)]+\)[^;]*\n[^}]*get_virtual_price/s,
    ],
    patchPatterns: [
      /claim_admin_fees\s*\(\)[^}]*before/s,
      /\block\s*\(\s*\)/,
      /reentrancy_lock/,
    ],
    attackVector: 'read-only-reentrancy',
    exploitValue: 11_000_000,
    dateDiscovered: '2023-07-30',
    affectedProtocols: ['Curve', 'Conic Finance'],
    references: ['https://hackmd.io/@LlamaRisk/BJzSKHNjn'],
  },
  {
    id: 'cross-function-reentrancy',
    name: 'Cross-Function Reentrancy',
    exploitType: 'reentrancy',
    severity: 'high',
    description: 'Reentrancy across multiple functions sharing state',
    codePatterns: [
      // Pattern: withdraw and deposit sharing balances without reentrancy guard
      /function\s+withdraw[^{]*\{[^}]*\.call\{value:[^}]*\}[^}]*\}/s,
      /function\s+deposit[^{]*\{[^}]*balances?\[[^\]]+\]\s*\+=/s,
    ],
    patchPatterns: [
      /\bnonReentrant\b/,
      /ReentrancyGuard/,
    ],
    attackVector: 'reentrancy',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ORACLE MANIPULATION
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'spot-price-oracle',
    name: 'Spot Price Oracle Manipulation',
    exploitType: 'oracle-manipulation',
    severity: 'critical',
    description: 'Using spot price from AMM reserve ratios instead of TWAP',
    codePatterns: [
      // Pattern: getReserves() used for price calculation
      /getReserves\s*\(\)[^;]*\n[^}]*(reserve0|reserve1)[^}]*(\/|\*)[^}]*(reserve1|reserve0)/s,
      // Pattern: balanceOf used as price oracle
      /balanceOf\([^)]+\)[^}]*\/[^}]*balanceOf\(/s,
      // Pattern: sync() manipulation
      /\.sync\s*\(\)/,
    ],
    patchPatterns: [
      /\bTWAP\b/i,
      /\bobserve\s*\(/,
      /\btimeWeightedAverage/i,
      /\bChainlink\b/i,
      /\bAggregatorV3\b/,
    ],
    attackVector: 'flash-loan',
    exploitValue: 130_000_000,
    dateDiscovered: '2020-02-15',
    affectedProtocols: ['bZx', 'Harvest Finance', 'Warp Finance'],
    references: ['https://peckshield.medium.com/bzx-hack-full-disclosure-with-detailed-profit-analysis'],
  },
  {
    id: 'chainlink-stale-price',
    name: 'Chainlink Stale Price / No Freshness Check',
    exploitType: 'oracle-manipulation',
    severity: 'high',
    description: 'Using Chainlink price feed without checking updatedAt timestamp',
    codePatterns: [
      // Pattern: latestRoundData() without checking updatedAt
      /latestRoundData\s*\(\)[^;]*\n(?![^}]*updatedAt)/s,
      // Pattern: latestAnswer() (deprecated, no freshness check possible)
      /\.latestAnswer\s*\(\)/,
    ],
    patchPatterns: [
      /updatedAt\s*[><=]+\s*block\.timestamp/,
      /block\.timestamp\s*-\s*updatedAt\s*[<>]/,
      /require\([^)]*updatedAt/,
    ],
    attackVector: 'stale-oracle',
  },
  {
    id: 'lp-token-price-manipulation',
    name: 'LP Token Price Manipulation',
    exploitType: 'oracle-manipulation',
    severity: 'critical',
    description: 'LP token valuation using manipulable spot reserves',
    codePatterns: [
      // Pattern: LP price = reserves * prices / totalSupply
      /totalSupply\s*\(\)[^}]*getReserves/s,
      /getReserves[^}]*totalSupply\s*\(\)/s,
    ],
    patchPatterns: [
      /\bfairReserves\b/,
      /\balpha\s*\*\s*beta\b/,
    ],
    attackVector: 'flash-loan',
    exploitValue: 34_000_000,
    affectedProtocols: ['Warp Finance', 'ValueDeFi'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACCESS CONTROL
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'unprotected-initialize',
    name: 'Unprotected Initialize Function',
    exploitType: 'access-control',
    severity: 'critical',
    description: 'Initialize function can be called by anyone after deployment',
    codePatterns: [
      // Pattern: initialize without initializer modifier
      /function\s+initialize\s*\([^)]*\)\s*(public|external)(?!\s+initializer)/,
      // Pattern: init without protection
      /function\s+init\s*\([^)]*\)\s*(public|external)(?![^{]*only)/,
    ],
    patchPatterns: [
      /\binitializer\b/,
      /\bInitializable\b/,
      /require\s*\([^)]*!initialized/,
      /require\s*\([^)]*_initialized\s*==\s*false/,
    ],
    attackVector: 'direct-call',
    exploitValue: 80_000_000,
    dateDiscovered: '2021-08-10',
    affectedProtocols: ['Poly Network', 'Parity Wallet'],
  },
  {
    id: 'unprotected-selfdestruct',
    name: 'Unprotected Self-Destruct',
    exploitType: 'access-control',
    severity: 'critical',
    description: 'Self-destruct function can be called by unauthorized users',
    codePatterns: [
      /selfdestruct\s*\([^)]*\)/,
      /suicide\s*\([^)]*\)/,
    ],
    patchPatterns: [
      /onlyOwner[^}]*selfdestruct/s,
      /require\s*\([^)]*owner[^}]*selfdestruct/s,
    ],
    attackVector: 'direct-call',
    exploitValue: 150_000_000,
    dateDiscovered: '2017-11-06',
    affectedProtocols: ['Parity Multisig'],
    references: ['https://blog.openzeppelin.com/on-the-parity-wallet-multisig-hack-405a8c12e8f7'],
  },
  {
    id: 'tx-origin-auth',
    name: 'tx.origin Authentication',
    exploitType: 'access-control',
    severity: 'high',
    description: 'Using tx.origin for authentication allows phishing attacks',
    codePatterns: [
      /require\s*\(\s*tx\.origin\s*==\s*owner/,
      /if\s*\(\s*tx\.origin\s*!=\s*owner/,
    ],
    patchPatterns: [
      /msg\.sender\s*==\s*owner/,
      /tx\.origin\s*==\s*msg\.sender/,
    ],
    attackVector: 'phishing',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ARITHMETIC / OVERFLOW
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'unchecked-arithmetic-overflow',
    name: 'Unchecked Arithmetic Overflow',
    exploitType: 'arithmetic',
    severity: 'high',
    description: 'Arithmetic operations in unchecked blocks without bounds validation',
    codePatterns: [
      // Pattern: unchecked block with arithmetic
      /unchecked\s*\{[^}]*([\+\-\*])[^}]*\}/s,
    ],
    patchPatterns: [
      /SafeMath/,
      /require\s*\([^)]*<=\s*type\(uint/,
    ],
    attackVector: 'overflow',
  },
  {
    id: 'precision-loss-division-first',
    name: 'Precision Loss (Division Before Multiplication)',
    exploitType: 'arithmetic',
    severity: 'medium',
    description: 'Division performed before multiplication causes precision loss',
    codePatterns: [
      // Pattern: a / b * c where b > c likely
      /\w+\s*\/\s*\w+\s*\*\s*\w+/,
    ],
    patchPatterns: [
      /\w+\s*\*\s*\w+\s*\/\s*\w+/, // multiplication first
    ],
    attackVector: 'precision',
  },

  // ═══════════════════════════════════════════════════════════════════
  // FLASH LOAN ATTACKS
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'flash-loan-governance-attack',
    name: 'Flash Loan Governance Attack',
    exploitType: 'flash-loan',
    severity: 'critical',
    description: 'Governance voting power can be obtained via flash loans',
    codePatterns: [
      // Pattern: voting power based on current balance
      /function\s+(getVotes|votingPower|getPriorVotes)[^{]*\{[^}]*balanceOf/s,
      /votingPower\s*=\s*balanceOf/,
    ],
    patchPatterns: [
      /\bcheckpoints?\b/i,
      /\bgetPriorVotes\b/,
      /\bsnapshot\b/i,
      /block\.number\s*-\s*\d+/,
    ],
    attackVector: 'flash-loan',
    exploitValue: 182_000_000,
    dateDiscovered: '2022-04-17',
    affectedProtocols: ['Beanstalk'],
    references: ['https://rekt.news/beanstalk-rekt/'],
  },
  {
    id: 'flash-loan-collateral-manipulation',
    name: 'Flash Loan Collateral Manipulation',
    exploitType: 'flash-loan',
    severity: 'critical',
    description: 'Collateral value can be manipulated within a single transaction',
    codePatterns: [
      // Pattern: borrow/liquidate using current balance as collateral value
      /function\s+borrow[^{]*\{[^}]*balanceOf[^}]*\}/s,
      /function\s+liquidate[^{]*\{[^}]*getReserves[^}]*\}/s,
    ],
    patchPatterns: [
      /\bTWAP\b/i,
      /\bChainlink\b/i,
      /block\.timestamp\s*-\s*\w+\s*>=\s*\d+/,
    ],
    attackVector: 'flash-loan',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TOKEN / ERC20 ISSUES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'erc20-approve-race',
    name: 'ERC20 Approve Race Condition',
    exploitType: 'token',
    severity: 'medium',
    description: 'Approve function vulnerable to front-running race condition',
    codePatterns: [
      /function\s+approve[^{]*\{[^}]*allowance\[[^\]]+\]\[[^\]]+\]\s*=\s*\w+/s,
    ],
    patchPatterns: [
      /\bincreaseAllowance\b/,
      /\bdecreaseAllowance\b/,
      /require\s*\([^)]*allowance[^)]*==\s*0/,
    ],
    attackVector: 'frontrunning',
  },
  {
    id: 'fee-on-transfer-assumption',
    name: 'Fee-on-Transfer Token Assumption',
    exploitType: 'token',
    severity: 'medium',
    description: 'Contract assumes transfer amount equals received amount',
    codePatterns: [
      // Pattern: using amount directly after transferFrom
      /transferFrom\([^)]+,\s*[^)]+,\s*(\w+)\)[^;]*;[^}]*\1/s,
    ],
    patchPatterns: [
      /balanceOf\([^)]*\)[^;]*-[^;]*balanceOf\([^)]*\)/,
      /before\s*=\s*balanceOf/,
    ],
    attackVector: 'token-manipulation',
  },
  {
    id: 'rebasing-token-issue',
    name: 'Rebasing Token Accounting Issue',
    exploitType: 'token',
    severity: 'high',
    description: 'Contract does not account for rebasing token balance changes',
    codePatterns: [
      /mapping\s*\([^)]*=>\s*uint\)[^;]*balances/,
    ],
    patchPatterns: [
      /\bshares\b/,
      /\bwrapped\b/i,
    ],
    attackVector: 'token-manipulation',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PROXY / UPGRADE ISSUES
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'unprotected-upgrade',
    name: 'Unprotected Upgrade Function',
    exploitType: 'proxy',
    severity: 'critical',
    description: 'Upgrade function can be called by unauthorized users',
    codePatterns: [
      /function\s+upgradeTo[^{]*\{[^}]*_setImplementation/s,
      /function\s+_authorizeUpgrade[^{]*\{[^}]*\}/s,
    ],
    patchPatterns: [
      /onlyOwner[^}]*upgradeTo/s,
      /onlyOwner[^}]*_authorizeUpgrade/s,
      /require\s*\([^)]*owner[^}]*upgrade/s,
    ],
    attackVector: 'direct-call',
  },
  {
    id: 'delegatecall-to-untrusted',
    name: 'Delegatecall to Untrusted Contract',
    exploitType: 'proxy',
    severity: 'critical',
    description: 'Delegatecall target can be controlled by attacker',
    codePatterns: [
      /delegatecall\s*\([^)]*\)/,
    ],
    patchPatterns: [
      /onlyOwner[^}]*delegatecall/s,
      /require\s*\([^)]*trusted[^}]*delegatecall/s,
      /whitelist[^}]*delegatecall/s,
    ],
    attackVector: 'direct-call',
  },
  {
    id: 'storage-collision',
    name: 'Proxy Storage Collision',
    exploitType: 'proxy',
    severity: 'high',
    description: 'Proxy and implementation storage slots overlap',
    codePatterns: [
      // Proxy patterns without EIP-1967 slots
      /address\s+(public|private|internal)?\s*implementation/,
    ],
    patchPatterns: [
      /0x360894a13ba1a3210667c828492db98dca3e2076/, // EIP-1967 implementation slot
      /StorageSlot/,
    ],
    attackVector: 'storage-collision',
  },

  // ═══════════════════════════════════════════════════════════════════
  // MEV / FRONTRUNNING
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'sandwich-vulnerable-swap',
    name: 'Sandwich Attack Vulnerable Swap',
    exploitType: 'mev',
    severity: 'medium',
    description: 'Swap function vulnerable to sandwich attacks without slippage protection',
    codePatterns: [
      /function\s+swap[^{]*\{[^}]*(?!minAmount|slippage)[^}]*\}/s,
    ],
    patchPatterns: [
      /\bminAmount\w*\b/,
      /\bslippage\b/i,
      /\bdeadline\b/,
      /require\s*\([^)]*>=\s*\w*min/i,
    ],
    attackVector: 'mev',
  },
  {
    id: 'commit-reveal-bypass',
    name: 'Commit-Reveal Scheme Bypass',
    exploitType: 'mev',
    severity: 'high',
    description: 'Commit-reveal can be bypassed due to insufficient randomness',
    codePatterns: [
      /blockhash\s*\([^)]*\)/,
      /block\.(timestamp|number|difficulty)/,
    ],
    patchPatterns: [
      /\bVRF\b/,
      /\bChainlinkVRF\b/,
      /\brequestRandomWords\b/,
    ],
    attackVector: 'mev',
  },

  // ═══════════════════════════════════════════════════════════════════
  // SIGNATURE / REPLAY
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'signature-replay',
    name: 'Signature Replay Attack',
    exploitType: 'signature',
    severity: 'high',
    description: 'Signatures can be replayed across chains or contracts',
    codePatterns: [
      /ecrecover\s*\([^)]*\)/,
      /ECDSA\.recover\s*\([^)]*\)/,
    ],
    patchPatterns: [
      /\bnonces?\b/i,
      /\bchain\.id\b/,
      /\bblock\.chainid\b/,
      /\bEIP712\b/,
      /\bdomainSeparator\b/,
    ],
    attackVector: 'replay',
    exploitValue: 20_000_000,
    affectedProtocols: ['Optimism (Wintermute)'],
  },
  {
    id: 'signature-malleability',
    name: 'Signature Malleability',
    exploitType: 'signature',
    severity: 'medium',
    description: 'ECDSA signatures can be modified to create valid alternative signatures',
    codePatterns: [
      /ecrecover\s*\([^)]*\)/,
    ],
    patchPatterns: [
      /s\s*<=\s*0x7FFFFFFF/,
      /require\s*\([^)]*s\s*<=/,
      /ECDSA\.tryRecover/,
    ],
    attackVector: 'signature-malleability',
  },

  // ═══════════════════════════════════════════════════════════════════
  // BRIDGE / CROSS-CHAIN
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'bridge-signature-verification',
    name: 'Insufficient Bridge Signature Verification',
    exploitType: 'bridge',
    severity: 'critical',
    description: 'Bridge message verification can be bypassed',
    codePatterns: [
      /function\s+receiveMessage[^{]*\{/,
      /function\s+processMessage[^{]*\{/,
    ],
    patchPatterns: [
      /verifyProof/,
      /require\s*\([^)]*signatures?\s*>=\s*threshold/,
      /require\s*\([^)]*quorum/,
    ],
    attackVector: 'bridge-bypass',
    exploitValue: 625_000_000,
    dateDiscovered: '2022-03-23',
    affectedProtocols: ['Ronin Bridge'],
    references: ['https://rekt.news/ronin-rekt/'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // LENDING / BORROWING
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'interest-rate-manipulation',
    name: 'Interest Rate Manipulation',
    exploitType: 'lending',
    severity: 'high',
    description: 'Interest rate can be manipulated via large deposits/withdrawals',
    codePatterns: [
      /utilizationRate\s*=\s*\w+\s*\/\s*\w+/,
      /borrowRate\s*=[^;]*utilizationRate/,
    ],
    patchPatterns: [
      /\bkink\b/,
      /\bjumpMultiplier\b/,
      /rateModel/,
    ],
    attackVector: 'flash-loan',
  },
  {
    id: 'liquidation-threshold-manipulation',
    name: 'Liquidation Threshold Bypass',
    exploitType: 'lending',
    severity: 'critical',
    description: 'Liquidation can be triggered or avoided via price manipulation',
    codePatterns: [
      /function\s+liquidate[^{]*\{[^}]*getPrice[^}]*\}/s,
      /healthFactor\s*<\s*\d+/,
    ],
    patchPatterns: [
      /\bTWAP\b/i,
      /\bChainlink\b/i,
      /require\s*\([^)]*freshness/,
    ],
    attackVector: 'flash-loan',
    exploitValue: 100_000_000,
    affectedProtocols: ['Cream Finance', 'Venus'],
  },
];

/**
 * Match known hacks against contract source code.
 * Returns matching hacks with patch status.
 */
export function matchKnownHacks(
  sourceCode: string,
): Array<{
  hack: KnownHack;
  matchedPattern: string;
  isPatched: boolean;
  patchEvidence: string | null;
}> {
  const matches: Array<{
    hack: KnownHack;
    matchedPattern: string;
    isPatched: boolean;
    patchEvidence: string | null;
  }> = [];

  for (const hack of KNOWN_HACKS) {
    for (const pattern of hack.codePatterns) {
      const codeMatch = pattern.exec(sourceCode);
      if (codeMatch) {
        // Check if patched
        let isPatched = false;
        let patchEvidence: string | null = null;

        for (const patchPattern of hack.patchPatterns) {
          const patchMatch = patchPattern.exec(sourceCode);
          if (patchMatch) {
            isPatched = true;
            patchEvidence = patchMatch[0];
            break;
          }
        }

        matches.push({
          hack,
          matchedPattern: codeMatch[0].slice(0, 200), // Truncate for readability
          isPatched,
          patchEvidence,
        });
        break; // Only report each hack once per contract
      }
    }
  }

  return matches;
}

/**
 * Get hacks by exploit type.
 */
export function getHacksByType(exploitType: string): KnownHack[] {
  return KNOWN_HACKS.filter(h => h.exploitType === exploitType);
}

/**
 * Get high-value historical hacks.
 */
export function getHighValueHacks(minValue: number = 10_000_000): KnownHack[] {
  return KNOWN_HACKS.filter(h => (h.exploitValue ?? 0) >= minValue);
}
