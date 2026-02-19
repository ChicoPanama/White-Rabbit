// ═══════════════════════════════════════════════════════════════════════════════
// Server-Side Worker - Processes queued scan jobs
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WhiteRabbit } from '../core/white-rabbit.js';
import { PatternEngine } from '../engines/pattern.js';

export interface WorkerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  pollIntervalMs: number;
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
}

interface ScanJob {
  id: string;
  user_id: string;
  job_type: 'scan' | 'analyze' | 'verify' | 'hunt';
  target: {
    address?: string;
    chain?: string;
    depth?: string;
    source_code?: string;
    compiler_version?: string;
    contract_name?: string;
  };
  retry_count: number;
  max_retries: number;
}

export class ServerWorker {
  private supabase: SupabaseClient;
  private config: WorkerConfig;
  private isRunning = false;
  private activeJobs = 0;
  private whiteRabbit: WhiteRabbit;
  private patternEngine: PatternEngine;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.whiteRabbit = new WhiteRabbit({});
    this.patternEngine = new PatternEngine();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🐇 Server Worker started');

    while (this.isRunning) {
      try {
        await this.processNextBatch();
      } catch (error) {
        console.error('Worker error:', error);
      }
      await this.delay(this.config.pollIntervalMs);
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private async processNextBatch(): Promise<void> {
    if (this.activeJobs >= this.config.maxConcurrentJobs) return;

    const { data: jobs, error } = await this.supabase
      .from('scanner_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(this.config.maxConcurrentJobs - this.activeJobs);

    if (error || !jobs || jobs.length === 0) return;

    await Promise.all(jobs.map((job: ScanJob) => this.processJob(job)));
  }

  private async processJob(job: ScanJob): Promise<void> {
    this.activeJobs++;
    const startTime = Date.now();

    try {
      await this.supabase
        .from('scanner_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', job.id);

      let result;
      switch (job.job_type) {
        case 'scan':
          result = await this.executeScan(job);
          break;
        case 'analyze':
          result = await this.executeAnalyze(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }

      await this.supabase
        .from('scanner_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          findings: result.findings,
          findings_count: result.findings.length,
          engines_used: result.engines,
          progress: 100,
        })
        .eq('id', job.id);

      await this.supabase.rpc('complete_scanner_job', { p_user_id: job.user_id });

    } catch (error) {
      await this.handleJobError(job, error);
    } finally {
      this.activeJobs--;
    }
  }

  private async executeScan(job: ScanJob): Promise<{ findings: unknown[]; engines: string[] }> {
    const { address, chain, depth } = job.target;
    if (!address || !chain) throw new Error('Missing address or chain');

    const capabilities = await this.whiteRabbit.checkEngines();
    const engines: string[] = ['pattern'];
    if (capabilities.slither) engines.push('slither');

    const findings = await this.whiteRabbit.scan(address, {
      chain,
      deep: depth === 'deep',
    });

    return {
      findings: findings.map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        description: f.description,
        tool: f.tool,
      })),
      engines,
    };
  }

  private async executeAnalyze(job: ScanJob): Promise<{ findings: unknown[]; engines: string[] }> {
    const { source_code, compiler_version, contract_name } = job.target;
    if (!source_code) throw new Error('Missing source_code');

    const result = await this.patternEngine.analyze({
      id: job.id,
      address: '0x0000000000000000000000000000000000000000',
      chainId: 1,
      name: contract_name || 'Contract',
      sourceCode: source_code,
      abi: [],
      compilerVersion: compiler_version || '0.8.19',
      isProxy: false,
      implementationAddress: null,
      tvlUsd: null,
      protocolName: null,
    });

    return {
      findings: result.success ? result.findings : [],
      engines: ['pattern'],
    };
  }

  private async handleJobError(job: ScanJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const shouldRetry = job.retry_count < job.max_retries;

    if (shouldRetry) {
      await this.supabase
        .from('scanner_jobs')
        .update({ status: 'queued', retry_count: job.retry_count + 1, error: errorMessage })
        .eq('id', job.id);
    } else {
      await this.supabase
        .from('scanner_jobs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error: errorMessage })
        .eq('id', job.id);
      await this.supabase.rpc('complete_scanner_job', { p_user_id: job.user_id });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ServerWorker;
