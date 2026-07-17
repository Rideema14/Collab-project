'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  BarChart3,
  CalendarClock,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Trash2,
  Users2,
  UserCog,
} from 'lucide-react';
import { useAppSelector, useAppStore } from '@/store/hooks';
import { selectLists } from '@/store/selectors';
import {
  backendApi,
  useGetAdminDashboardQuery,
  useGetAdminAnalyticsQuery,
  useGetAdminUsersQuery,
  useChangeUserRoleMutation,
  useSetUserStatusMutation,
  useForceLogoutUserMutation,
  useRemoveAdminUserMutation,
  useGetTeamsQuery,
  useCreateTeamMutation,
  useDeleteTeamMutation,
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useGetUsersQuery,
  useGetProjectsQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetMeetingsQuery,
  useGetAuditLogQuery,
  useGetLoginHistoryQuery,
  useGetOrgSettingsQuery,
  useUpdateOrgSettingsMutation,
  useBulkUpdateTaskStatusMutation,
  useBulkDeleteTasksMutation,
  type DynamicBoard,
} from '@/store/api/backendApi';
import { useToast } from '@/lib/toast-context';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import { Avatar } from '@/components/domain/AvatarStack';
import { Section, Table } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { ORG_ROLES, type OrgRole } from '@/lib/types';

function errorMessage(err: unknown, fallback: string): string {
  return (err as { message?: string } | undefined)?.message ?? fallback;
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: UserCog },
  { id: 'teams', label: 'Teams', icon: Users2 },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'permissions', label: 'Permissions', icon: KeyRound },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: ActivityIcon },
  { id: 'meetings', label: 'Meetings', icon: CalendarClock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'audit', label: 'Audit Logs', icon: ActivityIcon },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const;
type TabId = (typeof TABS)[number]['id'];

const ROLE_OPTIONS = ORG_ROLES;

/**
 * Server-backed admin module. Every section reads/writes through /api/admin or
 * /api/teams — nothing here is client-Redux state. Access itself is gated by
 * the SAME server check every other admin route uses: this component simply
 * reflects whatever the dashboard query returns (200 vs 403), rather than
 * duplicating a second, client-only permission model.
 */
export function AdminView() {
  const { data, isLoading, isError, error } = useGetAdminDashboardQuery();
  const [tab, setTab] = useState<TabId>('dashboard');
  const status = (error as { status?: number } | undefined)?.status;

  if (isLoading) {
    return <p className="grid h-full place-items-center text-sm text-text-subtle">Loading admin…</p>;
  }

  if (isError || !data) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <Shield className="mx-auto mb-3 h-10 w-10 text-text-subtle" />
          <h1 className="text-lg font-semibold text-text">Admin access required</h1>
          <p className="mt-1 text-sm text-text-subtle">
            {status === 403 ? 'Only Admins and Owners can open the admin panel.' : 'Could not load the admin panel.'}
          </p>
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
          <p className="text-sm text-text-subtle">Manage users, teams, projects, and organization settings.</p>
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
          {tab === 'dashboard' && <DashboardTab onNavigate={setTab} />}
          {tab === 'users' && <UsersTab />}
          {tab === 'teams' && <TeamsTab />}
          {tab === 'roles' && <RolesTab />}
          {tab === 'permissions' && <PermissionsTab />}
          {tab === 'projects' && <ProjectsTab />}
          {tab === 'tasks' && <TasksTab />}
          {tab === 'meetings' && <MeetingsTab />}
          {tab === 'analytics' && <AnalyticsTab />}
          {tab === 'audit' && <AuditLogTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

/* ───────── Dashboard ───────── */
function DashboardTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { data } = useGetAdminDashboardQuery();
  if (!data) return null;

  const tiles = [
    { label: 'Members', value: data.counts.members },
    { label: 'Projects', value: data.counts.projects },
    { label: 'Tasks', value: data.counts.tasks },
    { label: 'Completed', value: data.taskStats.completed },
    { label: 'Overdue', value: data.taskStats.overdue },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            {data.roleBreakdown.map((r) => (
              <div key={r.role} className="flex items-center gap-2.5">
                <span className="text-sm capitalize text-text">{r.role}</span>
                <span className="ml-auto text-sm tabular-nums text-text-muted">{r.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent activity" action="View audit log" onAction={() => onNavigate('audit')}>
          {data.recentAudit.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-subtle">No audited actions yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentAudit.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="shrink-0 font-medium text-text">{a.actor?.name ?? 'Someone'}</span>
                  <span className="truncate text-text-muted">{a.action}</span>
                  <span className="ml-auto shrink-0 text-xs text-text-subtle">{relativeTime(a.at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ───────── Users ───────── */
function UsersTab() {
  const { notify } = useToast();
  const { data: users = [] } = useGetAdminUsersQuery();
  const [changeRole] = useChangeUserRoleMutation();
  const [setStatus] = useSetUserStatusMutation();
  const [forceLogout] = useForceLogoutUserMutation();
  const [removeUser] = useRemoveAdminUserMutation();

  async function handleRole(userId: number, role: OrgRole) {
    try {
      await changeRole({ userId, role }).unwrap();
    } catch (err) {
      notify('error', errorMessage(err, 'Failed to change role'));
    }
  }
  async function handleStatus(userId: number, suspended: boolean) {
    try {
      await setStatus({ userId, status: suspended ? 'active' : 'suspended' }).unwrap();
    } catch (err) {
      notify('error', errorMessage(err, 'Failed to update status'));
    }
  }
  async function handleForceLogout(userId: number, name: string) {
    try {
      await forceLogout(userId).unwrap();
      notify('success', `Signed ${name} out of every session`);
    } catch (err) {
      notify('error', errorMessage(err, 'Failed to force logout'));
    }
  }
  async function handleRemove(userId: number, name: string) {
    try {
      await removeUser(userId).unwrap();
      notify('success', `Removed ${name} from the organization`);
    } catch (err) {
      notify('error', errorMessage(err, 'Failed to remove user'));
    }
  }

  return (
    <Section title="Users" subtitle={`${users.length} members`}>
      <Table head={['Member', 'Role', 'Status', '']}>
        {users.map((u) => {
          const suspended = u.status === 'suspended';
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
                <select
                  value={u.role}
                  onChange={(e) => handleRole(u.id, e.target.value as OrgRole)}
                  aria-label={`Role for ${u.name}`}
                  className="rounded border border-border bg-surface px-2 py-1 text-sm capitalize text-text"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
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
                  <button type="button" onClick={() => handleForceLogout(u.id, u.name)} className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-glass-border">
                    Force logout
                  </button>
                  <button type="button" onClick={() => handleStatus(u.id, suspended)} className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-glass-border">
                    {suspended ? 'Activate' : 'Suspend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(u.id, u.name)}
                    className="grid h-7 w-7 place-items-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger"
                    aria-label="Remove member"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-2 text-xs text-text-subtle">
        Roles and status are enforced server-side on every request — this isn&rsquo;t cosmetic. The only owner can&rsquo;t be
        demoted, suspended, or removed until another owner exists.
      </p>
    </Section>
  );
}

/* ───────── Teams ───────── */
function TeamsTab() {
  const { notify } = useToast();
  const { data: teams = [] } = useGetTeamsQuery();
  const { data: users = [] } = useGetUsersQuery();
  const [createTeam] = useCreateTeamMutation();
  const [deleteTeam] = useDeleteTeamMutation();
  const [addMember] = useAddTeamMemberMutation();
  const [removeMember] = useRemoveTeamMemberMutation();
  const [name, setName] = useState('');

  return (
    <Section title="Teams" subtitle={`${teams.length} teams`}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          try {
            await createTeam({ name }).unwrap();
            setName('');
          } catch (err) {
            notify('error', errorMessage(err, 'Failed to create team'));
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New team name…"
          className="h-9 w-56 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
          Create team
        </button>
      </form>
      <div className="space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-medium text-text">{t.name}</span>
              <span className="text-xs text-text-subtle">{t.members.length} members</span>
              <button
                type="button"
                onClick={() => deleteTeam(t.id).catch(() => notify('error', 'Failed to delete team'))}
                className="ml-auto grid h-7 w-7 place-items-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger"
                aria-label="Delete team"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const on = t.members.some((m) => m.id === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      on
                        ? removeMember({ teamId: t.id, userId: u.id }).catch(() => notify('error', 'Failed to update team'))
                        : addMember({ teamId: t.id, userId: u.id }).catch(() => notify('error', 'Failed to update team'))
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors',
                      on ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-muted hover:bg-glass-border'
                    )}
                  >
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

/* ───────── Roles (reference) ───────── */
const ROLE_INFO: { role: OrgRole; description: string }[] = [
  { role: 'owner', description: 'Ultimate authority — billing, deleting the organization, and the only role that can’t be demoted below one remaining owner.' },
  { role: 'admin', description: 'Full operational control: users, teams, projects, meetings, analytics, permissions. Everything except billing and deleting the org.' },
  { role: 'manager', description: 'Creates and edits projects, creates and assigns tasks, views reports.' },
  { role: 'member', description: 'Creates and updates tasks, comments, joins meetings. The default role for new signups.' },
  { role: 'guest', description: 'Read-only. Intended to be scoped to specific shared projects (per-project scoping is not built yet — see Permissions).' },
  { role: 'bot', description: 'Read-only, for the external Meeting Bot integration. Hard-blocked from every mutating action regardless of anything else.' },
];
function RolesTab() {
  return (
    <Section title="Roles" subtitle="Fixed set, enforced server-side on every request">
      <Table head={['Role', 'Description']}>
        {ROLE_INFO.map((r) => (
          <tr key={r.role} className="border-t border-border">
            <td className="px-3 py-2 text-sm font-medium capitalize text-text">{r.role}</td>
            <td className="px-3 py-2 text-sm text-text-muted">{r.description}</td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* ───────── Permissions (reference) ───────── */
const PERMISSION_MATRIX: { action: string; minRole: string }[] = [
  { action: 'project.create', minRole: 'manager' },
  { action: 'project.edit / project.archive', minRole: 'manager' },
  { action: 'project.delete', minRole: 'admin' },
  { action: 'task.create / task.edit / task.delete', minRole: 'member' },
  { action: 'meeting.manage (create/edit/cancel)', minRole: 'admin' },
  { action: 'meeting.read', minRole: 'member' },
  { action: 'user.manage / team.manage', minRole: 'admin' },
  { action: 'org.settings', minRole: 'admin' },
  { action: 'org.delete / billing.manage', minRole: 'owner' },
  { action: 'admin.access (this whole panel)', minRole: 'admin' },
];
function PermissionsTab() {
  return (
    <Section title="Permissions" subtitle="Minimum role required per action — enforced by requirePermission on every route, not just checked here">
      <Table head={['Action', 'Minimum role']}>
        {PERMISSION_MATRIX.map((p) => (
          <tr key={p.action} className="border-t border-border">
            <td className="px-3 py-2 font-mono text-xs text-text">{p.action}</td>
            <td className="px-3 py-2 text-sm capitalize text-text-muted">{p.minRole}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-text-subtle">
        Bot accounts are additionally hard-blocked from every action that isn&rsquo;t a read, regardless of this table.
      </p>
    </Section>
  );
}

/* ───────── Projects ───────── */
function ProjectsTab() {
  const { notify } = useToast();
  const { data: projects = [] } = useGetProjectsQuery();
  const [updateProject] = useUpdateProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();

  return (
    <Section title="Projects" subtitle={`${projects.filter((p) => !p.archived).length} active`}>
      <Table head={['Project', 'Status', '']}>
        {projects.map((p) => (
          <tr key={p.id} className="border-t border-border">
            <td className="px-3 py-2 text-sm text-text">{p.name}</td>
            <td className="px-3 py-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs', p.archived ? 'bg-surface-muted text-text-subtle' : 'bg-success-soft text-success-fg')}>
                {p.archived ? 'Archived' : 'Active'}
              </span>
            </td>
            <td className="px-3 py-2">
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    updateProject({ projectId: p.id, input: { archived: !p.archived } }).catch(() => notify('error', 'Failed to update project'))
                  }
                  className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-glass-border"
                >
                  {p.archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${p.name}" and every task in it? This can't be undone.`)) return;
                    try {
                      await deleteProject(p.id).unwrap();
                      notify('success', `Deleted "${p.name}"`);
                    } catch (err) {
                      notify('error', errorMessage(err, 'Failed to delete project'));
                    }
                  }}
                  className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-danger-soft"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* ───────── Tasks (bulk) ───────── */
interface FlatTask {
  id: number;
  title: string;
  status: string;
  projectId: number;
  project: string;
}
function TasksTab() {
  const store = useAppStore();
  const { notify } = useToast();
  const allLists = useAppSelector(selectLists);
  const lists = useMemo(() => allLists.filter((l) => !l.archived), [allLists]);
  const [tasks, setTasks] = useState<FlatTask[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState('Done');
  const [bulkUpdateStatus] = useBulkUpdateTaskStatusMutation();
  const [bulkDelete] = useBulkDeleteTasksMutation();

  useEffect(() => {
    let cancelled = false;
    const subs = lists.map((l) => store.dispatch(backendApi.endpoints.getBoard.initiate(l.backendProjectId)));
    Promise.all(subs.map((s) => s.unwrap().catch(() => ({}) as DynamicBoard))).then((boards) => {
      if (cancelled) return;
      const flat: FlatTask[] = [];
      boards.forEach((b, i) => {
        Object.values(b)
          .flat()
          .forEach((t) => flat.push({ id: t.id, title: t.title, status: t.status, projectId: lists[i].backendProjectId, project: lists[i].name }));
      });
      setTasks(flat);
    });
    return () => {
      cancelled = true;
      subs.forEach((s) => s.unsubscribe());
    };
  }, [lists, store]);

  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function handleBulkStatus() {
    try {
      const { updated } = await bulkUpdateStatus({ taskIds: [...sel], status }).unwrap();
      notify('success', `Moved ${updated.length} task${updated.length === 1 ? '' : 's'} to "${status}"`);
      setSel(new Set());
    } catch (err) {
      notify('error', errorMessage(err, 'Bulk update failed'));
    }
  }
  async function handleBulkDelete() {
    try {
      const { deleted } = await bulkDelete([...sel]).unwrap();
      notify('success', `Deleted ${deleted.length} task${deleted.length === 1 ? '' : 's'}`);
      setTasks((ts) => ts.filter((t) => !deleted.includes(t.id)));
      setSel(new Set());
    } catch (err) {
      notify('error', errorMessage(err, 'Bulk delete failed'));
    }
  }

  return (
    <Section title="Tasks" subtitle={`${tasks.length} tasks · ${sel.size} selected`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-32 rounded border border-border bg-surface px-2 text-sm text-text" />
        <button type="button" disabled={sel.size === 0} onClick={handleBulkStatus} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg disabled:opacity-40">
          Set status
        </button>
        <button type="button" disabled={sel.size === 0} onClick={handleBulkDelete} className="rounded-md border border-border px-3 py-1.5 text-sm text-danger hover:bg-danger-soft disabled:opacity-40">
          Delete selected
        </button>
      </div>
      <Table head={['', 'Task', 'Project', 'Status']}>
        {tasks.slice(0, 200).map((t) => (
          <tr key={t.id} className="border-t border-border">
            <td className="px-3 py-2">
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
            </td>
            <td className="px-3 py-2 text-sm text-text">{t.title}</td>
            <td className="px-3 py-2 text-sm text-text-muted">{t.project}</td>
            <td className="px-3 py-2 text-sm text-text-subtle">{t.status}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-text-subtle">
        Bulk actions are enforced server-side per task&rsquo;s own organization — selecting more than what belongs to you isn&rsquo;t possible.
      </p>
    </Section>
  );
}

/* ───────── Meetings ───────── */
function MeetingsTab() {
  const { data: meetings = [] } = useGetMeetingsQuery();
  return (
    <Section title="Meetings" subtitle={`${meetings.length} meetings`}>
      <Table head={['Meeting', 'When', 'Status']}>
        {meetings.map((m) => (
          <tr key={m.id} className="border-t border-border">
            <td className="px-3 py-2 text-sm text-text">{m.title}</td>
            <td className="px-3 py-2 text-sm text-text-muted">{new Date(m.scheduledAt).toLocaleString()}</td>
            <td className="px-3 py-2 text-sm capitalize text-text-subtle">{m.status.replace('_', ' ')}</td>
          </tr>
        ))}
        {meetings.length === 0 && (
          <tr>
            <td colSpan={3} className="px-3 py-6 text-center text-sm text-text-subtle">
              No meetings scheduled yet.
            </td>
          </tr>
        )}
      </Table>
    </Section>
  );
}

/* ───────── Analytics ───────── */
function AnalyticsTab() {
  const { data } = useGetAdminAnalyticsQuery();
  if (!data) return null;
  return (
    <Section title="Analytics" subtitle="Task completion across the organization">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
          <p className="text-xs uppercase tracking-wide text-text-subtle">Total tasks</p>
          <p className="mt-1 text-2xl font-semibold text-text">{data.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
          <p className="text-xs uppercase tracking-wide text-text-subtle">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-text">{data.completed}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
          <p className="text-xs uppercase tracking-wide text-text-subtle">Completion rate</p>
          <p className="mt-1 text-2xl font-semibold text-text">{data.completionRate}%</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-muted/40 p-4">
          <p className="text-xs uppercase tracking-wide text-text-subtle">Overdue</p>
          <p className="mt-1 text-2xl font-semibold text-danger">{data.overdue}</p>
        </div>
      </div>
      <Table head={['Status', 'Count']}>
        {data.statusBreakdown.map((s) => (
          <tr key={s.status} className="border-t border-border">
            <td className="px-3 py-2 text-sm text-text">{s.status}</td>
            <td className="px-3 py-2 text-sm text-text-muted">{s.count}</td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* ───────── Audit Logs ───────── */
function AuditLogTab() {
  const { data: entries = [] } = useGetAuditLogQuery();
  return (
    <Section title="Audit Logs" subtitle={`${entries.length} recent actions`}>
      <div className="rounded-xl border border-border">
        {entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-subtle">No audited actions yet.</p>
        ) : (
          entries.map((a) => (
            <div key={a.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
              <span className="font-medium text-text">{a.actor?.name ?? 'Someone'}</span>
              <span className="text-text-muted">{a.action}</span>
              {a.targetType && <span className="truncate text-text-subtle">{a.targetType}#{a.targetId}</span>}
              <span className="ml-auto shrink-0 text-xs text-text-subtle">{relativeTime(a.at)}</span>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}

/* ───────── Security ───────── */
function SecurityTab() {
  const { data: events = [] } = useGetLoginHistoryQuery();
  return (
    <Section title="Security" subtitle="Login history">
      <div className="rounded-xl border border-border">
        {events.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-subtle">No logins recorded yet.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
              <span className="font-medium text-text">{e.user.name}</span>
              <span className="truncate text-text-subtle">{e.ip ?? 'unknown IP'}</span>
              <span className="truncate text-xs text-text-subtle">{e.userAgent ?? ''}</span>
              <span className="ml-auto shrink-0 text-xs text-text-subtle">{relativeTime(e.at)}</span>
            </div>
          ))
        )}
      </div>
      <p className="mt-2 text-xs text-text-subtle">
        Use Users → Force logout to instantly invalidate every token a user currently holds.
      </p>
    </Section>
  );
}

/* ───────── Settings ───────── */
function SettingsTab() {
  const { notify } = useToast();
  const { data } = useGetOrgSettingsQuery();
  const [updateSettings, { isLoading }] = useUpdateOrgSettingsMutation();
  const [name, setName] = useState(data?.name ?? '');

  useEffect(() => {
    if (data) setName(data.name);
  }, [data]);

  if (!data) return null;

  return (
    <Section title="Settings" subtitle="Organization-level settings">
      <form
        className="max-w-sm space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await updateSettings({ name }).unwrap();
            notify('success', 'Settings saved');
          } catch (err) {
            notify('error', errorMessage(err, 'Failed to save settings'));
          }
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-text">Organization name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
          />
        </label>
        <Button type="submit" loading={isLoading}>
          Save
        </Button>
      </form>
    </Section>
  );
}

/* ───────── shared ───────── */
function Panel({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
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
