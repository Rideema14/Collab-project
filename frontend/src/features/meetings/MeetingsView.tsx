'use client';

import Link from 'next/link';
import { CalendarClock, Plus, Users2 } from 'lucide-react';
import { useGetMeetingsQuery, useDeleteMeetingMutation } from '@/store/api/backendApi';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/design/cn';
import { Section, Table } from '@/components/ui/Section';
import { RequireMeetingsAccess, formatMeetingTime, STATUS_LABEL, STATUS_CLASS } from './shared';

export function MeetingsView() {
  return (
    <RequireMeetingsAccess>
      <MeetingsOverview />
    </RequireMeetingsAccess>
  );
}

function MeetingsOverview() {
  const { notify } = useToast();
  const { data: meetings = [], isLoading } = useGetMeetingsQuery();
  const [deleteMeeting, { isLoading: deleting }] = useDeleteMeetingMutation();

  async function handleDelete(id: number, title: string) {
    if (!window.confirm(`Delete "${title}" from meeting history? This can't be undone.`)) return;
    try {
      await deleteMeeting(id).unwrap();
      notify('success', `Deleted "${title}"`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-glow"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <CalendarClock className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-text">Meetings</h1>
          <p className="text-sm text-text-subtle">
            Schedule meetings and see what invited teammates have completed.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <Section
          title="Meetings"
          subtitle={`${meetings.length} meeting${meetings.length === 1 ? '' : 's'}`}
          action={
            <Link
              href="/meetings/schedule"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-transparent bg-primary px-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" /> New meeting
            </Link>
          }
        >
          {isLoading ? (
            <p className="py-6 text-center text-sm text-text-subtle">Loading meetings…</p>
          ) : meetings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <CalendarClock className="mx-auto mb-2 h-8 w-8 text-text-subtle" />
              <p className="mb-3 text-sm text-text-subtle">No meetings scheduled yet.</p>
              <Link
                href="/meetings/schedule"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="h-4 w-4" /> Schedule one
              </Link>
            </div>
          ) : (
            <Table head={['Meeting', 'When', 'Participants', 'Status', '']}>
              {meetings.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <p className="text-sm font-medium text-text">{m.title}</p>
                    <p className="text-xs text-text-subtle">{m.type}</p>
                  </td>
                  <td className="px-3 py-2 text-sm text-text-muted">{formatMeetingTime(m.scheduledAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Users2 className="h-3.5 w-3.5 text-text-subtle" />
                      <span className="text-sm text-text-muted">{m.participants.length}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASS[m.status])}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/meetings/${m.id}`}
                        className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-glass-border"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => handleDelete(m.id, m.title)}
                        className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-danger-soft disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </div>
  );
}
