import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { Contract, Finding, Scan, ScanStatus } from './types/index.js';

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
}
