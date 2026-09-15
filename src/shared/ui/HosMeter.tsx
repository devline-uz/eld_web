import { ProgressBar, hosTone } from './ProgressBar';
import { cn } from './cn';

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
  className?: string;
}

export function HosMeter({ label, remainingSec, limitSec, ofHint, className }: HosMeterProps) {
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
        {exceeded && <span className="text-caption text-danger">limit exceeded</span>}
      </div>
      <ProgressBar ratio={limitSec > 0 ? remainingSec / limitSec : 0} tone={tone} label={label} />
    </div>
  );
}
