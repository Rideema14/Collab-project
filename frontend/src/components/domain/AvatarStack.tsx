'use client';

import { cn } from '@/lib/design/cn';
import { useTheme } from '@/lib/theme-context';

export interface AvatarPerson {
  id: number;
  name: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/**
 * Neutral grey avatar tone per user id — pure black/white shades (no hue), so a
 * stack of avatars reads as a set of clean initials chips instead of adding a
 * second color to the orange/black/white system. The id picks one of a few grey
 * steps so people are still visually distinguishable.
 */
function avatarTone(id: number, theme: 'light' | 'dark') {
  const step = Math.abs(id) % 4;
  return theme === 'dark'
    ? { bg: `hsl(0 0% ${24 + step * 5}%)`, fg: 'hsl(0 0% 92%)' }
    : { bg: `hsl(0 0% ${86 - step * 5}%)`, fg: 'hsl(0 0% 28%)' };
}

export function Avatar({
  person,
  size = 24,
  ring = false,
  className,
}: {
  person: AvatarPerson;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const { theme } = useTheme();
  const c = avatarTone(person.id, theme);
  return (
    <span
      title={person.name}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold',
        ring && 'ring-2 ring-surface',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: c.bg,
        color: c.fg,
        fontSize: size * 0.4,
      }}
    >
      {initials(person.name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = 24,
}: {
  people: AvatarPerson[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center" style={{ paddingLeft: shown.length > 1 ? size * 0.3 : 0 }}>
      {shown.map((p) => (
        <div key={p.id} style={{ marginLeft: -size * 0.3 }}>
          <Avatar person={p} size={size} ring />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{ marginLeft: -size * 0.3, width: size, height: size, fontSize: size * 0.36 }}
          className="inline-flex items-center justify-center rounded-full bg-surface-muted font-semibold text-text-muted ring-2 ring-surface"
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
