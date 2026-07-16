'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Maximize2, Sparkles, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAiOpen } from '@/store/selectors';
import { setAiOpen, toggleAiOpen } from '@/store/slices/aiSlice';
import { AiAssistant } from '@/features/ai/AiAssistant';

/**
 * The always-available AI entry point: a floating action button that opens a
 * slide-over Assistant from anywhere in the app. Hidden on the dedicated /ai page
 * (where the full assistant already lives).
 */
export function AiButton() {
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectAiOpen);
  const pathname = usePathname();
  const onAiPage = pathname === '/ai';

  return (
    <>
      {!onAiPage && (
        <button
          type="button"
          onClick={() => dispatch(toggleAiOpen())}
          aria-label="Open AI assistant"
          className="fixed bottom-5 right-5 z-dropdown grid h-14 w-14 place-items-center rounded-full text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-modal flex justify-end">
          <button
            type="button"
            aria-label="Close assistant"
            onClick={() => dispatch(setAiOpen(false))}
            className="flex-1 bg-overlay animate-fade-in"
          />
          <aside className="flex w-full max-w-md animate-fade-in flex-col border-l border-border bg-surface shadow-lg">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white shadow-glow" style={{ background: 'var(--gradient-brand)' }}>
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="mr-auto font-semibold text-text">AI Assistant</span>
              <Link
                href="/ai"
                onClick={() => dispatch(setAiOpen(false))}
                aria-label="Open full assistant"
                className="grid h-8 w-8 place-items-center rounded-lg text-text-subtle transition-colors hover:bg-glass-border hover:text-text"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => dispatch(setAiOpen(false))}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-text-subtle transition-colors hover:bg-glass-border hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AiAssistant onNavigate={() => dispatch(setAiOpen(false))} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
