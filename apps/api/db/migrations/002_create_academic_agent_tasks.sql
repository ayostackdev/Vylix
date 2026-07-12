CREATE TABLE IF NOT EXISTS academic_agent_tasks (
    id UUID PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    course_code TEXT NOT NULL,
    user_prompt TEXT NOT NULL,
    task_tier TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'PENDING',
    result TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_task_id
    ON academic_agent_tasks (task_id);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_id
    ON academic_agent_tasks (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status
    ON academic_agent_tasks (status);
