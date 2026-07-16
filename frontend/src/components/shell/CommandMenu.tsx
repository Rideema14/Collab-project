'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as RDialog from '@radix-ui/react-dialog';
import { CornerDownLeft, List as ListIcon, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectCommandPaletteOpen, selectLists, selectSpaces } from '@/store/selectors';
import { setCommandPaletteOpen } from '@/store/slices/uiSlice';
import { setAiOpen } from '@/store/slices/aiSlice';
import { cn } from '@/lib/design/cn';

interface Item {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** ⌘K command palette — jump to any list, or run a quick action. */
export function CommandMenu() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const open = useAppSelector(selectCommandPaletteOpen);
  const lists = useAppSelector(selectLists);
  const spaces = useAppSelector(selectSpaces);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const close = () => {
    dispatch(setCommandPaletteOpen(false));
    setQuery('');
    setActive(0);
  };

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = [
      { id: 'ai', label: 'Ask AI…', hint: 'Assistant', run: () => dispatch(setAiOpen(true)) },
      { id: 'home', label: 'Go to Home', hint: 'Navigation', run: () => router.push('/home') },
      { id: 'inbox', label: 'Go to Inbox', hint: 'Navigation', run: () => router.push('/inbox') },
      { id: 'aipage', label: 'Open AI Assistant page', hint: 'Navigation', run: () => router.push('/ai') },
    ];
    const listItems: Item[] = lists.map((l) => {
      const space = spaces.find((s) => s.id === l.spaceId);
      return {
        id: l.id,
        label: l.name,
        hint: space ? `${space.icon} ${space.name}` : 'List',
        run: () => router.push(`/list/${l.id}`),
      };
    });
    const all = [...nav, ...listItems];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q));
  }, [lists, spaces, query, router, dispatch]);

  return (
    <RDialog.Root open={open} onOpenChange={(o) => (o ? dispatch(setCommandPaletteOpen(true)) : close())}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-overlay bg-overlay animate-fade-in" />
        <RDialog.Content
          className="fixed left-1/2 top-24 z-modal w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg animate-scale-in focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              items[active]?.run();
              close();
            }
          }}
        >
          <RDialog.Title className="sr-only-live">Command menu</RDialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-text-subtle" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search lists and actions…"
              className="h-12 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
            />
          </div>
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {items.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    item.run();
                    close();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm',
                    i === active ? 'bg-primary-soft text-primary-on-soft' : 'text-text hover:bg-surface-muted'
                  )}
                >
                  <ListIcon className="h-4 w-4 shrink-0 text-text-subtle" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-xs text-text-subtle">{item.hint}</span>}
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-text-subtle" />}
                </button>
              </li>
            ))}
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-subtle">No matches.</li>}
          </ul>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
