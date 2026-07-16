
-- Task Board v1 schema
-- Three tables: users, projects, tasks. Statuses are fixed to three values by design.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Postgres has no CREATE TYPE IF NOT EXISTS, so guard it with a DO block
-- to keep this script safely re-runnable.
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('To Do', 'In Progress', 'Done');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  status task_status NOT NULL DEFAULT 'To Do',
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- v2 migration: allow unlimited custom statuses.
-- Convert tasks.status from the fixed `task_status` enum to free text so any
-- user-defined status name (Backlog, Ready, Design, Review, Blocked, …) persists.
-- Idempotent and non-destructive: `USING status::text` preserves every existing
-- value, and the guard runs the conversion only while the column is still the enum.
-- The legacy three values keep working exactly as before; this only *widens* what
-- the column accepts. The now-unused `task_status` type is left in place (harmless).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'status' AND udt_name = 'task_status'
  ) THEN
    ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE tasks ALTER COLUMN status TYPE VARCHAR(60) USING status::text;
    ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'To Do';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Meeting Bot integration, Phase 1 (additive, non-destructive).
--
-- This is bolted onto the existing 3-table schema as-is — there is no
-- membership/roles table and no task-history ledger yet (see
-- docs/MEETING_BOT_ARCHITECTURE.md, Phase 0). Context packages built from
-- these tables can only reflect *current* task state, not "moved between
-- statuses" or "since last meeting"; meetings.service.js documents exactly
-- what is included and why.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  -- Free text, validated in JS against a fixed set (see meetings.service.js)
  -- — same convention as tasks.status.
  type VARCHAR(30) NOT NULL DEFAULT 'Custom',
  scheduled_at TIMESTAMPTZ NOT NULL,
  -- Admin-entered join link (Zoom/Meet/Teams/etc). Optional, included in invite emails.
  meeting_url VARCHAR(2048),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additive: meeting_url didn't exist in the initial Phase 1 meetings table.
-- Safe no-op on a fresh install (the CREATE TABLE above already includes it).
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_url VARCHAR(2048);

CREATE TABLE IF NOT EXISTS meeting_projects (
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, project_id)
);

CREATE TABLE IF NOT EXISTS meeting_participants (
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ,
  PRIMARY KEY (meeting_id, user_id)
);

-- One row per meeting: the most recently generated context package.
-- Regenerating overwrites it (UPSERT) rather than versioning history.
CREATE TABLE IF NOT EXISTS meeting_context_packages (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);
