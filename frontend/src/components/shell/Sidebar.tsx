'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { Project } from '@/lib/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectMobileSidebarOpen, selectSidebarCollapsed } from '@/store/selectors';
import { setMobileSidebarOpen, toggleSidebar } from '@/store/slices/uiSlice';
import { Spinner } from '@/components/ui/Spinner';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface SidebarProps {
  projects: Project[];
  projectsLoading: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const PRIMARY_NAV: NavItem[] = [{ label: 'Projects', href: '/projects', icon: '▦' }];

export function Sidebar({ projects, projectsLoading }: SidebarProps) {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileSidebarOpen);
  const pathname = usePathname();

  const closeMobile = () => dispatch(setMobileSidebarOpen(false));

  return (
    <>
      {/* Mobile scrim — tapping it closes the drawer. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-overlay animate-fade-in bg-overlay md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Sidebar"
        className={clsx(
          'flex shrink-0 flex-col border-r border-border bg-surface transition-[width,transform] duration-200',
          // Desktop: a fixed rail that changes width. Mobile: an off-canvas drawer.
          'fixed inset-y-0 left-0 z-overlay w-64 md:static md:z-auto md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-3">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-3">
          <ul className="flex flex-col gap-0.5">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={pathname === item.href} collapsed={collapsed} onNavigate={closeMobile} />
              </li>
            ))}
          </ul>

          <div className="mt-5">
            {!collapsed && (
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-text-subtle">
                Your projects
              </p>
            )}

            {projectsLoading ? (
              <div className={clsx('flex items-center gap-2 px-2 py-2 text-text-subtle', collapsed && 'justify-center')}>
                <Spinner size="sm" />
                {!collapsed && <span className="text-xs">Loading…</span>}
              </div>
            ) : projects.length === 0 ? (
              !collapsed && <p className="px-2 py-1 text-xs text-text-subtle">No projects yet.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {projects.map((project) => {
                  const href = `/projects/${project.id}`;
                  return (
                    <li key={project.id}>
                      <ProjectLink
                        name={project.name}
                        href={href}
                        active={pathname === href}
                        collapsed={collapsed}
                        onNavigate={closeMobile}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </nav>

        {/* Collapse toggle — desktop only; the drawer closes via the scrim on mobile. */}
        <div className="hidden border-t border-border p-2 md:block">
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className={clsx(
              'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text',
              collapsed && 'justify-center'
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {collapsed ? '»' : '«'}
            </span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(
        'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors',
        collapsed && 'justify-center',
        active
          ? 'bg-primary-soft text-primary-on-soft'
          : 'text-text-muted hover:bg-surface-muted hover:text-text'
      )}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function ProjectLink({
  name,
  href,
  active,
  collapsed,
  onNavigate,
}: {
  name: string;
  href: string;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || '#';
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? name : undefined}
      className={clsx(
        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
        collapsed && 'justify-center',
        active ? 'bg-surface-muted font-medium text-text' : 'text-text-muted hover:bg-surface-muted hover:text-text'
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold',
          active ? 'bg-primary text-primary-fg' : 'bg-surface-muted text-text-subtle ring-1 ring-inset ring-border'
        )}
      >
        {letter}
      </span>
      {!collapsed && <span className="truncate">{name}</span>}
    </Link>
  );
}
