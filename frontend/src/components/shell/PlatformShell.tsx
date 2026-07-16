'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useAppDispatch } from '@/store/hooks';
import { toggleCommandPalette } from '@/store/slices/uiSlice';
import { SessionSync } from '@/features/shell/SessionSync';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { CommandMenu } from './CommandMenu';
import { AiButton } from './AiButton';

/**
 * The authenticated platform shell: a floating glass sidebar + glass topbar +
 * ⌘K palette, wrapped around animated route content. The ambient aurora
 * (body::before in globals.css) shows through the translucent surfaces.
 */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch(toggleCommandPalette());
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <TooltipProvider delayDuration={200}>
      <SessionSync />
      {/* One padded flex canvas: uniform gap between sidebar, topbar, and content
          so spacing stays consistent instead of each piece owning its own margins. */}
      <div className="relative flex h-dvh gap-3 overflow-hidden p-3">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <AppTopbar />
          <main className="relative min-h-0 flex-1 overflow-hidden">
            {/* Keyed CSS fade replaces AnimatePresence: no Framer runtime in the
                always-mounted shell, and no exit-wait delay on every navigation. */}
            <div
              key={pathname}
              className="glass h-full animate-fade-in overflow-hidden rounded-2xl shadow-glass"
            >
              {children}
            </div>
          </main>
        </div>
        <CommandMenu />
        <AiButton />
      </div>
    </TooltipProvider>
  );
}
