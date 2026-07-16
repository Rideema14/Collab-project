import { api } from './client';
import type {
  AiPlan,
  AuthPayload,
  Board,
  Meeting,
  MeetingContextPackage,
  MeetingContextPayload,
  MeetingType,
  Project,
  Task,
  User,
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
  /** Optional join link (Zoom/Meet/Teams/etc). Sent to null to clear it. */
  meetingUrl?: string | null;
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

  /** POST /api/meetings/:meetingId/cancel -> sets status to 'cancelled', emails participants. */
  cancel: (meetingId: number) => api.post<Meeting>(`/api/meetings/${meetingId}/cancel`, undefined),

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
