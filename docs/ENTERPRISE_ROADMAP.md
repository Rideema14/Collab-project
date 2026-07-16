# Kuberya Enterprise Roadmap

Companion to `docs/ENTERPRISE_AUDIT.md` — read that first. This document is the **design only** for Phases 3-6 of the requested enterprise buildout, plus a prioritized Phase 8 implementation roadmap. Nothing in this document has been implemented. It exists so we can agree on scope and sequencing before any backend/schema work starts — per the working agreement on this project that structural backend changes get a plan checkpoint first.

---

## Phase 3 — Organization System (Design)

### Hierarchy

```
Organization                 (new — the billing/tenant boundary; doesn't exist today)
 └─ Workspace                (new server-side; today this is a client-only cosmetic folder)
     └─ Department            (new)
         └─ Team              (promote orgSlice.Team from client-only to a real table)
             └─ Space          (promote hierarchySlice.Space from client-only)
                 └─ Folder      (promote hierarchySlice.Folder from client-only)
                     └─ Project  (real today — needs org_id/workspace_id added)
                         └─ Sprint  (new — doesn't exist in any form today)
                             └─ Task    (real today — needs no structural change)
                                 └─ Subtask (currently a client-only checklist-like item on Task; would need its own table to be a first-class entity with its own assignee/status)
```

**Why this order matters**: `Organization` is the actual multi-tenant boundary — every table below it needs an `organization_id` (or transitively, a `workspace_id` that itself carries `organization_id`) for row-level isolation. This is the single biggest schema change in the whole roadmap; everything else in Phase 3 is comparatively incremental once that boundary exists.

### Roles

Six roles, ordered by scope (widest to narrowest):

| Role | Scope | Intent |
|---|---|---|
| **Owner** | Organization | The org's ultimate authority — billing, deletion, and the only role that can demote/remove another Owner. Exactly one per org at minimum (never zero). |
| **Admin** | Organization | Full operational control except billing and org deletion. Today's "Admin" role, promoted from client-only to server-enforced. |
| **Manager** | Department | Runs one or more departments — owns that department's teams, projects, and reporting. |
| **Team Lead** | Team | Runs one team — owns that team's projects/sprints/meetings, day-to-day. |
| **Member** | Project (assigned) | Does the work — full task CRUD on projects they're a member of, no admin surface. |
| **Guest** | Project (explicitly shared) | Read-only on specifically shared projects. Cannot see anything else in the org. |

### Permission Matrix

✅ = allowed · 🟡 = allowed, scoped to their own department/team/project · ❌ = not allowed

| Action | Owner | Admin | Manager | Team Lead | Member | Guest |
|---|---|---|---|---|---|---|
| Create Project | ✅ | ✅ | ✅ | 🟡 (own team) | ❌ | ❌ |
| Delete Project | ✅ | ✅ | 🟡 (own dept) | ❌ | ❌ | ❌ |
| Edit Project | ✅ | ✅ | 🟡 (own dept) | 🟡 (own team) | ❌ | ❌ |
| Archive Project | ✅ | ✅ | 🟡 (own dept) | 🟡 (own team) | ❌ | ❌ |
| Invite Users | ✅ | ✅ | 🟡 (into own dept) | 🟡 (into own team) | ❌ | ❌ |
| Remove Users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Meetings | ✅ | ✅ | ✅ | 🟡 (own team) | 🟡 (own projects, create/schedule only) | ❌ |
| Manage Teams | ✅ | ✅ | 🟡 (own dept) | ❌ | ❌ | ❌ |
| Manage Departments | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Billing | ✅ | 🟡 (view-only) | ❌ | ❌ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | 🟡 (own dept) | 🟡 (own team) | ❌ | ❌ |
| Export Data | ✅ | ✅ | 🟡 (own dept) | ❌ | ❌ | ❌ |
| View Audit Logs | ✅ | ✅ | 🟡 (own dept) | 🟡 (own team, own actions) | ❌ | ❌ |

**Enforcement model**: every mutating route needs a resource-scoped check, not just `requireAuth`. Concretely: a `requirePermission(action, resourceLoader)` middleware that (1) loads the target resource, (2) walks up its `project → team → department → organization` chain, (3) checks the caller's role + scope against the matrix above. This replaces zero existing checks — today there are none to migrate.

---

## Phase 4 — Admin Panel (Design: what's real vs. what needs backend)

The Admin UI shell already exists (`AdminView.tsx`, 7 tabs) and is well-built visually. Every tab needs its actions moved from client-Redux to real API calls:

| Admin capability | Today | Needed backend work |
|---|---|---|
| Suspend / reactivate users | Client-only flag | `users.status` column + `requireAuth` check rejecting suspended tokens |
| Force logout | Doesn't exist | Session/token table (move off pure stateless JWT, or a short-lived-access + revocable-refresh pattern) |
| Reset password | Fake toast | Real reset-token table + `/forgot-password`/`/reset-password` routes + real email |
| Change roles | Client-only | `memberships` table (`user_id, org_id/team_id, role`) + enforcement per Phase 3 matrix |
| Transfer ownership | Doesn't exist | Owner-only endpoint that reassigns the `Owner` role atomically |
| View activity / audit logs | Client-only, 2 slices | Server `audit_log` table, written by every mutating endpoint (actor, action, resource, timestamp) |
| View login history | Doesn't exist | `login_events` table written on every successful `POST /api/auth/login` |
| View project activity | Doesn't exist | Derived from the same `audit_log`, filtered by project |
| View system usage | Partially fake (System tab) | Real health checks: DB connection, email provider status (EmailJS ping), background-job status once jobs exist |
| Delete project (real) | Deletes tasks, archives client-side only | `DELETE /api/projects/:id` route (cascades via existing FK) |

---

## Phase 5 — Meeting System (Design: gap-fill on top of the existing Phase 1 module)

The standalone `/meetings` module already exists and is ahead of most competitors on **context generation** (per-participant task snapshots). What's genuinely missing per your spec:

- **Status-grouped overview** (Upcoming / Scheduled / Completed): the data already supports this — `scheduled_at` vs now, plus `status`. This is a `MeetingsOverview` UI change (group by computed bucket), no schema change needed.
- **Recordings**: needs `meetings.recording_url`, `recording_status` columns + an upload/link-attach flow (likely a bot/integration posting the URL after the fact, not a manual upload).
- **AI summaries**: needs a transcript source first (either the recording pipeline above, or manual notes) — then a Groq call analogous to `ai.service.js`'s pattern, but summarizing transcript text rather than planning actions. Cannot be built before recordings/transcripts exist.
- **Attendance**: the `meeting_participants.invite_status` column exists but nothing transitions it. Needs either a self-service RSVP endpoint or bot-reported check-in/check-out, plus an `attended: boolean` column.
- **Meeting Bot integration payload**: the context-package generator (`buildContextPackage`) already produces exactly this — who owns what, what's overdue/blocked*, what's completed. (*"Blocked" specifically is not available — no dependency table exists server-side yet; this was already flagged as a known limitation baked into every generated context package via `CONTEXT_LIMITATIONS`.)

## Phase 6 — AI System (Design: extending the existing global assistant)

There's already a real, working global assistant (`/ai` page + floating `AiButton`, not project-scoped) that converts natural language into a structured action plan via Groq and executes it against real APIs where they exist. Current action vocabulary (`ai.service.js`): `create_project`, `rename_project`, `archive_project`, `delete_project`, `create_task`, `update_task`, `delete_task`, `set_status`, `set_priority`, `set_assignee`, `set_due`, `create_status`, `rename_status`, `delete_status`, `query`, `summarize`, `workload`, `overdue`.

Gaps against your example commands:
- **"Schedule meeting tomorrow"** — no `schedule_meeting` action type exists yet. Straightforward to add once the executor can call the real meetings API (it already can, via `createMeeting`).
- **"Generate sprint" / "Create backlog"** — no sprint/backlog concept exists anywhere yet (Phase 3 dependency — needs the `Sprint` entity from the hierarchy design above before this can mean anything server-side).
- **"Archive/delete project", "manage statuses", "set priority"** — the AI can already *plan* these, but the frontend executor can only fulfill them against real backend support, and today: project archive/delete has no route (Phase 4 closes this), status management is client-only (Phase 3/schema dependency), and priority has no backend column (needs `tasks.priority`).

Net: the AI system doesn't need a rebuild — it needs (a) new action types for meetings/sprints, and (b) the backend gaps elsewhere in this roadmap closed so the actions it can already plan can actually execute server-side.

---

## Phase 8 — Prioritized Implementation Roadmap

This is the actual sequencing question to resolve before writing code. Grouped by priority, each item notes its Phase 3-6 dependency.

### Critical (foundation — nothing else in "Enterprise" is real without this)
1. `organizations` + `memberships` (user↔org↔role) tables; add `organization_id` to `projects`/`tasks`/`meetings`/`users`-scoping — the actual multi-tenant boundary
2. Server-side permission enforcement middleware (`requirePermission`) wired into every existing mutating route — closes the IDOR/no-authz issue that's currently the single biggest risk in the app
3. Real project delete/update endpoints (currently create+list only)
4. Password reset flow (self-service) — there is currently no recovery path for a lost password at all

### High
5. Server-persisted audit log (single `audit_log` table, written by every mutating endpoint) — replaces both client-only audit slices
6. Login history / session tracking, real "force logout"
7. Real invite flow (admin-generated invite link/token instead of open self-registration)
8. Task/project duplication
9. Cross-workspace search (tasks/people/meetings, not just lists)
10. Wire the existing-but-unreachable filter UI (`filterAssigneeIds`/`filterTagIds`) into the list toolbar
11. `Team`/`Department` as real backend entities (currently client-only in `orgSlice`)

### Medium
12. Comments + attachments moved from client-only to server-persisted (biggest "looks real but isn't" gap for a team product)
13. Notifications moved server-side (so they survive across devices/sessions)
14. Custom fields moved server-side
15. Meeting status-grouped overview (Upcoming/Scheduled/Completed) — UI-only, no schema change
16. `tasks.priority` column + AI `set_priority` execution against it
17. Mentions (@user) in comments/chat

### Low
18. Data export/import
19. Meeting recordings + AI summaries (blocked on a transcript/recording source existing first)
20. Time tracking moved server-side
21. Templates moved server-side
22. Sprint/Backlog entity + AI "generate sprint" action

---

## What I need from you before starting Phase 8

This is a genuinely large scope — items 1-4 alone (organizations, memberships, permission middleware retrofitted across every route, project CRUD, password reset) represent a full schema redesign and touch every existing module. I don't want to start restructuring the data model without your sign-off on sequencing, per how we've handled backend changes on this project so far.

Tell me which of the four priority tiers (or specific numbered items) to start on, and I'll scope the first concrete implementation slice — file list, migration, and what stays backward-compatible — before writing any code.
