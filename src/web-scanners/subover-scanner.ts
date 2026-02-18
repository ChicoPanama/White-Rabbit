/**
 * WHITE RABBIT - SubOver Subdomain Takeover Scanner
 * 
 * Detects subdomain takeover vulnerabilities where a subdomain points
 * to an unclaimed cloud resource (AWS, Heroku, GitHub Pages, etc.).
 * 
 * Attackers can claim these abandoned resources and serve malicious content
 * on the victim's subdomain, enabling phishing and reputation attacks.
 * 
 * References:
 * - https://github.com/Ice3man543/SubOver
 * - https://0xpatrik.com/subdomain-takeover-basics/
 */

import { spawn } from 'child_process';
import type {
  WebScanner,
  WebFinding,
  SubdomainTarget,
  WebScanConfig,
  OWASPCheck,
  SubdomainTakeoverFinding,
  VulnerableService,
} from './types.js';
import { serviceLogger } from '../core/logger.js';

// Known vulnerable services and their fingerprints
const VULNERABLE_SERVICES: VulnerableService[] = [
  // AWS Services
  {
    name: 'AWS S3 Bucket',
    cnamePattern: /\.s3-website[.-]/i,
    fingerprint: /NoSuchBucket|The specified bucket does not exist/i,
    claimable: true,
    severity: 'critical',
  },
  {
    name: 'AWS Elastic Beanstalk',
    cnamePattern: /\.elasticbeanstalk\.com$/i,
    fingerprint: /404 Not Found/i,
    claimable: true,
    severity: 'critical',
  },
  {
    name: 'AWS CloudFront',
    cnamePattern: /\.cloudfront\.net$/i,
    fingerprint: /Bad Request|ERROR: The request could not be satisfied/i,
    claimable: false,
    severity: 'high',
  },
  // GitHub
  {
    name: 'GitHub Pages',
    cnamePattern: /\.github\.io$/i,
    fingerprint: /There isn't a GitHub Pages site here|404 Not Found/i,
    claimable: true,
    severity: 'critical',
  },
  // Heroku
  {
    name: 'Heroku',
    cnamePattern: /\.herokuapp\.com$/i,
    fingerprint: /No such app|There's nothing here, yet/i,
    claimable: true,
    severity: 'critical',
  },
  // Vercel
  {
    name: 'Vercel',
    cnamePattern: /\.vercel\.app$/i,
    fingerprint: /The deployment could not be found on Vercel/i,
    claimable: true,
    severity: 'critical',
  },
  // Netlify
  {
    name: 'Netlify',
    cnamePattern: /\.netlify\.app$/i,
    fingerprint: /Not Found|Page Not Found/i,
    claimable: true,
    severity: 'critical',
  },
  // Surge.sh
  {
    name: 'Surge.sh',
    cnamePattern: /\.surge\.sh$/i,
    fingerprint: /project not found/i,
    claimable: true,
    severity: 'critical',
  },
  // Azure
  {
    name: 'Azure App Service',
    cnamePattern: /\.azurewebsites\.net$/i,
    fingerprint: /Error 404 - Web app not found|404 Not Found/i,
    claimable: true,
    severity: 'critical',
  },
  {
    name: 'Azure Blob Storage',
    cnamePattern: /\.blob\.core\.windows\.net$/i,
    fingerprint: /The specified resource does not exist/i,
    claimable: true,
    severity: 'critical',
  },
  // Google Cloud
  {
    name: 'Google Cloud Storage',
    cnamePattern: /\.storage\.googleapis\.com$/i,
    fingerprint: /No such bucket/i,
    claimable: true,
    severity: 'critical',
  },
  // Fastly
  {
    name: 'Fastly',
    cnamePattern: /\.fastly\.net$/i,
    fingerprint: /Fastly error: unknown domain/i,
    claimable: false,
    severity: 'medium',
  },
  // Shopify
  {
    name: 'Shopify',
    cnamePattern: /\.myshopify\.com$/i,
    fingerprint: /Sorry, this shop is currently unavailable|Only one step left/i,
    claimable: true,
    severity: 'critical',
  },
  // Tumblr
  {
    name: 'Tumblr',
    cnamePattern: /\.tumblr\.com$/i,
    fingerprint: /Not found|There's nothing here/i,
    claimable: true,
    severity: 'high',
  },
  // WordPress.com
  {
    name: 'WordPress.com',
    cnamePattern: /\.wordpress\.com$/i,
    fingerprint: /Do you want to register|site doesn'?t exist/i,
    claimable: true,
    severity: 'high',
  },
  // Pantheon
  {
    name: 'Pantheon',
    cnamePattern: /\.pantheonsite\.io$/i,
    fingerprint: /404 error unknown site/i,
    claimable: true,
    severity: 'critical',
  },
  // Unbounce
  {
    name: 'Unbounce',
    cnamePattern: /\.unbouncepages\.com$/i,
    fingerprint: /The requested URL was not found on this server/i,
    claimable: false,
    severity: 'medium',
  },
  // Bitbucket
  {
    name: 'Bitbucket',
    cnamePattern: /\.bitbucket\.io$/i,
    fingerprint: /Repository not found/i,
    claimable: true,
    severity: 'critical',
  },
  // Ghost
  {
    name: 'Ghost.io',
    cnamePattern: /\.ghost\.io$/i,
    fingerprint: /Domain is not configured/i,
    claimable: true,
    severity: 'critical',
  },
  // Help Scout
  {
    name: 'Help Scout',
    cnamePattern: /\.helpscoutdocs\.com$/i,
    fingerprint: /No settings were found for this company/i,
    claimable: true,
    severity: 'high',
  },
  // JetBrains
  {
    name: 'JetBrains YouTrack',
    cnamePattern: /\.myjetbrains\.com$/i,
    fingerprint: /YouTrack Starting Page|is not a registered InCloud YouTrack/i,
    claimable: false,
    severity: 'medium',
  },
  // ReadMe
  {
    name: 'ReadMe',
    cnamePattern: /\.readme\.io$/i,
    fingerprint: /Project doesnt exist|Project not found/i,
    claimable: true,
    severity: 'critical',
  },
  // StatusPage
  {
    name: 'StatusPage',
    cnamePattern: /\.statuspage\.io$/i,
    fingerprint: /Hosted Status Page/i,
    claimable: false,
    severity: 'low',
  },
  // Zendesk
  {
    name: 'Zendesk',
    cnamePattern: /\.zendesk\.com$/i,
    fingerprint: /Help Center Closed|Zendesk.com/i,
    claimable: false,
    severity: 'medium',
  },
];

// OWASP checks for subdomain takeover
const SUBOVER_CHECKS: OWASPCheck[] = [
  {
    id: 'subdomain-takeover',
    name: 'Subdomain Takeover',
    category: 'security-misconfig',
    severity: 'critical',
    description: 'Subdomain points to unclaimed cloud resource',
    cwe: 'CWE-350',
  },
  {
    id: 'wildcard-dns',
    name: 'Wildcard DNS Misconfiguration',
    category: 'security-misconfig',
    severity: 'medium',
    description: 'Wildcard DNS record may allow subdomain takeover',
    cwe: 'CWE-284',
  },
  {
    id: 'dangling-cname',
    name: 'Dangling CNAME Record',
    category: 'security-misconfig',
    severity: 'high',
    description: 'CNAME record points to deleted resource',
    cwe: 'CWE-1104',
  },
];

/**
 * SubOver Subdomain Takeover Scanner
 * 
 * Continuously monitors domains and subdomains for takeover
 * vulnerabilities that could be exploited by attackers.
 */
export class SubOverScanner implements WebScanner<SubdomainTarget> {
  readonly name = 'subover';
  readonly version = '2.0.x';
  readonly supportedTargets = ['subdomain' as const];

  private binaryPath: string;

  constructor(binaryPath = 'subover') {
    this.binaryPath = binaryPath;
  }

  /**
   * Validate SubOver is available
   */
  async validateInstallation(): Promise<boolean> {
    return true;
  }

  /**
   * Get available checks
   */
  async getAvailableChecks(): Promise<OWASPCheck[]> {
    return SUBOVER_CHECKS;
  }

  /**
   * Validate subdomain target
   */
  async validateTarget(target: SubdomainTarget): Promise<boolean> {
    return target.metadata.subdomains.length > 0;
  }

  /**
   * Execute SubOver scan
   */
  async scan(
    target: SubdomainTarget,
    config: Partial<WebScanConfig> = {}
  ): Promise<WebFinding[]> {
    const startTime = Date.now();
    serviceLogger.info('Starting SubOver scan', {
      target: target.id,
      rootDomain: target.metadata.rootDomain,
      subdomains: target.metadata.subdomains.length,
    });

    const findings: SubdomainTakeoverFinding[] = [];

    try {
      // Resolve DNS for each subdomain
      for (const subdomain of target.metadata.subdomains) {
        const subdomainFindings = await this.checkSubdomain(
          subdomain,
          target.metadata.rootDomain
        );
        findings.push(...subdomainFindings);
      }

      // Check for wildcard DNS issues
      const wildcardFinding = await this.checkWildcardDNS(target);
      if (wildcardFinding) {
        findings.push(wildcardFinding);
      }

      serviceLogger.info('SubOver scan complete', {
        target: target.id,
        findings: findings.length,
        durationMs: Date.now() - startTime,
      });

      return findings;
    } catch (error) {
      serviceLogger.error('SubOver scan failed', {
        target: target.id,
        error: String(error),
      });
      return findings;
    }
  }

  /**
   * Check individual subdomain for takeover
   */
  private async checkSubdomain(
    subdomain: string,
    rootDomain: string
  ): Promise<SubdomainTakeoverFinding[]> {
    const findings: SubdomainTakeoverFinding[] = [];

    try {
      // Get DNS records
      const dnsRecords = await this.resolveDNS(subdomain);

      // Check CNAME records for vulnerable patterns
      for (const record of dnsRecords) {
        if (record.type === 'CNAME') {
          const service = this.identifyVulnerableService(record.value);

          if (service) {
            // Check if the service is actually vulnerable
            const isVulnerable = await this.verifyVulnerability(
              subdomain,
              service
            );

            if (isVulnerable) {
              findings.push({
                detectorName: 'subover-takeover',
                tool: 'subover',
                severity: service.severity,
                description: `Subdomain takeover possible on ${subdomain} via ${service.name}`,
                targetUrl: `https://${subdomain}`,
                webTargetType: 'subdomain',
                subdomain: subdomain,
                vulnerableService: service.name,
                cnameRecord: record.value,
                fingerprint: service.fingerprint.source,
                claimable: service.claimable,
                owasp: { category: 'security-misconfig', top10Id: 'A05' },
                remediation: {
                  description: service.claimable
                    ? `Immediately claim the resource on ${service.name} or remove the DNS record`
                    : `Contact ${service.name} support to reclaim the resource`,
                  references: [
                    'https://0xpatrik.com/subdomain-takeover-basics/',
                    'https://github.com/EdOverflow/can-i-take-over-xyz',
                  ],
                },
              });
            } else {
              // Dangling CNAME but service not claimable
              findings.push({
                detectorName: 'subover-dangling-cname',
                tool: 'subover',
                severity: 'medium',
                description: `Dangling CNAME record detected for ${subdomain}`,
                targetUrl: `https://${subdomain}`,
                webTargetType: 'subdomain',
                subdomain: subdomain,
                vulnerableService: service.name,
                cnameRecord: record.value,
                fingerprint: '',
                claimable: false,
                owasp: { category: 'security-misconfig', top10Id: 'A05' },
                remediation: {
                  description: 'Remove the dangling CNAME record',
                  references: ['https://0xpatrik.com/subdomain-takeover-basics/'],
                },
              });
            }
          }
        }
      }
    } catch (error) {
      serviceLogger.warn(`Failed to check subdomain ${subdomain}`, {
        error: String(error),
      });
    }

    return findings;
  }

  /**
   * Resolve DNS records for subdomain
   */
  private async resolveDNS(subdomain: string): Promise<
    Array<{ type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'; value: string }>
  > {
    const records: Array<{ type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'; value: string }> = [];

    try {
      // Use Node.js dns module
      const { promises: dns } = await import('dns');

      // Try to resolve CNAME
      try {
        const cname = await dns.resolveCname(subdomain);
        for (const value of cname) {
          records.push({ type: 'CNAME', value });
        }
      } catch {
        // No CNAME record
      }

      // Try to resolve A records
      try {
        const addresses = await dns.resolve4(subdomain);
        for (const value of addresses) {
          records.push({ type: 'A', value });
        }
      } catch {
        // No A records
      }

      // Try to resolve AAAA records
      try {
        const addresses = await dns.resolve6(subdomain);
        for (const value of addresses) {
          records.push({ type: 'AAAA', value });
        }
      } catch {
        // No AAAA records
      }
    } catch (error) {
      serviceLogger.warn(`DNS resolution failed for ${subdomain}`, {
        error: String(error),
      });
    }

    return records;
  }

  /**
   * Identify if CNAME points to a vulnerable service
   */
  private identifyVulnerableService(cname: string): VulnerableService | null {
    for (const service of VULNERABLE_SERVICES) {
      if (service.cnamePattern.test(cname)) {
        return service;
      }
    }
    return null;
  }

  /**
   * Verify if the vulnerability is exploitable
   */
  private async verifyVulnerability(
    subdomain: string,
    service: VulnerableService
  ): Promise<boolean> {
    try {
      // Make HTTP request to check fingerprint
      const response = await fetch(`http://${subdomain}`, {
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });

      const content = await response.text();

      // Check if response matches vulnerability fingerprint
      return service.fingerprint.test(content);
    } catch (error) {
      // Request failed - might indicate vulnerability
      return true;
    }
  }

  /**
   * Check for wildcard DNS misconfiguration
   */
  private async checkWildcardDNS(
    target: SubdomainTarget
  ): Promise<SubdomainTakeoverFinding | null> {
    try {
      // Generate random subdomain
      const randomSubdomain = `wildcard-test-${Date.now()}.${target.metadata.rootDomain}`;

      // Try to resolve it
      const { promises: dns } = await import('dns');

      try {
        await dns.resolve4(randomSubdomain);
        // If resolves, wildcard DNS is configured
        return {
          detectorName: 'subover-wildcard',
          tool: 'subover',
          severity: 'medium',
          description: `Wildcard DNS detected for ${target.metadata.rootDomain}`,
          targetUrl: `https://${target.metadata.rootDomain}`,
          webTargetType: 'subdomain',
          subdomain: `*.${target.metadata.rootDomain}`,
          vulnerableService: 'Wildcard DNS',
          cnameRecord: '',
          fingerprint: '',
          claimable: false,
          owasp: { category: 'security-misconfig', top10Id: 'A05' },
          remediation: {
            description: 'Review wildcard DNS configuration to prevent unintended subdomain creation',
            references: ['https://0xpatrik.com/subdomain-takeover-basics/'],
          },
        };
      } catch {
        // Doesn't resolve, no wildcard
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Batch scan multiple domains
   */
  async scanBatch(
    targets: SubdomainTarget[],
    config?: Partial<WebScanConfig>
  ): Promise<Map<string, WebFinding[]>> {
    const results = new Map<string, WebFinding[]>();

    await Promise.all(
      targets.map(async target => {
        const findings = await this.scan(target, config);
        results.set(target.id, findings);
      })
    );

    return results;
  }
}

export default SubOverScanner;
