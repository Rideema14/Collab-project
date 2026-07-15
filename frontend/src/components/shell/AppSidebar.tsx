'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, ChevronsLeft, Home, Inbox, List as ListIcon, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectExpanded,
  selectLists,
  selectSpaces,
  selectActiveWorkspaceId,
  selectHierarchy,
  selectSidebarCollapsed,
  selectMobileSidebarOpen,
  selectSessionUser,
} from '@/store/selectors';
import { addSpace, toggleExpanded, DEFAULT_STATUS_SET_ID } from '@/store/slices/hierarchySlice';
import { setMobileSidebarOpen, toggleSidebar } from '@/store/slices/uiSlice';
import { useCreateProjectMutation } from '@/store/api/backendApi';
import { spring } from '@/lib/design/motion';
import { cn } from '@/lib/design/cn';
import type { Space } from '@/lib/domain/types';
import { Avatar } from '@/components/domain/AvatarStack';
import { Tooltip } from '@/components/ui/Tooltip';

const NAV = [
  { href: '/home', icon: Home, label: 'Dashboard' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
];

export function AppSidebar() {
  const dispatch = useAppDispatch();
  const spaces = useAppSelector(selectSpaces);
  const workspaces = useAppSelector(selectHierarchy).workspaces;
  const activeWsId = useAppSelector(selectActiveWorkspaceId);
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileSidebarOpen);
  const user = useAppSelector(selectSessionUser);
  const activeWs = workspaces.find((w) => w.id === activeWsId) ?? workspaces[0];
  const width = collapsed ? 76 : 264;

  const content = (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 px-3 pb-3 pt-1">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold shadow-glow"
          style={{ background: 'var(--gradient-brand)', color: '#fff' }}
        >
          {(activeWs?.name ?? 'K').slice(0, 1).toUpperCase()}
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={spring.snappy}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-sm font-semibold text-text">{activeWs?.name}</p>
              <p className="text-xs text-text-subtle">Workspace</p>
            </motion.div>
          )}
        </AnimatePresence>
        {!collapsed && (
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-label="Collapse sidebar"
            className="hidden text-text-subtle transition-colors hover:text-text md:block"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5">
        {NAV.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} />
        ))}

        <div className="mb-1 mt-5 flex items-center justify-between px-2">
          {!collapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">Spaces</span>
          )}
          <Tooltip content="New space">
            <button
              type="button"
              aria-label="Add space"
              onClick={() =>
                dispatch(
                  addSpace({
                    workspaceId: activeWsId,
                    name: 'New Space',
                    statusSetId: DEFAULT_STATUS_SET_ID,
                    createdAt: new Date().toISOString(),
                  })
                )
              }
              className={cn('text-text-subtle transition-colors hover:text-text', collapsed && 'mx-auto')}
            >
              <Plus className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        {spaces.map((space) => (
          <SpaceNode key={space.id} space={space} collapsed={collapsed} />
        ))}
      </nav>

      {/* Profile footer */}
      <div className="mt-2 border-t border-glass-border p-2.5">
        <div className={cn('flex items-center gap-2.5 rounded-xl px-1.5 py-1.5', collapsed && 'justify-center')}>
          {user && <Avatar person={user} size={30} />}
          {!collapsed && user && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{user.name}</p>
              <p className="truncate text-xs text-text-subtle">{user.email}</p>
            </div>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => dispatch(toggleSidebar())}
              aria-label="Expand sidebar"
              className="hidden md:block"
            />
          )}
        </div>
        {collapsed && (
          <Tooltip content="Expand">
            <button
              type="button"
              onClick={() => dispatch(toggleSidebar())}
              aria-label="Expand sidebar"
              className="mt-1 hidden w-full items-center justify-center rounded-lg py-1 text-text-subtle hover:bg-glass-border hover:text-text md:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => dispatch(setMobileSidebarOpen(false))}
              className="fixed inset-0 z-overlay bg-overlay md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={spring.smooth}
              className="glass-strong fixed inset-y-2 left-2 z-overlay w-64 rounded-2xl shadow-lg md:hidden"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop floating sidebar */}
      <motion.aside
        animate={{ width }}
        transition={spring.smooth}
        className="glass sticky top-2 z-10 my-2 ml-2 hidden h-[calc(100dvh-1rem)] shrink-0 overflow-hidden rounded-2xl shadow-glass md:block"
        style={{ width }}
      >
        {content}
      </motion.aside>
    </>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const inner = (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors',
        collapsed && 'justify-center',
        active ? 'text-text' : 'text-text-muted hover:text-text'
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={spring.smooth}
          className="absolute inset-0 -z-10 rounded-xl bg-primary-soft ring-1 ring-inset ring-[color:var(--color-primary)]/25"
        />
      )}
      <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
  return collapsed ? <Tooltip content={label} side="right">{inner}</Tooltip> : inner;
}

function SpaceNode({ space, collapsed }: { space: Space; collapsed: boolean }) {
  const dispatch = useAppDispatch();
  const expanded = useAppSelector(selectExpanded);
  const lists = useAppSelector(selectLists).filter((l) => l.spaceId === space.id);
  const open = expanded[space.id] !== false && !collapsed;
  const [createProject, { isLoading }] = useCreateProjectMutation();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isLoading) return;
    await createProject({ name: name.trim() }).unwrap().catch(() => null);
    setName('');
    setAdding(false);
  }

  if (collapsed) {
    return (
      <Tooltip content={space.name} side="right">
        <button
          type="button"
          className="mx-auto my-1 grid h-9 w-9 place-items-center rounded-xl text-base hover:bg-glass-border"
        >
          {space.icon}
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="mt-0.5">
      <div className="group flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors hover:bg-glass-border">
        <button
          type="button"
          onClick={() => dispatch(toggleExpanded(space.id))}
          className="text-text-subtle"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-90')} />
        </button>
        <span className="text-sm">{space.icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{space.name}</span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-label="Add list"
          className="text-text-subtle opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-4 overflow-hidden border-l border-glass-border pl-2"
          >
            {lists.map((list) => (
              <ListLink key={list.id} id={list.id} name={list.name} />
            ))}
            {adding && (
              <form onSubmit={createList} className="px-1 py-1">
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => !name.trim() && setAdding(false)}
                  placeholder="List name…"
                  className="h-7 w-full rounded-lg border border-primary bg-surface px-2 text-sm text-text outline-none"
                />
              </form>
            )}
            {lists.length === 0 && !adding && <p className="px-2 py-1 text-xs text-text-subtle">No lists yet</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ListLink({ id, name }: { id: string; name: string }) {
  const pathname = usePathname();
  const href = `/list/${id}`;
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
        active ? 'bg-glass-border font-medium text-text' : 'text-text-muted hover:bg-glass-border hover:text-text'
      )}
    >
      <ListIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{name}</span>
    </Link>
  );
}
