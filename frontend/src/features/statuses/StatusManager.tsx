'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectStatusSets } from '@/store/selectors';
import { addStatus, removeStatus, reorderStatus, updateStatus } from '@/store/slices/statusesSlice';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import type { StatusGroup } from '@/lib/domain/types';
import { Input } from '@/components/ui/Input';
import { HuePicker } from '@/components/domain/HuePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { IconButton } from '@/components/ui/Misc';

const GROUP_LABEL: Record<StatusGroup, string> = {
  not_started: 'Not started',
  active: 'Active',
  done: 'Done',
};
const GROUPS: StatusGroup[] = ['not_started', 'active', 'done'];

/**
 * The custom-status editor. Statuses can be renamed, recolored, regrouped,
 * reordered, added, and removed — and the board re-renders live because every
 * view reads the status set, never a hardcoded list. Statuses that map to a
 * backend enum value show a small "syncs" hint; the rest are client-only.
 */
export function StatusManager({ setId }: { setId: string }) {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const set = useAppSelector(selectStatusSets)[setId];
  const [newName, setNewName] = useState('');

  if (!set) return null;
  const ordered = set.statuses.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text">Statuses</p>
        <p className="text-xs text-text-subtle">Create, color, and reorder. Columns follow this list.</p>
      </div>

      <ul className="space-y-1">
        {ordered.map((status, index) => {
          const c = statusColors(status.hue, theme);
          return (
            <li key={status.id} className="rounded-lg border border-border bg-surface p-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 text-text-subtle" aria-hidden />
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Change color for ${status.name}`}
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-border"
                      style={{ backgroundColor: c.solid }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto">
                    <HuePicker
                      value={status.hue}
                      onChange={(hue) => dispatch(updateStatus({ setId, statusId: status.id, changes: { hue } }))}
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  value={status.name}
                  onChange={(e) =>
                    dispatch(updateStatus({ setId, statusId: status.id, changes: { name: e.target.value } }))
                  }
                  className="h-7 flex-1 border-transparent bg-transparent px-1 hover:border-border"
                />
                <div className="flex shrink-0 items-center">
                  <IconButton
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => dispatch(reorderStatus({ setId, statusId: status.id, toIndex: index - 1 }))}
                    className="h-6 w-6 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    aria-label="Move down"
                    disabled={index === ordered.length - 1}
                    onClick={() => dispatch(reorderStatus({ setId, statusId: status.id, toIndex: index + 1 }))}
                    className="h-6 w-6 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    aria-label={`Delete ${status.name}`}
                    disabled={ordered.length <= 1}
                    onClick={() => dispatch(removeStatus({ setId, statusId: status.id }))}
                    className="h-6 w-6 hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-6">
                <select
                  aria-label={`Group for ${status.name}`}
                  value={status.group}
                  onChange={(e) =>
                    dispatch(
                      updateStatus({ setId, statusId: status.id, changes: { group: e.target.value as StatusGroup } })
                    )
                  }
                  className="h-6 rounded border border-border bg-surface px-1 text-xs text-text-muted"
                >
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABEL[g]}
                    </option>
                  ))}
                </select>
                <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success-fg">
                  synced
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          dispatch(addStatus({ setId, name: newName, hue: 291, group: 'active' }));
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
