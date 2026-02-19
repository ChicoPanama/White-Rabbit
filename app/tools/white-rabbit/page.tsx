'use client';

import { useState } from 'react';
import { HeroSection } from './components/HeroSection';
import { ScannerInput } from './components/ScannerInput';
import { SourceAnalyzer } from './components/SourceAnalyzer';
import { ScanResults } from './components/ScanResults';
import { InstallGuide } from './components/InstallGuide';
import { LiveStats } from './components/LiveStats';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WhiteRabbitPage() {
  const [scanResults, setScanResults] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <HeroSection />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Live Stats */}
        <LiveStats />

        {/* Scanner Tabs */}
        <div className="mt-12">
          <Tabs defaultValue="contract" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
              <TabsTrigger value="contract" className="data-[state=active]:bg-zinc-800">
                🔍 Scan Contract
              </TabsTrigger>
              <TabsTrigger value="source" className="data-[state=active]:bg-zinc-800">
                📄 Analyze Source
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contract" className="mt-6">
              <ScannerInput 
                onScanStart={() => setIsScanning(true)}
                onScanComplete={(results) => {
                  setScanResults(results);
                  setIsScanning(false);
                }}
              />
            </TabsContent>

            <TabsContent value="source" className="mt-6">
              <SourceAnalyzer
                onAnalyzeStart={() => setIsScanning(true)}
                onAnalyzeComplete={(results) => {
                  setScanResults(results);
                  setIsScanning(false);
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Results */}
        {(scanResults || isScanning) && (
          <div className="mt-12">
            <ScanResults results={scanResults} isLoading={isScanning} />
          </div>
        )}

        {/* Install Guide */}
        <div className="mt-16">
          <InstallGuide />
        </div>
      </div>
    </div>
  );
}
