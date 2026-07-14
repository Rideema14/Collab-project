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

/** Today as 'YYYY-MM-DD' in the user's own timezone — for the date input's `min`. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** "Priya Sharma" -> "PS". Used for assignee avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
