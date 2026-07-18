'use client';

import { CheckCircle2, History, Sparkles, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAiActionHistory } from '@/store/selectors';
import { clearConversation } from '@/store/slices/aiSlice';
import { relativeTime } from '@/lib/format';
import { AiAssistant } from '@/features/ai/AiAssistant';

export default function AiPage() {
  const dispatch = useAppDispatch();
  const history = useAppSelector(selectAiActionHistory);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl text-primary-fg shadow-glow" style={{ background: 'var(--gradient-brand)' }}>
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-text">AI Assistant</h1>
          <p className="text-sm text-text-subtle">Manage your entire workspace with natural language.</p>
        </div>
        <button
          type="button"
          onClick={() => dispatch(clearConversation())}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-glass-border hover:text-text"
        >
          New chat
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Chat */}
        <div className="min-w-0 flex-1">
          <AiAssistant />
        </div>

        {/* Activity log */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-surface-muted/40 lg:flex">
          <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold text-text">
            <History className="h-4 w-4 text-text-subtle" /> Recent actions
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {history.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-text-subtle">
                Actions the assistant performs will show up here.
              </p>
            ) : (
              history.map((a) => (
                <div key={a.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
                  {a.status === 'done' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text">{a.summary}</p>
                    <p className="text-[11px] text-text-subtle">{relativeTime(a.at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
