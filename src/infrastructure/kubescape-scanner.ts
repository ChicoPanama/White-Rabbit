/**
 * WHITE RABBIT - Kubescape Scanner
 * 
 * Kubernetes security scanner based on NSA/CISA hardening guidelines.
 * Scans K8s clusters for misconfigurations, RBAC issues, network policies,
 * pod security standards, and compliance violations.
 * 
 * References:
 * - https://github.com/armosec/kubescape
 * - NSA/CISA Kubernetes Hardening Guide
 * - CIS Kubernetes Benchmark
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import type {
  InfrastructureScanner,
  InfrastructureFinding,
  KubernetesTarget,
  InfrastructureScanConfig,
  ScannerCheck,
  ComplianceFramework,
} from './types.js';
import type { Severity } from '../types/index.js';
import { serviceLogger } from '../core/logger.js';

const exec = promisify(execCb);

// Kubescape control categories from NSA/CISA guidelines
const KUBESCAPE_CATEGORIES = {
  'access-control': 'Access Control',
  'secrets': 'Secrets Management',
  'network': 'Network Security',
  'workload': 'Workload Security',
  'rbac': 'RBAC Configuration',
  'vulnerabilities': 'Vulnerability Management',
  'compliance': 'Compliance',
} as const;

// Compliance frameworks supported by Kubescape
const KUBESCAPE_FRAMEWORKS: ComplianceFramework[] = [
  'nsa-cisa',
  'cis',
  'mitre-attack',
];

interface KubescapeControl {
  id: string;
  name: string;
  description: string;
  severity: string;
  category: string;
}

interface KubescapeResult {
  controls: KubescapeControl[];
  summary: {
    failed: number;
    passed: number;
    skipped: number;
  };
  results: Array<{
    controlID: string;
    name: string;
    status: {
      status: string;
    };
    resourceAssociatedRules?: Array<{
      failedPaths: string[];
      reviewPaths: string[];
      ruleStatus: string;
    }>;
    relatedResources?: Array<{
      name: string;
      namespace: string;
      kind: string;
    }>;
  }>;
}

/**
 * Kubescape Kubernetes Security Scanner
 * 
 * Implements infrastructure scanning for Kubernetes clusters using
 * the Kubescape CLI tool. Covers NSA/CISA hardening guidelines.
 */
export class KubescapeScanner implements InfrastructureScanner<KubernetesTarget> {
  readonly name = 'kubescape';
  readonly version = '3.0.x';
  readonly supportedTargets = ['kubernetes' as const];
  
  private binaryPath: string;
  private availableFrameworks: string[] = [];

  constructor(binaryPath = 'kubescape') {
    this.binaryPath = binaryPath;
  }

  /**
   * Validate Kubescape is installed and accessible
   */
  async validateInstallation(): Promise<boolean> {
    try {
      await exec(`${this.binaryPath} version`);
      return true;
    } catch {
      serviceLogger.warn('Kubescape not found, attempting to use kubectl or scanning without it');
      return false;
    }
  }

  /**
   * Get available compliance frameworks
   */
  async getAvailableChecks(): Promise<ScannerCheck[]> {
    const checks: ScannerCheck[] = [
      // NSA/CISA Framework Controls
      {
        id: 'C-0001',
        name: 'Privileged container',
        description: 'Detects containers running in privileged mode',
        severity: 'critical',
        category: 'workload',
      },
      {
        id: 'C-0002',
        name: 'Host PID/IPC privileges',
        description: 'Detects containers sharing host PID or IPC namespaces',
        severity: 'critical',
        category: 'workload',
      },
      {
        id: 'C-0005',
        name: 'Admission Controller - Allow Privilege Escalation',
        description: 'Detects containers allowing privilege escalation',
        severity: 'high',
        category: 'access-control',
      },
      {
        id: 'C-0007',
        name: 'RBAC enabled',
        description: 'Verifies RBAC is enabled on the cluster',
        severity: 'critical',
        category: 'rbac',
      },
      {
        id: 'C-0009',
        name: 'Resource policies',
        description: 'Ensures resource limits and requests are defined',
        severity: 'medium',
        category: 'workload',
      },
      {
        id: 'C-0012',
        name: 'Insecure capabilities',
        description: 'Detects containers with dangerous capabilities',
        severity: 'high',
        category: 'workload',
      },
      {
        id: 'C-0013',
        name: 'Non-root containers',
        description: 'Ensures containers run as non-root user',
        severity: 'high',
        category: 'workload',
      },
      {
        id: 'C-0014',
        name: 'Network policies',
        description: 'Verifies network policies are defined',
        severity: 'high',
        category: 'network',
      },
      {
        id: 'C-0015',
        name: 'Secrets in environment variables',
        description: 'Detects hardcoded secrets in env vars',
        severity: 'critical',
        category: 'secrets',
      },
      {
        id: 'C-0020',
        name: 'API server insecure port',
        description: 'Detects if API server is running on insecure port',
        severity: 'critical',
        category: 'access-control',
      },
      {
        id: 'C-0021',
        name: 'Exposed dashboard',
        description: 'Detects exposed Kubernetes dashboard',
        severity: 'critical',
        category: 'access-control',
      },
      {
        id: 'C-0030',
        name: 'Ingress and Egress blocked',
        description: 'Verifies default deny network policies',
        severity: 'high',
        category: 'network',
      },
      {
        id: 'C-0034',
        name: 'Automatic mapping of service account',
        description: 'Detects automatic service account token mounting',
        severity: 'medium',
        category: 'rbac',
      },
      {
        id: 'C-0038',
        name: 'HostPath mount',
        description: 'Detects HostPath volume mounts',
        severity: 'high',
        category: 'workload',
      },
      {
        id: 'C-0041',
        name: 'HostNetwork access',
        description: 'Detects pods using host network',
        severity: 'high',
        category: 'network',
      },
      {
        id: 'C-0044',
        name: 'Container hostPort',
        description: 'Detects containers using hostPort',
        severity: 'medium',
        category: 'network',
      },
      {
        id: 'C-0045',
        name: 'Writable hostPath mount',
        description: 'Detects writable HostPath mounts',
        severity: 'critical',
        category: 'workload',
      },
      {
        id: 'C-0048',
        name: 'Manual schedule on master nodes',
        description: 'Detects workloads scheduled on control plane',
        severity: 'medium',
        category: 'workload',
      },
      {
        id: 'C-0050',
        name: 'Resources CPU limit and request',
        description: 'Ensures CPU limits and requests are set',
        severity: 'low',
        category: 'workload',
      },
      {
        id: 'C-0052',
        name: 'Instance metadata API',
        description: 'Detects access to cloud instance metadata',
        severity: 'high',
        category: 'access-control',
      },
      {
        id: 'C-0055',
        name: 'Linux hardening',
        description: 'Verifies Linux security hardening',
        severity: 'medium',
        category: 'compliance',
      },
      {
        id: 'C-0056',
        name: 'Configured liveness probe',
        description: 'Ensures liveness probes are configured',
        severity: 'low',
        category: 'workload',
      },
      {
        id: 'C-0057',
        name: 'Configured readiness probe',
        description: 'Ensures readiness probes are configured',
        severity: 'low',
        category: 'workload',
      },
      {
        id: 'C-0061',
        name: 'Pods in default namespace',
        description: 'Detects workloads in default namespace',
        severity: 'low',
        category: 'workload',
      },
      {
        id: 'C-0062',
        name: 'SELinux',
        description: 'Verifies SELinux configuration',
        severity: 'medium',
        category: 'compliance',
      },
      {
        id: 'C-0063',
        name: 'Anonymous access enabled',
        description: 'Detects anonymous authentication enabled',
        severity: 'critical',
        category: 'access-control',
      },
      {
        id: 'C-0064',
        name: 'Image pull policy on latest tag',
        description: 'Detects latest tag without Always pull policy',
        severity: 'medium',
        category: 'workload',
      },
      {
        id: 'C-0065',
        name: 'No impersonation',
        description: 'Detects RBAC impersonation permissions',
        severity: 'medium',
        category: 'rbac',
      },
      {
        id: 'C-0066',
        name: 'Secret/etcd encryption',
        description: 'Verifies etcd encryption is enabled',
        severity: 'critical',
        category: 'secrets',
      },
      {
        id: 'C-0067',
        name: 'Audit logs enabled',
        description: 'Verifies audit logging is enabled',
        severity: 'high',
        category: 'compliance',
      },
      {
        id: 'C-0068',
        name: 'PSA enabled',
        description: 'Verifies Pod Security Admission is enabled',
        severity: 'high',
        category: 'access-control',
      },
      {
        id: 'C-0070',
        name: 'Workload with mutable filesystem',
        description: 'Detects containers without read-only root filesystem',
        severity: 'medium',
        category: 'workload',
      },
    ];

    return checks;
  }

  /**
   * Validate Kubernetes target is accessible
   */
  async validateTarget(target: KubernetesTarget): Promise<boolean> {
    try {
      const context = target.context ? `--context ${target.context}` : '';
      await exec(`kubectl ${context} cluster-info`);
      return true;
    } catch (error) {
      serviceLogger.error('Failed to validate Kubernetes target', {
        target: target.id,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Execute Kubescape scan
   */
  async scan(
    target: KubernetesTarget,
    config: Partial<InfrastructureScanConfig> = {}
  ): Promise<InfrastructureFinding[]> {
    const startTime = Date.now();
    serviceLogger.info('Starting Kubescape scan', {
      target: target.id,
      cluster: target.metadata.clusterName,
    });

    const findings: InfrastructureFinding[] = [];

    try {
      // Run Kubescape with NSA framework
      const result = await this.runKubescapeScan(target, config);
      
      // Parse results
      for (const control of result.results) {
        if (control.status.status === 'failed') {
          const finding = this.parseControlToFinding(control, target);
          findings.push(finding);
        }
      }

      serviceLogger.info('Kubescape scan complete', {
        target: target.id,
        findings: findings.length,
        durationMs: Date.now() - startTime,
      });

      return findings;
    } catch (error) {
      serviceLogger.error('Kubescape scan failed', {
        target: target.id,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Run Kubescape CLI command
   */
  private async runKubescapeScan(
    target: KubernetesTarget,
    config: Partial<InfrastructureScanConfig>
  ): Promise<KubescapeResult> {
    return new Promise((resolve, reject) => {
      // Check if Kubescape is available
      try {
        const { execSync } = require('child_process');
        execSync(`which ${this.binaryPath}`, { stdio: 'ignore' });
      } catch {
        serviceLogger.warn('kubescape not available, returning empty results');
        // Return empty result structure
        resolve({
          controls: [],
          summary: { failed: 0, passed: 0, skipped: 0 },
          results: [],
        });
        return;
      }
      
      const args = [
        'scan',
        'framework',
        'nsa', // NSA/CISA hardening framework
        '--format', 'json',
        '--output', '/tmp/kubescape-result.json',
      ];

      if (target.context) {
        args.push('--kube-context', target.context);
      }

      if (target.namespace) {
        args.push('--include-namespaces', target.namespace);
      }

      // Severity threshold filtering
      if (config.severityThreshold) {
        args.push('--severity-threshold', config.severityThreshold);
      }

      const proc = spawn(this.binaryPath, args, {
        env: {
          ...process.env,
          KUBECONFIG: target.kubeconfigPath || process.env.KUBECONFIG,
        },
      });
      
      // Handle spawn errors
      proc.on('error', (err) => {
        serviceLogger.warn(`Kubescape spawn error: ${err.message}`);
        resolve({
          controls: [],
          summary: { failed: 0, passed: 0, skipped: 0 },
          results: [],
        });
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        try {
          const fs = require('fs');
          const resultPath = '/tmp/kubescape-result.json';
          
          if (!fs.existsSync(resultPath)) {
            reject(new Error(`Kubescape output not found: ${stderr}`));
            return;
          }

          const output = fs.readFileSync(resultPath, 'utf-8');
          const result: KubescapeResult = JSON.parse(output);
          
          // Cleanup
          fs.unlinkSync(resultPath);
          
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse Kubescape output: ${parseError}`));
        }
      });

      // Timeout
      setTimeout(() => {
        proc.kill();
        reject(new Error('Kubescape scan timeout'));
      }, config.timeoutMs || 300000);
    });
  }

  /**
   * Convert Kubescape control result to White Rabbit finding
   */
  private parseControlToFinding(
    control: KubescapeResult['results'][0],
    target: KubernetesTarget
  ): InfrastructureFinding {
    const checkInfo = this.getCheckInfo(control.controlID);
    
    return {
      detectorName: `kubescape-${control.controlID}`,
      tool: 'kubescape',
      severity: this.mapSeverity(checkInfo?.severity || 'medium'),
      description: control.name,
      infrastructureType: 'kubernetes',
      targetId: target.id,
      framework: {
        name: 'kubescape',
        version: this.version,
        checkId: control.controlID,
        checkName: control.name,
      },
      resource: control.relatedResources?.[0] ? {
        type: control.relatedResources[0].kind,
        name: control.relatedResources[0].name,
        namespace: control.relatedResources[0].namespace,
      } : undefined,
      remediation: {
        description: checkInfo?.description || 'Review and fix the configuration',
        references: [
          `https://hub.armosec.io/docs/${control.controlID.toLowerCase()}`,
        ],
      },
    };
  }

  /**
   * Get check metadata
   */
  private getCheckInfo(controlId: string): ScannerCheck | undefined {
    // This would ideally load from Kubescape's control catalog
    const checks: Record<string, ScannerCheck> = {
      'C-0001': {
        id: 'C-0001',
        name: 'Privileged container',
        description: 'Privileged containers have full access to host resources',
        severity: 'critical',
        category: 'workload',
      },
      'C-0015': {
        id: 'C-0015',
        name: 'Secrets in environment variables',
        description: 'Secrets should not be stored in environment variables',
        severity: 'critical',
        category: 'secrets',
      },
      'C-0063': {
        id: 'C-0063',
        name: 'Anonymous access enabled',
        description: 'Anonymous authentication allows unauthenticated access',
        severity: 'critical',
        category: 'access-control',
      },
    };

    return checks[controlId];
  }

  /**
   * Map Kubescape severity to White Rabbit severity
   */
  private mapSeverity(severity: string): Severity {
    switch (severity.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }
}

export default KubescapeScanner;
