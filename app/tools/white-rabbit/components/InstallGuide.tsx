'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal, Package, Code, Copy, Check } from 'lucide-react';

export function InstallGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const installCommands = {
    npm: 'npm install -g @whiteclaws/white-rabbit',
    yarn: 'yarn global add @whiteclaws/white-rabbit',
    pnpm: 'pnpm add -g @whiteclaws/white-rabbit',
  };

  const quickStart = `# Initialize
white-rabbit init

# Scan a contract
white-rabbit scan 0x1234... --chain base

# Hunt a protocol
white-rabbit hunt aave

# Analyze source code
white-rabbit analyze ./Contract.sol`;

  const mcpConfig = `{
  "mcpServers": {
    "whiteclaws": {
      "command": "npx",
      "args": ["@whiteclaws/mcp"]
    }
  }
}`;

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
        <Package className="w-5 h-5 mr-2 text-orange-400" />
        Installation Guide
      </h2>

      <Tabs defaultValue="cli" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-zinc-950">
          <TabsTrigger value="cli" className="data-[state=active]:bg-zinc-800">
            <Terminal className="w-4 h-4 mr-2" />
            CLI
          </TabsTrigger>
          <TabsTrigger value="mcp" className="data-[state=active]:bg-zinc-800">
            <Code className="w-4 h-4 mr-2" />
            MCP (AI Agents)
          </TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-zinc-800">
            <Package className="w-4 h-4 mr-2" />
            Library
          </TabsTrigger>
        </TabsList>

        {/* CLI Installation */}
        <TabsContent value="cli" className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Install via package manager</h3>
            <div className="space-y-3">
              {Object.entries(installCommands).map(([pkg, cmd]) => (
                <div
                  key={pkg}
                  className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg font-mono text-sm"
                >
                  <code className="text-zinc-300">{cmd}</code>
                  <button
                    onClick={() => copyToClipboard(cmd, pkg)}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    {copied === pkg ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Quick Start</h3>
            <div className="relative">
              <pre className="p-4 bg-zinc-950 rounded-lg font-mono text-sm text-zinc-300 overflow-x-auto">
                {quickStart}
              </pre>
              <button
                onClick={() => copyToClipboard(quickStart, 'quickstart')}
                className="absolute top-2 right-2 text-zinc-500 hover:text-white transition-colors"
              >
                {copied === 'quickstart' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="p-4 bg-zinc-950 rounded-lg">
            <h4 className="font-medium text-white mb-2">Prerequisites</h4>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Node.js 18+</li>
              <li>• Python 3.8+ (optional, for Slither/Mythril)</li>
              <li>• Foundry (optional, for fork testing)</li>
            </ul>
          </div>
        </TabsContent>

        {/* MCP Installation */}
        <TabsContent value="mcp" className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              Add to Claude Desktop or Cursor MCP settings
            </h3>
            <div className="relative">
              <pre className="p-4 bg-zinc-950 rounded-lg font-mono text-sm text-zinc-300 overflow-x-auto">
                {mcpConfig}
              </pre>
              <button
                onClick={() => copyToClipboard(mcpConfig, 'mcp')}
                className="absolute top-2 right-2 text-zinc-500 hover:text-white transition-colors"
              >
                {copied === 'mcp' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-950 rounded-lg">
              <h4 className="font-medium text-white mb-2">Available Tools</h4>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>• <code className="text-orange-400">wc_scan_contract</code></li>
                <li>• <code className="text-orange-400">wc_analyze_source</code></li>
                <li>• <code className="text-orange-400">wc_verify_finding</code></li>
              </ul>
            </div>
            <div className="p-4 bg-zinc-950 rounded-lg">
              <h4 className="font-medium text-white mb-2">Compatible Agents</h4>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>• Claude Code</li>
                <li>• Cursor</li>
                <li>• Any MCP-compatible agent</li>
              </ul>
            </div>
          </div>
        </TabsContent>

        {/* Library Installation */}
        <TabsContent value="library" className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Install as dependency</h3>
            <div className="p-3 bg-zinc-950 rounded-lg font-mono text-sm flex items-center justify-between">
              <code className="text-zinc-300">npm install @whiteclaws/white-rabbit</code>
              <button
                onClick={() => copyToClipboard('npm install @whiteclaws/white-rabbit', 'lib')}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                {copied === 'lib' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Usage Example</h3>
            <pre className="p-4 bg-zinc-950 rounded-lg font-mono text-sm text-zinc-300 overflow-x-auto">
{`import { WhiteRabbit } from '@whiteclaws/white-rabbit';

const scanner = new WhiteRabbit({
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
});

const findings = await scanner.scan('0x1234...', {
  chain: 'base',
  depth: 'standard',
});

console.log(\`Found \${findings.length} issues\`);`}
            </pre>
          </div>

          <div className="p-4 bg-zinc-950 rounded-lg">
            <h4 className="font-medium text-white mb-2">TypeScript Support</h4>
            <p className="text-sm text-zinc-400">
              Full TypeScript definitions included. All types exported from{' '}
              <code className="text-orange-400">@whiteclaws/white-rabbit</code>
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
