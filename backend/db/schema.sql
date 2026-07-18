
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

-- "Created By" filter support (additive, non-destructive). Nullable — existing
-- tasks predate this column and have no recorded creator; new tasks always set it.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

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

-- ---------------------------------------------------------------------------
-- Organizations & permissions (additive, non-destructive).
--
-- The tenant boundary this app never had. `memberships` is the user<->org<->role
-- join; role is a fixed 6-value set (owner/admin/manager/member/guest/bot), not
-- user-customizable — same free-text-with-JS-validation convention as
-- meetings.type, just constrained at the DB level too since this one is
-- security-load-bearing. `projects` and `meetings` carry organization_id
-- directly; `tasks` resolve their org via their project (no redundant column
-- to go stale). See docs/ENTERPRISE_PLAN_V2.md for the full design.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'guest', 'bot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(organization_id);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS login_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip VARCHAR(64),
  user_agent VARCHAR(512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id, created_at DESC);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_organization ON meetings(organization_id);

-- Backfill: one default organization for everything that predates this table.
-- The earliest-registered user becomes Owner (every org needs exactly one);
-- every other EXISTING user becomes Admin, preserving today's de facto
-- behavior (this app has never distinguished user privilege server-side, so
-- demoting existing accounts to Member would silently take capabilities away
-- from real accounts already using this system). New accounts going forward
-- default to Member (see auth.service.js) — this is the new normal, only
-- existing accounts get the one-time Admin grandfather.
DO $$
DECLARE
  default_org_id INTEGER;
  owner_user_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations) THEN
    INSERT INTO organizations (name) VALUES ('Default Organization') RETURNING id INTO default_org_id;

    SELECT id INTO owner_user_id FROM users ORDER BY id ASC LIMIT 1;

    IF owner_user_id IS NOT NULL THEN
      INSERT INTO memberships (organization_id, user_id, role)
      SELECT default_org_id, id, CASE WHEN id = owner_user_id THEN 'owner' ELSE 'admin' END
      FROM users
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;

    UPDATE projects SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE meetings SET organization_id = default_org_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Admin panel, Phase B (additive, non-destructive).
-- ---------------------------------------------------------------------------

-- Suspension + force-logout. token_version is bumped to instantly invalidate
-- every JWT issued before the bump (requireAuth checks it on every request) —
-- the workaround for having no session table with a purely stateless JWT.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Org-level settings (name already exists; this is for everything else the
-- Settings admin section needs — kept schemaless since what belongs here is
-- still an open question, not because the data is unstructured by nature).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Real project archive/delete (previously client-only-fake). Archived projects
-- stay in place (nothing cascades) — only DELETE actually removes rows.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(organization_id, archived);

-- ---------------------------------------------------------------------------
-- Task system, Phase D (additive, non-destructive). Subtasks, checklists,
-- comments, tags, and dependencies — previously client-only in tasksSlice /
-- commentsSlice, now real rows. Attachments deliberately excluded (needs a
-- file storage decision, see docs/ENTERPRISE_PLAN_V2.md). Activity history
-- reuses the existing audit_log table (target_type='task') rather than a
-- parallel table — see backend/src/modules/activity.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subtasks (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (priority IN ('urgent', 'high', 'normal', 'low', 'none')),
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

CREATE TABLE IF NOT EXISTS checklists (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklists_task ON checklists(task_id);

CREATE TABLE IF NOT EXISTS checklist_items (
  id SERIAL PRIMARY KEY,
  checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(16) NOT NULL,
  PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  hue INTEGER NOT NULL DEFAULT 210,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, label)
);
CREATE INDEX IF NOT EXISTS idx_tags_org ON tags(organization_id);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('blocks', 'blocked_by', 'relates_to')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, depends_on_task_id, type)
);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);

-- ---------------------------------------------------------------------------
-- Meeting Bot deployment (additive, non-destructive).
-- deployed_at on meetings is the quick status flag; meeting_deployments keeps
-- the actual context SNAPSHOT at deploy time (which can differ from whatever
-- meeting_context_packages holds later if the context is regenerated after
-- deploying) — same one-row-per-meeting upsert convention as that table.
-- ---------------------------------------------------------------------------

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS meeting_deployments (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB NOT NULL
);

-- ---------------------------------------------------------------------------
-- Email delivery tracking (additive, non-destructive).
-- Every invite/cancellation/resend send attempt gets its own row here — never
-- overwritten, so a recipient's history survives a resend. `status` walks
-- pending -> sending -> sent|failed. `delivered` exists in the enum for a
-- future webhook-capable provider (Resend/SendGrid/etc) but EmailJS has no
-- delivery webhook, so this code never writes it — `sent` (provider accepted
-- the request) is the highest state this integration can honestly claim.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'emailjs',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | sending | sent | delivered | failed
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_meeting ON email_logs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(meeting_id, recipient_email, created_at DESC);

-- ---------------------------------------------------------------------------
-- Meeting results (additive, non-destructive).
-- The transcript + AI summary produced by the external Meeting Bot once a call
-- ends. The bot service stores these only in memory (lost on its restart), so
-- we persist a copy here the first time it reports the meeting ended — that is
-- what lets "View meeting details" show the summary again later. One row per
-- meeting, upserted, same convention as meeting_context_packages.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS meeting_results (
  meeting_id INTEGER PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
  summary TEXT,
  transcript TEXT,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
