import { api } from './client';
import type {
  AdminAnalytics,
  AdminDashboard,
  AdminUser,
  AiPlan,
  AuditLogEntry,
  AuthPayload,
  Board,
  LoginEvent,
  Meeting,
  MeetingContextPackage,
  MeetingContextPayload,
  MeetingDeployment,
  MeetingResult,
  MeetingType,
  OrgRole,
  OrgSettings,
  Project,
  Task,
  Team,
  User,
  UserStatus,
  VoiceParseResult,
} from '../types';

/**
 * Every backend route, in one place. Nothing outside this file constructs a URL.
 *
 * This is the complete, exhaustive surface of the backend as implemented —
 * there is no endpoint here that the server does not serve, and no server
 * route that is missing here.
 */

// ---------- Auth (public) ----------

export const authApi = {
  /** POST /api/auth/register -> 201 { user, token } */
  register: (input: { name: string; email: string; password: string }) =>
    api.post<AuthPayload>('/api/auth/register', input),

  /** POST /api/auth/login -> 200 { user, token } */
  login: (input: { email: string; password: string }) =>
    api.post<AuthPayload>('/api/auth/login', input),
};

// ---------- Users (authenticated) ----------

export const usersApi = {
  /**
   * GET /api/users -> every member of the single shared workspace.
   * Powers the "Assign to" picker. The backend has no roles and no per-project
   * membership, so this really is "everyone".
   */
  list: (signal?: AbortSignal) => api.get<User[]>('/api/users', signal),
};

// ---------- Projects (authenticated) ----------

export const projectsApi = {
  /** GET /api/projects -> all projects, newest first. */
  list: (signal?: AbortSignal) => api.get<Project[]>('/api/projects', signal),

  /**
   * POST /api/projects -> 201.
   * The response omits the creator's name (see Project type), so callers that
   * need a list-shaped project should refetch rather than use this directly.
   */
  create: (input: { name: string }) => api.post<Project>('/api/projects', input),

  /** PATCH /api/projects/:projectId -> rename and/or archive/restore. */
  update: (projectId: number, input: Partial<{ name: string; archived: boolean }>) =>
    api.patch<Project>(`/api/projects/${projectId}`, input),

  /** DELETE /api/projects/:projectId -> 204. Real delete — cascades to its tasks. */
  remove: (projectId: number) => api.delete(`/api/projects/${projectId}`),
};

// ---------- Tasks (authenticated) ----------

export const tasksApi = {
  /** GET /api/projects/:projectId/tasks -> tasks already grouped by column. */
  board: (projectId: number, signal?: AbortSignal) =>
    api.get<Board>(`/api/projects/${projectId}/tasks`, signal),

  /**
   * POST /api/projects/:projectId/tasks -> 201.
   * New tasks always land in 'To Do'; the backend hardcodes the status on insert,
   * so there is no status field to send.
   */
  create: (
    projectId: number,
    input: { title: string; assigneeId: number | null; dueDate: string | null; status?: string }
  ) => api.post<Task>(`/api/projects/${projectId}/tasks`, input),

  /**
   * PATCH /api/tasks/:taskId/status -> the move-between-columns endpoint.
   * Status is a free string now (backend column is VARCHAR(60)); any custom
   * status name persists. `Status` (the legacy 3) is a subtype of string, so
   * existing callers are unaffected.
   */
  updateStatus: (taskId: number, status: string) =>
    api.patch<Task>(`/api/tasks/${taskId}/status`, { status }),

  /**
   * PATCH /api/tasks/:taskId -> partial update.
   * The backend treats an *absent* key as "leave alone" and null as "clear it",
   * so only send the fields that actually changed.
   */
  update: (
    taskId: number,
    input: Partial<{ title: string; assigneeId: number | null; dueDate: string | null }>
  ) => api.patch<Task>(`/api/tasks/${taskId}`, input),

  /** DELETE /api/tasks/:taskId -> 204, no body. */
  remove: (taskId: number) => api.delete(`/api/tasks/${taskId}`),
};

// ---------- Voice (authenticated, optional server feature) ----------

/**
 * The backend accepts EITHER an `audio` file field OR a `transcript` text field.
 * We send audio when the browser can record, and fall back to typed text when it
 * can't — both hit the same endpoint and the same parser.
 */
function voiceBody(input: { audio: Blob } | { transcript: string }): FormData {
  const form = new FormData();
  if ('audio' in input) {
    form.append('audio', input.audio, 'command.webm');
  } else {
    form.append('transcript', input.transcript);
  }
  return form;
}

export const voiceApi = {
  /**
   * POST /api/projects/:projectId/tasks/voice/parse
   * Preview only — parses the command but writes nothing to the database.
   * Throws ApiError(503) when the server has no GROQ_API_KEY configured.
   */
  parse: (projectId: number, input: { audio: Blob } | { transcript: string }) =>
    api.postForm<VoiceParseResult>(
      `/api/projects/${projectId}/tasks/voice/parse`,
      voiceBody(input)
    ),
};

// ---------- AI Workspace Assistant (authenticated) ----------

export const aiApi = {
  /**
   * POST /api/ai/command — turns a natural-language message + a snapshot of the
   * workspace into a structured action plan. The server only parses intent; the
   * client's action layer runs the plan against the existing APIs.
   */
  command: (input: { message: string; context: unknown }) =>
    api.post<AiPlan>('/api/ai/command', input),

  /**
   * POST /api/ai/transcribe — speech-to-text via Groq Whisper. Returns the
   * transcript; the client then runs it through `command` like a typed message.
   */
  transcribe: (audio: Blob) => {
    const form = new FormData();
    form.append('audio', audio, 'command.webm');
    return api.postForm<{ text: string }>('/api/ai/transcribe', form);
  },
};

// ---------- Meetings (authenticated) ----------

export interface MeetingInput {
  title: string;
  type?: MeetingType;
  /** ISO datetime string. */
  scheduledAt: string;
  /** Required join link (Zoom/Meet/Teams/etc), included in the invite email. */
  meetingUrl: string;
  projectIds: number[];
  participantUserIds: number[];
}

export const meetingsApi = {
  /** GET /api/meetings -> every meeting, newest-scheduled first. */
  list: (signal?: AbortSignal) => api.get<Meeting[]>('/api/meetings', signal),

  /** GET /api/meetings/:meetingId -> full detail incl. participants and projects. */
  get: (meetingId: number, signal?: AbortSignal) =>
    api.get<Meeting>(`/api/meetings/${meetingId}`, signal),

  /** POST /api/meetings -> 201. Sends invite emails to every participant. */
  create: (input: MeetingInput) => api.post<Meeting>('/api/meetings', input),

  /**
   * PATCH /api/meetings/:meetingId -> partial update.
   * Only newly-added participants (not already on the meeting) receive an
   * invite email — re-inviting everyone on every edit would be noisy.
   */
  update: (meetingId: number, input: Partial<MeetingInput>) =>
    api.patch<Meeting>(`/api/meetings/${meetingId}`, input),

  /** DELETE /api/meetings/:meetingId -> 204. Real delete — cascades to participants/context/deployment. */
  remove: (meetingId: number) => api.delete(`/api/meetings/${meetingId}`),

  /** POST /api/meetings/:meetingId/cancel -> sets status to 'cancelled', emails participants. */
  cancel: (meetingId: number) => api.post<Meeting>(`/api/meetings/${meetingId}/cancel`, undefined),

  /**
   * POST /api/meetings/:meetingId/resend-invitations -> re-sends the invite
   * email to every current participant, logging a fresh attempt per
   * recipient. Returns the meeting with refreshed per-participant email status.
   */
  resendInvitations: (meetingId: number) =>
    api.post<Meeting>(`/api/meetings/${meetingId}/resend-invitations`, undefined),

  /**
   * POST /api/meetings/:meetingId/context -> (re)builds the context package from
   * current task state and stores it. Manual trigger — there is no background
   * scheduler yet, so nothing builds this automatically.
   */
  generateContext: (meetingId: number) =>
    api.post<MeetingContextPackage>(`/api/meetings/${meetingId}/context`, undefined),

  /** GET /api/meetings/:meetingId/context -> the last generated package, or 404 if none yet. */
  getContext: (meetingId: number, signal?: AbortSignal) =>
    api.get<MeetingContextPackage>(`/api/meetings/${meetingId}/context`, signal),

  /**
   * POST /api/meetings/preview-context -> the same per-participant task
   * breakdown as generateContext, but for projects/participants that aren't
   * attached to a saved meeting yet — powers the live preview on the
   * schedule form. `payload.meetingId` is null in the response.
   */
  previewContext: (input: { projectIds: number[]; participantUserIds: number[] }) =>
    api.post<MeetingContextPayload>('/api/meetings/preview-context', input),

  /**
   * POST /api/meetings/:meetingId/deploy -> marks the meeting deployed, freezes a
   * context snapshot. This is the API contract only — no external bot is called yet.
   */
  deploy: (meetingId: number) => api.post<MeetingDeployment>(`/api/meetings/${meetingId}/deploy`, undefined),

  /** GET /api/meetings/:meetingId/deploy -> current deployment status + frozen snapshot, if any. */
  getDeployment: (meetingId: number, signal?: AbortSignal) =>
    api.get<MeetingDeployment>(`/api/meetings/${meetingId}/deploy`, signal),

  /**
   * GET /api/meetings/:meetingId/result -> transcript + AI summary once the
   * meeting has ended. Returns `{ ended: false }` until then, so the caller
   * polls. Proxied by the Node backend from the external Meeting Bot service.
   */
  getResult: (meetingId: number, signal?: AbortSignal) =>
    api.get<MeetingResult>(`/api/meetings/${meetingId}/result`, signal),
};

// ---------- Teams (authenticated, member+ read / admin+ manage) ----------

export const teamsApi = {
  /** GET /api/teams -> every team in the caller's org, with member rosters. */
  list: (signal?: AbortSignal) => api.get<Team[]>('/api/teams', signal),

  /** POST /api/teams -> 201. */
  create: (input: { name: string }) => api.post<Team>('/api/teams', input),

  /** PATCH /api/teams/:teamId -> rename. */
  rename: (teamId: number, name: string) => api.patch<{ id: number }>(`/api/teams/${teamId}`, { name }),

  /** DELETE /api/teams/:teamId -> 204. */
  remove: (teamId: number) => api.delete(`/api/teams/${teamId}`),

  /** POST /api/teams/:teamId/members -> 201. */
  addMember: (teamId: number, userId: number) =>
    api.post<{ teamId: number; userId: number }>(`/api/teams/${teamId}/members`, { userId }),

  /** DELETE /api/teams/:teamId/members/:userId -> 204. */
  removeMember: (teamId: number, userId: number) => api.delete(`/api/teams/${teamId}/members/${userId}`),
};

// ---------- Admin (authenticated, admin+ only — enforced server-side) ----------

export const adminApi = {
  /** GET /api/admin/dashboard */
  getDashboard: (signal?: AbortSignal) => api.get<AdminDashboard>('/api/admin/dashboard', signal),

  /** GET /api/admin/analytics */
  getAnalytics: (signal?: AbortSignal) => api.get<AdminAnalytics>('/api/admin/analytics', signal),

  /** GET /api/admin/users */
  listUsers: (signal?: AbortSignal) => api.get<AdminUser[]>('/api/admin/users', signal),

  /** PATCH /api/admin/users/:userId/role */
  changeUserRole: (userId: number, role: OrgRole) =>
    api.patch<{ userId: number; role: OrgRole }>(`/api/admin/users/${userId}/role`, { role }),

  /** PATCH /api/admin/users/:userId/status */
  setUserStatus: (userId: number, status: UserStatus) =>
    api.patch<{ userId: number; status: UserStatus }>(`/api/admin/users/${userId}/status`, { status }),

  /** POST /api/admin/users/:userId/force-logout -> instantly invalidates every token that user currently holds. */
  forceLogout: (userId: number) => api.post<{ userId: number }>(`/api/admin/users/${userId}/force-logout`, undefined),

  /** DELETE /api/admin/users/:userId -> 204. Removes org membership, not the user's account. */
  removeUser: (userId: number) => api.delete(`/api/admin/users/${userId}`),

  /** GET /api/admin/audit-log -> most recent 200 entries. */
  getAuditLog: (signal?: AbortSignal) => api.get<AuditLogEntry[]>('/api/admin/audit-log', signal),

  /** GET /api/admin/login-history -> most recent 200 entries. */
  getLoginHistory: (signal?: AbortSignal) => api.get<LoginEvent[]>('/api/admin/login-history', signal),

  /** GET /api/admin/settings */
  getSettings: (signal?: AbortSignal) => api.get<OrgSettings>('/api/admin/settings', signal),

  /** PATCH /api/admin/settings — Owner/Admin only. */
  updateSettings: (input: Partial<{ name: string; settings: Record<string, unknown> }>) =>
    api.patch<OrgSettings>('/api/admin/settings', input),

  /** PATCH /api/admin/tasks/bulk-status */
  bulkUpdateTaskStatus: (taskIds: number[], status: string) =>
    api.patch<{ updated: number[] }>('/api/admin/tasks/bulk-status', { taskIds, status }),

  /** POST /api/admin/tasks/bulk-delete */
  bulkDeleteTasks: (taskIds: number[]) => api.post<{ deleted: number[] }>('/api/admin/tasks/bulk-delete', { taskIds }),
};

/*
 * DELIBERATELY NOT WRAPPED: POST /api/projects/:projectId/tasks/voice
 *
 * That endpoint parses AND creates in one shot. We use the parse-then-confirm
 * flow instead: /voice/parse produces a draft, the user reviews and corrects it,
 * and the confirmed draft goes through tasksApi.create — the exact same call the
 * manual "Add task" form makes. Voice is a second way to fill in one form, not a
 * parallel write path. The one-shot endpoint remains available server-side.
 */
