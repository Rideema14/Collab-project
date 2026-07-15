'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

interface TabDef {
  label: string;
  segment: string;
  icon: string;
}

const TABS: TabDef[] = [
  { label: 'Overview', segment: '', icon: '◈' },
  { label: 'Board', segment: 'board', icon: '▦' },
  { label: 'List', segment: 'list', icon: '☰' },
  { label: 'Calendar', segment: 'calendar', icon: '▤' },
  { label: 'Analytics', segment: 'analytics', icon: '◔' },
  { label: 'Activity', segment: 'activity', icon: '↻' },
];

export function ProjectTabs({ projectId }: { projectId: number }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav aria-label="Project views" className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-text'
                : 'border-transparent text-text-muted hover:border-border-strong hover:text-text'
            )}
          >
            <span aria-hidden="true" className="text-xs">
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
