import * as crypto from 'crypto';
import type { Finding, Severity, SEVERITY_ORDER } from '../types/index.js';
import { SEVERITY_ORDER as SevOrder } from '../types/index.js';

interface DeduplicatedGroup {
  groupId: string;
  findings: Finding[];
  mergedSeverity: Severity;
  mergedConfidence: string;
  representativeFinding: Finding;
}

/**
 * Deduplicates findings from multiple tools that refer to the same
 * underlying vulnerability. Groups by contract location and semantic
 * similarity of detector names and descriptions.
 */
export class FindingDeduplicator {
  /**
   * Group overlapping findings and return deduplicated list.
   * Each finding gets a `deduplicatedGroupId` assigned.
   */
  deduplicate(findings: Finding[]): Finding[] {
    if (findings.length === 0) return [];

    const groups = this.buildGroups(findings);
    const result: Finding[] = [];

    for (const group of groups) {
      // Pick the highest-severity finding as representative
      const sorted = group.findings.sort(
        (a, b) => SevOrder[b.severity] - SevOrder[a.severity]
      );
      const representative = sorted[0];
      representative.deduplicatedGroupId = group.groupId;

      // Mark non-representative findings with the same group ID
      for (const f of sorted.slice(1)) {
        f.deduplicatedGroupId = group.groupId;
      }

      // Only emit the representative finding for alerting
      result.push(representative);
    }

    return result;
  }

  private buildGroups(findings: Finding[]): DeduplicatedGroup[] {
    const groups: DeduplicatedGroup[] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < findings.length; i++) {
      if (assigned.has(i)) continue;

      const group: Finding[] = [findings[i]];
      assigned.add(i);

      for (let j = i + 1; j < findings.length; j++) {
        if (assigned.has(j)) continue;

        if (this.areSameVulnerability(findings[i], findings[j])) {
          group.push(findings[j]);
          assigned.add(j);
        }
      }

      const groupId = crypto.randomUUID();
      const mergedSeverity = this.highestSeverity(group);

      groups.push({
        groupId,
        findings: group,
        mergedSeverity,
        mergedConfidence: this.highestConfidence(group),
        representativeFinding: group[0],
      });
    }

    return groups;
  }

  /**
   * Two findings refer to the same vulnerability if:
   * 1. They target the same file and overlapping line ranges, OR
   * 2. They have highly similar detector names/descriptions
   */
  private areSameVulnerability(a: Finding, b: Finding): boolean {
    // Same location check
    if (a.filePath && b.filePath && a.filePath === b.filePath) {
      if (a.lineStart !== null && b.lineStart !== null && a.lineEnd !== null && b.lineEnd !== null) {
        const overlap = a.lineStart <= b.lineEnd && b.lineStart <= a.lineEnd;
        if (overlap) {
          // Check if detector categories are related
          if (this.detectorsRelated(a.detectorName, b.detectorName)) {
            return true;
          }
        }
      }
    }

    // Semantic similarity: same detector from different tools
    if (a.tool !== b.tool && this.detectorsRelated(a.detectorName, b.detectorName)) {
      // Same contract location (file + approximate line)
      if (a.filePath === b.filePath && a.lineStart !== null && b.lineStart !== null) {
        return Math.abs(a.lineStart - b.lineStart) <= 5;
      }
    }

    return false;
  }

  private detectorsRelated(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, '');
    const na = normalize(a);
    const nb = normalize(b);

    // Exact match after normalization
    if (na === nb) return true;

    // Known equivalences across tools
    const equivalences: string[][] = [
      ['reentrancy', 'reentrant', 'reentrancyeth', 'reentrancynoeth'],
      ['uninitialized', 'uninitializedstate', 'uninitializedlocal'],
      ['uncheckedtransfer', 'uncheckedreturn', 'uncheckedcall'],
      ['accesscontrol', 'missingaccesscontrol', 'unprotected'],
      ['overflow', 'integeroverflow', 'arithmeticoverflow'],
      ['selfdestruct', 'suicidal'],
      ['txorigin', 'txoriginauth'],
      ['delegatecall', 'controlleddelegatecall'],
    ];

    for (const group of equivalences) {
      const aMatch = group.some(term => na.includes(term));
      const bMatch = group.some(term => nb.includes(term));
      if (aMatch && bMatch) return true;
    }

    return false;
  }

  private highestSeverity(findings: Finding[]): Severity {
    let highest: Severity = 'informational';
    for (const f of findings) {
      if (SevOrder[f.severity] > SevOrder[highest]) {
        highest = f.severity;
      }
    }
    return highest;
  }

  private highestConfidence(findings: Finding[]): string {
    const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
    let highest = 'low';
    for (const f of findings) {
      if ((order[f.confidence] ?? 0) > (order[highest] ?? 0)) {
        highest = f.confidence;
      }
    }
    return highest;
  }
}
