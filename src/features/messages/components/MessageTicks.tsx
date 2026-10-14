// owner: web-dispatch-messaging — outgoing (staff) message status ticks (backend D-146).
// Telegram-style: not yet read (sent or `deliveredAt`) = one grey tick, read (`readAt`) = two brand ticks.
// The tooltip still distinguishes Sent vs Delivered.
// Shown only under the staff side's own, already-sent messages.
import { Check, CheckCheck } from 'lucide-react';
import { formatLocalDateTime } from '@/shared/format/datetime';
import type { MessageRow } from '@/shared/api/messaging';

type TickState = 'sent' | 'delivered' | 'read';

function tickState(message: Pick<MessageRow, 'deliveredAt' | 'readAt'>): TickState {
  return message.readAt ? 'read' : message.deliveredAt ? 'delivered' : 'sent';
}

export function MessageTicks({ message }: { message: Pick<MessageRow, 'deliveredAt' | 'readAt'> }) {
  const state = tickState(message);
  const label =
    state === 'read'
      ? `Read ${formatLocalDateTime(message.readAt)}`
      : state === 'delivered'
        ? `Delivered ${formatLocalDateTime(message.deliveredAt)}`
        : 'Sent';
  const Icon = state === 'read' ? CheckCheck : Check;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-tick={state}
      className={`inline-flex ${state === 'read' ? 'text-primary' : 'text-text-muted'}`}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
