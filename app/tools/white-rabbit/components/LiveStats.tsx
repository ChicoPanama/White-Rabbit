'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bug, Shield, Zap, Trophy } from 'lucide-react';

interface Stats {
  totalScans: number;
  findingsFound: number;
  vulnerabilitiesFixed: number;
  topHunters: string[];
}

export function LiveStats() {
  const [stats, setStats] = useState<Stats>({
    totalScans: 15420,
    findingsFound: 8734,
    vulnerabilitiesFixed: 2156,
    topHunters: ['@alice_security', '@bob_hunter', '@charlie_researcher'],
  });

  // In production, fetch from API
  useEffect(() => {
    // Mock live updates
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        totalScans: prev.totalScans + Math.floor(Math.random() * 3),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <Zap className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatNumber(stats.totalScans)}</p>
              <p className="text-sm text-zinc-400">Total Scans</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-red-500/10">
              <Bug className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatNumber(stats.findingsFound)}</p>
              <p className="text-sm text-zinc-400">Findings Detected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatNumber(stats.vulnerabilitiesFixed)}</p>
              <p className="text-sm text-zinc-400">Vulnerabilities Fixed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Trophy className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">$2.4M</p>
              <p className="text-sm text-zinc-400">Bounties Paid</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
