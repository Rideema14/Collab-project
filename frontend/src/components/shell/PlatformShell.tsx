'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { useAppDispatch } from '@/store/hooks';
import { toggleCommandPalette } from '@/store/slices/uiSlice';
import { pageTransition } from '@/lib/design/motion';
import { SessionSync } from '@/features/shell/SessionSync';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { CommandMenu } from './CommandMenu';

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
      <div className="relative flex h-dvh overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col px-2 pb-2 md:pl-0">
          <AppTopbar />
          <main className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                variants={pageTransition}
                initial="hidden"
                animate="show"
                exit="exit"
                className="glass h-full overflow-hidden rounded-2xl shadow-glass"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <CommandMenu />
      </div>
    </TooltipProvider>
  );
}
