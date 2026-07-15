'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { relativeTime } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectNotifications, selectUnreadCount } from '@/store/selectors';
import {
  clearNotifications,
  markAllRead,
  markRead,
  removeNotification,
  type NotificationTone,
} from '@/store/slices/notificationsSlice';
import { useDismiss } from './useDismiss';

const TONE_DOT: Record<NotificationTone, string> = {
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
};

export function NotificationCenter() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notifications = useAppSelector(selectNotifications);
  const unread = useAppSelector(selectUnreadCount);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), containerRef, triggerRef);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <span aria-hidden="true" className="text-base">
          🔔
        </span>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-primary-fg"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-dropdown mt-1 w-80 max-w-[calc(100vw-2rem)] animate-scale-in overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-text">Notifications</p>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => dispatch(markAllRead())}
                disabled={unread === 0}
                className="rounded-sm text-xs font-medium text-primary hover:underline disabled:text-text-subtle disabled:no-underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                <span aria-hidden="true" className="text-2xl">
                  🎉
                </span>
                <p className="text-sm font-medium text-text">You’re all caught up</p>
                <p className="text-xs text-text-subtle">New activity will show up here.</p>
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className="border-b border-border last:border-0">
                  <div
                    className={clsx(
                      'group flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-muted',
                      !n.read && 'bg-primary-soft/40'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[n.tone])}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        dispatch(markRead(n.id));
                        if (n.href) {
                          router.push(n.href);
                          setOpen(false);
                        }
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className={clsx('truncate text-sm', n.read ? 'text-text-muted' : 'font-medium text-text')}>
                        {n.title}
                      </p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-text-subtle">{relativeTime(n.createdAt)}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch(removeNotification(n.id))}
                      aria-label={`Dismiss “${n.title}”`}
                      className="h-6 w-6 shrink-0 rounded text-text-subtle opacity-0 transition hover:bg-surface hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          {notifications.length > 0 && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => dispatch(clearNotifications())}
                className="w-full rounded-md py-1.5 text-center text-xs font-medium text-text-muted hover:bg-surface-muted hover:text-text"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
