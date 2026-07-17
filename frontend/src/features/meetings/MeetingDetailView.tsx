'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import {
  useGetMeetingQuery,
  useCancelMeetingMutation,
  useResendInvitationsMutation,
} from '@/store/api/backendApi';
import { useToast } from '@/lib/toast-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Button } from '@/components/ui/Button';
import { Section, Table } from '@/components/ui/Section';
import { Avatar } from '@/components/domain/AvatarStack';
import type { Meeting } from '@/lib/types';
import {
  RequireMeetingsAccess,
  ContextSection,
  formatMeetingTime,
  STATUS_LABEL,
  STATUS_CLASS,
  EMAIL_STATUS_LABEL,
  EMAIL_STATUS_CLASS,
} from './shared';

export function MeetingDetailView({ meetingId }: { meetingId: number }) {
  return (
    <RequireMeetingsAccess>
      <Detail meetingId={meetingId} />
    </RequireMeetingsAccess>
  );
}

function summarizeInvites(meeting: Meeting): string {
  const sent = meeting.participants.filter((p) => p.emailStatus === 'sent' || p.emailStatus === 'delivered').length;
  const failed = meeting.participants.filter((p) => p.emailStatus === 'failed').length;
  const total = meeting.participants.length;
  if (failed === 0) return `${sent}/${total} invites sent`;
  return `${sent}/${total} invites sent, ${failed} failed`;
}

function Detail({ meetingId }: { meetingId: number }) {
  const { notify } = useToast();
  const router = useRouter();
  const { data: meeting, error, isFetching } = useGetMeetingQuery(meetingId);
  const [cancelMeeting, { isLoading: cancelling }] = useCancelMeetingMutation();
  const [resendInvitations, { isLoading: resending }] = useResendInvitationsMutation();

  const status = (error as { status?: number } | undefined)?.status;
  const notFound = status === 404;

  async function handleCancel() {
    if (!meeting) return;
    try {
      await cancelMeeting(meeting.id).unwrap();
      notify('success', `"${meeting.title}" cancelled`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to cancel meeting');
    }
  }

  async function handleResend() {
    if (!meeting) return;
    try {
      const updated = await resendInvitations(meeting.id).unwrap();
      notify('success', summarizeInvites(updated));
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to resend invitations');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <button
          type="button"
          onClick={() => router.push('/meetings')}
          aria-label="Back to Meetings"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-text-muted transition-colors hover:bg-glass-border hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-glow"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-text">{meeting?.title ?? 'Meeting'}</h1>
          {meeting && <p className="text-sm text-text-subtle">{formatMeetingTime(meeting.scheduledAt)}</p>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {isFetching && !meeting && <p className="py-6 text-center text-sm text-text-subtle">Loading…</p>}

          {notFound && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="mb-3 text-sm text-text-subtle">This meeting doesn&rsquo;t exist or was removed.</p>
              <Link href="/meetings" className="text-sm font-medium text-primary hover:underline">
                Back to Meetings
              </Link>
            </div>
          )}

          {meeting && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASS[meeting.status])}>
                  {STATUS_LABEL[meeting.status]}
                </span>
                <span className="text-xs text-text-subtle">{meeting.type}</span>
                <span className="text-xs text-text-subtle">
                  {meeting.projects.map((p) => p.name).join(', ') || 'No projects'}
                </span>
              </div>

              {meeting.meetingUrl && (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-sm text-primary hover:underline"
                >
                  {meeting.meetingUrl}
                </a>
              )}

              <Section
                title="Meeting Invitations"
                subtitle={summarizeInvites(meeting)}
                action={
                  meeting.status !== 'cancelled' && (
                    <Button size="sm" variant="secondary" loading={resending} onClick={handleResend}>
                      Resend Invitations
                    </Button>
                  )
                }
              >
                <Table head={['Recipient', 'Status', 'Sent time', 'Error']}>
                  {meeting.participants.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar person={p} size={22} />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-text">{p.name}</p>
                            <p className="truncate text-xs text-text-subtle">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', EMAIL_STATUS_CLASS[p.emailStatus])}>
                          {EMAIL_STATUS_LABEL[p.emailStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-text-muted">
                        {p.emailSentAt ? (
                          <span title={new Date(p.emailSentAt).toLocaleString()}>{relativeTime(p.emailSentAt)}</span>
                        ) : (
                          <span className="text-text-subtle">—</span>
                        )}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 text-sm text-danger">
                        {p.emailError ? (
                          <span className="line-clamp-2" title={p.emailError}>
                            {p.emailError}
                          </span>
                        ) : (
                          <span className="text-text-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              </Section>

              {meeting.status !== 'cancelled' && <ContextSection meetingId={meeting.id} />}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Link
                  href="/meetings"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-medium text-text transition-colors hover:bg-surface-muted"
                >
                  Back to Meetings
                </Link>
                {meeting.status !== 'cancelled' && (
                  <Button variant="danger" loading={cancelling} onClick={handleCancel}>
                    Cancel meeting
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
