/**
 * Central agent registry — defines all scanner agents, their phases,
 * parallel grouping, tools, and deliverable I/O.
 *
 * This is the single source of truth for which agents exist and how they
 * relate to each other. The session manager reads this to build execution plans.
 */

import type { AgentDefinition } from './agent-types.js';
import type { PhaseName } from '../queue-validation.js';
import type { ScanConfig } from '../config-parser.js';

// ── Registry ──

const AGENT_REGISTRY: AgentDefinition[] = [

  // ── Phase 1: Discovery ──

  {
    id: 'discovery-source',
    name: 'Contract Source Fetcher',
    phase: 'discovery',
    parallelGroup: 'discovery',
    promptTemplate: 'recon-contract',
    requiredDeliverables: [],
    outputDeliverables: ['contract-source.json'],
    maxTurns: 5,
    timeoutMinutes: 5,
    retryable: true,
    maxRetries: 3,
    tools: ['etherscan'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'discovery-metadata',
    name: 'Protocol Metadata Gatherer',
    phase: 'discovery',
    parallelGroup: 'discovery',
    promptTemplate: 'recon-contract',
    requiredDeliverables: [],
    outputDeliverables: ['protocol-metadata.json'],
    maxTurns: 5,
    timeoutMinutes: 5,
    retryable: true,
    maxRetries: 3,
    tools: ['defillama', 'etherscan'],
    enabled: true,
    priority: 2,
  },

  // ── Phase 2: Static Analysis ──

  {
    id: 'static-slither',
    name: 'Slither Analyzer',
    phase: 'static-analysis',
    parallelGroup: 'static',
    promptTemplate: 'recon-contract',
    requiredDeliverables: ['contract-source.json'],
    outputDeliverables: ['slither-report.json'],
    maxTurns: 3,
    timeoutMinutes: 10,
    retryable: true,
    maxRetries: 2,
    tools: ['slither'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'static-patterns',
    name: 'Pattern Matcher',
    phase: 'static-analysis',
    parallelGroup: 'static',
    promptTemplate: 'recon-contract',
    requiredDeliverables: ['contract-source.json'],
    outputDeliverables: ['pattern-matches.json'],
    maxTurns: 5,
    timeoutMinutes: 5,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 2,
  },
  {
    id: 'static-fork-detection',
    name: 'Fork Detector',
    phase: 'static-analysis',
    parallelGroup: 'static',
    promptTemplate: 'recon-contract',
    requiredDeliverables: ['contract-source.json'],
    outputDeliverables: ['fork-detection.json'],
    maxTurns: 5,
    timeoutMinutes: 5,
    retryable: true,
    maxRetries: 2,
    tools: ['etherscan'],
    enabled: true,
    priority: 3,
  },

  // ── Phase 3: Vulnerability Hypothesis (all parallel) ──

  {
    id: 'vuln-arithmetic',
    name: 'Arithmetic Overflow Scanner',
    phase: 'vulnerability-hypothesis',
    parallelGroup: 'vuln-scan',
    promptTemplate: 'vuln-arithmetic',
    requiredDeliverables: ['slither-report.json', 'contract-source.json'],
    outputDeliverables: ['vuln-arithmetic-report.json'],
    maxTurns: 15,
    timeoutMinutes: 10,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 1,
  },
  {
    id: 'vuln-reentrancy',
    name: 'Reentrancy Scanner',
    phase: 'vulnerability-hypothesis',
    parallelGroup: 'vuln-scan',
    promptTemplate: 'vuln-reentrancy',
    requiredDeliverables: ['slither-report.json', 'contract-source.json'],
    outputDeliverables: ['vuln-reentrancy-report.json'],
    maxTurns: 15,
    timeoutMinutes: 10,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 1,
  },
  {
    id: 'vuln-access-control',
    name: 'Access Control Scanner',
    phase: 'vulnerability-hypothesis',
    parallelGroup: 'vuln-scan',
    promptTemplate: 'vuln-access-control',
    requiredDeliverables: ['slither-report.json', 'contract-source.json'],
    outputDeliverables: ['vuln-access-control-report.json'],
    maxTurns: 15,
    timeoutMinutes: 10,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 1,
  },
  {
    id: 'vuln-oracle',
    name: 'Oracle Manipulation Scanner',
    phase: 'vulnerability-hypothesis',
    parallelGroup: 'vuln-scan',
    promptTemplate: 'vuln-oracle',
    requiredDeliverables: ['slither-report.json', 'contract-source.json', 'protocol-metadata.json'],
    outputDeliverables: ['vuln-oracle-report.json'],
    maxTurns: 15,
    timeoutMinutes: 10,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 2,
  },
  {
    id: 'vuln-flash-loan',
    name: 'Flash Loan Attack Scanner',
    phase: 'vulnerability-hypothesis',
    parallelGroup: 'vuln-scan',
    promptTemplate: 'vuln-flash-loan',
    requiredDeliverables: ['slither-report.json', 'contract-source.json', 'protocol-metadata.json'],
    outputDeliverables: ['vuln-flash-loan-report.json'],
    maxTurns: 15,
    timeoutMinutes: 10,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 2,
  },
  {
    id: 'vuln-logic',
    name: 'Business Logic Scanner',
    phase: 'vulnerability-hypothesis',
    parallelGroup: 'vuln-scan',
    promptTemplate: 'vuln-logic',
    requiredDeliverables: ['slither-report.json', 'contract-source.json', 'protocol-metadata.json'],
    outputDeliverables: ['vuln-logic-report.json'],
    maxTurns: 20,
    timeoutMinutes: 15,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 3,
  },

  // ── Phase 4: Verification (parallel, one per vuln type with findings) ──

  {
    id: 'verify-arithmetic',
    name: 'Arithmetic Verifier',
    phase: 'verification',
    parallelGroup: 'verify',
    promptTemplate: 'verify-foundry',
    requiredDeliverables: ['vuln-arithmetic-report.json'],
    outputDeliverables: ['verification-arithmetic-result.json'],
    maxTurns: 10,
    timeoutMinutes: 30,
    retryable: true,
    maxRetries: 2,
    tools: ['foundry'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'verify-reentrancy',
    name: 'Reentrancy Verifier',
    phase: 'verification',
    parallelGroup: 'verify',
    promptTemplate: 'verify-foundry',
    requiredDeliverables: ['vuln-reentrancy-report.json'],
    outputDeliverables: ['verification-reentrancy-result.json'],
    maxTurns: 10,
    timeoutMinutes: 30,
    retryable: true,
    maxRetries: 2,
    tools: ['foundry'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'verify-access-control',
    name: 'Access Control Verifier',
    phase: 'verification',
    parallelGroup: 'verify',
    promptTemplate: 'verify-foundry',
    requiredDeliverables: ['vuln-access-control-report.json'],
    outputDeliverables: ['verification-access-control-result.json'],
    maxTurns: 10,
    timeoutMinutes: 30,
    retryable: true,
    maxRetries: 2,
    tools: ['foundry'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'verify-oracle',
    name: 'Oracle Verifier',
    phase: 'verification',
    parallelGroup: 'verify',
    promptTemplate: 'verify-foundry',
    requiredDeliverables: ['vuln-oracle-report.json'],
    outputDeliverables: ['verification-oracle-result.json'],
    maxTurns: 10,
    timeoutMinutes: 30,
    retryable: true,
    maxRetries: 2,
    tools: ['foundry'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'verify-flash-loan',
    name: 'Flash Loan Verifier',
    phase: 'verification',
    parallelGroup: 'verify',
    promptTemplate: 'verify-foundry',
    requiredDeliverables: ['vuln-flash-loan-report.json'],
    outputDeliverables: ['verification-flash-loan-result.json'],
    maxTurns: 10,
    timeoutMinutes: 30,
    retryable: true,
    maxRetries: 2,
    tools: ['foundry'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'verify-logic',
    name: 'Logic Verifier',
    phase: 'verification',
    parallelGroup: 'verify',
    promptTemplate: 'verify-foundry',
    requiredDeliverables: ['vuln-logic-report.json'],
    outputDeliverables: ['verification-logic-result.json'],
    maxTurns: 10,
    timeoutMinutes: 30,
    retryable: true,
    maxRetries: 2,
    tools: ['foundry'],
    enabled: true,
    priority: 1,
  },

  // ── Phase 5: Report ──

  {
    id: 'report-immunefi',
    name: 'Immunefi Report Generator',
    phase: 'report',
    parallelGroup: 'report',
    promptTemplate: 'report-immunefi',
    requiredDeliverables: [],  // dynamically set based on verified findings
    outputDeliverables: ['final-report.md'],
    maxTurns: 10,
    timeoutMinutes: 10,
    retryable: true,
    maxRetries: 2,
    tools: [],
    enabled: true,
    priority: 1,
  },
];

// ── Lookup Functions ──

/**
 * Get a copy of the full agent registry.
 */
export function getAgentRegistry(): AgentDefinition[] {
  return AGENT_REGISTRY.map(a => ({ ...a }));
}

/**
 * Look up an agent by ID. Throws if not found.
 */
export function getAgentById(id: string): AgentDefinition {
  const agent = AGENT_REGISTRY.find(a => a.id === id);
  if (!agent) {
    throw new Error(`Agent not found: ${id}`);
  }
  return { ...agent };
}

/**
 * Get all agents belonging to a specific pipeline phase.
 */
export function getAgentsByPhase(phase: PhaseName): AgentDefinition[] {
  return AGENT_REGISTRY
    .filter(a => a.phase === phase)
    .map(a => ({ ...a }));
}

/**
 * Get all agents in a specific parallel group.
 */
export function getAgentsByParallelGroup(group: string): AgentDefinition[] {
  return AGENT_REGISTRY
    .filter(a => a.parallelGroup === group)
    .map(a => ({ ...a }));
}

/**
 * Get agents enabled for the current scan configuration.
 *
 * Filters by:
 * - Agent's `enabled` flag
 * - Config's `enabled_vuln_types` list (for vuln-* and verify-* agents)
 * - Non-vuln agents (discovery, static, report) are always included when enabled
 */
export function getEnabledAgents(config: ScanConfig): AgentDefinition[] {
  const enabledVulnTypes = new Set(config.scanner.enabled_vuln_types ?? []);

  return AGENT_REGISTRY.filter(agent => {
    if (!agent.enabled) return false;

    // Discovery, static-analysis, and report agents are always included
    if (agent.phase === 'discovery' || agent.phase === 'static-analysis' || agent.phase === 'report') {
      return true;
    }

    // vuln-* agents: check enabled_vuln_types
    if (agent.id.startsWith('vuln-')) {
      const vulnType = agent.id.replace('vuln-', '');
      return enabledVulnTypes.size === 0 || enabledVulnTypes.has(vulnType);
    }

    // verify-* agents: check enabled_vuln_types
    if (agent.id.startsWith('verify-')) {
      const vulnType = agent.id.replace('verify-', '');
      return enabledVulnTypes.size === 0 || enabledVulnTypes.has(vulnType);
    }

    return true;
  }).map(a => ({ ...a }));
}

/**
 * Get all unique parallel group names.
 */
export function getParallelGroups(): string[] {
  return [...new Set(AGENT_REGISTRY.map(a => a.parallelGroup))];
}

/**
 * Get total agent count.
 */
export function getAgentCount(): number {
  return AGENT_REGISTRY.length;
}
