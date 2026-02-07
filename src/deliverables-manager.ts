import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { PhaseName } from './queue-validation.js';

/**
 * Structured deliverables manager.
 *
 * Creates session-scoped deliverable directories and provides read/write
 * access with automatic metadata headers (timestamp, phase, agent, version).
 */

const DELIVERABLES_ROOT = path.resolve(process.cwd(), 'deliverables');

/** Scanner version from package.json (cached) */
let scannerVersion = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
  scannerVersion = pkg.version ?? '1.0.0';
} catch {
  // Ignore - use default version
}

/** Metadata header included in every deliverable */
export interface DeliverableMetadata {
  timestamp: string;
  phase: string;
  agent: string;
  scanner_version: string;
}

/** A deliverable with its data and metadata */
export interface Deliverable<T = unknown> {
  metadata: DeliverableMetadata;
  data: T;
}

/**
 * Create a new scan session and return its ID.
 * Creates the session directory under deliverables/.
 */
export function createSession(): string {
  const sessionId = uuidv4();
  const sessionDir = path.join(DELIVERABLES_ROOT, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  return sessionId;
}

/**
 * Get the directory path for a session.
 */
export function getSessionDir(sessionId: string): string {
  return path.join(DELIVERABLES_ROOT, sessionId);
}

/**
 * Get the full path for a deliverable file within a session.
 */
function getDeliverablePath(sessionId: string, phaseName: string, filename: string): string {
  return path.join(DELIVERABLES_ROOT, sessionId, phaseName, filename);
}

/**
 * Write a deliverable to the session directory.
 * Automatically adds metadata header with timestamp, phase, agent, and scanner version.
 *
 * @param sessionId - The scan session ID
 * @param phaseName - The pipeline phase producing this deliverable
 * @param filename - The deliverable filename (e.g., "slither-report.json")
 * @param data - The deliverable data (will be JSON-serialized or written as string)
 * @param agent - The agent/tool that produced this deliverable (default: "scanner")
 *
 * @example
 * ```ts
 * writeDeliverable(sessionId, 'static-analysis', 'slither-report.json', slitherOutput);
 * ```
 */
export function writeDeliverable(
  sessionId: string,
  phaseName: string,
  filename: string,
  data: unknown,
  agent = 'scanner',
): void {
  const filePath = getDeliverablePath(sessionId, phaseName, filename);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const metadata: DeliverableMetadata = {
    timestamp: new Date().toISOString(),
    phase: phaseName,
    agent,
    scanner_version: scannerVersion,
  };

  if (filename.endsWith('.json')) {
    const deliverable: Deliverable = { metadata, data };
    fs.writeFileSync(filePath, JSON.stringify(deliverable, null, 2), 'utf-8');
  } else if (filename.endsWith('.md')) {
    // For markdown files, prepend metadata as YAML front matter
    const frontMatter = [
      '---',
      `timestamp: "${metadata.timestamp}"`,
      `phase: "${metadata.phase}"`,
      `agent: "${metadata.agent}"`,
      `scanner_version: "${metadata.scanner_version}"`,
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(filePath, frontMatter + String(data), 'utf-8');
  } else {
    fs.writeFileSync(filePath, String(data), 'utf-8');
  }
}

/**
 * Read and parse a deliverable from the session directory.
 *
 * @param sessionId - The scan session ID
 * @param phaseName - The pipeline phase that produced the deliverable
 * @param filename - The deliverable filename
 * @returns The parsed deliverable with metadata, or null if not found
 */
export function readDeliverable<T = unknown>(
  sessionId: string,
  phaseName: string,
  filename: string,
): Deliverable<T> | null {
  const filePath = getDeliverablePath(sessionId, phaseName, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (filename.endsWith('.json')) {
    return JSON.parse(content) as Deliverable<T>;
  }

  // For non-JSON files, return raw content as data with extracted metadata
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      phase: phaseName,
      agent: 'unknown',
      scanner_version: scannerVersion,
    },
    data: content as unknown as T,
  };
}

/**
 * Check if a specific deliverable exists.
 */
export function deliverableExists(sessionId: string, phaseName: string, filename: string): boolean {
  return fs.existsSync(getDeliverablePath(sessionId, phaseName, filename));
}

export interface DeliverableInfo {
  phase: string;
  filename: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
}

/**
 * List all deliverables for a session.
 *
 * @param sessionId - The scan session ID
 * @returns Array of deliverable info objects
 */
export function listDeliverables(sessionId: string): DeliverableInfo[] {
  const sessionDir = getSessionDir(sessionId);
  if (!fs.existsSync(sessionDir)) {
    return [];
  }

  const deliverables: DeliverableInfo[] = [];

  function scanDir(dir: string, phase: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath, entry.name);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        deliverables.push({
          phase,
          filename: entry.name,
          relativePath: path.relative(sessionDir, fullPath),
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      }
    }
  }

  scanDir(sessionDir, '');
  return deliverables;
}

/**
 * List all session IDs (sorted by most recent first).
 */
export function listSessions(): string[] {
  if (!fs.existsSync(DELIVERABLES_ROOT)) {
    return [];
  }

  return fs.readdirSync(DELIVERABLES_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({
      name: d.name,
      mtime: fs.statSync(path.join(DELIVERABLES_ROOT, d.name)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .map(d => d.name);
}

/**
 * Get a summary of a session's deliverables.
 */
export function getSessionSummary(sessionId: string): {
  sessionId: string;
  deliverableCount: number;
  phases: string[];
  totalSize: number;
} {
  const deliverables = listDeliverables(sessionId);
  const phases = [...new Set(deliverables.map(d => d.phase))].filter(Boolean);
  const totalSize = deliverables.reduce((sum, d) => sum + d.size, 0);

  return {
    sessionId,
    deliverableCount: deliverables.length,
    phases,
    totalSize,
  };
}
