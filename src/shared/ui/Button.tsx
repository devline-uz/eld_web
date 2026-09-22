import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

// owner: web-design-system — §5.1. Six variants, three sizes, `loading` keeps the label and
// swaps the leading icon for a spinner.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-text-inverse hover:bg-primary-hover active:bg-primary-active border border-transparent',
  secondary: 'bg-bg-surface text-text border border-border hover:bg-bg-subtle',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-bg-subtle',
  danger: 'bg-danger text-text-inverse hover:brightness-95 border border-transparent',
  'danger-outline': 'bg-bg-surface text-danger border border-danger hover:bg-danger-soft',
  link: 'bg-transparent text-primary border border-transparent hover:underline p-0 h-auto',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-btn-sm text-body',
  md: 'h-btn text-body',
  lg: 'h-btn-lg text-body',
};

// Kept apart from the height so icon-only buttons get no horizontal padding: `cn` is plain clsx
// (no tailwind-merge), so a trailing `px-0` would lose to `px-N` by CSS order and squeeze the icon.
const SIZE_PADDING: Record<ButtonSize, string> = {
  sm: 'px-3',
  md: 'px-4',
  lg: 'px-5',
};

/** Icon-only buttons are square: width follows the size's height. */
const ICON_ONLY_WIDTH: Record<ButtonSize, string> = {
  sm: 'w-btn-sm',
  md: 'w-btn',
  lg: 'w-btn-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Square icon-only button (36×36 at `md`, per §5.1; width follows `size`). */
  iconOnly?: boolean;
  /** Fully rounded (pill; a circle when `iconOnly`) — e.g. the Messages send button. */
  round?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    iconOnly = false,
    round = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors',
        round ? 'rounded-full' : 'rounded-md',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant !== 'link' && SIZE_CLASSES[size],
        variant !== 'link' && !iconOnly && SIZE_PADDING[size],
        VARIANT_CLASSES[variant],
        iconOnly && variant !== 'link' && [ICON_ONLY_WIDTH[size], 'shrink-0'],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={1.75} />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
});
