/**
 * Default seed values for the client-side domain. These are STARTING POINTS the
 * user can fully edit — statuses can be renamed, recolored, reordered, added, and
 * removed. Nothing here is hardcoded into the views; the views render whatever the
 * `statuses` slice contains. This file only decides what a brand-new space starts with.
 */

import type { Priority, Role, StatusDef, StatusSet } from './types';

/**
 * The default status set. Note it deliberately goes BEYOND the backend's three
 * enum values to prove the point — "Backlog" and "In Review" are client-only
 * statuses with no backend equivalent (`backendStatus: null`), while the three
 * that map to the enum sync to the server on move.
 */
export function defaultStatusSet(id: string): StatusSet {
  const statuses: StatusDef[] = [
    { id: `${id}-backlog`, name: 'Backlog', hue: 220, group: 'not_started', order: 0, backendStatus: null },
    { id: `${id}-todo`, name: 'To Do', hue: 199, group: 'not_started', order: 1, backendStatus: 'To Do' },
    { id: `${id}-progress`, name: 'In Progress', hue: 45, group: 'active', order: 2, backendStatus: 'In Progress' },
    { id: `${id}-review`, name: 'In Review', hue: 262, group: 'active', order: 3, backendStatus: null },
    { id: `${id}-done`, name: 'Done', hue: 142, group: 'done', order: 4, backendStatus: 'Done' },
  ];
  return { id, name: 'Default', statuses };
}

/**
 * Map a backend enum status → a status id within a set. Used when we only know the
 * server-side status (e.g. right after a backend fetch) and need a fine-grained id.
 * Falls back to the first status in the matching backend group.
 */
export function statusIdForBackend(
  set: StatusSet,
  backend: 'To Do' | 'In Progress' | 'Done'
): string {
  const exact = set.statuses.find((s) => s.backendStatus === backend);
  if (exact) return exact.id;
  const group = backend === 'Done' ? 'done' : backend === 'In Progress' ? 'active' : 'not_started';
  const byGroup = set.statuses.find((s) => s.group === group);
  return (byGroup ?? set.statuses[0]).id;
}

export const PRIORITY_META: Record<Priority, { label: string; hue: number; rank: number }> = {
  urgent: { label: 'Urgent', hue: 0, rank: 0 },
  high: { label: 'High', hue: 28, rank: 1 },
  normal: { label: 'Normal', hue: 211, rank: 2 },
  low: { label: 'Low', hue: 199, rank: 3 },
  none: { label: 'None', hue: 220, rank: 4 },
};

export function defaultRoles(): Role[] {
  return [
    {
      id: 'role-admin',
      name: 'Admin',
      color: '#2563eb',
      system: true,
      permissions: [
        'task.create',
        'task.edit',
        'task.delete',
        'status.manage',
        'member.manage',
        'space.manage',
        'settings.manage',
      ],
    },
    {
      id: 'role-member',
      name: 'Member',
      color: '#16a34a',
      system: true,
      permissions: ['task.create', 'task.edit', 'task.delete'],
    },
    {
      id: 'role-guest',
      name: 'Guest',
      color: '#64748b',
      system: true,
      permissions: [],
    },
  ];
}
