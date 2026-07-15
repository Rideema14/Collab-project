'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArchiveRestore, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { statusColors } from '@/lib/domain/status-color';
import { cn } from '@/lib/design/cn';
import { spring } from '@/lib/design/motion';
import type { StatusDef, StatusGroup } from '@/lib/domain/types';
import { Input } from '@/components/ui/Input';
import { HuePicker } from '@/components/domain/HuePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { IconButton } from '@/components/ui/Misc';
import { useStatusActions } from './useStatusActions';

const GROUP_LABEL: Record<StatusGroup, string> = {
  not_started: 'Not started',
  active: 'Active',
  done: 'Done',
};
const GROUPS: StatusGroup[] = ['not_started', 'active', 'done'];

/**
 * The per-project custom-status editor. Statuses can be renamed, recolored,
 * regrouped, drag-reordered, archived, added, and removed — and the board
 * re-renders live because every view reads the status set, never a hardcoded list.
 * Scoped to a LIST: opening it forks a per-project set (see useStatusActions), so
 * editing one project's workflow never affects another's.
 */
export function StatusManager({ listId }: { listId: string }) {
  const { set, addNew, recolor, regroup, reorder, rename, setArchived, remove } =
    useStatusActions(listId);
  const [newName, setNewName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!set) return null;

  const ordered = set.statuses.slice().sort((a, b) => a.order - b.order);
  const active = ordered.filter((s) => !s.archived);
  const archived = ordered.filter((s) => s.archived);
  const canDelete = set.statuses.length > 1;
  const canArchive = active.length > 1;

  function handleDragEnd(e: DragEndEvent) {
    const { active: dragged, over } = e;
    if (!over || dragged.id === over.id) return;
    const orderedIds = ordered.map((s) => s.id);
    const toIndex = orderedIds.indexOf(String(over.id));
    if (toIndex !== -1) reorder(String(dragged.id), toIndex);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text">Statuses</p>
        <p className="text-xs text-text-subtle">
          Drag to reorder · columns follow this list. Changes apply to this project only.
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={active.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {active.map((status) => (
              <SortableStatusRow
                key={status.id}
                status={status}
                canArchive={canArchive}
                canDelete={canDelete}
                onRename={(name) => rename(status.id, name)}
                onRecolor={(hue) => recolor(status.id, hue)}
                onRegroup={(group) => regroup(status.id, group)}
                onArchive={() => setArchived(status.id, true)}
                onDelete={() => remove(status.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {archived.length > 0 && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-text-muted hover:text-text"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showArchived && 'rotate-90')} />
            Archived ({archived.length})
          </button>
          <AnimatePresence initial={false}>
            {showArchived && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={spring.smooth}
                className="overflow-hidden px-1.5 pb-1.5"
              >
                {archived.map((status) => (
                  <ArchivedRow
                    key={status.id}
                    status={status}
                    canDelete={canDelete}
                    onRestore={() => setArchived(status.id, false)}
                    onDelete={() => remove(status.id)}
                  />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          addNew(newName, 291, 'active');
          setNewName('');
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New status name"
          className="h-8"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-sm font-medium text-primary-fg',
            'hover:bg-primary-hover disabled:opacity-55'
          )}
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
    </div>
  );
}

function SortableStatusRow({
  status,
  canArchive,
  canDelete,
  onRename,
  onRecolor,
  onRegroup,
  onArchive,
  onDelete,
}: {
  status: StatusDef;
  canArchive: boolean;
  canDelete: boolean;
  onRename: (name: string) => void;
  onRecolor: (hue: number) => void;
  onRegroup: (group: StatusGroup) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id });
  const c = statusColors(status.hue, theme);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-lg border border-border bg-surface p-2',
        isDragging && 'relative z-10 shadow-md ring-1 ring-primary/40'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Drag ${status.name}`}
          className="shrink-0 cursor-grab touch-none text-text-subtle hover:text-text active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Change color for ${status.name}`}
              className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-border transition-transform hover:scale-110"
              style={{ backgroundColor: c.solid }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <HuePicker value={status.hue} onChange={onRecolor} />
          </PopoverContent>
        </Popover>

        <StatusNameInput name={status.name} onCommit={onRename} />

        <div className="flex shrink-0 items-center">
          <IconButton
            aria-label={`Archive ${status.name}`}
            disabled={!canArchive}
            onClick={onArchive}
            className="h-6 w-6 disabled:opacity-30"
          >
            <Archive className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            aria-label={`Delete ${status.name}`}
            disabled={!canDelete}
            onClick={onDelete}
            className="h-6 w-6 hover:text-danger disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="mt-1.5 pl-6">
        <select
          aria-label={`Group for ${status.name}`}
          value={status.group}
          onChange={(e) => onRegroup(e.target.value as StatusGroup)}
          className="h-6 rounded border border-border bg-surface px-1 text-xs text-text-muted"
        >
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g]}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

function ArchivedRow({
  status,
  canDelete,
  onRestore,
  onDelete,
}: {
  status: StatusDef;
  canDelete: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const c = statusColors(status.hue, theme);
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="h-3 w-3 shrink-0 rounded-full opacity-60" style={{ backgroundColor: c.solid }} />
      <span className="flex-1 truncate text-sm text-text-muted line-through">{status.name}</span>
      <IconButton aria-label={`Restore ${status.name}`} onClick={onRestore} className="h-6 w-6">
        <ArchiveRestore className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        aria-label={`Delete ${status.name}`}
        disabled={!canDelete}
        onClick={onDelete}
        className="h-6 w-6 hover:text-danger disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </li>
  );
}

/**
 * Rename commits on blur / Enter (not per keystroke) so the backend task migration
 * fires once with the final name. Stays in sync when the name changes elsewhere.
 */
function StatusNameInput({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setValue(name);
  }, [name, focused]);

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onCommit(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setValue(name);
          e.currentTarget.blur();
        }
      }}
      className="h-7 flex-1 border-transparent bg-transparent px-1 hover:border-border"
    />
  );
}
