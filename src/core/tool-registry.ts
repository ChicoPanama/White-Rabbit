/**
 * WHITE RABBIT - Tool Registry
 * 
 * PicoClaw Pattern: Plugin architecture for extensible tools
 * Dependency injection with context awareness
 */

import { serviceLogger } from './logger.js';

export interface ToolContext {
  chainId?: number;
  address?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  silent?: boolean;      // Don't show to user
  forLLM?: string;       // What LLM should see
  durationMs?: number;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    default?: unknown;
  }>;
  execute(args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> | ToolResult;
}

export interface ToolRegistration {
  tool: Tool;
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
  };
}

/**
 * Tool Registry
 * 
 * Plugin architecture for registering and executing tools.
 * Supports dependency injection via context.
 */
export class ToolRegistry {
  private tools: Map<string, ToolRegistration> = new Map();
  private context: ToolContext = {};

  /**
   * Register a tool
   */
  register(registration: ToolRegistration): this {
    const { tool } = registration;
    
    if (this.tools.has(tool.name)) {
      serviceLogger.warn('Tool already registered, overwriting', { name: tool.name });
    }

    this.tools.set(tool.name, registration);
    serviceLogger.info('Tool registered', { 
      name: tool.name, 
      description: tool.description,
      author: registration.metadata?.author,
    });
    
    return this;
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const existed = this.tools.delete(name);
    if (existed) {
      serviceLogger.info('Tool unregistered', { name });
    }
    return existed;
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)?.tool;
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool
   */
  async execute(name: string, args: Record<string, unknown> = {}, context?: ToolContext): Promise<ToolResult> {
    const registration = this.tools.get(name);
    
    if (!registration) {
      serviceLogger.error('Tool not found', { name });
      return {
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    const startTime = Date.now();
    const mergedContext = { ...this.context, ...context };

    serviceLogger.debug('Executing tool', { name, args, context: mergedContext });

    try {
      const result = await Promise.resolve(registration.tool.execute(args, mergedContext));
      
      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      serviceLogger.error('Tool execution failed', { name, error }, err as Error);
      
      return {
        success: false,
        error,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Set global context for all tool executions
   */
  setContext(context: ToolContext): this {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Clear global context
   */
  clearContext(): this {
    this.context = {};
    return this;
  }

  /**
   * Get global context
   */
  getContext(): ToolContext {
    return { ...this.context };
  }

  /**
   * List all registered tools
   */
  list(): Array<{ name: string; description: string; metadata?: ToolRegistration['metadata'] }> {
    return Array.from(this.tools.entries()).map(([name, reg]) => ({
      name,
      description: reg.tool.description,
      metadata: reg.metadata,
    }));
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Create a child registry with inherited context
   */
  createChild(): ToolRegistry {
    const child = new ToolRegistry();
    child.setContext(this.getContext());
    return child;
  }
}

// Global instance
let globalToolRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalToolRegistry) {
    globalToolRegistry = new ToolRegistry();
  }
  return globalToolRegistry;
}

export function resetToolRegistry(): void {
  globalToolRegistry = null;
}

// =============================================================================
// BUILT-IN TOOLS
// =============================================================================

/**
 * Built-in tools for White Rabbit
 */
export const BuiltInTools = {
  /**
   * Scan a contract
   */
  scanContract: (): Tool => ({
    name: 'scan_contract',
    description: 'Scan a smart contract for vulnerabilities',
    parameters: {
      address: {
        type: 'string',
        description: 'Contract address',
        required: true,
      },
      chainId: {
        type: 'number',
        description: 'Chain ID',
        required: true,
      },
    },
    execute: async (args, context) => {
      // Would integrate with scanner
      return {
        success: true,
        data: { address: args.address, chainId: args.chainId },
        forLLM: `Scanning contract ${args.address} on chain ${args.chainId}`,
      };
    },
  }),

  /**
   * Analyze with AI
   */
  analyzeWithAI: (): Tool => ({
    name: 'analyze_with_ai',
    description: 'Analyze findings with AI',
    parameters: {
      findings: {
        type: 'array',
        description: 'List of findings to analyze',
        required: true,
      },
      tier: {
        type: 'string',
        description: 'AI analysis tier',
        default: 'haiku',
      },
    },
    execute: async (args, context) => {
      // Would integrate with AI analyzer
      return {
        success: true,
        data: { tier: args.tier, findingCount: (args.findings as unknown[]).length },
        forLLM: `Analyzing ${(args.findings as unknown[]).length} findings with ${args.tier} tier`,
      };
    },
  }),

  /**
   * Send notification
   */
  sendNotification: (): Tool => ({
    name: 'send_notification',
    description: 'Send a notification',
    parameters: {
      message: {
        type: 'string',
        description: 'Message to send',
        required: true,
      },
      channel: {
        type: 'string',
        description: 'Notification channel',
        default: 'telegram',
      },
    },
    execute: async (args, context) => {
      // Would integrate with alerter
      return {
        success: true,
        data: { channel: args.channel, message: args.message },
        silent: true,
      };
    },
  }),

  /**
   * Get protocol info
   */
  getProtocolInfo: (): Tool => ({
    name: 'get_protocol_info',
    description: 'Get information about a protocol',
    parameters: {
      name: {
        type: 'string',
        description: 'Protocol name',
        required: true,
      },
    },
    execute: async (args, context) => {
      // Would integrate with DeFiLlama
      return {
        success: true,
        data: { protocol: args.name },
        forLLM: `Retrieved info for protocol: ${args.name}`,
      };
    },
  }),

  /**
   * Fetch contract source
   */
  fetchContractSource: (): Tool => ({
    name: 'fetch_contract_source',
    description: 'Fetch contract source code from Etherscan',
    parameters: {
      address: {
        type: 'string',
        description: 'Contract address',
        required: true,
      },
      chainId: {
        type: 'number',
        description: 'Chain ID',
        required: true,
      },
    },
    execute: async (args, context) => {
      // Would integrate with Etherscan client
      return {
        success: true,
        data: { address: args.address, chainId: args.chainId },
        forLLM: `Fetched source for ${args.address}`,
      };
    },
  }),
};

/**
 * Register all built-in tools
 */
export function registerBuiltInTools(registry: ToolRegistry = getToolRegistry()): ToolRegistry {
  registry
    .register({ tool: BuiltInTools.scanContract(), metadata: { author: 'white-rabbit', version: '1.0.0', tags: ['scanning'] } })
    .register({ tool: BuiltInTools.analyzeWithAI(), metadata: { author: 'white-rabbit', version: '1.0.0', tags: ['ai'] } })
    .register({ tool: BuiltInTools.sendNotification(), metadata: { author: 'white-rabbit', version: '1.0.0', tags: ['alerts'] } })
    .register({ tool: BuiltInTools.getProtocolInfo(), metadata: { author: 'white-rabbit', version: '1.0.0', tags: ['data'] } })
    .register({ tool: BuiltInTools.fetchContractSource(), metadata: { author: 'white-rabbit', version: '1.0.0', tags: ['etherscan'] } });

  return registry;
}

export default ToolRegistry;
