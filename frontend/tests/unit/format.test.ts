import { describe, expect, it, vi, afterEach } from 'vitest';
import { dateOnly, formatDueDate, initials, todayIso } from '@/lib/format';

afterEach(() => vi.useRealTimers());

describe('dateOnly', () => {
  it('passes a plain YYYY-MM-DD through untouched (the real backend shape)', () => {
    expect(dateOnly('2026-12-01')).toBe('2026-12-01');
  });

  it('narrows an ISO timestamp to its calendar part', () => {
    // Guards a data-loss path: <input type="date"> silently blanks on anything
    // that isn't YYYY-MM-DD, and the edit form submits every field — so a
    // timestamp reaching the form would erase the user's due date on save.
    expect(dateOnly('2026-12-01T00:00:00.000Z')).toBe('2026-12-01');
  });
});

describe('formatDueDate', () => {
  it('does not drift a day in a negative-UTC timezone', () => {
    /*
     * The whole reason the backend sends 'YYYY-MM-DD' as a string. Parsing it
     * with `new Date('2026-12-01')` yields UTC midnight, which is 30 Nov for
     * anyone west of UTC. We build a LOCAL date instead, so the 1st stays the 1st.
     */
    const original = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatDueDate('2026-12-01')).toContain('1');
      expect(formatDueDate('2026-12-01')).toContain('Dec');
      expect(formatDueDate('2026-12-01')).not.toContain('Nov');
    } finally {
      process.env.TZ = original;
    }
  });

  it('omits the year for the current year and includes it otherwise', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14));
    expect(formatDueDate('2026-12-01')).not.toContain('2026');
    expect(formatDueDate('2020-01-15')).toContain('2020');
  });

  it('accepts a timestamp without producing "Invalid Date"', () => {
    expect(formatDueDate('2026-12-01T00:00:00.000Z')).not.toMatch(/invalid/i);
  });
});

describe('todayIso', () => {
  it('returns the LOCAL date, not the UTC one', () => {
    // 14 Jul 2026, 23:00 local. A UTC-based implementation would say the 15th
    // for anyone east of UTC and mislabel "today" in the date picker.
    vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14, 23, 0, 0));
    expect(todayIso()).toBe('2026-07-14');
  });

  it('zero-pads single-digit months and days', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 0, 5));
    expect(todayIso()).toBe('2026-01-05');
  });
});

describe('initials', () => {
  it('takes the first and last name', () => {
    expect(initials('Priya Sharma')).toBe('PS');
    expect(initials('Arjun Kumar Mehta')).toBe('AM');
  });

  it('handles a single name, extra whitespace, and empty input', () => {
    expect(initials('Priya')).toBe('PR');
    expect(initials('  Priya   Sharma  ')).toBe('PS');
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});
