-- Schema for rebuild experiments database
-- Note: Table is named "batches" but was previously "campaigns"

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    clang_version TEXT NOT NULL,
    series TEXT NOT NULL,
    builder_backend TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_batches_version_series ON batches(clang_version, series);
CREATE INDEX IF NOT EXISTS idx_batches_started ON batches(started_at);

CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    source_package TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL,
    build_duration_seconds REAL,
    peak_memory_mb INTEGER,
    disk_usage_mb INTEGER,
    build_log TEXT,
    compiler_invocations TEXT,
    submitted_at TEXT NOT NULL,
    completed_at TEXT,
    
    UNIQUE(batch_id, source_package)
);

CREATE INDEX IF NOT EXISTS idx_builds_batch ON builds(batch_id);
CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);
CREATE INDEX IF NOT EXISTS idx_builds_package ON builds(source_package);

CREATE TABLE IF NOT EXISTS build_findings (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL REFERENCES builds(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    line_number INTEGER
);

CREATE INDEX IF NOT EXISTS idx_findings_build ON build_findings(build_id);
CREATE INDEX IF NOT EXISTS idx_findings_category ON build_findings(category);

CREATE TABLE IF NOT EXISTS binary_metrics (
    id TEXT PRIMARY KEY,
    build_id TEXT NOT NULL REFERENCES builds(id),
    binary_name TEXT NOT NULL,
    deb_package TEXT NOT NULL,
    installed_size_kb INTEGER NOT NULL,
    text_section_bytes INTEGER,
    total_stripped_bytes INTEGER,
    symbol_count INTEGER
);

CREATE INDEX IF NOT EXISTS idx_metrics_build ON binary_metrics(build_id);
