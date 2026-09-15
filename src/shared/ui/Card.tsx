import type { ReactNode } from 'react';
import { cn } from './cn';

// owner: web-design-system — §5.4.

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  /** Table cards pad the header only and let the table run edge-to-edge. */
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-bg-surface shadow-card',
        padded && 'p-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div>
        <h2 className="text-card-title font-semibold text-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-card-sub text-text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
