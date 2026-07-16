import { createApi } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import { ApiError } from '@/lib/api/client';
import { aiApi, meetingsApi, projectsApi, tasksApi, usersApi, voiceApi, type MeetingInput } from '@/lib/api/endpoints';
import type {
  AiPlan,
  Meeting,
  MeetingContextPackage,
  MeetingContextPayload,
  Project,
  Task,
  User,
  VoiceParseResult,
} from '@/lib/types';

/**
 * The board is keyed by arbitrary status NAME now (backend `tasks.status` is
 * VARCHAR(60)), so it's a dynamic map rather than the fixed 3-column shape.
 */
export type DynamicBoard = Record<string, Task[]>;

/**
 * RTK Query surface over the (immutable) backend.
 *
 * Rather than reimplement the wire format, each endpoint's `queryFn` calls the
 * existing typed endpoint functions in `lib/api/endpoints.ts`, which already own
 * the success/error envelope, the 401 session interceptor, the 204-on-DELETE
 * case, and the `Authorization: Bearer` header. RTK Query adds the caching,
 * tag-based invalidation, and optimistic-update machinery on top.
 *
 * This is the ONLY place the app talks to the server for projects/tasks/users in
 * the redesigned surface. Everything else (hierarchy, statuses, rich task fields,
 * comments, presence) is client-persisted and never hits this api.
 */

type Thunk<T> = () => Promise<T>;

/** Adapts a throwing endpoint call into RTK Query's { data } | { error } result. */
const passthroughBaseQuery: BaseQueryFn<Thunk<unknown>, unknown, { status: number; message: string }> =
  async (run) => {
    try {
      return { data: await run() };
    } catch (err) {
      if (err instanceof ApiError) return { error: { status: err.status, message: err.message } };
      return { error: { status: 0, message: (err as Error)?.message ?? 'Unknown error' } };
    }
  };

export const backendApi = createApi({
  reducerPath: 'backendApi',
  baseQuery: passthroughBaseQuery,
  tagTypes: ['Projects', 'Board', 'Users', 'Meetings', 'MeetingContext'],
  endpoints: (build) => ({
    // ---- Users ----
    getUsers: build.query<User[], void>({
      query: () => () => usersApi.list(),
      providesTags: ['Users'],
    }),

    // ---- Projects (= Lists) ----
    getProjects: build.query<Project[], void>({
      query: () => () => projectsApi.list(),
      providesTags: ['Projects'],
    }),
    createProject: build.mutation<Project, { name: string }>({
      query: (input) => () => projectsApi.create(input),
      invalidatesTags: ['Projects'],
    }),

    // ---- Tasks ----
    getBoard: build.query<DynamicBoard, number>({
      query: (projectId) => () => tasksApi.board(projectId),
      providesTags: (_r, _e, projectId) => [{ type: 'Board', id: projectId }],
    }),
    createTask: build.mutation<
      Task,
      { projectId: number; title: string; assigneeId: number | null; dueDate: string | null; status?: string }
    >({
      query: ({ projectId, ...input }) => () => tasksApi.create(projectId, input),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Board', id: projectId }],
    }),
    updateTaskStatus: build.mutation<Task, { projectId: number; taskId: number; status: string }>({
      query: ({ taskId, status }) => () => tasksApi.updateStatus(taskId, status),
      // Optimistically move the card into the destination column (any status name).
      async onQueryStarted({ projectId, taskId, status }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          backendApi.util.updateQueryData('getBoard', projectId, (board) => {
            let moved: Task | undefined;
            for (const col of Object.keys(board)) {
              const idx = board[col].findIndex((t) => t.id === taskId);
              if (idx !== -1) {
                moved = { ...board[col][idx], status: status as Task['status'] };
                board[col].splice(idx, 1);
                break;
              }
            }
            if (moved) (board[status] ??= []).unshift(moved);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    updateTask: build.mutation<
      Task,
      {
        projectId: number;
        taskId: number;
        input: Partial<{ title: string; assigneeId: number | null; dueDate: string | null }>;
      }
    >({
      query: ({ taskId, input }) => () => tasksApi.update(taskId, input),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: 'Board', id: projectId }],
    }),
    deleteTask: build.mutation<void, { projectId: number; taskId: number }>({
      query: ({ taskId }) => () => tasksApi.remove(taskId),
      async onQueryStarted({ projectId, taskId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          backendApi.util.updateQueryData('getBoard', projectId, (board) => {
            for (const col of Object.keys(board)) {
              const idx = board[col].findIndex((t) => t.id === taskId);
              if (idx !== -1) {
                board[col].splice(idx, 1);
                break;
              }
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    // ---- Voice (optional server feature) ----
    parseVoice: build.mutation<
      VoiceParseResult,
      { projectId: number; input: { audio: Blob } | { transcript: string } }
    >({
      query: ({ projectId, input }) => () => voiceApi.parse(projectId, input),
    }),

    // ---- AI Workspace Assistant ----
    sendAiCommand: build.mutation<AiPlan, { message: string; context: unknown }>({
      query: (input) => () => aiApi.command(input),
    }),

    // ---- Meetings ----
    getMeetings: build.query<Meeting[], void>({
      query: () => () => meetingsApi.list(),
      providesTags: (result) =>
        result
          ? [...result.map((m) => ({ type: 'Meetings' as const, id: m.id })), { type: 'Meetings' as const, id: 'LIST' }]
          : [{ type: 'Meetings' as const, id: 'LIST' }],
    }),
    getMeeting: build.query<Meeting, number>({
      query: (meetingId) => () => meetingsApi.get(meetingId),
      providesTags: (_r, _e, meetingId) => [{ type: 'Meetings', id: meetingId }],
    }),
    createMeeting: build.mutation<Meeting, MeetingInput>({
      query: (input) => () => meetingsApi.create(input),
      invalidatesTags: [{ type: 'Meetings', id: 'LIST' }],
    }),
    updateMeeting: build.mutation<Meeting, { meetingId: number; input: Partial<MeetingInput> }>({
      query: ({ meetingId, input }) => () => meetingsApi.update(meetingId, input),
      invalidatesTags: (_r, _e, { meetingId }) => [
        { type: 'Meetings', id: meetingId },
        { type: 'Meetings', id: 'LIST' },
      ],
    }),
    cancelMeeting: build.mutation<Meeting, number>({
      query: (meetingId) => () => meetingsApi.cancel(meetingId),
      invalidatesTags: (_r, _e, meetingId) => [
        { type: 'Meetings', id: meetingId },
        { type: 'Meetings', id: 'LIST' },
      ],
    }),
    getMeetingContext: build.query<MeetingContextPackage, number>({
      query: (meetingId) => () => meetingsApi.getContext(meetingId),
      providesTags: (_r, _e, meetingId) => [{ type: 'MeetingContext', id: meetingId }],
    }),
    generateMeetingContext: build.mutation<MeetingContextPackage, number>({
      query: (meetingId) => () => meetingsApi.generateContext(meetingId),
      invalidatesTags: (_r, _e, meetingId) => [
        { type: 'MeetingContext', id: meetingId },
        { type: 'Meetings', id: meetingId },
      ],
    }),
    // Not cached — called repeatedly as the schedule form's project/participant
    // selection changes, so a mutation (fire-and-return) fits better than a
    // query with a constantly-changing cache key.
    previewMeetingContext: build.mutation<
      MeetingContextPayload,
      { projectIds: number[]; participantUserIds: number[] }
    >({
      query: (input) => () => meetingsApi.previewContext(input),
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetProjectsQuery,
  useCreateProjectMutation,
  useGetBoardQuery,
  useCreateTaskMutation,
  useUpdateTaskStatusMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useParseVoiceMutation,
  useSendAiCommandMutation,
  useGetMeetingsQuery,
  useGetMeetingQuery,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
  useCancelMeetingMutation,
  useGetMeetingContextQuery,
  useGenerateMeetingContextMutation,
  usePreviewMeetingContextMutation,
} = backendApi;
