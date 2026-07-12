CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY,
    filename TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    storage_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    content_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uploaded_files_created_at_idx
    ON uploaded_files (created_at DESC);