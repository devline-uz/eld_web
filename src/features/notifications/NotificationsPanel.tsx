// 11.27 Notifications panel — web/tz.md §11.27, design
// `sheets, modals, drawers, menus/Three-pane driver messaging with context panel.jpg`.
// Rendered inside the topbar's Radix Popover (360px, `--shadow-pop`); this module is the lazy
// chunk that loads on the first bell click.
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Cpu,
  Lock,
  MapPin,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/shared/api/errors';
import {
  NOTIFICATIONS_EXPANDED_SIZE,
  NOTIFICATIONS_PAGE_SIZE,
  isSingleMarkReadAvailable,
  notificationTarget,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
  type NotificationCategory,
  type NotificationItem,
  type NotificationListParams,
} from '@/shared/api/notifications';
import { formatRelativeShort } from '@/shared/format/relative';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { MARK_ONE_UNAVAILABLE_DESCRIPTION, MARK_ONE_UNAVAILABLE_TITLE } from './lib/copy';
import { claimMarkReadNotice } from './lib/markReadNotice';

export interface NotificationsPanelProps {
  onClose: () => void;
  /** Same visibility rules as the sidebar — a notification never deep-links past a guard. */
  isPathAllowed: (path: string) => boolean;
}

type Segment = 'ALL' | NotificationCategory;

const VISUALS: Array<{ match: RegExp; icon: LucideIcon; tone: string }> = [
  { match: /violation/i, icon: AlertTriangle, tone: 'bg-danger-soft text-danger' },
  { match: /eld|disconnect|offline|device/i, icon: Cpu, tone: 'bg-danger-soft text-danger' },
  { match: /break/i, icon: Clock, tone: 'bg-warning-soft text-warning' },
  { match: /maintenance|defect|work_order/i, icon: Wrench, tone: 'bg-warning-soft text-warning' },
  { match: /unassigned|unidentified/i, icon: MapPin, tone: 'bg-info-soft text-info' },
  { match: /report/i, icon: CheckCircle2, tone: 'bg-success-soft text-success' },
];

function notificationVisual(type: string): { icon: LucideIcon; tone: string } {
  return VISUALS.find((visual) => visual.match.test(type)) ?? { icon: Bell, tone: 'bg-neutral-soft text-text-secondary' };
}

function NotificationRow({ item, onOpen }: { item: NotificationItem; onOpen: (item: NotificationItem) => void }) {
  const { icon: Icon, tone } = notificationVisual(item.type);
  const unread = !item.readAt;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-bg-subtle',
        unread && 'bg-primary-soft',
      )}
    >
      <span aria-hidden="true" className={cn('flex size-avatar shrink-0 items-center justify-center rounded-full', tone)}>
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-body-strong text-text">{item.title}</span>
          {item.createdAt ? (
            <time dateTime={item.createdAt} className="shrink-0 text-caption text-text-muted tabular-nums">
              {formatRelativeShort(item.createdAt)}
            </time>
          ) : null}
        </span>
        <span className="line-clamp-2 break-words text-caption text-text-secondary">{item.body}</span>
        {unread ? <span className="sr-only">Unread</span> : null}
      </span>
    </button>
  );
}

export default function NotificationsPanel({ onClose, isPathAllowed }: NotificationsPanelProps) {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment>('ALL');
  const [expanded, setExpanded] = useState(false);

  const params: NotificationListParams = {
    limit: expanded ? NOTIFICATIONS_EXPANDED_SIZE : NOTIFICATIONS_PAGE_SIZE,
    ...(segment === 'ALL' ? {} : { category: segment }),
  };
  const list = useNotifications(params);
  const unread = useUnreadNotificationCount();
  const markAll = useMarkAllNotificationsRead();
  const { toast } = useToast();
  // WB-244 / B-56 — a failed single mark-read is never silent, but the notice is once per
  // session (non-blocking warning toast), not once per click.
  const markOne = useMarkNotificationRead({
    onFailure: () => {
      if (claimMarkReadNotice()) {
        toast({ kind: 'warning', title: MARK_ONE_UNAVAILABLE_TITLE, description: MARK_ONE_UNAVAILABLE_DESCRIPTION });
      }
    },
  });

  const items = list.data?.items ?? [];
  const counts = list.data?.counts;

  function go(to: string) {
    onClose();
    navigate(to);
  }

  function open(item: NotificationItem) {
    // The row's main job (open the linked record) never waits on mark-read. After a 404/405 the
    // session stops calling the missing B-56 route at all.
    if (!item.readAt && isSingleMarkReadAvailable()) markOne.mutate(item.id);
    const to = notificationTarget(item);
    if (to && isPathAllowed(to)) go(to);
  }

  const segments: Array<{ key: Segment; label: string; count: number }> = counts
    ? [
        { key: 'ALL', label: 'All', count: counts.all },
        { key: 'VIOLATIONS', label: 'Violations', count: counts.violations },
        { key: 'MAINTENANCE', label: 'Maintenance', count: counts.maintenance },
      ]
    : [];

  let body;
  if (list.isPending) {
    body = <LoadingState rows={4} className="px-4" />;
  } else if (list.isError) {
    body =
      list.error instanceof ApiError && list.error.status === 403 ? (
        <EmptyState
          icon={<Lock size={24} strokeWidth={1.75} aria-hidden="true" />}
          title="You do not have access to notifications"
        />
      ) : (
        <ErrorState
          title="Could not load notifications"
          description="The notification service did not respond. Try again in a moment."
          onRetry={() => void list.refetch()}
        />
      );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={<Bell size={24} strokeWidth={1.75} aria-hidden="true" />}
        title={EMPTY_STATE_COPY.notifications.title}
        description={EMPTY_STATE_COPY.notifications.description}
      />
    );
  } else {
    body = (
      <ul aria-label="Notifications list" className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow item={item} onOpen={open} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-card-title text-text">Notifications</h2>
        {unread > 0 ? (
          <span className="rounded-sm bg-primary px-2 text-badge text-text-inverse tabular-nums">{unread} new</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {unread > 0 ? (
            <Button variant="link" className="text-label" loading={markAll.isPending} onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          ) : null}
          <button
            type="button"
            aria-label="Notification preferences"
            onClick={() => go('/account#notifications')}
            className="flex size-btn-sm items-center justify-center rounded-md text-text-secondary hover:bg-bg-subtle"
          >
            <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {markAll.isError ? (
        <p role="alert" className="border-b border-border bg-danger-soft px-4 py-2 text-caption text-danger">
          Could not mark notifications as read. Try again.
        </p>
      ) : null}

      {segments.length > 0 ? (
        <div role="group" aria-label="Filter notifications" className="flex gap-2 border-b border-border px-4 py-3">
          {segments.map((entry) => {
            const selected = segment === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setSegment(entry.key)}
                className={cn(
                  'inline-flex h-btn-sm items-center gap-2 rounded-md border px-3 text-label',
                  selected ? 'border-bg-inverse bg-bg-inverse text-text-inverse' : 'border-border bg-bg-surface text-text',
                )}
              >
                {entry.label}
                <span
                  className={cn(
                    'rounded-sm px-1.5 text-badge tabular-nums',
                    selected ? 'bg-text-secondary text-text-inverse' : 'bg-bg-subtle text-text-secondary',
                  )}
                >
                  {entry.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="max-h-notifications-list overflow-y-auto">{body}</div>

      {list.data && !expanded && list.data.total > items.length ? (
        <div className="border-t border-border py-3 text-center">
          <Button variant="link" onClick={() => setExpanded(true)}>
            View all notifications
          </Button>
        </div>
      ) : null}
    </div>
  );
}
