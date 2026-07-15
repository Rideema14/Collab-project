# Kuberya — Frontend Architecture

> A production-grade project-management platform (ClickUp / Linear / Notion / Jira / Monday
> class) built on an **immutable** 3-table backend. Because the backend only persists
> `auth`, `users`, `projects`, and `tasks` (with a fixed `To Do / In Progress / Done`
> enum and **no** hierarchy, custom statuses, realtime, or rich task model), the platform
> uses a **client-persisted domain layer**: the real backend is the source of truth for what
> it owns; everything else lives in Redux + Redux Persist (localStorage) so the experience
> is fully interactive and survives refresh. This is an honest architecture — no fake
> server data, and a single documented seam (`backendApi`) to promote any feature to the
> server the day the backend grows it.

**Domain mapping decision:** a real backend `project` **is a List**. Workspace → Space →
Folder are client-side organizational layers above it; Tasks live in Lists.

```
Workspace (client)                    ← Redux, persisted
 └─ Space (client)                    ← Redux, persisted   (colored, custom statuses live here)
     └─ Folder (client, optional)     ← Redux, persisted
         └─ List  ═══════════════════ ← BACKEND project (id, name)   ← source of truth
             └─ Task ════════════════ ← BACKEND task (title, status, assignee, dueDate)
                 └─ rich fields       ← Redux, persisted   (subtasks, checklists, tags,
                                          dependencies, watchers, comments, attachments…)
```

---

## 1. Feature Map

| Domain | Feature | Backend? | Where it lives |
|---|---|:--:|---|
| **Auth** | Login / Register / session | ✅ | `backendApi` + `auth` slice |
| **Hierarchy** | Workspaces, Spaces, Folders | ❌ | `hierarchy` slice (persisted) |
| | Lists | ✅ (=project) | `backendApi.projects` mirrored into `hierarchy` |
| **Statuses** | Custom statuses: create/edit/reorder/color, grouped (Not started / Active / Done) | ❌ | `statuses` slice (persisted). Board columns are **status-driven, never hardcoded**. Backend 3-enum is one of many client statuses; changes to a backend-known status sync via `updateStatus`, others are client-only |
| **Tasks** | Title, assignee, due date, status | ✅ | `backendApi.tasks` |
| | Subtasks, checklists, attachments, tags, dependencies, watchers, priority, time estimate, custom fields, cover | ❌ | `tasks` slice `richById` (persisted) |
| | Comments (threaded) + reactions | ❌ | `comments` slice (persisted) + realtime bus |
| | Activity log (per task + per list) | ❌ | `activity` slice (persisted) |
| **Views** | Board, List, Table, Calendar, Timeline, Workload, Gantt | mixed | `features/views/*`, all read the same normalized selector |
| **Realtime** | Drag/updates, comments, notifications, presence | ❌ | `socket` middleware → Socket.IO if `NEXT_PUBLIC_SOCKET_URL` set, else `BroadcastChannel` cross-tab bus. Same event contract either way |
| **Enterprise** | Roles, permissions, audit log, workspace settings, team management | ❌ (users list ✅) | `org` slice (persisted) + `settings/*`. Enforced **client-side only** — clearly labeled, since the API has no authz |
| **AI** | Assistant, Sprint Planner, Risk Center, Project Health, Standup Generator | ❌ (voice ✅) | `features/ai/*` — frontend-ready panels; deterministic local heuristics over the store, voice uses the real Groq endpoint |
| **Command** | ⌘K palette, global search, quick-create | n/a | `shell/CommandPalette` |

---

## 2. Route Map (Next.js 15 App Router)

```
/(auth)
  /login                       real backend
  /register                    real backend
/(app)                         AppShell (sidebar + topbar + palette + presence)
  /home                        My Work — cross-list dashboard (assigned to me, due soon)
  /inbox                       Notifications feed
  /w/[spaceId]                 Space overview (lists, members, status set)
  /list/[listId]               List workspace — the 7 views:
      ?view=board  (default)
      ?view=list
      ?view=table
      ?view=calendar
      ?view=timeline
      ?view=workload
      ?view=gantt
  /list/[listId]/task/[taskId] Task detail (modal-over-route / deep page)
  /dashboards                  AI Project Health
  /ai                          AI Assistant hub (Sprint Planner, Risk, Standup)
  /settings
      /general                 Workspace settings
      /members                 Team management (real users list)
      /roles                   Roles & permissions (client-side model)
      /statuses                Status set manager
      /audit                   Audit log
```

View is a **query param**, not a sub-route: switching Board↔Table keeps scroll/filter state
and avoids a full route remount.

---

## 3. Redux Architecture

Single store (factory-per-client for Next SSR safety), **Redux Persist** on the client-owned
slices, **RTK Query** for the backend, custom **socket middleware** for realtime.

```
store
├── backendApi        (RTK Query)  auth, users, projects(=lists), tasks(board/crud), voice
├── auth              token, current user                          ┐
├── hierarchy         workspaces, spaces, folders, list-meta       │
├── statuses          status sets (per space) + ordering + colors  │ persisted
├── tasks             richById (subtasks/checklists/tags/deps/…),  │ (redux-persist,
│                     view prefs, filters, grouping                │  localStorage,
├── comments          byTaskId threads                             │  whitelist)
├── activity          audit/activity entries                       │
├── notifications     in-app feed + unread                         │
├── org               roles, permissions, members meta, auditLog   │
├── ui                sidebar, palette, modals, active view        ┘
└── presence          online users, cursors, "typing"  (NOT persisted — live only)
```

- **Normalized** entity tables keyed by id; components read via memoized selectors.
- **Optimistic** task mutations: RTK Query `onQueryStarted` patches the board cache
  immediately, rolls back on error, and emits a socket event.
- `backendApi` tag types: `Projects`, `Board`, `Users` → precise invalidation.
- Persist migration/version field so a shape change doesn't corrupt saved state.

---

## 4. Component Hierarchy

```
RootLayout (providers: Store → Persist → Theme → Toast → Auth → Socket)
└── (app)/layout → AppShell
    ├── Sidebar
    │   ├── WorkspaceSwitcher
    │   ├── HierarchyTree (Space ▸ Folder ▸ List, collapsible, dnd-reorder)
    │   ├── PinnedViews / Favorites
    │   └── SidebarFooter (invite, settings)
    ├── Topbar (Breadcrumbs · Search · PresenceStack · Notifications · ThemeToggle · UserMenu)
    ├── CommandPalette (⌘K)
    └── page
        └── ListWorkspace
            ├── ListHeader (name, view tabs, ViewControls: filter/sort/group/search)
            ├── StatusManagerPopover  (create/edit/reorder/color statuses)
            └── ViewSwitch
                ├── BoardView   → StatusColumn* → TaskCard*        (dnd-kit sortable)
                ├── ListView    → StatusGroup*  → TaskRow*
                ├── TableView   → column model, inline edit
                ├── CalendarView, TimelineView, WorkloadView, GanttView
                └── TaskDetail (Drawer/Modal)
                    └── Tabs: Details · Subtasks · Checklists · Comments · Activity · Files

Design system (features/../components/ui):
  primitives: cn, Button, Input, Textarea, Dialog, Drawer, DropdownMenu, Popover,
  Tooltip, Tabs, Checkbox, Select, Avatar/AvatarStack, Badge, Separator, Switch,
  ScrollArea, Command, Skeleton, Kbd, ColorSwatch, EmptyState, Toast
```

---

## 5. Socket Architecture

One event contract, two transports, chosen at runtime — so realtime works today with **no
server** (cross-tab) and lights up a real Socket.IO server the moment one exists.

```
lib/realtime/
  events.ts     RealtimeEvent union: task:moved | task:updated | task:created |
                task:deleted | comment:added | presence:sync | presence:cursor |
                notification:new
  bus.ts        transport abstraction:
                  - if NEXT_PUBLIC_SOCKET_URL → socket.io-client (rooms: list:{id})
                  - else → BroadcastChannel('kuberya-rt') for real cross-tab sync
  socketMiddleware.ts   Redux middleware:
                  outbound: whitelisted actions → bus.emit(event)
                  inbound:  bus.on(event) → dispatch(local reducer)  (idempotent, origin-tagged
                            to skip echoes)
```

Presence: on shell mount, join `list:{id}`, broadcast `presence:sync` heartbeat; render the
`PresenceStack`. "Someone is typing…" on comments via `presence:cursor`.

---

## 6. Design System

Built **on the existing semantic-token layer** (`globals.css` core→semantic→component,
light/dark by token swap). We add a shadcn/ui-style primitive set (Radix behavior + our
tokens via `cn()` = `clsx` + `tailwind-merge`), so components are accessible and consistent.

- **Tokens:** spacing/radius/shadow/z + semantic colors (`surface`, `text`, `primary`,
  `success/warning/danger`) — already present, extended with `--elevation`, status-color
  channels, and a `chart-*` ramp for analytics.
- **Status colors:** each custom status stores an HSL hue; the UI derives a soft bg / solid
  dot / readable fg from it, validated for AA in both themes.
- **Motion (Framer Motion):** shared transition tokens (`ease`, `dur`), list reordering,
  drawer/modal, view cross-fade, presence pop. Respects `prefers-reduced-motion`.
- **Typography:** Inter (self-hosted via `next/font`), type scale from tokens.
- **Density:** comfortable / compact toggle (table + list).

---

## 7. Screen Inventory

| # | Screen | Key components | Data |
|---|---|---|---|
| 1 | Login / Register | AuthCard, Field, Button | backend auth |
| 2 | Home / My Work | StatCards, DueSoon, AssignedToMe | store selectors over board |
| 3 | Inbox | NotificationList | notifications slice |
| 4 | Space overview | ListGrid, MemberStack, StatusLegend | hierarchy + users |
| 5 | **Board view** | StatusColumn, TaskCard, StatusManager, AddCard | board + rich + statuses |
| 6 | **List view** | StatusGroup, TaskRow, inline edit | same |
| 7 | **Table view** | ColumnHeader, editable cells, column picker | same |
| 8 | Calendar view | MonthGrid, day cells, drag-to-reschedule | tasks by dueDate |
| 9 | Timeline / Gantt | lanes, bars, dependency arrows | tasks + dependencies |
| 10 | Workload view | per-assignee capacity bars | tasks by assignee |
| 11 | Task detail | Tabs (Details/Subtasks/Checklists/Comments/Activity/Files) | task + rich + comments |
| 12 | AI Assistant | ChatPanel, quick actions | local heuristics + voice |
| 13 | AI Sprint Planner | capacity + suggestion cards | store analysis |
| 14 | AI Risk Center | risk scoring table | overdue/blocked heuristics |
| 15 | AI Project Health | KPI dashboard, charts | store analytics |
| 16 | AI Standup | generated digest | activity + board diff |
| 17 | Settings: General/Members/Roles/Statuses/Audit | forms, tables | org + statuses + users |
| 18 | Command palette | Command, results groups | everything |

**First delivery (this iteration):** §1–6 foundation + Board / List / Table (screens 5–7) +
Status manager + shell + realtime bus. Remaining views and AI/enterprise screens are
scaffolded behind the same data layer and filled in subsequent iterations.
