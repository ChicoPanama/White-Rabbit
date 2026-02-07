/**
 * Recommendation engine — auto-generates fix recommendations per vuln type.
 *
 * Provides human-readable fix suggestions and, where applicable,
 * Solidity code snippets for well-known vulnerability patterns.
 */

import type { Finding } from '../agents/agent-types.js';

// ── Recommendation Rules ──

interface RecommendationRule {
  pattern: string;
  recommendation: string;
  codeFix?: string;
}

const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    pattern: 'reentrancy',
    recommendation: [
      'Add a reentrancy guard to prevent recursive calls. OpenZeppelin provides a battle-tested',
      'ReentrancyGuard contract. Apply the checks-effects-interactions pattern: perform all state',
      'changes before making external calls. Move all external calls (transfers, low-level calls)',
      'to the end of the function after all state updates are complete.',
    ].join(' '),
    codeFix: [
      '// Import OpenZeppelin ReentrancyGuard',
      'import "@openzeppelin/contracts/security/ReentrancyGuard.sol";',
      '',
      'contract SecureContract is ReentrancyGuard {',
      '    // Add nonReentrant modifier to vulnerable functions',
      '    function withdraw(uint256 amount) external nonReentrant {',
      '        // 1. CHECKS',
      '        require(balances[msg.sender] >= amount, "Insufficient balance");',
      '',
      '        // 2. EFFECTS (state changes BEFORE external calls)',
      '        balances[msg.sender] -= amount;',
      '',
      '        // 3. INTERACTIONS (external calls LAST)',
      '        (bool success, ) = msg.sender.call{value: amount}("");',
      '        require(success, "Transfer failed");',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    pattern: 'arithmetic',
    recommendation: [
      'Upgrade to Solidity 0.8+ which has built-in overflow/underflow protection.',
      'For contracts that must use Solidity 0.7 or below, use OpenZeppelin SafeMath library',
      'for all arithmetic operations. If using unchecked blocks in 0.8+, ensure all arithmetic',
      'within them is provably safe and add explicit bound checks before the unchecked block.',
    ].join(' '),
    codeFix: [
      '// For Solidity < 0.8: Use SafeMath',
      'import "@openzeppelin/contracts/utils/math/SafeMath.sol";',
      '',
      'contract SecureContract {',
      '    using SafeMath for uint256;',
      '',
      '    function calculate(uint256 a, uint256 b) public pure returns (uint256) {',
      '        return a.add(b); // Reverts on overflow',
      '    }',
      '}',
      '',
      '// For Solidity 0.8+ with unchecked blocks: Add explicit checks',
      'function safeCalculation(uint256 a, uint256 b) internal pure returns (uint256) {',
      '    require(a <= type(uint256).max - b, "Overflow");',
      '    unchecked {',
      '        return a + b;',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    pattern: 'access-control',
    recommendation: [
      'Implement role-based access control using OpenZeppelin AccessControl or Ownable.',
      'Add onlyOwner or onlyRole modifiers to all privileged functions. Consider using',
      'a timelock for critical operations and a multi-sig for admin access. Ensure',
      'constructor properly initializes the owner/admin roles.',
    ].join(' '),
    codeFix: [
      'import "@openzeppelin/contracts/access/AccessControl.sol";',
      '',
      'contract SecureContract is AccessControl {',
      '    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");',
      '',
      '    constructor() {',
      '        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);',
      '        _grantRole(ADMIN_ROLE, msg.sender);',
      '    }',
      '',
      '    function privilegedFunction() external onlyRole(ADMIN_ROLE) {',
      '        // Only callable by accounts with ADMIN_ROLE',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    pattern: 'oracle',
    recommendation: [
      'Use time-weighted average prices (TWAP) instead of spot prices to prevent',
      'single-block price manipulation. Add price deviation checks that reject',
      'prices deviating more than a threshold from the TWAP. Use multiple oracle',
      'sources (e.g., Chainlink + Uniswap TWAP) and validate consistency between them.',
      'Add minimum observation windows to prevent manipulation in short timeframes.',
    ].join(' '),
    codeFix: [
      '// Use Chainlink price feed with staleness check',
      'import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";',
      '',
      'function getPrice(AggregatorV3Interface feed) internal view returns (uint256) {',
      '    (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();',
      '    require(price > 0, "Invalid price");',
      '    require(block.timestamp - updatedAt < MAX_STALENESS, "Stale price");',
      '    return uint256(price);',
      '}',
      '',
      '// Cross-reference with TWAP',
      'function getValidatedPrice() internal view returns (uint256) {',
      '    uint256 spotPrice = getSpotPrice();',
      '    uint256 twapPrice = getTWAP(TWAP_WINDOW);',
      '    uint256 deviation = spotPrice > twapPrice',
      '        ? (spotPrice - twapPrice) * 1e18 / twapPrice',
      '        : (twapPrice - spotPrice) * 1e18 / twapPrice;',
      '    require(deviation <= MAX_DEVIATION, "Price deviation too high");',
      '    return spotPrice;',
      '}',
    ].join('\n'),
  },
  {
    pattern: 'flash-loan',
    recommendation: [
      'Add same-block transaction restrictions to prevent flash loan exploitation.',
      'Implement minimum lock periods for deposits before allowing withdrawals.',
      'Use TWAP pricing instead of spot prices for value calculations. Consider',
      'adding a delay mechanism that prevents deposit-and-immediately-exploit patterns.',
    ].join(' '),
    codeFix: [
      '// Prevent same-block deposit-and-withdraw (anti-flash-loan)',
      'mapping(address => uint256) public lastDepositBlock;',
      '',
      'function deposit(uint256 amount) external {',
      '    lastDepositBlock[msg.sender] = block.number;',
      '    // ... deposit logic',
      '}',
      '',
      'function withdraw(uint256 amount) external {',
      '    require(',
      '        block.number > lastDepositBlock[msg.sender],',
      '        "Cannot withdraw in same block as deposit"',
      '    );',
      '    // ... withdrawal logic',
      '}',
    ].join('\n'),
  },
  {
    pattern: 'dos',
    recommendation: [
      'Avoid unbounded loops over user-controlled arrays. Use pull-over-push patterns',
      'for fund distribution. Set gas limits on external calls. Implement pagination',
      'for batch operations. Ensure critical functions cannot be blocked by a single',
      'failing recipient.',
    ].join(' '),
  },
  {
    pattern: 'denial',
    recommendation: [
      'Avoid unbounded loops over user-controlled arrays. Use pull-over-push patterns',
      'for fund distribution. Set gas limits on external calls. Implement pagination',
      'for batch operations.',
    ].join(' '),
  },
  {
    pattern: 'governance',
    recommendation: [
      'Add a voting delay period before proposals can be executed. Implement',
      'quorum requirements. Add flash loan protection by requiring token holding',
      'duration before voting power is counted. Consider snapshot-based voting.',
    ].join(' '),
  },
  {
    pattern: 'freeze',
    recommendation: [
      'Add emergency withdrawal mechanisms with appropriate access controls.',
      'Implement timelock-based unlock schedules. Ensure users cannot be permanently',
      'locked out of their funds through any code path.',
    ].join(' '),
  },
  {
    pattern: 'mint',
    recommendation: [
      'Restrict minting functions to authorized roles only. Add supply caps.',
      'Implement a timelock on minting operations. Log all minting events.',
    ].join(' '),
  },
];

// ── Public API ──

/**
 * Generate a fix recommendation for a finding.
 */
export function generateRecommendation(finding: Finding): string {
  const vulnType = finding.vulnType.toLowerCase();
  const desc = finding.description.toLowerCase();

  // Try to match by vuln type first
  for (const rule of RECOMMENDATION_RULES) {
    if (vulnType.includes(rule.pattern)) {
      return rule.recommendation;
    }
  }

  // Try to match by description
  for (const rule of RECOMMENDATION_RULES) {
    if (desc.includes(rule.pattern)) {
      return rule.recommendation;
    }
  }

  // Generic fallback
  return [
    'Review the identified vulnerability and implement appropriate countermeasures.',
    'Consider using well-audited libraries (e.g., OpenZeppelin) for common patterns.',
    'Add comprehensive test coverage including edge cases and adversarial scenarios.',
    'Consider engaging a professional auditor for a thorough review.',
  ].join(' ');
}

/**
 * Generate a Solidity code fix snippet for well-known patterns.
 * Returns undefined for complex logic issues without a clear fix pattern.
 */
export function generateCodeFix(finding: Finding): string | undefined {
  const vulnType = finding.vulnType.toLowerCase();
  const desc = finding.description.toLowerCase();

  // Match by vuln type
  for (const rule of RECOMMENDATION_RULES) {
    if (vulnType.includes(rule.pattern) && rule.codeFix) {
      return rule.codeFix;
    }
  }

  // Match by description
  for (const rule of RECOMMENDATION_RULES) {
    if (desc.includes(rule.pattern) && rule.codeFix) {
      return rule.codeFix;
    }
  }

  // No code fix for complex/unknown patterns
  return undefined;
}

/**
 * Generate a complete recommendation section (text + optional code) for a finding.
 */
export function generateFullRecommendation(finding: Finding): string {
  const recommendation = generateRecommendation(finding);
  const codeFix = generateCodeFix(finding);

  const lines: string[] = [recommendation];

  if (codeFix) {
    lines.push('');
    lines.push('**Suggested fix:**');
    lines.push('```solidity');
    lines.push(codeFix);
    lines.push('```');
  }

  return lines.join('\n');
}
