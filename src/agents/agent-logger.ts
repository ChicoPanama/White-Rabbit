/**
 * Agent execution logging and session metrics.
 *
 * Writes structured logs and metrics to the session deliverables directory:
 *   _session-metrics.json   — overall session performance
 *   _execution-plan.json    — the plan that was created
 *   _agent-{id}.log         — per-agent execution log
 *   _findings-summary.json  — consolidated findings summary
 */

import type { AgentResult, Finding } from './agent-types.js';
import type { ExecutionPlan } from './session-manager.js';
import type { PhaseName } from '../queue-validation.js';
import { writeDeliverable, getSessionDir } from '../deliverables-manager.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Session Metrics ──

export interface SessionMetrics {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  agentsRun: number;
  agentsSucceeded: number;
  agentsFailed: number;
  agentsSkipped: number;
  agentsTimedOut: number;
  totalFindings: number;
  verifiedFindings: number;
  totalTokensUsed: number;
  phases: Record<string, PhaseMetrics>;
}

export interface PhaseMetrics {
  duration: number;
  agents: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

/**
 * Build session metrics from agent results.
 */
export function buildSessionMetrics(
  sessionId: string,
  startedAt: Date,
  completedAt: Date,
  results: AgentResult[],
): SessionMetrics {
  const phaseMap = new Map<string, AgentResult[]>();

  for (const result of results) {
    // Extract phase from agentId (e.g. 'vuln-arithmetic' -> 'vulnerability-hypothesis')
    const phase = getPhaseFromAgentId(result.agentId);
    const group = phaseMap.get(phase) ?? [];
    group.push(result);
    phaseMap.set(phase, group);
  }

  const phases: Record<string, PhaseMetrics> = {};
  for (const [phase, phaseResults] of phaseMap) {
    const totalDuration = phaseResults.reduce((sum, r) => sum + r.duration, 0);
    phases[phase] = {
      duration: totalDuration,
      agents: phaseResults.length,
      succeeded: phaseResults.filter(r => r.status === 'success').length,
      failed: phaseResults.filter(r => r.status === 'failed').length,
      skipped: phaseResults.filter(r => r.status === 'skipped').length,
    };
  }

  return {
    sessionId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    duration: completedAt.getTime() - startedAt.getTime(),
    agentsRun: results.length,
    agentsSucceeded: results.filter(r => r.status === 'success').length,
    agentsFailed: results.filter(r => r.status === 'failed').length,
    agentsSkipped: results.filter(r => r.status === 'skipped').length,
    agentsTimedOut: results.filter(r => r.status === 'timeout').length,
    totalFindings: results.reduce((sum, r) => sum + r.findings.length, 0),
    verifiedFindings: results.reduce(
      (sum, r) => sum + r.findings.filter(f => f.verified).length, 0
    ),
    totalTokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
    phases,
  };
}

/**
 * Map agent ID to pipeline phase name.
 */
function getPhaseFromAgentId(agentId: string): string {
  if (agentId.startsWith('discovery-')) return 'discovery';
  if (agentId.startsWith('static-')) return 'static-analysis';
  if (agentId.startsWith('vuln-')) return 'vulnerability-hypothesis';
  if (agentId.startsWith('verify-')) return 'verification';
  if (agentId.startsWith('report-')) return 'report';
  return 'unknown';
}

// ── Logging Functions ──

/**
 * Write the execution plan to the session directory.
 */
export function logExecutionPlan(sessionId: string, plan: ExecutionPlan): void {
  const planData = {
    sessionId: plan.sessionId,
    totalAgents: plan.totalAgents,
    estimatedDuration: plan.estimatedDuration,
    phases: plan.phases.map(p => ({
      phase: p.phase,
      groups: p.parallelGroups.map(g => ({
        groupId: g.groupId,
        maxConcurrency: g.maxConcurrency,
        agents: g.agents.map(a => ({
          id: a.id,
          name: a.name,
          priority: a.priority,
          tools: a.tools,
          timeoutMinutes: a.timeoutMinutes,
        })),
      })),
    })),
  };

  writeSessionFile(sessionId, '_execution-plan.json', planData);
}

/**
 * Write a per-agent execution log.
 */
export function logAgentExecution(sessionId: string, result: AgentResult): void {
  const logData = {
    agentId: result.agentId,
    status: result.status,
    duration: result.duration,
    tokensUsed: result.tokensUsed,
    findingCount: result.findings.length,
    deliverables: result.deliverables,
    errors: result.errors,
    metadata: result.metadata,
    timestamp: new Date().toISOString(),
  };

  writeSessionFile(sessionId, `_agent-${result.agentId}.log`, logData);
}

/**
 * Write session metrics to the session directory.
 */
export function logSessionMetrics(sessionId: string, metrics: SessionMetrics): void {
  writeSessionFile(sessionId, '_session-metrics.json', metrics);
}

/**
 * Write a findings summary to the session directory.
 */
export function logFindingsSummary(
  sessionId: string,
  findings: Finding[],
  summary: string,
): void {
  const summaryData = {
    totalFindings: findings.length,
    verified: findings.filter(f => f.verified).length,
    bySeverity: countBy(findings, f => f.severity),
    byVulnType: countBy(findings, f => f.vulnType),
    byAgent: countBy(findings, f => f.agentId),
    summary,
    findings: findings.map(f => ({
      id: f.id,
      severity: f.severity,
      vulnType: f.vulnType,
      title: f.title,
      location: f.location,
      verified: f.verified,
      agentId: f.agentId,
      exploitableValue: f.exploitableValue,
    })),
  };

  writeSessionFile(sessionId, '_findings-summary.json', summaryData);
}

/**
 * Write all session logs at once (convenience function).
 */
export function writeSessionLogs(
  sessionId: string,
  plan: ExecutionPlan,
  results: AgentResult[],
  findings: Finding[],
  summary: string,
  startedAt: Date,
): void {
  const completedAt = new Date();
  const metrics = buildSessionMetrics(sessionId, startedAt, completedAt, results);

  logExecutionPlan(sessionId, plan);
  logSessionMetrics(sessionId, metrics);
  logFindingsSummary(sessionId, findings, summary);

  for (const result of results) {
    logAgentExecution(sessionId, result);
  }
}

// ── Helpers ──

function writeSessionFile(sessionId: string, filename: string, data: unknown): void {
  const sessionDir = getSessionDir(sessionId);
  const filePath = path.join(sessionDir, filename);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
