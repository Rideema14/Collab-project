import clsx from 'clsx';
import { Button } from './Button';

/*
 * THE 4 ESSENTIAL UI STATES (Playbook, slide 10)
 * "The intern mistake is building only the 'everything-worked' screen."
 *
 * Loading / Empty / Error live here as first-class components so that every
 * dynamic view in the app has to reach for them explicitly. Success is the
 * view's own markup.
 */

/** LOADING — a skeleton that mirrors the shape of the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx('animate-pulse rounded-md bg-skeleton', className)} />;
}

/** EMPTY — "nothing here yet" plus the next action. Never a broken-looking void. */
export function EmptyState({
  title,
  message,
  action,
  compact = false,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong text-center',
        compact ? 'gap-1 p-6' : 'gap-2 p-10'
      )}
    >
      <p className={clsx('font-medium text-text', compact ? 'text-sm' : 'text-base')}>{title}</p>
      <p className="max-w-sm text-sm text-text-muted">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** ERROR — a human-readable message and a way to retry. Never a raw stack trace. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-danger bg-danger-soft p-10 text-center"
    >
      <p className="text-base font-medium text-danger-fg">{title}</p>
      <p className="max-w-sm text-sm text-danger-fg opacity-90">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </div>
  );
}
