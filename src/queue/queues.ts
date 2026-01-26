import { Queue } from 'bullmq';
import type { AnalysisJobData, AlertJobData, DiscoveryJobData } from '../types/index.js';

export function createQueues(redisUrl: string) {
  const connection = parseRedisUrl(redisUrl);

  const discoveryQueue = new Queue<DiscoveryJobData>('discovery', { connection });
  const analysisQueue = new Queue<AnalysisJobData>('analysis', { connection });
  const alertQueue = new Queue<AlertJobData>('alerts', { connection });

  return { discoveryQueue, analysisQueue, alertQueue, connection };
}

function parseRedisUrl(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}
