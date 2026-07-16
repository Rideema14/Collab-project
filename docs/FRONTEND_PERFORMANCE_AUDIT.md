# Frontend Performance Audit

**Date:** 2026-07-16 · **Measured on:** `next build` (production), not `next dev` — this codebase's own history shows dev-mode Lighthouse (~34) is meaningless next to prod (~92); every number below is from a clean prod build.

---

## 0. Baseline numbers

```
Route                    Size      First Load JS
/                        124 B     103 kB
/admin                   12.3 kB   155 kB
/ai                      3.92 kB   153 kB
/chat                    5.55 kB   149 kB
/home                    6.77 kB   220 kB
/inbox                   4.11 kB   128 kB
/list/[listId]           34.2 kB   250 kB   ← AT the target ceiling
/login                   5.5 kB    111 kB
/people                  3.51 kB   147 kB
/register                5.31 kB   111 kB
+ shared by all          102 kB  (chunks/255: 46kB, chunks/4bd1b696: 54.2kB, other: 2.18kB)
```

**Target check, as requested:**

| Target | Status |
|---|---|
| Lighthouse 95+ | Not directly measured this pass (would need a live Lighthouse run against a served build), but every mechanism that suppresses a Lighthouse score is identified below: blank-screen hydration block, N+1 network waterfalls on the landing page, and two routes with no code-splitting. |
| First Load JS under 250KB | **Failing on `/list/[listId]`** (exactly at 250kB — effectively over once any future line is added) and **at risk on `/home`** (220kB, zero headroom, zero code-splitting). |
| Fast refresh restoration | At risk — PersistGate blocks the entire tree with no fallback UI, and the payload it has to parse can be unbounded (see §2). |
| Minimal rerenders | Failing in 3 identified places — sidebar, the central task-list join hook, and TableView. |
| Smooth drag and drop | **Already achieved.** BoardView.tsx came back clean — see §6. Nothing to fix here; flagged so it isn't accidentally regressed while fixing everything else. |

---

## 1. Largest bottlenecks, ranked

Each entry: what it is → files → estimated impact → fix. Ranked by how much it costs against the stated targets, not by category.

### 🔴 1. Attachments stored as base64 in persisted Redux state — no cap on count, silent data-loss risk

**Files:** `frontend/src/features/task/TaskDetailDrawer.tsx:689,701` (512KB per-file cap only) · `frontend/src/store/slices/tasksSlice.ts:192-217` (`addAttachment`) · `frontend/src/store/store.ts:165-169` (`writeFailHandler`)

**Impact:** A file's own code comment already half-flags this, but the actual numbers are worse than the comment implies. Base64 inflates a 512KB file to ~683KB in the JSON payload. **3 near-cap attachments across a 50-task workspace ≈ 2.2MB of persisted state, of which 93% is attachment data.** There is no cap on attachment *count* — a more realistic spread (say, 50 tasks × 3 files each) computes to **~100MB**, an order of magnitude over any browser's ~5-10MB origin quota. When `localStorage.setItem` throws on quota, `writeFailHandler` only `console.error`s — per the store's own comment, **every subsequent save silently fails from that point on**, not just the oversized write. One large attachment can silently freeze persistence for the entire workspace: new tasks, comments, status changes, everything stops saving with no user-visible warning.

**Fix:** Cap total attachment bytes per task/workspace, not just per file. More importantly, get attachment blobs out of the redux-persist path entirely — store metadata (name/size/mime) in Redux, store the actual bytes in IndexedDB (async, much larger quota, doesn't block the synchronous `JSON.stringify` PersistGate does). At minimum, make `writeFailHandler` surface a visible, actionable warning instead of a console log nobody sees.

---

### 🔴 2. PersistGate blocks the entire app behind a blank screen, sized by an unbounded payload

**File:** `frontend/src/store/StoreProvider.tsx:39` — `<PersistGate loading={null} persistor={...}>`

**Impact:** `loading={null}` renders literally nothing — not a spinner — until `redux-persist` has read `localStorage`, `JSON.parse`'d it, and run `autoMergeLevel2` reconciliation across a broad whitelist (`hierarchy, statuses, tasks, comments, chat, org, notifications, activity, customFields, time, templates, dashboard`). Because the app is a client-rendered SPA under the hood (root `layout.tsx`/`page.tsx` are server components, but the first child is the `'use client'` `StoreProvider`, which wraps 100% of interactive UI), there's no server-rendered content to soften this wait — the user sees a truly empty tab. The duration scales directly with finding #1's attachment bloat and #3's unbounded growth: this is a synchronous main-thread block whose worst case is unbounded.

**Fix:** Give `PersistGate` a real `loading` fallback (skeleton matching the app shell) so a slow rehydration reads as "loading" instead of "broken". More substantively: shrinking the payload (fixes #1 and #3) directly shrinks this window. For a deeper fix, consider splitting the persistor — rehydrate small/critical slices (`ui`, `session`-adjacent) first so first paint isn't gated on `tasks`/`chat`/`comments`, which can stream in just after.

---

### 🟠 3. Persisted state grows forever — deleted tasks are never evicted

**Files:** `frontend/src/store/slices/tasksSlice.ts` (`richById`), `commentsSlice.ts` (`byTaskId`), `customFieldsSlice.ts` (`values`) — confirmed against every `deleteTask` call site (`useListActions.ts:85-93`, `AdminView.tsx:364-444`, `useAiExecutor.ts:198,235`): none of them dispatch a removal from these slices.

**Impact:** A task's rich fields, comments, and custom-field values (and any attachments they hold) live in localStorage forever, even after the task is deleted server-side. This directly grows finding #2's blocking window over the workspace's lifetime — the app gets slower to reload the longer it's used, monotonically, with no natural ceiling. The fix pattern already exists in this codebase (`hierarchySlice.reconcileLists`, `hierarchySlice.ts:173-199`, correctly prunes lists when their backend project is deleted) — it just wasn't applied to tasks.

**Fix:** Add cleanup dispatched alongside `deleteTask` — evict the task's entries from `tasksSlice.richById`, `commentsSlice.byTaskId`, `customFieldsSlice.values`, and `timeSlice.entries`, mirroring `reconcileLists`.

---

### 🟠 4. The same "fetch every project's board" N+1 pattern is independently reimplemented three times

**Files:** `frontend/src/features/dashboard/useWorkspaceStats.ts:106-122` · `frontend/src/features/admin/AdminView.tsx:419` (`TasksTab`) · `frontend/src/features/ai/useAiExecutor.ts:101-111` (`loadAllTasks`)

**Impact:** Each of these independently does `projects.map(p => getBoard.initiate(p.id))` — one HTTP request per project, fired in parallel. For a workspace with 30-50 projects, **opening the dashboard alone fires 30-50 concurrent requests**, and it's a landing page, so this happens on nearly every session. The Admin Tasks tab and any AI bulk-query command ("show overdue tasks") each pay the same cost independently, with no shared cache between them. This is genuine network/backend load, not just a render-cost issue, and it's the most likely single cause of a slow/inconsistent `/home` Lighthouse score.

**Fix:** One shared source of truth — either a backend endpoint that returns aggregated task data across a set of projects in one round trip, or at minimum a single `useAllBoards()` hook that all three call sites share so the fan-out happens once per session (respecting RTK Query's cache) instead of three times.

---

### 🟠 5. Sidebar has zero memoization and subscribes to the entire hierarchy slice

**File:** `frontend/src/components/shell/AppSidebar.tsx` — `selectHierarchy` whole-slice subscription at line 119 (`store/selectors.ts:14`); no `React.memo` on `SpaceNode` (282), `FolderNode` (388), `ListLink` (467), or `NavItem` (227); unmemoized `.filter()` over the full folders/lists arrays inside every node instance (lines 293-294, 391).

**Impact:** Because `selectHierarchy` returns the raw slice and Immer produces a new reference on *any* hierarchy action, expanding one folder or renaming one list re-renders the **entire sidebar tree** — every space, every folder, every list row — every time, and each of those un-memoized nodes re-runs a `.filter()` over the *whole* workspace's folders/lists. Confirmed independently by two separate audit passes (rerender audit + DnD/sidebar/dashboard audit), both ranking this near the top. Contrast with `BoardView.tsx`, which does this correctly (`memo` + `useCallback`-stabilized handlers) — the fix pattern already exists elsewhere in the codebase, just not here. At 50+ combined spaces/folders/lists, this also has no virtualization, so all of it is live DOM.

**Fix:** Wrap `SpaceNode`/`FolderNode`/`ListLink`/`NavItem` in `React.memo`. Replace the raw whole-slice selector with per-id memoized selectors (the codebase already has the right pattern: `selectStatusSetForList`/`selectFieldsForList` in `selectors.ts:39-55,90-100` cache per-key via `createSelector` + a `Map` — apply the same shape here). Consider virtualization once a workspace exceeds ~50-100 combined nodes.

---

### 🟠 6. `useListData`'s central join is keyed on the *entire* workspace's rich-task data, defeating memoization everywhere downstream

**Files:** `frontend/src/features/list/useListData.ts:54-75, 132, 146, 181` · `frontend/src/store/selectors.ts:58` (`selectRichById`)

**Impact:** This is the most architecturally significant finding in the audit. `richById` (the dependency driving every list's/board's memoized task-VM join) is the whole app's rich-fields map, not scoped to the list being viewed. Editing **one** task's priority/tags/description **anywhere** in the app changes that object's reference, which invalidates the `useMemo` for **every mounted list, board, and drawer simultaneously** — and inside that memo, every single `TaskVM` object is rebuilt from scratch with no structural sharing. The practical effect: `BoardView.tsx`'s careful `React.memo`/`useCallback` work (which is otherwise excellent — see §6) gets silently defeated, because the `task` prop it receives is never referentially stable across an unrelated edit. This doesn't cause an infinite loop, but it's the reason "minimal rerenders" is hard to actually achieve anywhere in the task-list UI, no matter how well individual components are memoized.

**Fix:** Scope the selector — derive the set of task IDs actually in the current list first, then select only *those* entries from `richById` via a parameterized, per-list-cached selector (same `Map`-cache pattern as `selectFieldsForList`). Highest-effort fix in this report, but also the highest-leverage: it's the root cause capping the value of every other memoization fix.

---

### 🟠 7. `/list/[listId]` and `/home` ship large amounts of code with zero splitting outside one already-good exception

**Files:** `frontend/src/features/views/BoardView.tsx` (eager `@dnd-kit/core` + `@dnd-kit/sortable`) · `frontend/src/features/statuses/StatusManager.tsx` (eager `@dnd-kit/utilities` + `framer-motion`) · `frontend/src/features/dashboard/DashboardView.tsx` (all 11 widget types, every one framer-motion-driven via `components/domain/Charts.tsx`, rendered eagerly regardless of which widgets are actually on the board)

**Impact:** `next/dynamic` is used in exactly **one** file in the entire codebase — `ListWorkspace.tsx`, which correctly defers `ListView`/`TableView`/`CalendarView`/`WorkloadView`/`TimelineView`/`TaskDetailDrawer`. That's genuinely good work and is why `/list/[listId]`'s number isn't worse. But the *default* view (`BoardView`) and its `StatusManager` popover are not split, and together they're the reason `/list/[listId]` sits exactly at the 250kB ceiling. `/home` has no splitting at all — a user who only ever looks at 2 of the 11 possible dashboard widgets still downloads the code for all 11, including the full animation runtime.

**Fix:** Apply the exact pattern `ListWorkspace.tsx` already established, to `BoardView`/`StatusManager` and to each dashboard widget type individually (`next/dynamic` per `WidgetType`). Add `@dnd-kit/*` to `next.config.mjs`'s `optimizePackageImports` (currently only `framer-motion`/`lucide-react`). `AdminView.tsx` (603 lines) and `ChatView.tsx` (565 lines) are structurally the same risk — smaller today only because they don't also carry a chart or DnD library — and should get the same treatment before they grow into it.

---

### 🟡 8. Realtime heartbeat runs forever, for everyone, with no visibility gating

**Files:** `frontend/src/store/middleware/socketMiddleware.ts:98-103` (two `setInterval`s at `HEARTBEAT_MS = 4000`) · `frontend/src/store/StoreProvider.tsx:29-35` (dispatches `realtimeInit` unconditionally, above the auth boundary)

**Impact:** Two 4-second intervals dispatch Redux actions (`presenceSync`, `prunePresence`) indefinitely, starting as soon as *any* client mounts — including anonymous visitors on `/login`/`/register`, since `StoreProvider` sits above `AuthProvider`. Neither interval is paused via the Page Visibility API, so a backgrounded/idle tab keeps ticking (browsers throttle but don't stop background `setInterval`s). Currently low real-world cost because the one component that would re-render from this (`PresenceStack`) isn't mounted anywhere in the app today — but it's a live landmine: the moment presence UI ships, every subscribed component starts re-rendering every 4 seconds regardless of tab focus.

**Fix:** Gate both intervals behind `document.visibilityState === 'visible'` (pause/resume on `visibilitychange`), and don't dispatch `realtimeInit` until there's an authenticated session.

---

### 🟡 9. TableView has no row-level memoization at all

**File:** `frontend/src/features/views/TableView.tsx:26-32` (unmemoized sort), `:63-105` (`TableRow`, not wrapped in `React.memo`, receives a fresh inline `onOpen` closure every render, computes tag/subtask filters inline per row)

**Impact:** Every re-render of `TableView` for any reason re-sorts the full task list and re-renders every row, recomputing per-row derived data each time. Directly contrasts with `BoardView.tsx`'s `SortableCard`, which solves the identical problem correctly.

**Fix:** Wrap the sort in `useMemo` keyed on `allTasks`; wrap `TableRow` in `React.memo`; stabilize `onOpen` with `useCallback`.

---

### 🟡 10. Realtime board sync forces a full refetch on every peer instead of propagating the known patch

**File:** `frontend/src/store/middleware/socketMiddleware.ts:48, 140-147`

**Impact:** Tag scoping itself is correct (only the affected project's board is invalidated, not a blanket tag) — but every task mutation from any user triggers a **full board re-fetch** on every other connected peer viewing that project, even though the exact delta is already known (it's exactly what the *originating* client applies locally via the existing optimistic `updateQueryData` patch). On a busy shared board with several concurrent editors, traffic scales as O(peers × edits) instead of O(edits).

**Fix:** Broadcast the actual patch (task id + changed fields) and apply it via `updateQueryData` on receiving peers too, the same way the originating client already does — instead of forcing a refetch.

---

## 2. Also worth fixing (lower severity, cheap to fix)

| Finding | File | Fix |
|---|---|---|
| `ProjectsTab`'s project-delete handler does serial (non-batched) per-task `DELETE` calls | `AdminView.tsx:366-377` | `Promise.all` the deletes, or add a bulk-delete backend endpoint |
| `reconcileLists` does a redundant O(n²) `.find()` despite already building a `known` `Set` | `hierarchySlice.ts:173-199` | Use the `Set` for the lookup it already builds |
| Dashboard `aggregate()` does 7 redundant full-array scans (one per day) that could be one grouped pass | `useWorkspaceStats.ts:65-92` | Group by date once, in the existing main loop — currently sub-few-ms at real scale, but pure waste |
| List search box dispatches on every keystroke, touching the whitelisted `tasks` key, driving a full (attachment-inflated) `tasks` slice re-serialize roughly once per second while typing | `ListWorkspace.tsx:140` | Debounce the dispatch, or move `prefsByList` to its own top-level persisted key so it doesn't drag `richById` through re-serialization |
| `selectTimeForTask` reintroduces the "cheap-looking factory, expensive unmemoized body" pattern its siblings were hardened against | `selectors.ts:107-108` | Currently unused — cache it per-id the same way `selectFieldsForList` does, before anyone wires it up live |
| `SessionSync` dispatches a burst of full-slice-cloning actions immediately after login with no additional gating | `SessionSync.tsx:31-53` | Low priority — already correctly gated behind auth, just worth knowing this exists |

---

## 3. What's already good — don't regress this

- **Drag and drop (`BoardView.tsx`) is well-built.** Correct sensors/activation constraints, `closestCorners` collision detection, no per-frame `onDragOver` handler at all (dispatches only happen once on drop), cards and columns properly `React.memo`'d with `useCallback`-stabilized handlers, and the status-change mutation uses a genuinely targeted optimistic cache patch (splice + unshift, with rollback on failure) rather than a refetch. This is the reference implementation the sidebar and TableView should be brought up to.
- **RTK Query tag design is clean.** No blanket `{type:'X', id:'LIST'}`-style over-invalidation anywhere; every board invalidation is correctly scoped to its `projectId`.
- **`socket.io-client` is genuinely lazy-loaded** — only dynamically imported when `NEXT_PUBLIC_SOCKET_URL` is set; falls back to a zero-bundle-cost `BroadcastChannel` otherwise.
- **No hydration-mismatch risk found** — every `window`/`localStorage`/`document` read in the codebase is properly gated inside `useEffect`/callbacks, and the one `suppressHydrationWarning` usage is narrowly scoped and justified (theme-flash prevention).
- **The per-id memoized-selector pattern already exists** (`selectStatusSetForList`, `selectFieldsForList`) — it's the correct fix for findings #5 and #6, it just hasn't been applied there yet.

---

## 4. Suggested fix order

Roughly in order of impact-per-effort, not strict severity:

1. **Quick, high-value:** PersistGate fallback UI (§1.2) + gate the realtime heartbeat on visibility/auth (§1.8) — both small, isolated changes.
2. **Data-loss prevention (do this soon):** attachment count cap + move attachments out of the redux-persist path (§1.1) + task-delete cleanup across slices (§1.3). These compound — fixing them together is what actually shrinks PersistGate's blocking window.
3. **Bundle:** code-split `BoardView`/`StatusManager` and dashboard widgets the same way `ListWorkspace.tsx` already does everything else (§1.7) — gets `/list/[listId]` real headroom under 250kB.
4. **Rerenders:** memoize the sidebar tree (§1.5) and TableView rows (§1.9) — mechanical, low-risk, same pattern already used correctly in `BoardView.tsx`.
5. **Architectural, highest leverage:** scope `useListData`'s `richById` dependency per-list (§1.6) — hardest fix, but it's what makes every other memoization fix actually stick.
6. **Network efficiency:** consolidate the triplicated N+1 board-fetch (§1.4) and switch realtime board sync to patch-propagation instead of refetch (§1.10).
