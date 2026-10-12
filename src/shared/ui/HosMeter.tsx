import { ProgressBar, hosTone } from './ProgressBar';
import { cn } from './cn';
import { HOS_ZERO_NOTE } from '../format/hos';

// owner: web-design-system — §5.8. Drivers table and the Available hours card.

function formatHm(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface HosMeterProps {
  label: string;
  remainingSec: number;
  limitSec: number;
  /** e.g. `of 14:00`, `of 70:00`, `of 08:00 driving` (§5.8). */
  ofHint?: string;
  /**
   * What a clock at 00:00 means. A clock that has run out is not always a violation: a driver who
   * is on duty past the 14-hour window, not driving, needs a 10-hour break — nothing was exceeded.
   * Callers name the reason with `hosClockNotes()` (`shared/format/hos.ts`); the default stays
   * `limit exceeded` for callers that cannot tell.
   */
  zeroNote?: string;
  className?: string;
}

export function HosMeter({ label, remainingSec, limitSec, ofHint, zeroNote = 'limit exceeded', className }: HosMeterProps) {
  const tone = hosTone(remainingSec, limitSec);
  const exceeded = remainingSec <= 0;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caption font-medium uppercase tracking-wide text-text-muted">{label}</span>
        {ofHint && <span className="text-caption text-text-muted">{ofHint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'tabular text-body-strong',
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning',
            tone === 'danger' && 'text-danger',
          )}
        >
          {formatHm(remainingSec)}
        </span>
        {/* UI-002 — only `limit exceeded` (a driving overrun) is a violation in the danger tone; a
            clock run out off the wheel ("cycle exhausted", "10-hour break required") is a warning. */}
        {exceeded && (
          <span className={cn('text-caption', zeroNote === HOS_ZERO_NOTE.exceeded ? 'text-danger' : 'text-warning')}>{zeroNote}</span>
        )}
      </div>
      <ProgressBar ratio={limitSec > 0 ? remainingSec / limitSec : 0} tone={tone} label={label} />
    </div>
  );
}
