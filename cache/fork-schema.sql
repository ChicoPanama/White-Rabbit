-- WhiteRabbit Fork Hunter Database Schema
-- Specialized for hunting unpatched forks with inherited vulnerabilities

-- Fork relationships and genealogy
CREATE TABLE IF NOT EXISTS protocol_forks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_protocol TEXT NOT NULL,
    original_address TEXT,
    original_chain TEXT NOT NULL,
    fork_protocol TEXT NOT NULL,
    fork_address TEXT NOT NULL,
    fork_chain TEXT NOT NULL,
    fork_tvl REAL NOT NULL,
    fork_date TEXT, -- When fork was deployed
    similarity_score REAL, -- Code similarity 0.0-1.0
    confirmed_fork BOOLEAN DEFAULT FALSE,
    last_analyzed INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(original_protocol, fork_address, fork_chain)
);

-- Vulnerability inheritance tracking
CREATE TABLE IF NOT EXISTS vulnerability_inheritance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_protocol TEXT NOT NULL,
    original_vulnerability TEXT NOT NULL, -- Reference to known hack/vuln
    original_patch_date TEXT, -- When original was patched
    fork_address TEXT NOT NULL,
    fork_chain TEXT NOT NULL,
    vulnerability_inherited BOOLEAN NOT NULL, -- Still has the vuln?
    patch_status TEXT NOT NULL, -- 'unpatched', 'patched', 'unknown'
    confidence REAL NOT NULL, -- 0.0-1.0
    exploitable_value REAL, -- Estimated exploit value
    last_checked INTEGER NOT NULL,
    FOREIGN KEY (fork_address, fork_chain) REFERENCES protocol_forks(fork_address, fork_chain)
);

-- Fork deployment tracking
CREATE TABLE IF NOT EXISTS fork_deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_address TEXT NOT NULL,
    chain TEXT NOT NULL,
    deployer_address TEXT,
    block_number INTEGER,
    deploy_date TEXT,
    constructor_args TEXT, -- JSON blob
    source_verified BOOLEAN DEFAULT FALSE,
    tvl_at_discovery REAL,
    current_tvl REAL,
    days_since_deploy INTEGER,
    last_updated INTEGER NOT NULL,
    UNIQUE(contract_address, chain)
);

-- Code similarity analysis
CREATE TABLE IF NOT EXISTS code_similarity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address_a TEXT NOT NULL,
    chain_a TEXT NOT NULL,
    address_b TEXT NOT NULL,
    chain_b TEXT NOT NULL,
    similarity_score REAL NOT NULL, -- 0.0-1.0
    analysis_method TEXT NOT NULL, -- 'bytecode', 'source', 'abi'
    matching_functions INTEGER,
    total_functions INTEGER,
    critical_functions_match BOOLEAN, -- Do vulnerable functions match?
    analysis_date INTEGER NOT NULL,
    UNIQUE(address_a, chain_a, address_b, chain_b, analysis_method)
);

-- Patch analysis results
CREATE TABLE IF NOT EXISTS patch_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_address TEXT NOT NULL,
    original_chain TEXT NOT NULL,
    fork_address TEXT NOT NULL,
    fork_chain TEXT NOT NULL,
    vulnerability_pattern TEXT NOT NULL,
    original_has_patch BOOLEAN NOT NULL,
    fork_has_patch BOOLEAN NOT NULL,
    patch_difference TEXT, -- Description of what's missing
    risk_level TEXT NOT NULL, -- 'critical', 'high', 'medium', 'low'
    estimated_exploitable_tvl REAL,
    analysis_date INTEGER NOT NULL
);

-- TVL sweet spot tracking (optimal fork targets)
CREATE TABLE IF NOT EXISTS tvl_sweet_spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain TEXT NOT NULL,
    protocol_address TEXT NOT NULL,
    protocol_name TEXT,
    current_tvl REAL NOT NULL,
    tvl_category TEXT NOT NULL, -- 'micro', 'small', 'medium', 'large', 'whale'
    security_score INTEGER, -- Estimated security 0-100 (lower = more vulnerable)
    audit_count INTEGER DEFAULT 0,
    bounty_program BOOLEAN DEFAULT FALSE,
    team_size_estimate INTEGER,
    deployment_age_days INTEGER,
    fork_likelihood REAL, -- 0.0-1.0 probability this is a fork
    hunt_priority INTEGER, -- 1-10 priority score for hunting
    last_updated INTEGER NOT NULL
);

-- Fork hunt targets (curated list)
CREATE TABLE IF NOT EXISTS hunt_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_address TEXT NOT NULL,
    target_chain TEXT NOT NULL,
    target_name TEXT,
    target_tvl REAL NOT NULL,
    suspected_original TEXT, -- What protocol this might be a fork of
    vulnerability_candidates TEXT, -- JSON array of inherited vulns
    hunt_status TEXT DEFAULT 'queued', -- 'queued', 'analyzing', 'vulnerable', 'safe', 'error'
    priority_score INTEGER NOT NULL, -- 1-100
    estimated_exploit_value REAL,
    analysis_started INTEGER,
    analysis_completed INTEGER,
    findings_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(target_address, target_chain)
);

-- Known fork patterns (for detection)
CREATE TABLE IF NOT EXISTS fork_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_name TEXT NOT NULL,
    original_protocol TEXT NOT NULL,
    detection_method TEXT NOT NULL, -- 'bytecode', 'abi', 'events', 'function_sigs'
    pattern_signature TEXT NOT NULL, -- The actual signature to match
    confidence_weight REAL NOT NULL, -- How much this pattern contributes to fork detection
    false_positive_rate REAL, -- Historical FP rate for this pattern
    description TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(pattern_name, original_protocol, detection_method)
);

-- Indexes for fork hunting performance
CREATE INDEX IF NOT EXISTS idx_forks_tvl_range ON protocol_forks(fork_tvl) WHERE fork_tvl BETWEEN 100000 AND 10000000;
CREATE INDEX IF NOT EXISTS idx_forks_chain_address ON protocol_forks(fork_chain, fork_address);
CREATE INDEX IF NOT EXISTS idx_inheritance_unpatched ON vulnerability_inheritance(patch_status) WHERE patch_status = 'unpatched';
CREATE INDEX IF NOT EXISTS idx_hunt_targets_priority ON hunt_targets(priority_score DESC, hunt_status);
CREATE INDEX IF NOT EXISTS idx_hunt_targets_queued ON hunt_targets(hunt_status) WHERE hunt_status = 'queued';
CREATE INDEX IF NOT EXISTS idx_sweet_spots_priority ON tvl_sweet_spots(hunt_priority DESC, fork_likelihood DESC);

-- Views for fork hunting queries
CREATE VIEW IF NOT EXISTS high_priority_targets AS
SELECT 
    ht.target_address,
    ht.target_chain,
    ht.target_name,
    ht.target_tvl,
    ht.suspected_original,
    ht.priority_score,
    ht.estimated_exploit_value,
    pf.similarity_score,
    vi.vulnerability_inherited,
    vi.patch_status
FROM hunt_targets ht
LEFT JOIN protocol_forks pf ON ht.target_address = pf.fork_address AND ht.target_chain = pf.fork_chain
LEFT JOIN vulnerability_inheritance vi ON ht.target_address = vi.fork_address AND ht.target_chain = vi.fork_chain
WHERE ht.hunt_status = 'queued' AND ht.priority_score >= 70
ORDER BY ht.priority_score DESC, ht.estimated_exploit_value DESC;

CREATE VIEW IF NOT EXISTS unpatched_forks AS
SELECT 
    pf.fork_protocol,
    pf.fork_address,
    pf.fork_chain,
    pf.fork_tvl,
    vi.original_vulnerability,
    vi.patch_status,
    vi.exploitable_value,
    vi.confidence
FROM protocol_forks pf
JOIN vulnerability_inheritance vi ON pf.fork_address = vi.fork_address AND pf.fork_chain = vi.fork_chain
WHERE vi.patch_status = 'unpatched' AND vi.confidence >= 0.8 AND pf.fork_tvl BETWEEN 100000 AND 50000000
ORDER BY vi.exploitable_value DESC;

CREATE VIEW IF NOT EXISTS fork_statistics AS
SELECT 
    original_protocol,
    COUNT(*) as total_forks,
    COUNT(CASE WHEN fork_tvl BETWEEN 100000 AND 10000000 THEN 1 END) as sweet_spot_forks,
    AVG(fork_tvl) as avg_fork_tvl,
    SUM(CASE WHEN vi.patch_status = 'unpatched' THEN 1 ELSE 0 END) as unpatched_forks,
    SUM(CASE WHEN vi.patch_status = 'unpatched' THEN vi.exploitable_value ELSE 0 END) as total_unpatched_value
FROM protocol_forks pf
LEFT JOIN vulnerability_inheritance vi ON pf.fork_address = vi.fork_address AND pf.fork_chain = vi.fork_chain
GROUP BY original_protocol
ORDER BY total_unpatched_value DESC;