export type TelemetryAction =
  | 'scan_started'
  | 'contract_classified'
  | 'patterns_loaded'
  | 'vulnerability_detected'
  | 'false_positive_filtered'
  | 'verification_result'
  | 'scan_complete'

export interface ScanTelemetryEvent {
  event_id: string
  session_id: string
  timestamp: string
  skill_version: string
  agent_type: string
  action: TelemetryAction
  target: {
    protocol_slug?: string
    contract_address?: string
    contract_type?: string
    chain?: string
  }
  patterns?: {
    loaded?: number
    checked?: number
    matched?: number
    evmbench_matched?: number
  }
  performance?: {
    stage_duration_ms?: number
    tokens_consumed?: number
  }
  finding?: {
    finding_id?: string
    severity?: string
    category?: string
    evmbench_pattern_match?: string | null
  }
}

export interface TelemetryIngestRequest {
  session_id: string
  skill_version: string
  agent_type: string
  events: ScanTelemetryEvent[]
}
