import { cn } from './cn';

// owner: web-design-system — §5.14.

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'size-avatar-sm text-caption',
  md: 'size-avatar text-body',
  lg: 'size-avatar-lg text-body-strong',
  xl: 'size-avatar-xl text-card-title',
};

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  inverse?: boolean;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = 'md', inverse = false, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', SIZE_CLASSES[size], className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'flex items-center justify-center rounded-full font-semibold',
        inverse ? 'bg-bg-inverse text-text-inverse' : 'bg-primary-soft text-primary',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
