'use client';

import { useAppDispatch } from '@/store/hooks';
import { setCommandPaletteOpen } from '@/store/slices/uiSlice';

/**
 * The header search affordance. Rather than a second search implementation, it's
 * the primary doorway into the command palette (the Linear/Notion pattern): one
 * search surface, reachable by click or ⌘K. Rendered as a real button so it's
 * keyboard-focusable and announces its shortcut.
 */
export function SearchBar() {
  const dispatch = useAppDispatch();

  return (
    <button
      type="button"
      onClick={() => dispatch(setCommandPaletteOpen(true))}
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 text-sm text-text-subtle transition-colors hover:border-border-strong hover:text-text-muted sm:w-64 lg:w-80"
    >
      <span aria-hidden="true">⌕</span>
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-subtle sm:flex">
        ⌘K
      </kbd>
    </button>
  );
}
