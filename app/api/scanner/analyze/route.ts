// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/scanner/analyze - Synchronous source code analysis
// ═══════════════════════════════════════════════════════════════════════════════

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const analyzeRequestSchema = z.object({
  source_code: z.string().min(1).max(500000),
  compiler_version: z.string().default('0.8.19'),
  contract_name: z.string().optional(),
  min_severity: z.enum(['critical', 'high', 'medium', 'low']).default('low'),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    const body = await request.json();
    const validated = analyzeRequestSchema.parse(body);

    // Check rate limit for logged in users
    if (user) {
      const { data: rateLimitOk } = await supabase.rpc(
        'check_scanner_rate_limit',
        { p_user_id: user.id, p_job_type: 'analyze' }
      );

      if (!rateLimitOk) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
    }

    // Run analysis
    const findings = await analyzeSourceCode(validated);
    const duration = Date.now() - startTime;

    // Log if user is logged in
    if (user) {
      await supabase.from('scanner_jobs').insert({
        user_id: user.id,
        job_type: 'analyze',
        target: {
          source_code_length: validated.source_code.length,
          compiler_version: validated.compiler_version,
        },
        status: 'completed',
        findings,
        findings_count: findings.length,
        duration_ms: duration,
        source: 'web',
      });
      
      await supabase.rpc('complete_scanner_job', { p_user_id: user.id });
    }

    return NextResponse.json({
      status: 'completed',
      duration_ms: duration,
      findings,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}

async function analyzeSourceCode(params: z.infer<typeof analyzeRequestSchema>) {
  const { source_code, min_severity } = params;
  const findings: Array<{
    title: string;
    severity: string;
    description: string;
    line_start: number;
    code_snippet: string;
  }> = [];
  
  const lines = source_code.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes('tx.origin')) {
      findings.push({
        title: 'tx.origin Authorization',
        severity: 'high',
        description: 'Using tx.origin is vulnerable to phishing',
        line_start: index + 1,
        code_snippet: line.trim(),
      });
    }
    
    if (line.includes('selfdestruct')) {
      findings.push({
        title: 'Selfdestruct',
        severity: 'high',
        description: 'Contract can be destroyed',
        line_start: index + 1,
        code_snippet: line.trim(),
      });
    }
  });
  
  const severityOrder: Record<string, number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  };
  
  return findings.filter(f => severityOrder[f.severity] >= severityOrder[min_severity]);
}
