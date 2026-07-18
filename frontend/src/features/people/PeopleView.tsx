'use client';

import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useGetUsersQuery } from '@/store/api/backendApi';
import { selectMembersMeta, selectRoles, selectSessionUser } from '@/store/selectors';
import { useWorkspaceStats } from '@/features/dashboard/useWorkspaceStats';
import { useToast } from '@/lib/toast-context';
import { Avatar } from '@/components/domain/AvatarStack';
import type { MemberMeta } from '@/lib/domain/types';
import type { User } from '@/lib/types';

/**
 * The People (members) directory — the real `GET /users` roster, with role and
 * capacity labels drawn from local display-only state. A pure read-only
 * directory: role/status/team management lives in /admin (server-enforced —
 * see docs/ENTERPRISE_PLAN_V2.md), not here.
 */
export function PeopleView() {
  const { notify } = useToast();
  const { data: users, isLoading } = useGetUsersQuery();
  const roles = useAppSelector(selectRoles);
  const membersMeta = useAppSelector(selectMembersMeta);
  const self = useAppSelector(selectSessionUser);
  const { stats } = useWorkspaceStats();
  const [query, setQuery] = useState('');

  const countByName = useMemo(() => {
    const map = new Map<string, { count: number; done: number }>();
    for (const a of stats.byAssignee) map.set(a.name, { count: a.count, done: a.done });
    return map;
  }, [stats.byAssignee]);

  const filtered = useMemo(() => {
    const list = users ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-text">People</h1>
          <p className="text-sm text-text-subtle">
            {users?.length ?? 0} {users?.length === 1 ? 'member' : 'members'} in this workspace
          </p>
        </div>
        <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-muted px-3">
          <Search className="h-4 w-4 text-text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="w-40 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle sm:w-56"
          />
        </div>
        <button
          type="button"
          onClick={() => notify('success', 'Invites are managed from Admin → Users.')}
          className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary-fg shadow-glow transition-opacity hover:opacity-90"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </button>
      </div>

      {/* Roster */}
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-text-subtle">Loading members…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-subtle">No people match “{query}”.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-text-subtle">
                  <th className="px-4 py-2.5 font-semibold">Member</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Role</th>
                  <th className="hidden px-4 py-2.5 text-center font-semibold md:table-cell">Active tasks</th>
                  <th className="hidden px-4 py-2.5 text-center font-semibold md:table-cell">Completed</th>
                  <th className="hidden px-4 py-2.5 text-center font-semibold lg:table-cell">Capacity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <MemberRow
                    key={user.id}
                    user={user}
                    meta={membersMeta[user.id]}
                    roleName={roles.find((r) => r.id === membersMeta[user.id]?.roleId)?.name}
                    roleColor={roles.find((r) => r.id === membersMeta[user.id]?.roleId)?.color}
                    isSelf={self?.id === user.id}
                    counts={countByName.get(user.name)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-text-subtle">
          Roles and capacity tailor views and the workload planner. Admins can manage roles, teams, and members in Admin.
        </p>
      </div>
    </div>
  );
}

function MemberRow({
  user,
  meta,
  roleName,
  roleColor,
  isSelf,
  counts,
}: {
  user: User;
  meta: MemberMeta | undefined;
  roleName: string | undefined;
  roleColor: string | undefined;
  isSelf: boolean;
  counts: { count: number; done: number } | undefined;
}) {
  const active = (counts?.count ?? 0) - (counts?.done ?? 0);
  return (
    <tr className="border-t border-border transition-colors hover:bg-surface-muted">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar person={user} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-text">{user.name}</span>
              {isSelf && (
                <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  You
                </span>
              )}
            </div>
            <span className="truncate text-xs text-text-subtle">{user.email}</span>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: roleColor ?? '#94a3b8' }} />
          {roleName ? (
            <span className="text-sm text-text-muted">{roleName}</span>
          ) : (
            <span className="text-xs text-text-subtle">—</span>
          )}
        </div>
      </td>
      <td className="hidden px-4 py-3 text-center md:table-cell">
        <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-surface-muted px-2 py-0.5 text-sm font-medium text-text">
          {active}
        </span>
      </td>
      <td className="hidden px-4 py-3 text-center text-text-muted md:table-cell">{counts?.done ?? 0}</td>
      <td className="hidden px-4 py-3 text-center text-text-muted lg:table-cell">{meta?.capacityHours ?? 40}h/wk</td>
    </tr>
  );
}
