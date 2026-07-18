'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  ChevronRight,
  ChevronsLeft,
  Folder as FolderIcon,
  FolderOpen,
  Hash,
  Home,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  PanelLeft,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/hooks';
import {
  selectExpanded,
  selectFavorites,
  selectFolders,
  selectLists,
  selectSpaces,
  selectActiveWorkspaceId,
  selectSidebarCollapsed,
  selectMobileSidebarOpen,
  selectSessionUser,
} from '@/store/selectors';
import {
  addFolder,
  addList,
  addSpace,
  removeFolder,
  toggleExpanded,
  updateFolder,
  updateList,
  updateSpace,
  DEFAULT_STATUS_SET_ID,
} from '@/store/slices/hierarchySlice';
import { setMobileSidebarOpen, toggleSidebar, toggleFavorite } from '@/store/slices/uiSlice';
import {
  backendApi,
  useCreateProjectMutation,
  useDeleteTaskMutation,
  useGetAdminDashboardQuery,
} from '@/store/api/backendApi';
import { cn } from '@/lib/design/cn';
import type { Folder, List, Space } from '@/lib/domain/types';
import { Avatar } from '@/components/domain/AvatarStack';
import { Tooltip } from '@/components/ui/Tooltip';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useToast } from '@/lib/toast-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

/**
 * The caller's REAL org role, not the old client-only orgSlice guess — reuses
 * whichever component already queries the admin dashboard (RTK Query dedupes
 * identical in-flight/cached queries, so this never fires more than one
 * request no matter how many places call it).
 */
function useIsOrgAdmin(): boolean {
  const { data } = useGetAdminDashboardQuery();
  return Boolean(data);
}

/**
 * ClickUp-style navigation: primary nav (Home / Inbox / People), a Favorites
 * section, and the full Workspace → Space → Folder → List tree with in-place
 * create / rename / delete. Collapses to a compact icon rail and expands back —
 * both directions have an always-visible control. Styled with the semantic design
 * tokens so it fits whichever theme is active.
 */
export function AppSidebar() {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileSidebarOpen);
  const width = collapsed ? 72 : 268;

  return (
    <>
      {/* Mobile drawer (always full, never collapsed) */}
      {mobileOpen && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => dispatch(setMobileSidebarOpen(false))}
            className="fixed inset-0 z-overlay animate-fade-in bg-overlay"
          />
          <aside className="fixed inset-y-2 left-2 z-overlay w-[268px] animate-slide-in-left overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
            <PanelContent collapsed={false} onNavigate={() => dispatch(setMobileSidebarOpen(false))} />
          </aside>
        </div>
      )}

      {/* Desktop floating sidebar */}
      <aside
        style={{ width }}
        className="z-10 hidden h-full shrink-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-[width] duration-med ease-premium md:block"
      >
        <PanelContent collapsed={collapsed} />
      </aside>
    </>
  );
}

const NAV = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/ai', icon: Sparkles, label: 'AI Assistant' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/people', icon: Users, label: 'People' },
];

function PanelContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const dispatch = useAppDispatch();
  const spaces = useAppSelector(selectSpaces);
  const lists = useAppSelector(selectLists);
  const favorites = useAppSelector(selectFavorites);
  const activeWsId = useAppSelector(selectActiveWorkspaceId);
  const user = useAppSelector(selectSessionUser);
  const isAdmin = useIsOrgAdmin();

  const favLists = favorites
    .map((id) => lists.find((l) => l.id === id))
    .filter((l): l is List => Boolean(l));

  return (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <div className={cn('flex items-center gap-3 px-3 py-3', collapsed && 'flex-col gap-2 px-0')}>
        <div className={collapsed ? undefined : 'min-w-0 flex-1'}>
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
        {/* Collapse / expand — always visible in BOTH states */}
        <Tooltip content={collapsed ? 'Expand' : 'Collapse'} side="right">
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-text-subtle transition-colors hover:bg-surface-muted hover:text-text"
          >
            {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </Tooltip>
      </div>

      <nav className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
        {NAV.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        {isAdmin && (
          <NavItem href="/meetings" icon={CalendarClock} label="Meetings" collapsed={collapsed} onNavigate={onNavigate} />
        )}
        {isAdmin && <NavItem href="/admin" icon={Shield} label="Admin" collapsed={collapsed} onNavigate={onNavigate} />}

        {/* Favorites */}
        {!collapsed && favLists.length > 0 && (
          <div className="mt-4">
            <SectionLabel>Favorites</SectionLabel>
            <div className="mt-1">
              {favLists.map((list) => (
                <ListLink key={`fav-${list.id}`} list={list} depth={0} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {/* Spaces — a light card grouping (border only, no shadow/glass) so this
            top-level section reads as its own group rather than a flat list. */}
        {collapsed ? (
          <>
            <div className="mb-1 mt-4 flex justify-center">
              <AddSpaceButton workspaceId={activeWsId} />
            </div>
            {spaces.map((space) => (
              <SpaceNode key={space.id} space={space} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-border p-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <SectionLabel>Spaces</SectionLabel>
              <AddSpaceButton workspaceId={activeWsId} />
            </div>
            {spaces.map((space) => (
              <SpaceNode key={space.id} space={space} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </nav>

      {/* Profile footer */}
      <div className={cn('mt-2 border-t border-border p-3', collapsed && 'flex justify-center')}>
        <div className={cn('flex items-center gap-3 rounded-xl px-1.5 py-2', collapsed && 'px-0')}>
          {user && <Avatar person={user} size={30} />}
          {!collapsed && user && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{user.name}</p>
              <p className="truncate text-xs text-text-subtle">{user.email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">{children}</span>
  );
}

function AddSpaceButton({ workspaceId }: { workspaceId: string }) {
  const dispatch = useAppDispatch();
  return (
    <Tooltip content="New space">
      <button
        type="button"
        aria-label="Add space"
        onClick={() =>
          dispatch(
            addSpace({
              workspaceId,
              name: 'New Space',
              statusSetId: DEFAULT_STATUS_SET_ID,
              createdAt: new Date().toISOString(),
            })
          )
        }
        className="grid h-5 w-5 place-items-center rounded text-text-subtle transition-colors hover:bg-surface-muted hover:text-text"
      >
        <Plus className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const inner = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-3 rounded-btn px-3 py-2 text-sm transition-colors',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-primary-soft font-semibold text-primary-on-soft'
          : 'font-medium text-text-muted hover:bg-surface-muted hover:text-text'
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {inner}
    </Tooltip>
  ) : (
    inner
  );
}

/* ─────────────────────── create-list helper ─────────────────────── */

function useCreateList() {
  const dispatch = useAppDispatch();
  const [createProject] = useCreateProjectMutation();
  return async (spaceId: string, folderId: string | null, name: string) => {
    const clean = name.trim() || 'New List';
    const project = await createProject({ name: clean }).unwrap().catch(() => null);
    if (!project) return;
    dispatch(
      addList({ backendProjectId: project.id, spaceId, folderId, name: clean, createdAt: new Date().toISOString() })
    );
  };
}

/* ─────────────────────────── Space ─────────────────────────── */

function SpaceNode({
  space,
  collapsed,
  onNavigate,
}: {
  space: Space;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const dispatch = useAppDispatch();
  const expanded = useAppSelector(selectExpanded);
  const folders = useAppSelector(selectFolders).filter((f) => f.spaceId === space.id);
  const lists = useAppSelector(selectLists).filter((l) => l.spaceId === space.id && !l.folderId && !l.archived);
  const createList = useCreateList();
  const open = expanded[space.id] !== false;
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (collapsed) {
    return (
      <Tooltip content={space.name} side="right">
        <div className="mx-auto my-1 grid h-9 w-9 place-items-center rounded-btn text-base hover:bg-surface-muted">
          <span className="grid h-5 w-5 place-items-center rounded-[3px] bg-surface-muted text-[11px] font-bold text-text-subtle">
            {space.name.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </Tooltip>
    );
  }

  return (
    <div className="mt-px">
      <Row
        depth={0}
        open={open}
        onToggle={() => dispatch(toggleExpanded(space.id))}
        leading={null}
        label={space.name}
        renaming={renaming}
        onRenameCommit={(v) => {
          if (v.trim()) dispatch(updateSpace({ id: space.id, changes: { name: v.trim() } }));
          setRenaming(false);
        }}
        onRenameCancel={() => setRenaming(false)}
        actions={
          <>
            <IconBtn label="Add" onClick={() => setAdding((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
            </IconBtn>
            <NodeMenu
              items={[
                { label: 'Add list', icon: Hash, onSelect: () => setAdding(true) },
                {
                  label: 'Add folder',
                  icon: FolderIcon,
                  onSelect: () =>
                    dispatch(addFolder({ spaceId: space.id, name: 'New Folder', createdAt: new Date().toISOString() })),
                },
                { label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
              ]}
            />
          </>
        }
      />

      {open && (
        <div className="animate-fade-in">
          {folders.map((folder) => (
            <FolderNode key={folder.id} folder={folder} onNavigate={onNavigate} />
          ))}
          {lists.map((list) => (
            <ListLink key={list.id} list={list} depth={1} onNavigate={onNavigate} />
          ))}
          {adding && (
            <InlineInput
              depth={1}
              placeholder="List name…"
              onCommit={(name) => {
                createList(space.id, null, name);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          )}
          {folders.length === 0 && lists.length === 0 && !adding && (
            <p className="py-1 pl-9 text-xs text-text-subtle">Empty space</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Folder ─────────────────────────── */

function FolderNode({ folder, onNavigate }: { folder: Folder; onNavigate?: () => void }) {
  const dispatch = useAppDispatch();
  const expanded = useAppSelector(selectExpanded);
  const lists = useAppSelector(selectLists).filter((l) => l.folderId === folder.id && !l.archived);
  const createList = useCreateList();
  const open = expanded[folder.id] !== false;
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);

  return (
    <div>
      <Row
        depth={1}
        open={open}
        onToggle={() => dispatch(toggleExpanded(folder.id))}
        leading={
          open ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-text-subtle" />
          ) : (
            <FolderIcon className="h-4 w-4 shrink-0 text-text-subtle" />
          )
        }
        label={folder.name}
        renaming={renaming}
        onRenameCommit={(v) => {
          if (v.trim()) dispatch(updateFolder({ id: folder.id, changes: { name: v.trim() } }));
          setRenaming(false);
        }}
        onRenameCancel={() => setRenaming(false)}
        actions={
          <>
            <IconBtn label="Add list" onClick={() => setAdding((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
            </IconBtn>
            <NodeMenu
              items={[
                { label: 'Add list', icon: Hash, onSelect: () => setAdding(true) },
                { label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
                {
                  label: 'Delete folder',
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => dispatch(removeFolder(folder.id)),
                },
              ]}
            />
          </>
        }
      />

      {open && (
        <div className="animate-fade-in">
          {lists.map((list) => (
            <ListLink key={list.id} list={list} depth={2} onNavigate={onNavigate} />
          ))}
          {adding && (
            <InlineInput
              depth={2}
              placeholder="List name…"
              onCommit={(name) => {
                createList(folder.spaceId, folder.id, name);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          )}
          {lists.length === 0 && !adding && (
            <p className="py-1 text-xs text-text-subtle" style={{ paddingLeft: 12 + 2 * 16 }}>
              No lists
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── List ─────────────────────────── */

function ListLink({ list, depth, onNavigate }: { list: List; depth: number; onNavigate?: () => void }) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { notify } = useToast();
  const pathname = usePathname();
  const favorites = useAppSelector(selectFavorites);
  const isAdmin = useIsOrgAdmin();
  const [deleteTask] = useDeleteTaskMutation();
  const href = `/list/${list.id}`;
  const active = pathname === href;
  const fav = favorites.includes(list.id);
  const [renaming, setRenaming] = useState(false);
  const pad = 8 + depth * 16;

  async function handleDelete() {
    if (!window.confirm(`Delete "${list.name}" and all its tasks? This can't be undone.`)) return;
    const sub = store.dispatch(backendApi.endpoints.getBoard.initiate(list.backendProjectId));
    try {
      const board = await sub.unwrap();
      const tasks = Object.values(board).flat();
      for (const t of tasks) await deleteTask({ projectId: list.backendProjectId, taskId: t.id }).unwrap().catch(() => {});
      dispatch(updateList({ id: list.id, changes: { archived: true } }));
      notify('success', `Deleted "${list.name}" (${tasks.length} tasks)`);
    } finally {
      sub.unsubscribe();
    }
  }

  if (renaming) {
    return (
      <InlineInput
        depth={depth}
        initial={list.name}
        placeholder="List name…"
        onCommit={(name) => {
          if (name.trim()) dispatch(updateList({ id: list.id, changes: { name: name.trim() } }));
          setRenaming(false);
        }}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 rounded-lg pr-1.5 transition-colors',
        active ? 'bg-primary-soft' : 'hover:bg-surface-muted'
      )}
      style={{ paddingLeft: pad }}
    >
      <Link href={href} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm">
        <Hash className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary-on-soft' : 'text-text-subtle')} />
        <span className={cn('truncate', active ? 'font-semibold text-primary-on-soft' : 'text-text-muted')}>{list.name}</span>
      </Link>
      <button
        type="button"
        aria-label={fav ? 'Unfavorite' : 'Favorite'}
        onClick={() => dispatch(toggleFavorite(list.id))}
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded text-text-subtle transition-opacity hover:text-warning',
          fav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <Star className={cn('h-3.5 w-3.5', fav && 'fill-warning text-warning')} />
      </button>
      <NodeMenu
        items={[
          { label: 'Rename', icon: Pencil, onSelect: () => setRenaming(true) },
          {
            label: fav ? 'Remove favorite' : 'Add to favorites',
            icon: Star,
            onSelect: () => dispatch(toggleFavorite(list.id)),
          },
          ...(isAdmin
            ? [
                {
                  label: list.archived ? 'Restore' : 'Archive',
                  icon: list.archived ? ArchiveRestore : Archive,
                  onSelect: () => dispatch(updateList({ id: list.id, changes: { archived: !list.archived } })),
                },
                { label: 'Delete', icon: Trash2, destructive: true, onSelect: () => void handleDelete() },
              ]
            : []),
        ]}
      />
    </div>
  );
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function Row({
  depth,
  open,
  onToggle,
  leading,
  label,
  actions,
  renaming,
  onRenameCommit,
  onRenameCancel,
}: {
  depth: number;
  open: boolean;
  onToggle: () => void;
  leading: React.ReactNode;
  label: string;
  actions: React.ReactNode;
  renaming: boolean;
  onRenameCommit: (value: string) => void;
  onRenameCancel: () => void;
}) {
  const pad = 4 + depth * 16;
  return (
    <div
      className="group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-surface-muted"
      style={{ paddingLeft: pad }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Collapse' : 'Expand'}
        className="grid h-5 w-5 shrink-0 place-items-center text-text-subtle"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-90')} />
      </button>
      {leading}
      {renaming ? (
        <RenameInput initial={label} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 truncate py-1.5 text-left text-sm font-semibold text-text"
        >
          {label}
        </button>
      )}
      {!renaming && (
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="grid h-6 w-6 place-items-center rounded text-text-subtle transition-colors hover:bg-surface-muted hover:text-text"
      >
        {children}
      </button>
    </Tooltip>
  );
}

interface MenuItemDef {
  label: string;
  icon: typeof Home;
  onSelect: () => void;
  destructive?: boolean;
}

function NodeMenu({ items }: { items: MenuItemDef[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More"
          className="grid h-6 w-6 place-items-center rounded text-text-subtle transition-colors hover:bg-surface-muted hover:text-text"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item, i) => {
          const Icon = item.icon;
          const needsSep = i > 0 && items[i - 1].destructive !== item.destructive;
          return (
            <div key={item.label}>
              {needsSep && <DropdownMenuSeparator />}
              <DropdownMenuItem destructive={item.destructive} onSelect={item.onSelect}>
                <Icon className="h-4 w-4" />
                {item.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineInput({
  depth,
  placeholder,
  initial = '',
  onCommit,
  onCancel,
}: {
  depth: number;
  placeholder: string;
  initial?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const pad = 8 + depth * 16;
  return (
    <div style={{ paddingLeft: pad }} className="py-0.5 pr-1.5">
      <RenameInput initial={initial} placeholder={placeholder} onCommit={onCommit} onCancel={onCancel} />
    </div>
  );
}

function RenameInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    // eslint-disable-next-line jsx-a11y/no-autofocus
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value);
        if (e.key === 'Escape') onCancel();
      }}
      className="h-7 w-full rounded-lg border border-primary bg-surface px-2 text-sm text-text outline-none ring-2 ring-[color:var(--color-primary)]/20"
    />
  );
}