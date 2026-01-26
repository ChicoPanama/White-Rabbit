import Anthropic from '@anthropic-ai/sdk';
import type { Finding, AIAnalysisResult, Severity } from '../types/index.js';

const SYSTEM_PROMPT = `You are a senior smart contract security auditor specializing in DeFi protocols.
You review static analysis findings and assess whether they represent real vulnerabilities or false positives.
You focus on practical exploitability, not theoretical risks.

For each finding you MUST respond with valid JSON matching this schema:
{
  "isFalsePositive": boolean,
  "assessment": "string - 2-3 sentence explanation",
  "attackPath": "string or null - step-by-step exploit if real vulnerability",
  "recommendedFix": "string or null - specific code fix suggestion",
  "adjustedSeverity": "critical | high | medium | low | informational | null"
}`;

export class AIAnalyzer {
  private client: Anthropic | null;

  constructor(apiKey: string | null) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get isAvailable(): boolean {
    return this.client !== null;
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

    const userPrompt = `## Context
Protocol type: ${protocolType ?? 'Unknown DeFi protocol'}

## Contract Source Code
\`\`\`solidity
${truncatedSource}
\`\`\`

## Static Analysis Findings
${findingsSummary}

## Task
For EACH finding above, assess if it is a true positive or false positive.
Focus on:
- Flash loan attack vectors
- Oracle manipulation opportunities
- MEV exposure (sandwich attacks, frontrunning)
- Cross-contract reentrancy
- Access control gaps

Respond with a JSON array of assessments, one per finding, in the same order.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
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
        attackPath: string | null;
        recommendedFix: string | null;
        adjustedSeverity: string | null;
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

        return {
          findingId: finding.id,
          isFalsePositive: result.isFalsePositive,
          assessment: result.assessment,
          attackPath: result.attackPath ?? null,
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
