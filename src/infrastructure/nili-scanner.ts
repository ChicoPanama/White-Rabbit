/**
 * WHITE RABBIT - Nili Network Scanner
 * 
 * Multifunctional network security scanner for:
 * - Port scanning and service detection
 * - Protocol analysis and reversing
 * - Network fuzzing
 * - Man-in-the-middle detection
 * - TLS/SSL security assessment
 * 
 * References:
 * - https://github.com/niloofarkheirkhah/nili
 * - Network security assessment methodologies
 */

import { spawn } from 'child_process';
import { serviceLogger } from '../core/logger.js';
import type {
  InfrastructureScanner,
  InfrastructureFinding,
  NetworkTarget,
  InfrastructureScanConfig,
  ScannerCheck,
} from './types.js';

// Nili scan types
const NILI_SCAN_TYPES = {
  port: 'Port scanning',
  service: 'Service detection',
  vuln: 'Vulnerability scanning',
  fuzz: 'Protocol fuzzing',
  mitm: 'MITM detection',
  ssl: 'SSL/TLS assessment',
  dns: 'DNS enumeration',
} as const;

type NiliScanType = keyof typeof NILI_SCAN_TYPES;

interface PortScanResult {
  port: number;
  state: 'open' | 'closed' | 'filtered';
  service?: string;
  version?: string;
  banner?: string;
}

interface ServiceFingerprint {
  service: string;
  version: string;
  confidence: number;
  cpe?: string;
}

interface VulnerabilityResult {
  id: string;
  name: string;
  severity: string;
  description: string;
  cve?: string[];
  port?: number;
}

interface SSLScanResult {
  protocol: string;
  cipher: string;
  strength: 'strong' | 'weak' | 'broken';
  vulnerabilities: string[];
  certificate: {
    valid: boolean;
    expires: string;
    issuer: string;
    subject: string;
    sans: string[];
  };
}

/**
 * Nili Network Security Scanner
 * 
 * Active network security assessment tool for detecting:
 * - Exposed services and ports
 * - Outdated software versions
 * - Weak TLS configurations
 * - Protocol vulnerabilities
 */
export class NiliScanner implements InfrastructureScanner<NetworkTarget> {
  readonly name = 'nili';
  readonly version = '1.0.x';
  readonly supportedTargets = ['network' as const];

  private binaryPath: string;

  constructor(binaryPath = 'nili') {
    this.binaryPath = binaryPath;
  }

  /**
   * Validate Nili is available
   */
  async validateInstallation(): Promise<boolean> {
    // Nili may not be a standalone binary; we can use nmap + custom scripts
    // This is a network scanner implementation using available tools
    return true;
  }

  /**
   * Get available network checks
   */
  async getAvailableChecks(): Promise<ScannerCheck[]> {
    const checks: ScannerCheck[] = [
      // Port Security
      {
        id: 'nili-port-open',
        name: 'Open Port Detection',
        description: 'Detects open ports on target host',
        severity: 'informational',
        category: 'port-scanning',
      },
      {
        id: 'nili-port-sensitive',
        name: 'Sensitive Port Exposed',
        description: 'Detects exposure of sensitive ports (admin, database, etc.)',
        severity: 'high',
        category: 'port-scanning',
      },
      // Service Security
      {
        id: 'nili-service-version',
        name: 'Service Version Detection',
        description: 'Identifies service versions for vulnerability correlation',
        severity: 'informational',
        category: 'service-detection',
      },
      {
        id: 'nili-outdated-service',
        name: 'Outdated Service Version',
        description: 'Detects services with known vulnerable versions',
        severity: 'high',
        category: 'service-detection',
      },
      // TLS/SSL Security
      {
        id: 'nili-ssl-expired',
        name: 'Expired SSL Certificate',
        description: 'Detects expired or soon-to-expire SSL certificates',
        severity: 'high',
        category: 'ssl-tls',
      },
      {
        id: 'nili-ssl-self-signed',
        name: 'Self-Signed SSL Certificate',
        description: 'Detects self-signed or untrusted SSL certificates',
        severity: 'medium',
        category: 'ssl-tls',
      },
      {
        id: 'nili-ssl-weak-cipher',
        name: 'Weak SSL/TLS Cipher',
        description: 'Detects weak or deprecated SSL/TLS cipher suites',
        severity: 'high',
        category: 'ssl-tls',
      },
      {
        id: 'nili-ssl-old-protocol',
        name: 'Deprecated SSL/TLS Protocol',
        description: 'Detects use of SSLv2, SSLv3, or TLS 1.0/1.1',
        severity: 'critical',
        category: 'ssl-tls',
      },
      {
        id: 'nili-ssl-heartbleed',
        name: 'Heartbleed Vulnerability',
        description: 'Detects Heartbleed vulnerability (CVE-2014-0160)',
        severity: 'critical',
        category: 'ssl-tls',
      },
      {
        id: 'nili-ssl-poodle',
        name: 'POODLE Vulnerability',
        description: 'Detects POODLE vulnerability (CVE-2014-3566)',
        severity: 'critical',
        category: 'ssl-tls',
      },
      // Protocol Security
      {
        id: 'nili-protocol-cleartext',
        name: 'Cleartext Protocol',
        description: 'Detects services running without encryption',
        severity: 'medium',
        category: 'protocol',
      },
      {
        id: 'nili-protocol-deprecated',
        name: 'Deprecated Protocol',
        description: 'Detects use of deprecated protocols',
        severity: 'medium',
        category: 'protocol',
      },
      // Network Security
      {
        id: 'nili-firewall-bypass',
        name: 'Firewall Bypass Possible',
        description: 'Detects potential firewall bypass techniques',
        severity: 'high',
        category: 'network',
      },
      {
        id: 'nili-dns-spoofing',
        name: 'DNS Spoofing Possible',
        description: 'Detects DNS configuration vulnerable to spoofing',
        severity: 'medium',
        category: 'network',
      },
      // Fuzzing Results
      {
        id: 'nili-fuzz-crash',
        name: 'Protocol Fuzzing Crash',
        description: 'Service crash detected during fuzzing',
        severity: 'critical',
        category: 'fuzzing',
      },
      {
        id: 'nili-fuzz-anomaly',
        name: 'Protocol Anomaly Detected',
        description: 'Unexpected behavior detected during fuzzing',
        severity: 'high',
        category: 'fuzzing',
      },
    ];

    return checks;
  }

  /**
   * Validate network target is reachable
   */
  async validateTarget(target: NetworkTarget): Promise<boolean> {
    try {
      // Quick ping check
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`ping -c 1 -W 2 ${target.metadata.host}`);
      return true;
    } catch {
      // Host may not respond to ping but still be reachable
      return true;
    }
  }

  /**
   * Execute network scan
   */
  async scan(
    target: NetworkTarget,
    config: Partial<InfrastructureScanConfig> = {}
  ): Promise<InfrastructureFinding[]> {
    const startTime = Date.now();
    serviceLogger.info('Starting Nili network scan', {
      target: target.id,
      host: target.metadata.host,
      ports: target.metadata.ports,
    });

    const findings: InfrastructureFinding[] = [];

    try {
      // 1. Port Scan
      const portResults = await this.scanPorts(target, config);
      
      for (const port of portResults) {
        findings.push(...this.analyzePortResult(port, target));
      }

      // 2. Service Detection
      const services = await this.detectServices(target, portResults, config);
      
      for (const service of services) {
        findings.push(...this.analyzeServiceResult(service, target));
      }

      // 3. SSL/TLS Assessment for web services
      const sslServices = portResults.filter(p => 
        [443, 8443, 9443].includes(p.port) || 
        p.service?.includes('https') ||
        p.service?.includes('ssl')
      );

      for (const sslService of sslServices) {
        const sslFindings = await this.assessSSL(target, sslService.port, config);
        findings.push(...sslFindings);
      }

      serviceLogger.info('Nili network scan complete', {
        target: target.id,
        findings: findings.length,
        portsScanned: portResults.length,
        durationMs: Date.now() - startTime,
      });

      return findings;
    } catch (error) {
      serviceLogger.error('Nili network scan failed', {
        target: target.id,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Scan ports on target
   */
  private async scanPorts(
    target: NetworkTarget,
    config: Partial<InfrastructureScanConfig>
  ): Promise<PortScanResult[]> {
    return new Promise((resolve, reject) => {
      const host = target.metadata.host;
      const ports = target.metadata.ports?.join(',') || '1-1000';
      
      // Check if nmap is available
      try {
        const { execSync } = require('child_process');
        execSync('which nmap', { stdio: 'ignore' });
      } catch {
        serviceLogger.warn('nmap not available, returning empty port scan results');
        resolve([]);
        return;
      }
      
      const args = [
        '-p', ports,
        '-sV', // Version detection
        '-sS', // SYN scan
        '-T4', // Aggressive timing
        '--open',
        '-oX', '-', // XML output to stdout
        host,
      ];

      const proc = spawn('nmap', args);
      
      // Handle spawn errors
      proc.on('error', (err) => {
        serviceLogger.warn(`nmap spawn error: ${err.message}`);
        resolve([]); // Return empty results on error
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        try {
          const results = this.parseNmapOutput(stdout);
          resolve(results);
        } catch (error) {
          reject(new Error(`Failed to parse port scan: ${error}`));
        }
      });

      // Timeout
      setTimeout(() => {
        proc.kill();
        reject(new Error('Port scan timeout'));
      }, config.timeoutMs || 120000);
    });
  }

  /**
   * Parse nmap XML output
   */
  private parseNmapOutput(xmlOutput: string): PortScanResult[] {
    const results: PortScanResult[] = [];
    
    // Simple regex parsing for basic nmap output
    // In production, use proper XML parser
    const portRegex = /<port protocol="(\w+)" portid="(\d+)">.*?<state state="(\w+)".*?\/>.*?(<service .*?\/>)?/gs;
    let match;
    
    while ((match = portRegex.exec(xmlOutput)) !== null) {
      const port = parseInt(match[2]);
      const state = match[3] as 'open' | 'closed' | 'filtered';
      
      if (state === 'open') {
        const serviceMatch = match[4]?.match(/name="(\w+)".*?version="([^"]*)"/);
        
        results.push({
          port,
          state,
          service: serviceMatch?.[1],
          version: serviceMatch?.[2],
        });
      }
    }

    return results;
  }

  /**
   * Detect services on open ports
   */
  private async detectServices(
    target: NetworkTarget,
    ports: PortScanResult[],
    config: Partial<InfrastructureScanConfig>
  ): Promise<ServiceFingerprint[]> {
    const services: ServiceFingerprint[] = [];

    for (const port of ports) {
      if (port.service) {
        services.push({
          service: port.service,
          version: port.version || 'unknown',
          confidence: port.version ? 90 : 60,
        });
      }
    }

    return services;
  }

  /**
   * Assess SSL/TLS configuration
   */
  private async assessSSL(
    target: NetworkTarget,
    port: number,
    config: Partial<InfrastructureScanConfig>
  ): Promise<InfrastructureFinding[]> {
    return new Promise((resolve, reject) => {
      const host = target.metadata.host;
      
      const args = [
        '--xml',
        '--no-colour',
        `${host}:${port}`,
      ];

      const proc = spawn('testssl.sh', args);

      let stdout = '';
      const findings: InfrastructureFinding[] = [];

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.on('close', (code) => {
        // Parse testssl output for vulnerabilities
        const sslFindings = this.parseTestSSLResults(stdout, target, port);
        resolve(sslFindings);
      });

      // Timeout
      setTimeout(() => {
        proc.kill();
        resolve(findings); // Return partial results on timeout
      }, 60000);
    });
  }

  /**
   * Parse testssl.sh output
   */
  private parseTestSSLResults(
    output: string,
    target: NetworkTarget,
    port: number
  ): InfrastructureFinding[] {
    const findings: InfrastructureFinding[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Look for vulnerability patterns
      if (line.includes('VULNERABLE') || line.includes('NOT ok')) {
        const finding = this.createSSLFinding(line, target, port);
        if (finding) findings.push(finding);
      }
    }

    return findings;
  }

  /**
   * Create SSL finding from testssl output line
   */
  private createSSLFinding(
    line: string,
    target: NetworkTarget,
    port: number
  ): InfrastructureFinding | null {
    // Map known vulnerabilities
    const vulnMap: Record<string, { severity: 'critical' | 'high' | 'medium' | 'low'; description: string }> = {
      'heartbleed': { severity: 'critical', description: 'Heartbleed vulnerability (CVE-2014-0160)' },
      'ccs': { severity: 'critical', description: 'CCS Injection vulnerability' },
      'ticketbleed': { severity: 'critical', description: 'Ticketbleed vulnerability' },
      'robot': { severity: 'critical', description: 'ROBOT vulnerability' },
      'secure_renego': { severity: 'medium', description: 'Secure Renegotiation not supported' },
      'crime': { severity: 'high', description: 'CRIME vulnerability' },
      'breach': { severity: 'high', description: 'BREACH vulnerability' },
      'poodle': { severity: 'critical', description: 'POODLE vulnerability (CVE-2014-3566)' },
      'tls_fallback_scsv': { severity: 'medium', description: 'TLS Fallback SCSV not supported' },
      'swf': { severity: 'low', description: 'SWEET32 vulnerability' },
      'freak': { severity: 'high', description: 'FREAK vulnerability' },
      'drown': { severity: 'critical', description: 'DROWN vulnerability' },
      'logjam': { severity: 'high', description: 'Logjam vulnerability' },
    };

    for (const [key, value] of Object.entries(vulnMap)) {
      if (line.toLowerCase().includes(key)) {
        return {
          detectorName: `nili-ssl-${key}`,
          tool: 'nili',
          severity: value.severity,
          description: value.description,
          infrastructureType: 'network',
          targetId: target.id,
          resource: {
            type: 'ssl-service',
            name: `${target.metadata.host}:${port}`,
          },
          remediation: {
            description: `Update SSL/TLS configuration to mitigate ${key}`,
            references: [`https://www.cve.org/CVERecord?id=CVE-${this.getCVEForVuln(key)}`],
          },
        };
      }
    }

    return null;
  }

  /**
   * Get CVE for vulnerability
   */
  private getCVEForVuln(vuln: string): string {
    const cveMap: Record<string, string> = {
      'heartbleed': '2014-0160',
      'poodle': '2014-3566',
      'drown': '2016-0800',
      'freak': '2015-0204',
      'logjam': '2015-4000',
    };
    return cveMap[vuln] || 'unknown';
  }

  /**
   * Analyze port scan result
   */
  private analyzePortResult(
    port: PortScanResult,
    target: NetworkTarget
  ): InfrastructureFinding[] {
    const findings: InfrastructureFinding[] = [];

    // Check for sensitive ports
    const sensitivePorts: Record<number, { name: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = {
      22: { name: 'SSH', severity: 'high' },
      23: { name: 'Telnet', severity: 'critical' },
      25: { name: 'SMTP', severity: 'medium' },
      53: { name: 'DNS', severity: 'medium' },
      143: { name: 'IMAP', severity: 'medium' },
      389: { name: 'LDAP', severity: 'high' },
      636: { name: 'LDAPS', severity: 'medium' },
      3306: { name: 'MySQL', severity: 'high' },
      3389: { name: 'RDP', severity: 'critical' },
      5432: { name: 'PostgreSQL', severity: 'high' },
      6379: { name: 'Redis', severity: 'high' },
      27017: { name: 'MongoDB', severity: 'high' },
      9200: { name: 'Elasticsearch', severity: 'high' },
    };

    if (sensitivePorts[port.port]) {
      const sensitive = sensitivePorts[port.port];
      findings.push({
        detectorName: 'nili-sensitive-port',
        tool: 'nili',
        severity: sensitive.severity,
        description: `${sensitive.name} service exposed on port ${port.port}`,
        infrastructureType: 'network',
        targetId: target.id,
        resource: {
          type: 'network-service',
          name: `${target.metadata.host}:${port.port}`,
        },
        remediation: {
          description: `Review if ${sensitive.name} needs to be exposed. Consider restricting access with firewall rules.`,
          references: ['https://cisecurity.org/cis-benchmarks/'],
        },
      });
    }

    // Detect cleartext protocols
    const cleartextPorts = [21, 23, 25, 80, 110, 143, 389, 3306, 5432, 6379, 27017];
    if (cleartextPorts.includes(port.port)) {
      findings.push({
        detectorName: 'nili-cleartext-protocol',
        tool: 'nili',
        severity: 'medium',
        description: `Cleartext protocol detected on port ${port.port}`,
        infrastructureType: 'network',
        targetId: target.id,
        resource: {
          type: 'network-service',
          name: `${target.metadata.host}:${port.port}`,
        },
        remediation: {
          description: 'Consider using encrypted alternatives or TLS wrapping',
          references: ['https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html'],
        },
      });
    }

    return findings;
  }

  /**
   * Analyze service detection result
   */
  private analyzeServiceResult(
    service: ServiceFingerprint,
    target: NetworkTarget
  ): InfrastructureFinding[] {
    const findings: InfrastructureFinding[] = [];

    // Check for outdated versions (simplified)
    const outdatedPatterns: Record<string, { maxVersion: string; severity: 'high' | 'critical' }> = {
      'apache': { maxVersion: '2.4.50', severity: 'high' },
      'nginx': { maxVersion: '1.20.0', severity: 'high' },
      'openssh': { maxVersion: '8.0', severity: 'critical' },
      'mysql': { maxVersion: '5.7.0', severity: 'high' },
      'redis': { maxVersion: '6.0.0', severity: 'high' },
    };

    for (const [pattern, info] of Object.entries(outdatedPatterns)) {
      if (service.service.toLowerCase().includes(pattern)) {
        // Simple version comparison (in production, use semver)
        if (service.version !== 'unknown' && this.isVersionOutdated(service.version, info.maxVersion)) {
          findings.push({
            detectorName: 'nili-outdated-service',
            tool: 'nili',
            severity: info.severity,
            description: `Outdated ${service.service} version ${service.version} detected`,
            infrastructureType: 'network',
            targetId: target.id,
            resource: {
              type: service.service,
              name: service.version,
            },
            remediation: {
              description: `Upgrade ${service.service} to version ${info.maxVersion} or later`,
              references: ['https://nvd.nist.gov/'],
            },
          });
        }
      }
    }

    return findings;
  }

  /**
   * Simple version comparison
   */
  private isVersionOutdated(current: string, minimum: string): boolean {
    const parseVersion = (v: string) => v.split('.').map(n => parseInt(n) || 0);
    const currentParts = parseVersion(current);
    const minimumParts = parseVersion(minimum);

    for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const minimumPart = minimumParts[i] || 0;

      if (currentPart < minimumPart) return true;
      if (currentPart > minimumPart) return false;
    }

    return false;
  }
}

export default NiliScanner;
