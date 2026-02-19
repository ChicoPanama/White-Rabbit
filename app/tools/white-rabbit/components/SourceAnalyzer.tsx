'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Code } from 'lucide-react';

interface SourceAnalyzerProps {
  onAnalyzeStart: () => void;
  onAnalyzeComplete: (results: any) => void;
}

export function SourceAnalyzer({ onAnalyzeStart, onAnalyzeComplete }: SourceAnalyzerProps) {
  const [sourceCode, setSourceCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!sourceCode.trim()) {
      setError('Please enter Solidity source code');
      return;
    }

    if (sourceCode.length > 500000) {
      setError('Source code too large (max 500KB)');
      return;
    }

    setError('');
    setIsLoading(true);
    onAnalyzeStart();

    try {
      const response = await fetch('/api/scanner/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: sourceCode,
          compiler_version: '0.8.19',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      onAnalyzeComplete(data);
    } catch (err: any) {
      setError(err.message);
      onAnalyzeComplete(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load example code
  const loadExample = () => {
    setSourceCode(`pragma solidity ^0.8.19;

contract VulnerableToken {
    mapping(address => uint) public balances;
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    function withdraw() external {
        uint amount = balances[msg.sender];
        require(amount > 0, "No balance");
        
        // Vulnerable: external call before state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] = 0;
    }
    
    function checkOwner() internal view {
        // Vulnerable: tx.origin usage
        require(tx.origin == owner, "Not owner");
    }
    
    receive() external payable {
        balances[msg.sender] += msg.value;
    }
}`);
  };

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
        <Code className="w-5 h-5 mr-2 text-orange-400" />
        Analyze Source Code
      </h2>

      <div className="space-y-6">
        {/* Source Code Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="source">Solidity Source Code</Label>
            <button
              onClick={loadExample}
              className="text-sm text-orange-400 hover:text-orange-300"
            >
              Load vulnerable example
            </button>
          </div>
          <Textarea
            id="source"
            placeholder="pragma solidity ^0.8.19;\ncontract MyContract { ... }"
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            className="bg-zinc-950 border-zinc-800 font-mono min-h-[300px] resize-y"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{sourceCode.length} characters</span>
            <span>Max 500KB</span>
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* Analyze Button */}
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || !sourceCode.trim()}
          className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Code className="w-4 h-4 mr-2" />
              Analyze Code
            </>
          )}
        </Button>

        {/* Info */}
        <div className="text-zinc-500 text-sm space-y-1">
          <p>• Uses Pattern engine for instant results</p>
          <p>• Detects reentrancy, access control, and more</p>
          <p>• Results include line numbers and descriptions</p>
        </div>
      </div>
    </div>
  );
}
