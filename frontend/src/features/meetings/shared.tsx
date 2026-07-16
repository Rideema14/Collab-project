'use client';

import { Shield } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectMyPermissions } from '@/store/selectors';
import { useGetMeetingContextQuery, useGenerateMeetingContextMutation } from '@/store/api/backendApi';
import { useToast } from '@/lib/toast-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Section';
import type { Meeting, MeetingContextPayload, MeetingBotTask } from '@/lib/types';

/**
 * Shared across all three /meetings routes (overview, schedule, detail) —
 * each is independently reachable by URL, so each needs its own gate rather
 * than relying on a parent component to have already checked permission.
 */
export function RequireMeetingsAccess({ children }: { children: React.ReactNode }) {
  const canManage = useAppSelector(selectMyPermissions).includes('member.manage');
  if (!canManage) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <Shield className="mx-auto mb-3 h-10 w-10 text-text-subtle" />
          <h1 className="text-lg font-semibold text-text">Admin access required</h1>
          <p className="mt-1 text-sm text-text-subtle">Only Admins can schedule meetings.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function formatMeetingTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const STATUS_LABEL: Record<Meeting['status'], string> = {
  scheduled: 'Scheduled',
  context_ready: 'Context ready',
  cancelled: 'Cancelled',
};
export const STATUS_CLASS: Record<Meeting['status'], string> = {
  scheduled: 'bg-primary-soft text-primary',
  context_ready: 'bg-success-soft text-success-fg',
  cancelled: 'bg-surface-muted text-text-subtle',
};

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border px-2 py-1.5',
        danger && value > 0 && 'border-danger/40 bg-danger-soft'
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-text-subtle">{label}</p>
      <p className={cn('text-sm font-semibold text-text', danger && value > 0 && 'text-danger')}>{value}</p>
    </div>
  );
}

/** Per-participant task breakdown. Used both for the schedule form's live preview and the post-creation context view. */
export function ContextParticipants({ payload, compact }: { payload: MeetingContextPayload; compact?: boolean }) {
  return (
    <div className="space-y-3">
      {!compact && (
        <div className="rounded-lg border border-border bg-surface-muted/60 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-subtle">
            What this doesn&rsquo;t include
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-muted">
            {payload.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {payload.participants.map((p) => (
          <div key={p.userId} className="rounded-xl border border-border p-3">
            <p className="mb-2 text-sm font-medium text-text">{p.name}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Assigned" value={p.assignedTasks.length} />
              <Stat label="Completed" value={p.completedTasks.length} />
              <Stat label="Overdue" value={p.overdueTasks.length} danger />
              <Stat label="Due this week" value={p.upcomingDeadlines.length} />
            </div>
            {p.completedTasks.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                {p.completedTasks.map((t) => (
                  <li key={t.id}>
                    ✓ {t.title} <span className="text-text-subtle">({t.projectName})</span>
                  </li>
                ))}
              </ul>
            )}
            {p.overdueTasks.length > 0 && (
              <ul className="mt-1 space-y-1 text-xs text-text-muted">
                {p.overdueTasks.map((t) => (
                  <li key={t.id}>
                    ⚠ {t.title} <span className="text-text-subtle">({t.projectName})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {payload.participants.length === 0 && (
          <p className="text-sm text-text-subtle">No participants to report on.</p>
        )}
      </div>
    </div>
  );
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs =
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.max(1, Math.round(diffMs / 86400000));
}

/** Flat table of every assigned task across the meeting's selected projects, one row per task. */
function ParticipantTaskTable({ tasks }: { tasks: MeetingBotTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-text-subtle">No tasks assigned across the selected projects.</p>;
  }
  return (
    <Table head={['Assignee', 'Task', 'Project', 'Status', 'Due date']}>
      {tasks.map((t) => (
        <tr key={t.id} className="border-t border-border">
          <td className="px-3 py-2 text-text">{t.assigneeName}</td>
          <td className="px-3 py-2 text-text">{t.title}</td>
          <td className="px-3 py-2 text-text-subtle">{t.projectName}</td>
          <td className="px-3 py-2 text-text-subtle">{t.status}</td>
          <td className={cn('px-3 py-2', t.isOverdue ? 'text-danger' : 'text-text-subtle')}>{t.dueDate ?? '—'}</td>
        </tr>
      ))}
    </Table>
  );
}

/** Per-project rollup (total/completed/overdue), derived from the flat assignedTasks list. */
function ProjectSummaryTable({
  projects,
  assignedTasks,
}: {
  projects: { id: number; name: string }[];
  assignedTasks: MeetingBotTask[];
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-text-subtle">No projects selected.</p>;
  }
  return (
    <Table head={['Project', 'Total tasks', 'Completed', 'Overdue']}>
      {projects.map((p) => {
        const tasks = assignedTasks.filter((t) => t.projectId === p.id);
        const completed = tasks.filter((t) => t.status === 'Done').length;
        const overdue = tasks.filter((t) => t.isOverdue).length;
        return (
          <tr key={p.id} className="border-t border-border">
            <td className="px-3 py-2 text-text">{p.name}</td>
            <td className="px-3 py-2 text-text-subtle">{tasks.length}</td>
            <td className="px-3 py-2 text-text-subtle">{completed}</td>
            <td className={cn('px-3 py-2', overdue > 0 ? 'text-danger' : 'text-text-subtle')}>{overdue}</td>
          </tr>
        );
      })}
    </Table>
  );
}

function OverdueTasksTable({ tasks }: { tasks: MeetingBotTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-text-subtle">Nothing overdue.</p>;
  }
  return (
    <Table head={['Assignee', 'Task', 'Project', 'Due date', 'Overdue by']}>
      {tasks.map((t) => (
        <tr key={t.id} className="border-t border-border">
          <td className="px-3 py-2 text-text">{t.assigneeName}</td>
          <td className="px-3 py-2 text-text">{t.title}</td>
          <td className="px-3 py-2 text-text-subtle">{t.projectName}</td>
          <td className="px-3 py-2 text-danger">{t.dueDate}</td>
          <td className="px-3 py-2 text-danger">{daysOverdue(t.dueDate)}d</td>
        </tr>
      ))}
    </Table>
  );
}

function DeadlinesTable({ tasks }: { tasks: MeetingBotTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-text-subtle">No deadlines in the next 7 days.</p>;
  }
  return (
    <Table head={['Assignee', 'Task', 'Project', 'Due date']}>
      {tasks.map((t) => (
        <tr key={t.id} className="border-t border-border">
          <td className="px-3 py-2 text-text">{t.assigneeName}</td>
          <td className="px-3 py-2 text-text">{t.title}</td>
          <td className="px-3 py-2 text-text-subtle">{t.projectName}</td>
          <td className="px-3 py-2 text-text-subtle">{t.dueDate}</td>
        </tr>
      ))}
    </Table>
  );
}

export function ContextSection({ meetingId }: { meetingId: number }) {
  const { notify } = useToast();
  const { data, error, isFetching } = useGetMeetingContextQuery(meetingId);
  const [generate, { isLoading: generating }] = useGenerateMeetingContextMutation();

  const status = (error as { status?: number } | undefined)?.status;
  const notFound = status === 404;
  const otherError = Boolean(error) && !notFound;

  async function handleGenerate() {
    try {
      await generate(meetingId).unwrap();
      notify('success', 'Context package generated');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to generate context');
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text">Meeting context</p>
        <Button size="sm" variant="secondary" loading={generating} onClick={handleGenerate}>
          {data ? 'Regenerate' : 'Generate now'}
        </Button>
      </div>

      {isFetching && !data && <p className="text-sm text-text-subtle">Loading…</p>}
      {!isFetching && notFound && !data && (
        <p className="text-sm text-text-subtle">
          No context package yet — generate one from each participant&rsquo;s current task state.
        </p>
      )}
      {otherError && (
        <p className="text-sm text-danger">
          {(error as { message?: string } | undefined)?.message ?? 'Failed to load context'}
        </p>
      )}

      {data && (
        <div className="space-y-5">
          <p className="text-xs text-text-subtle">Generated {relativeTime(data.generatedAt)}</p>

          <div className="rounded-lg border border-border bg-surface-muted/60 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-subtle">
              What this doesn&rsquo;t include
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-muted">
              {data.payload.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-text">Project summary</p>
            <ProjectSummaryTable projects={data.payload.projects} assignedTasks={data.payload.assignedTasks} />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-text">Participant tasks</p>
            <ParticipantTaskTable tasks={data.payload.assignedTasks} />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-text">Overdue tasks</p>
            <OverdueTasksTable tasks={data.payload.overdueTasks} />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-text">Upcoming deadlines</p>
            <DeadlinesTable tasks={data.payload.deadlines} />
          </div>
        </div>
      )}
    </div>
  );
}
