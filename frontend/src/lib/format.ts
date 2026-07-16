/**
 * Formatting helpers for values that arrive from the backend.
 *
 * The backend sends due dates as a bare 'YYYY-MM-DD' string on purpose — it
 * pins the Postgres DATE parser to a string so a due date never becomes a
 * timestamp and drifts a day across timezones. We must not undo that here:
 * `new Date('2026-07-17')` parses as UTC midnight and can render as the 16th
 * for anyone west of UTC. So we split the string and build a *local* date.
 */
/**
 * Narrows a due date to its 'YYYY-MM-DD' calendar part.
 *
 * Against the real backend this is a no-op — config/db.js pins the Postgres DATE
 * parser to a string, so due dates already arrive as 'YYYY-MM-DD'. It exists to
 * keep one invariant true no matter what: `<input type="date">` silently blanks
 * on any other format, and the edit form submits every field, so a timestamp
 * slipping through here would quietly erase the user's due date on save.
 * One slice buys immunity from that.
 */
export function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export function formatDueDate(isoDate: string): string {
  const [year, month, day] = dateOnly(isoDate).split('-').map(Number);
  const localDate = new Date(year, month - 1, day);

  return localDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: localDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

/**
 * Whole days from today until `dueDate` (local calendar days). Negative = overdue,
 * 0 = due today, Infinity = no due date. Used to flag "deadline very close".
 */
export function daysUntilDue(dueDate: string | null): number {
  if (!dueDate) return Infinity;
  const [y, m, d] = dateOnly(dueDate).split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Minutes → compact duration, e.g. 0m, 45m, 1h 30m, 3h. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

/** Long card-footer date, e.g. "May 15, 2026". Always shows the year. */
export function formatCardDate(isoDate: string): string {
  const [year, month, day] = dateOnly(isoDate).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Today as 'YYYY-MM-DD' in the user's own timezone — for the date input's `min`. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** "just now" / "5m ago" / "3h ago" / "2d ago" from an ISO timestamp. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const [y, m, d] = dateOnly(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "Priya Sharma" -> "PS". Used for assignee avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
