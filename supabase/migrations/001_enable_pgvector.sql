-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Verify installation
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
