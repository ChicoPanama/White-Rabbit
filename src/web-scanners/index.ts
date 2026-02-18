/**
 * WHITE RABBIT - Web Security Scanners Module
 * 
 * Exports all web application security scanning capabilities.
 */

// Types
export type {
  WebTarget,
  WebTargetType,
  WebAppTarget,
  SubdomainTarget,
  SPATarget,
  WebScanConfig,
  WebFinding,
  WebScanResult,
  OWASPCheck,
  OWASPCategory,
  DOMXSSFinding,
  SubdomainTakeoverFinding,
  DNSRecord,
} from './types.js';

// Scanners
export { BlackWidowScanner } from './blackwidow-scanner.js';
export { SubOverScanner } from './subover-scanner.js';
export { DomDigScanner } from './domdig-scanner.js';

// Constants
export { DefaultWebScanConfig } from './types.js';
