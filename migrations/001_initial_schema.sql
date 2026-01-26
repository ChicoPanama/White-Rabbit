CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    name VARCHAR(255),
    source_code TEXT,
    abi JSONB,
    compiler_version VARCHAR(50),
    is_proxy BOOLEAN DEFAULT FALSE,
    implementation_address VARCHAR(42),
    tvl_usd NUMERIC(20, 2),
    protocol_name VARCHAR(255),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(address, chain_id)
);

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    tools_used TEXT[] DEFAULT '{}',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    detector_name VARCHAR(100) NOT NULL,
    tool VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    confidence VARCHAR(20) NOT NULL DEFAULT 'medium',
    title VARCHAR(500),
    description TEXT NOT NULL,
    code_snippet TEXT,
    file_path VARCHAR(500),
    line_start INTEGER,
    line_end INTEGER,
    ai_assessment TEXT,
    ai_is_false_positive BOOLEAN,
    deduplicated_group_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'telegram',
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    message_hash VARCHAR(64) NOT NULL,
    telegram_message_id BIGINT,
    UNIQUE(message_hash, channel)
);

CREATE INDEX idx_contracts_chain ON contracts(chain_id);
CREATE INDEX idx_contracts_address ON contracts(address);
CREATE INDEX idx_scans_contract ON scans(contract_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_findings_scan ON findings(scan_id);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_contract ON findings(contract_id);
CREATE INDEX idx_findings_dedup ON findings(deduplicated_group_id);
CREATE INDEX idx_notifications_sent ON notifications(sent_at);
CREATE INDEX idx_notifications_hash ON notifications(message_hash);
