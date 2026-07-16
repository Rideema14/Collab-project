'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  FolderKanban,
  LayoutDashboard,
  Mail,
  Radio,
  Server,
  Shield,
  Trash2,
  Users2,
  UserCog,
} from 'lucide-react';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/hooks';
import {
  backendApi,
  useGetUsersQuery,
  useDeleteTaskMutation,
  useUpdateTaskStatusMutation,
  type DynamicBoard,
} from '@/store/api/backendApi';
import {
  selectAllActivity,
  selectAudit,
  selectLists,
  selectMembersMeta,
  selectMyPermissions,
  selectPresencePeers,
  selectRoles,
  selectSessionUser,
  selectTeams,
} from '@/store/selectors';
import { setMemberMeta, removeMember, addTeam, removeTeam, toggleTeamMember, logAudit } from '@/store/slices/orgSlice';
import { updateList } from '@/store/slices/hierarchySlice';
import { useWorkspaceStats } from '@/features/dashboard/useWorkspaceStats';
import { useToast } from '@/lib/toast-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Avatar } from '@/components/domain/AvatarStack';
import { Section, Table } from '@/components/ui/Section';
import type { User } from '@/lib/types';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: UserCog },
  { id: 'teams', label: 'Teams', icon: Users2 },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: ActivityIcon },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'system', label: 'System', icon: Server },
] as const;
type TabId = (typeof TABS)[number]['id'];

const LAST_ADMIN_HINT = 'A workspace needs at least one admin — promote someone else first.';

export function AdminView() {
  const canManage = useAppSelector(selectMyPermissions).includes('member.manage');
  const [tab, setTab] = useState<TabId>('overview');

  if (!canManage) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <Shield className="mx-auto mb-3 h-10 w-10 text-text-subtle" />
          <h1 className="text-lg font-semibold text-text">Admin access required</h1>
          <p className="mt-1 text-sm text-text-subtle">Only Admins can open the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-glow" style={{ background: 'var(--gradient-brand)' }}>
          <Shield className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-text">Admin</h1>
          <p className="text-sm text-text-subtle">Manage users, teams, projects, and system status.</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 flex-col gap-0.5 border-r border-border p-2 sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                tab === t.id ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-glass-border hover:text-text'
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </aside>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === 'overview' && <OverviewTab onNavigate={setTab} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'teams' && <TeamsTab />}
          {tab === 'projects' && <ProjectsTab />}
          {tab === 'tasks' && <TasksTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'system' && <SystemTab />}
        </div>
      </div>
    </div>
  );
}

/* ───────── Overview ───────── */
function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { stats } = useWorkspaceStats();
  const { data: users = [] } = useGetUsersQuery();
  const members = useAppSelector(selectMembersMeta);
  const roles = useAppSelector(selectRoles);
  const audit = useAppSelector(selectAudit);
  const systemRows = useSystemStatus();
  const roster = useMemo(() => new Map(users.map((u: User) => [u.id, u.name])), [users]);

  const tiles = [
    { label: 'Members', value: users.length },
    { label: 'Projects', value: stats.totalProjects },
    { label: 'Tasks', value: stats.totalTasks },
    { label: 'Completed', value: stats.completed },
    { label: 'Completion', value: `${stats.completionPct}%` },
    { label: 'Overdue', value: stats.overdue },
  ];

  const roleCounts = useMemo(
    () =>
      roles.map((r) => ({
        ...r,
        count: Object.values(members).filter((m) => m.roleId === r.id).length,
      })),
    [roles, members]
  );
  const unassigned = users.filter((u) => !members[u.id]).length;
  const degraded = systemRows.filter((r) => !r.ok).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-surface-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-text-subtle">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold text-text">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Roles" action="Manage users" onAction={() => onNavigate('users')}>
          <div className="space-y-2">
            {roleCounts.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="text-sm text-text">{r.name}</span>
                <span className="ml-auto text-sm tabular-nums text-text-muted">{r.count}</span>
              </div>
            ))}
            {unassigned > 0 && (
              <p className="pt-1 text-xs text-text-subtle">
                {unassigned} {unassigned === 1 ? 'member has' : 'members have'} no role yet.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Recent activity" action="View audit log" onAction={() => onNavigate('security')}>
          {audit.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-subtle">No audited actions yet.</p>
          ) : (
            <div className="space-y-2">
              {audit.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 font-medium text-text">{roster.get(a.actorId) ?? `User ${a.actorId}`}</span>
                  <span className="truncate text-text-muted">{a.action}</span>
                  <span className="ml-auto shrink-0 text-xs text-text-subtle">{relativeTime(a.at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="System"
        subtitle={degraded === 0 ? 'All services OK' : `${degraded} of ${systemRows.length} services off`}
        action="View details"
        onAction={() => onNavigate('system')}
      >
        <div className="flex flex-wrap gap-2">
          {systemRows.map((r) => (
            <span
              key={r.label}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                r.ok ? 'bg-success-soft text-success-fg' : 'bg-warning-soft text-warning-fg'
              )}
            >
              <r.icon className="h-3.5 w-3.5" /> {r.label}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ───────── Users ───────── */
function UsersTab() {
  const dispatch = useAppDispatch();
  const { notify } = useToast();
  const { data: users = [] } = useGetUsersQuery();
  const members = useAppSelector(selectMembersMeta);
  const roles = useAppSelector(selectRoles);
  const self = useAppSelector(selectSessionUser);

  // A workspace with no one holding member.manage can never be administered
  // again — SessionSync only bootstraps an admin when the roster is empty.
  const managerIds = Object.values(members)
    .filter((m) => roles.find((r) => r.id === m.roleId)?.permissions.includes('member.manage'))
    .map((m) => m.userId);

  function setRole(userId: number, roleId: string) {
    const m = members[userId];
    if (m?.roleId === roleId) return;
    const keepsManaging = roles.find((r) => r.id === roleId)?.permissions.includes('member.manage');
    if (!keepsManaging && managerIds.length === 1 && managerIds[0] === userId) {
      notify('error', LAST_ADMIN_HINT);
      return;
    }
    dispatch(setMemberMeta({ userId, roleId, capacityHours: m?.capacityHours ?? 40, status: m?.status ?? 'active' }));
    if (self) {
      const roleName = roles.find((r) => r.id === roleId)?.name ?? roleId;
      dispatch(logAudit({ actorId: self.id, action: `user.role → ${roleName}`, target: String(userId), at: new Date().toISOString() }));
    }
  }
  function setStatus(userId: number, status: 'active' | 'suspended') {
    const m = members[userId];
    dispatch(setMemberMeta({ userId, roleId: m?.roleId ?? 'role-member', capacityHours: m?.capacityHours ?? 40, status }));
    if (self) dispatch(logAudit({ actorId: self.id, action: status === 'suspended' ? 'user.suspend' : 'user.activate', target: String(userId), at: new Date().toISOString() }));
  }

  return (
    <Section title="Users" subtitle={`${users.length} members`}>
      <Table head={['Member', 'Role', 'Status', '']}>
        {users.map((u) => {
          const m = members[u.id];
          const suspended = m?.status === 'suspended';
          const isLastManager = managerIds.length === 1 && managerIds[0] === u.id;
          return (
            <tr key={u.id} className="border-t border-border">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar person={u} size={30} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{u.name}</p>
                    <p className="truncate text-xs text-text-subtle">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2">
                <select value={m?.roleId ?? ''} onChange={(e) => setRole(u.id, e.target.value)} aria-label={`Role for ${u.name}`} className="rounded border border-border bg-surface px-2 py-1 text-sm text-text">
                  {roles.map((r) => (
                    <option key={r.id} value={r.id} disabled={isLastManager && !r.permissions.includes('member.manage')}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', suspended ? 'bg-danger-soft text-danger-fg' : 'bg-success-soft text-success-fg')}>
                  {suspended ? 'Suspended' : 'Active'}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1.5">
                  <button type="button" onClick={() => notify('success', `Password reset link sent to ${u.email}`)} className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-glass-border">Reset</button>
                  <button type="button" disabled={isLastManager} title={isLastManager ? LAST_ADMIN_HINT : undefined} onClick={() => setStatus(u.id, suspended ? 'active' : 'suspended')} className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-glass-border disabled:opacity-40 disabled:hover:bg-transparent">
                    {suspended ? 'Activate' : 'Suspend'}
                  </button>
                  <button type="button" disabled={isLastManager} title={isLastManager ? LAST_ADMIN_HINT : undefined} onClick={() => { dispatch(removeMember(u.id)); notify('success', `Removed ${u.name} from the workspace`); }} className="grid h-7 w-7 place-items-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-subtle" aria-label="Delete member">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-2 text-xs text-text-subtle">
        Roles, status, and removal are workspace settings applied in this UI. Admins hold every permission; Members can
        work on tasks; Guests are read-only.
      </p>
    </Section>
  );
}

/* ───────── Teams ───────── */
const TEAM_COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#d97706', '#db2777', '#0891b2'];
function TeamsTab() {
  const dispatch = useAppDispatch();
  const teams = useAppSelector(selectTeams);
  const { data: users = [] } = useGetUsersQuery();
  const [name, setName] = useState('');

  return (
    <Section title="Teams" subtitle={`${teams.length} teams`}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          dispatch(addTeam({ name, color: TEAM_COLORS[teams.length % TEAM_COLORS.length] }));
          setName('');
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name…" className="h-9 w-56 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary" />
        <button type="submit" className="rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">Create team</button>
      </form>
      <div className="space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
              <span className="font-medium text-text">{t.name}</span>
              <span className="text-xs text-text-subtle">{t.memberIds.length} members</span>
              <button type="button" onClick={() => dispatch(removeTeam(t.id))} className="ml-auto grid h-7 w-7 place-items-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger" aria-label="Delete team"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const on = t.memberIds.includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => dispatch(toggleTeamMember({ teamId: t.id, userId: u.id }))} className={cn('flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors', on ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-muted hover:bg-glass-border')}>
                    <Avatar person={u} size={18} /> {u.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {teams.length === 0 && <p className="text-sm text-text-subtle">No teams yet.</p>}
      </div>
    </Section>
  );
}

/* ───────── Projects ───────── */
function ProjectsTab() {
  const dispatch = useAppDispatch();
  const { notify } = useToast();
  const lists = useAppSelector(selectLists);
  const store = useAppStore();
  const [deleteTask] = useDeleteTaskMutation();

  async function del(listId: string, backendProjectId: number, name: string) {
    const sub = store.dispatch(backendApi.endpoints.getBoard.initiate(backendProjectId));
    try {
      const board = await sub.unwrap();
      const tasks = Object.values(board).flat();
      for (const t of tasks) await deleteTask({ projectId: backendProjectId, taskId: t.id }).unwrap().catch(() => {});
      dispatch(updateList({ id: listId, changes: { archived: true } }));
      notify('success', `Deleted “${name}” (${tasks.length} tasks)`);
    } finally {
      sub.unsubscribe();
    }
  }

  return (
    <Section title="Projects" subtitle={`${lists.filter((l) => !l.archived).length} active`}>
      <Table head={['Project', 'Status', '']}>
        {lists.map((l) => (
          <tr key={l.id} className="border-t border-border">
            <td className="px-3 py-2 text-sm text-text">{l.name}</td>
            <td className="px-3 py-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs', l.archived ? 'bg-surface-muted text-text-subtle' : 'bg-success-soft text-success-fg')}>{l.archived ? 'Archived' : 'Active'}</span>
            </td>
            <td className="px-3 py-2">
              <div className="flex items-center justify-end gap-1.5">
                <button type="button" onClick={() => dispatch(updateList({ id: l.id, changes: { archived: !l.archived } }))} className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-glass-border">{l.archived ? 'Restore' : 'Archive'}</button>
                <button type="button" onClick={() => del(l.id, l.backendProjectId, l.name)} className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-danger-soft">Delete</button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* ───────── Tasks (bulk) ───────── */
interface FlatTask { id: number; title: string; status: string; projectId: number; project: string; }
function TasksTab() {
  const store = useAppStore();
  const { notify } = useToast();
  const allLists = useAppSelector(selectLists);
  // Memoized: `.filter()` on every render would give the effect below a new
  // array reference each time, re-firing it forever (setTasks -> re-render ->
  // new `lists` -> effect fires -> setTasks -> ...).
  const lists = useMemo(() => allLists.filter((l) => !l.archived), [allLists]);
  const [tasks, setTasks] = useState<FlatTask[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState('Done');
  const [deleteTask] = useDeleteTaskMutation();
  const [updateStatus] = useUpdateTaskStatusMutation();

  useEffect(() => {
    let cancelled = false;
    const subs = lists.map((l) => store.dispatch(backendApi.endpoints.getBoard.initiate(l.backendProjectId)));
    Promise.all(subs.map((s) => s.unwrap().catch(() => ({}) as DynamicBoard))).then((boards) => {
      if (cancelled) return;
      const flat: FlatTask[] = [];
      boards.forEach((b, i) => {
        Object.values(b).flat().forEach((t) => flat.push({ id: t.id, title: t.title, status: t.status, projectId: lists[i].backendProjectId, project: lists[i].name }));
      });
      setTasks(flat);
    });
    return () => { cancelled = true; subs.forEach((s) => s.unsubscribe()); };
  }, [lists, store]);

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function bulkStatus() {
    for (const id of sel) {
      const t = tasks.find((x) => x.id === id);
      if (t) await updateStatus({ projectId: t.projectId, taskId: id, status }).unwrap().catch(() => {});
    }
    notify('success', `Moved ${sel.size} tasks to “${status}”`);
    setSel(new Set());
  }
  async function bulkDelete() {
    for (const id of sel) {
      const t = tasks.find((x) => x.id === id);
      if (t) await deleteTask({ projectId: t.projectId, taskId: id }).unwrap().catch(() => {});
    }
    notify('success', `Deleted ${sel.size} tasks`);
    setTasks((ts) => ts.filter((t) => !sel.has(t.id)));
    setSel(new Set());
  }

  return (
    <Section title="Tasks" subtitle={`${tasks.length} tasks · ${sel.size} selected`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-32 rounded border border-border bg-surface px-2 text-sm text-text" />
        <button type="button" disabled={sel.size === 0} onClick={bulkStatus} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-40">Set status</button>
        <button type="button" disabled={sel.size === 0} onClick={bulkDelete} className="rounded-md border border-border px-3 py-1.5 text-sm text-danger hover:bg-danger-soft disabled:opacity-40">Delete selected</button>
      </div>
      <Table head={['', 'Task', 'Project', 'Status']}>
        {tasks.slice(0, 200).map((t) => (
          <tr key={t.id} className="border-t border-border">
            <td className="px-3 py-2"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} /></td>
            <td className="px-3 py-2 text-sm text-text">{t.title}</td>
            <td className="px-3 py-2 text-sm text-text-muted">{t.project}</td>
            <td className="px-3 py-2 text-sm text-text-subtle">{t.status}</td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* ───────── Security ───────── */
function SecurityTab() {
  const audit = useAppSelector(selectAudit);
  const { data: users = [] } = useGetUsersQuery();
  const roster = useMemo(() => new Map(users.map((u: User) => [u.id, u.name])), [users]);
  return (
    <Section title="Security" subtitle="Audit log">
      <div className="rounded-xl border border-border">
        {audit.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-subtle">No audited actions yet.</p>
        ) : (
          audit.slice(0, 100).map((a) => (
            <div key={a.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
              <span className="font-medium text-text">{roster.get(a.actorId) ?? `User ${a.actorId}`}</span>
              <span className="text-text-muted">{a.action}</span>
              <span className="truncate text-text-subtle">{a.target}</span>
              <span className="ml-auto shrink-0 text-xs text-text-subtle">{relativeTime(a.at)}</span>
            </div>
          ))
        )}
      </div>
      <p className="mt-2 text-xs text-text-subtle">Login history and active sessions require server-side auth (not enabled).</p>
    </Section>
  );
}

/* ───────── System ───────── */
/** Service status rows, shared by the System tab and the Overview summary. */
function useSystemStatus() {
  const peers = useAppSelector(selectPresencePeers);
  const activityCount = useAppSelector(selectAllActivity).length;
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  return [
    { icon: Mail, label: 'Email', ok: false, detail: 'Console stub — meeting invites log server-side, no provider wired up' },
    { icon: Radio, label: 'Realtime', ok: Boolean(socketUrl), detail: socketUrl ? `${Object.keys(peers).length} peers online` : 'BroadcastChannel (no socket URL)' },
    { icon: Server, label: 'Background jobs', ok: true, detail: 'Overdue task reminders — daily digest at 09:00' },
    { icon: ActivityIcon, label: 'Activity events', ok: true, detail: `${activityCount} recorded` },
  ];
}

function SystemTab() {
  const rows = useSystemStatus();
  return (
    <Section title="System" subtitle="Service status">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <r.icon className="h-4 w-4 text-text-subtle" />
            <span className="font-medium text-text">{r.label}</span>
            <span className="text-sm text-text-muted">{r.detail}</span>
            <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-medium', r.ok ? 'bg-success-soft text-success-fg' : 'bg-warning-soft text-warning-fg')}>{r.ok ? 'OK' : 'Off'}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────── shared ───────── */

/** A titled card with an optional link into the tab that owns the detail. */
function Panel({
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {subtitle && <p className="truncate text-xs text-text-subtle">{subtitle}</p>}
        </div>
        {action && onAction && (
          <button type="button" onClick={onAction} className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline">
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

