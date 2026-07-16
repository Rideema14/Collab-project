'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectLists } from '@/store/selectors';
import {
  useGetUsersQuery,
  useCreateMeetingMutation,
  usePreviewMeetingContextMutation,
} from '@/store/api/backendApi';
import { useToast } from '@/lib/toast-context';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/domain/AvatarStack';
import { MEETING_TYPES, type MeetingType } from '@/lib/types';
import { RequireMeetingsAccess, ContextParticipants } from './shared';

export function ScheduleMeetingView() {
  return (
    <RequireMeetingsAccess>
      <ScheduleForm />
    </RequireMeetingsAccess>
  );
}

function ScheduleForm() {
  const router = useRouter();
  const { notify } = useToast();
  const lists = useAppSelector(selectLists).filter((l) => !l.archived);
  const { data: users = [] } = useGetUsersQuery();
  const [createMeeting, { isLoading }] = useCreateMeetingMutation();
  const [previewMeetingContext, { data: preview, isLoading: previewLoading }] = usePreviewMeetingContextMutation();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<MeetingType>('Daily Standup');
  const [scheduledAt, setScheduledAt] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [projectIds, setProjectIds] = useState<Set<number>>(new Set());
  const [participantIds, setParticipantIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Live preview: as soon as at least one project and one participant are
  // picked, ask the backend what each invitee has done/is overdue on/etc,
  // scoped to just the selected projects. Debounced so ticking several
  // checkboxes in a row doesn't fire a request per click.
  const projectKey = [...projectIds].sort((a, b) => a - b).join(',');
  const participantKey = [...participantIds].sort((a, b) => a - b).join(',');
  useEffect(() => {
    if (!projectKey || !participantKey) return;
    const timer = setTimeout(() => {
      previewMeetingContext({
        projectIds: projectKey.split(',').map(Number),
        participantUserIds: participantKey.split(',').map(Number),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, participantKey]);

  function toggle(set: Set<number>, setter: (s: Set<number>) => void, id: number) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Meeting title is required');
    if (!scheduledAt) return setError('Pick a date and time');
    if (projectIds.size === 0) return setError('Select at least one project');
    if (participantIds.size === 0) return setError('Select at least one participant');

    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime())) return setError('That date/time is invalid');

    setError(null);
    try {
      const meeting = await createMeeting({
        title: title.trim(),
        type,
        scheduledAt: parsed.toISOString(),
        meetingUrl: meetingUrl.trim() || null,
        projectIds: [...projectIds],
        participantUserIds: [...participantIds],
      }).unwrap();
      notify(
        'success',
        `"${title.trim()}" scheduled — invites sent to ${participantIds.size} participant${participantIds.size === 1 ? '' : 's'}`
      );
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <Link
          href="/meetings"
          aria-label="Back to Meetings"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-text-muted transition-colors hover:bg-glass-border hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span
          className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-glow"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <CalendarClock className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-text">Schedule a meeting</h1>
          <p className="text-sm text-text-subtle">Invites are emailed to every participant as soon as this is created.</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="meeting-title" className="text-sm font-medium text-text">
              Title
            </label>
            <input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sprint 14 standup"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="meeting-type" className="text-sm font-medium text-text">
                Type
              </label>
              <select
                id="meeting-type"
                value={type}
                onChange={(e) => setType(e.target.value as MeetingType)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="meeting-when" className="text-sm font-medium text-text">
                Date &amp; time
              </label>
              <input
                id="meeting-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="meeting-url" className="text-sm font-medium text-text">
              Meeting link <span className="font-normal text-text-subtle">(optional)</span>
            </label>
            <input
              id="meeting-url"
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/…"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
            />
            <p className="text-xs text-text-subtle">Included in the invite email so participants can join directly.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-text">Projects</p>
              <div className="h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {lists.length === 0 && <p className="px-1 py-1 text-xs text-text-subtle">No projects yet.</p>}
                {lists.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-text hover:bg-glass-border">
                    <input
                      type="checkbox"
                      checked={projectIds.has(l.backendProjectId)}
                      onChange={() => toggle(projectIds, setProjectIds, l.backendProjectId)}
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-text">Participants</p>
              <div className="h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-text hover:bg-glass-border">
                    <input
                      type="checkbox"
                      checked={participantIds.has(u.id)}
                      onChange={() => toggle(participantIds, setParticipantIds, u.id)}
                    />
                    <Avatar person={u} size={20} />
                    <span className="min-w-0 flex-1 truncate">{u.name}</span>
                    <span className="shrink-0 text-xs text-text-subtle">{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {projectIds.size > 0 && participantIds.size > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text">What they&rsquo;ve done</p>
                {previewLoading && <span className="text-xs text-text-subtle">Loading…</span>}
              </div>
              {preview ? (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border p-2">
                  <ContextParticipants payload={preview} compact />
                </div>
              ) : (
                !previewLoading && (
                  <p className="text-xs text-text-subtle">Pick projects and participants to preview their work.</p>
                )
              )}
            </div>
          )}

          {error && <p className="text-sm font-medium text-danger">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Link
              href="/meetings"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border-strong px-4 text-sm font-medium text-text transition-colors hover:bg-surface-muted"
            >
              Cancel
            </Link>
            <Button type="submit" loading={isLoading}>
              Schedule &amp; invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
