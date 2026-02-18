/**
 * WHITE RABBIT - CloudSploit Scanner
 * 
 * AWS security configuration scanner based on CloudSploit.
 * Audits AWS accounts for common vulnerabilities:
 * - Open S3 buckets
 * - Weak IAM policies
 * - Exposed keys
 * - Security group misconfigurations
 * - Unencrypted resources
 * 
 * References:
 * - https://github.com/aquasecurity/cloudsploit
 * - AWS Well-Architected Security Pillar
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import type {
  InfrastructureScanner,
  InfrastructureFinding,
  AWSTarget,
  InfrastructureScanConfig,
  ScannerCheck,
} from './types.js';
import type { Severity } from '../types/index.js';
import { serviceLogger } from '../core/logger.js';

const exec = promisify(execCb);

// CloudSploit categories
const CLOUDSPLOIT_CATEGORIES = {
  'ACM': 'AWS Certificate Manager',
  'APIGateway': 'API Gateway',
  'Athena': 'Athena',
  'AutoScaling': 'Auto Scaling',
  'CloudFormation': 'CloudFormation',
  'CloudFront': 'CloudFront',
  'CloudTrail': 'CloudTrail',
  'CloudWatchLogs': 'CloudWatch Logs',
  'CodeBuild': 'CodeBuild',
  'Comprehend': 'Comprehend',
  'ConfigService': 'Config Service',
  'DMS': 'Database Migration Service',
  'DynamoDB': 'DynamoDB',
  'EC2': 'EC2',
  'ECR': 'ECR',
  'ECS': 'ECS',
  'EFS': 'EFS',
  'EKS': 'EKS',
  'ELB': 'ELB',
  'ELBv2': 'ELBv2',
  'EMR': 'EMR',
  'ES': 'Elasticsearch',
  'ElastiCache': 'ElastiCache',
  'FMS': 'Firewall Manager',
  'Glue': 'Glue',
  'GuardDuty': 'GuardDuty',
  'IAM': 'IAM',
  'KMS': 'KMS',
  'Kinesis': 'Kinesis',
  'Lambda': 'Lambda',
  'Lex': 'Lex',
  'MQ': 'MQ',
  'MSK': 'Managed Streaming for Kafka',
  'ManagedActiveDirectory': 'Managed Active Directory',
  'MemoryDB': 'MemoryDB',
  'NLB': 'Network Load Balancer',
  'OpenSearchServerless': 'OpenSearch Serverless',
  'Organizations': 'Organizations',
  'Pinpoint': 'Pinpoint',
  'QLDB': 'Quantum Ledger Database',
  'RDS': 'RDS',
  'Redshift': 'Redshift',
  'Route53': 'Route53',
  'S3': 'S3',
  'SES': 'SES',
  'SNS': 'SNS',
  'SQS': 'SQS',
  'SSM': 'Systems Manager',
  'SageMaker': 'SageMaker',
  'SecretsManager': 'Secrets Manager',
  'SecurityHub': 'Security Hub',
  'Shield': 'Shield',
  'Timestream': 'Timestream',
  'Translate': 'Translate',
  'WAF': 'WAF',
  'WAFRegional': 'WAF Regional',
  'WorkSpaces': 'WorkSpaces',
} as const;

interface CloudSploitResult {
  Title: string;
  Description: string;
  Category: string;
  Resource?: string;
  Region?: string;
  Status: 0 | 1 | 2 | 3; // 0=OK, 1=WARN, 2=FAIL, 3=UNKNOWN
  Message?: string;
  compliance?: string[];
}

/**
 * CloudSploit AWS Security Scanner
 * 
 * Scans AWS infrastructure for security misconfigurations,
 * compliance violations, and best practice deviations.
 */
export class CloudSploitScanner implements InfrastructureScanner<AWSTarget> {
  readonly name = 'cloudsploit';
  readonly version = '3.0.x';
  readonly supportedTargets = ['aws' as const];

  private binaryPath: string;

  constructor(binaryPath = 'cloudsploitscan') {
    this.binaryPath = binaryPath;
  }

  /**
   * Validate CloudSploit/AWS CLI is available
   */
  async validateInstallation(): Promise<boolean> {
    try {
      // Check for AWS CLI
      await exec('aws --version');
      return true;
    } catch {
      serviceLogger.warn('AWS CLI not found, cloud scanning may be limited');
      return false;
    }
  }

  /**
   * Get available CloudSploit checks
   */
  async getAvailableChecks(): Promise<ScannerCheck[]> {
    const checks: ScannerCheck[] = [
      // IAM Security
      {
        id: 'iam-root-account-mfa',
        name: 'Root Account MFA Enabled',
        description: 'Ensures root account has MFA enabled',
        severity: 'critical',
        category: 'IAM',
      },
      {
        id: 'iam-root-access-keys',
        name: 'Root Account Access Keys',
        description: 'Ensures root account does not have access keys',
        severity: 'critical',
        category: 'IAM',
      },
      {
        id: 'iam-password-requires-uppercase',
        name: 'Password Policy Requires Uppercase',
        description: 'Ensures password policy requires uppercase letters',
        severity: 'medium',
        category: 'IAM',
      },
      {
        id: 'iam-password-requires-lowercase',
        name: 'Password Policy Requires Lowercase',
        description: 'Ensures password policy requires lowercase letters',
        severity: 'medium',
        category: 'IAM',
      },
      {
        id: 'iam-password-requires-symbols',
        name: 'Password Policy Requires Symbols',
        description: 'Ensures password policy requires symbols',
        severity: 'medium',
        category: 'IAM',
      },
      {
        id: 'iam-password-requires-numbers',
        name: 'Password Policy Requires Numbers',
        description: 'Ensures password policy requires numbers',
        severity: 'medium',
        category: 'IAM',
      },
      {
        id: 'iam-password-min-length',
        name: 'Password Minimum Length',
        description: 'Ensures password policy requires minimum length of 14',
        severity: 'medium',
        category: 'IAM',
      },
      {
        id: 'iam-password-reuse-prevention',
        name: 'Password Reuse Prevention',
        description: 'Ensures password policy prevents reuse',
        severity: 'medium',
        category: 'IAM',
      },
      {
        id: 'iam-no-user-policies',
        name: 'IAM User Direct Policy Attachment',
        description: 'Ensures IAM policies are not attached directly to users',
        severity: 'low',
        category: 'IAM',
      },
      {
        id: 'iam-role-policies',
        name: 'IAM Role Policies',
        description: 'Ensures IAM roles have appropriate policies',
        severity: 'medium',
        category: 'IAM',
      },
      // S3 Security
      {
        id: 's3-bucket-all-users-policy',
        name: 'S3 Bucket All Users Policy',
        description: 'Detects S3 buckets with public access policies',
        severity: 'critical',
        category: 'S3',
      },
      {
        id: 's3-bucket-all-users-acl',
        name: 'S3 Bucket All Users ACL',
        description: 'Detects S3 buckets with public ACLs',
        severity: 'critical',
        category: 'S3',
      },
      {
        id: 's3-bucket-logging',
        name: 'S3 Bucket Logging Enabled',
        description: 'Ensures S3 bucket logging is enabled',
        severity: 'medium',
        category: 'S3',
      },
      {
        id: 's3-bucket-encryption',
        name: 'S3 Bucket Encryption',
        description: 'Ensures S3 buckets have encryption enabled',
        severity: 'high',
        category: 'S3',
      },
      {
        id: 's3-bucket-versioning',
        name: 'S3 Bucket Versioning',
        description: 'Ensures S3 bucket versioning is enabled',
        severity: 'medium',
        category: 'S3',
      },
      {
        id: 's3-bucket-website-enabled',
        name: 'S3 Bucket Website Enabled',
        description: 'Detects S3 buckets with website hosting',
        severity: 'low',
        category: 'S3',
      },
      // EC2 Security
      {
        id: 'ec2-security-group-ingress-all',
        name: 'Security Group All Ports Open',
        description: 'Detects security groups allowing all ports',
        severity: 'critical',
        category: 'EC2',
      },
      {
        id: 'ec2-security-group-egress-all',
        name: 'Security Group All Egress',
        description: 'Detects security groups allowing all egress',
        severity: 'medium',
        category: 'EC2',
      },
      {
        id: 'ec2-open-ssh',
        name: 'Security Group Open SSH',
        description: 'Detects security groups with SSH (22) open to the world',
        severity: 'critical',
        category: 'EC2',
      },
      {
        id: 'ec2-open-rdp',
        name: 'Security Group Open RDP',
        description: 'Detects security groups with RDP (3389) open to the world',
        severity: 'critical',
        category: 'EC2',
      },
      {
        id: 'ec2-default-security-group',
        name: 'Default Security Group',
        description: 'Ensures default security group restricts all traffic',
        severity: 'medium',
        category: 'EC2',
      },
      {
        id: 'ec2-instance-key-based-auth',
        name: 'EC2 Key Based Authentication',
        description: 'Detects EC2 instances using key-based auth',
        severity: 'low',
        category: 'EC2',
      },
      // RDS Security
      {
        id: 'rds-encryption-enabled',
        name: 'RDS Encryption Enabled',
        description: 'Ensures RDS instances have encryption enabled',
        severity: 'high',
        category: 'RDS',
      },
      {
        id: 'rds-publicly-accessible',
        name: 'RDS Publicly Accessible',
        description: 'Detects RDS instances that are publicly accessible',
        severity: 'critical',
        category: 'RDS',
      },
      {
        id: 'rds-snapshot-encryption',
        name: 'RDS Snapshot Encryption',
        description: 'Ensures RDS snapshots are encrypted',
        severity: 'high',
        category: 'RDS',
      },
      {
        id: 'rds-automated-backups',
        name: 'RDS Automated Backups',
        description: 'Ensures RDS has automated backups enabled',
        severity: 'medium',
        category: 'RDS',
      },
      // CloudTrail Security
      {
        id: 'cloudtrail-enabled',
        name: 'CloudTrail Enabled',
        description: 'Ensures CloudTrail is enabled in all regions',
        severity: 'high',
        category: 'CloudTrail',
      },
      {
        id: 'cloudtrail-encryption',
        name: 'CloudTrail Encryption',
        description: 'Ensures CloudTrail logs are encrypted',
        severity: 'medium',
        category: 'CloudTrail',
      },
      {
        id: 'cloudtrail-file-validation',
        name: 'CloudTrail Log File Validation',
        description: 'Ensures CloudTrail log file validation is enabled',
        severity: 'medium',
        category: 'CloudTrail',
      },
      {
        id: 'cloudtrail-bucket-delete',
        name: 'CloudTrail Bucket Delete Protection',
        description: 'Ensures CloudTrail S3 bucket has MFA delete enabled',
        severity: 'medium',
        category: 'CloudTrail',
      },
      // KMS Security
      {
        id: 'kms-key-rotation',
        name: 'KMS Key Rotation',
        description: 'Ensures KMS keys have automatic rotation enabled',
        severity: 'medium',
        category: 'KMS',
      },
      {
        id: 'kms-key-policy',
        name: 'KMS Key Policy',
        description: 'Ensures KMS keys have appropriate key policies',
        severity: 'high',
        category: 'KMS',
      },
      // Lambda Security
      {
        id: 'lambda-public-access',
        name: 'Lambda Public Access',
        description: 'Detects Lambda functions with public access',
        severity: 'high',
        category: 'Lambda',
      },
      {
        id: 'lambda-vpc-config',
        name: 'Lambda VPC Configuration',
        description: 'Ensures Lambda functions have VPC configuration',
        severity: 'low',
        category: 'Lambda',
      },
      // VPC/Network Security
      {
        id: 'vpc-flow-logs-enabled',
        name: 'VPC Flow Logs Enabled',
        description: 'Ensures VPC flow logs are enabled',
        severity: 'medium',
        category: 'EC2',
      },
      {
        id: 'subnet-ip-availability',
        name: 'Subnet IP Availability',
        description: 'Ensures subnets have sufficient IP addresses',
        severity: 'low',
        category: 'EC2',
      },
      // GuardDuty
      {
        id: 'guardduty-enabled',
        name: 'GuardDuty Enabled',
        description: 'Ensures GuardDuty is enabled',
        severity: 'high',
        category: 'GuardDuty',
      },
      // EKS Security
      {
        id: 'eks-encryption-enabled',
        name: 'EKS Secrets Encryption',
        description: 'Ensures EKS clusters have secrets encryption enabled',
        severity: 'high',
        category: 'EKS',
      },
      {
        id: 'eks-logging-enabled',
        name: 'EKS Logging Enabled',
        description: 'Ensures EKS clusters have logging enabled',
        severity: 'medium',
        category: 'EKS',
      },
      // Secrets Manager
      {
        id: 'secretsmanager-rotation-enabled',
        name: 'Secrets Manager Rotation',
        description: 'Ensures Secrets Manager has rotation enabled',
        severity: 'medium',
        category: 'SecretsManager',
      },
      {
        id: 'secretsmanager-secret-periodic-rotation',
        name: 'Secrets Manager Periodic Rotation',
        description: 'Ensures secrets are rotated periodically',
        severity: 'medium',
        category: 'SecretsManager',
      },
      // CloudWatch
      {
        id: 'cloudwatchlogs-audit-policy',
        name: 'CloudWatch Logs Audit Policy',
        description: 'Ensures CloudWatch Logs have audit policies',
        severity: 'low',
        category: 'CloudWatchLogs',
      },
      // ELB Security
      {
        id: 'elbv2-https-only',
        name: 'ELBv2 HTTPS Only',
        description: 'Ensures ELBv2 load balancers use HTTPS only',
        severity: 'high',
        category: 'ELBv2',
      },
      {
        id: 'elbv2-insecure-ciphers',
        name: 'ELBv2 Insecure Ciphers',
        description: 'Detects ELBv2 listeners using insecure ciphers',
        severity: 'high',
        category: 'ELBv2',
      },
      // DynamoDB
      {
        id: 'dynamodb-encryption',
        name: 'DynamoDB Encryption',
        description: 'Ensures DynamoDB tables have encryption enabled',
        severity: 'medium',
        category: 'DynamoDB',
      },
      {
        id: 'dynamodb-backup-enabled',
        name: 'DynamoDB Backup Enabled',
        description: 'Ensures DynamoDB tables have point-in-time recovery enabled',
        severity: 'medium',
        category: 'DynamoDB',
      },
      // SNS Security
      {
        id: 'sns-topic-policies',
        name: 'SNS Topic Policies',
        description: 'Ensures SNS topics have appropriate policies',
        severity: 'medium',
        category: 'SNS',
      },
      // SQS Security
      {
        id: 'sqs-queue-policies',
        name: 'SQS Queue Policies',
        description: 'Ensures SQS queues have appropriate policies',
        severity: 'medium',
        category: 'SQS',
      },
      // ECR Security
      {
        id: 'ecr-repository-policy',
        name: 'ECR Repository Policy',
        description: 'Ensures ECR repositories have appropriate policies',
        severity: 'medium',
        category: 'ECR',
      },
      {
        id: 'ecr-repository-tag-immutability',
        name: 'ECR Tag Immutability',
        description: 'Ensures ECR repositories have tag immutability enabled',
        severity: 'medium',
        category: 'ECR',
      },
    ];

    return checks;
  }

  /**
   * Validate AWS target credentials
   */
  async validateTarget(target: AWSTarget): Promise<boolean> {
    try {
      // Check AWS credentials work
      await exec(`aws sts get-caller-identity --output json`);
      return true;
    } catch (error) {
      serviceLogger.error('Failed to validate AWS target', {
        target: target.id,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Execute CloudSploit scan
   */
  async scan(
    target: AWSTarget,
    config: Partial<InfrastructureScanConfig> = {}
  ): Promise<InfrastructureFinding[]> {
    const startTime = Date.now();
    serviceLogger.info('Starting CloudSploit scan', {
      target: target.id,
      account: target.metadata.accountId,
      regions: target.metadata.regions,
    });

    const findings: InfrastructureFinding[] = [];

    try {
      // Run CloudSploit for each region
      for (const region of target.metadata.regions) {
        const regionFindings = await this.scanRegion(target, region, config);
        findings.push(...regionFindings);
      }

      serviceLogger.info('CloudSploit scan complete', {
        target: target.id,
        findings: findings.length,
        regionsScanned: target.metadata.regions.length,
        durationMs: Date.now() - startTime,
      });

      return findings;
    } catch (error) {
      serviceLogger.error('CloudSploit scan failed', {
        target: target.id,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Scan a specific AWS region
   */
  private async scanRegion(
    target: AWSTarget,
    region: string,
    config: Partial<InfrastructureScanConfig>
  ): Promise<InfrastructureFinding[]> {
    return new Promise((resolve, reject) => {
      // Check if CloudSploit is available
      try {
        const { execSync } = require('child_process');
        execSync(`which ${this.binaryPath}`, { stdio: 'ignore' });
      } catch {
        serviceLogger.warn('cloudsploitscan not available, returning empty results');
        resolve([]);
        return;
      }
      
      const args = [
        '--config', '/tmp/cloudsploit-config.json',
        '--console', 'none',
        '--region', region,
      ];

      // Create temporary config file
      const fs = require('fs');
      const cloudsploitConfig = {
        credentials: {
          aws: {
            // Use default credential chain
          },
        },
      };
      fs.writeFileSync('/tmp/cloudsploit-config.json', JSON.stringify(cloudsploitConfig));

      const proc = spawn(this.binaryPath, args, {
        env: {
          ...process.env,
          AWS_REGION: region,
        },
      });
      
      // Handle spawn errors
      proc.on('error', (err) => {
        serviceLogger.warn(`CloudSploit spawn error: ${err.message}`);
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

      proc.on('close', async (code) => {
        // Cleanup
        try {
          fs.unlinkSync('/tmp/cloudsploit-config.json');
        } catch {}

        try {
          const results: CloudSploitResult[] = JSON.parse(stdout);
          const findings = await Promise.all(
            results
              .filter(r => r.Status === 2) // Only failed checks
              .map(r => this.parseResultToFinding(r, target, region))
          );
          
          resolve(findings);
        } catch (parseError) {
          reject(new Error(`Failed to parse CloudSploit output: ${parseError}`));
        }
      });

      // Timeout
      setTimeout(() => {
        proc.kill();
        reject(new Error('CloudSploit scan timeout'));
      }, config.timeoutMs || 300000);
    });
  }

  /**
   * Convert CloudSploit result to White Rabbit finding
   */
  private async parseResultToFinding(
    result: CloudSploitResult,
    target: AWSTarget,
    region: string
  ): Promise<InfrastructureFinding> {
    const checkInfo = await this.getCheckInfo(result.Title);

    return {
      detectorName: `cloudsploit-${result.Title.toLowerCase().replace(/\s+/g, '-')}`,
      tool: 'cloudsploit',
      severity: this.mapSeverity(checkInfo?.severity || 'medium'),
      description: result.Description,
      infrastructureType: 'aws',
      targetId: target.id,
      framework: {
        name: 'cloudsploit',
        version: this.version,
        checkId: result.Title,
        checkName: result.Title,
      },
      resource: {
        type: result.Category,
        name: result.Resource || 'unknown',
        region: region,
      },
      remediation: {
        description: result.Message || 'Review and fix the configuration',
        references: [
          `https://github.com/aquasecurity/cloudsploit/tree/master/plugins/${result.Category.toLowerCase()}`,
        ],
      },
    };
  }

  /**
   * Get check metadata
   */
  private async getCheckInfo(checkTitle: string): Promise<ScannerCheck | undefined> {
    const checks = await this.getAvailableChecks();
    return checks.find((c: ScannerCheck) => 
      c.name.toLowerCase() === checkTitle.toLowerCase() ||
      checkTitle.toLowerCase().includes(c.name.toLowerCase())
    );
  }

  /**
   * Map CloudSploit severity to White Rabbit severity
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

export default CloudSploitScanner;
