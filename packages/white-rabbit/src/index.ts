// ═══════════════════════════════════════════════════════════════════════════════
// @whiteclaws/white-rabbit - Main Entry Point
// Portable smart contract security scanner for whiteclaws.app
// ═══════════════════════════════════════════════════════════════════════════════

// Core API
export { WhiteRabbit, ScanOptions, ScanProgress } from './core/white-rabbit.js';
export { ScopeChecker } from './core/scope-checker.js';

// Types - Everything you need for TypeScript
export * from './types.js';

// Engines - Direct access to analysis engines
export { AnalysisPipeline } from './engines/analysis-pipeline.js';
export { PatternEngine } from './engines/pattern.js';
export { 
  PatternRegistryLoader,
  getPatternRegistry 
} from './engines/pattern-registry-compat.js';
export type { 
  VulnerabilityPattern,
  PatternDetector,
  PatternRegistry,
  HistoricalCase
} from './engines/pattern-registry-compat.js';
export type { 
  AnalysisEngine, 
  EngineOptions, 
  EngineResult 
} from './types.js';

// Connectors - API clients
export { WhiteClawsClient } from './connectors/whiteclaws-client.js';
export { ChainConnector } from './connectors/chain.js';
export { DeFiLlamaConnector } from './connectors/defillama.js';
export { OfflineQueue } from './connectors/offline-queue.js';

// Intelligence - Protocol data and analysis
export { ProtocolIntelligence, EnrichedProtocol } from './intelligence/protocol-intel.js';
export { KnownVulnDatabase, KnownVulnerability } from './intelligence/known-vulns.js';

// Utils - Helper functions
export { ContractResolver } from './utils/contract-resolver.js';

// Version
export const VERSION = '2.0.0-alpha.1';

// Convenience re-exports for common use cases
export { 
  WhiteRabbit as Scanner,
  WhiteRabbit as default 
} from './core/white-rabbit.js';
