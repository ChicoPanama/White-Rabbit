import { appendFile, mkdir } from 'fs/promises'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import type { ScanTelemetryEvent, TelemetryAction, TelemetryIngestRequest } from './types.js'

interface TelemetryEmitterConfig {
  enabled?: boolean
  apiKey?: string
  apiUrl?: string
  agentType?: string
  skillVersion?: string
  sessionId?: string
  flushEvery?: number
}

export class TelemetryEmitter {
  private enabled: boolean
  private sessionId: string
  private buffer: ScanTelemetryEvent[] = []
  private apiKey?: string
  private apiUrl?: string
  private agentType: string
  private skillVersion: string
  private flushEvery: number

  constructor(config: TelemetryEmitterConfig = {}) {
    this.enabled = config.enabled !== false
    this.sessionId = config.sessionId || randomUUID()
    this.apiKey = config.apiKey
    this.apiUrl = config.apiUrl
    this.agentType = config.agentType || 'white-rabbit-skill'
    this.skillVersion = config.skillVersion || '2.0.0-alpha'
    this.flushEvery = config.flushEvery || 25
  }

  getSessionId(): string {
    return this.sessionId
  }

  emit(event: Omit<ScanTelemetryEvent, 'event_id' | 'session_id' | 'timestamp' | 'skill_version' | 'agent_type'>): void {
    if (!this.enabled) return

    const fullEvent: ScanTelemetryEvent = {
      event_id: randomUUID(),
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      skill_version: this.skillVersion,
      agent_type: this.agentType,
      ...event,
    }

    this.buffer.push(fullEvent)

    if (this.buffer.length >= this.flushEvery) {
      void this.flush()
    }
  }

  async flush(apiUrl?: string): Promise<void> {
    if (!this.enabled || this.buffer.length === 0) return

    const url = apiUrl || this.apiUrl || process.env.WR_TELEMETRY_URL || 'https://whiteclaws.app/api/telemetry/ingest/'
    const payload: TelemetryIngestRequest = {
      session_id: this.sessionId,
      skill_version: this.skillVersion,
      agent_type: this.agentType,
      events: [...this.buffer],
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey || process.env.WHITECLAWS_API_KEY || '',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.ok) {
        this.buffer = []
        return
      }

      await this.writeLocalFallback(payload)
    } catch {
      await this.writeLocalFallback(payload)
    }
  }

  private async writeLocalFallback(payload: TelemetryIngestRequest): Promise<void> {
    const dir = path.join(os.homedir(), '.white-rabbit', 'telemetry')
    await mkdir(dir, { recursive: true })

    const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`)
    await appendFile(file, JSON.stringify(payload) + '\n')
  }
}

export function makeTelemetryEvent(action: TelemetryAction, target: ScanTelemetryEvent['target']): Omit<ScanTelemetryEvent, 'event_id' | 'session_id' | 'timestamp' | 'skill_version' | 'agent_type'> {
  return {
    action,
    target,
  }
}
