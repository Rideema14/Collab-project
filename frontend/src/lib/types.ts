/**
 * These types mirror the backend's response shapes exactly. They are
 * transcribed from the service-layer shaping functions, not guessed:
 *
 *   User    <- auth.service.shapeUser / users.repository.findAll
 *   Project <- projects.service.shapeProject
 *   Task    <- tasks.service.shapeTask
 *   Board   <- tasks.service.getBoard
 *
 * If the backend changes shape, this file is the single place to update.
 */

/** The three fixed columns. Backed by the `task_status` Postgres enum. */
export const STATUSES = ['To Do', 'In Progress', 'Done'] as const;
export type Status = (typeof STATUSES)[number];

/** GET /api/users — also the shape of `task.assignee`. */
export interface User {
  id: number;
  name: string;
  email: string;
}

/** The authenticated user, as returned inside the login/register payload. */
export type AuthUser = User;

export interface Project {
  id: number;
  name: string;
  createdAt: string;
  /**
   * NOTE: `GET /api/projects` returns `{ id, name }` here, but the 201 body of
   * `POST /api/projects` returns only `{ id }` — the backend doesn't have the
   * creator's name on hand at insert time. Hence `name` is optional, and the
   * projects page refetches the list after a create rather than trusting the
   * create response to be list-shaped.
   */
  createdBy: { id: number; name?: string };
}

export interface Task {
  id: number;
  projectId: number;
  title: string;
  status: Status;
  /** 'YYYY-MM-DD' or null. The backend pins DATE to a plain string (config/db.js). */
  dueDate: string | null;
  /** Computed server-side: due in the past AND not Done. Never recompute this client-side. */
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  assignee: User | null;
}

/** GET /api/projects/:projectId/tasks — tasks arrive pre-grouped into columns. */
export type Board = Record<Status, Task[]>;

/** POST /api/projects/:projectId/tasks/voice/parse */
export interface VoiceParseResult {
  projectId: number;
  transcript: string;
  parsed: {
    title: string;
    dueDate: string | null;
    assignee: User | null;
    /** The name the model *heard*, which may not resolve to a real member. */
    assigneeNameHeard: string | null;
  };
  warnings: string[];
}

export interface AuthPayload {
  user: AuthUser;
  token: string;
}
