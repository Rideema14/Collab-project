'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Check, X, AlertTriangle, Mic, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/hooks';
import { useGetUsersQuery, useSendAiCommandMutation } from '@/store/api/backendApi';
import { selectAiBusy, selectAiMessages, selectAiPending } from '@/store/selectors';
import { addMessage, recordAction, setBusy, setPending } from '@/store/slices/aiSlice';
import { todayIso } from '@/lib/format';
import { cn } from '@/lib/design/cn';
import type { RootState } from '@/store/store';
import type { AiAction, AiPlan } from '@/lib/types';
import { useAiExecutor } from './useAiExecutor';
import { useVoiceInput } from './useVoiceInput';

const SUGGESTIONS = [
  'Create a project called Mobile App Redesign',
  'Show me all tasks due this week',
  'Move all overdue tasks to Testing',
  "Summarize the workspace progress",
];

/** Short human label for the action-history log. */
function describeAction(a: AiAction): string {
  switch (a.type) {
    case 'create_project': return `Create project “${a.name}”`;
    case 'rename_project': return `Rename project → “${a.name}”`;
    case 'archive_project': return `Archive “${a.project}”`;
    case 'delete_project': return `Delete project “${a.project}”`;
    case 'create_task': return `Create task “${a.title}”`;
    case 'update_task': return `Update task “${a.task}”`;
    case 'delete_task': return `Delete task “${a.task}”`;
    case 'set_status': return `Set status → “${a.status}”`;
    case 'set_priority': return `Set priority → ${a.priority}`;
    case 'set_assignee': return `Assign → ${a.assignee}`;
    case 'set_due': return `Set due date → ${a.dueDate}`;
    case 'create_status': return `Create status “${a.name}”`;
    case 'rename_status': return `Rename status → “${a.name}”`;
    case 'delete_status': return `Delete status “${a.status}”`;
    default: return a.type;
  }
}

export function AiAssistant({ onNavigate }: { onNavigate?: () => void }) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const messages = useAppSelector(selectAiMessages);
  const busy = useAppSelector(selectAiBusy);
  const pending = useAppSelector(selectAiPending);
  const { data: users } = useGetUsersQuery();
  const [sendCommand] = useSendAiCommandMutation();
  const { runPlan } = useAiExecutor();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const mic = useVoiceInput({
    // Words stream into the box live as you speak…
    onInterim: setDraft,
    // …then Whisper's accurate transcript runs, exactly like typing + sending.
    onFinal: (text) => {
      setDraft('');
      void submit(text);
    },
    onError: (message) => dispatch(addMessage({ role: 'assistant', text: message, tone: 'error' })),
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending, busy]);

  function buildContext() {
    const s = store.getState() as RootState;
    const projects = s.hierarchy.lists.filter((l) => !l.archived).map((l) => l.name);
    const statuses = Array.from(
      new Set(Object.values(s.statuses.sets).flatMap((set) => set.statuses.map((st) => st.name)))
    );
    return {
      today: todayIso(),
      projects,
      users: (users ?? []).map((u) => ({ name: u.name, email: u.email })),
      statuses,
    };
  }

  async function execute(plan: AiPlan) {
    try {
      const summary = await runPlan(plan);
      if (summary) dispatch(addMessage({ role: 'assistant', text: summary }));
      for (const a of plan.actions) dispatch(recordAction({ summary: describeAction(a), status: 'done' }));
    } catch (err) {
      dispatch(addMessage({ role: 'assistant', text: `Something went wrong: ${(err as Error)?.message ?? 'error'}`, tone: 'error' }));
    }
  }

  async function submit(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft('');
    dispatch(addMessage({ role: 'user', text: message }));
    dispatch(setBusy(true));
    try {
      const plan = await sendCommand({ message, context: buildContext() }).unwrap();
      if (plan.reply) dispatch(addMessage({ role: 'assistant', text: plan.reply }));
      if (plan.actions.length && plan.needsConfirmation) {
        dispatch(setPending({ prompt: plan.confirmationPrompt || 'Confirm this action?', plan }));
      } else if (plan.actions.length) {
        await execute(plan);
      }
    } catch (err) {
      dispatch(addMessage({ role: 'assistant', text: `I couldn't reach the assistant: ${(err as { message?: string })?.message ?? 'error'}`, tone: 'error' }));
    } finally {
      dispatch(setBusy(false));
    }
  }

  async function confirmPending() {
    if (!pending) return;
    const plan = pending.plan;
    dispatch(setPending(null));
    dispatch(setBusy(true));
    await execute(plan);
    dispatch(setBusy(false));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex gap-3 animate-fade-in', m.role === 'user' && 'flex-row-reverse')}>
            {m.role === 'assistant' && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-primary-fg shadow-glow" style={{ background: 'var(--gradient-brand)' }}>
                <Sparkles className="h-4 w-4" />
              </span>
            )}
            <div
              className={cn(
                'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-primary text-primary-fg'
                  : m.tone === 'error'
                    ? 'border border-danger/30 bg-danger-soft text-danger-fg'
                    : 'border border-border bg-surface-muted text-text'
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 pl-11 text-sm text-text-subtle">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Thinking…
          </div>
        )}

        {/* Confirmation card */}
        {pending && (
          <div className="ml-11 rounded-xl border border-warning/40 bg-warning-soft/60 p-3.5 animate-scale-in">
            <div className="flex items-center gap-2 text-sm font-medium text-warning-fg">
              <AlertTriangle className="h-4 w-4" /> Confirmation needed
            </div>
            <p className="mt-1 text-sm text-text">{pending.prompt}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmPending}
                className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
              >
                <Check className="h-4 w-4" /> Confirm
              </button>
              <button
                type="button"
                onClick={() => dispatch(setPending(null))}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-glass-border"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Suggestions when fresh */}
        {messages.length <= 1 && !pending && (
          <div className="ml-11 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-primary hover:text-text"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-3 sm:px-6">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-primary">
          {mic.supported && (
            <button
              type="button"
              onClick={() => (mic.listening ? mic.stop() : mic.start())}
              disabled={mic.transcribing}
              aria-label={mic.listening ? 'Stop and run' : 'Speak your request'}
              title={mic.listening ? 'Listening… click to run' : 'Speak your request'}
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
                mic.listening
                  ? 'animate-pulse bg-danger text-primary-fg'
                  : 'text-text-subtle hover:bg-glass-border hover:text-text'
              )}
            >
              {mic.transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit(draft);
              }
            }}
            placeholder={
              mic.transcribing ? 'Transcribing…' : mic.listening ? 'Listening…' : 'Ask me to create, move, assign, or find anything…'
            }
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
          />
          <button
            type="button"
            onClick={() => void submit(draft)}
            disabled={!draft.trim() || busy}
            aria-label="Send"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-brand text-primary-fg shadow-glow transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 px-1 text-[11px] text-text-subtle">
          The assistant runs real actions across your whole workspace. {onNavigate ? '' : 'Destructive actions ask first.'}
        </p>
      </div>
    </div>
  );
}
