/**
 * Temporal client — starts scan workflows and retrieves results.
 *
 * Usage from CLI or other modules:
 *   import { startScan, getScanResult, cancelScan } from './temporal/client.js';
 *   const handle = await startScan({ sessionId, contractAddress, chain });
 *   const result = await awaitScanResult(sessionId);
 */

import { Client, Connection, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import type { ScanWorkflowInput, ScanWorkflowResult, WorkflowProgress } from './shared.js';
import { TASK_QUEUE, WORKFLOW_ID_PREFIX, PROGRESS_QUERY } from './shared.js';

// ── Connection Management ──

let _client: Client | null = null;

async function getClient(): Promise<Client> {
  if (_client) return _client;

  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'white-rabbit';

  const connection = await Connection.connect({ address });
  _client = new Client({ connection, namespace });
  return _client;
}

/**
 * Close the shared client connection. Call on process exit.
 */
export async function closeClient(): Promise<void> {
  if (_client) {
    _client = null;
  }
}

// ── Workflow Operations ──

/**
 * Build a deterministic workflow ID from session ID.
 */
function workflowId(sessionId: string): string {
  return `${WORKFLOW_ID_PREFIX}-${sessionId}`;
}

/**
 * Start a new scan workflow.
 * Returns the workflow ID. Use awaitScanResult() or queryProgress() to get status.
 */
export async function startScan(input: ScanWorkflowInput): Promise<string> {
  const client = await getClient();
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? TASK_QUEUE;
  const wfId = workflowId(input.sessionId);

  try {
    await client.workflow.start('scanWorkflow', {
      args: [input],
      taskQueue,
      workflowId: wfId,
      workflowExecutionTimeout: '1 hour',
      memo: {
        contractAddress: input.contractAddress ?? '',
        chain: input.chain ?? '',
        protocolName: input.protocolName ?? '',
      },
    });

    console.log(`[Client] Started workflow ${wfId}`);
    return wfId;
  } catch (err) {
    if (err instanceof WorkflowExecutionAlreadyStartedError) {
      console.log(`[Client] Workflow ${wfId} already running`);
      return wfId;
    }
    throw err;
  }
}

/**
 * Query workflow progress.
 */
export async function queryProgress(sessionId: string): Promise<WorkflowProgress> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId(sessionId));
  return handle.query<WorkflowProgress>(PROGRESS_QUERY);
}

/**
 * Wait for scan result (blocking).
 */
export async function awaitScanResult(sessionId: string): Promise<ScanWorkflowResult> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId(sessionId));
  return await handle.result() as ScanWorkflowResult;
}

/**
 * Cancel a running scan workflow.
 */
export async function cancelScan(sessionId: string): Promise<void> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId(sessionId));
  await handle.cancel();
  console.log(`[Client] Cancelled workflow ${workflowId(sessionId)}`);
}

/**
 * Terminate a running scan workflow (immediate, no cleanup).
 */
export async function terminateScan(sessionId: string, reason?: string): Promise<void> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId(sessionId));
  await handle.terminate(reason ?? 'Manual termination');
  console.log(`[Client] Terminated workflow ${workflowId(sessionId)}`);
}

/**
 * Describe a workflow (status, start time, etc.).
 */
export async function describeScan(sessionId: string): Promise<{
  status: string;
  startTime: Date | undefined;
  closeTime: Date | undefined;
  historyLength: number;
}> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId(sessionId));
  const desc = await handle.describe();
  return {
    status: desc.status.name,
    startTime: desc.startTime,
    closeTime: desc.closeTime,
    historyLength: desc.historyLength,
  };
}

/**
 * List recent scan workflows.
 */
export async function listScans(limit: number = 10): Promise<Array<{
  workflowId: string;
  status: string;
  startTime: Date | undefined;
}>> {
  const client = await getClient();
  const results: Array<{ workflowId: string; status: string; startTime: Date | undefined }> = [];

  const iterator = client.workflow.list({
    query: `WorkflowType = 'scanWorkflow' ORDER BY StartTime DESC`,
  });

  for await (const wf of iterator) {
    results.push({
      workflowId: wf.workflowId,
      status: wf.status.name,
      startTime: wf.startTime,
    });
    if (results.length >= limit) break;
  }

  return results;
}
