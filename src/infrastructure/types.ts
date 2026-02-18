/**
 * WHITE RABBIT - Infrastructure Security Types
 * 
 * Defines types for infrastructure, network, and cloud security scanning.
 * Extends White Rabbit's capabilities beyond smart contracts to cover:
 * - Kubernetes cluster security (Kubescape)
 * - AWS cloud configuration (CloudSploit)
 * - Network security (Nili)
 */

import type { BaseFinding, Finding, Severity } from '../types/index.js';

// ============================================================================
// INFRASTRUCTURE TARGET TYPES
// ============================================================================

export type InfrastructureTargetType = 'kubernetes' | 'aws' | 'network' | 'azure' | 'gcp';

export interface InfrastructureTarget {
  id: string;
  type: InfrastructureTargetType;
  name: string;
  metadata: Record<string, any>;
  credentials?: InfrastructureCredentials;
  scanConfig?: InfrastructureScanConfig;
}

export interface KubernetesTarget extends InfrastructureTarget {
  type: 'kubernetes';
  kubeconfigPath?: string;
  context?: string;
  namespace?: string;
  metadata: {
    clusterName: string;
    version?: string;
    nodeCount?: number;
    podCount?: number;
  };
}

export interface AWSTarget extends InfrastructureTarget {
  type: 'aws';
  metadata: {
    accountId: string;
    regions: string[];
    services: string[];
  };
}

export interface NetworkTarget extends InfrastructureTarget {
  type: 'network';
  metadata: {
    host: string;
    ports?: number[];
    protocol?: 'tcp' | 'udp' | 'both';
  };
}

// ============================================================================
// CREDENTIALS & AUTHENTICATION
// ============================================================================

export interface InfrastructureCredentials {
  type: 'kubeconfig' | 'aws-profile' | 'aws-keys' | 'token' | 'cert';
  // Reference to credential store (not actual credentials)
  reference: string;
}

// ============================================================================
// SCAN CONFIGURATION
// ============================================================================

export interface InfrastructureScanConfig {
  severityThreshold: Severity;
  includeChecks: string[];
  excludeChecks: string[];
  timeoutMs: number;
  maxDepth?: number;
  parallelScans: number;
}

export const DefaultInfrastructureScanConfig: InfrastructureScanConfig = {
  severityThreshold: 'medium',
  includeChecks: [],
  excludeChecks: [],
  timeoutMs: 300000, // 5 minutes
  parallelScans: 3,
};

// ============================================================================
// INFRASTRUCTURE FINDINGS
// ============================================================================

export interface InfrastructureFinding extends BaseFinding {
  infrastructureType: InfrastructureTargetType;
  targetId: string;
  
  // Framework-specific details
  framework?: {
    name: string;
    version: string;
    checkId: string;
    checkName: string;
  };
  
  // Remediation guidance
  remediation?: {
    description: string;
    automated?: boolean;
    script?: string;
    references: string[];
  };
  
  // Resource context
  resource?: {
    type: string;
    name: string;
    namespace?: string;
    region?: string;
    arn?: string;
    labels?: Record<string, string>;
  };
}

// ============================================================================
// SCANNER INTERFACES
// ============================================================================

export interface InfrastructureScanner<T extends InfrastructureTarget = InfrastructureTarget> {
  readonly name: string;
  readonly version: string;
  readonly supportedTargets: InfrastructureTargetType[];
  
  scan(target: T, config?: Partial<InfrastructureScanConfig>): Promise<InfrastructureFinding[]>;
  validateTarget(target: T): Promise<boolean>;
  getAvailableChecks(): Promise<ScannerCheck[]>;
}

export interface ScannerCheck {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: string;
  remediation?: string;
}

// ============================================================================
// SCAN RESULTS
// ============================================================================

export interface InfrastructureScanResult {
  target: InfrastructureTarget;
  timestamp: Date;
  durationMs: number;
  findings: InfrastructureFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  errors: string[];
  rawOutput?: string;
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

export interface InfrastructureAgentConfig {
  enabledScanners: string[];
  globalConfig: Partial<InfrastructureScanConfig>;
  targets: InfrastructureTarget[];
  schedule?: {
    enabled: boolean;
    cron: string;
  };
  alerting: {
    minSeverity: Severity;
    channels: string[];
  };
}

// ============================================================================
// COMPLIANCE FRAMEWORKS
// ============================================================================

export type ComplianceFramework = 
  | 'nsa-cisa'
  | 'cis'
  | 'mitre-attack'
  | 'pci-dss'
  | 'soc2'
  | 'gdpr'
  | 'hipaa';

export interface ComplianceMapping {
  checkId: string;
  frameworks: {
    name: ComplianceFramework;
    control: string;
    description: string;
  }[];
}
