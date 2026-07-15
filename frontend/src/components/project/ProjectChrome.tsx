'use client';

import Link from 'next/link';
import { totalTasks } from '@/lib/board';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useProject } from './ProjectProvider';
import { ProjectTabs } from './ProjectTabs';

/**
 * The persistent frame around every project view: breadcrumb, title, the primary
 * actions, and the tab bar — plus the shared loading/error gate, so each view
 * page can assume the data is ready and just render its content.
 */
export function ProjectChrome({ children }: { children: React.ReactNode }) {
  const { projectId, phase, errorMessage, project, board, reload, openCreateTask, openVoice } =
    useProject();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link
        href="/projects"
        className="mb-4 inline-flex rounded-sm text-sm text-text-muted hover:text-text"
      >
        ← All projects
      </Link>

      {phase === 'loading' && <ChromeSkeleton />}

      {phase === 'error' && <ErrorState message={errorMessage} onRetry={reload} />}

      {phase === 'ready' && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-text sm:text-2xl">
                {project?.name}
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {totalTasks(board)} task{totalTasks(board) === 1 ? '' : 's'} on this board
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={openVoice}>
                <span aria-hidden="true">🎤</span> Add by voice
              </Button>
              <Button onClick={openCreateTask}>
                <span aria-hidden="true">+</span> Add task
              </Button>
            </div>
          </div>

          <div className="mt-5 border-b border-border">
            <ProjectTabs projectId={projectId} />
          </div>

          <div className="pt-6">{children}</div>
        </>
      )}
    </div>
  );
}

function ChromeSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-5 h-9 w-full max-w-md" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
