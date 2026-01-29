import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type {
  Contract,
  Finding,
  Scan,
  ScanStatus,
  AiRun,
  InsertAiRun,
  ContractTag,
  MemoryBundle,
} from './types/index.js';
import { CHAINS } from './types/index.js';

export class Database {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  // ── Contracts ──

  async upsertContract(data: {
    address: string;
    chainId: number;
    name?: string;
    sourceCode?: string;
    abi?: unknown[];
    compilerVersion?: string;
    isProxy?: boolean;
    implementationAddress?: string | null;
    tvlUsd?: number | null;
    protocolName?: string | null;
  }): Promise<string> {
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO contracts (id, address, chain_id, name, source_code, abi, compiler_version, is_proxy, implementation_address, tvl_usd, protocol_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (address, chain_id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, contracts.name),
         source_code = COALESCE(EXCLUDED.source_code, contracts.source_code),
         compiler_version = COALESCE(EXCLUDED.compiler_version, contracts.compiler_version),
         tvl_usd = COALESCE(EXCLUDED.tvl_usd, contracts.tvl_usd),
         protocol_name = COALESCE(EXCLUDED.protocol_name, contracts.protocol_name),
         updated_at = NOW()
       RETURNING id`,
      [
        id,
        data.address.toLowerCase(),
        data.chainId,
        data.name ?? null,
        data.sourceCode ?? null,
        data.abi ? JSON.stringify(data.abi) : null,
        data.compilerVersion ?? null,
        data.isProxy ?? false,
        data.implementationAddress ?? null,
        data.tvlUsd ?? null,
        data.protocolName ?? null,
      ],
    );
    return result.rows[0].id;
  }

  async getContract(id: string): Promise<Contract | null> {
    const result = await this.pool.query(
      `SELECT id, address, chain_id, name, source_code, abi, compiler_version, is_proxy, implementation_address, tvl_usd, protocol_name
       FROM contracts WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapContract(result.rows[0]);
  }

  async getContractByAddress(address: string, chainId: number): Promise<Contract | null> {
    const result = await this.pool.query(
      `SELECT id, address, chain_id, name, source_code, abi, compiler_version, is_proxy, implementation_address, tvl_usd, protocol_name
       FROM contracts WHERE address = $1 AND chain_id = $2`,
      [address.toLowerCase(), chainId],
    );
    if (result.rows.length === 0) return null;
    return this.mapContract(result.rows[0]);
  }

  async updateContractSource(id: string, sourceCode: string, compilerVersion: string): Promise<void> {
    await this.pool.query(
      `UPDATE contracts SET source_code = $1, compiler_version = $2, updated_at = NOW() WHERE id = $3`,
      [sourceCode, compilerVersion, id],
    );
  }

  // ── Scans ──

  async createScan(contractId: string, toolsUsed: string[]): Promise<Scan> {
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO scans (id, contract_id, status, tools_used) VALUES ($1, $2, 'running', $3) RETURNING *`,
      [id, contractId, toolsUsed],
    );
    return this.mapScan(result.rows[0]);
  }

  async updateScanStatus(scanId: string, status: ScanStatus, errorMessage?: string): Promise<void> {
    const completedAt = status === 'completed' || status === 'failed' ? new Date() : null;
    await this.pool.query(
      `UPDATE scans SET status = $1, completed_at = $2, error_message = $3 WHERE id = $4`,
      [status, completedAt, errorMessage ?? null, scanId],
    );
  }

  // ── Findings ──

  async saveFinding(finding: Finding): Promise<string> {
    const id = uuidv4();
    await this.pool.query(
      `INSERT INTO findings (id, scan_id, contract_id, detector_name, tool, severity, confidence, title, description, code_snippet, file_path, line_start, line_end, ai_assessment, ai_is_false_positive, deduplicated_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id,
        finding.scanId,
        finding.contractId,
        finding.detectorName,
        finding.tool,
        finding.severity,
        finding.confidence,
        finding.title,
        finding.description,
        finding.codeSnippet,
        finding.filePath,
        finding.lineStart,
        finding.lineEnd,
        finding.aiAssessment,
        finding.aiIsFalsePositive,
        finding.deduplicatedGroupId,
      ],
    );
    return id;
  }

  async getFinding(id: string): Promise<Finding | null> {
    const result = await this.pool.query(
      `SELECT * FROM findings WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapFinding(result.rows[0]);
  }

  async getFindingsByScan(scanId: string): Promise<Finding[]> {
    const result = await this.pool.query(
      `SELECT * FROM findings WHERE scan_id = $1 ORDER BY severity, detector_name`,
      [scanId],
    );
    return result.rows.map((r: Record<string, unknown>) => this.mapFinding(r));
  }

  // ── Notifications ──

  async hasNotification(messageHash: string, channel = 'telegram'): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM notifications WHERE message_hash = $1 AND channel = $2`,
      [messageHash, channel],
    );
    return result.rows.length > 0;
  }

  async saveNotification(findingId: string | null, contractId: string | null, messageHash: string, telegramMessageId?: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO notifications (id, finding_id, contract_id, channel, message_hash, telegram_message_id)
       VALUES ($1, $2, $3, 'telegram', $4, $5)
       ON CONFLICT (message_hash, channel) DO NOTHING`,
      [uuidv4(), findingId, contractId, messageHash, telegramMessageId ?? null],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // AI MEMORY OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Get AI run by prompt hash (for cache-first lookups)
   */
  async getAiRunByPromptHash(promptHash: string): Promise<AiRun | null> {
    const result = await this.pool.query(
      `SELECT id, prompt_hash, model, input_json, output_json, status, error_text,
              tokens_in, tokens_out, cost_usd, created_at
       FROM ai_runs WHERE prompt_hash = $1`,
      [promptHash],
    );
    if (result.rows.length === 0) return null;
    return this.mapAiRun(result.rows[0]);
  }

  /**
   * Insert a new AI run record
   */
  async insertAiRun(run: InsertAiRun): Promise<AiRun> {
    const id = uuidv4();
    const result = await this.pool.query(
      `INSERT INTO ai_runs (id, prompt_hash, model, input_json, output_json, status, error_text, tokens_in, tokens_out, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (prompt_hash) DO UPDATE SET
         output_json = EXCLUDED.output_json,
         status = EXCLUDED.status,
         error_text = EXCLUDED.error_text,
         tokens_in = EXCLUDED.tokens_in,
         tokens_out = EXCLUDED.tokens_out,
         cost_usd = EXCLUDED.cost_usd
       RETURNING *`,
      [
        id,
        run.promptHash,
        run.model,
        JSON.stringify(run.inputJson),
        JSON.stringify(run.outputJson),
        run.status ?? 'ok',
        run.errorText ?? null,
        run.tokensIn ?? null,
        run.tokensOut ?? null,
        run.costUsd ?? null,
      ],
    );
    return this.mapAiRun(result.rows[0]);
  }

  /**
   * Link an AI run to a finding context
   */
  async linkAiRunToFinding(params: {
    aiRunId: string;
    chain: string;
    address: string;
    findingHash: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO finding_ai_links (id, ai_run_id, chain, address, finding_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chain, address, finding_hash) DO UPDATE SET
         ai_run_id = EXCLUDED.ai_run_id`,
      [uuidv4(), params.aiRunId, params.chain.toLowerCase(), params.address.toLowerCase(), params.findingHash],
    );
  }

  /**
   * Get AI run linked to a specific finding
   */
  async getAiRunForFinding(chain: string, address: string, findingHash: string): Promise<AiRun | null> {
    const result = await this.pool.query(
      `SELECT ar.* FROM ai_runs ar
       JOIN finding_ai_links fal ON ar.id = fal.ai_run_id
       WHERE fal.chain = $1 AND fal.address = $2 AND fal.finding_hash = $3`,
      [chain.toLowerCase(), address.toLowerCase(), findingHash],
    );
    if (result.rows.length === 0) return null;
    return this.mapAiRun(result.rows[0]);
  }

  /**
   * Upsert a contract tag
   */
  async upsertContractTag(params: {
    chain: string;
    address: string;
    tag: string;
    value?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO contract_tags (id, chain, address, tag, value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chain, address, tag) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW()`,
      [uuidv4(), params.chain.toLowerCase(), params.address.toLowerCase(), params.tag, params.value ?? null],
    );
  }

  /**
   * Get all tags for a contract
   */
  async getContractTags(chain: string, address: string): Promise<ContractTag[]> {
    const result = await this.pool.query(
      `SELECT id, chain, address, tag, value, created_at, updated_at
       FROM contract_tags WHERE chain = $1 AND address = $2 ORDER BY tag`,
      [chain.toLowerCase(), address.toLowerCase()],
    );
    return result.rows.map((r: Record<string, unknown>) => this.mapContractTag(r));
  }

  /**
   * Get a compact memory bundle for a contract (optimized for Clawd tool usage)
   */
  async getContractMemoryBundle(params: {
    chain: string;
    address: string;
    limitScans?: number;
    limitFindings?: number;
    includeSummaries?: boolean;
    includeSimilar?: boolean;
  }): Promise<MemoryBundle | null> {
    const {
      chain,
      address,
      limitScans = 5,
      limitFindings = 25,
      includeSummaries = false,
      includeSimilar = false,
    } = params;
    const chainLower = chain.toLowerCase();
    const addressLower = address.toLowerCase();

    // Get chain ID from name
    const chainConfig = Object.values(CHAINS).find(
      c => c.name.toLowerCase() === chainLower || c.name === chain
    );
    const chainId = chainConfig?.chainId;

    if (!chainId) {
      // Try to find by treating chain as a chain ID
      const numericChainId = parseInt(chain, 10);
      if (isNaN(numericChainId)) {
        return null;
      }
    }

    // Get contract
    const contractResult = await this.pool.query(
      `SELECT id, address, chain_id, name, protocol_name, tvl_usd, is_proxy, compiler_version, first_seen_at
       FROM contracts WHERE address = $1 AND chain_id = $2`,
      [addressLower, chainId ?? parseInt(chain, 10)],
    );

    if (contractResult.rows.length === 0) {
      // Return empty bundle for unknown contract
      return {
        chain,
        address: addressLower,
        tags: [],
        scans: [],
        findings: [],
        stats: {
          totalScans: 0,
          totalFindings: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          aiAnalyzedCount: 0,
        },
        generatedAt: new Date().toISOString(),
        cached: false,
      };
    }

    const contractRow = contractResult.rows[0];
    const contractId = contractRow.id;

    // Get tags
    const tags = await this.getContractTags(chainLower, addressLower);

    // Get recent scans
    const scansResult = await this.pool.query(
      `SELECT id, started_at, completed_at, status, tools_used
       FROM scans WHERE contract_id = $1
       ORDER BY started_at DESC LIMIT $2`,
      [contractId, limitScans],
    );

    // Get findings with AI info
    const findingsResult = await this.pool.query(
      `SELECT f.id, f.detector_name, f.tool, f.severity, f.confidence, f.title, f.description,
              f.ai_assessment, f.ai_is_false_positive, f.created_at,
              ar.model as ai_model, ar.created_at as ai_created_at
       FROM findings f
       LEFT JOIN finding_ai_links fal ON fal.chain = $1 AND fal.address = $2
       LEFT JOIN ai_runs ar ON ar.id = fal.ai_run_id
       WHERE f.contract_id = $3
       ORDER BY
         CASE f.severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         f.created_at DESC
       LIMIT $4`,
      [chainLower, addressLower, contractId, limitFindings],
    );

    // Get counts
    const countsResult = await this.pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE severity = 'critical') as critical,
         COUNT(*) FILTER (WHERE severity = 'high') as high,
         COUNT(*) FILTER (WHERE severity = 'medium') as medium,
         COUNT(*) FILTER (WHERE severity = 'low') as low,
         COUNT(*) FILTER (WHERE ai_assessment IS NOT NULL) as ai_analyzed
       FROM findings WHERE contract_id = $1`,
      [contractId],
    );

    const totalScansResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM scans WHERE contract_id = $1`,
      [contractId],
    );

    const counts = countsResult.rows[0];
    const lastScan = scansResult.rows[0];

    // Build compact memory bundle
    const bundle: MemoryBundle = {
      chain,
      address: addressLower,
      contract: {
        name: contractRow.name || undefined,
        protocolName: contractRow.protocol_name || undefined,
        tvlUsd: contractRow.tvl_usd ? Number(contractRow.tvl_usd) : undefined,
        isProxy: contractRow.is_proxy || undefined,
        compilerVersion: contractRow.compiler_version || undefined,
        createdAt: contractRow.first_seen_at?.toISOString(),
      },
      tags: tags.map(t => ({ tag: t.tag, value: t.value || undefined })),
      lastSeen: lastScan ? {
        scanId: lastScan.id,
        ts: lastScan.completed_at?.toISOString() || lastScan.started_at?.toISOString(),
      } : undefined,
      scans: scansResult.rows.map((s: Record<string, unknown>) => ({
        scanId: s.id as string,
        startedAt: (s.started_at as Date)?.toISOString(),
        completedAt: (s.completed_at as Date)?.toISOString(),
        status: s.status as string,
        toolsUsed: s.tools_used as string[],
      })),
      findings: findingsResult.rows.map((f: Record<string, unknown>) => ({
        findingHash: this.computeFindingHash(chainLower, addressLower, f.detector_name as string, f.tool as string),
        severity: f.severity as string,
        confidence: f.confidence as string,
        title: f.title as string || f.detector_name as string,
        summary: this.truncate(f.description as string, 200),
        tool: f.tool as string,
        detectorName: f.detector_name as string,
        aiIsFalsePositive: f.ai_is_false_positive as boolean | undefined,
        ai: f.ai_model ? {
          model: f.ai_model as string,
          createdAt: (f.ai_created_at as Date)?.toISOString(),
          summary: f.ai_assessment ? this.truncate(f.ai_assessment as string, 150) : undefined,
          cached: true,
        } : undefined,
      })),
      stats: {
        totalScans: Number(totalScansResult.rows[0].total),
        totalFindings: Number(counts.total),
        criticalCount: Number(counts.critical),
        highCount: Number(counts.high),
        mediumCount: Number(counts.medium),
        lowCount: Number(counts.low),
        aiAnalyzedCount: Number(counts.ai_analyzed),
      },
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    // Add summaries if requested
    if (includeSummaries) {
      bundle.summaries = await this.getContractSummaries(chainLower, addressLower);
    }

    // Add similar contracts if requested
    if (includeSimilar) {
      bundle.similar = await this.getSimilarContracts(chainLower, addressLower);
    }

    return bundle;
  }

  /**
   * Get aggregated summaries for a contract (from AI analyses)
   */
  private async getContractSummaries(chain: string, address: string): Promise<Array<{
    scope: 'daily' | 'weekly' | 'lifetime';
    periodStart?: string;
    periodEnd?: string;
    text: string;
    aiRunId?: string;
  }>> {
    // Get recent AI analyses for this contract to build summaries
    const result = await this.pool.query(
      `SELECT ar.id, ar.output_json, ar.created_at
       FROM ai_runs ar
       JOIN finding_ai_links fal ON ar.id = fal.ai_run_id
       WHERE fal.chain = $1 AND fal.address = $2 AND ar.status = 'ok'
       ORDER BY ar.created_at DESC
       LIMIT 20`,
      [chain, address],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const summaries: Array<{
      scope: 'daily' | 'weekly' | 'lifetime';
      periodStart?: string;
      periodEnd?: string;
      text: string;
      aiRunId?: string;
    }> = [];

    // Build lifetime summary from all AI analyses
    const allAssessments = result.rows
      .map((r: Record<string, unknown>) => {
        const output = typeof r.output_json === 'string'
          ? JSON.parse(r.output_json as string)
          : r.output_json as Record<string, unknown>;
        return output.assessment || output.summary || '';
      })
      .filter((a: string) => a.length > 0);

    if (allAssessments.length > 0) {
      const oldest = result.rows[result.rows.length - 1];
      const newest = result.rows[0];

      // Combine and deduplicate key phrases
      const combined = this.summarizeAssessments(allAssessments);

      summaries.push({
        scope: 'lifetime',
        periodStart: (oldest.created_at as Date)?.toISOString(),
        periodEnd: (newest.created_at as Date)?.toISOString(),
        text: combined,
        aiRunId: newest.id as string,
      });
    }

    // Get daily summary (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyRows = result.rows.filter(
      (r: Record<string, unknown>) => new Date(r.created_at as string) >= oneDayAgo
    );

    if (dailyRows.length > 0) {
      const dailyAssessments = dailyRows
        .map((r: Record<string, unknown>) => {
          const output = typeof r.output_json === 'string'
            ? JSON.parse(r.output_json as string)
            : r.output_json as Record<string, unknown>;
          return output.assessment || output.summary || '';
        })
        .filter((a: string) => a.length > 0);

      if (dailyAssessments.length > 0) {
        summaries.push({
          scope: 'daily',
          periodStart: oneDayAgo.toISOString(),
          periodEnd: new Date().toISOString(),
          text: this.summarizeAssessments(dailyAssessments),
        });
      }
    }

    return summaries;
  }

  /**
   * Get similar contracts based on code fingerprints (from pattern cache)
   */
  private async getSimilarContracts(chain: string, address: string): Promise<Array<{
    chain: string;
    address: string;
    score: number;
    reasonSnippet?: string;
    contractName?: string;
    lastSeen?: string;
  }>> {
    // Look for contracts with matching code hashes or patterns
    // This queries the contracts table for similar protocol names or code structures
    const result = await this.pool.query(
      `SELECT c2.address, c2.chain_id, c2.name, c2.protocol_name, c2.updated_at,
              CASE
                WHEN c2.protocol_name = c1.protocol_name AND c2.protocol_name IS NOT NULL THEN 0.90
                WHEN c2.name = c1.name AND c2.name IS NOT NULL THEN 0.75
                WHEN c2.compiler_version = c1.compiler_version THEN 0.50
                ELSE 0.40
              END as similarity_score,
              CASE
                WHEN c2.protocol_name = c1.protocol_name THEN 'Same protocol'
                WHEN c2.name = c1.name THEN 'Same contract name'
                WHEN c2.compiler_version = c1.compiler_version THEN 'Same compiler version'
                ELSE 'Related'
              END as reason
       FROM contracts c1
       JOIN contracts c2 ON c1.id != c2.id
       WHERE c1.address = $1
         AND (
           (c2.protocol_name = c1.protocol_name AND c1.protocol_name IS NOT NULL)
           OR (c2.name = c1.name AND c1.name IS NOT NULL)
           OR (c2.compiler_version = c1.compiler_version)
         )
       ORDER BY similarity_score DESC
       LIMIT 10`,
      [address],
    );

    // Map chain_id back to chain name
    const chainIdToName: Record<number, string> = {};
    Object.entries(CHAINS).forEach(([name, config]) => {
      chainIdToName[config.chainId] = name;
    });

    return result.rows.map((r: Record<string, unknown>) => ({
      chain: chainIdToName[r.chain_id as number] || String(r.chain_id),
      address: r.address as string,
      score: Number(r.similarity_score),
      reasonSnippet: r.reason as string,
      contractName: r.name as string | undefined,
      lastSeen: (r.updated_at as Date)?.toISOString(),
    }));
  }

  /**
   * Summarize multiple AI assessments into a compact text
   */
  private summarizeAssessments(assessments: string[]): string {
    if (assessments.length === 0) return '';
    if (assessments.length === 1) return this.truncate(assessments[0], 500);

    // Extract key phrases and combine
    const keyPhrases = new Set<string>();
    const fpCount = assessments.filter(a => a.toLowerCase().includes('false positive')).length;
    const vulnCount = assessments.filter(a =>
      a.toLowerCase().includes('vulnerable') ||
      a.toLowerCase().includes('exploitable')
    ).length;

    // Add stats
    let summary = `Analyzed ${assessments.length} finding(s). `;

    if (fpCount > 0) {
      summary += `${fpCount} marked as false positive. `;
    }
    if (vulnCount > 0) {
      summary += `${vulnCount} flagged as potentially vulnerable. `;
    }

    // Add most recent assessment excerpt
    const recent = this.truncate(assessments[0], 300);
    if (recent) {
      summary += `Latest: ${recent}`;
    }

    return summary;
  }

  /**
   * Run migrations (simple sequential runner)
   */
  async runMigrations(migrationsDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Create migrations tracking table if not exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const applied = await this.pool.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.rows.map((r: { name: string }) => r.name));

    // Get migration files
    const files = fs.readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`[Database] Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      try {
        await this.pool.query(sql);
        await this.pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        console.log(`[Database] Migration applied: ${file}`);
      } catch (err) {
        console.error(`[Database] Migration failed: ${file}`, err);
        throw err;
      }
    }
  }

  // ── Lifecycle ──

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ── Mappers ──

  private mapContract(row: Record<string, unknown>): Contract {
    return {
      id: row.id as string,
      address: row.address as string,
      chainId: row.chain_id as number,
      name: (row.name as string) ?? '',
      sourceCode: (row.source_code as string) ?? '',
      abi: row.abi ? (typeof row.abi === 'string' ? JSON.parse(row.abi) : row.abi) as unknown[] : [],
      compilerVersion: (row.compiler_version as string) ?? '',
      isProxy: (row.is_proxy as boolean) ?? false,
      implementationAddress: (row.implementation_address as string) ?? null,
      tvlUsd: row.tvl_usd ? Number(row.tvl_usd) : null,
      protocolName: (row.protocol_name as string) ?? null,
    };
  }

  private mapScan(row: Record<string, unknown>): Scan {
    return {
      id: row.id as string,
      contractId: row.contract_id as string,
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      status: row.status as ScanStatus,
      toolsUsed: (row.tools_used as string[]) ?? [],
      errorMessage: (row.error_message as string) ?? null,
    };
  }

  private mapFinding(row: Record<string, unknown>): Finding {
    return {
      id: row.id as string,
      scanId: row.scan_id as string,
      contractId: row.contract_id as string,
      detectorName: row.detector_name as string,
      tool: row.tool as string,
      severity: row.severity as Finding['severity'],
      confidence: row.confidence as Finding['confidence'],
      title: (row.title as string) ?? '',
      description: row.description as string,
      codeSnippet: (row.code_snippet as string) ?? null,
      filePath: (row.file_path as string) ?? null,
      lineStart: row.line_start as number | null,
      lineEnd: row.line_end as number | null,
      aiAssessment: (row.ai_assessment as string) ?? null,
      aiIsFalsePositive: row.ai_is_false_positive as boolean | null,
      deduplicatedGroupId: (row.deduplicated_group_id as string) ?? null,
    };
  }

  private mapAiRun(row: Record<string, unknown>): AiRun {
    return {
      id: row.id as string,
      promptHash: row.prompt_hash as string,
      model: row.model as string,
      inputJson: typeof row.input_json === 'string'
        ? JSON.parse(row.input_json)
        : row.input_json as Record<string, unknown>,
      outputJson: typeof row.output_json === 'string'
        ? JSON.parse(row.output_json)
        : row.output_json as Record<string, unknown>,
      status: row.status as 'ok' | 'error',
      errorText: (row.error_text as string) ?? null,
      tokensIn: row.tokens_in as number | null,
      tokensOut: row.tokens_out as number | null,
      costUsd: row.cost_usd ? Number(row.cost_usd) : null,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapContractTag(row: Record<string, unknown>): ContractTag {
    return {
      id: row.id as string,
      chain: row.chain as string,
      address: row.address as string,
      tag: row.tag as string,
      value: (row.value as string) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Compute a stable hash for a finding (for AI linking)
   */
  private computeFindingHash(chain: string, address: string, detectorName: string, tool: string): string {
    const crypto = require('crypto');
    const input = `${chain}:${address}:${detectorName}:${tool}`.toLowerCase();
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  /**
   * Truncate text with ellipsis
   */
  private truncate(text: string, maxLen: number): string {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
  }
}
