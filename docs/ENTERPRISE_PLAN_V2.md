# Kuberya Enterprise Plan v2

Companion to `docs/ENTERPRISE_AUDIT.md` (full current-state audit — still accurate on backend/security fundamentals, read that first) and `docs/ENTERPRISE_ROADMAP.md` (the prior Phase 3-8 design). This document: (1) what's changed since those were written, (2) a gap analysis against this session's specific target spec (Organization/Teams/Bot role/12-section admin/meeting routes/filters/AI), (3) a file-by-file implementation plan, (4) risks. **Nothing in this document has been implemented.** Per your explicit instruction, implementation starts only after you approve a phase below.

**Resolved conflict**: your ADMIN PANEL spec asks for a 12-section standalone `/admin` module. Two turns ago you had me delete `/admin` entirely and distribute its capabilities into the People page + sidebar. You've now confirmed: **rebuild `/admin` as a full 12-section module, server-backed this time** (not the old client-only version). The plan below reflects that.

---

## 1. What changed since `ENTERPRISE_AUDIT.md` (2026-07-16)

All backend/security findings in that audit are **unchanged and still accurate** — no auth model, single-tenant, IDOR everywhere, still true today. What moved, all client-side:

- **`/admin` was deleted**, then just now un-deleted-by-decision above. Its old capabilities (Users, Teams, Projects archive/delete, Tasks bulk-edit, Security audit log, System status) currently live: Users+Teams on `/people`, Projects archive/delete in the sidebar list menu, Tasks-bulk/Security/System **nowhere** (dropped when `/admin` was removed — need rebuilding).
- **Task module upgraded** (all client-only, no backend change): subtasks now have status/priority/due-date/assignee; filters gained status/sprint/real due-date-range (assignee/priority/labels already existed); saved views (new); a minimal client-only Sprint entity (assignable, filterable — no dates/board/burndown); WIP limits per status; a per-column "⋯" settings menu on the board (rename/recolor/move/archive/delete); status columns are now drag-reorderable (dnd-kit); quick-add gained inline assignee/due/priority.
- **Meeting context payload reshaped**: `GET/POST /api/meetings/:id/context` now returns a flat structure — `meeting`, `participants`, `projects`, `assignedTasks`, `completedTasks`, `activeTasks`, `overdueTasks`, `deadlines` — built specifically as a Meeting Bot data feed (no AI-generated content, per your standing rule).
- **Popover/dropdown overflow fixed app-wide** (Radix collision-padding + viewport-capped width/height).
- **Realtime broadcasting extended**: task changes and status-set edits now sync live across tabs/users via the existing socket bus (still not permission-scoped — anyone connected sees everything, consistent with the no-authz finding above).

---

## 2. Gap analysis vs. this session's target spec

### 2a. Hierarchy

Target: `Organization → {Teams, Users, Workspaces} → Spaces → Folders → Lists → Tasks → Subtasks → Checklists → Comments`

| Level | Current state |
|---|---|
| Organization | **Absent.** No tenant boundary anywhere (confirmed in prior audit — unchanged). |
| Teams | Client-only (`orgSlice.teams`), now on `/people`, open to all users. No backend table. |
| Users | Real (`users` table), but flat — no org membership. |
| Workspace → Space → Folder → List | Client-only cosmetic tree (`hierarchySlice`) over real `projects` (List = project). |
| Tasks | Real (`tasks` table). |
| Subtasks | Client-only, richer now (status/priority/due/assignee) but still not a real entity — no `subtasks` table, no server persistence, no assignee-notification, lost on `localStorage` clear. |
| Checklists | Client-only, unchanged. |
| Comments | Client-only, unchanged (no `comments` table). |

**Nothing below "Organization" is a real, isolated, server-enforced hierarchy today.** This is the same Critical-tier finding as the prior roadmap — restated because it's the dependency every other item below sits on.

### 2b. Roles

Target: **Owner, Admin, Manager, Member, Guest, Bot** (six roles — note this drops "Team Lead" from the prior roadmap's proposal and adds **Bot**, a genuinely new concept).

| Role | Exists today? |
|---|---|
| Owner | No — current roles are Admin/Member/Guest only, no Owner concept, no billing/org-deletion capability (no org to delete). |
| Admin | Exists, client-only, all 7 permission strings. |
| Manager | **Does not exist.** Would need to be inserted between Admin and Member with its own scope (project/team-level, not org-wide). |
| Member | Exists, client-only. |
| Guest | Exists, client-only (0 permissions today — matches "can only access specific projects" in spirit, but there's no "specific project" scoping mechanism since every project is visible to everyone). |
| **Bot** | **Does not exist in any form.** This needs: (1) a way to issue a non-human credential (API key or service-account JWT, not a password-login user), (2) that credential scoped to read-only across projects/tasks/meetings/users, (3) hard-blocked from every mutating route. Nothing like this exists — `auth.middleware.js` only knows "valid human JWT or not." |

### 2c. Permission matrix (per this spec's exact capability lists)

✅ = has today (client-only, unenforced) · ❌ = missing entirely · 🔒 = the enforcement itself is missing even where the capability exists

| Capability | Owner | Admin | Manager | Member | Guest | Bot |
|---|---|---|---|---|---|---|
| Manage billing | ❌ (no billing exists) | — | — | — | — | — |
| Delete organization | ❌ (no org exists) | — | — | — | — | — |
| Manage admins | ❌ (no Owner role to do it) | 🔒 (client-only) | — | — | — | ❌ (must be blocked) |
| View all data | 🔒 | 🔒 | ❌ (needs scoping) | — | — | 🔒 (read-only, needs scoping) |
| Manage permissions | ❌ (no permission backend) | ❌ | ❌ | — | — | ❌ (must be blocked) |
| Manage meetings | — | 🔒 (exists, client-gated) | ❌ (Manager doesn't exist) | ❌ | ❌ | ❌ (must be blocked) |
| Manage AI | ❌ (no AI admin surface) | ❌ | — | — | — | — |
| Manage users | — | 🔒 | ❌ | — | — | ❌ (must be blocked) |
| Manage teams | — | 🔒 (now open to everyone, not just Admin — needs re-gating if rebuilding formal roles) | ❌ | — | — | ❌ |
| Manage projects | — | 🔒 (partial — archive/delete only) | ❌ (Create/assign exists for everyone today, unscoped) | — | — | ❌ |
| View analytics | — | ❌ (dropped with old Admin Overview tab) | ❌ | — | — | ❌ |
| Create projects | — | 🔒 | ❌ (currently: anyone can, unscoped) | ❌ (currently: anyone can) | ❌ | ❌ |
| Create/assign tasks | — | — | ❌ | 🔒 (currently: anyone can, unscoped) | ❌ | ❌ |
| Comment | — | — | — | 🔒 (client-only, unscoped) | ❌ | ❌ |
| Join meetings | — | — | — | ❌ (meetings are Admin-only today; Member access isn't modeled) | ❌ | ❌ |
| Guest: project-scoped-only access | — | — | — | — | ❌ (no per-project ACL exists) | — |
| Bot: read-only, hard-blocked from mutation | — | — | — | — | — | ❌ (doesn't exist) |

**Bottom line**: every ✅/🔒 cell above is a client-side gate only — the backend accepts the request regardless of role (restated finding, now mapped against the new 6-role spec instead of the old 3-role one).

### 2d. Meeting system

Target routes: `/meetings`, `/meetings/create`, `/meetings/[id]`. Current routes: `/meetings`, `/meetings/schedule`, `/meetings/[meetingId]`. **Functionally identical, cosmetic naming difference only** — not a real gap, flagging so you can tell me if the exact path matters.

Target meeting-page sections vs. current `MeetingDetailView`:

| Required section | Current state |
|---|---|
| Meeting details | ✅ |
| Participants | ✅ |
| Projects linked | ✅ (badge row + Project Summary table) |
| Assigned tasks | ✅ (Participant Tasks table) |
| **In Progress tasks** | 🟡 **Real gap.** The backend payload includes `activeTasks` (not-done, not-overdue), but the detail page never renders it — no dedicated table. Data exists, UI doesn't. |
| **Completed tasks** | 🟡 **Real gap.** Same — `completedTasks` is in the payload, no table renders it. |
| Overdue tasks | ✅ |
| Upcoming deadlines | ✅ (`deadlines`) |

Two honest, concrete UI gaps — not backend work, just two more table components using data that's already being computed and returned.

Standing rule respected: no AI summaries/agendas/recommendations are generated anywhere in the meeting system — confirmed still true, `CONTEXT_LIMITATIONS` still ships with every payload.

### 2e. Task system

Everything listed (subtasks, checklists, attachments, comments, activity history, dependencies, tags, priorities, user-defined statuses with create/rename/delete/reorder/color) **already exists**, client-only except tasks themselves. This spec doesn't ask for anything new here beyond what was just built this session — the gap is purely "client-only vs. server-persisted," same as §2a.

### 2f. Board

Task drag-and-drop: intact, verified. Status column drag-and-drop via dnd-kit: **already built this session.** Nothing to do here.

### 2g. Filters

Status/assignee/priority/due date/tags: ✅ (built this session). **Project** and **Created By**: ❌ missing — "project" filter is N/A within a single-list view (no cross-project view exists to filter across — same scoping note as before); "Created By" would need a `createdBy`/`assigneeId`-style field tracked per task, which doesn't exist today (tasks only track `assignee_id`, not who created them) — this is a small, real, additive gap (one column + one filter). **Sprint**: ✅ (built this session, client-only). Saved views: ✅ (built this session).

### 2h. Admin panel (per your answer above: rebuild as 12 sections, server-backed)

| Section | Backend needed |
|---|---|
| Dashboard | KPI aggregation queries — no new tables, just new read endpoints |
| Users | Real: role column/table, suspend flag + enforcement, force-logout (session table) |
| Teams | New `teams` + `team_members` tables (currently client-only) |
| Roles | New `roles`/`permissions` tables (currently hardcoded client constants) |
| Permissions | The `requirePermission` middleware from the prior roadmap — the actual enforcement layer |
| Projects | Real update/delete/archive endpoints (currently create+list only) |
| Tasks | Bulk endpoints (currently one-at-a-time only) |
| Meetings | Already real — just needs an admin-scoped list view |
| Analytics | New aggregation endpoints (task velocity, completion rates, etc.) |
| Audit Logs | New `audit_log` table written by every mutating endpoint |
| Security | `login_events` table + session tracking |
| Settings | Org-level settings table (once Organization exists) |

This is **the single largest section of new backend work in this whole plan** — 6+ new tables, a new middleware layer, and either new or upgraded endpoints touching nearly every existing module.

### 2i. AI

Current global assistant already handles: create/update/delete task, set status/priority/assignee/due, create status, query, workload, overdue — via real Groq + real API execution.

Target examples, checked against current vocabulary:
- "Assign task to Rahul" — ✅ already works (`set_assignee`/`create_task` with assignee).
- "Create sprint planning meeting" — ❌ no `schedule_meeting` action exists yet (noted in prior roadmap, still true).
- "Show delayed projects" — ❌ projects have no health/delay concept (no due date, no status) — this would need `overdue`/`query` extended to a project level, which needs project-level dates that don't exist today.
- "Move all overdue tasks to testing" — ✅ already works (`set_status` with a `filter`, bulk-capable by design).

---

## 3. File-by-file implementation plan

Grouped by the same phase structure as `ENTERPRISE_ROADMAP.md` §Phase 8, updated for the Bot role and the confirmed admin rebuild. **This is the plan only — no file has been touched.**

### Phase A — Foundation (blocks everything else)
- `backend/db/schema.sql` — add `organizations`, `memberships` (user↔org↔role), `teams`, `team_members`, `roles`, `audit_log`, `login_events` tables; add `organization_id` to `projects`, `tasks`, `meetings`, scoping column to `users`
- `backend/src/middleware/requirePermission.js` (new) — loads target resource, walks its org/team/project chain, checks caller's role against the matrix in §2c
- `backend/src/modules/auth/` — add Bot service-account issuance (separate token type, hard-scoped)
- Every existing `*.routes.js` — insert `requirePermission(...)` after `requireAuth` on every mutating route (the actual authz retrofit)
- `frontend/src/store/slices/orgSlice.ts` → migrate from pure-client to RTK-Query-backed once the above endpoints exist

### Phase B — Admin panel rebuild (server-backed)
- `frontend/src/app/(app)/admin/page.tsx` (new — recreate)
- `frontend/src/features/admin/AdminView.tsx` (new — recreate, 12 sections per §2h, each wired to real endpoints instead of `orgSlice`)
- `backend/src/modules/admin/` (new module) — dashboard/analytics/audit-log/security endpoints
- `backend/src/modules/teams/`, `backend/src/modules/roles/` (new modules)
- Revert the People-page inline Users/Teams UI once `/admin` covers it (or keep both — your call when we get there)

### Phase C — Meeting page gaps (small, no backend change)
- `frontend/src/features/meetings/shared.tsx` — add `ActiveTasksTable` and `CompletedTasksTable`, wire into `ContextSection` alongside the existing four tables

### Phase D — Task system server migration
- `backend/db/schema.sql` — `subtasks`, `checklists`, `comments`, `tags`, `task_tags` tables
- `backend/src/modules/subtasks/`, `.../checklists/`, `.../comments/`, `.../tags/` (new modules)
- `frontend/src/store/slices/tasksSlice.ts` → subtask/checklist/comment/tag reducers become RTK Query mutations instead of local Redux

### Phase E — Filters completion
- `backend/db/schema.sql` — add `created_by` to `tasks`
- `frontend/src/features/list/ListWorkspace.tsx` — add "Created By" filter

### Phase F — AI extensions
- `backend/src/modules/ai/ai.service.js` — add `schedule_meeting` action type
- `frontend/src/features/ai/useAiExecutor.ts` — resolve it against the real meetings API

---

## 4. Database changes (summary)

New tables: `organizations`, `memberships`, `teams`, `team_members`, `roles`, `audit_log`, `login_events`, `subtasks`, `checklists`, `comments`, `tags`, `task_tags`.
New columns: `organization_id` on `projects`/`tasks`/`meetings`, `created_by` on `tasks`, `status`/role-related columns on `users`.
This is the single biggest departure from "don't rewrite the backend unnecessarily" in the whole request — it's additive (new tables, new columns), not destructive, but it's large. Flagging per your own instruction to reuse existing architecture whenever possible: Phases C, E, and F need no schema change at all; A, B, D do.

## 5. API changes (summary)

All additive — no existing route's request/response shape changes. New route groups: `/api/organizations`, `/api/teams`, `/api/roles`, `/api/admin/*`, `/api/subtasks`, `/api/checklists`, `/api/comments`, `/api/tags`. Every existing mutating route gains a `requirePermission` check (behavior change: previously-unrestricted actions become permission-gated — this WILL change what some users can do the moment Phase A ships, by design).

## 6. Redux changes (summary)

`orgSlice`, `hierarchySlice`, and the rich parts of `tasksSlice` (subtasks/checklists/comments/tags) migrate from local-only reducers to RTK Query cache + thin local UI state, mirroring how `meetingsApi`/`backendApi` already work for tasks/projects. This is the same migration pattern already proven in this codebase — not a new architecture.

## 7. UI changes (summary)

New: `/admin` (12 sections), `ActiveTasksTable`/`CompletedTasksTable` on the meeting page, "Created By" filter, Bot-account management UI (Owner-only), Organization settings page. Changed: every "this is unenforced" UI state (suspend, role change, remove member) starts reflecting real server responses instead of always succeeding locally.

## 8. Risks

- **Phase A is the whole ballgame and it's large.** Retrofitting `requirePermission` onto every route is mechanical but exhaustive — miss one route and it's a silent IDOR hole, not a build error. Needs a checklist pass, not just "add it and move on."
- **Behavior change, not just addition.** Once permissions are enforced, actions that silently worked for everyone (creating a project, deleting a task) will start failing for Members/Guests. This will look like "features broke" to anyone testing casually — needs to be communicated as intentional.
- **Data migration for existing rows.** Every existing `project`/`task`/`meeting`/`user` row needs an `organization_id` backfilled before the column can be `NOT NULL` — a single default org for all current data is the safe path, not a schema-only change.
- **Bot role is genuinely new territory** — no prior art in this codebase for non-human credentials. Needs its own auth path, not a bolt-on to the existing user/password flow.
- **Admin rebuild duplicates recent work.** You had me delete `/admin` and move Users/Teams to `/people` two turns ago; rebuilding `/admin` means deciding whether `/people` keeps its inline Edit/Teams too (redundant) or reverts (throws away that work). Worth deciding explicitly when we scope Phase B, not assuming.

---

**Awaiting your go-ahead.** Tell me which phase (A–F) to start on — or a specific numbered item within one — and I'll scope the first concrete slice (exact migration SQL, exact file diffs) before writing any code, same as last time.
