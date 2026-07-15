'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Keyboard, Mic, Square } from 'lucide-react';
import { useParseVoiceMutation, useGetUsersQuery } from '@/store/api/backendApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setVoiceCaptureOpen } from '@/store/slices/uiSlice';
import { selectListById } from '@/store/selectors';
import { useListActions } from '@/features/list/useListActions';
import { spring } from '@/lib/design/motion';
import type { VoiceParseResult } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';

/*
 * VOICE TASK CAPTURE (new shell) — parse, then confirm.
 *
 * Ported from the old board modal. Two-step by design: POST /voice/parse only
 * PREVIEWS the command (it writes nothing), we show an editable draft, and the
 * confirmed draft is created through the SAME `createTask` the manual composer
 * uses — voice is a second way to fill one form, never a parallel write path.
 *
 * Scoped to the active list: opened from the list header mic button and the ⌘K
 * "New task by voice" action, both of which set `ui.voiceCaptureOpen`.
 */

type Phase =
  | { name: 'idle' }
  | { name: 'recording' }
  | { name: 'parsing' }
  | { name: 'draft'; result: VoiceParseResult }
  | { name: 'error'; message: string }
  /** Server has no GROQ_API_KEY — its own 503 copy is the clearest thing to show. */
  | { name: 'unavailable'; message: string };

interface Draft {
  title: string;
  assigneeId: string;
  dueDate: string;
}

export function VoiceCaptureModal({ listId }: { listId: string }) {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.voiceCaptureOpen);
  const list = useAppSelector(selectListById(listId));
  const { data: members = [] } = useGetUsersQuery();
  const { createTask, projectId } = useListActions(listId);
  const [parseVoice] = useParseVoiceMutation();

  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [draft, setDraft] = useState<Draft>({ title: '', assigneeId: '', dueDate: '' });
  const [transcriptText, setTranscriptText] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /** Always release the microphone — a live mic indicator after closing is alarming. */
  const stopStream = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
  }, []);

  const close = useCallback(() => {
    stopStream();
    dispatch(setVoiceCaptureOpen(false));
  }, [dispatch, stopStream]);

  // Reset to a clean slate whenever the modal opens, and free the mic on unmount.
  useEffect(() => {
    if (open) {
      setPhase({ name: 'idle' });
      setTranscriptText('');
      setTitleError(undefined);
      setSaving(false);
    }
    return stopStream;
  }, [open, stopStream]);

  const parse = useCallback(
    async (input: { audio: Blob } | { transcript: string }) => {
      if (projectId == null) return;
      setPhase({ name: 'parsing' });
      try {
        const result = await parseVoice({ projectId, input }).unwrap();
        setDraft({
          title: result.parsed.title,
          assigneeId: result.parsed.assignee ? String(result.parsed.assignee.id) : '',
          dueDate: result.parsed.dueDate ?? '',
        });
        setPhase({ name: 'draft', result });
      } catch (err) {
        const e = err as { status?: number; message?: string };
        if (e?.status === 503) {
          setPhase({ name: 'unavailable', message: e.message ?? 'Voice capture is not configured on the server.' });
          return;
        }
        setPhase({
          name: 'error',
          message: e?.message ?? 'Could not process that. Please try again or type the command.',
        });
      }
    },
    [projectId, parseVoice]
  );

  async function startRecording() {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase({ name: 'error', message: 'This browser cannot record audio. Type the command instead.' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stopStream();
        void parse({ audio });
      };
      recorderRef.current = recorder;
      recorder.start();
      setPhase({ name: 'recording' });
    } catch {
      // Almost always a denied permission prompt.
      setPhase({
        name: 'error',
        message: 'Microphone access was blocked. Allow it in your browser, or type the command instead.',
      });
    }
  }

  function stopRecording() {
    recorderRef.current?.stop(); // onstop kicks off the parse.
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      setTitleError('Task title is required.');
      return;
    }
    setTitleError(undefined);
    setSaving(true);
    try {
      await createTask({
        title,
        assigneeId: draft.assigneeId ? Number(draft.assigneeId) : null,
        dueDate: draft.dueDate || null,
      });
      close();
    } catch (err) {
      const e = err as { message?: string };
      setPhase({ name: 'error', message: e?.message ?? 'Could not create the task.' });
    } finally {
      setSaving(false);
    }
  }

  const busy = phase.name === 'recording' || phase.name === 'parsing' || saving;

  if (!open || !list) return null;

  return (
    <Modal
      open={open}
      onClose={close}
      busy={busy}
      title="Add task by voice"
      description={
        phase.name === 'draft'
          ? 'Here’s what we heard. Correct anything before adding it.'
          : `Say something like “Assign the login bug to Priya by Friday.” — added to ${list.name}.`
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase.name}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={spring.smooth}
        >
          {phase.name === 'idle' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-gradient-surface p-6">
                <Button size="lg" onClick={startRecording}>
                  <Mic className="h-4 w-4" /> Start recording
                </Button>
                <p className="text-xs text-text-subtle">Nothing is saved until you confirm.</p>
              </div>
              <TypedFallback
                value={transcriptText}
                onChange={setTranscriptText}
                onSubmit={() => void parse({ transcript: transcriptText.trim() })}
              />
            </div>
          )}

          {phase.name === 'recording' && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-danger/60 bg-danger-soft p-6">
              <span className="flex items-center gap-2 text-sm font-medium text-danger-fg">
                <motion.span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full bg-danger"
                  animate={{ opacity: [1, 0.3, 1], scale: [1, 1.25, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                />
                Recording…
              </span>
              <Button variant="danger" size="lg" onClick={stopRecording}>
                <Square className="h-4 w-4" /> Stop and process
              </Button>
            </div>
          )}

          {phase.name === 'parsing' && (
            <div className="flex flex-col items-center gap-3 p-8">
              <Spinner size="lg" label="Processing your command" className="text-primary" />
              <p className="text-sm text-text-muted">Transcribing and reading the command…</p>
            </div>
          )}

          {phase.name === 'unavailable' && (
            <div className="flex flex-col gap-4">
              <div role="alert" className="rounded-md border border-warning/60 bg-warning-soft px-3 py-2 text-sm text-warning-fg">
                {phase.message}
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={close}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {phase.name === 'error' && (
            <div className="flex flex-col gap-4">
              <div role="alert" className="rounded-md border border-danger/60 bg-danger-soft px-3 py-2 text-sm text-danger-fg">
                {phase.message}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
                <Button onClick={() => setPhase({ name: 'idle' })}>Try again</Button>
              </div>
            </div>
          )}

          {phase.name === 'draft' && (
            <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
              <blockquote className="rounded-md border-l-2 border-primary bg-primary-soft px-3 py-2 text-sm italic text-text">
                “{phase.result.transcript}”
              </blockquote>

              {phase.result.warnings.length > 0 && (
                <ul
                  role="alert"
                  className="flex flex-col gap-1 rounded-md border border-warning/60 bg-warning-soft px-3 py-2 text-sm text-warning-fg"
                >
                  {phase.result.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text">Task title</span>
                <Textarea
                  rows={2}
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  disabled={saving}
                  placeholder="What needs to be done?"
                />
                {titleError && <span className="text-xs text-danger-fg">{titleError}</span>}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-text">Assignee</span>
                  <select
                    value={draft.assigneeId}
                    onChange={(e) => setDraft((d) => ({ ...d, assigneeId: e.target.value }))}
                    disabled={saving}
                    className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text transition-colors hover:border-border-strong focus:border-primary"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-text">Due date</span>
                  <Input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                    disabled={saving}
                  />
                </label>
              </div>

              <div className="mt-1 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setPhase({ name: 'idle' })} disabled={saving}>
                  Discard
                </Button>
                <Button type="submit" loading={saving}>
                  {saving ? 'Adding…' : 'Add task'}
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

/**
 * The /voice/parse endpoint also accepts a plain `transcript` text field, so the
 * whole feature works without a microphone — on a locked-down browser, a denied
 * permission, or for anyone who simply can't use voice input.
 */
function TypedFallback({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-text">
          <Keyboard className="h-4 w-4 text-text-subtle" /> Or type the command
        </span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Assign the login bug to Priya by Friday"
        />
        <span className="text-xs text-text-subtle">Same parser, no microphone needed.</span>
      </label>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onSubmit} disabled={!value.trim()}>
          Read command
        </Button>
      </div>
    </div>
  );
}
