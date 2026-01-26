/**
 * Pattern Cache — The Learning Brain
 *
 * SQLite-backed persistent storage for learned vulnerability patterns,
 * contract fingerprints, and fork relationships. One verified finding
 * becomes a reusable pattern that can find dozens of vulnerable forks.
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import type {
  VulnerabilityPattern,
  CodeSignatures,
  ExploitTemplate,
  PatternInstance,
  ContractFingerprint,
  PatternEvolutionEntry,
  LearningStats,
  Finding,
  VerifiedFinding,
} from '../types/index.js';

const DEFAULT_DB_DIR = join(homedir(), '.etherscan-auditor');
const DEFAULT_DB_PATH = join(DEFAULT_DB_DIR, 'patterns.db');

function generateId(): string {
  return createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 24);
}

export class PatternCache {
  private db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        pattern_hash TEXT UNIQUE NOT NULL,
        pattern_type TEXT NOT NULL,
        code_signatures TEXT NOT NULL,
        first_seen_contract TEXT,
        first_seen_chain INTEGER,
        first_seen_date TEXT,
        exploit_template TEXT,
        false_positive_signatures TEXT DEFAULT '[]',
        true_positive_rate REAL DEFAULT 1.0,
        total_value_at_risk REAL DEFAULT 0,
        evolution_history TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pattern_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        exploitable_value REAL DEFAULT 0,
        verified INTEGER DEFAULT 0,
        verified_date TEXT,
        verification_method TEXT,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE,
        UNIQUE(pattern_id, contract_address, chain_id)
      );

      CREATE TABLE IF NOT EXISTS fingerprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        contract_name TEXT,
        code_hash TEXT NOT NULL,
        normalized_hash TEXT,
        structure_hash TEXT,
        interface_hash TEXT,
        function_signatures TEXT DEFAULT '[]',
        event_signatures TEXT DEFAULT '[]',
        bytecode_hash TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(contract_address, chain_id)
      );

      CREATE TABLE IF NOT EXISTS similarity_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fingerprint_id_a INTEGER NOT NULL,
        fingerprint_id_b INTEGER NOT NULL,
        similarity_score REAL NOT NULL,
        match_type TEXT NOT NULL,
        FOREIGN KEY (fingerprint_id_a) REFERENCES fingerprints(id) ON DELETE CASCADE,
        FOREIGN KEY (fingerprint_id_b) REFERENCES fingerprints(id) ON DELETE CASCADE,
        UNIQUE(fingerprint_id_a, fingerprint_id_b)
      );

      CREATE TABLE IF NOT EXISTS learning_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        pattern_id TEXT,
        contract_address TEXT,
        chain_id INTEGER,
        details TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        contract_name TEXT,
        findings_count INTEGER DEFAULT 0,
        verified_count INTEGER DEFAULT 0,
        false_positive_count INTEGER DEFAULT 0,
        exploitable_value REAL DEFAULT 0,
        scan_duration_ms INTEGER,
        tools_used TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_fp_hashes ON fingerprints(code_hash, normalized_hash, structure_hash);
      CREATE INDEX IF NOT EXISTS idx_fp_interface ON fingerprints(interface_hash);
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_instances_pattern ON pattern_instances(pattern_id);
      CREATE INDEX IF NOT EXISTS idx_instances_chain ON pattern_instances(chain_id);
      CREATE INDEX IF NOT EXISTS idx_learning_type ON learning_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_address ON audit_history(contract_address, chain_id);
    `);
  }

  // ── Pattern Learning ──

  /**
   * Learn a vulnerability pattern from a verified finding.
   * If the pattern already exists, adds a new instance.
   */
  learnPattern(
    finding: VerifiedFinding,
    contractAddress: string,
    chainId: number,
    sourceCode: string,
  ): VulnerabilityPattern {
    const signatures = this.extractCodeSignatures(finding, sourceCode);
    const patternHash = this.hashSignatures(signatures);

    // Check if pattern already exists
    const existing = this.getPatternByHash(patternHash);
    if (existing) {
      this.addInstance(existing.id, contractAddress, chainId, finding);
      this.logEvent('true_positive', existing.id, contractAddress, chainId, {
        detector: finding.detectorName,
        confidence: finding.confidenceScore,
      });
      return this.getPattern(existing.id)!;
    }

    // Create new pattern
    const id = generateId();
    const now = new Date().toISOString();
    const exploitableValue = finding.exploitEstimate?.estimatedExploitable ?? 0;

    const exploitTemplate: ExploitTemplate | null = finding.pocResult?.exploitContract
      ? {
          soliditySnippet: finding.pocResult.exploitContract,
          detectorName: finding.detectorName,
          attackVector: this.categorizeVulnerability(finding),
          requiredSetup: [],
        }
      : null;

    const pattern: VulnerabilityPattern = {
      id,
      patternHash,
      patternType: this.categorizeVulnerability(finding),
      codeSignatures: signatures,
      firstSeenContract: contractAddress,
      firstSeenChain: chainId,
      firstSeenDate: now,
      falsePositiveSignatures: [],
      truePositiveRate: 1.0,
      totalValueAtRisk: exploitableValue,
      exploitTemplate,
      evolutionHistory: [{
        date: now,
        change: 'Pattern created',
        reason: `First seen at ${contractAddress} on chain ${chainId}`,
      }],
      createdAt: now,
      updatedAt: now,
    };

    this.savePattern(pattern);
    this.addInstance(id, contractAddress, chainId, finding);
    this.logEvent('new_pattern', id, contractAddress, chainId, {
      patternType: pattern.patternType,
      exploitableValue,
    });

    return pattern;
  }

  /**
   * Extract code signatures from a finding and source code.
   */
  extractCodeSignatures(finding: Finding, sourceCode: string): CodeSignatures {
    const vulnerableCode = finding.codeSnippet ?? '';
    const regexPatterns = this.generateRegexPatterns(vulnerableCode, finding.detectorName);
    const functionSigs = this.extractFunctionSignatures(sourceCode);
    const eventSigs = this.extractEventSignatures(sourceCode);

    return {
      exactMatch: vulnerableCode ? [vulnerableCode] : [],
      regexPatterns,
      functionSignatures: functionSigs,
      eventSignatures: eventSigs,
    };
  }

  /**
   * Generate regex patterns that match variations of the vulnerable code.
   */
  private generateRegexPatterns(code: string, detectorName: string): string[] {
    const patterns: string[] = [];
    if (!code) return patterns;

    // Detector-specific patterns
    if (detectorName.includes('reentrancy')) {
      if (code.includes('.call{')) patterns.push('\\.call\\{.*value.*\\}\\(');
      if (code.includes('.call(')) patterns.push('\\.call\\(');
      patterns.push('\\.(call|send|transfer)\\(');
    }
    if (detectorName.includes('arbitrary-send')) {
      patterns.push('\\.call\\{.*value.*\\}\\(');
      patterns.push('\\.transfer\\(');
    }
    if (detectorName.includes('oracle') || detectorName.includes('price')) {
      patterns.push('getReserves|getAmountsOut|latestAnswer|getRoundData');
    }
    if (detectorName.includes('access-control') || detectorName.includes('unprotected')) {
      patterns.push('selfdestruct|delegatecall|upgradeTo');
    }
    if (detectorName.includes('unchecked')) {
      patterns.push('transfer\\(.*\\)|transferFrom\\(');
    }

    // Generic: Normalize variable names
    if (code.length > 20 && code.length < 500) {
      const normalized = code
        .replace(/\/\/.*$/gm, '')       // strip line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
        .replace(/\s+/g, '\\s+')        // flexible whitespace
        .replace(/\b\d+\b/g, '\\d+');    // flexible numbers
      if (normalized.length < 1000) {
        patterns.push(normalized);
      }
    }

    return patterns;
  }

  /**
   * Extract function signatures from Solidity source code.
   */
  extractFunctionSignatures(sourceCode: string): string[] {
    const sigs: string[] = [];
    const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = funcRegex.exec(sourceCode)) !== null) {
      const name = match[1];
      const params = match[2]
        .split(',')
        .map(p => p.trim().split(/\s+/)[0])
        .filter(Boolean)
        .join(',');
      sigs.push(`${name}(${params})`);
    }
    return sigs;
  }

  /**
   * Extract event signatures from Solidity source code.
   */
  extractEventSignatures(sourceCode: string): string[] {
    const sigs: string[] = [];
    const eventRegex = /event\s+(\w+)\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = eventRegex.exec(sourceCode)) !== null) {
      sigs.push(`${match[1]}(${match[2].replace(/\s+/g, ' ').trim()})`);
    }
    return sigs;
  }

  /**
   * Categorize a finding into a vulnerability type.
   */
  private categorizeVulnerability(finding: Finding): string {
    const d = finding.detectorName.toLowerCase();
    if (d.includes('reentrancy')) return 'reentrancy';
    if (d.includes('oracle') || d.includes('price')) return 'oracle-manipulation';
    if (d.includes('access') || d.includes('unprotected')) return 'access-control';
    if (d.includes('arbitrary-send')) return 'arbitrary-send';
    if (d.includes('suicidal') || d.includes('selfdestruct')) return 'suicidal';
    if (d.includes('unchecked') || d.includes('transfer')) return 'unchecked-transfer';
    if (d.includes('delegate') || d.includes('proxy') || d.includes('upgrade')) return 'proxy-vulnerability';
    if (d.includes('flash')) return 'flash-loan';
    return d;
  }

  // ── Pattern CRUD ──

  savePattern(pattern: VulnerabilityPattern): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO patterns
        (id, pattern_hash, pattern_type, code_signatures, first_seen_contract,
         first_seen_chain, first_seen_date, exploit_template, false_positive_signatures,
         true_positive_rate, total_value_at_risk, evolution_history, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pattern.id,
      pattern.patternHash,
      pattern.patternType,
      JSON.stringify(pattern.codeSignatures),
      pattern.firstSeenContract,
      pattern.firstSeenChain,
      pattern.firstSeenDate,
      pattern.exploitTemplate ? JSON.stringify(pattern.exploitTemplate) : null,
      JSON.stringify(pattern.falsePositiveSignatures),
      pattern.truePositiveRate,
      pattern.totalValueAtRisk,
      JSON.stringify(pattern.evolutionHistory),
      pattern.createdAt,
      pattern.updatedAt,
    );
  }

  getPattern(id: string): VulnerabilityPattern | null {
    const row = this.db.prepare('SELECT * FROM patterns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToPattern(row) : null;
  }

  getPatternByHash(hash: string): VulnerabilityPattern | null {
    const row = this.db.prepare('SELECT * FROM patterns WHERE pattern_hash = ?').get(hash) as Record<string, unknown> | undefined;
    return row ? this.rowToPattern(row) : null;
  }

  getAllPatterns(): VulnerabilityPattern[] {
    const rows = this.db.prepare('SELECT * FROM patterns ORDER BY total_value_at_risk DESC').all() as Record<string, unknown>[];
    return rows.map(r => this.rowToPattern(r));
  }

  getHighValuePatterns(minValue: number = 100_000): VulnerabilityPattern[] {
    const rows = this.db.prepare(
      'SELECT * FROM patterns WHERE total_value_at_risk >= ? ORDER BY total_value_at_risk DESC',
    ).all(minValue) as Record<string, unknown>[];
    return rows.map(r => this.rowToPattern(r));
  }

  getReliablePatterns(minRate: number = 0.8): VulnerabilityPattern[] {
    const rows = this.db.prepare(
      'SELECT * FROM patterns WHERE true_positive_rate >= ? ORDER BY true_positive_rate DESC, total_value_at_risk DESC',
    ).all(minRate) as Record<string, unknown>[];
    return rows.map(r => this.rowToPattern(r));
  }

  getPatternsByType(type: string): VulnerabilityPattern[] {
    const rows = this.db.prepare(
      'SELECT * FROM patterns WHERE pattern_type = ? ORDER BY total_value_at_risk DESC',
    ).all(type) as Record<string, unknown>[];
    return rows.map(r => this.rowToPattern(r));
  }

  private rowToPattern(row: Record<string, unknown>): VulnerabilityPattern {
    return {
      id: row.id as string,
      patternHash: row.pattern_hash as string,
      patternType: row.pattern_type as string,
      codeSignatures: JSON.parse(row.code_signatures as string),
      firstSeenContract: row.first_seen_contract as string,
      firstSeenChain: row.first_seen_chain as number,
      firstSeenDate: row.first_seen_date as string,
      exploitTemplate: row.exploit_template ? JSON.parse(row.exploit_template as string) : null,
      falsePositiveSignatures: JSON.parse((row.false_positive_signatures as string) || '[]'),
      truePositiveRate: row.true_positive_rate as number,
      totalValueAtRisk: row.total_value_at_risk as number,
      evolutionHistory: JSON.parse((row.evolution_history as string) || '[]'),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Instances ──

  addInstance(
    patternId: string,
    contractAddress: string,
    chainId: number,
    finding: VerifiedFinding,
  ): void {
    const exploitableValue = finding.exploitEstimate?.estimatedExploitable ?? 0;
    const verified = finding.verificationStatus === 'verified' ? 1 : 0;

    this.db.prepare(`
      INSERT OR REPLACE INTO pattern_instances
        (pattern_id, contract_address, chain_id, exploitable_value, verified, verified_date, verification_method)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      patternId,
      contractAddress,
      chainId,
      exploitableValue,
      verified,
      verified ? new Date().toISOString() : null,
      finding.verificationStatus,
    );

    // Update total value
    this.recalculatePatternValue(patternId);
  }

  getPatternInstances(patternId: string): PatternInstance[] {
    const rows = this.db.prepare(
      'SELECT * FROM pattern_instances WHERE pattern_id = ? ORDER BY exploitable_value DESC',
    ).all(patternId) as Record<string, unknown>[];
    return rows.map(r => ({
      patternId: r.pattern_id as string,
      contractAddress: r.contract_address as string,
      chainId: r.chain_id as number,
      exploitableValue: r.exploitable_value as number,
      verified: (r.verified as number) === 1,
      verifiedDate: r.verified_date as string | null,
      verificationMethod: r.verification_method as string | null,
    }));
  }

  private recalculatePatternValue(patternId: string): void {
    const result = this.db.prepare(
      'SELECT SUM(exploitable_value) as total FROM pattern_instances WHERE pattern_id = ?',
    ).get(patternId) as { total: number | null } | undefined;

    const total = result?.total ?? 0;
    this.db.prepare(
      'UPDATE patterns SET total_value_at_risk = ?, updated_at = datetime(\'now\') WHERE id = ?',
    ).run(total, patternId);
  }

  // ── Fingerprints ──

  /**
   * Generate and store a fingerprint for a contract.
   */
  saveFingerprint(fp: ContractFingerprint): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO fingerprints
        (contract_address, chain_id, contract_name, code_hash, normalized_hash,
         structure_hash, interface_hash, function_signatures, event_signatures,
         bytecode_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fp.contractAddress,
      fp.chainId,
      fp.contractName,
      fp.codeHash,
      fp.normalizedHash,
      fp.structureHash,
      fp.interfaceHash,
      JSON.stringify(fp.functionSignatures),
      JSON.stringify(fp.eventSignatures),
      fp.bytecodeHash,
      fp.createdAt,
    );
  }

  /**
   * Generate a fingerprint for a contract source code.
   */
  generateFingerprint(
    contractAddress: string,
    chainId: number,
    contractName: string,
    sourceCode: string,
  ): ContractFingerprint {
    const codeHash = createHash('sha256').update(sourceCode).digest('hex');

    // Normalized: strip comments, whitespace, pragma
    const normalized = sourceCode
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/pragma\s+solidity[^;]+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const normalizedHash = createHash('sha256').update(normalized).digest('hex');

    // Structure: just function/event signatures
    const funcSigs = this.extractFunctionSignatures(sourceCode);
    const eventSigs = this.extractEventSignatures(sourceCode);
    const structureHash = createHash('sha256')
      .update(funcSigs.sort().join('|'))
      .digest('hex');
    const interfaceHash = createHash('sha256')
      .update([...funcSigs, ...eventSigs].sort().join('|'))
      .digest('hex');

    return {
      contractAddress,
      chainId,
      contractName,
      codeHash,
      normalizedHash,
      structureHash,
      interfaceHash,
      functionSignatures: funcSigs,
      eventSignatures: eventSigs,
      bytecodeHash: null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Find fingerprints matching any hash of a reference fingerprint.
   */
  findSimilarFingerprints(
    reference: ContractFingerprint,
    excludeChainId?: number,
  ): Array<ContractFingerprint & { matchType: string; similarityScore: number }> {
    const results: Array<ContractFingerprint & { matchType: string; similarityScore: number }> = [];

    // Exact code match
    const exactRows = this.db.prepare(
      `SELECT * FROM fingerprints WHERE code_hash = ? AND NOT (contract_address = ? AND chain_id = ?)
       ${excludeChainId != null ? `AND chain_id != ${excludeChainId}` : ''}`,
    ).all(reference.codeHash, reference.contractAddress, reference.chainId) as Record<string, unknown>[];
    for (const row of exactRows) {
      results.push({ ...this.rowToFingerprint(row), matchType: 'exact_code', similarityScore: 1.0 });
    }

    // Normalized match (catches forks with different comments/pragma)
    const normRows = this.db.prepare(
      `SELECT * FROM fingerprints WHERE normalized_hash = ? AND code_hash != ?
       AND NOT (contract_address = ? AND chain_id = ?)`,
    ).all(reference.normalizedHash, reference.codeHash, reference.contractAddress, reference.chainId) as Record<string, unknown>[];
    for (const row of normRows) {
      if (!results.some(r => r.contractAddress === (row.contract_address as string) && r.chainId === (row.chain_id as number))) {
        results.push({ ...this.rowToFingerprint(row), matchType: 'normalized_code', similarityScore: 0.95 });
      }
    }

    // Structure match (same function layout)
    const structRows = this.db.prepare(
      `SELECT * FROM fingerprints WHERE structure_hash = ? AND normalized_hash != ?
       AND NOT (contract_address = ? AND chain_id = ?)`,
    ).all(reference.structureHash, reference.normalizedHash, reference.contractAddress, reference.chainId) as Record<string, unknown>[];
    for (const row of structRows) {
      if (!results.some(r => r.contractAddress === (row.contract_address as string) && r.chainId === (row.chain_id as number))) {
        results.push({ ...this.rowToFingerprint(row), matchType: 'structure', similarityScore: 0.8 });
      }
    }

    // Interface match (same external interface)
    const ifaceRows = this.db.prepare(
      `SELECT * FROM fingerprints WHERE interface_hash = ? AND structure_hash != ?
       AND NOT (contract_address = ? AND chain_id = ?)`,
    ).all(reference.interfaceHash, reference.structureHash, reference.contractAddress, reference.chainId) as Record<string, unknown>[];
    for (const row of ifaceRows) {
      if (!results.some(r => r.contractAddress === (row.contract_address as string) && r.chainId === (row.chain_id as number))) {
        results.push({ ...this.rowToFingerprint(row), matchType: 'interface', similarityScore: 0.6 });
      }
    }

    return results;
  }

  /**
   * Find fingerprints by bytecode hash.
   */
  findByBytecodeHash(bytecodeHash: string): ContractFingerprint[] {
    const rows = this.db.prepare(
      'SELECT * FROM fingerprints WHERE bytecode_hash = ?',
    ).all(bytecodeHash) as Record<string, unknown>[];
    return rows.map(r => this.rowToFingerprint(r));
  }

  getFingerprintCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as cnt FROM fingerprints').get() as { cnt: number };
    return result.cnt;
  }

  private rowToFingerprint(row: Record<string, unknown>): ContractFingerprint {
    return {
      contractAddress: row.contract_address as string,
      chainId: row.chain_id as number,
      contractName: (row.contract_name as string) ?? '',
      codeHash: row.code_hash as string,
      normalizedHash: (row.normalized_hash as string) ?? '',
      structureHash: (row.structure_hash as string) ?? '',
      interfaceHash: (row.interface_hash as string) ?? '',
      functionSignatures: JSON.parse((row.function_signatures as string) || '[]'),
      eventSignatures: JSON.parse((row.event_signatures as string) || '[]'),
      bytecodeHash: (row.bytecode_hash as string) ?? null,
      createdAt: (row.created_at as string) ?? '',
    };
  }

  // ── False Positive Recording ──

  /**
   * Record a false positive to improve pattern accuracy.
   */
  recordFalsePositive(
    patternId: string,
    contractAddress: string,
    chainId: number,
    reason: string,
    falsePositiveCode?: string,
  ): void {
    const pattern = this.getPattern(patternId);
    if (!pattern) return;

    // Add FP signature if provided
    if (falsePositiveCode && !pattern.falsePositiveSignatures.includes(falsePositiveCode)) {
      pattern.falsePositiveSignatures.push(falsePositiveCode);
    }

    // Recalculate true positive rate
    const instances = this.getPatternInstances(patternId);
    const fpCount = pattern.falsePositiveSignatures.length;
    const totalChecks = instances.length + fpCount;
    pattern.truePositiveRate = totalChecks > 0 ? instances.length / totalChecks : 0;

    // Add evolution entry
    pattern.evolutionHistory.push({
      date: new Date().toISOString(),
      change: 'False positive recorded',
      reason: `${contractAddress} on chain ${chainId}: ${reason}`,
    });

    pattern.updatedAt = new Date().toISOString();
    this.savePattern(pattern);

    this.logEvent('false_positive', patternId, contractAddress, chainId, { reason });
  }

  /**
   * Add a false positive code signature to a pattern type.
   */
  addFalsePositiveSignature(patternType: string, signature: string): void {
    const patterns = this.getPatternsByType(patternType);
    for (const pattern of patterns) {
      if (!pattern.falsePositiveSignatures.includes(signature)) {
        pattern.falsePositiveSignatures.push(signature);
        pattern.updatedAt = new Date().toISOString();
        this.savePattern(pattern);
      }
    }
  }

  // ── Audit History ──

  recordAudit(
    contractAddress: string,
    chainId: number,
    contractName: string,
    findingsCount: number,
    verifiedCount: number,
    fpCount: number,
    exploitableValue: number,
    durationMs: number,
    toolsUsed: string[],
  ): void {
    this.db.prepare(`
      INSERT INTO audit_history
        (contract_address, chain_id, contract_name, findings_count, verified_count,
         false_positive_count, exploitable_value, scan_duration_ms, tools_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contractAddress, chainId, contractName, findingsCount, verifiedCount,
      fpCount, exploitableValue, durationMs, JSON.stringify(toolsUsed),
    );
  }

  // ── Learning Events ──

  logEvent(
    eventType: string,
    patternId: string | null,
    contractAddress: string,
    chainId: number,
    details: Record<string, unknown> = {},
  ): void {
    this.db.prepare(`
      INSERT INTO learning_events (event_type, pattern_id, contract_address, chain_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventType, patternId, contractAddress, chainId, JSON.stringify(details));
  }

  // ── Pattern Matching ──

  /**
   * Check if source code matches any known vulnerability pattern.
   * Returns matching patterns sorted by confidence.
   */
  matchSourceCode(sourceCode: string): Array<{ pattern: VulnerabilityPattern; matchType: string; confidence: number }> {
    const matches: Array<{ pattern: VulnerabilityPattern; matchType: string; confidence: number }> = [];
    const patterns = this.getAllPatterns();

    for (const pattern of patterns) {
      // Skip patterns with low accuracy
      if (pattern.truePositiveRate < 0.5) continue;

      const sigs = pattern.codeSignatures;

      // Check exact matches
      for (const exact of sigs.exactMatch) {
        if (exact && sourceCode.includes(exact)) {
          // Check it's not a known false positive
          const isFP = pattern.falsePositiveSignatures.some(fp => sourceCode.includes(fp));
          if (!isFP) {
            matches.push({ pattern, matchType: 'exact', confidence: 0.95 * pattern.truePositiveRate });
          }
          break;
        }
      }

      // Check regex patterns
      if (!matches.some(m => m.pattern.id === pattern.id)) {
        for (const regex of sigs.regexPatterns) {
          try {
            if (new RegExp(regex, 's').test(sourceCode)) {
              const isFP = pattern.falsePositiveSignatures.some(fp => sourceCode.includes(fp));
              if (!isFP) {
                matches.push({ pattern, matchType: 'regex', confidence: 0.7 * pattern.truePositiveRate });
              }
              break;
            }
          } catch {
            // Invalid regex, skip
          }
        }
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Pattern Refinement ──

  /**
   * Refine a pattern with new code signatures.
   */
  refinePattern(patternId: string, newSignatures: Partial<CodeSignatures>, reason: string): void {
    const pattern = this.getPattern(patternId);
    if (!pattern) return;

    if (newSignatures.exactMatch) {
      pattern.codeSignatures.exactMatch.push(...newSignatures.exactMatch);
    }
    if (newSignatures.regexPatterns) {
      pattern.codeSignatures.regexPatterns.push(...newSignatures.regexPatterns);
    }

    pattern.evolutionHistory.push({
      date: new Date().toISOString(),
      change: 'Pattern refined',
      reason,
    });

    pattern.updatedAt = new Date().toISOString();
    this.savePattern(pattern);
    this.logEvent('pattern_refined', patternId, '', 0, { reason });
  }

  // ── Statistics ──

  getStats(): LearningStats {
    const totalPatterns = (this.db.prepare('SELECT COUNT(*) as c FROM patterns').get() as { c: number }).c;
    const totalInstances = (this.db.prepare('SELECT COUNT(*) as c FROM pattern_instances').get() as { c: number }).c;
    const totalFingerprints = (this.db.prepare('SELECT COUNT(*) as c FROM fingerprints').get() as { c: number }).c;
    const totalValue = (this.db.prepare('SELECT SUM(total_value_at_risk) as v FROM patterns').get() as { v: number | null })?.v ?? 0;
    const avgRate = (this.db.prepare('SELECT AVG(true_positive_rate) as r FROM patterns').get() as { r: number | null })?.r ?? 0;

    const patternsByType = (this.db.prepare(`
      SELECT pattern_type as patternType, COUNT(*) as count, SUM(total_value_at_risk) as value
      FROM patterns GROUP BY pattern_type ORDER BY value DESC
    `).all() as Array<{ patternType: string; count: number; value: number }>);

    const recentEvents = (this.db.prepare(`
      SELECT event_type as eventType, COUNT(*) as count
      FROM learning_events
      WHERE created_at > datetime('now', '-7 days')
      GROUP BY event_type
    `).all() as Array<{ eventType: string; count: number }>);

    return {
      totalPatterns,
      totalInstances,
      totalFingerprints,
      totalValueTracked: totalValue,
      averageTruePositiveRate: avgRate,
      patternsByType,
      recentLearningEvents: recentEvents,
    };
  }

  // ── Helpers ──

  private hashSignatures(sigs: CodeSignatures): string {
    const material = [
      ...sigs.exactMatch,
      ...sigs.regexPatterns,
      ...sigs.functionSignatures.slice(0, 10),
    ].join('|');
    return createHash('sha256').update(material).digest('hex');
  }

  /**
   * Get the raw SQLite database (for advanced queries by SelfEvolution).
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Export all learned knowledge for backup.
   */
  exportKnowledge(): {
    patterns: VulnerabilityPattern[];
    stats: LearningStats;
    exportDate: string;
  } {
    return {
      patterns: this.getAllPatterns(),
      stats: this.getStats(),
      exportDate: new Date().toISOString(),
    };
  }

  close(): void {
    this.db.close();
  }
}
