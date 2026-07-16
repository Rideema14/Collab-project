'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { aiApi } from '@/lib/api/endpoints';

/**
 * Whisper-backed voice input for the assistant. Records mic audio with
 * MediaRecorder, then sends it to the Groq Whisper endpoint for transcription and
 * hands the text back. No preview/recording UI beyond the mic's own listening
 * state — you speak, it transcribes, the caller runs it like a typed command.
 */
export function useWhisperMic(options: {
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof MediaRecorder !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
    return () => {
      recRef.current?.state === 'recording' && recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = useCallback((cancel = false) => {
    cancelledRef.current = cancel;
    if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        setListening(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recRef.current = null;
        if (cancelledRef.current) return;

        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const { text } = await aiApi.transcribe(blob);
          if (text && text.trim()) optsRef.current.onFinal(text.trim());
          else optsRef.current.onError?.("Didn't catch that. Please try again.");
        } catch (err) {
          optsRef.current.onError?.((err as { message?: string })?.message ?? 'Transcription failed.');
        } finally {
          setTranscribing(false);
        }
      };

      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      optsRef.current.onError?.('Microphone access was blocked.');
    }
  }, []);

  return { supported, listening, transcribing, start, stop };
}
