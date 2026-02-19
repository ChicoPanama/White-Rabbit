'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';

const CHAINS = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1 },
  { id: 'base', name: 'Base', chainId: 8453 },
  { id: 'arbitrum', name: 'Arbitrum', chainId: 42161 },
  { id: 'optimism', name: 'Optimism', chainId: 10 },
  { id: 'polygon', name: 'Polygon', chainId: 137 },
  { id: 'bsc', name: 'BSC', chainId: 56 },
  { id: 'avalanche', name: 'Avalanche', chainId: 43114 },
];

interface ScannerInputProps {
  onScanStart: () => void;
  onScanComplete: (results: any) => void;
}

export function ScannerInput({ onScanStart, onScanComplete }: ScannerInputProps) {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [depth, setDepth] = useState('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async () => {
    // Validate address
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    setError('');
    setIsLoading(true);
    onScanStart();

    try {
      // Call the API
      const response = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          chain,
          depth,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Scan failed');
      }

      const data = await response.json();
      
      // Poll for results
      const results = await pollForResults(data.scan_id);
      onScanComplete(results);
    } catch (err: any) {
      setError(err.message);
      onScanComplete(null);
    } finally {
      setIsLoading(false);
    }
  };

  const pollForResults = async (scanId: string): Promise<any> => {
    // For demo, return mock results immediately
    // In production, poll the API
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          scan_id: scanId,
          status: 'completed',
          findings: generateMockFindings(address),
        });
      }, 3000);
    });
  };

  const generateMockFindings = (addr: string) => {
    return [
      {
        id: '1',
        title: 'Potential Reentrancy in Withdraw Function',
        severity: 'high',
        description: 'External call before state update detected',
        tool: 'pattern',
        line_start: 45,
      },
      {
        id: '2',
        title: 'Unchecked External Call Return Value',
        severity: 'medium',
        description: 'Return value of call not checked',
        tool: 'pattern',
        line_start: 47,
      },
    ];
  };

  return (
    <div id="scanner" className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
        <Search className="w-5 h-5 mr-2 text-orange-400" />
        Scan Contract Address
      </h2>

      <div className="space-y-6">
        {/* Address Input */}
        <div className="space-y-2">
          <Label htmlFor="address">Contract Address</Label>
          <Input
            id="address"
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="bg-zinc-950 border-zinc-800 font-mono"
          />
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* Chain & Depth */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Blockchain</Label>
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {CHAINS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scan Depth</Label>
            <Select value={depth} onValueChange={setDepth}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="quick">Quick (30s)</SelectItem>
                <SelectItem value="standard">Standard (5min)</SelectItem>
                <SelectItem value="deep">Deep (30min)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scan Button */}
        <Button
          onClick={handleScan}
          disabled={isLoading || !address}
          className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Start Scan
            </>
          )}
        </Button>

        {/* Info */}
        <p className="text-zinc-500 text-sm text-center">
          Scanning {depth === 'quick' ? 'uses Pattern engine only' : depth === 'standard' ? 'uses Pattern + Slither' : 'uses all available engines'}
        </p>
      </div>
    </div>
  );
}
