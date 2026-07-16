'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { aiApi } from '@/lib/api/endpoints';

/**
 * Voice input via Groq WHISPER only. We deliberately do NOT run the browser's
 * on-device recognition at the same time: two consumers on one mic starves the
 * MediaRecorder, so Whisper would receive near-silent audio and hallucinate. By
 * giving MediaRecorder exclusive, cleaned-up mic access, Whisper transcribes what
 * you actually said. Click to start, click to finish → it transcribes and runs.
 */
export function useVoiceInput(options: {
  /** Kept for API compatibility; not used (no live on-device preview). */
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const listeningRef = useRef(false);
  const cancelRef = useRef(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        typeof MediaRecorder !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
    return () => {
      try {
        if (recRef.current?.state === 'recording') recRef.current.stop();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = useCallback((cancel = false) => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    cancelRef.current = cancel;
    try {
      if (recRef.current && recRef.current.state === 'recording') recRef.current.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || listeningRef.current) return;
    try {
      cancelRef.current = false;
      // Clean, exclusive mic access — no on-device recognition competing for it.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recRef.current = null;
        if (cancelRef.current) return;

        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        // Guard against a too-short/silent clip that would make Whisper hallucinate.
        if (blob.size < 1200) {
          optsRef.current.onError?.("Didn't catch that — hold the mic and speak a moment longer.");
          return;
        }
        setTranscribing(true);
        try {
          const { text } = await aiApi.transcribe(blob);
          if (text && text.trim()) optsRef.current.onFinal(text.trim());
          else optsRef.current.onError?.("Didn't catch that — please try again.");
        } catch (err) {
          optsRef.current.onError?.((err as { message?: string })?.message ?? 'Transcription failed.');
        } finally {
          setTranscribing(false);
        }
      };

      recRef.current = rec;
      listeningRef.current = true;
      setListening(true);
      rec.start(); // gather all audio; ondataavailable fires on stop
    } catch {
      optsRef.current.onError?.('Microphone access was blocked.');
      listeningRef.current = false;
      setListening(false);
    }
  }, []);

  return { supported, listening, transcribing, start, stop };
}
