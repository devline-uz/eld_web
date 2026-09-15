import { cn } from './cn';

// owner: web-design-system — track is always `--bg-subtle` (§3.5).

export type ProgressTone = 'success' | 'warning' | 'danger';

const FILL_CLASSES: Record<ProgressTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function ProgressBar({
  ratio,
  tone,
  thick = false,
  className,
  label,
}: {
  /** 0..1, clamped. */
  ratio: number;
  tone: ProgressTone;
  /** HOS meter is 4px, maintenance bar is 6px. */
  thick?: boolean;
  className?: string;
  /** Accessible name for the progressbar, e.g. "Remaining drive time". */
  label?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${pct}%`}
      className={cn('w-full overflow-hidden rounded-full bg-bg-subtle', thick ? 'h-1.5' : 'h-1', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', FILL_CLASSES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** §3.5 — HOS meter thresholds: >25% success · 10–25% warning · <10% or 0 danger. */
export function hosTone(remainingSec: number, limitSec: number): ProgressTone {
  if (limitSec <= 0) return 'danger';
  const ratio = remainingSec / limitSec;
  if (remainingSec <= 0) return 'danger';
  if (ratio > 0.25) return 'success';
  if (ratio >= 0.1) return 'warning';
  return 'danger';
}

/** §3.5 — maintenance due thresholds: >30d/>3000mi success · near warning · overdue danger. */
export function maintenanceTone(remaining: number, kind: 'days' | 'miles'): ProgressTone {
  const nearThreshold = kind === 'days' ? 7 : 500;
  const okThreshold = kind === 'days' ? 30 : 3000;
  if (remaining <= 0) return 'danger';
  if (remaining > okThreshold) return 'success';
  if (remaining > nearThreshold) return 'warning';
  return 'warning';
}
