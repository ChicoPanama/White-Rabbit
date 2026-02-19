'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Shield, CheckCircle, FileText } from 'lucide-react';

interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  description: string;
  tool: string;
  line_start?: number;
  code_snippet?: string;
}

interface ScanResultsProps {
  results: {
    scan_id?: string;
    status: string;
    findings: Finding[];
    duration_ms?: number;
  } | null;
  isLoading: boolean;
}

export function ScanResults({ results, isLoading }: ScanResultsProps) {
  if (isLoading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-12">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">Scanning...</h3>
            <p className="text-zinc-400">This may take a few moments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!results) {
    return null;
  }

  const { findings, duration_ms } = results;

  // Group by severity
  const bySeverity: Record<string, Finding[]> = {};
  for (const finding of findings || []) {
    bySeverity[finding.severity] = bySeverity[finding.severity] || [];
    bySeverity[finding.severity].push(finding);
  }

  const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'low':
        return <Shield className="w-5 h-5 text-blue-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center">
            <FileText className="w-5 h-5 mr-2 text-orange-400" />
            Scan Results
          </CardTitle>
          {duration_ms && (
            <span className="text-zinc-500 text-sm">
              Duration: {(duration_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {findings.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white">No Vulnerabilities Found!</h3>
            <p className="text-zinc-400">This contract passed all security checks</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              {severityOrder.map((sev) => {
                const count = bySeverity[sev]?.length || 0;
                if (count === 0) return null;
                return (
                  <Badge
                    key={sev}
                    variant="outline"
                    className={`${getSeverityColor(sev)} capitalize`}
                  >
                    {sev}: {count}
                  </Badge>
                );
              })}
            </div>

            {/* Findings List */}
            <div className="space-y-4">
              {severityOrder.map((sev) => {
                const sevFindings = bySeverity[sev] || [];
                if (sevFindings.length === 0) return null;

                return (
                  <div key={sev}>
                    <h4 className="text-sm font-medium text-zinc-400 uppercase mb-3 capitalize">
                      {sev} Severity
                    </h4>
                    <div className="space-y-3">
                      {sevFindings.map((finding) => (
                        <Card
                          key={finding.id}
                          className="bg-zinc-950 border-zinc-800"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {getSeverityIcon(finding.severity)}
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-white mb-1">
                                  {finding.title}
                                </h5>
                                <p className="text-zinc-400 text-sm mb-2">
                                  {finding.description}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-zinc-500">
                                  <span className="bg-zinc-900 px-2 py-1 rounded">
                                    {finding.tool}
                                  </span>
                                  {finding.line_start && (
                                    <span>Line: {finding.line_start}</span>
                                  )}
                                </div>
                                {finding.code_snippet && (
                                  <pre className="mt-3 p-3 bg-zinc-900 rounded text-xs font-mono text-zinc-300 overflow-x-auto">
                                    {finding.code_snippet}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <Button variant="outline" className="border-zinc-700">
                Export JSON
              </Button>
              <Button variant="outline" className="border-zinc-700">
                Export SARIF
              </Button>
              <Button className="bg-gradient-to-r from-orange-500 to-pink-500 ml-auto">
                Submit to WhiteClaws
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
