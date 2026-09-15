import type { ReactNode } from 'react';
import { cn } from './cn';

// owner: web-design-system — §5.2 Badge/StatusBadge, §3.1 duty-status palette,
// severity mapping from web-design-tokens skill.

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  violet: 'bg-violet-soft text-violet',
  neutral: 'bg-neutral-soft text-text-secondary',
};

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  outline?: boolean;
  children: ReactNode;
  className?: string;
}

/** Pill, 22px tall, §5.2. */
export function Badge({ tone = 'neutral', dot = false, outline = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-badge font-medium',
        outline ? 'border border-border bg-transparent text-text-secondary' : TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            'size-1.5 rounded-full',
            tone === 'success' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'danger' && 'bg-danger',
            tone === 'info' && 'bg-info',
            tone === 'violet' && 'bg-violet',
            tone === 'neutral' && 'bg-neutral',
          )}
        />
      )}
      {children}
    </span>
  );
}

export type DutyStatus =
  | 'DRIVING'
  | 'ON_DUTY'
  | 'SLEEPER'
  | 'OFF_DUTY'
  | 'YARD_MOVE'
  | 'PERSONAL_CONVEYANCE'
  | 'ELD_OFFLINE'
  | 'IDLE'
  | 'INACTIVE';

const DUTY_LABEL: Record<DutyStatus, string> = {
  DRIVING: 'Driving',
  ON_DUTY: 'On-duty (not driving)',
  SLEEPER: 'Sleeper',
  OFF_DUTY: 'Off-duty',
  YARD_MOVE: 'Yard move',
  PERSONAL_CONVEYANCE: 'Personal conveyance',
  ELD_OFFLINE: 'ELD offline',
  IDLE: 'Idle',
  INACTIVE: 'Inactive',
};

const DUTY_TONE: Record<DutyStatus, BadgeTone> = {
  DRIVING: 'success',
  ON_DUTY: 'danger',
  SLEEPER: 'violet',
  OFF_DUTY: 'neutral',
  YARD_MOVE: 'danger',
  PERSONAL_CONVEYANCE: 'neutral',
  ELD_OFFLINE: 'danger',
  IDLE: 'warning',
  INACTIVE: 'neutral',
};

/** Identical wherever a duty status appears — grid line, table badge, donut (web/tz.md §3.1). */
export function DutyBadge({ status, className }: { status: DutyStatus; className?: string }) {
  return (
    <Badge tone={DUTY_TONE[status]} dot className={className}>
      {DUTY_LABEL[status]}
    </Badge>
  );
}

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'VIOLATION' | 'WARNING' | 'INFO';

const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: 'Critical',
  MAJOR: 'Major',
  MINOR: 'Minor',
  VIOLATION: 'Violation',
  WARNING: 'Warning',
  INFO: 'Info',
};

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  CRITICAL: 'danger',
  MAJOR: 'warning',
  MINOR: 'neutral',
  VIOLATION: 'danger',
  WARNING: 'warning',
  INFO: 'info',
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} className={className}>
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

/** Generic status badge for non-duty, non-severity states (`Active`, `Out of service`, …). */
export function StatusBadge({ label, tone, dot = false }: { label: string; tone: BadgeTone; dot?: boolean }) {
  return (
    <Badge tone={tone} dot={dot}>
      {label}
    </Badge>
  );
}
