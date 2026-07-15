/**
 * The client-side domain model for the full platform.
 *
 * WHY THIS EXISTS
 * ---------------
 * The backend persists only four things: users, projects, tasks (with a fixed
 * `To Do | In Progress | Done` enum), and auth. It has no concept of a workspace
 * hierarchy, custom statuses, subtasks, comments, tags, dependencies, roles, or
 * realtime. The backend is immutable.
 *
 * Rather than fake server data, the platform models the full ClickUp-class domain
 * HERE, on the client, and persists it with Redux Persist. The mapping is:
 *
 *   Workspace → Space → Folder → List(=backend project) → Task(=backend task)
 *
 * A `List` mirrors a backend project (its `backendProjectId` is the real project id).
 * A `Task`'s canonical fields (title/status/assignee/dueDate) live on the server; its
 * RICH fields (subtasks, checklists, tags, …) live in `TaskRich`, keyed by the same id.
 *
 * Every type here that has no backend equivalent is marked CLIENT-ONLY.
 */

import type { User } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchy (CLIENT-ONLY, except List which mirrors a backend project)
// ─────────────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  /** Accent hue (0–360) used for the workspace avatar. */
  hue: number;
  createdAt: string;
}

export interface Space {
  id: string;
  workspaceId: string;
  name: string;
  /** Short icon (emoji or single glyph) shown in the tree. */
  icon: string;
  hue: number;
  /** Which status set this space uses. Statuses are defined per space. */
  statusSetId: string;
  order: number;
  createdAt: string;
}

export interface Folder {
  id: string;
  spaceId: string;
  name: string;
  order: number;
  collapsed?: boolean;
  createdAt: string;
}

/**
 * A List mirrors a backend project. `backendProjectId` is the real id used for all
 * task reads/writes. `spaceId`/`folderId` place it in the client hierarchy.
 */
export interface List {
  id: string;
  /** The real backend project id — the source of truth for this list's tasks. */
  backendProjectId: number;
  spaceId: string;
  /** null = directly under the space (no folder). */
  folderId: string | null;
  name: string;
  order: number;
  /** Optional per-list status-set override; falls back to the space's set. */
  statusSetId?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statuses (CLIENT-ONLY) — the core "no hardcoded Todo/In Progress/Done" requirement
// ─────────────────────────────────────────────────────────────────────────────

/** The three semantic buckets every board rolls up to, ClickUp-style. */
export type StatusGroup = 'not_started' | 'active' | 'done';

export interface StatusDef {
  id: string;
  name: string;
  /** HSL hue 0–360; the UI derives dot / soft-bg / readable-fg from this. */
  hue: number;
  group: StatusGroup;
  order: number;
  /**
   * If this status maps onto a backend enum value, moving a task into it also
   * PATCHes the server. Client-only statuses (null) are persisted locally only.
   */
  backendStatus: 'To Do' | 'In Progress' | 'Done' | null;
}

export interface StatusSet {
  id: string;
  name: string;
  statuses: StatusDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich task model (CLIENT-ONLY extensions keyed by backend task id)
// ─────────────────────────────────────────────────────────────────────────────

export type Priority = 'urgent' | 'high' | 'normal' | 'low' | 'none';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  assigneeId: number | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface Tag {
  id: string;
  label: string;
  hue: number;
}

export type DependencyType = 'blocks' | 'blocked_by' | 'relates_to';

export interface Dependency {
  id: string;
  /** The other task's backend id. */
  taskId: number;
  type: DependencyType;
}

export interface Attachment {
  id: string;
  name: string;
  /** Object URL or data URL — client-only, never uploaded (no backend endpoint). */
  url: string;
  size: number;
  mime: string;
  addedAt: string;
}

/**
 * Everything about a task the backend cannot store. Keyed by the backend task id.
 * The task's title/status/assignee/dueDate are NOT duplicated here — those come
 * from the server task. `statusId` overrides the coarse backend status with a
 * fine-grained client status when one is set.
 */
export interface TaskRich {
  taskId: number;
  /** Fine-grained client status id (from the list's status set). */
  statusId: string | null;
  priority: Priority;
  /** Effort estimate in minutes. */
  estimateMinutes: number | null;
  timeSpentMinutes: number;
  description: string;
  subtasks: Subtask[];
  checklists: Checklist[];
  tagIds: string[];
  dependencies: Dependency[];
  /** User ids watching this task. */
  watcherIds: number[];
  attachments: Attachment[];
  /** Manual ordering within a status column (backend has no position column). */
  order: number;
  coverHue: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comments (CLIENT-ONLY)
// ─────────────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  taskId: number;
  authorId: number;
  body: string;
  createdAt: string;
  /** Emoji → user ids. */
  reactions: Record<string, number[]>;
  /** Parent comment id for threading, or null for a root comment. */
  parentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Org / RBAC (CLIENT-ONLY — the API has NO authorization; this is UI-level only)
// ─────────────────────────────────────────────────────────────────────────────

export type Permission =
  | 'task.create'
  | 'task.edit'
  | 'task.delete'
  | 'status.manage'
  | 'member.manage'
  | 'space.manage'
  | 'settings.manage';

export interface Role {
  id: string;
  name: string;
  color: string;
  permissions: Permission[];
  /** Built-in roles can't be deleted. */
  system?: boolean;
}

export interface MemberMeta {
  userId: number;
  roleId: string;
  /** Capacity in hours/week, used by the Workload view. */
  capacityHours: number;
  status: 'active' | 'invited';
}

export interface AuditEntry {
  id: string;
  actorId: number;
  action: string;
  target: string;
  at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composed view models (built by selectors; not stored)
// ─────────────────────────────────────────────────────────────────────────────

/** A backend Task fused with its client rich fields + resolved status. */
export interface TaskVM {
  id: number;
  listId: string;
  title: string;
  assignee: User | null;
  dueDate: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  status: StatusDef;
  rich: TaskRich;
}
