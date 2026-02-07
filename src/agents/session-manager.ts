/**
 * Session Manager — the orchestration brain.
 *
 * Takes a scan input and config, resolves which agents to run, builds an
 * execution plan with phase ordering and parallel grouping, and provides
 * runtime helpers for determining next agents and skip conditions.
 */

import type { AgentDefinition, AgentResult } from './agent-types.js';
import type { ScanWorkflowInput } from '../temporal/shared.js';
import type { ScanConfig } from '../config-parser.js';
import type { PhaseName } from '../queue-validation.js';
import { PHASES } from '../queue-validation.js';
import { getEnabledAgents } from './agent-registry.js';

// ── Execution Plan Types ──

export interface ExecutionPlan {
  sessionId: string;
  phases: ExecutionPhase[];
  totalAgents: number;
  estimatedDuration: number;  // minutes
}

export interface ExecutionPhase {
  phase: PhaseName;
  parallelGroups: ParallelGroup[];
}

export interface ParallelGroup {
  groupId: string;
  agents: AgentDefinition[];
  maxConcurrency: number;
}

// ── Plan Creation ──

/**
 * Create an execution plan for a scan session.
 *
 * Resolves which agents to run based on config, groups them into
 * phases and parallel groups, and estimates total duration.
 */
export function createExecutionPlan(
  input: ScanWorkflowInput,
  config: ScanConfig,
): ExecutionPlan {
  const enabledAgents = getEnabledAgents(config);
  const maxConcurrency = config.scanner.max_concurrent_scans ?? 6;

  // Group agents by phase, then by parallel group within each phase
  const phases: ExecutionPhase[] = [];

  for (const phaseName of PHASES) {
    const phaseAgents = enabledAgents.filter(a => a.phase === phaseName);
    if (phaseAgents.length === 0) continue;

    // Group by parallelGroup
    const groupMap = new Map<string, AgentDefinition[]>();
    for (const agent of phaseAgents) {
      const group = groupMap.get(agent.parallelGroup) ?? [];
      group.push(agent);
      groupMap.set(agent.parallelGroup, group);
    }

    // Sort agents within each group by priority
    const parallelGroups: ParallelGroup[] = [];
    for (const [groupId, agents] of groupMap) {
      agents.sort((a, b) => a.priority - b.priority);
      parallelGroups.push({
        groupId,
        agents,
        maxConcurrency: Math.min(maxConcurrency, agents.length),
      });
    }

    phases.push({ phase: phaseName, parallelGroups });
  }

  // Estimate duration: sum of longest agent per group, sequential across phases
  let estimatedDuration = 0;
  for (const phase of phases) {
    for (const group of phase.parallelGroups) {
      const maxGroupDuration = Math.max(...group.agents.map(a => a.timeoutMinutes));
      estimatedDuration += maxGroupDuration;
    }
  }

  return {
    sessionId: input.sessionId,
    phases,
    totalAgents: enabledAgents.length,
    estimatedDuration,
  };
}

// ── Runtime Helpers ──

/**
 * Given the current set of completed agent IDs, return agents that are
 * ready to run (all required deliverables produced by completed agents).
 */
export function getNextAgents(
  plan: ExecutionPlan,
  completedAgentIds: Set<string>,
  completedResults: AgentResult[],
): AgentDefinition[] {
  // Build a set of all deliverables that have been produced
  const producedDeliverables = new Set<string>();
  for (const result of completedResults) {
    if (result.status === 'success' || result.status === 'skipped') {
      const agentDef = findAgentInPlan(plan, result.agentId);
      if (agentDef) {
        for (const d of agentDef.outputDeliverables) {
          producedDeliverables.add(d);
        }
      }
    }
  }

  const ready: AgentDefinition[] = [];

  for (const phase of plan.phases) {
    for (const group of phase.parallelGroups) {
      for (const agent of group.agents) {
        // Skip already completed agents
        if (completedAgentIds.has(agent.id)) continue;

        // Check if all required deliverables are available
        const allDepsReady = agent.requiredDeliverables.every(d =>
          producedDeliverables.has(d)
        );

        // Discovery agents (no required deliverables) are always ready
        if (allDepsReady) {
          ready.push(agent);
        }
      }
    }
  }

  return ready;
}

/**
 * Determine if an agent should be skipped based on completed results.
 *
 * Verification agents are skipped when their corresponding hypothesis
 * agent found zero findings. Report agent never skips.
 */
export function shouldSkipAgent(
  agent: AgentDefinition,
  completedResults: AgentResult[],
): boolean {
  // Report agent never skips
  if (agent.phase === 'report') return false;

  // Verification agents skip when the hypothesis report has no findings
  if (agent.phase === 'verification') {
    for (const reqDeliverable of agent.requiredDeliverables) {
      // Map verification deliverable back to the hypothesis agent that produced it
      // e.g. 'vuln-arithmetic-report.json' -> look for agent 'vuln-arithmetic'
      const hypothesisAgentId = reqDeliverable
        .replace('-report.json', '')
        .replace('.json', '');

      const hypothesisResult = completedResults.find(r => r.agentId === hypothesisAgentId);
      if (!hypothesisResult) return true; // dependency never ran
      if (hypothesisResult.status === 'failed') return true;
      if (hypothesisResult.findings.length === 0) return true;
    }
  }

  return false;
}

/**
 * Find an agent definition within an execution plan.
 */
function findAgentInPlan(plan: ExecutionPlan, agentId: string): AgentDefinition | undefined {
  for (const phase of plan.phases) {
    for (const group of phase.parallelGroups) {
      const agent = group.agents.find(a => a.id === agentId);
      if (agent) return agent;
    }
  }
  return undefined;
}

// ── Display ──

/**
 * Print a human-readable execution plan summary.
 */
export function printExecutionPlan(plan: ExecutionPlan): void {
  console.log('');
  console.log('=== Execution Plan ===');
  console.log(`Session:  ${plan.sessionId}`);
  console.log(`Agents:   ${plan.totalAgents}`);
  console.log(`Est. Duration: ~${plan.estimatedDuration} minutes`);
  console.log('');

  for (const phase of plan.phases) {
    console.log(`  Phase: ${phase.phase}`);
    for (const group of phase.parallelGroups) {
      const agentNames = group.agents.map(a => a.id).join(', ');
      console.log(`    [${group.groupId}] (max ${group.maxConcurrency} concurrent): ${agentNames}`);
    }
    console.log('');
  }

  console.log('======================');
  console.log('');
}

/**
 * Get a flat list of all agent IDs from an execution plan.
 */
export function getAllAgentIds(plan: ExecutionPlan): string[] {
  const ids: string[] = [];
  for (const phase of plan.phases) {
    for (const group of phase.parallelGroups) {
      for (const agent of group.agents) {
        ids.push(agent.id);
      }
    }
  }
  return ids;
}

/**
 * Get the agents for a specific phase in the plan.
 */
export function getPhaseAgents(plan: ExecutionPlan, phase: PhaseName): AgentDefinition[] {
  const phaseEntry = plan.phases.find(p => p.phase === phase);
  if (!phaseEntry) return [];
  return phaseEntry.parallelGroups.flatMap(g => g.agents);
}
