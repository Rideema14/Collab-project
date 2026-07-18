'use client';

import { useState } from 'react';
import { FileStack, FolderPlus, Trash2, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectListById, selectListTemplates, selectTaskTemplates } from '@/store/selectors';
import { removeListTemplate, removeTaskTemplate } from '@/store/slices/templatesSlice';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/design/cn';
import { useTemplateActions } from './useTemplateActions';

/** Gallery of task + project templates: apply one, or save the current list. */
export function TemplatesModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { notify } = useToast();
  const taskTemplates = useAppSelector(selectTaskTemplates);
  const listTemplates = useAppSelector(selectListTemplates);
  const activeListId = useAppSelector((s) => s.ui.activeListId);
  const activeList = useAppSelector(selectListById(activeListId ?? ''));
  const { applyTaskTemplate, applyListTemplate, saveListAsTemplate } = useTemplateActions();
  const [tab, setTab] = useState<'task' | 'project'>('task');
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-modal grid place-items-center bg-overlay p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface-raised shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <FileStack className="h-4 w-4 text-primary" />
          <h2 className="mr-auto text-sm font-semibold text-text">Templates</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-text-subtle hover:text-text"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {(['task', 'project'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-primary-selected text-primary-on-selected' : 'text-text-muted hover:bg-surface-muted')}
            >
              {t === 'task' ? 'Task templates' : 'Project templates'}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'task' ? (
            taskTemplates.length === 0 ? (
              <Empty text="No task templates yet. Open a task → “Save as template”." />
            ) : (
              taskTemplates.map((t) => (
                <Item
                  key={t.id}
                  title={t.name}
                  subtitle={`“${t.title}” · ${t.subtasks.length} subtasks`}
                  actionLabel="Use"
                  disabled={!activeListId}
                  disabledHint="Open a list first"
                  onAction={async () => {
                    if (!activeListId) return;
                    await applyTaskTemplate(t, activeListId);
                    notify('success', `Added “${t.title}” to ${activeList?.name ?? 'the list'}`);
                    onClose();
                  }}
                  onDelete={() => dispatch(removeTaskTemplate(t.id))}
                />
              ))
            )
          ) : listTemplates.length === 0 ? (
            <Empty text="No project templates yet. Save one from a list below." />
          ) : (
            listTemplates.map((t) => (
              <Item
                key={t.id}
                title={t.name}
                subtitle={`${t.tasks.length} tasks`}
                actionLabel="Create"
                onAction={async () => {
                  await applyListTemplate(t);
                  onClose();
                }}
                onDelete={() => dispatch(removeListTemplate(t.id))}
              />
            ))
          )}
        </div>

        {activeList && (
          <div className="border-t border-border p-3">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!activeListId) return;
                setSaving(true);
                await saveListAsTemplate(activeListId, `${activeList.name} template`);
                setSaving(false);
                notify('success', `Saved “${activeList.name}” as a project template`);
                setTab('project');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-sm text-text-muted transition-colors hover:bg-glass-border hover:text-text disabled:opacity-50"
            >
              <FolderPlus className="h-4 w-4" /> Save “{activeList.name}” as project template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Item({
  title,
  subtitle,
  actionLabel,
  onAction,
  onDelete,
  disabled,
  disabledHint,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  onDelete: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-border p-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{title}</p>
        <p className="truncate text-xs text-text-subtle">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-40"
      >
        {actionLabel}
      </button>
      <button type="button" aria-label="Delete template" onClick={onDelete} className="grid h-7 w-7 place-items-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-2 py-10 text-center text-sm text-text-subtle">{text}</p>;
}
