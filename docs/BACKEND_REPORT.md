# Task Board — Backend Analysis

Derived by reading every file under `backend/src` and `backend/db`, then verifying
each contract against the running server. Payload shapes below are transcribed
from actual responses, not inferred from the code.

**Stack:** Express 4 · PostgreSQL (`pg`) · JWT (`jsonwebtoken`) · bcryptjs · multer
· Groq (voice, optional).
**Architecture:** feature modules (`auth`, `users`, `projects`, `tasks`, `voice`),
each split `routes → controller → service → repository`. Only the repository layer
touches SQL.

---

## 1. API endpoints

Base URL `http://localhost:4000`. Auth column = requires `Authorization: Bearer <token>`.

| # | Method | Path | Auth | Purpose |
|---|--------|------|:----:|---------|
| 1 | GET | `/api/health` | – | Liveness. Returns the plain text `server working` (not JSON). |
| 2 | POST | `/api/auth/register` | – | Create an account, returns a token. |
| 3 | POST | `/api/auth/login` | – | Sign in, returns a token. |
| 4 | GET | `/api/users` | ✔ | Every user in the workspace (the assignee picker). |
| 5 | POST | `/api/projects` | ✔ | Create a project. |
| 6 | GET | `/api/projects` | ✔ | All projects, newest first. |
| 7 | POST | `/api/projects/:projectId/tasks` | ✔ | Create a task (always lands in `To Do`). |
| 8 | GET | `/api/projects/:projectId/tasks` | ✔ | The board — tasks **pre-grouped into columns**. |
| 9 | PATCH | `/api/tasks/:taskId/status` | ✔ | Move a task between columns. |
| 10 | PATCH | `/api/tasks/:taskId` | ✔ | Partial update (title / assignee / due date). |
| 11 | DELETE | `/api/tasks/:taskId` | ✔ | Delete. Returns **204, no body**. |
| 12 | POST | `/api/projects/:projectId/tasks/voice/parse` | ✔ | Parse a voice command. **Writes nothing** — preview only. |
| 13 | POST | `/api/projects/:projectId/tasks/voice` | ✔ | Parse **and** create in one call. |

Endpoints 12–13 accept `multipart/form-data` with **either** an `audio` file field
(max 15 MB) **or** a `transcript` text field. Both return **503** unless `GROQ_API_KEY`
is set on the server — the rest of the app is unaffected.

### Response envelope

Every JSON response is wrapped. There are no bare arrays or objects.

```jsonc
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "message": "Human-readable reason" } }
```

---

## 2. Request payloads

| Endpoint | Body |
|---|---|
| `POST /auth/register` | `{ "name": string, "email": string, "password": string }` — password ≥ 6 chars |
| `POST /auth/login` | `{ "email": string, "password": string }` |
| `POST /projects` | `{ "name": string }` — `created_by` comes from the token, never the body |
| `POST /projects/:id/tasks` | `{ "title": string, "assigneeId"?: number\|null, "dueDate"?: "YYYY-MM-DD"\|null }` |
| `PATCH /tasks/:id/status` | `{ "status": "To Do" \| "In Progress" \| "Done" }` |
| `PATCH /tasks/:id` | Any subset of `{ title, assigneeId, dueDate }` |
| `POST .../voice/parse`, `POST .../voice` | `multipart/form-data`: `audio` (file) **or** `transcript` (text) |

Two conventions worth knowing, both in `tasks.service.js`:

- On `PATCH /tasks/:id`, an **absent key means "leave alone"**; `null` or `""` means
  **"clear this field"**. Sending `{}` is a 400 (`No valid fields provided to update`).
- `""` is normalised to `null` before it reaches SQL (`blankToNull`), so an empty
  form field clears the column rather than storing an empty string.

There is **no** `status` field on create — the SQL hardcodes `'To Do'`.

## 3. Response payloads

**Auth** (`register` 201 / `login` 200) — note the password hash is never returned:

```json
{ "success": true, "data": {
  "user": { "id": 1, "name": "Priya Sharma", "email": "priya@kuberya.ai" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}}
```

**Task** — the canonical shape, returned by create / update / status-change and
nested inside the board:

```json
{
  "id": 1, "projectId": 1,
  "title": "Fix the login bug",
  "status": "To Do",
  "dueDate": "2020-01-15",
  "isOverdue": true,
  "createdAt": "2026-07-14T10:07:55.507Z",
  "updatedAt": "2026-07-14T10:07:55.507Z",
  "assignee": { "id": 1, "name": "Priya Sharma", "email": "priya@kuberya.ai" }
}
```

- `assignee` is `null` when unassigned; `dueDate` is `null` when unset.
- **`isOverdue` is computed in SQL**, not stored: `due_date < CURRENT_DATE AND status <> 'Done'`.
  A client must render it, never recompute it — moving a task to `Done` flips it to `false`.
- **`dueDate` is a plain `YYYY-MM-DD` string**, deliberately. `config/db.js` overrides the
  `pg` DATE parser so a date never becomes a `Date` and drifts a day in a negative-UTC
  timezone. Good decision; a client must not re-parse it as a timestamp.

**Board** (`GET /projects/:id/tasks`) — already grouped, so the client renders columns
directly rather than flattening and re-grouping:

```json
{ "success": true, "data": {
  "To Do":       [ /* Task */ ],
  "In Progress": [],
  "Done":        []
}}
```

**Projects** — the list and the create response are **not the same shape**:

```jsonc
// GET /api/projects
{ "id": 1, "name": "Website redesign", "createdAt": "...",
  "createdBy": { "id": 1, "name": "Priya Sharma" } }

// POST /api/projects (201) — no creator name; the insert doesn't have it on hand
{ "id": 1, "name": "Website redesign", "createdAt": "...",
  "createdBy": { "id": 1 } }
```

A client that appends the create response straight into its list will render a project
with a missing author. Refetch the list instead.

**Voice parse** (`POST .../voice/parse`):

```json
{ "success": true, "data": {
  "projectId": 1,
  "transcript": "Assign the login bug to Priya by Friday",
  "parsed": {
    "title": "Fix the login bug",
    "dueDate": "2026-07-17",
    "assignee": { "id": 1, "name": "Priya Sharma", "email": "priya@kuberya.ai" },
    "assigneeNameHeard": "Priya"
  },
  "warnings": ["Could not confidently match \"Sam\" to a team member — left unassigned."]
}}
```

`warnings` is the honest part of this feature: the LLM's assignee guess is **never
trusted blindly**. `voice.parser.js` re-resolves the name against the real roster
(exact full name → first name → email local-part → substring) and, if it can't match,
leaves the task unassigned and says so. Same for an unparseable date. A client should
surface these.

## 4. Authentication flow

Stateless JWT. There are no sessions, no refresh tokens, and no server-side revocation.

1. `POST /auth/register` — validates, rejects a duplicate email with **409**, hashes the
   password with **bcrypt (10 rounds)**, inserts, signs a token.
2. `POST /auth/login` — looks up by lower-cased email, `bcrypt.compare`s, signs a token.
   Both "no such user" and "wrong password" return the **same** 401 `Invalid email or
   password`, deliberately — it doesn't leak which emails are registered.
3. Token payload: `{ sub: <user id>, name, email }`, `HS256`, expiry `JWT_EXPIRES_IN`
   (default **7d**).
4. Every protected route runs `requireAuth`, which parses `Authorization: Bearer <token>`,
   verifies it, and attaches `req.user = { id, name, email }`. A missing header, a wrong
   scheme, and an expired/forged token all return **401**.

**Consequence for clients:** a 401 means two different things depending on the route.
On `/api/auth/*` it means *"those credentials are wrong"*. Everywhere else it means
*"your session is dead"*. Treating them identically makes a failed login report
"your session expired" to someone who was never signed in.

## 5. User roles

**There are none.** This is the single most important finding for anyone building on top
of this API.

- The `users` table has no `role`, `is_admin`, or equivalent column.
- No middleware checks any authority beyond "is this token valid".
- There is no project membership table — `GET /api/projects` returns **every** project to
  **every** authenticated user, and any authenticated user can edit or delete **any** task
  in **any** project.

The only ownership recorded anywhere is `projects.created_by`, and it is never enforced —
it is used purely to display "Created by …". So the authorization model is binary:
**authenticated, or not.** Any admin/member distinction in the UI would be decoration
over an API that does not enforce it, and should not be built until the backend does.

## 6. Database schema

Three tables. From `db/schema.sql`.

```
users                             projects                        tasks
─────                             ────────                        ─────
id            SERIAL PK           id         SERIAL PK            id          SERIAL PK
name          VARCHAR(255)  NOT NULL
email         VARCHAR(255)  UNIQUE NOT NULL                       project_id  INT NOT NULL ─┐
password_hash VARCHAR(255)  NOT NULL                              title       VARCHAR(500) NOT NULL
created_at    TIMESTAMPTZ   NOT NULL          name       VARCHAR(255) NOT NULL
                                              created_by INT NOT NULL ─┐    status      task_status NOT NULL DEFAULT 'To Do'
                                              created_at TIMESTAMPTZ   │    assignee_id INT ─┐
                                                                       │    due_date    DATE  │
                                                                       │    created_at  TIMESTAMPTZ
                                                                       │    updated_at  TIMESTAMPTZ
```

**Relationships**

- `projects.created_by → users.id` — `ON DELETE CASCADE` (deleting a user deletes their projects).
- `tasks.project_id → projects.id` — `ON DELETE CASCADE` (deleting a project deletes its tasks).
- `tasks.assignee_id → users.id` — **`ON DELETE SET NULL`** (deleting a user un-assigns their
  tasks rather than destroying them). Nullable = unassigned.

**Enum:** `task_status AS ENUM ('To Do', 'In Progress', 'Done')` — the three columns are fixed
at the database level, so a fourth status is a migration, not a config change. Wrapped in a
`DO $$ ... EXCEPTION WHEN duplicate_object` block to keep the script re-runnable.

**Indexes:** `idx_tasks_project_status (project_id, status)` — matches the board query exactly.
`idx_projects_created_by (created_by)`.

**Note:** `updated_at` is maintained by hand in the UPDATE statements (`SET updated_at = now()`),
not by a trigger. Any future write path that forgets it will silently leave a stale timestamp.

## 7. Missing APIs

Gaps found while building a full client against this backend. Ordered by how much they hurt.

| # | Gap | Impact |
|---|-----|--------|
| 1 | **`GET /api/projects/:id`** | There is no way to fetch one project. To show a board's title, the client must fetch the **entire** project list and find its own — a full-table read for one row, on every board load. Cheapest high-value addition. |
| 2 | **No authorization model at all** | Any user can mutate any task in any project (see §5). Needs project membership + ownership checks before this is multi-tenant. |
| 3 | **No `PATCH`/`DELETE` for projects** | Projects can be created and listed, never renamed or removed. A typo in a project name is permanent. |
| 4 | **No `GET /api/auth/me`** | The client can't re-validate a stored token or refresh the user record; it has to trust the JWT payload it cached at login. A renamed user shows their old name until they sign out. |
| 5 | **No pagination anywhere** | `GET /projects`, `GET /users`, and the board all return everything, unbounded. Fine at team scale, a cliff at organisation scale. |
| 6 | **No ordering control on tasks** | The board returns tasks by `created_at ASC` and there is no `position` column, so cards cannot be **reordered within** a column — only moved between columns. Drag-and-drop reordering is not implementable without a schema change. |
| 7 | **No filter/search on the board** | No filtering by assignee, due date, or overdue. A large board must be filtered client-side. |
| 8 | **`updated_at` not exposed for concurrency** | It's returned, but nothing accepts it back. Two people editing one task silently overwrite each other — last write wins, no conflict detection. |

**Not a gap, but worth flagging:** `GET /api/health` returns the plain string
`server working`, not the JSON envelope every other route uses. Harmless, but it means a
generic client can't parse it with the same code path.
