import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv';

/**
 * YAML configuration parser with JSON Schema validation.
 *
 * Loads scan configuration from a YAML file, validates it against the schema,
 * and merges with defaults. AI provider settings have no defaults and must be
 * explicitly configured by the user.
 */

const CONFIGS_DIR = path.resolve(process.cwd(), 'configs');
const SCHEMA_PATH = path.join(CONFIGS_DIR, 'config-schema.json');
const DEFAULT_CONFIG_PATH = path.join(CONFIGS_DIR, 'default-config.yaml');

/** Parsed scan configuration */
export interface ScanConfig {
  target: {
    chain: string;
    contract_address: string;
    protocol_name: string;
    tvl_range: [number, number];
  };
  scanner: {
    scan_frequency_minutes: number;
    max_concurrent_scans: number;
    enabled_vuln_types: string[];
  };
  verification: {
    foundry_fork: boolean;
    mainnet_rpc: string;
    gas_limit: number;
    require_compilation_check: boolean;
    require_parameter_bounds: boolean;
  };
  ai: {
    provider_endpoint: string;
    api_key_env: string;
    model: string;
    fallback_model: string;
    response_token_limit: number;
    context_window_guard: number;
    tiered_analysis: boolean;
  };
  reporting: {
    format: 'immunefi' | 'markdown' | 'json';
    min_severity: string;
    include_poc: boolean;
  };
  filtering: {
    skip_design_choices: boolean;
    skip_solidity_08_overflow: boolean;
    min_exploitable_value_usd: number;
  };
}

/**
 * Deep merge two objects. Source values override target values.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal) &&
      targetVal !== null
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      ) as T[keyof T];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }
  return result;
}

/**
 * Load the default configuration from YAML.
 */
function loadDefaults(): Record<string, unknown> {
  if (!fs.existsSync(DEFAULT_CONFIG_PATH)) {
    return {};
  }
  const content = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
  return (yaml.load(content) as Record<string, unknown>) ?? {};
}

/**
 * Load the JSON Schema for validation.
 */
function loadSchema(): Record<string, unknown> {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Config schema not found at: ${SCHEMA_PATH}`);
  }
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
}

/**
 * Build a config from environment variables (fallback when no YAML config is provided).
 */
function buildFromEnv(): Partial<ScanConfig> {
  const config: Partial<ScanConfig> = {};

  if (process.env.SCAN_CHAINS) {
    config.target = {
      chain: process.env.SCAN_CHAINS.split(',')[0]?.trim() ?? 'ethereum',
      contract_address: '',
      protocol_name: '',
      tvl_range: [
        Number(process.env.MIN_TVL_THRESHOLD) || 10_000_000,
        Number(process.env.MAX_TVL_THRESHOLD) || 0,
      ],
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    config.ai = {
      provider_endpoint: 'https://api.anthropic.com',
      api_key_env: 'ANTHROPIC_API_KEY',
      model: process.env.AI_MODEL_SONNET ?? '',
      fallback_model: process.env.AI_MODEL_HAIKU ?? '',
      response_token_limit: 2000,
      context_window_guard: 100000,
      tiered_analysis: true,
    };
  }

  if (process.env.ALERT_MIN_SEVERITY) {
    config.reporting = {
      format: 'immunefi',
      min_severity: process.env.ALERT_MIN_SEVERITY,
      include_poc: true,
    };
  }

  return config;
}

/**
 * Load, validate, and merge a scan configuration.
 *
 * Resolution order:
 * 1. Default config (configs/default-config.yaml)
 * 2. User config (if configPath provided)
 * 3. Environment variable overrides
 *
 * @param configPath - Optional path to a YAML config file
 * @returns The fully resolved ScanConfig
 * @throws Error if the config fails schema validation or AI provider is not configured
 *
 * @example
 * ```ts
 * // Load from a specific config file
 * const config = loadScanConfig('configs/example-micro-protocol.yaml');
 *
 * // Load defaults + env vars
 * const config = loadScanConfig();
 * ```
 */
export function loadScanConfig(configPath?: string): ScanConfig {
  // Step 1: Load defaults
  const defaults = loadDefaults();

  // Step 2: Load user config if provided
  let userConfig: Record<string, unknown> = {};
  if (configPath) {
    const resolvedPath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Config file not found: ${resolvedPath}`);
    }
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    userConfig = (yaml.load(content) as Record<string, unknown>) ?? {};
  }

  // Step 3: Merge defaults <- user config
  const merged = deepMerge(defaults as Record<string, unknown>, userConfig);

  // Step 4: Apply env var overrides
  const envOverrides = buildFromEnv();
  const final = deepMerge(merged, envOverrides as Record<string, unknown>);

  // Step 5: Validate against schema
  const schema = loadSchema();
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(final);

  if (!valid && validate.errors) {
    const errorMessages = validate.errors
      .map(e => `  - ${e.instancePath || '/'}: ${e.message}`)
      .join('\n');
    throw new Error(`Config validation failed:\n${errorMessages}`);
  }

  const config = final as unknown as ScanConfig;

  // Step 6: Validate AI provider is configured (no defaults for AI)
  const aiConfigured = config.ai?.provider_endpoint && config.ai?.model;
  if (!aiConfigured) {
    // Check if env vars provide AI config
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

    if (!hasAnthropicKey && !hasOpenRouterKey) {
      throw new Error(
        'AI provider is not configured. You must set ai.provider_endpoint and ai.model in your config file, ' +
        'or set ANTHROPIC_API_KEY / OPENROUTER_API_KEY environment variables.\n\n' +
        'See configs/default-config.yaml for configuration examples.'
      );
    }
  }

  return config;
}

/**
 * List available config files in the configs/ directory.
 */
export function listConfigs(): string[] {
  if (!fs.existsSync(CONFIGS_DIR)) {
    return [];
  }
  return fs.readdirSync(CONFIGS_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
}
