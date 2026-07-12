-- Vylix Academic Hub Core Schema
-- pgvector with Inner Product proximity search + Row Level Security

-- 1. COURSES (synced from Google Drive folders)
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_folder_id TEXT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. DOCUMENTS (individual PDFs from Drive)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/pdf',
  size_bytes BIGINT DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. DOCUMENT_CHUNKS (text chunks with vector embeddings)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for Inner Product similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_ip
  ON document_chunks
  USING ivfflat (embedding vector_ip_ops)
  WITH (lists = 100);

-- 4. CHAT_HISTORY (AI Professor conversations)
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. STUDY_AGENT_TASKS (Study Agent checklist items)
CREATE TABLE IF NOT EXISTS study_agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_agent_tasks ENABLE ROW LEVEL SECURITY;

-- COURSES: users can only see their own courses
CREATE POLICY user_courses_select ON courses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_courses_insert ON courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_courses_update ON courses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_courses_delete ON courses
  FOR DELETE USING (auth.uid() = user_id);

-- DOCUMENTS: scoped to user + their courses
CREATE POLICY user_documents_select ON documents
  FOR SELECT USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM courses WHERE id = documents.course_id AND user_id = auth.uid())
  );

CREATE POLICY user_documents_insert ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_documents_delete ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- DOCUMENT_CHUNKS: scoped to user
CREATE POLICY user_chunks_select ON document_chunks
  FOR SELECT USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM courses WHERE id = document_chunks.course_id AND user_id = auth.uid())
  );

CREATE POLICY user_chunks_insert ON document_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_chunks_delete ON document_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- CHAT_HISTORY: users own their chat
CREATE POLICY user_chat_select ON chat_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_chat_insert ON chat_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_chat_delete ON chat_history
  FOR DELETE USING (auth.uid() = user_id);

-- STUDY_AGENT_TASKS: users own their tasks
CREATE POLICY user_tasks_select ON study_agent_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_tasks_insert ON study_agent_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_tasks_update ON study_agent_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_tasks_delete ON study_agent_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Match document chunks by vector similarity (Inner Product)
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  p_course_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  page_number INTEGER,
  course_id UUID,
  document_id UUID,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.page_number,
    dc.course_id,
    dc.document_id,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    (p_user_id IS NULL OR dc.user_id = p_user_id)
    AND (p_course_id IS NULL OR dc.course_id = p_course_id)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
