# Task Board — Frontend

Next.js (App Router) · TypeScript · Tailwind CSS · dnd-kit.
Built against the Express backend in `../backend`, to the standards in
`docs/Kuberya_Frontend_Playbook.pptx`.

## Setup

The backend must be running first (see `../backend/README.md`).

```bash
npm install
cp .env.local.example .env.local   # points at http://localhost:4000
npm run dev                        # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Environment

`NEXT_PUBLIC_API_URL` is the only variable, and it is the only one there should ever be.
`NEXT_PUBLIC_*` values are inlined into the browser bundle, so **no secret may ever go in
this file** — API keys and the JWT secret live in the backend's `.env` and never leave the
server (Playbook: *Zero Secrets Policy*).

## Screens

| Route | Purpose |
|---|---|
| `/login`, `/register` | Obtain a JWT. Redirect to `/projects` when already signed in. |
| `/projects` | All projects; create a new one. |
| `/projects/[projectId]` | The three-column board: add / edit / move / delete tasks, plus voice capture. |

## Architecture

```
src/
  app/                     routes (App Router)
  components/
    ui/                    Button, Field, Modal, States, Badge, Avatar, Spinner
    board/                 BoardColumn, TaskCard, TaskFields, TaskFormModal,
                           DeleteTaskDialog, VoiceTaskModal
    layout/                AppHeader, RequireAuth
    auth/                  AuthCard
  lib/
    api/client.ts          the ONLY place fetch is called
    api/endpoints.ts       the ONLY place a URL is constructed
    types.ts               response shapes, transcribed from the backend
    board.ts               pure, immutable board transforms
    auth-context.tsx       JWT session (localStorage)
    theme-context.tsx      light/dark token swap
    toast-context.tsx      transient notifications
    format.ts              date + initials formatting
```

**The API boundary is sealed.** `endpoints.ts` is the complete surface of the backend as
implemented; no component builds a URL or calls `fetch`. If the backend changes, exactly
two files move: `endpoints.ts` and `types.ts`.

### Design tokens

Four levels, per the Playbook (`app/globals.css`):

**base** (spacing, radius, shadow, z-index) → **core** (raw palette, the only place a hex
literal appears) → **semantic** (`surface`, `text`, `danger`, …) → **component**.

`tailwind.config.ts` *replaces* Tailwind's palette rather than extending it, so
`bg-blue-500` doesn't exist and a component **cannot** reach past the semantic layer.
That's what makes dark mode a token swap: only the semantic block is re-pointed under
`[data-theme='dark']` — no component changed. An inline script in `layout.tsx` stamps the
theme before first paint, so there's no flash.

### The four UI states

Every dynamic view ships loading / empty / error / success. `components/ui/States.tsx`
(`Skeleton`, `EmptyState`, `ErrorState`) exists so this can't be skipped. Skeletons mirror
the real layout, so nothing shifts when data lands (CLS).

## Decisions worth knowing

**Moving a task is optimistic.** The card lands in its new column immediately; the server's
response then reconciles it (it recomputes `isOverdue`). If the `PATCH` fails, the board is
restored from a snapshot **and a toast says so** — a silent revert reads as a bug.

**Drag-and-drop is not the only way to move a card.** Every card also has a `⋮` menu with
explicit "Move to" actions. Drag alone is unusable by keyboard and fails the Playbook's a11y
gate, so the menu is the accessible path, not a nice-to-have. Both call the same endpoint.
Keyboard drag (dnd-kit's `KeyboardSensor`) is wired up too, with screen-reader announcements.

**Voice parses first, then asks.** `POST /voice/parse` writes nothing, so the user reviews an
editable draft — transcript, title, assignee, due date, plus any warnings the backend raised
about a name it couldn't match — and only then confirms. The confirmed draft is created via
the **normal** `POST /tasks` endpoint, so there is no second write path. (The backend also
offers a one-shot `POST /voice` that parses *and* creates; we deliberately don't use it,
because a mis-heard name silently landing on the board is worse than one the user could fix.)
When `GROQ_API_KEY` is unset the backend returns 503 and the modal shows that message
verbatim; the manual form is unaffected. A typed-text fallback hits the same parser, so the
feature works without a microphone.

**`isOverdue` comes from the server** (`due_date < CURRENT_DATE AND status <> 'Done'`) and is
rendered, never recomputed — except during the ~200 ms of an optimistic move, where
`lib/board.ts` mirrors the rule exactly so a task moved to Done doesn't keep a stale red badge.

**A 401 means two different things.** On `/api/auth/*` it's "wrong credentials"; anywhere else
it's "your session is dead" (→ clear the token, redirect to `/login`). `api/client.ts` exempts
the auth routes from the global interceptor. Conflating them made a failed login report *"Your
session has expired"* to a user who had never signed in.

**Project creation refetches the list.** `POST /api/projects` returns `createdBy: { id }`
without the creator's *name*, so its response isn't list-shaped. Appending it directly would
render a project with a missing author.

## Verified

Not "it compiles" — actually driven, against the real backend (`src/app.js`: real routes,
middleware, services and SQL).

**Functional** — 17 flows in Chromium, no unhandled JS errors: sign-in validation ·
wrong-password error · login → projects → board · add task with assignee and due date ·
move via `⋮` menu · drag between columns · move persists across reload · overdue badge
clears on Done · editing preserves the due date · delete with confirmation · voice 503
surfaced verbatim · dark theme · 390 px with no horizontal scroll · unknown-project error
state with retry · invalid token bounces to `/login`.

**Accessibility** — axe-core, WCAG 2 A + AA, across 18 scans (every screen, both themes,
plus the create/edit/voice modals and the open `⋮` menu): **0 violations**. Keyboard-only
navigation reaches the board with a visible focus ring.

**Performance** — Lighthouse, mobile profile:

| | `/login` | `/register` | Target |
|---|---|---|---|
| Performance | 99 | 98 | ≥ 90 |
| Accessibility | 100 | 100 | — |
| Best practices | 100 | 100 | — |
| SEO | 100 | 100 | — |
| LCP | 1.4 s | 1.7 s | < 2.5 s |
| CLS | 0 | 0 | < 0.1 |

The board isn't in the Lighthouse table because it's behind auth — a cold, cookie-less
load would only ever measure the redirect to `/login`.

### What the audits caught

Both were invisible to the eye and to the type-checker:

1. **A dark-mode contrast failure.** The assignee avatar's initials used `--color-primary`
   on a translucent `primary-soft` surface, compositing to **3.96:1** — under the 4.5:1 AA
   floor for small text. The root cause was a *missing token*: there was no semantic slot
   for "text on a tinted primary surface", so a token tuned for contrast against the page
   background got reused where it didn't hold. Fixed by adding `--color-primary-on-soft`
   (one line per theme), which is precisely the payoff the token hierarchy exists for.
2. **The 401 conflation**, described above.

## Known gaps (backend-imposed)

These are **not** implementable against the API as it stands — see
`docs/BACKEND_REPORT.md` §7.

- **No reordering within a column.** There's no `position` column, so cards can move
  *between* columns but not be sorted *inside* one.
- **No rename/delete for projects.** Those endpoints don't exist.
- **The board title costs a full project-list fetch**, because there's no `GET /api/projects/:id`.
- **No roles.** Every authenticated user can see and edit everything, so there is no admin UI
  to build — adding one would be decoration over an API that doesn't enforce it.
