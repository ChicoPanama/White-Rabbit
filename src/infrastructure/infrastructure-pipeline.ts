/**
 * WHITE RABBIT - Infrastructure Analysis Pipeline
 * 
 * Unified orchestration layer for infrastructure, network, and cloud security scanning.
 * Integrates Kubescape (K8s), CloudSploit (AWS), and Nili (Network) scanners into
 * a cohesive analysis system.
 * 
 * Features:
 * - Target discovery and validation
 * - Parallel scanner execution
 * - Result aggregation and deduplication
 * - Compliance mapping
 * - Remediation guidance
 */

import { KubescapeScanner } from './kubescape-scanner.js';
import { CloudSploitScanner } from './cloudsploit-scanner.js';
import { NiliScanner } from './nili-scanner.js';
import { BlackWidowScanner } from '../web-scanners/blackwidow-scanner.js';
import { SubOverScanner } from '../web-scanners/subover-scanner.js';
import { DomDigScanner } from '../web-scanners/domdig-scanner.js';
import type {
  InfrastructureTarget,
  InfrastructureFinding,
  InfrastructureScanResult,
  InfrastructureAgentConfig,
  InfrastructureScanConfig,
  InfrastructureTargetType,
} from './types.js';
import type { WebTarget, WebScanResult } from '../web-scanners/types.js';
import { FindingDeduplicator } from '../analyzers/deduplicator.js';
import { serviceLogger } from '../core/logger.js';
import { setTimeout } from 'timers/promises';

// Scanner registry mapping target types to scanners
const SCANNER_REGISTRY: Record<InfrastructureTargetType, string[]> = {
  'kubernetes': ['kubescape'],
  'aws': ['cloudsploit'],
  'network': ['nili'],
  'azure': [], // Future implementation
  'gcp': [], // Future implementation
};

// Web scanner registry
const WEB_SCANNER_REGISTRY: Record<string, string[]> = {
  'webapp': ['blackwidow'],
  'subdomain': ['subover'],
  'spa': ['domdig'],
};

/**
 * Infrastructure Analysis Pipeline
 * 
 * Orchestrates multiple infrastructure scanners to provide comprehensive
 * coverage of cloud, container, network, and web security.
 */
export class InfrastructureAnalysisPipeline {
  private kubescape: KubescapeScanner;
  private cloudsploit: CloudSploitScanner;
  private nili: NiliScanner;
  private blackwidow: BlackWidowScanner;
  private subover: SubOverScanner;
  private domdig: DomDigScanner;
  private deduplicator: FindingDeduplicator;
  private config: InfrastructureAgentConfig;

  constructor(config: Partial<InfrastructureAgentConfig> = {}) {
    this.kubescape = new KubescapeScanner();
    this.cloudsploit = new CloudSploitScanner();
    this.nili = new NiliScanner();
    this.blackwidow = new BlackWidowScanner();
    this.subover = new SubOverScanner();
    this.domdig = new DomDigScanner();
    this.deduplicator = new FindingDeduplicator();
    
    this.config = {
      enabledScanners: ['kubescape', 'cloudsploit', 'nili', 'blackwidow', 'subover', 'domdig'],
      globalConfig: {},
      targets: [],
      alerting: {
        minSeverity: 'medium',
        channels: [],
      },
      ...config,
    };
  }

  /**
   * MAIN ENTRY POINT
   * 
   * Analyze an infrastructure target using appropriate scanners
   */
  async analyze(target: InfrastructureTarget): Promise<InfrastructureScanResult> {
    const startTime = Date.now();
    
    serviceLogger.info('Starting infrastructure analysis', {
      targetId: target.id,
      targetType: target.type,
      name: target.name,
    });

    // Step 1: Validate target (warn but continue if validation fails)
    const isValid = await this.validateTarget(target);
    if (!isValid) {
      serviceLogger.warn(`Target validation failed: ${target.id}, attempting scan anyway`);
      // Continue with scan even if validation fails - scanners may handle it gracefully
    }

    // Step 2: Determine which scanners to use
    const scanners = this.selectScanners(target);
    
    serviceLogger.info('Selected scanners', {
      targetId: target.id,
      scanners: scanners.map(s => s.name),
    });

    // Step 3: Execute scans in parallel
    const scanConfig: InfrastructureScanConfig = {
      severityThreshold: 'low',
      includeChecks: [],
      excludeChecks: [],
      timeoutMs: 300000,
      parallelScans: 3,
      ...this.config.globalConfig,
      ...target.scanConfig,
    };

    const findings: InfrastructureFinding[] = [];
    const errors: string[] = [];

    const scanPromises = scanners.map(async scanner => {
      try {
        serviceLogger.info(`Running ${scanner.name} scan`, { target: target.id });
        const scannerFindings = await scanner.scan(target as any, scanConfig);
        findings.push(...(scannerFindings as InfrastructureFinding[]));
        serviceLogger.info(`${scanner.name} scan complete`, {
          target: target.id,
          findings: scannerFindings.length,
        });
      } catch (error) {
        const errorMsg = `${scanner.name} failed: ${error}`;
        errors.push(errorMsg);
        serviceLogger.error(errorMsg, { target: target.id });
      }
    });

    await Promise.all(scanPromises);

    // Step 4: Deduplicate findings
    const uniqueFindings = this.deduplicateFindings(findings);

    // Step 5: Build result
    const result: InfrastructureScanResult = {
      target,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
      findings: uniqueFindings,
      summary: this.calculateSummary(uniqueFindings),
      errors,
    };

    serviceLogger.info('Infrastructure analysis complete', {
      targetId: target.id,
      findings: result.findings.length,
      critical: result.summary.critical,
      high: result.summary.high,
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Batch analyze multiple targets
   */
  async analyzeBatch(targets: InfrastructureTarget[]): Promise<InfrastructureScanResult[]> {
    serviceLogger.info('Starting batch infrastructure analysis', {
      targetCount: targets.length,
    });

    const results: InfrastructureScanResult[] = [];

    // Process with concurrency limit
    const limit = this.config.globalConfig?.parallelScans || 3;
    
    for (let i = 0; i < targets.length; i += limit) {
      const batch = targets.slice(i, i + limit);
      
      const batchPromises = batch.map(target => this.analyze(target));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          serviceLogger.error('Batch analysis failed', { error: result.reason });
        }
      }
    }

    return results;
  }

  /**
   * Validate infrastructure target
   */
  private async validateTarget(target: InfrastructureTarget): Promise<boolean> {
    switch (target.type) {
      case 'kubernetes':
        return this.kubescape.validateTarget(target as any);
      case 'aws':
        return this.cloudsploit.validateTarget(target as any);
      case 'network':
        return this.nili.validateTarget(target as any);
      default:
        return false;
    }
  }

  /**
   * Select appropriate scanners for target type
   */
  private selectScanners(target: InfrastructureTarget | WebTarget): Array<
    KubescapeScanner | CloudSploitScanner | NiliScanner | BlackWidowScanner | SubOverScanner | DomDigScanner
  > {
    // Handle web targets
    if ('webTargetType' in target || ['webapp', 'subdomain', 'spa'].includes(target.type)) {
      return this.selectWebScanners(target as WebTarget);
    }
    
    const scannerNames = SCANNER_REGISTRY[target.type as InfrastructureTargetType] || [];
    const scanners: Array<
      KubescapeScanner | CloudSploitScanner | NiliScanner | BlackWidowScanner | SubOverScanner | DomDigScanner
    > = [];

    for (const name of scannerNames) {
      if (!this.config.enabledScanners.includes(name)) continue;

      switch (name) {
        case 'kubescape':
          scanners.push(this.kubescape);
          break;
        case 'cloudsploit':
          scanners.push(this.cloudsploit);
          break;
        case 'nili':
          scanners.push(this.nili);
          break;
      }
    }

    return scanners;
  }
  
  /**
   * Select web scanners for web targets
   */
  private selectWebScanners(target: WebTarget): Array<
    BlackWidowScanner | SubOverScanner | DomDigScanner
  > {
    const scannerNames = WEB_SCANNER_REGISTRY[target.type] || [];
    const scanners: Array<BlackWidowScanner | SubOverScanner | DomDigScanner> = [];

    for (const name of scannerNames) {
      if (!this.config.enabledScanners.includes(name)) continue;

      switch (name) {
        case 'blackwidow':
          scanners.push(this.blackwidow);
          break;
        case 'subover':
          scanners.push(this.subover);
          break;
        case 'domdig':
          scanners.push(this.domdig);
          break;
      }
    }

    return scanners;
  }

  /**
   * Deduplicate infrastructure findings
   */
  private deduplicateFindings(findings: InfrastructureFinding[]): InfrastructureFinding[] {
    // Use core deduplicator for common fields
    const baseFindings = findings.map(f => ({
      detectorName: f.detectorName,
      tool: f.tool,
      severity: f.severity,
      description: f.description,
    }));

    const deduplicated = this.deduplicator.deduplicate(baseFindings as any);
    
    // Map back to infrastructure findings
    const seen = new Set<string>();
    const unique: InfrastructureFinding[] = [];

    for (const finding of findings) {
      const key = `${finding.detectorName}:${finding.targetId}:${finding.resource?.name || 'none'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(finding);
      }
    }

    return unique;
  }

  /**
   * Calculate findings summary
   */
  private calculateSummary(findings: InfrastructureFinding[]) {
    return {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'informational').length,
    };
  }

  /**
   * Get available checks for all enabled scanners
   */
  async getAvailableChecks(): Promise<Record<string, any[]>> {
    const checks: Record<string, any[]> = {};

    if (this.config.enabledScanners.includes('kubescape')) {
      checks.kubescape = await this.kubescape.getAvailableChecks();
    }

    if (this.config.enabledScanners.includes('cloudsploit')) {
      checks.cloudsploit = await this.cloudsploit.getAvailableChecks();
    }

    if (this.config.enabledScanners.includes('nili')) {
      checks.nili = await this.nili.getAvailableChecks();
    }

    return checks;
  }

  /**
   * Get pipeline health/status
   */
  async getStatus(): Promise<{
    kubescape: boolean;
    cloudsploit: boolean;
    nili: boolean;
  }> {
    return {
      kubescape: await this.kubescape.validateInstallation(),
      cloudsploit: await this.cloudsploit.validateInstallation(),
      nili: await this.nili.validateInstallation(),
    };
  }

  /**
   * Filter findings by severity threshold
   */
  filterFindings(
    findings: InfrastructureFinding[],
    minSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  ): InfrastructureFinding[] {
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const minIndex = severityOrder.indexOf(minSeverity);

    return findings.filter(f => {
      const severityIndex = severityOrder.indexOf(f.severity);
      return severityIndex <= minIndex;
    });
  }

  /**
   * Group findings by resource type
   */
  groupByResource(findings: InfrastructureFinding[]): Record<string, InfrastructureFinding[]> {
    const groups: Record<string, InfrastructureFinding[]> = {};

    for (const finding of findings) {
      const resourceType = finding.resource?.type || 'unknown';
      if (!groups[resourceType]) {
        groups[resourceType] = [];
      }
      groups[resourceType].push(finding);
    }

    return groups;
  }

  /**
   * Group findings by compliance framework
   */
  groupByCompliance(findings: InfrastructureFinding[]): Record<string, InfrastructureFinding[]> {
    const groups: Record<string, InfrastructureFinding[]> = {};

    // Define compliance mappings
    const complianceMappings: Record<string, string[]> = {
      'nsa-cisa': [
        'kubescape-C-0001', // Privileged container
        'kubescape-C-0007', // RBAC enabled
        'kubescape-C-0014', // Network policies
        'kubescape-C-0063', // Anonymous access
        'kubescape-C-0066', // etcd encryption
      ],
      'cis': [
        'kubescape-C-0013', // Non-root containers
        'kubescape-C-0070', // Mutable filesystem
        'cloudsploit-iam-root-account-mfa',
        'cloudsploit-s3-bucket-encryption',
      ],
      'pci-dss': [
        'cloudsploit-s3-bucket-encryption',
        'cloudsploit-rds-encryption-enabled',
        'cloudsploit-kms-key-rotation',
        'nili-ssl-expired',
        'nili-ssl-weak-cipher',
      ],
      'soc2': [
        'cloudsploit-cloudtrail-enabled',
        'cloudsploit-cloudtrail-encryption',
        'cloudsploit-guardduty-enabled',
        'kubescape-C-0067', // Audit logs
      ],
    };

    for (const finding of findings) {
      const detectorKey = `${finding.tool}-${finding.framework?.checkId || finding.detectorName}`;
      
      for (const [framework, checks] of Object.entries(complianceMappings)) {
        if (checks.some(check => detectorKey.includes(check))) {
          if (!groups[framework]) {
            groups[framework] = [];
          }
          groups[framework].push(finding);
        }
      }
    }

    return groups;
  }
}

export default InfrastructureAnalysisPipeline;
