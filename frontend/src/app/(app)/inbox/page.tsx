'use client';

import { Bell, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectNotifications } from '@/store/selectors';
import { markAllRead, markRead } from '@/store/slices/notificationsSlice';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';

const TONE_DOT: Record<string, string> = {
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
};

export default function InboxPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectNotifications);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-text">Inbox</h1>
          <button
            type="button"
            onClick={() => dispatch(markAllRead())}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-text-muted hover:bg-surface-muted"
          >
            <Check className="h-4 w-4" /> Mark all read
          </button>
        </div>

        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => dispatch(markRead(n.id))}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-surface-muted',
                  n.read ? 'bg-surface' : 'bg-primary-soft/30'
                )}
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-border-strong' : TONE_DOT[n.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{n.title}</p>
                  {n.body && <p className="text-sm text-text-muted">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-text-subtle">{relativeTime(n.createdAt)}</p>
                </div>
              </button>
            </li>
          ))}
          {items.length === 0 && <p className="py-10 text-center text-sm text-text-subtle">You're all caught up.</p>}
        </ul>
      </div>
    </div>
  );
}
