import Anthropic from '@anthropic-ai/sdk';
import type { Finding, AIAnalysisResult, Severity } from '../types/index.js';

/**
 * Attack-focused system prompt.
 *
 * Key changes from passive "reviewer" prompt:
 * 1. Think like an ATTACKER, not an auditor
 * 2. Trace complete exploit paths with specific function calls
 * 3. Estimate profitability and capital requirements
 * 4. Check parameter bounds for arithmetic issues (SSV lesson)
 * 5. Consider MEV, flash loans, and cross-contract interactions
 */
const SYSTEM_PROMPT = `You are an OFFENSIVE smart contract security researcher. Your goal is to find and exploit vulnerabilities in DeFi protocols for bug bounties.

You think like an ATTACKER, not a reviewer. For each finding, you must:

1. IDENTIFY THE PROTOCOL ARCHETYPE:
   - AMM/DEX: Look for price manipulation, sandwich attacks, LP token exploits
   - Lending: Look for oracle manipulation, liquidation bypass, interest rate attacks
   - Vault/Yield: Look for share inflation, deposit/withdraw imbalance, reward manipulation
   - Staking: Look for reward draining, stake timing attacks, slashing bypass
   - Bridge: Look for message replay, signature bypass, state sync issues
   - Governance: Look for flash loan voting, timelock bypass, proposal manipulation

2. TRACE THE COMPLETE EXPLOIT PATH:
   - What external call triggers the vulnerability?
   - What internal state changes occur?
   - How does the attacker profit?
   - What is the exact sequence of transactions?

3. CHECK PARAMETER BOUNDS (Critical for arithmetic issues):
   - What values are required to trigger overflow/underflow?
   - Can these values actually be achieved given protocol constraints?
   - Check setter functions for require() statements that limit values
   - If trigger values exceed protocol maximums → FALSE POSITIVE

4. ESTIMATE PROFITABILITY:
   - What capital is required? (flash loan availability?)
   - What is the expected profit in USD?
   - What are the gas costs?
   - Is MEV competition likely to front-run?

5. ASSESS REAL-WORLD EXPLOITABILITY:
   - Is the vulnerable function externally callable?
   - Are there access controls that block the attack?
   - Is the timing window realistic?
   - Has a similar exploit been used before?

KNOWN ATTACK PATTERNS BY PROTOCOL TYPE:

AMM/DEX Attacks:
- Flash loan + swap to manipulate spot price
- Sandwich attacks on large swaps
- LP token price manipulation
- Fee-on-transfer token edge cases

Lending Attacks:
- Oracle manipulation for bad debt creation
- Collateral factor manipulation via flash deposits
- Interest rate manipulation via utilization spikes
- Liquidation front-running

Vault Attacks:
- First depositor share inflation (1 wei attack)
- Donation attacks to manipulate share price
- Flash loan deposit/withdraw cycles
- Reward token manipulation

For each finding, respond with valid JSON:
{
  "isFalsePositive": boolean,
  "assessment": "2-3 sentences explaining your reasoning",
  "protocolArchetype": "amm | lending | vault | staking | bridge | governance | unknown",
  "exploitPath": {
    "trigger": "The function call that starts the exploit",
    "steps": ["Step 1: Flash loan X tokens", "Step 2: Call vulnerable function", ...],
    "profit": "How attacker extracts value"
  } | null,
  "parameterBoundsCheck": {
    "requiredValue": "Value needed to trigger (e.g., fee > 2^64)",
    "protocolMax": "Maximum allowed by protocol (e.g., fee capped at 1e10)",
    "achievable": boolean
  } | null,
  "profitEstimate": {
    "requiredCapital": "$X (or 'flash loan')",
    "expectedProfit": "$X",
    "gasCost": "$X",
    "mevRisk": "low | medium | high"
  } | null,
  "adjustedSeverity": "critical | high | medium | low | informational | null",
  "recommendedFix": "Specific code fix" | null
}`;

/**
 * Protocol archetype detection patterns.
 */
const ARCHETYPE_PATTERNS: Record<string, RegExp[]> = {
  amm: [
    /\bswap\b/i,
    /\baddLiquidity\b/i,
    /\bremoveLiquidity\b/i,
    /\bgetReserves\b/i,
    /\bUniswap\b/i,
    /\bpair\b/i,
    /\bIUniswapV[23]/i,
  ],
  lending: [
    /\bborrow\b/i,
    /\brepay\b/i,
    /\bliquidate\b/i,
    /\bcollateral\b/i,
    /\bhealthFactor\b/i,
    /\bAave\b/i,
    /\bCompound\b/i,
    /\bcToken\b/i,
  ],
  vault: [
    /\bdeposit\b/i,
    /\bwithdraw\b/i,
    /\bshares?\b/i,
    /\bassets?\b/i,
    /\bERC4626\b/i,
    /\bvault\b/i,
    /\byield\b/i,
  ],
  staking: [
    /\bstake\b/i,
    /\bunstake\b/i,
    /\breward\b/i,
    /\bdelegate\b/i,
    /\bslash\b/i,
    /\bvalidator\b/i,
  ],
  bridge: [
    /\bbridge\b/i,
    /\bcrossChain\b/i,
    /\bmessage\b/i,
    /\brelay\b/i,
    /\bsourceChain\b/i,
    /\bdestinationChain\b/i,
  ],
  governance: [
    /\bpropose\b/i,
    /\bvote\b/i,
    /\bexecute\b/i,
    /\btimelock\b/i,
    /\bquorum\b/i,
    /\bGovernor\b/i,
  ],
};

export class AIAnalyzer {
  private client: Anthropic | null;

  constructor(apiKey: string | null) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Detect protocol archetype from source code.
   */
  detectArchetype(sourceCode: string): string {
    const scores: Record<string, number> = {};

    for (const [archetype, patterns] of Object.entries(ARCHETYPE_PATTERNS)) {
      scores[archetype] = patterns.filter(p => p.test(sourceCode)).length;
    }

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : 'unknown';
  }

  /**
   * Analyze a batch of findings for a single contract.
   * Returns AI assessments for each finding.
   */
  async analyzeFindingsBatch(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
  ): Promise<AIAnalysisResult[]> {
    if (!this.client || findings.length === 0) {
      return [];
    }

    const results: AIAnalysisResult[] = [];

    // Process findings in groups to stay within context limits
    const batchSize = 5;
    for (let i = 0; i < findings.length; i += batchSize) {
      const batch = findings.slice(i, i + batchSize);
      const batchResults = await this.analyzeBatch(batch, contractSource, protocolType);
      results.push(...batchResults);
    }

    return results;
  }

  private async analyzeBatch(
    findings: Finding[],
    contractSource: string,
    protocolType: string | null,
  ): Promise<AIAnalysisResult[]> {
    if (!this.client) return [];

    // Auto-detect protocol archetype if not provided
    const archetype = protocolType ?? this.detectArchetype(contractSource);

    const findingsSummary = findings.map((f, idx) => (
      `[Finding ${idx + 1}] ${f.detectorName} (${f.severity}/${f.confidence})
Tool: ${f.tool}
Description: ${f.description}
File: ${f.filePath ?? 'N/A'}, Lines: ${f.lineStart ?? '?'}-${f.lineEnd ?? '?'}
Code: ${f.codeSnippet ?? 'N/A'}`
    )).join('\n\n');

    // Truncate source to fit context window
    const maxSourceLen = 30_000;
    const truncatedSource = contractSource.length > maxSourceLen
      ? contractSource.slice(0, maxSourceLen) + '\n// ... (truncated)'
      : contractSource;

    const userPrompt = `## Protocol Analysis
Detected archetype: ${archetype.toUpperCase()}
${archetype !== 'unknown' ? `Focus on ${archetype}-specific attack patterns.` : ''}

## Contract Source Code
\`\`\`solidity
${truncatedSource}
\`\`\`

## Static Analysis Findings to Evaluate
${findingsSummary}

## Your Task
For EACH finding, act as an ATTACKER trying to exploit it:

1. Identify if this is exploitable given the contract's specific implementation
2. Trace the complete exploit path with specific function calls
3. For arithmetic issues: CHECK if trigger values are achievable (SSV lesson - parameter bounds matter!)
4. Estimate profitability (required capital, expected profit, gas costs)
5. Assess MEV risk (will searchers front-run you?)

If the exploit path is blocked by access controls, parameter bounds, or other mitigations → mark as FALSE POSITIVE with explanation.

Respond with a JSON array of assessments, one per finding, in the same order.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      return this.parseResponse(text, findings);
    } catch (err) {
      console.error('AI analysis failed:', err);
      return [];
    }
  }

  private parseResponse(text: string, findings: Finding[]): AIAnalysisResult[] {
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('AI response did not contain valid JSON array');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        isFalsePositive: boolean;
        assessment: string;
        protocolArchetype?: string;
        exploitPath?: {
          trigger: string;
          steps: string[];
          profit: string;
        } | null;
        parameterBoundsCheck?: {
          requiredValue: string;
          protocolMax: string;
          achievable: boolean;
        } | null;
        profitEstimate?: {
          requiredCapital: string;
          expectedProfit: string;
          gasCost: string;
          mevRisk: string;
        } | null;
        adjustedSeverity: string | null;
        recommendedFix: string | null;
      }>;

      return parsed.map((result, idx) => {
        const finding = findings[idx];
        if (!finding) return null;

        const severityMap: Record<string, Severity> = {
          critical: 'critical',
          high: 'high',
          medium: 'medium',
          low: 'low',
          informational: 'informational',
        };

        // Build detailed attack path string from structured response
        let attackPath: string | null = null;
        if (result.exploitPath) {
          const { trigger, steps, profit } = result.exploitPath;
          attackPath = `TRIGGER: ${trigger}\n` +
            steps.map((s, i) => `${i + 1}. ${s}`).join('\n') +
            `\nPROFIT: ${profit}`;
        }

        // Append profitability info if available
        if (result.profitEstimate) {
          const est = result.profitEstimate;
          attackPath = (attackPath ?? '') +
            `\n\nPROFIT ESTIMATE:\n` +
            `- Required capital: ${est.requiredCapital}\n` +
            `- Expected profit: ${est.expectedProfit}\n` +
            `- Gas cost: ${est.gasCost}\n` +
            `- MEV risk: ${est.mevRisk}`;
        }

        // If parameter bounds check shows unachievable → override to FP
        let isFP = result.isFalsePositive;
        let assessment = result.assessment;
        if (result.parameterBoundsCheck && !result.parameterBoundsCheck.achievable) {
          isFP = true;
          assessment += ` [BOUNDS CHECK: Required ${result.parameterBoundsCheck.requiredValue} but protocol max is ${result.parameterBoundsCheck.protocolMax}]`;
        }

        return {
          findingId: finding.id,
          isFalsePositive: isFP,
          assessment,
          attackPath,
          recommendedFix: result.recommendedFix ?? null,
          adjustedSeverity: result.adjustedSeverity
            ? (severityMap[result.adjustedSeverity.toLowerCase()] ?? null)
            : null,
        };
      }).filter((r): r is AIAnalysisResult => r !== null);
    } catch (err) {
      console.error('Failed to parse AI response:', err);
      return [];
    }
  }
}
