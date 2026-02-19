// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/scanner/[id] - Get scan job status and results
// DELETE /api/scanner/[id] - Cancel a scan job
// ═══════════════════════════════════════════════════════════════════════════════

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get job status and results
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const jobId = params.id;

    // Fetch job
    const { data: job, error } = await supabase
      .from('scanner_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      
      console.error('Failed to fetch scan job:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scan job' },
        { status: 500 }
      );
    }

    // Return job info (filter out sensitive fields)
    return NextResponse.json({
      scan_id: job.id,
      job_type: job.job_type,
      status: job.status,
      progress: job.progress,
      target: job.target,
      findings: job.findings,
      findings_count: job.findings_count,
      engines_used: job.engines_used,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      duration_ms: job.duration_ms,
      error: job.error,
    });

  } catch (error) {
    console.error('Get scan job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const jobId = params.id;

    // Check if job exists and belongs to user
    const { data: job, error: fetchError } = await supabase
      .from('scanner_jobs')
      .select('status')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch job' },
        { status: 500 }
      );
    }

    // Can only cancel queued or pending jobs
    if (!['queued', 'pending'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Update job status
    const { error: updateError } = await supabase
      .from('scanner_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to cancel job:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel job' },
        { status: 500 }
      );
    }

    // Decrement rate limit
    await supabase.rpc('complete_scanner_job', { p_user_id: user.id });

    return NextResponse.json({
      scan_id: jobId,
      status: 'cancelled',
    });

  } catch (error) {
    console.error('Cancel scan job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
