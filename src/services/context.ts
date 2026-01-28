import type {
  ContractContext,
  FalsePositivePattern,
  Finding,
  VerificationStatus,
} from '../types/index.js';

/**
 * Known audited protocols and their associated names.
 * A finding against these protocols gets a confidence penalty
 * since they've been professionally reviewed.
 */
const KNOWN_AUDITED_PROTOCOLS: Record<string, string[]> = {
  uniswap: ['OpenZeppelin', 'Trail of Bits', 'ABDK'],
  aave: ['OpenZeppelin', 'Trail of Bits', 'SigmaPrime', 'Certora'],
  compound: ['OpenZeppelin', 'Trail of Bits'],
  makerdao: ['Trail of Bits', 'Runtime Verification'],
  lido: ['Statemind', 'MixBytes', 'Ackee'],
  curve: ['Trail of Bits', 'MixBytes'],
  balancer: ['OpenZeppelin', 'Trail of Bits', 'Certora'],
  yearn: ['MixBytes', 'Dedaub'],
  sushi: ['PeckShield', 'Quantstamp'],
  chainlink: ['Trail of Bits', 'SigmaPrime'],
  openzeppelin: ['Internal', 'Trail of Bits'],
  morpho: ['Spearbit', 'Trail of Bits'],
  eigenlayer: ['Sigma Prime', 'Dedaub'],
};

/**
 * Known false-positive patterns: if a detector fires but the source code
 * contains a specific pattern, it's almost certainly a false alarm.
 */
const FALSE_POSITIVE_PATTERNS: FalsePositivePattern[] = [
  {
    detector: 'reentrancy-eth',
    codePattern: /ReentrancyGuard|nonReentrant|_status\s*==\s*_NOT_ENTERED/i,
    reason: 'Contract uses ReentrancyGuard modifier',
  },
  {
    detector: 'reentrancy-no-eth',
    codePattern: /ReentrancyGuard|nonReentrant/i,
    reason: 'Contract uses ReentrancyGuard modifier',
  },
  {
    detector: 'arbitrary-send-eth',
    codePattern: /onlyOwner|onlyAdmin|onlyRole|hasRole|AccessControl/i,
    reason: 'Function is access-controlled',
  },
  {
    detector: 'arbitrary-send-erc20',
    codePattern: /onlyOwner|onlyAdmin|onlyRole|hasRole|AccessControl/i,
    reason: 'Function is access-controlled',
  },
  {
    detector: 'controlled-delegatecall',
    codePattern: /onlyOwner|onlyAdmin|onlyProxy|_checkProxy/i,
    reason: 'Delegatecall is access-controlled or part of proxy pattern',
  },
  {
    detector: 'suicidal',
    codePattern: /onlyOwner|onlyAdmin/i,
    reason: 'Self-destruct is access-controlled',
  },
  {
    detector: 'uninitialized-state',
    codePattern: /Initializable|initializer|__init|constructor\s*\(/i,
    reason: 'Contract uses initializer pattern',
  },
  {
    detector: 'oracle-manipulation',
    codePattern: /TWAP|twap|timeWeightedAverage|observe\(/i,
    reason: 'Contract uses TWAP oracle (manipulation resistant)',
  },
  {
    detector: 'tx-origin',
    codePattern: /tx\.origin\s*==\s*msg\.sender/i,
    reason: 'tx.origin used as additional check alongside msg.sender',
  },
  {
    detector: 'timestamp',
    codePattern: /block\.timestamp\s*[><=]+\s*\w+\s*\+\s*\d+/i,
    reason: 'Timestamp used with reasonable tolerance window',
  },
  {
    detector: 'assembly',
    codePattern: /contract\s+UnstructuredStorage|function\s+\w*Storage\w*|getStorage\w+|setStorage\w+/i,
    reason: 'Assembly in storage utility contract (expected low-level access)',
  },
  {
    detector: 'assembly', 
    codePattern: /contract\s+DelegateProxy|function\s+delegated\w+|delegatecall\s*\(/i,
    reason: 'Assembly in proxy contract (expected for delegation patterns)',
  },
  {
    detector: 'assembly',
    codePattern: /function\s+isContract|contract\s+IsContract|\bextcodesize\b/i,
    reason: 'Assembly in contract detection utility (standard pattern)',
  },
  {
    detector: 'constant-function-asm',
    codePattern: /view\s+.*\{[\s\S]*assembly[\s\S]*\}/i,
    reason: 'View function with assembly for gas optimization (common pattern)',
  },
  {
    detector: 'assembly',
    codePattern: /@openzeppelin|OpenZeppelin|import.*openzeppelin/i,
    reason: 'Assembly in OpenZeppelin library contracts (audited and battle-tested)',
  },
];

export class ContextService {
  /**
   * Gather contextual information about a contract from its source code
   * and known protocol mappings.
   */
  analyzeContext(sourceCode: string, contractName: string | null, protocolName: string | null): ContractContext {
    const normalizedProtocol = protocolName?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
    const normalizedName = contractName?.toLowerCase() ?? '';

    // Check known audited protocols
    let isAudited = false;
    let auditedBy: string[] = [];
    let knownProtocol: string | null = null;

    for (const [protocol, auditors] of Object.entries(KNOWN_AUDITED_PROTOCOLS)) {
      if (
        normalizedProtocol.includes(protocol) ||
        normalizedName.includes(protocol) ||
        sourceCode.toLowerCase().includes(`@${protocol}`) ||
        sourceCode.toLowerCase().includes(`${protocol}/`)
      ) {
        isAudited = true;
        auditedBy = auditors;
        knownProtocol = protocol;
        break;
      }
    }

    // Also check for common OpenZeppelin imports (widely audited library)
    if (!isAudited && sourceCode.includes('@openzeppelin/')) {
      // Using OZ doesn't mean the whole contract is audited,
      // but the imported components are battle-tested.
      // We don't set isAudited=true, but note it in context.
    }

    return {
      isAudited,
      auditedBy,
      knownProtocol,
      contractAgeDays: null, // Would need on-chain data to compute
      hasReentrancyGuard: /ReentrancyGuard|nonReentrant/i.test(sourceCode),
      hasAccessControl: /Ownable|AccessControl|onlyOwner|onlyRole|hasRole/i.test(sourceCode),
      hasTimelocks: /TimelockController|timelock|delay\s*>/i.test(sourceCode),
      hasPauseability: /Pausable|whenNotPaused|_pause\(\)/i.test(sourceCode),
      usesOracle: /oracle|priceFeed|chainlink|AggregatorV3/i.test(sourceCode),
      usesTWAP: /TWAP|twap|timeWeightedAverage|observe\(/i.test(sourceCode),
    };
  }

  /**
   * Check if a finding matches any known false-positive pattern.
   * Returns the matching pattern or null.
   */
  checkFalsePositive(finding: Finding, sourceCode: string): FalsePositivePattern | null {
    const normalizedDetector = finding.detectorName.toLowerCase().replace(/[-_]/g, '');

    for (const pattern of FALSE_POSITIVE_PATTERNS) {
      const normalizedPattern = pattern.detector.toLowerCase().replace(/[-_]/g, '');
      if (normalizedDetector.includes(normalizedPattern)) {
        if (pattern.codePattern.test(sourceCode)) {
          return pattern;
        }
      }
    }

    return null;
  }

  /**
   * Filter findings through false-positive pattern matching.
   * Returns findings annotated with FP status.
   */
  filterFalsePositives(findings: Finding[], sourceCode: string): {
    real: Finding[];
    falsePositives: Array<{ finding: Finding; reason: string }>;
  } {
    const real: Finding[] = [];
    const falsePositives: Array<{ finding: Finding; reason: string }> = [];

    for (const finding of findings) {
      const fpMatch = this.checkFalsePositive(finding, sourceCode);
      if (fpMatch) {
        falsePositives.push({ finding, reason: fpMatch.reason });
      } else {
        real.push(finding);
      }
    }

    return { real, falsePositives };
  }

  /**
   * Compute a confidence score (0-100) for a finding based on
   * tool confidence, context, and tool consensus.
   */
  computeConfidenceScore(
    finding: Finding,
    context: ContractContext,
    toolsAgreeing: string[],
    pocSucceeded: boolean | null,
  ): number {
    // Base score from tool confidence
    const confidenceBase: Record<string, number> = { high: 60, medium: 40, low: 20 };
    let score = confidenceBase[finding.confidence] ?? 40;

    // Tool consensus bonus
    if (toolsAgreeing.length >= 3) {
      score += 30;
    } else if (toolsAgreeing.length >= 2) {
      score += 20;
    }

    // Context penalties
    if (context.isAudited) {
      score -= 20;
    }
    if (context.contractAgeDays !== null && context.contractAgeDays > 365) {
      score -= 10; // Battle-tested
    }

    // Security pattern penalties for specific detectors
    const detector = finding.detectorName.toLowerCase();
    if (detector.includes('reentrancy') && context.hasReentrancyGuard) {
      score -= 30;
    }
    if (detector.includes('access') && context.hasAccessControl) {
      score -= 20;
    }
    if (detector.includes('oracle') && context.usesTWAP) {
      score -= 25;
    }

    // PoC result
    if (pocSucceeded === true) {
      score += 40; // Confirmed exploitable
    } else if (pocSucceeded === false) {
      score -= 30; // PoC failed
    }

    // Clamp 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine verification status from confidence score and PoC result.
   */
  determineVerificationStatus(
    confidenceScore: number,
    pocSucceeded: boolean | null,
    isFPPattern: boolean,
    toolsAgreeing: number,
  ): VerificationStatus {
    if (isFPPattern) {
      return 'false_positive';
    }
    if (pocSucceeded === true) {
      return 'verified';
    }
    if (pocSucceeded === false) {
      return 'likely_false';
    }
    if (toolsAgreeing >= 2 && confidenceScore >= 50) {
      return 'likely_real';
    }
    if (confidenceScore >= 40) {
      return 'needs_review';
    }
    return 'likely_false';
  }
}
