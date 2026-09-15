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
  sm: 'h-btn-sm px-3 text-body',
  md: 'h-btn px-4 text-body',
  lg: 'h-btn-lg px-5 text-body',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Square icon-only button, 36×36 per §5.1. */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    iconOnly = false,
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
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant !== 'link' && SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        iconOnly && variant !== 'link' && 'w-btn px-0',
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
