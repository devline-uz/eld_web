// owner: web-dispatch-messaging — W-16 voice messages: microphone capture via MediaRecorder.
import { useCallback, useEffect, useRef, useState } from 'react';

/** Server cap is 5 minutes (`POST /conversations/:id/messages/audio`); recording stops itself there. */
export const VOICE_MESSAGE_MAX_MS = 5 * 60 * 1000;

/** Preferred container first: Opus/WebM (Chrome, Edge, Firefox), then MP4/AAC (Safari). */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded';

export interface RecordedClip {
  blob: Blob;
  /** `blob:` URL for the local preview; revoked by `discard` / unmount, or handed off on send. */
  url: string;
  durationMs: number;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** A human reason for a failed `getUserMedia` / `MediaRecorder` start. */
function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access is blocked. Allow the microphone for this site in your browser settings to record a voice message.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError') return 'The microphone is in use by another application.';
  return 'Could not start recording.';
}

export function isVoiceRecordingSupported(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Records one voice clip. `start` asks for the microphone (the browser prompt), `stop` ends the
 * recording into a previewable `clip`, `discard` throws everything away. The microphone is
 * released as soon as recording stops, and on unmount.
 */
export function useVoiceRecorder(onError: (message: string) => void) {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [clip, setClip] = useState<RecordedClip | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  /** Set by `discard` while recording: the `stop` event must then drop the chunks. */
  const discardRef = useRef(false);
  const clipRef = useRef<RecordedClip | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const releaseMicrophone = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (status === 'requesting' || status === 'recording') return;
    if (!isVoiceRecordingSupported()) {
      onErrorRef.current('Voice messages are not supported in this browser.');
      return;
    }
    setStatus('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setStatus('idle');
      onErrorRef.current(microphoneErrorMessage(error));
      return;
    }
    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      setStatus('idle');
      onErrorRef.current(microphoneErrorMessage(error));
      return;
    }
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(performance.now() - startedAtRef.current, VOICE_MESSAGE_MAX_MS);
      releaseMicrophone();
      recorderRef.current = null;
      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (discardRef.current || chunks.length === 0) {
        setStatus('idle');
        setElapsedMs(0);
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' });
      const next = { blob, url: URL.createObjectURL(blob), durationMs };
      clipRef.current = next;
      setClip(next);
      setElapsedMs(durationMs);
      setStatus('recorded');
    };
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    recorder.start(250);
    setStatus('recording');
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= VOICE_MESSAGE_MAX_MS) stop();
    }, 200);
  }, [status, releaseMicrophone, stop]);

  /** Cancels a recording in progress or drops the recorded preview. */
  const discard = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      discardRef.current = true;
      recorder.stop();
    } else {
      releaseMicrophone();
      setStatus('idle');
    }
    if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
    clipRef.current = null;
    setClip(null);
    setElapsedMs(0);
  }, [releaseMicrophone]);

  /** Hands the recorded clip to the caller (who now owns its `blob:` URL) and resets to idle. */
  const take = useCallback((): RecordedClip | null => {
    const taken = clipRef.current;
    clipRef.current = null;
    setClip(null);
    setElapsedMs(0);
    setStatus('idle');
    return taken;
  }, []);

  useEffect(
    () => () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      releaseMicrophone();
      if (clipRef.current) URL.revokeObjectURL(clipRef.current.url);
    },
    [releaseMicrophone],
  );

  return { status, elapsedMs, clip, start, stop, discard, take };
}
