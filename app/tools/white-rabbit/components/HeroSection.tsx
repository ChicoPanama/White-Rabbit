'use client';

import { Button } from '@/components/ui/button';
import { Terminal, Shield, Zap, Bug } from 'lucide-react';

export function HeroSection() {
  return (
    <div className="relative overflow-hidden bg-black border-b border-zinc-800">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 mb-8">
            <span className="text-2xl">🐇</span>
            <span className="text-zinc-400 text-sm">Smart Contract Security Scanner</span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              White-Rabbit
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl sm:text-2xl text-zinc-400 max-w-3xl mx-auto mb-8">
            Hunt vulnerabilities in smart contracts before the hackers do.
            <br className="hidden sm:block" />
            <span className="text-zinc-500">Integrated with 459 bounty programs on WhiteClaws.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white px-8"
              onClick={() => document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Bug className="w-5 h-5 mr-2" />
              Start Scanning
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-900 px-8"
            >
              <Terminal className="w-5 h-5 mr-2" />
              npm install -g @whiteclaws/white-rabbit
            </Button>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
              <Shield className="w-8 h-8 text-orange-400 mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Multi-Engine Analysis</h3>
              <p className="text-zinc-400 text-sm">Slither, Pattern matching, Mythril, and AI-powered detection</p>
            </div>
            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
              <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Quick & Deep Modes</h3>
              <p className="text-zinc-400 text-sm">Fast triage in 30s or comprehensive analysis in minutes</p>
            </div>
            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
              <Bug className="w-8 h-8 text-pink-400 mx-auto mb-4" />
              <h3 className="font-semibold text-white mb-2">Bounty Integration</h3>
              <p className="text-zinc-400 text-sm">Submit findings directly to WhiteClaws for rewards</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
