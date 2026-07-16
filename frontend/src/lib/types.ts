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

// ---------- AI Workspace Assistant ----------

/** A filter the AI produces to target one or many tasks for a bulk action. */
export interface AiFilter {
  project?: string;
  assignee?: string;
  status?: string;
  priority?: string;
  overdue?: boolean;
  dueThisWeek?: boolean;
  dueToday?: boolean;
  text?: string;
}

/** One structured action in an AI plan. Kept loose (extra fields per type). */
export interface AiAction {
  type: string;
  project?: string;
  name?: string;
  title?: string;
  task?: string;
  assignee?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  color?: string;
  group?: string;
  filter?: AiFilter;
}

/** The plan returned by POST /api/ai/command. */
export interface AiPlan {
  reply: string;
  actions: AiAction[];
  needsConfirmation: boolean;
  confirmationPrompt: string;
}

// ---------- Meetings ----------

/** The four fixed meeting types. Backed by a validated VARCHAR(30), not an enum. */
export const MEETING_TYPES = ['Daily Standup', 'Weekly Review', 'Sprint Review', 'Custom'] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export type MeetingStatus = 'scheduled' | 'context_ready' | 'cancelled';

export interface MeetingParticipant {
  id: number;
  name: string;
  email: string;
  inviteStatus: string;
  invitedAt: string | null;
}

export interface Meeting {
  id: number;
  title: string;
  type: MeetingType;
  /** ISO datetime string. */
  scheduledAt: string;
  /** Admin-entered join link (Zoom/Meet/Teams/etc), or null. Included in invite emails. */
  meetingUrl: string | null;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string; email: string };
  projects: { id: number; name: string }[];
  participants: MeetingParticipant[];
}

/** One participant's slice of a meeting context package. Current-state only — see `limitations`. */
export interface MeetingContextTask {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  status: string;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface MeetingContextParticipant {
  userId: number;
  name: string;
  email: string;
  assignedTasks: MeetingContextTask[];
  completedTasks: MeetingContextTask[];
  overdueTasks: MeetingContextTask[];
  upcomingDeadlines: MeetingContextTask[];
}

export interface MeetingContextPayload {
  schemaVersion: number;
  /** null for a pre-creation preview (POST /api/meetings/preview-context) — no meeting exists yet. */
  meetingId: number | null;
  generatedAt: string;
  projects: { id: number; name: string }[];
  /** Explicit list of what this package does NOT contain and why — always render this. */
  limitations: string[];
  participants: MeetingContextParticipant[];
}

/** A context task stamped with who it's assigned to — used in the flat (non-nested) Meeting Bot context. */
export interface MeetingBotTask extends MeetingContextTask {
  assigneeId: number;
  assigneeName: string;
}

/**
 * Flat, structured data dump for GET/POST /api/meetings/:meetingId/context — built
 * for an external Meeting Bot to consume directly. No agenda/summary/questions/
 * risks/recommendations are generated; this is current-state task data only.
 */
export interface MeetingBotContext {
  schemaVersion: number;
  meetingId: number;
  generatedAt: string;
  meeting: Meeting;
  participants: MeetingParticipant[];
  projects: { id: number; name: string }[];
  assignedTasks: MeetingBotTask[];
  completedTasks: MeetingBotTask[];
  activeTasks: MeetingBotTask[];
  overdueTasks: MeetingBotTask[];
  deadlines: MeetingBotTask[];
  /** Explicit list of what this package does NOT contain and why — always render this. */
  limitations: string[];
}

/** GET/POST /api/meetings/:meetingId/context */
export interface MeetingContextPackage {
  meetingId: number;
  generatedAt: string;
  payload: MeetingBotContext;
}
