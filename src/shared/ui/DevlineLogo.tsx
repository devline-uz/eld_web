// "Powered by Devline" vendor signature, drawn from the brand screenshot (photos/…18.10.41.png):
// an uppercase muted "POWERED BY", a thin vertical rule, then the Devline wordmark whose "D" is a
// solid rounded tile with a chevron cut out of it. Drawn inline (no raster) so it follows
// `currentColor` and the tokens.
import { cn } from './cn';

const LABEL = 'Powered by Devline';

/** The "D" tile: rounded-left block with a round right side and a `>` chevron punched through. */
function DevlineMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M3 3H12A9 9 0 0 1 12 21H3A2 2 0 0 1 1 19V5A2 2 0 0 1 3 3ZM6.5 7.5H9.25L13.75 12L9.25 16.5H6.5L11 12Z"
      />
    </svg>
  );
}

export interface DevlineLogoProps {
  /** `mark` renders the "D" tile alone — for tight spots such as the 64px collapsed sidebar. */
  variant?: 'full' | 'mark';
  className?: string;
}

export function DevlineLogo({ variant = 'full', className }: DevlineLogoProps) {
  if (variant === 'mark') {
    return (
      <span role="img" aria-label={LABEL} title={LABEL} className={cn('inline-flex text-text', className)}>
        <DevlineMark size={16} />
      </span>
    );
  }
  return (
    <span role="img" aria-label={LABEL} className={cn('inline-flex items-center gap-2', className)}>
      <span className="text-nav-section uppercase text-text-muted">Powered by</span>
      <span className="h-3 w-px shrink-0 bg-border-strong" />
      <span className="inline-flex items-center text-text">
        <DevlineMark size={14} />
        <span className="text-label font-semibold leading-none tracking-tight">evline</span>
      </span>
    </span>
  );
}
