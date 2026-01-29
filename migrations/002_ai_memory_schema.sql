-- Migration: AI Memory + Caching Layer
-- This adds tables for durable AI memory, prompt-hash caching, and contract tagging

-- ══════════════════════════════════════════════════════════════════════════════
-- AI RUNS: Store all AI API calls with prompt hashing for deduplication
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_hash TEXT UNIQUE NOT NULL,          -- SHA-256 of normalized prompt JSON
    model TEXT NOT NULL,                        -- e.g., 'claude-haiku-4-5-20251001'
    input_json JSONB NOT NULL,                  -- Normalized prompt input
    output_json JSONB NOT NULL,                 -- AI response
    status TEXT NOT NULL DEFAULT 'ok',          -- 'ok' | 'error'
    error_text TEXT,                            -- Error message if status='error'
    tokens_in INTEGER,                          -- Input tokens
    tokens_out INTEGER,                         -- Output tokens
    cost_usd NUMERIC(10, 6),                    -- Estimated cost
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- FINDING AI LINKS: Link AI runs to specific findings (chain+address+finding)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS finding_ai_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ai_run_id UUID NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
    chain TEXT NOT NULL,                        -- e.g., 'ethereum', 'base'
    address TEXT NOT NULL,                      -- Contract address (lowercase)
    finding_hash TEXT NOT NULL,                 -- SHA-256 of finding context
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(chain, address, finding_hash)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- CONTRACT TAGS: Flexible key-value metadata for contracts
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contract_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain TEXT NOT NULL,
    address TEXT NOT NULL,                      -- Contract address (lowercase)
    tag TEXT NOT NULL,                          -- Tag key (e.g., 'audited', 'high_risk', 'last_scan')
    value TEXT,                                 -- Optional tag value
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(chain, address, tag)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES for efficient lookups
-- ══════════════════════════════════════════════════════════════════════════════

-- AI runs by prompt hash (primary lookup for cache hits)
CREATE INDEX IF NOT EXISTS idx_ai_runs_prompt_hash ON ai_runs(prompt_hash);

-- AI runs by creation time (for cleanup/analytics)
CREATE INDEX IF NOT EXISTS idx_ai_runs_created_at ON ai_runs(created_at);

-- AI runs by model (for cost analysis)
CREATE INDEX IF NOT EXISTS idx_ai_runs_model ON ai_runs(model);

-- Finding links by chain+address (memory bundle lookup)
CREATE INDEX IF NOT EXISTS idx_finding_ai_links_chain_address ON finding_ai_links(chain, address);

-- Finding links by ai_run_id (for cascade operations)
CREATE INDEX IF NOT EXISTS idx_finding_ai_links_ai_run ON finding_ai_links(ai_run_id);

-- Contract tags by chain+address (memory bundle lookup)
CREATE INDEX IF NOT EXISTS idx_contract_tags_chain_address ON contract_tags(chain, address);

-- Contract tags by tag name (for filtering)
CREATE INDEX IF NOT EXISTS idx_contract_tags_tag ON contract_tags(tag);
