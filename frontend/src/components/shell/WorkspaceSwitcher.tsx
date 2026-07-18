'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectActiveWorkspaceId, selectHierarchy } from '@/store/selectors';
import { addWorkspace, setActiveWorkspace } from '@/store/slices/hierarchySlice';
import { statusColors } from '@/lib/domain/status-color';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/design/cn';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

/** A workspace's letter chip, colored by its stable per-workspace hue (same convention as Space chips). */
function WorkspaceChip({ name, hue, theme, size = 36 }: { name: string; hue: number; theme: 'light' | 'dark'; size?: number }) {
  const c = statusColors(hue, theme);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-btn text-sm font-bold"
      style={{ width: size, height: size, background: c.solid, color: c.onSolid }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Dropdown for switching between (and creating) workspaces — replaces the old
 * static header block. Dispatches the already-wired `setActiveWorkspace`
 * reducer, which `selectSpaces` derives from, so switching immediately
 * re-filters the whole Spaces tree.
 */
export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const workspaces = useAppSelector(selectHierarchy).workspaces;
  const activeWsId = useAppSelector(selectActiveWorkspaceId);
  const activeWs = workspaces.find((w) => w.id === activeWsId) ?? workspaces[0];

  const menu = (
    <DropdownMenuContent align="start" className="min-w-[14rem]">
      {workspaces.map((ws) => (
        <DropdownMenuItem key={ws.id} onSelect={() => dispatch(setActiveWorkspace(ws.id))}>
          <WorkspaceChip name={ws.name} hue={ws.hue} theme={theme} size={22} />
          <span className="flex-1 truncate">{ws.name}</span>
          {ws.id === activeWsId && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => dispatch(addWorkspace({ name: 'New Workspace', createdAt: new Date().toISOString() }))}>
        <Plus className="h-4 w-4 text-text-subtle" />
        Create workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (collapsed) {
    return (
      <DropdownMenu>
        <Tooltip content={activeWs?.name ?? 'Workspace'} side="right">
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Switch workspace" className="grid place-items-center rounded-btn">
              <WorkspaceChip name={activeWs?.name ?? 'K'} hue={activeWs?.hue ?? 211} theme={theme} />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        {menu}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch workspace"
          className={cn(
            'flex w-full items-center gap-3 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-surface-muted'
          )}
        >
          <WorkspaceChip name={activeWs?.name ?? 'K'} hue={activeWs?.hue ?? 211} theme={theme} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{activeWs?.name}</p>
            <p className="text-xs text-text-subtle">Workspace</p>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-text-subtle" />
        </button>
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}
