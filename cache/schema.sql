-- WhiteRabbit Cache Database Schema
-- Optimized for smart contract vulnerability scanning performance

-- Protocol Discovery Cache - reduces DefiLlama API calls by 90%+
CREATE TABLE IF NOT EXISTS protocols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    tvl REAL NOT NULL,
    category TEXT,
    website TEXT,
    last_updated INTEGER NOT NULL, -- Unix timestamp
    scan_count INTEGER DEFAULT 0,
    first_discovered INTEGER NOT NULL,
    UNIQUE(chain, address, name)
);

-- Contract Analysis Cache - eliminates redundant static analysis 
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    chain TEXT NOT NULL,
    bytecode_hash TEXT NOT NULL,
    source_verified BOOLEAN DEFAULT FALSE,
    source_code TEXT,
    compiler_version TEXT,
    last_analyzed INTEGER NOT NULL,
    analysis_results TEXT, -- JSON blob of Slither + AI results
    vulnerability_count INTEGER DEFAULT 0,
    risk_score INTEGER DEFAULT 0, -- 0-100
    exploitable_value REAL DEFAULT 0,
    UNIQUE(address, chain)
);

-- Vulnerability Pattern Cache - learns from FPs and real exploits
CREATE TABLE IF NOT EXISTS patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_hash TEXT UNIQUE NOT NULL,
    detector_name TEXT NOT NULL,
    pattern_type TEXT NOT NULL, -- 'vulnerability', 'false_positive', 'exploit'
    confidence REAL NOT NULL, -- 0.0-1.0
    false_positive_rate REAL DEFAULT 0.0,
    severity TEXT, -- 'critical', 'high', 'medium', 'low'
    description TEXT,
    examples TEXT, -- JSON array of contract addresses
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
);

-- Scan History & Results - tracks all hunting activities
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    scan_type TEXT NOT NULL, -- 'autonomous', 'targeted', 'audit'
    chain TEXT NOT NULL,
    protocol_name TEXT,
    contract_address TEXT,
    findings_count INTEGER DEFAULT 0,
    verified_findings INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    exploitable_value REAL DEFAULT 0,
    status TEXT NOT NULL, -- 'completed', 'failed', 'in_progress'
    execution_time REAL, -- seconds
    notes TEXT,
    FOREIGN KEY (contract_address, chain) REFERENCES contracts(address, chain)
);

-- RPC Response Cache - eliminates redundant blockchain calls
CREATE TABLE IF NOT EXISTS rpc_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    params_hash TEXT NOT NULL, -- SHA256 of params
    response TEXT NOT NULL, -- JSON response
    ttl INTEGER NOT NULL, -- Unix timestamp when expires
    last_hit INTEGER NOT NULL,
    hit_count INTEGER DEFAULT 1,
    UNIQUE(chain, method, params_hash)
);

-- Hack Database - structured version of raw-hacks.json
CREATE TABLE IF NOT EXISTS known_hacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    chain TEXT,
    protocol TEXT,
    target_address TEXT,
    exploit_type TEXT, -- 'flash_loan', 'reentrancy', 'oracle', etc
    loss_amount REAL, -- USD value
    tx_hash TEXT,
    description TEXT,
    technique_hash TEXT, -- For pattern matching
    created_at INTEGER NOT NULL
);

-- Performance Metrics - tracks cache effectiveness
CREATE TABLE IF NOT EXISTS cache_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    cache_type TEXT NOT NULL, -- 'protocol', 'contract', 'rpc', 'pattern'
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    hit_rate REAL GENERATED ALWAYS AS (CAST(hits AS REAL) / NULLIF(hits + misses, 0)) STORED,
    avg_response_time REAL, -- milliseconds
    total_requests INTEGER GENERATED ALWAYS AS (hits + misses) STORED,
    UNIQUE(timestamp, cache_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_protocols_chain_tvl ON protocols(chain, tvl DESC);
CREATE INDEX IF NOT EXISTS idx_protocols_last_updated ON protocols(last_updated);
CREATE INDEX IF NOT EXISTS idx_contracts_chain_address ON contracts(chain, address);
CREATE INDEX IF NOT EXISTS idx_contracts_last_analyzed ON contracts(last_analyzed);
CREATE INDEX IF NOT EXISTS idx_contracts_risk_score ON contracts(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_type_confidence ON patterns(pattern_type, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scans_chain_status ON scans(chain, status);
CREATE INDEX IF NOT EXISTS idx_rpc_cache_ttl ON rpc_cache(ttl);
CREATE INDEX IF NOT EXISTS idx_rpc_cache_chain_method ON rpc_cache(chain, method);
CREATE INDEX IF NOT EXISTS idx_hacks_chain_type ON known_hacks(chain, exploit_type);

-- Views for common queries
CREATE VIEW IF NOT EXISTS recent_findings AS
SELECT 
    s.timestamp,
    s.chain,
    s.protocol_name,
    s.contract_address,
    s.verified_findings,
    s.exploitable_value,
    c.risk_score
FROM scans s
LEFT JOIN contracts c ON s.contract_address = c.address AND s.chain = c.chain
WHERE s.verified_findings > 0
ORDER BY s.timestamp DESC;

CREATE VIEW IF NOT EXISTS cache_performance AS
SELECT 
    cache_type,
    SUM(hits) as total_hits,
    SUM(misses) as total_misses,
    ROUND(AVG(hit_rate) * 100, 2) as hit_rate_percent,
    ROUND(AVG(avg_response_time), 2) as avg_response_ms
FROM cache_metrics
WHERE timestamp > (strftime('%s', 'now') - 86400) -- Last 24 hours
GROUP BY cache_type;