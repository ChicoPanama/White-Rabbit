/**
 * WHITE RABBIT - Web Security Scanner Types
 * 
 * Defines types for web application security scanning:
 * - OWASP vulnerability detection (BlackWidow)
 * - Subdomain takeover detection (SubOver)
 * - DOM XSS detection for SPAs (DomDig)
 */

import type { BaseFinding, Finding, Severity } from '../types/index.js';

// ============================================================================
// WEB SCANNER TARGET TYPES
// ============================================================================

export type WebTargetType = 'webapp' | 'subdomain' | 'spa' | 'api';

export interface WebTarget {
  id: string;
  type: WebTargetType;
  name: string;
  url: string;
  metadata: Record<string, any>;
  scanConfig?: WebScanConfig;
}

export interface WebAppTarget extends WebTarget {
  type: 'webapp';
  url: string;
  metadata: {
    domain: string;
    paths?: string[];
    authenticated?: boolean;
  };
}

export interface SubdomainTarget extends WebTarget {
  type: 'subdomain';
  url: string;
  metadata: {
    rootDomain: string;
    subdomains: string[];
    dnsRecords?: DNSRecord[];
  };
}

export interface SPATarget extends WebTarget {
  type: 'spa';
  url: string;
  metadata: {
    framework?: string;
    routes?: string[];
    authRequired?: boolean;
  };
}

export interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  value: string;
  vulnerable?: boolean;
}

// ============================================================================
// SCAN CONFIGURATION
// ============================================================================

export interface WebScanConfig {
  severityThreshold: Severity;
  includeChecks: string[];
  excludeChecks: string[];
  timeoutMs: number;
  maxDepth: number;
  maxUrls: number;
  parallelRequests: number;
  userAgent?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'cookie';
    credentials: string;
  };
}

export const DefaultWebScanConfig: WebScanConfig = {
  severityThreshold: 'medium',
  includeChecks: [],
  excludeChecks: [],
  timeoutMs: 300000,
  maxDepth: 3,
  maxUrls: 100,
  parallelRequests: 5,
};

// ============================================================================
// OWASP VULNERABILITY TYPES
// ============================================================================

export type OWASPCategory =
  | 'injection'
  | 'broken-auth'
  | 'sensitive-data'
  | 'xxe'
  | 'broken-access'
  | 'security-misconfig'
  | 'xss'
  | 'insecure-deserialization'
  | 'vulnerable-components'
  | 'logging-failures';

export interface OWASPCheck {
  id: string;
  name: string;
  category: OWASPCategory;
  severity: Severity;
  description: string;
  cwe?: string;
  remediation?: string;
}

// ============================================================================
// WEB FINDINGS
// ============================================================================

export interface WebFinding extends BaseFinding {
  webTargetType: WebTargetType;
  targetUrl: string;
  
  // OWASP classification
  owasp?: {
    category: OWASPCategory;
    top10Id: string;
  };
  
  // Vulnerability details
  vulnerability?: {
    type: string;
    parameter?: string;
    payload?: string;
    evidence?: string;
  };
  
  // HTTP context
  httpContext?: {
    method: string;
    path: string;
    statusCode?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
  };
  
  // Remediation
  remediation?: {
    description: string;
    codeExample?: string;
    references: string[];
  };
}

// ============================================================================
// SUBDOMAIN TAKEOVER TYPES
// ============================================================================

export interface SubdomainTakeoverFinding extends WebFinding {
  subdomain: string;
  vulnerableService: string;
  cnameRecord: string;
  fingerprint: string;
  claimable: boolean;
}

export interface VulnerableService {
  name: string;
  cnamePattern: RegExp;
  fingerprint: RegExp;
  claimable: boolean;
  severity: Severity;
}

// ============================================================================
// DOM XSS TYPES
// ============================================================================

export interface DOMXSSFinding extends WebFinding {
  source: string;
  sink: string;
  codeFlow: string[];
  exploitable: boolean;
  browserContext?: {
    url: string;
    hash?: string;
    search?: string;
  };
}

export interface DOMSource {
  type: 'url' | 'hash' | 'search' | 'cookie' | 'localStorage' | 'postMessage';
  accessPattern: string;
}

export interface DOMSink {
  type: 'innerHTML' | 'eval' | 'setTimeout' | 'document.write' | 'location';
  functionName: string;
}

// ============================================================================
// SCANNER INTERFACE
// ============================================================================

export interface WebScanner<T extends WebTarget = WebTarget> {
  readonly name: string;
  readonly version: string;
  readonly supportedTargets: WebTargetType[];
  
  scan(target: T, config?: Partial<WebScanConfig>): Promise<WebFinding[]>;
  validateTarget(target: T): Promise<boolean>;
  getAvailableChecks(): Promise<OWASPCheck[]>;
}

// ============================================================================
// SCAN RESULTS
// ============================================================================

export interface WebScanResult {
  target: WebTarget;
  timestamp: Date;
  durationMs: number;
  findings: WebFinding[];
  crawledUrls: string[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  errors: string[];
}

// ============================================================================
// CRAWLER TYPES
// ============================================================================

export interface CrawledPage {
  url: string;
  status: number;
  contentType: string;
  forms: WebForm[];
  links: string[];
  scripts: string[];
  inputs: WebInput[];
}

export interface WebForm {
  action: string;
  method: string;
  inputs: WebInput[];
}

export interface WebInput {
  name: string;
  type: string;
  value?: string;
}
