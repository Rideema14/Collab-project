'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { projectsApi } from '@/lib/api/endpoints';
import type { Project } from '@/lib/types';
import { useAppDispatch } from '@/store/hooks';
import { toggleCommandPalette } from '@/store/slices/uiSlice';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';

/** Other views fire this after mutating projects so the sidebar/palette refresh. */
export const PROJECTS_CHANGED_EVENT = 'kuberya:projects-changed';

/**
 * The authenticated application shell: a collapsible sidebar, a top bar with
 * global search / notifications / profile, and a command palette — wrapped
 * around whatever page is being rendered.
 *
 * It owns the projects list once, on the client, and feeds it to both the
 * sidebar and the command palette so there's a single source of truth for
 * "what projects exist" across the shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const list = await projectsApi.list(signal);
      setProjects(list);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // A 401 is handled globally (redirect to /login); anything else just leaves
      // the sidebar without its project list — the page itself surfaces errors.
      if (!(error instanceof ApiError)) return;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and whenever the route changes (so a freshly opened board that
  // didn't exist in the list shows up), plus on the explicit change event.
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, pathname]);

  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
  }, [load]);

  // The global ⌘K / Ctrl+K shortcut. Ignored while typing in a field, except to
  // toggle the palette itself.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        dispatch(toggleCommandPalette());
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar projects={projects} projectsLoading={loading} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1">{children}</main>
      </div>

      <CommandPalette projects={projects} />
    </div>
  );
}
