'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { tasksApi, voiceApi } from '@/lib/api/endpoints';
import type { Task, User, VoiceParseResult } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { TaskDraft, TaskFields, draftToPayload } from './TaskFields';

/*
 * VOICE TASK CAPTURE — parse, then confirm.
 *
 * Two-step by design. POST /voice would parse AND create in one shot, but a
 * speech model can mishear a name or a date, and a task that silently lands on
 * the board wrong is worse than one the user got to correct. So we call
 * /voice/parse (which writes nothing), show the draft, and let the user fix it.
 *
 * The confirmed draft is then created through tasksApi.create — the exact same
 * call the manual form makes. There is no second write path.
 */

type Phase =
  | { name: 'idle' }
  | { name: 'recording' }
  | { name: 'parsing' }
  | { name: 'draft'; result: VoiceParseResult }
  | { name: 'error'; message: string }
  /** The server has no GROQ_API_KEY. Its own 503 message is the clearest thing to show. */
  | { name: 'unavailable'; message: string };

export function VoiceTaskModal({
  open,
  onClose,
  projectId,
  members,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: number;
  members: User[];
  onCreated: (task: Task) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [draft, setDraft] = useState<TaskDraft>({ title: '', assigneeId: '', dueDate: '' });
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

  useEffect(() => {
    if (open) {
      setPhase({ name: 'idle' });
      setTranscriptText('');
      setTitleError(undefined);
    }
    return stopStream;
  }, [open, stopStream]);

  const parse = useCallback(
    async (input: { audio: Blob } | { transcript: string }) => {
      setPhase({ name: 'parsing' });
      try {
        const result = await voiceApi.parse(projectId, input);
        setDraft({
          title: result.parsed.title,
          assigneeId: result.parsed.assignee ? String(result.parsed.assignee.id) : '',
          dueDate: result.parsed.dueDate ?? '',
        });
        setPhase({ name: 'draft', result });
      } catch (error) {
        if (error instanceof ApiError && error.isVoiceUnavailable) {
          // Not a failure the user caused, and not one they can fix — say so plainly.
          setPhase({ name: 'unavailable', message: error.message });
          return;
        }
        setPhase({
          name: 'error',
          message:
            error instanceof ApiError
              ? error.message
              : 'Could not process that. Please try again or use the manual form.',
        });
      }
    },
    [projectId]
  );

  async function startRecording() {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase({
        name: 'error',
        message: 'This browser cannot record audio. Type the command instead.',
      });
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
        message:
          'Microphone access was blocked. Allow it in your browser, or type the command instead.',
      });
    }
  }

  function stopRecording() {
    recorderRef.current?.stop(); // onstop above kicks off the parse.
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    const payload = draftToPayload(draft);
    if (!payload.title) {
      setTitleError('Task title is required.');
      return;
    }
    setTitleError(undefined);

    setSaving(true);
    try {
      const task = await tasksApi.create(projectId, payload);
      onCreated(task);
    } catch (error) {
      setPhase({
        name: 'error',
        message: error instanceof ApiError ? error.message : 'Could not create the task.',
      });
    } finally {
      setSaving(false);
    }
  }

  const busy = phase.name === 'recording' || phase.name === 'parsing' || saving;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="Add task by voice"
      description={
        phase.name === 'draft'
          ? 'Here’s what we heard. Correct anything before adding it.'
          : 'Say something like “Assign the login bug to Priya by Friday.”'
      }
    >
      {phase.name === 'idle' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong p-6">
            <Button size="lg" onClick={startRecording}>
              <span aria-hidden="true">🎤</span> Start recording
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
        <div className="flex flex-col items-center gap-4 rounded-lg border border-danger bg-danger-soft p-6">
          <span className="flex items-center gap-2 text-sm font-medium text-danger-fg">
            <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
            Recording…
          </span>
          <Button variant="danger" size="lg" onClick={stopRecording}>
            Stop and process
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
          {/* The backend's own 503 copy already explains this well — don't paraphrase it. */}
          <div
            role="alert"
            className="rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm text-warning-fg"
          >
            {phase.message}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {phase.name === 'error' && (
        <div className="flex flex-col gap-4">
          <div
            role="alert"
            className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-fg"
          >
            {phase.message}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
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

          {/*
            Warnings are the honest part of this feature: the backend tells us
            when it heard a name but couldn't match it to a real team member, or
            couldn't resolve a date. Surfacing that is what makes the draft
            trustworthy — the user knows exactly what to fix.
          */}
          {phase.result.warnings.length > 0 && (
            <ul
              role="alert"
              className="flex flex-col gap-1 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm text-warning-fg"
            >
              {phase.result.warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <span aria-hidden="true">⚠</span>
                  {warning}
                </li>
              ))}
            </ul>
          )}

          <TaskFields
            draft={draft}
            onChange={setDraft}
            members={members}
            titleError={titleError}
            disabled={saving}
          />

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPhase({ name: 'idle' })} disabled={saving}>
              Discard
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? 'Adding…' : 'Add task'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * The same /voice/parse endpoint also accepts a plain `transcript` text field.
 * That makes the whole feature usable without a microphone — on a locked-down
 * browser, a denied permission, or by anyone who simply can't use voice input.
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
      <Field label="Or type the command" hint="Same parser, no microphone needed.">
        {({ inputId, describedBy }) => (
          <Input
            id={inputId}
            aria-describedby={describedBy}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Assign the login bug to Priya by Friday"
          />
        )}
      </Field>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onSubmit} disabled={!value.trim()}>
          Read command
        </Button>
      </div>
    </div>
  );
}
