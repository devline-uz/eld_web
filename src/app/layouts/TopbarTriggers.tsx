// The two topbar trigger buttons, kept in the eager shell. The overlays they open (11.26 Account
// menu, 11.27 Notifications) are lazy chunks: until a chunk arrives, the Topbar renders the same
// button as the Suspense fallback, so the bar never shifts and a click is never lost (WD-059).
import { Bell, ChevronDown } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Avatar } from '@/shared/ui/Avatar';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const BellButton = forwardRef<HTMLButtonElement, ButtonProps & { unread: number }>(function BellButton(
  { unread, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative flex size-btn items-center justify-center rounded-md border border-border text-text-secondary hover:bg-bg-subtle"
      {...rest}
    >
      <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          data-testid="bell-unread-dot"
          className="absolute right-2 top-2 size-2 rounded-full border border-bg-surface bg-danger"
        />
      ) : null}
    </button>
  );
});

export const AccountTriggerButton = forwardRef<HTMLButtonElement, ButtonProps & { name: string; avatarUrl: string | null }>(
  function AccountTriggerButton({ name, avatarUrl, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-md p-1 hover:bg-bg-subtle"
        {...rest}
      >
        <span aria-hidden="true">
          <Avatar name={name} src={avatarUrl ?? undefined} size="md" />
        </span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className="text-text-muted" />
      </button>
    );
  },
);
