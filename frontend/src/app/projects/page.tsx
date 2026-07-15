'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { projectsApi } from '@/lib/api/endpoints';
import type { Project } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { AppShell, PROJECTS_CHANGED_EVENT } from '@/components/shell/AppShell';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; projects: Project[] };

export default function ProjectsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <ProjectsView />
      </AppShell>
    </RequireAuth>
  );
}

function ProjectsView() {
  const { notify } = useToast();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ phase: 'loading' });
    try {
      const projects = await projectsApi.list(signal);
      setState({ phase: 'ready', projects });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // A 401 is already handled globally (session cleared + redirect to /login),
      // so there's no point rendering an error state the user will never see.
      if (error instanceof ApiError && error.status === 401) return;
      setState({
        phase: 'error',
        message: error instanceof ApiError ? error.message : 'Could not load your projects.',
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function handleCreated() {
    setCreateOpen(false);
    notify('success', 'Project created.');
    // POST /api/projects returns the creator's id but not their name, so the
    // create response isn't list-shaped. Refetch instead of patching state
    // with a half-populated record.
    await load();
    // Tell the shell (sidebar + command palette) to refresh its project list too.
    window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">Projects</h1>
          <p className="mt-1 text-sm text-text-muted">
            Every project is shared across the whole team.
          </p>
        </div>

        {/* Hidden while loading/error so we never invite an action into a broken screen. */}
        {state.phase === 'ready' && state.projects.length > 0 && (
          <Button onClick={() => setCreateOpen(true)}>New project</Button>
        )}
      </div>

      {state.phase === 'loading' && <ProjectListSkeleton />}

      {state.phase === 'error' && <ErrorState message={state.message} onRetry={() => void load()} />}

      {state.phase === 'ready' && state.projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          message="Create your first project to start adding tasks to a board."
          action={<Button onClick={() => setCreateOpen(true)}>Create a project</Button>}
        />
      )}

      {state.phase === 'ready' && state.projects.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </main>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex h-full flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary"
    >
      <h2 className="font-medium text-text">{project.name}</h2>
      <p className="text-xs text-text-subtle">
        {project.createdBy.name ? `Created by ${project.createdBy.name}` : 'Open board'}
      </p>
    </Link>
  );
}

/** LOADING: mirrors the real card grid, so there's no layout shift when data lands. */
function ProjectListSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="mt-4 h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await projectsApi.create({ name: name.trim() });
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the project.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New project" busy={submitting}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Project name" error={error ?? undefined} required>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              invalid={invalid}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website redesign"
              maxLength={255}
              disabled={submitting}
            />
          )}
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
