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
  archived: boolean;
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
  /** Null for tasks created before this field existed. */
  createdBy: User | null;
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
  /** schedule_meeting only. */
  scheduledAt?: string;
  participants?: string[];
  meetingType?: string;
  meetingUrl?: string;
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

/**
 * `sent` (provider accepted the request) is the highest state this app can
 * honestly claim — EmailJS has no delivery webhook, so `delivered` exists in
 * the type for a future webhook-capable provider but is never set today.
 */
export type EmailDeliveryStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed';

export interface MeetingParticipant {
  id: number;
  name: string;
  email: string;
  inviteStatus: string;
  invitedAt: string | null;
  emailStatus: EmailDeliveryStatus;
  emailError: string | null;
  emailSentAt: string | null;
  emailDeliveredAt: string | null;
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
  /** Set once "Deploy Bot" has been clicked; null until then. */
  deployedAt: string | null;
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
  /** Heuristic: status literally named "Blocked" — no real dependency graph behind it yet. */
  blockedTasks: MeetingBotTask[];
  overdueTasks: MeetingBotTask[];
  deadlines: MeetingBotTask[];
  /** Explicit list of what this package does NOT contain and why — always render this. */
  limitations: string[];
  /** Plain-text, paragraph-based prompt built from the same data above — meant to be fed directly to an LLM by the external Meeting Bot. No AI call produced this; it's deterministic formatting. */
  narrative: string;
}

/** GET/POST /api/meetings/:meetingId/context */
export interface MeetingContextPackage {
  meetingId: number;
  generatedAt: string;
  payload: MeetingBotContext;
}

/** POST /api/meetings/:meetingId/deploy, GET /api/meetings/:meetingId/deploy */
export interface MeetingDeployment {
  deployed: boolean;
  deployedAt: string | null;
  context: MeetingBotContext | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin (/api/admin, /api/teams) — server-backed, real org/role model.
// ─────────────────────────────────────────────────────────────────────────────

export const ORG_ROLES = ['owner', 'admin', 'manager', 'member', 'guest', 'bot'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export type UserStatus = 'active' | 'suspended';

/** GET /api/admin/users — one row per org member. */
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  status: UserStatus;
  role: OrgRole;
}

/** GET /api/teams */
export interface Team {
  id: number;
  name: string;
  createdAt: string;
  members: User[];
}

/** GET /api/admin/audit-log, and the dashboard's recentAudit slice. */
export interface AuditLogEntry {
  id: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actor: { id: number; name: string } | null;
  at: string;
}

/** GET /api/admin/login-history */
export interface LoginEvent {
  id: number;
  ip: string | null;
  userAgent: string | null;
  at: string;
  user: { id: number; name: string };
}

/** GET /api/admin/dashboard */
export interface AdminDashboard {
  counts: { members: number; projects: number; tasks: number };
  taskStats: { completed: number; overdue: number; total: number };
  roleBreakdown: { role: OrgRole; count: number }[];
  recentAudit: AuditLogEntry[];
}

/** GET /api/admin/analytics */
export interface AdminAnalytics {
  completed: number;
  overdue: number;
  total: number;
  completionRate: number;
  statusBreakdown: { status: string; count: number }[];
}

/** GET/PATCH /api/admin/settings */
export interface OrgSettings {
  id: number;
  name: string;
  settings: Record<string, unknown>;
}
