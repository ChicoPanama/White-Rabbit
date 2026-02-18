import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Deliverables-based phase validation.
 *
 * Each pipeline phase has prerequisite deliverables that must exist before it can run.
 * This module validates those prerequisites and provides access to phase deliverable paths.
 */

/** Vulnerability types that produce per-type deliverables */
export const VULN_TYPES = [
  'arithmetic',
  'reentrancy',
  'access-control',
  'oracle',
  'flash-loan',
  'logic',
] as const;
export type VulnType = typeof VULN_TYPES[number];

/** Pipeline phases in execution order */
export const PHASES = [
  'discovery',
  'static-analysis',
  'vulnerability-hypothesis',
  'verification',
  'report',
] as const;
export type PhaseName = typeof PHASES[number];

/** Deliverables base directory (set per session) */
let deliverableBaseDir = '';

export function setDeliverableBaseDir(dir: string): void {
  deliverableBaseDir = dir;
}

export function getDeliverableBaseDir(): string {
  return deliverableBaseDir;
}

/** Deliverable definitions per phase */
interface PhaseDeliverables {
  /** Files this phase requires to exist before it can start */
  prerequisites: string[];
  /** Files this phase produces */
  outputs: string[];
}

function getPhaseDefinition(phase: PhaseName): PhaseDeliverables {
  switch (phase) {
    case 'discovery':
      return {
        prerequisites: [], // First phase has no prerequisites
        outputs: [
          'discovery/contract-source.json',
          'discovery/protocol-metadata.json',
        ],
      };

    case 'static-analysis':
      return {
        prerequisites: [
          'discovery/contract-source.json',
          'discovery/protocol-metadata.json',
        ],
        outputs: [
          'static-analysis/slither-report.json',
          'static-analysis/pattern-matches.json',
        ],
      };

    case 'vulnerability-hypothesis':
      return {
        prerequisites: [
          'static-analysis/slither-report.json',
        ],
        outputs: VULN_TYPES.map(t => `vulnerability-hypothesis/vuln-${t}-report.json`),
      };

    case 'verification':
      return {
        prerequisites: VULN_TYPES.map(t => `vulnerability-hypothesis/vuln-${t}-report.json`),
        outputs: VULN_TYPES.map(t => `verification/verification-${t}-result.json`),
      };

    case 'report':
      return {
        prerequisites: VULN_TYPES.map(t => `verification/verification-${t}-result.json`),
        outputs: [
          'report/final-report.md',
        ],
      };
  }
}

/**
 * Resolve a deliverable filename to its full path within the session directory.
 */
function resolveDeliverablePath(filename: string): string {
  if (!deliverableBaseDir) {
    throw new Error('Deliverable base directory not set. Call setDeliverableBaseDir() first.');
  }
  return path.join(deliverableBaseDir, filename);
}

/**
 * Check if a deliverable file exists.
 */
function deliverableExists(filename: string): boolean {
  return fs.existsSync(resolveDeliverablePath(filename));
}

export interface ValidationResult {
  valid: boolean;
  phase: PhaseName;
  missingDeliverables: string[];
  presentDeliverables: string[];
}

/**
 * Validate that all prerequisites for a phase are present.
 *
 * @param phaseName - The phase to validate prerequisites for
 * @returns Validation result with missing/present deliverables
 *
 * @example
 * ```ts
 * const result = validatePhasePrerequisites('static-analysis');
 * if (!result.valid) {
 *   console.error('Missing:', result.missingDeliverables);
 * }
 * ```
 */
export function validatePhasePrerequisites(phaseName: PhaseName): ValidationResult {
  const definition = getPhaseDefinition(phaseName);
  const missing: string[] = [];
  const present: string[] = [];

  for (const prereq of definition.prerequisites) {
    if (deliverableExists(prereq)) {
      present.push(prereq);
    } else {
      missing.push(prereq);
    }
  }

  return {
    valid: missing.length === 0,
    phase: phaseName,
    missingDeliverables: missing,
    presentDeliverables: present,
  };
}

/**
 * Get the expected output deliverable paths for a phase.
 *
 * @param phaseName - The phase to get deliverable paths for
 * @returns Array of relative deliverable file paths this phase should produce
 */
export function getPhaseDeliverables(phaseName: PhaseName): string[] {
  return getPhaseDefinition(phaseName).outputs;
}

/**
 * Get the prerequisite deliverable paths for a phase.
 *
 * @param phaseName - The phase to get prerequisites for
 * @returns Array of relative deliverable file paths required before this phase
 */
export function getPhasePrerequisites(phaseName: PhaseName): string[] {
  return getPhaseDefinition(phaseName).prerequisites;
}

/**
 * Assert that all prerequisites for a phase are present.
 * Throws an error with a clear message listing missing deliverables.
 *
 * @param phaseName - The phase to validate
 * @throws Error if prerequisites are missing
 */
export function assertPhaseReady(phaseName: PhaseName): void {
  const result = validatePhasePrerequisites(phaseName);
  if (!result.valid) {
    const missingList = result.missingDeliverables.map(d => `  - ${d}`).join('\n');
    throw new Error(
      `Phase "${phaseName}" cannot start: missing ${result.missingDeliverables.length} prerequisite deliverable(s):\n${missingList}\n\nEnsure the previous phase completed successfully.`
    );
  }
}

/**
 * Get a summary of all phases and their readiness status.
 */
export function getPipelineStatus(): Array<{ phase: PhaseName; ready: boolean; missing: number; total: number }> {
  return PHASES.map(phase => {
    const result = validatePhasePrerequisites(phase);
    const definition = getPhaseDefinition(phase);
    return {
      phase,
      ready: result.valid,
      missing: result.missingDeliverables.length,
      total: definition.prerequisites.length,
    };
  });
}
