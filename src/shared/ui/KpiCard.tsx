import type { ComponentType } from 'react';
import { Card } from './Card';
import { Badge, type BadgeTone } from './Badge';
import { cn } from './cn';

// owner: web-design-system — §5.3. Identical everywhere a KPI row appears.

export interface KpiChip {
  text: string;
  tone: BadgeTone;
}

export interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  chip?: KpiChip;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  iconTone?: BadgeTone;
}

const ICON_BG: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  violet: 'bg-violet-soft text-violet',
  neutral: 'bg-neutral-soft text-text-secondary',
};

export function KpiCard({ label, value, hint, chip, icon: Icon, iconTone = 'info' }: KpiCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="text-kpi-label font-medium text-text-secondary">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-md', ICON_BG[iconTone])}>
          <Icon size={20} strokeWidth={1.75} />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tabular text-kpi font-semibold text-text">{value}</span>
        {chip && (
          <Badge tone={chip.tone} className="ml-1">
            {chip.text}
          </Badge>
        )}
        {hint && !chip && <span className="text-body text-text-muted">{hint}</span>}
      </div>
    </Card>
  );
}

/** Always 4 skeleton cards while the KPI row loads (§13.1). */
export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-card-gap">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i}>
          <div className="h-kpi-skeleton animate-pulse rounded-md bg-bg-subtle" />
        </Card>
      ))}
    </div>
  );
}
