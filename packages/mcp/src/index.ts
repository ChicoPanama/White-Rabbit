#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// White-Rabbit MCP Server
// Model Context Protocol server for smart contract security scanning
// ═══════════════════════════════════════════════════════════════════════════════

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { registerScannerTools } from './tools/scanner.js';

const server = new Server(
  {
    name: '@whiteclaws/mcp-white-rabbit',
    version: '2.0.0-alpha.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register all scanner tools
const tools: Tool[] = [];
registerScannerTools(tools, server);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Tools are registered with their own handlers in scanner.ts
  throw new Error(`Tool ${request.params.name} not found`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('White-Rabbit MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
