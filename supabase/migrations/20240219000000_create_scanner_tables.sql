-- ═══════════════════════════════════════════════════════════════════════════════
-- White-Rabbit Scanner Tables
-- Server-side scan job queue and analytics
-- ═══════════════════════════════════════════════════════════════════════════════

-- Scanner jobs table - queued scan operations
CREATE TABLE IF NOT EXISTS scanner_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Job configuration
    job_type        text NOT NULL CHECK (job_type IN ('scan', 'analyze', 'verify', 'hunt')),
    target          jsonb NOT NULL,
    -- { address, chain, depth, source_code, compiler_version, etc. }
    
    -- Job status
    status          text DEFAULT 'queued' CHECK (status IN (
        'queued', 'pending', 'running', 'completed', 'failed', 'cancelled'
    )),
    progress        integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Results
    findings        jsonb DEFAULT '[]'::jsonb,
    findings_count  integer DEFAULT 0,
    engines_used    text[] DEFAULT '{}',
    
    -- Timing
    created_at      timestamptz DEFAULT now(),
    started_at      timestamptz,
    completed_at    timestamptz,
    duration_ms     integer,
    
    -- Error handling
    error           text,
    retry_count     integer DEFAULT 0,
    max_retries     integer DEFAULT 3,
    
    -- Source tracking
    source          text DEFAULT 'api' CHECK (source IN ('api', 'mcp', 'web', 'cli')),
    ip_address      inet,
    user_agent      text,
    
    -- Cost tracking (for rate limiting/billing)
    estimated_cost  numeric(10,6),
    actual_cost     numeric(10,6),
    
    -- Metadata
    metadata        jsonb DEFAULT '{}'::jsonb
);

-- Indexes for scanner_jobs
CREATE INDEX IF NOT EXISTS idx_scanner_jobs_user ON scanner_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scanner_jobs_status ON scanner_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scanner_jobs_created ON scanner_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_jobs_type ON scanner_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scanner_jobs_user_status ON scanner_jobs(user_id, status);

-- Scanner analytics table - aggregated statistics
CREATE TABLE IF NOT EXISTS scanner_analytics (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period          text NOT NULL, -- '2024-02', '2024-W08', 'daily:2024-02-19'
    period_type     text NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    
    -- Scan metrics
    total_scans     integer DEFAULT 0,
    unique_scanners integer DEFAULT 0,
    avg_duration_ms integer,
    
    -- Finding metrics
    findings_generated  integer DEFAULT 0,
    findings_submitted  integer DEFAULT 0,
    findings_accepted   integer DEFAULT 0,
    
    -- Engine usage stats
    engines_usage   jsonb DEFAULT '{}'::jsonb, -- { slither: 100, pattern: 200, ... }
    
    -- Chain distribution
    top_chains      jsonb DEFAULT '[]'::jsonb, -- [{ chain: 'ethereum', count: 100 }, ...]
    
    -- Protocol distribution
    top_protocols   jsonb DEFAULT '[]'::jsonb, -- [{ protocol: 'aave', count: 50 }, ...]
    
    -- Updated timestamp
    updated_at      timestamptz DEFAULT now(),
    
    UNIQUE(period)
);

CREATE INDEX IF NOT EXISTS idx_scanner_analytics_period ON scanner_analytics(period);
CREATE INDEX IF NOT EXISTS idx_scanner_analytics_type ON scanner_analytics(period_type);

-- Scanner rate limits per user
CREATE TABLE IF NOT EXISTS scanner_rate_limits (
    user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Daily limits
    scans_today     integer DEFAULT 0,
    scans_day_limit integer DEFAULT 100,
    day_reset_at    timestamptz DEFAULT now(),
    
    -- Concurrent limits
    active_jobs     integer DEFAULT 0,
    max_concurrent  integer DEFAULT 3,
    
    -- Cost limits (if implementing paid tiers)
    cost_today      numeric(10,6) DEFAULT 0,
    cost_day_limit  numeric(10,6) DEFAULT 10.00,
    
    -- Burst limits for quick scans
    quick_scans_hour integer DEFAULT 0,
    quick_hour_limit integer DEFAULT 50,
    hour_reset_at    timestamptz DEFAULT now(),
    
    updated_at      timestamptz DEFAULT now()
);

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_scanner_rate_limit(
    p_user_id uuid,
    p_job_type text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record scanner_rate_limits%ROWTYPE;
    v_now timestamptz := now();
BEGIN
    -- Get or create rate limit record
    SELECT * INTO v_record
    FROM scanner_rate_limits
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO scanner_rate_limits (user_id)
        VALUES (p_user_id)
        RETURNING * INTO v_record;
    END IF;
    
    -- Reset daily counters if needed
    IF v_record.day_reset_at < date_trunc('day', v_now) THEN
        v_record.scans_today := 0;
        v_record.cost_today := 0;
        v_record.day_reset_at := v_now;
    END IF;
    
    -- Reset hourly counters if needed
    IF v_record.hour_reset_at < date_trunc('hour', v_now) THEN
        v_record.quick_scans_hour := 0;
        v_record.hour_reset_at := v_now;
    END IF;
    
    -- Check limits
    IF v_record.scans_today >= v_record.scans_day_limit THEN
        RETURN false;
    END IF;
    
    IF v_record.active_jobs >= v_record.max_concurrent THEN
        RETURN false;
    END IF;
    
    -- Update counters
    UPDATE scanner_rate_limits
    SET 
        scans_today = scans_today + 1,
        active_jobs = active_jobs + 1,
        quick_scans_hour = CASE WHEN p_job_type = 'scan' THEN quick_scans_hour + 1 ELSE quick_scans_hour END,
        day_reset_at = v_record.day_reset_at,
        hour_reset_at = v_record.hour_reset_at,
        updated_at = v_now
    WHERE user_id = p_user_id;
    
    RETURN true;
END;
$$;

-- Function to mark job completion (decrements active_jobs)
CREATE OR REPLACE FUNCTION complete_scanner_job(
    p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE scanner_rate_limits
    SET 
        active_jobs = GREATEST(0, active_jobs - 1),
        updated_at = now()
    WHERE user_id = p_user_id;
END;
$$;

-- Row Level Security policies
ALTER TABLE scanner_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY scanner_jobs_user_isolation ON scanner_jobs
    FOR ALL
    USING (auth.uid() = user_id);

-- Analytics are public (aggregated data)
CREATE POLICY scanner_analytics_public ON scanner_analytics
    FOR SELECT
    USING (true);

-- Rate limits are user-private
CREATE POLICY scanner_rate_limits_user_isolation ON scanner_rate_limits
    FOR ALL
    USING (auth.uid() = user_id);

-- Function to update analytics
CREATE OR REPLACE FUNCTION update_scanner_analytics(
    p_period_type text,
    p_job_type text,
    p_chain text,
    p_protocol text,
    p_engines text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period text;
    v_now timestamptz := now();
BEGIN
    -- Determine period string
    v_period := CASE p_period_type
        WHEN 'daily' THEN to_char(v_now, 'YYYY-MM-DD')
        WHEN 'weekly' THEN to_char(v_now, 'IYYY') || '-W' || to_char(v_now, 'IW')
        WHEN 'monthly' THEN to_char(v_now, 'YYYY-MM')
    END;
    
    -- Upsert analytics
    INSERT INTO scanner_analytics (
        period, period_type, total_scans
    )
    VALUES (v_period, p_period_type, 1)
    ON CONFLICT (period) 
    DO UPDATE SET
        total_scans = scanner_analytics.total_scans + 1,
        updated_at = v_now;
    
    -- Update engine usage
    UPDATE scanner_analytics
    SET engines_usage = engines_usage || jsonb_build_object(
        (SELECT string_agg(e, ',') FROM unnest(p_engines) e),
        COALESCE((engines_usage->>(SELECT string_agg(e, ',') FROM unnest(p_engines) e))::int, 0) + 1
    )
    WHERE period = v_period;
END;
$$;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scanner_analytics_updated_at
    BEFORE UPDATE ON scanner_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scanner_rate_limits_updated_at
    BEFORE UPDATE ON scanner_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE scanner_jobs IS 'Queued scan jobs for White-Rabbit scanner';
COMMENT ON TABLE scanner_analytics IS 'Aggregated scanner usage statistics';
COMMENT ON TABLE scanner_rate_limits IS 'Per-user rate limiting for scanner usage';
