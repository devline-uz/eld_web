// 11.27 — the bell's Radix Popover (360px) around the Notifications panel. Lazy chunk together
// with `features/notifications/NotificationsPanel` (WD-059).
import * as Popover from '@radix-ui/react-popover';
import NotificationsPanel from '@/features/notifications/NotificationsPanel';
import { BellButton } from './TopbarTriggers';

export interface NotificationsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unread: number;
  isPathAllowed: (path: string) => boolean;
}

export default function NotificationsPopover({ open, onOpenChange, unread, isPathAllowed }: NotificationsPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <BellButton unread={unread} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label="Notifications"
          className="z-50 w-notifications-panel overflow-hidden rounded-lg border border-border bg-bg-surface shadow-pop"
        >
          <NotificationsPanel onClose={() => onOpenChange(false)} isPathAllowed={isPathAllowed} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
