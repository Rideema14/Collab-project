'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, FileText, ListChecks, Pencil, Rocket, Shield, Sparkles, Users2, X } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectMyPermissions } from '@/store/selectors';
import {
  useGetMeetingContextQuery,
  useGenerateMeetingContextMutation,
  useDeployMeetingMutation,
  useGetMeetingDeploymentQuery,
  useGetMeetingResultQuery,
} from '@/store/api/backendApi';
import { useToast } from '@/lib/toast-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/domain/AvatarStack';
import type { EmailDeliveryStatus, Meeting, MeetingContextPayload, MeetingResult } from '@/lib/types';

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
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const STATUS_CLASS: Record<Meeting['status'], string> = {
  scheduled: 'bg-primary-soft text-primary',
  context_ready: 'bg-success-soft text-success-fg',
  completed: 'bg-success-soft text-success-fg',
  cancelled: 'bg-surface-muted text-text-subtle',
};

/**
 * The agenda the bot runs for a given meeting type, for display on the
 * completed-meeting view.
 *
 * Source of truth is backend/meeting.py (DEFAULT_AGENDA_BY_TYPE / GENERIC_AGENDA)
 * — that's what the bot actually runs; this mirrors it for display only. Keep in
 * step if the backend agendas change. 'Custom' and any unknown type fall back to
 * the generic agenda, exactly as the backend does.
 */
const GENERIC_AGENDA = [
  'Introductions and quick round of who everyone is.',
  'Progress or updates since the last meeting.',
  'Any blockers or issues the team needs help with.',
  'Next steps or action items coming out of the discussion.',
  'Recap of the key points before wrapping up.',
];
const AGENDA_BY_TYPE: Record<string, string[]> = {
  'Daily Standup': [
    'Each attendee shares progress since yesterday.',
    'What each attendee is working on today.',
    'Any blockers, and who can unblock them.',
    'Recap of blockers before wrapping up.',
  ],
  'Weekly Review': [
    'What each attendee completed this week.',
    'What slipped or did not get finished, and why.',
    'Anything blocking progress into next week.',
    "Each attendee's main focus for next week.",
    'Recap of the key points before wrapping up.',
  ],
  'Sprint Review': [
    'Confirm what the sprint set out to deliver.',
    'Walkthrough of what was actually completed.',
    'What was not finished and carries over.',
    'Feedback or concerns about what was delivered.',
    'Recap of the outcomes before wrapping up.',
  ],
};
export function plannedAgendaForType(type: Meeting['type']): string[] {
  return AGENDA_BY_TYPE[type] ?? GENERIC_AGENDA;
}

// `delivered` is included for a future webhook-capable provider — the
// backend never sets it today, since EmailJS has no delivery confirmation.
export const EMAIL_STATUS_LABEL: Record<EmailDeliveryStatus, string> = {
  pending: 'Pending',
  sending: 'Sending…',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
};
export const EMAIL_STATUS_CLASS: Record<EmailDeliveryStatus, string> = {
  pending: 'bg-surface-muted text-text-subtle',
  sending: 'bg-primary-soft text-primary',
  sent: 'bg-success-soft text-success-fg',
  delivered: 'bg-success-soft text-success-fg',
  failed: 'bg-danger-soft text-danger',
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

/** Copies text to the clipboard, flashing a checkmark briefly to confirm. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

export function ContextSection({ meetingId }: { meetingId: number }) {
  const { notify } = useToast();
  const { data, error, isFetching } = useGetMeetingContextQuery(meetingId);
  const [generate, { isLoading: generating }] = useGenerateMeetingContextMutation();
  const { data: deployment } = useGetMeetingDeploymentQuery(meetingId);
  const [deploy, { isLoading: deploying }] = useDeployMeetingMutation();

  // Local edits to the generated prompt. Kept in the client only (there's no
  // "update context" endpoint) — lets you tweak the wording and copy it out.
  // A regenerate discards the edit and shows the fresh backend narrative.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [editedNarrative, setEditedNarrative] = useState<string | null>(null);
  const narrative = editedNarrative ?? data?.payload.narrative ?? '';

  const status = (error as { status?: number } | undefined)?.status;
  const notFound = status === 404;
  const otherError = Boolean(error) && !notFound;

  async function handleGenerate() {
    try {
      await generate(meetingId).unwrap();
      setEditedNarrative(null);
      setEditing(false);
      notify('success', 'Meeting context generated');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to generate context');
    }
  }

  async function handleDeploy() {
    try {
      await deploy(meetingId).unwrap();
      notify('success', 'Marked as deployed to the Meeting Bot');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to deploy');
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
          No context generated yet — generate one from each participant&rsquo;s current task state.
        </p>
      )}
      {otherError && (
        <p className="text-sm text-danger">
          {(error as { message?: string } | undefined)?.message ?? 'Failed to load context'}
        </p>
      )}

      {data && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-subtle">Generated {relativeTime(data.generatedAt)}</p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  deployment?.deployed ? 'bg-success-soft text-success-fg' : 'bg-surface-muted text-text-subtle'
                )}
              >
                {deployment?.deployed ? `Deployed ${relativeTime(deployment.deployedAt!)}` : 'Not deployed'}
              </span>
              {editing ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditedNarrative(draft);
                      setEditing(false);
                    }}
                  >
                    <Check className="h-4 w-4" /> Save
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDraft(narrative);
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
              <CopyButton text={narrative} />
              <Button
                size="sm"
                loading={deploying}
                disabled={deployment?.deployed}
                onClick={handleDeploy}
              >
                <Rocket className="h-4 w-4" />
                {deployment?.deployed ? 'Bot Deployed' : 'Deploy Bot'}
              </Button>
            </div>
          </div>

          {editing ? (
            // eslint-disable-next-line jsx-a11y/no-autofocus
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-72 w-full resize-y rounded-lg border border-primary bg-surface p-4 font-mono text-xs leading-relaxed text-text outline-none ring-2 ring-[color:var(--color-primary)]/20"
            />
          ) : (
            <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-muted/40 p-4 font-mono text-xs leading-relaxed text-text">
              {narrative}
            </pre>
          )}
          {editedNarrative != null && !editing && (
            <p className="text-[11px] text-text-subtle">Edited locally — “Regenerate” restores the original.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Renders `**bold**` spans within a single line of the AI summary; leaves the rest as plain text. */
function inlineMarkdown(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-text">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

/**
 * Minimal renderer for the bot's markdown summary — it only ever emits `##`
 * headings, `-`/`*` bullets and short paragraphs, so a tiny line-based parser
 * covers it without pulling in a markdown dependency (see AGENTS.md: avoid
 * unnecessary abstractions). Anything unrecognised falls through as a paragraph.
 */
function SummaryMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1 text-sm text-text-muted">
        {bullets.map((b, i) => (
          <li key={i}>{inlineMarkdown(b)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const heading = line.match(/^(#{1,6})\s+(.*)$/);

    if (bullet) {
      bullets.push(bullet[1]);
    } else if (heading) {
      flushBullets();
      blocks.push(
        <h4 key={`h-${blocks.length}`} className="text-sm font-semibold text-text">
          {inlineMarkdown(heading[2])}
        </h4>
      );
    } else if (line) {
      flushBullets();
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm text-text-muted">
          {inlineMarkdown(line)}
        </p>
      );
    }
  }
  flushBullets();

  return <div className="space-y-2">{blocks}</div>;
}

/** Pulls "Duration: 1h 2m 3s" out of the transcript footer written by transcript.py, if present. */
function parseDuration(transcript: string | null | undefined): string | null {
  const match = transcript?.match(/^Duration:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

function OverviewStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-text-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-text">{value}</p>
      {hint && <p className="text-[11px] text-text-subtle">{hint}</p>}
    </div>
  );
}

/**
 * Post-meeting view, shown on the detail page once a bot has been deployed.
 *
 * Presentational only — the parent owns the polling query (so it can also switch
 * the page to its "completed" layout and refresh the meeting). While the meeting
 * is still running (`result.ended` false) it shows a live "in progress" banner;
 * once it ends it shows the agenda that ran, invited-vs-spoke stats, the AI
 * summary (which includes the follow-up action items), and the full transcript.
 */
export function MeetingSummarySection({
  meeting,
  result,
  loading,
}: {
  meeting: Meeting;
  result?: MeetingResult;
  loading: boolean;
}) {
  const ended = result?.ended ?? false;
  const agenda = plannedAgendaForType(meeting.type);
  const invited = meeting.participants.length;
  const speakers = result?.speakers ?? [];
  const duration = parseDuration(result?.transcript);

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-text">
          {ended ? 'Meeting summary' : 'Meeting in progress'}
        </p>
      </div>

      {!ended && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted/40 px-3 py-3 text-sm text-text-subtle">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          {loading
            ? 'Checking for the meeting summary…'
            : 'The bot is in the call — the AI summary will appear here automatically once the meeting ends.'}
        </div>
      )}

      {ended && (
        <div className="space-y-4">
          {result?.endedAt && (
            <p className="text-xs text-text-subtle">
              Ended {relativeTime(result.endedAt)}
              {duration ? ` · lasted ${duration}` : ''}
            </p>
          )}

          {/* Attendance stats. "Invited" is exact; "spoke" is the honest proxy we
              have for participation — see MeetingResult.speakers. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <OverviewStat label="Invited" value={invited} />
            <OverviewStat
              label="Spoke"
              value={speakers.length}
              hint={speakers.length ? speakers.join(', ') : undefined}
            />
            <OverviewStat label="Type" value={<span className="text-sm">{meeting.type}</span>} />
          </div>

          {/* The agenda the bot ran (derived from the meeting type). */}
          <div className="rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-text-subtle" />
              <p className="text-sm font-semibold text-text">Agenda</p>
            </div>
            <ol className="ml-4 list-decimal space-y-1 text-sm text-text-muted">
              {agenda.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>

          {/* AI summary — the follow-up action items live in its "## Action Items" section. */}
          {result?.summary ? (
            <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
              <SummaryMarkdown text={result.summary} />
            </div>
          ) : (
            <p className="text-sm text-text-subtle">
              The meeting ended, but no AI summary was produced (the summariser may be unconfigured). The full
              transcript is available below.
            </p>
          )}

          {result?.transcript && (
            <details className="rounded-xl border border-border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-text">
                <FileText className="h-4 w-4 text-text-subtle" />
                Full transcript
              </summary>
              <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap border-t border-border px-4 py-3 font-mono text-xs leading-relaxed text-text-muted">
                {result.transcript}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Popup summary for a finished meeting — opened by the "See Summary" action in the
 * meetings list. Shows the three things the meeting produced: who attended
 * (invited roster + who actually spoke), the agenda that ran, and what was
 * concluded (the AI summary + action items). Fetches the result on open; the
 * meeting itself (title/type/participants) is passed in from the list row.
 */
export function MeetingSummaryModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { data: result, isLoading } = useGetMeetingResultQuery(meeting.id);
  const ended = result?.ended ?? false;
  const agenda = plannedAgendaForType(meeting.type);
  const speakers = result?.speakers ?? [];
  const spoke = new Set(speakers.map((s) => s.toLowerCase()));
  const duration = parseDuration(result?.transcript);

  return (
    <div className="fixed inset-0 z-modal grid place-items-center bg-overlay p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface-raised shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Summary of ${meeting.title}`}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <div className="mr-auto min-w-0">
            <h2 className="truncate text-sm font-semibold text-text">{meeting.title}</h2>
            <p className="truncate text-xs text-text-subtle">
              {meeting.type} · {formatMeetingTime(meeting.scheduledAt)}
              {result?.endedAt ? ` · ended ${relativeTime(result.endedAt)}` : ''}
              {duration ? ` · lasted ${duration}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-subtle hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading && <p className="text-sm text-text-subtle">Loading summary…</p>}

          {!isLoading && !ended && (
            <p className="rounded-lg border border-border bg-surface-muted/40 px-3 py-3 text-sm text-text-subtle">
              This meeting hasn&rsquo;t produced a summary yet — it runs once the meeting bot has been in the call.
            </p>
          )}

          {ended && (
            <>
              {/* Attendance — invited roster, with who actually spoke flagged. */}
              <section className="rounded-xl border border-border p-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-text-subtle" />
                  <p className="text-sm font-semibold text-text">Attendance</p>
                  <span className="ml-auto text-xs text-text-subtle">
                    {speakers.length}/{meeting.participants.length} spoke
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {meeting.participants.map((p) => {
                    const attended = spoke.has(p.name.toLowerCase());
                    return (
                      <li key={p.id} className="flex items-center gap-2.5">
                        <Avatar person={p} size={24} />
                        <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            attended ? 'bg-success-soft text-success-fg' : 'bg-surface-muted text-text-subtle'
                          )}
                        >
                          {attended ? 'Spoke' : 'No record'}
                        </span>
                      </li>
                    );
                  })}
                  {meeting.participants.length === 0 && (
                    <li className="text-sm text-text-subtle">No participants were invited.</li>
                  )}
                </ul>
              </section>

              {/* Agenda the bot ran. */}
              <section className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-text-subtle" />
                  <p className="text-sm font-semibold text-text">Agenda</p>
                </div>
                <ol className="ml-4 list-decimal space-y-1 text-sm text-text-muted">
                  {agenda.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              </section>

              {/* Conclusions — the AI summary (its "Action Items" section lives here too). */}
              <section className="rounded-xl border border-border bg-surface-muted/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-text-subtle" />
                  <p className="text-sm font-semibold text-text">What was concluded</p>
                </div>
                {result?.summary ? (
                  <SummaryMarkdown text={result.summary} />
                ) : (
                  <p className="text-sm text-text-subtle">
                    No AI summary was produced (the summariser may be unconfigured). The full transcript is below.
                  </p>
                )}
              </section>

              {result?.transcript && (
                <details className="rounded-xl border border-border">
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-text">
                    <FileText className="h-4 w-4 text-text-subtle" />
                    Full transcript
                  </summary>
                  <pre className="max-h-[24rem] overflow-y-auto whitespace-pre-wrap border-t border-border px-4 py-3 font-mono text-xs leading-relaxed text-text-muted">
                    {result.transcript}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Link
            href={`/meetings/${meeting.id}`}
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-sm font-medium text-text transition-colors hover:bg-surface-muted"
          >
            Open full detail
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
