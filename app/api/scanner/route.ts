// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/scanner/scan - Queue a new scan job
// GET /api/scanner/scan - List user's scan jobs
// ═══════════════════════════════════════════════════════════════════════════════

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const scanRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  chain: z.string().default('ethereum'),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard'),
  engines: z.array(z.string()).optional(),
  callback_url: z.string().url().optional(),
});

const analyzeRequestSchema = z.object({
  source_code: z.string().min(1, 'Source code required'),
  compiler_version: z.string().default('0.8.19'),
  contract_name: z.string().optional(),
});

// POST /api/scanner/scan - Queue a scan
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse body
    const body = await request.json();
    
    // Determine job type
    const isAnalyzeRequest = body.source_code !== undefined;
    
    let validated;
    let jobType: string;
    let target: Record<string, unknown>;
    
    if (isAnalyzeRequest) {
      validated = analyzeRequestSchema.parse(body);
      jobType = 'analyze';
      target = {
        source_code: validated.source_code,
        compiler_version: validated.compiler_version,
        contract_name: validated.contract_name,
      };
    } else {
      validated = scanRequestSchema.parse(body);
      jobType = 'scan';
      target = {
        address: validated.address,
        chain: validated.chain,
        depth: validated.depth,
        engines: validated.engines,
      };
    }

    // Check rate limits
    const { data: rateLimitOk, error: rateError } = await supabase.rpc(
      'check_scanner_rate_limit',
      { p_user_id: user.id, p_job_type: jobType }
    );

    if (rateError || !rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Create job
    const { data: job, error } = await supabase
      .from('scanner_jobs')
      .insert({
        user_id: user.id,
        job_type: jobType,
        target,
        status: 'queued',
        source: 'api',
        ip_address: request.ip,
        user_agent: request.headers.get('user-agent'),
        metadata: {
          callback_url: body.callback_url,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create scan job:', error);
      return NextResponse.json(
        { error: 'Failed to queue scan job' },
        { status: 500 }
      );
    }

    // Return job info
    return NextResponse.json({
      scan_id: job.id,
      status: job.status,
      job_type: jobType,
      estimated_duration: estimatedDuration(jobType, target.depth as string),
      results_url: `${request.url}/${job.id}`,
    }, { status: 202 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Scan endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/scanner/scan - List user's jobs
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('scanner_jobs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('Failed to fetch scan jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scan jobs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      jobs,
      total: count,
      limit,
      offset,
    });

  } catch (error) {
    console.error('List scans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function estimatedDuration(jobType: string, depth?: string): number {
  if (jobType === 'analyze') {
    return 30; // 30 seconds for source analysis
  }
  
  switch (depth) {
    case 'quick':
      return 60; // 1 minute
    case 'standard':
      return 300; // 5 minutes
    case 'deep':
      return 1800; // 30 minutes
    default:
      return 300;
  }
}
