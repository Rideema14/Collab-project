# Task Board — Backend (v1 + voice assignment)

Express + PostgreSQL backend for the Task Board spec: sign in, projects, tasks, a
three-column board — plus one bonus feature layered on top: assigning a task by voice.

Built as independent feature modules so any one of them (or a whole new one, the
same way `voice` was added after the fact) can be lifted out later without a rewrite.

## Architecture

```
src/
├── server.js              # entry point
├── app.js                 # wires all module routers together
├── config/
│   ├── env.js               # reads & validates environment variables
│   └── db.js                # the one shared PostgreSQL pool
├── middleware/
│   ├── auth.middleware.js       # JWT verification
│   ├── validateIdParam.js       # normalizes/validates :id route params
│   ├── asyncHandler.js          # removes try/catch boilerplate from controllers
│   └── error.middleware.js      # turns thrown errors into clean JSON responses
├── utils/
│   └── ApiError.js          # typed HTTP error
└── modules/
    ├── auth/       # register, login
    ├── users/      # team member list (assignee picker)
    ├── projects/   # create/list projects
    ├── tasks/      # create/edit/delete/move tasks, grouped board view
    └── voice/      # NEW — turn a spoken command into a task
```

Every module follows the same four-file shape:

| File | Job |
|---|---|
| `*.routes.js` | URLs → controller functions, plus which middleware guards them |
| `*.controller.js` | HTTP only — reads `req`, calls the service, shapes `res` |
| `*.service.js` | Business logic, validation, the actual rules |
| `*.repository.js` | Raw SQL. Nothing above this layer writes a query. |

A module only ever imports from `config/`, `middleware/`, `utils/`, and — in exactly
one place — another module's **service** (never another module's repository or raw
SQL). That one place is `tasks.service.js` calling `projectsService.getProjectOrThrow()`
to confirm a project exists before attaching a task to it, and `voice.service.js`
calling `tasksService.createTask()` and `usersService.listMembers()`. That's the
one deliberate seam in the codebase — a narrow, read-oriented function call, not a
shared database table or shared internal state.

**To extract a module into its own service later:** copy its folder plus a copy of
`config/db.js`, `middleware/`, and `utils/`; give it its own `package.json` and
`server.js`; turn any cross-module service calls it made into HTTP requests instead.
Nothing else in the codebase needs to change, because nothing else reaches into a
module's internals.

## Setup

**Requirements:** Node 18+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env       # then edit DATABASE_URL / JWT_SECRET
npm run db:migrate         # creates tables (safe to re-run)
npm run db:seed            # optional — two demo users, see below
npm run dev                # or: npm start
```

Demo login after seeding: `asha@example.com` / `password123` (also `ben@example.com`).
In real use, team members sign up via `POST /api/auth/register` — see note below.

### One assumption worth flagging

The spec describes a sign-**in** API but not a sign-**up** one, since a fixed team
with no guests doesn't strictly need self-service registration. But sign-in is
untestable without a way to create a user, so `POST /api/auth/register` exists to
fill that gap — it's how a team member gets an account in the first place.

## API reference

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.
Every response is `{ "success": true, "data": ... }` or `{ "success": false, "error": { "message": "..." } }`.

| Method & path | Does |
|---|---|
| `GET /api/health` | Smoke test — returns `server working` |
| `POST /api/auth/register` | `{ name, email, password }` → creates a user, returns `{ user, token }` |
| `POST /api/auth/login` | `{ email, password }` → `{ user, token }` |
| `GET /api/users` | List team members (for the assignee picker) |
| `POST /api/projects` | `{ name }` → creates a project |
| `GET /api/projects` | List all projects |
| `POST /api/projects/:projectId/tasks` | `{ title, assigneeId?, dueDate? }` → creates a task as "To Do" |
| `GET /api/projects/:projectId/tasks` | Tasks grouped by status: `{ "To Do": [...], "In Progress": [...], "Done": [...] }` |
| `PATCH /api/tasks/:taskId/status` | `{ status }` → moves a task between columns |
| `PATCH /api/tasks/:taskId` | `{ title?, assigneeId?, dueDate? }` → partial edit |
| `DELETE /api/tasks/:taskId` | Removes a task |
| `POST /api/projects/:projectId/tasks/voice/parse` | Preview a voice command without creating anything |
| `POST /api/projects/:projectId/tasks/voice` | Parse **and** create the task in one call |

A task in any response looks like:
```json
{
  "id": 4, "projectId": 2, "title": "Design homepage mockup",
  "status": "To Do", "dueDate": "2026-07-20", "isOverdue": false,
  "createdAt": "2026-07-14T03:14:13.473Z", "updatedAt": "2026-07-14T03:14:13.473Z",
  "assignee": { "id": 1, "name": "Asha Rao", "email": "asha@example.com" }
}
```
`isOverdue` is computed server-side (`due_date < today AND status != 'Done'`) so the
front end doesn't have to duplicate that logic per the "mark overdue tasks" requirement.

## Voice task assignment

Say (or paste the transcript of) something like *"Assign the homepage redesign to
Asha for next Friday"* and it becomes a real task — same validation, same database
row, same shape as one typed into the manual form. Voice is a second **input**
method into the exact same `tasksService.createTask()`, not a separate system, so
**the manual "Add task" form keeps working exactly as before, whether or not voice
is configured.**

**How it works:** transcript (or audio) → Groq Whisper transcribes it if needed →
Groq LLM extracts `{ title, assigneeName, dueDate }` as JSON → the assignee name is
matched against your *real* team roster in code (the LLM's guess is never trusted
blindly — only a roster match is used) → the same manual-creation function runs.

**Two ways to call it**, both accepting either a JSON `{ "transcript": "..." }` body
or a multipart `audio` file field (so you can do speech-to-text in the browser via
the Web Speech API and send text, or record raw audio and let the server transcribe
it — whichever fits your frontend):

- `.../tasks/voice/parse` — returns the parsed draft only, nothing is created. Good
  for a "here's what I heard, confirm?" UI before committing.
- `.../tasks/voice` — parses and creates in one call, for a fully hands-free flow.

```bash
curl -X POST http://localhost:4000/api/projects/1/tasks/voice \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"transcript":"assign fix the login bug to asha, due tomorrow"}'
```

**Configuration** — set these in `.env` to turn it on (get a free key at
[console.groq.com/keys](https://console.groq.com/keys)):
```
GROQ_API_KEY=your-key-here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_TRANSCRIBE_MODEL=whisper-large-v3-turbo
```
These are **optional** — everything else in the app works with them unset. Without
a key, both voice endpoints return a clean `503` explaining that and pointing back
at the manual form; a network/upstream failure returns a clean `502` for the same
reason. Neither can crash the server or block the rest of the API — verified in
`scripts/smoke-test-voice.js`.

Groq's model lineup changes fairly often — `llama-3.3-70b-versatile` and
`llama-3.1-8b-instant`, for instance, were deprecated in June 2026 in favor of the
`openai/gpt-oss-*` models used as defaults here. If voice extraction quality seems
off, check [console.groq.com/docs/models](https://console.groq.com/docs/models) for
what's currently recommended.

**One honest gap:** everything in this backend was tested end-to-end against a real
local PostgreSQL instance, including the voice module's parsing logic, assignee
matching, and error handling (via a fake Groq client, so no network needed). The one
thing that could *not* be tested from this sandbox is a real call to Groq's API
itself — that domain isn't reachable from here. Run `npm run smoke:voice` after
adding a real `GROQ_API_KEY` and firing one request through `/voice/parse` to
confirm the live extraction quality before relying on it.

## Testing

Two smoke-test scripts stand in for the "test every API with Postman" step from the
spec — rerun them after any change instead of manually re-clicking through Postman:

```bash
npm run smoke:voice        # talks to the DB directly — no server needed
npm run dev &                # in one terminal
npm run smoke:api           # in another — 26 checks against every endpoint
```

`smoke-test-api.js` covers the full v1 surface: register/login, duplicate-email and
wrong-password rejection, project + task CRUD, dragging a task between columns and
confirming it persists after a refetch, overdue detection, and 400/404 edge cases.

`smoke-test-voice.js` covers the voice module in two layers: pure-function unit
tests for prompt building, JSON-response parsing, assignee fuzzy-matching, and date
validation (no network or DB); then an integration test that injects a fake Groq
client to exercise the full create-a-task-from-a-voice-command pipeline against the
real database, including the "assignee couldn't be matched" and "model returned
nothing usable" failure paths.

## Not included (matches the spec's "Not in version 1")

Sub-tasks/comments, multiple workspaces, custom statuses, calendar/notifications,
pagination, rate limiting, refresh tokens, security headers (helmet). Worth adding
before this goes further than a small team's internal tool.
