'use client';

import { cn } from '@/lib/design/cn';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';

export interface AvatarPerson {
  id: number;
  name: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Deterministic hue per user id, so an avatar's color is stable. */
function hueFor(id: number): number {
  return (id * 47) % 360;
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
  const c = statusColors(hueFor(person.id), theme);
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
        backgroundColor: c.soft,
        color: c.onSoft,
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
