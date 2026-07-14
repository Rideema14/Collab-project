'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Blocks Escape / backdrop dismissal while a request is in flight. */
  busy?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * An accessible dialog: labelled by its title, focus moved in on open, focus
 * trapped inside while open, focus restored to the trigger on close, and
 * Escape to dismiss. A11y is not optional (Playbook) — and a modal is the
 * single easiest place to lose a keyboard user.
 */
export function Modal({ open, onClose, title, description, children, busy = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog — the first field, or the panel itself.
    const firstField = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (firstField ?? panelRef.current)?.focus();

    // The page behind a modal must not scroll.
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      // Focus trap: wrap Tab / Shift+Tab at the ends of the dialog.
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, requestClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-overlay"
        onClick={requestClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className="relative m-0 flex max-h-[90dvh] w-full animate-scale-in flex-col overflow-y-auto rounded-t-xl border border-border bg-surface p-5 shadow-lg sm:m-4 sm:max-w-md sm:rounded-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-text">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="mt-1 text-sm text-text-muted">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close dialog"
            className="-mr-2 -mt-1"
          >
            <span aria-hidden="true">✕</span>
          </Button>
        </div>

        {children}
      </div>
    </div>
  );
}
