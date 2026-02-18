# White Rabbit - Infrastructure Security Scanning

This document describes the infrastructure, network, and cloud security scanning capabilities added to White Rabbit.

## Overview

White Rabbit now extends beyond smart contract analysis to provide comprehensive infrastructure security coverage:

- **Kubernetes Security** (Kubescape) - NSA/CISA hardening guidelines
- **AWS Cloud Security** (CloudSploit) - Configuration auditing
- **Network Security** (Nili) - Port scanning, SSL/TLS assessment

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              Infrastructure Analysis Pipeline                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Kubescape   │  │  CloudSploit │  │    Nili      │         │
│  │   Scanner    │  │   Scanner    │  │   Scanner    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            ▼                                    │
│              ┌─────────────────────────┐                       │
│              │  Result Aggregation     │                       │
│              │  - Deduplication        │                       │
│              │  - Compliance Mapping   │                       │
│              │  - Severity Filtering   │                       │
│              └─────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## Scanners

### Kubescape (Kubernetes)

**Purpose**: Scan Kubernetes clusters for security misconfigurations based on NSA/CISA hardening guidelines.

**Coverage**:
- Privileged containers (C-0001)
- RBAC configuration (C-0007)
- Network policies (C-0014)
- Secrets management (C-0015)
- Anonymous access (C-0063)
- etcd encryption (C-0066)
- Pod security standards (C-0068, C-0070)
- Audit logging (C-0067)
- And 20+ more controls

**Usage**:
```typescript
import { KubescapeScanner } from './src/infrastructure/index.js';

const scanner = new KubescapeScanner();
const findings = await scanner.scan({
  id: 'prod-cluster',
  type: 'kubernetes',
  name: 'Production K8s',
  metadata: { clusterName: 'prod-eks' },
});
```

### CloudSploit (AWS)

**Purpose**: Audit AWS infrastructure for security misconfigurations and compliance violations.

**Coverage**:
- **IAM**: Root account MFA, password policies, access keys
- **S3**: Public buckets, encryption, versioning
- **EC2**: Security groups, open ports, default groups
- **RDS**: Encryption, public accessibility, backups
- **CloudTrail**: Logging, encryption, validation
- **KMS**: Key rotation, policies
- **Lambda**: Public access, VPC config
- **EKS**: Encryption, logging
- **GuardDuty**: Enabled status
- And 40+ more checks

**Usage**:
```typescript
import { CloudSploitScanner } from './src/infrastructure/index.js';

const scanner = new CloudSploitScanner();
const findings = await scanner.scan({
  id: 'prod-aws',
  type: 'aws',
  name: 'Production AWS',
  metadata: {
    accountId: '123456789012',
    regions: ['us-east-1', 'eu-west-1'],
  },
});
```

### Nili (Network)

**Purpose**: Active network security assessment including port scanning and SSL/TLS analysis.

**Coverage**:
- Port scanning (1-65535)
- Service version detection
- SSL/TLS assessment:
  - Certificate validity/expiration
  - Weak cipher suites
  - Deprecated protocols (SSLv2/3, TLS 1.0/1.1)
  - Vulnerabilities (Heartbleed, POODLE, etc.)
- Sensitive port detection
- Cleartext protocol detection

**Usage**:
```typescript
import { NiliScanner } from './src/infrastructure/index.js';

const scanner = new NiliScanner();
const findings = await scanner.scan({
  id: 'web-server',
  type: 'network',
  name: 'Web Server',
  metadata: {
    host: 'example.com',
    ports: [80, 443, 8080],
  },
});
```

## Pipeline Usage

### Single Target Analysis

```typescript
import { InfrastructureAnalysisPipeline } from './src/infrastructure/index.js';

const pipeline = new InfrastructureAnalysisPipeline({
  enabledScanners: ['kubescape', 'cloudsploit', 'nili'],
  alerting: {
    minSeverity: 'high',
    channels: ['slack', 'email'],
  },
});

const result = await pipeline.analyze({
  id: 'prod-cluster',
  type: 'kubernetes',
  name: 'Production Cluster',
  metadata: { clusterName: 'prod-eks' },
});

console.log(`Found ${result.findings.length} issues`);
console.log(`Critical: ${result.summary.critical}`);
console.log(`High: ${result.summary.high}`);
```

### Batch Analysis

```typescript
const targets = [
  { id: 'k8s-1', type: 'kubernetes', ... },
  { id: 'aws-1', type: 'aws', ... },
  { id: 'net-1', type: 'network', ... },
];

const results = await pipeline.analyzeBatch(targets);
```

### Filtering and Grouping

```typescript
// Filter by severity
const criticalFindings = pipeline.filterFindings(findings, 'critical');

// Group by resource type
const byResource = pipeline.groupByResource(findings);
// { pod: [...], service: [...], deployment: [...] }

// Group by compliance framework
const byCompliance = pipeline.groupByCompliance(findings);
// { 'nsa-cisa': [...], 'cis': [...], 'pci-dss': [...], 'soc2': [...] }
```

## Compliance Frameworks

The infrastructure scanners map findings to major compliance frameworks:

| Framework | Coverage |
|-----------|----------|
| **NSA/CISA** | Kubernetes hardening guidelines |
| **CIS** | Benchmarks for K8s, AWS |
| **PCI-DSS** | Payment card data security |
| **SOC2** | Security controls |
| **GDPR** | Data protection (via encryption checks) |
| **HIPAA** | Healthcare data security |

## Integration with White Rabbit

The infrastructure scanning integrates with White Rabbit's existing systems:

1. **Unified Findings**: Infrastructure findings use the same `Finding` interface as contract findings
2. **Deduplication**: Shared `FindingDeduplicator` prevents duplicate alerts
3. **Logging**: Uses `serviceLogger` for structured logging
4. **Alerting**: Can route findings to the same notification channels

## Configuration

### Environment Variables

```bash
# Kubernetes
export KUBECONFIG=/path/to/kubeconfig

# AWS
export AWS_PROFILE=production
export AWS_REGION=us-east-1

# Scanning timeouts
export INFRA_SCAN_TIMEOUT=300000  # 5 minutes
export INFRA_PARALLEL_SCANS=3
```

### Scanner Configuration

```typescript
const config = {
  enabledScanners: ['kubescape', 'cloudsploit', 'nili'],
  globalConfig: {
    severityThreshold: 'medium',
    timeoutMs: 300000,
    parallelScans: 3,
  },
  targets: [...],
  schedule: {
    enabled: true,
    cron: '0 */6 * * *',  // Every 6 hours
  },
};
```

## Security Considerations

1. **Credentials**: Store cloud credentials securely (AWS IAM roles, K8s service accounts)
2. **Read-Only Access**: Scanners only require read-only permissions
3. **Network Access**: Ensure scanner can reach target infrastructure
4. **Rate Limiting**: Be mindful of API rate limits (especially AWS)

## Troubleshooting

### Kubescape
- Ensure `kubectl` is configured and can access the cluster
- Check cluster RBAC allows scanning operations

### CloudSploit
- Verify AWS credentials are configured (`aws configure`)
- Ensure IAM user/role has read-only access to services

### Nili
- May require root/sudo for certain scans
- Check firewall rules allow outbound connections

## Future Enhancements

- [ ] Azure Security Center integration
- [ ] GCP Security Command Center integration
- [ ] Container image scanning (Trivy, Clair)
- [ ] Infrastructure-as-Code scanning (Terraform, CloudFormation)
- [ ] Continuous monitoring with scheduled scans
- [ ] Remediation automation for common issues
