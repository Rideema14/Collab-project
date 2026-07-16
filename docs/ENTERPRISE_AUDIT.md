# Kuberya Enterprise Audit

Date: 2026-07-16
Scope: full backend (Express/PostgreSQL) + frontend (Next.js/Redux) as of `rideema-ui-redesign`.
Method: direct source read of every route, controller, service, repository, schema table, Redux slice, RTK Query endpoint, and feature view — no assumptions, every claim below is cited to a file.

---

## Executive Summary

Kuberya today is a **single-tenant, binary-auth project tool with a premium UI shell wrapped around it.** The single most important fact from this audit:

> **The backend has no authorization model at all.** `requireAuth` (`backend/src/middleware/auth.middleware.js`) checks only "is this JWT valid." No route anywhere checks whether the caller owns, created, or is a member of the resource being read or mutated. Every "Admin/Member/Guest" role, every "Suspended" badge, every audit log, every permission check in the UI is **client-side Redux state only** — it changes what buttons render, not what the API will accept. Any authenticated user (or a raw `curl` with a stolen/expired-but-not-yet-expired token) can read or modify **any** project, task, meeting, or user in the system.

A second load-bearing fact: **the app is single-tenant.** `GET /api/users`, `GET /api/projects`, `GET /api/meetings` all run unfiltered `SELECT *` queries (`users.repository.js`, `projects.repository.js`, `meetings.repository.js`). There is no `workspace_id`/`tenant_id` anywhere in `schema.sql`. The client-side `Workspace → Space → Folder` hierarchy (`hierarchySlice.ts`) is a cosmetic folder tree over one shared global dataset — it does not isolate data between "workspaces."

Everything below should be read through that lens: many "features" that look complete in the UI are Redux state with no server counterpart, and will not survive a `localStorage` clear, will not sync across devices, and are invisible to a second admin.

---

## 1. Existing Features (real, end-to-end)

**Backend-verified, working today:**
- Register / login (JWT, bcrypt, 7-day token, `backend/src/modules/auth/*`)
- Projects: create + list-all (no update/delete/get-by-id route exists)
- Tasks: create, per-project board fetch, update, update-status (optimistic), delete
- Voice-to-task: preview-parse and one-shot parse+create via Groq Whisper
- AI command: natural-language → structured action plan via Groq (`POST /api/ai/command`), executed client-side against the real task/project APIs above
- Meetings: full CRUD-ish (create/list/get/update/cancel), participant/project association, live task-context preview and per-meeting context-package generation (SQL aggregation of assigned/completed/overdue tasks), invite/cancellation emails via EmailJS

**Client-side, fully functional (but not server-persisted — see §6):**
- Rich task metadata: priority, estimate, description, subtasks, checklists, tags, dependencies, watchers, attachments (base64, 512KB/file cap), time tracking
- Comments (with live typing indicator via presence broadcast)
- Custom fields (7 types, per-list)
- Templates (save task/list as template, reapply)
- Team chat (channels, DMs, pinning, announcements)
- Notifications (in-app feed)
- Activity log / audit log (two separate slices)
- Dashboard (11 configurable widgets, computed from real + client data)
- Org/roles/teams model (Admin/Member/Guest, team grouping)
- Status sets (custom Kanban columns beyond the backend's 3 canonical values)
- Sidebar hierarchy: Workspace → Space → Folder → List, favorites

## 2. Missing Features (absent entirely, no UI, no backend)

- Project/task/list **duplication** — no menu item, no endpoint, anywhere
- Data **export/import** — no CSV/JSON download or upload, anywhere
- **Workspace/tenant isolation** — single shared dataset for all users
- **Leave workspace** action
- **Ownership transfer** — there is no "Owner" role at all, only Admin/Member/Guest
- Server-side **password reset** (self-service or admin-triggered) — no route exists
- **Login history / active sessions** — Admin's own Security tab admits this ("not enabled")
- **Cross-workspace task search** — Command Menu (⌘K) indexes lists + 4 static commands only, never tasks/people/meetings
- **Saved/named views** — only one live preference set per list, nothing nameable/shareable
- **Mentions** (@user in comments/chat) — grepped, does not exist
- Meeting **recordings**, **AI summaries**, **attendance tracking** — `meeting_url` is just an admin-entered external join link; no recording storage/status column
- **Billing/plans** — no tables, no Stripe or equivalent integration
- Departments, formal Teams-as-a-backend-entity (Team exists client-only in `orgSlice`)

## 3. Broken Features

- None currently open. (The Admin → Tasks infinite-refetch hang reported earlier this session was root-caused to an unmemoized `useEffect` dependency and fixed.)

## 4. Incomplete Features

- **Meeting RSVP**: `meeting_participants.invite_status` defaults to `'pending'` and is never transitioned by any endpoint — the column exists but nothing ever sets it to accepted/declined.
- **List-level filters**: `ListViewPrefs.filterAssigneeIds`/`filterTagIds` are fully modeled in `tasksSlice` and enforced by `useListData`'s `matchesFilters` — but **no UI control anywhere sets them.** Dead plumbing.
- **Gantt view**: `TimelineView` has a complete `mode="gantt"` code path (dependency arrows), but `ListWorkspace`'s `VIEW_TABS` never exposes a Gantt tab — unreachable from the UI, despite a page comment promising "7-view workspace... Gantt."
- **AI action vocabulary vs. backend reality**: the AI prompt schema (`ai.service.js`) can emit `archive_project`, `delete_project`, `create_status`/`rename_status`/`delete_status`, `set_priority`, `summarize` — **none of these have a backend endpoint to fulfill them** (no archive column, no project-delete route, no statuses table, no priority column, no summarize endpoint). The frontend's `useAiExecutor` can only resolve actions that map onto real client-Redux operations for these; anything requiring true backend support silently can't be completed server-side.
- **`PresenceStack`** component (who's-online avatar stack) is fully built but never mounted anywhere in the app.

## 5. Fake Features (UI present, no real functionality)

| Feature | Location | What actually happens |
|---|---|---|
| "Invite" button | `PeopleView.tsx` | `onClick` just shows a toast: "Invites are managed by your workspace admin." No invite is sent. |
| "Reset" password button | Admin → Users tab | Shows a toast claiming a reset link was sent (`Password reset link sent to ${email}`). No email, no token, no backend call. |
| System status → Email row | Admin → System tab | Hardcoded `ok: false` — a static label, not a live health check. |
| System status → Background jobs row | Admin → System tab | Hardcoded `ok: false, detail: 'None running'` — static, not a live check. |
| "Watch Demo" button | `/login` marketing hero | No `onClick` handler at all. |
| "Forgot?" link | `/login` auth modal | `href="#"` — no password-reset flow exists behind it. |

## 6. Client-only Features (no backend module; lost on localStorage clear, not synced across devices/admins)

`customFieldsSlice`, `dashboardSlice`, `templatesSlice`, `timeSlice`, `notificationsSlice`, `activitySlice`, `orgSlice` (roles/permissions/teams/audit), `chatSlice`, `commentsSlice`, task-rich fields in `tasksSlice` (priority/estimate/subtasks/checklists/tags/dependencies/watchers/attachments), the Workspace/Space/Folder layers of `hierarchySlice`, project archive/restore flag, list favorites.

## 7. Backend-supported Features (contrast)

Users (read-only roster), Projects (create/list), Tasks (full CRUD + status), Voice parsing, AI command planning, Meetings (full lifecycle + context generation), Auth (register/login).

## 8. Security Issues

**Critical — no authorization anywhere (IDOR by design):**
Every route past `requireAuth` operates on any resource ID the caller supplies, with zero ownership/membership check. Confirmed across every module:
- `GET/PATCH/DELETE` on tasks by id — any authenticated user can read/edit/delete any task in any project (`tasks.routes.js`, `tasks.service.js`)
- `GET/PATCH` meetings, `POST .../cancel`, `POST/GET .../context` — no check the caller created or was invited to the meeting (`meetings.service.js`)
- `POST /api/meetings/preview-context` — accepts arbitrary `projectIds`/`participantUserIds` in the body and returns those users' task breakdowns to anyone with a valid token
- `GET /api/users` — returns every registered user's name + email to any authenticated caller, unfiltered
- IDs are `SERIAL` (sequential integers) — trivially enumerable

**High:**
- **CORS**: `app.use(cors())` with zero options — reflects any origin, effectively `Access-Control-Allow-Origin: *` for any site holding a valid token
- **No rate limiting** anywhere (confirmed absent from `package.json` and `app.js`; README admits it)
- **No password reset flow** — a compromised or forgotten password has no recovery path
- **No session/token revocation** — JWTs are stateless with no blocklist; a leaked token is valid for the full 7-day window with no way to force-invalidate it
- **Client-side-only permission model** — `orgSlice`'s "any valid token can do anything" is a documented, known property, not an oversight, but it means the entire Admin panel's protections (suspend, remove-admin, role changes) are cosmetic against a direct API caller

**Medium:**
- Input validation is hand-rolled per service with no shared schema library (Joi/Zod) — inconsistent coverage; some fields rely on Postgres to reject bad data via generic error-code translation rather than a clean 400
- Six of seven defined client permission strings (`task.create`, `task.edit`, `task.delete`, `status.manage`, `space.manage`, `settings.manage`) are **never checked anywhere in the UI** — only `member.manage` gates anything (Admin + Meetings entry). A "Guest" (0 permissions) can delete any task through the normal UI.

**Not found (verified clean):**
- SQL injection: all queries parameterized throughout, including dynamic `UPDATE...SET` builders — no string-concatenated SQL anywhere
- No secrets (JWT secret, DB password, API keys) found logged anywhere

## 9. UX Issues

- **Two unrelated auth surfaces**: `/login` is a marketing landing page with a bolted-on auth modal (hardcoded inline gradients); `/register` is a real form using the shared design system. They visually don't match, and there's no dedicated `/login` form page.
- **Duplicate primitives** with inconsistent reuse: two `Input` implementations (`ui/Field.tsx` vs `ui/Input.tsx`), two `Skeleton` implementations (`ui/Misc.tsx` vs `ui/States.tsx`), two `Avatar` implementations (`ui/Avatar.tsx` vs `domain/AvatarStack.tsx`) — most forms bypass all of them with raw `<input>`/`<select>`.
- Theme toggle duplicated (topbar + profile dropdown, both functional, just redundant).
- `EmptyState`/`ErrorState` components exist but most feature-level empty states are bespoke inline `<p>` text instead.
- No cross-workspace search (see §2); the ⌘K palette doesn't search tasks/people/meetings, which is a real gap versus user expectation of a "command palette."
- No filter UI despite filter state existing (§4) — a user cannot filter a list by assignee or tag despite the plumbing existing.

## 10. Performance Issues

Already covered in depth in `docs/FRONTEND_PERFORMANCE_AUDIT.md` — see that document for bundle-size, rerender, and hydration findings. Not re-audited here.

## 11. Scalability Issues

- `GET /api/projects`, `GET /api/users`, `GET /api/meetings` have **no pagination** — every row, every time, for every caller. Fine at current scale, will not survive real multi-tenant growth.
- No `workspace_id`/tenant partitioning anywhere — adding real multi-tenancy later means an index-affecting schema migration across every table, not an additive column.
- Sequential `SERIAL` primary keys make resource enumeration trivial once combined with the IDOR issues in §8.
- `meeting_context_packages.payload` is `JSONB` with a `UNIQUE(meeting_id)` — one row per meeting (upsert), so this doesn't grow unbounded, but it also means there's no history of context snapshots over time.

## 12. Permission Issues — Full Checklist

| Question | Answer | Evidence |
|---|---|---|
| Can a member delete a project? | No delete-project endpoint exists at all; Admin's "Delete" button deletes the project's tasks then sets a **client-only** archived flag — the Postgres row survives. | `projects.routes.js`, `AdminView.tsx` |
| Can a guest see private projects? | N/A — "private project" doesn't exist as a concept; every project is visible to every authenticated user. | `projects.repository.js` |
| Can an admin remove another admin? | Client-only — deletes local role metadata, the user's real account and API access are untouched. | `orgSlice.removeMember` |
| Can an owner transfer ownership? | N/A — there is no "Owner" role at all (only Admin/Member/Guest), no transfer flow. | `defaults.ts` |
| Can users invite members? | No — "Invite" button is a stub toast; real provisioning is open self-registration via `POST /api/auth/register`. | `PeopleView.tsx`, `auth.service.js` |
| Can users leave a workspace? | No such action exists. | — |
| Can admins suspend users? | Client-only flag; no `status` column on `users`, `requireAuth` never checks it — a "suspended" user's token still works everywhere. | `AdminView.tsx`, `auth.middleware.js` |
| Can admins reset passwords? | No — fake toast, no backend route. | `AdminView.tsx`, `auth.routes.js` |
| Can admins see login history? | No — the app's own Security tab admits this isn't enabled. | `AdminView.tsx` |
| Can admins see activity logs? | Client-only, two separate Redux slices, not server-tracked, not visible cross-session/cross-admin. | `orgSlice.audit`, `activitySlice.ts` |
| Can users archive projects? Restore? | Yes, but client-only flag on the List wrapper — the Postgres project row has no archived state. | `types.ts`, `AdminView.tsx` |
| Can users duplicate projects/tasks/lists? | No such feature exists anywhere. | — |
| Can users export/import data? | No such feature exists anywhere. | — |
| How many real roles exist? | Three, 100% client-side: Admin (all 7 permissions), Member (task.create/edit/delete), Guest (none). Backend has zero role concept. | `defaults.ts` |
| Is there a workspace/tenant boundary? | No — single shared dataset; the UI's "Workspace" is a cosmetic folder tree, not a data boundary. | `users.service.js` |
| Can a user be force-logged-out? | No — stateless JWT, no session table, no revocation mechanism. | `auth.service.js` |
| Can a user's role be changed with backend enforcement? | UI yes, backend no-op — there's no role column to change or enforce. | `AdminView.tsx` |

**Notable UI quirk**: on first load in a fresh browser, if no one currently holds the Admin role in the local Redux store, the signed-in user is **auto-promoted to Admin** (`SessionSync.tsx`). This is a deliberate UX bootstrap (so a fresh session isn't locked out of Admin), but it means "who is Admin" resets per-browser, not per-account.

---

## Phase 2 — Comparison to Industry Leaders

Legend: ✅ full · 🟡 partial/client-only · ❌ missing · Priority reflects impact if this were a real multi-user product, not effort to build.

| Feature | Kuberya | ClickUp | Jira | Linear | Monday | Asana | Notion | Missing? | Priority |
|---|---|---|---|---|---|---|---|---|---|
| Multi-tenant workspaces | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | Critical |
| Server-enforced roles/permissions | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | Critical |
| Resource ownership checks (IDOR protection) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | Critical |
| Project delete/archive (server-persisted) | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Partial | Critical |
| Password reset flow | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | Critical |
| Audit logs (server-persisted) | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | Yes | High |
| Login history / session mgmt | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Real admin invite flow | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Task/project/list duplication | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Bulk edit/assign (beyond Admin panel) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | Yes | High |
| Global search (tasks/people/meetings) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Saved/shared views | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Filters (functional) | ❌ (built, unreachable) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Comments (server-persisted) | ❌ (client-only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Attachments (server-uploaded) | ❌ (client-only base64) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | High |
| Watchers/followers | 🟡 (client-only) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | Partial | Medium |
| Mentions (@user) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | Medium |
| Notifications (server-persisted) | 🟡 (client-only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Partial | Medium |
| Email preferences | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | Medium |
| Data export/import | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Yes | Medium |
| Keyboard shortcuts (beyond ⌘K) | 🟡 (minimal) | ✅ extensive | ✅ extensive | ✅ best-in-class | ✅ | 🟡 | 🟡 | Partial | Medium |
| Command palette | 🟡 (lists only) | ✅ | 🟡 | ✅ best-in-class | 🟡 | 🟡 | ✅ | Partial | Medium |
| Favorites/pins | 🟡 (lists + chat msgs only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Partial | Low |
| Dark mode | ✅ full | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | No | — |
| Mobile responsiveness | ✅ (drawer nav, breakpoints throughout) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | No | — |
| AI assistant | ✅ real (plans + executes via real APIs) | ✅ | 🟡 | 🟡 | ✅ | 🟡 | ✅ | No | — |
| AI actions on entities backend doesn't support (archive/delete project, statuses, priority) | ❌ (plan-only, can't execute) | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | Partial | Medium |
| Meeting scheduling + context | ✅ (ahead of most competitors here — this is Kuberya's differentiator) | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | No | — |
| Meeting recordings/AI summaries | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | Yes (but so is everyone else's) | Low |
| Time tracking (server-persisted) | ❌ (client-only) | ✅ | 🟡 | ❌ | ✅ | 🟡 | ❌ | Partial | Low |
| Custom fields (server-persisted) | ❌ (client-only) | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | Partial | Medium |
| Templates | 🟡 (client-only) | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | Partial | Low |

**Reading the table**: Kuberya's UI-layer feature *breadth* (custom fields, templates, time tracking, dependencies, chat, dashboard, meetings-with-context) is genuinely competitive with — in the meetings case, ahead of — these products. The gap is entirely in the **foundation layer**: none of that breadth is backed by real multi-tenant, permission-enforced, server-persisted data. A competitor with 1/3 the UI polish but a real auth model is more "enterprise-ready" than Kuberya today.
