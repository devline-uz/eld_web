import { AlertTriangle, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

// owner: web-design-system — §5.11, §12.4, §13.1. Loading is always a skeleton, never a spinner.

export function LoadingState({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={cn('flex flex-col', className)}>
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-bg-subtle" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-2.5 w-3/5 animate-pulse rounded bg-bg-subtle" />
            <div className="h-2.5 w-2/5 animate-pulse rounded bg-bg-subtle" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded bg-bg-subtle" />
        </div>
      ))}
    </div>
  );
}

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
}

export function EmptyState({ icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 py-12 text-center', className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
        {icon}
      </span>
      <h3 className="text-card-title font-semibold text-text">{title}</h3>
      {description && <p className="max-w-80 text-body text-text-muted">{description}</p>}
      {actions && actions.length > 0 && (
        <div className="mt-2 flex gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? (action === actions[actions.length - 1] ? 'primary' : 'secondary')}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
}

/** Lives inside the failing card, never replaces the whole page (§13.1). */
export function ErrorState({
  title = 'Could not load the fleet',
  description = 'The telematics service did not respond. Your data is safe — try again in a moment.',
  onRetry,
  onContactSupport,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={24} strokeWidth={1.75} />
      </span>
      <h3 className="text-card-title font-semibold text-text">{title}</h3>
      <p className="max-w-80 text-body text-text-muted">{description}</p>
      <div className="mt-2 flex gap-2">
        {onContactSupport && (
          <Button variant="secondary" onClick={onContactSupport}>
            Contact support
          </Button>
        )}
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export interface ForbiddenStateProps {
  screenName: string;
  onBack?: () => void;
}

/** Full-page lock-icon variant, §12.4. */
export function ForbiddenState({ screenName, onBack }: ForbiddenStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
        <Lock size={24} strokeWidth={1.75} />
      </span>
      <h3 className="text-card-title font-semibold text-text">You do not have access to this page</h3>
      <p className="max-w-80 text-body text-text-muted">
        Ask an administrator if you need access to {screenName}.
      </p>
      {onBack && (
        <Button variant="link" onClick={onBack}>
          ‹ Back to dashboard
        </Button>
      )}
    </div>
  );
}
