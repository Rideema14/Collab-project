'use client';

import { useState } from 'react';
import { Check, Copy, Rocket, Shield } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectMyPermissions } from '@/store/selectors';
import {
  useGetMeetingContextQuery,
  useGenerateMeetingContextMutation,
  useDeployMeetingMutation,
  useGetMeetingDeploymentQuery,
} from '@/store/api/backendApi';
import { useToast } from '@/lib/toast-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Button } from '@/components/ui/Button';
import type { EmailDeliveryStatus, Meeting, MeetingContextPayload } from '@/lib/types';

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

  const status = (error as { status?: number } | undefined)?.status;
  const notFound = status === 404;
  const otherError = Boolean(error) && !notFound;

  async function handleGenerate() {
    try {
      await generate(meetingId).unwrap();
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
              <CopyButton text={data.payload.narrative} />
              <Button size="sm" loading={deploying} onClick={handleDeploy}>
                <Rocket className="h-4 w-4" />
                Deploy Bot
              </Button>
            </div>
          </div>

          <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-muted/40 p-4 font-mono text-xs leading-relaxed text-text">
            {data.payload.narrative}
          </pre>
        </div>
      )}
    </div>
  );
}
