import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SECONDS = 300;
const MAX_VOICE_MS = MAX_VOICE_SECONDS * 1000;

export type VoiceCaptureStatus = 'idle' | 'recording' | 'done';

function pickVoiceMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((m) => MediaRecorder.isTypeSupported?.(m));
}

export function useVoiceCapture() {
  const [status, setStatus] = useState<VoiceCaptureStatus>('idle');
  const [seconds, setSeconds] = useState(0);

  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const teardown = useCallback(() => {
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    tickRef.current = null;
    timeoutRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const stopNow = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.stop();
  }, []);

  const start = useCallback((): Promise<Blob | null> => {
    return (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = pickVoiceMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const resolve = resolveRef.current;
          resolveRef.current = null;
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setSeconds(0);
          setStatus('done');
          teardown();
          if (resolve) resolve(blob);
        };
        recorder.start();
        recorderRef.current = recorder;
        streamRef.current = stream;
        startedAtRef.current = Date.now();
        setSeconds(0);
        setStatus('recording');
        tickRef.current = window.setInterval(() => {
          setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }, 1000);
        timeoutRef.current = window.setTimeout(() => stopNow(), MAX_VOICE_MS);
        return new Promise<Blob | null>((resolve) => {
          resolveRef.current = resolve;
        });
      } catch {
        setStatus('idle');
        return null;
      }
    })();
  }, [stopNow, teardown]);

  const cancel = useCallback(() => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    teardown();
    if (resolve) resolve(null);
    setSeconds(0);
    setStatus('idle');
  }, [teardown]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { status, seconds, start, stopNow, cancel };
}
