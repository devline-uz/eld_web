// owner: web-dispatch-messaging — W-16 voice messages: one clip's play/pause + seek + time.
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/shared/ui/cn';
import { formatMediaTime } from '@/shared/format/duration';
import { fetchMessageAudioUrl } from '@/shared/api/messaging';

/** Re-presign this long before the URL's `expiresAt` so playback never starts on a dying URL. */
const PRESIGN_SAFETY_MS = 30_000;

/** Render with a `key` per clip — the player keeps its playback state for the clip it mounted with. */
interface AudioMessagePlayerProps {
  /** A local `blob:` URL (recording preview / optimistic bubble). */
  src?: string;
  /** A stored clip — resolved to a presigned URL on first play (never cached, §17). */
  attachmentId?: string;
  /** The recorder's measured length: MediaRecorder WebM files carry no duration header. */
  durationMs?: number | null;
  /** `inverse` on the primary (outgoing) bubble. */
  tone?: 'default' | 'inverse';
  className?: string;
}

export function AudioMessagePlayer({ src, attachmentId, durationMs, tone = 'default', className }: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [remote, setRemote] = useState<{ url: string; expiresAt: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const pendingPlay = useRef(false);

  const url = src ?? remote?.url;
  const knownDuration = mediaDuration ?? (durationMs != null ? durationMs / 1000 : null);

  // Once the presigned URL lands, play if that is what the click asked for.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url || !pendingPlay.current) return;
    pendingPlay.current = false;
    audio.play().catch(() => setPlaying(false));
  }, [url]);

  async function ensureUrl(): Promise<boolean> {
    if (src) return true;
    if (remote && remote.expiresAt - Date.now() > PRESIGN_SAFETY_MS) return true;
    if (!attachmentId) return false;
    setLoading(true);
    try {
      const presigned = await fetchMessageAudioUrl(attachmentId);
      setRemote({ url: presigned.url, expiresAt: new Date(presigned.expiresAt).getTime() });
      setFailed(false);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    const hadFreshUrl = Boolean(src) || Boolean(remote && remote.expiresAt - Date.now() > PRESIGN_SAFETY_MS);
    if (hadFreshUrl) {
      audio.play().catch(() => setPlaying(false));
      return;
    }
    pendingPlay.current = true;
    const ok = await ensureUrl();
    if (!ok) pendingPlay.current = false;
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.currentTime = seconds;
    setPosition(seconds);
  }

  const inverse = tone === 'inverse';
  const max = knownDuration && knownDuration > 0 ? knownDuration : 0;
  const label = playing ? 'Pause voice message' : 'Play voice message';

  return (
    <div className={cn('flex w-full min-w-0 items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => void toggle()}
        // Prefetch the presigned URL on hover/touch so the click itself can start playback
        // synchronously (Safari only allows play() inside the user gesture).
        onPointerEnter={() => void (attachmentId && !src && !remote && !loading ? ensureUrl() : undefined)}
        aria-label={failed ? 'Retry voice message' : label}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
          inverse ? 'bg-bg-surface text-primary hover:bg-primary-soft' : 'bg-primary text-text-inverse hover:bg-primary-hover',
        )}
      >
        {loading ? (
          <Loader2 aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
        ) : failed ? (
          <AlertCircle aria-hidden size={16} strokeWidth={1.75} />
        ) : playing ? (
          <Pause aria-hidden size={16} strokeWidth={1.75} fill="currentColor" />
        ) : (
          <Play aria-hidden size={16} strokeWidth={1.75} fill="currentColor" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          type="range"
          min={0}
          max={max || 1}
          step={0.1}
          value={Math.min(position, max || 1)}
          disabled={!url || !max}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Voice message position"
          className={cn('h-1 w-full min-w-16 cursor-pointer disabled:cursor-default', inverse ? 'accent-white' : 'accent-primary')}
        />
        <span className={cn('text-caption tabular-nums', inverse ? 'text-white/80' : 'text-text-muted')}>
          {failed
            ? 'Could not load the voice message.'
            : playing || position > 0
              ? `${formatMediaTime(position)} / ${formatMediaTime(knownDuration)}`
              : formatMediaTime(knownDuration)}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload={src ? 'metadata' : 'none'}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setMediaDuration(d);
        }}
        onError={() => {
          if (!url) return;
          setPlaying(false);
          // A stored clip whose URL expired: drop it so the next click re-presigns.
          if (!src) setRemote(null);
          setFailed(true);
        }}
        className="hidden"
      />
    </div>
  );
}
