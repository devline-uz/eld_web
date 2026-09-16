// owner: web-dispatch-messaging — W-16 Messages (web/tz.md §10 W-16).
// Design: web/roles and screens/admin panel/Three-pane driver messaging with context panel.jpg
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, Plus, Search, Send, User } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useRoom } from '@/shared/realtime/useRoom';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { formatRelativeShort } from '@/shared/format/relative';
import { formatLocal } from '@/shared/format/datetime';
import { formatHosHours } from '@/shared/format/hos';
import { formatSpeed } from '@/shared/format/numbers';
import { useDriversList, useDriverHos } from '@/shared/api/drivers';
import { useLiveFleet } from '@/shared/api/liveFleet';
import { useActiveTrips } from '@/shared/api/trips';
import {
  useConversationsList,
  useMessages,
  useSendMessage,
  upsertMessage,
  bumpConversation,
  type ConversationListItem,
  type MessageRow,
} from '@/shared/api/messaging';
import { NewConversationModal } from './components/NewConversationModal';

type Segment = 'ALL' | 'UNREAD' | 'GROUPS';

const QUICK_ACTIONS = ['Send route', 'Request DVIR', 'Check-in', 'Break reminder'];

function conversationName(conversation: ConversationListItem): string {
  if (conversation.type === 'GROUP') return conversation.title ?? 'Group conversation';
  return conversation.driver ? `${conversation.driver.firstName} ${conversation.driver.lastName}` : (conversation.title ?? 'Conversation');
}

function conversationInitials(conversation: ConversationListItem): string {
  const parts = conversationName(conversation).split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useDynamicSubtitle(null);

  const [segment, setSegment] = useState<Segment>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const conversations = useConversationsList(user?.id);
  const driversQuery = useDriversList({ limit: 500 });

  const filteredConversations = useMemo(() => {
    let rows = conversations.items;
    if (segment === 'UNREAD') rows = rows.filter((c) => c.unread);
    if (segment === 'GROUPS') rows = rows.filter((c) => c.type === 'GROUP');
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter((c) => conversationName(c).toLowerCase().includes(needle));
    }
    return rows;
  }, [conversations.items, segment, search]);

  const selected = useMemo(
    () => conversations.items.find((c) => c.id === selectedId) ?? null,
    [conversations.items, selectedId],
  );

  const messagesQuery = useMessages(selected?.id);
  const sendMessage = useSendMessage(selected?.id ?? '');
  const liveFleet = useLiveFleet();
  const trips = useActiveTrips();
  const driverHos = useDriverHos(selected?.driver?.id);

  useRoom(selected ? `conversation:${selected.id}` : null, {
    'message.new': (payload) => {
      if (!selected) return;
      const message = payload.message as unknown as MessageRow;
      if (message.conversationId !== selected.id) return;
      upsertMessage(queryClient, selected.id, message);
      bumpConversation(queryClient, selected.id, message.sentAt);
    },
  });

  const unreadCount = conversations.items.filter((c) => c.unread).length;
  const driverUnit = selected?.driver ? liveFleet.data?.items.find((u) => u.driverId === selected.driver!.id) : undefined;
  const currentTrip = selected?.driver ? trips.rows.find((t) => t.driverId === selected.driver!.id && (t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED')) : undefined;

  function handleSend(body: string) {
    const trimmed = body.trim();
    if (!trimmed || !selected) return;
    if (trimmed.length > 2000) {
      toast({ kind: 'error', title: 'Messages are limited to 2,000 characters.' });
      return;
    }
    const clientId = crypto.randomUUID();
    const optimistic: MessageRow = {
      id: `optimistic-${clientId}`,
      conversationId: selected.id,
      senderUserId: user?.id ?? null,
      senderDriverId: null,
      body: trimmed,
      attachmentId: null,
      clientId,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
    };
    upsertMessage(queryClient, selected.id, optimistic);
    setDraft('');
    sendMessage.mutate(
      { body: trimmed, clientId },
      {
        onError: () => toast({ kind: 'error', title: 'Could not send the message.' }),
      },
    );
  }

  if (conversations.isLoading || driversQuery.isLoading) {
    return (
      <div className="flex h-content-h overflow-hidden rounded-lg border border-border bg-bg-surface">
        <LoadingState className="p-4" />
      </div>
    );
  }

  if (conversations.isError) {
    return <ErrorState onRetry={() => conversations.refetch()} />;
  }

  return (
    <div className="flex h-content-h overflow-hidden rounded-lg border border-border bg-bg-surface">
      {/* Left panel — conversations */}
      <div className="flex w-conversations-list shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-card-title font-semibold text-text">Conversations</h2>
          <Can perm="messaging" level="FULL">
            <Button variant="primary" size="sm" iconLeft={<Plus size={14} strokeWidth={1.75} />} onClick={() => setNewOpen(true)}>
              New
            </Button>
          </Can>
        </div>
        <div className="border-b border-border p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border border-border px-2">
            <Search size={14} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver…"
              className="h-full flex-1 bg-transparent text-body outline-none"
            />
          </div>
        </div>
        <div className="flex gap-1 border-b border-border p-2">
          {(
            [
              ['ALL', `All ${conversations.items.length}`],
              ['UNREAD', `Unread ${unreadCount}`],
              ['GROUPS', `Groups ${conversations.items.filter((c) => c.type === 'GROUP').length}`],
            ] as [Segment, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={segment === value}
              onClick={() => setSegment(value)}
              className={
                segment === value
                  ? 'rounded-md bg-bg-inverse px-2 py-1 text-caption font-semibold text-text-inverse'
                  : 'rounded-md px-2 py-1 text-caption text-text-secondary hover:bg-bg-subtle'
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <EmptyState
              {...EMPTY_STATE_COPY.messages}
              actions={can('messaging', 'FULL') ? [{ label: 'New', onClick: () => setNewOpen(true) }] : undefined}
            />
          ) : (
            filteredConversations.map((conversation) => {
              const name = conversationName(conversation);
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`flex w-full items-start gap-2 border-b border-border p-3 text-left ${
                    selected?.id === conversation.id ? 'bg-primary-soft' : 'hover:bg-bg-subtle'
                  }`}
                >
                  {conversation.type === 'GROUP' ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-soft text-caption font-semibold text-violet">
                      {conversationInitials(conversation)}
                    </span>
                  ) : (
                    <Avatar name={name} size="md" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-body-strong text-text">{name}</span>
                      <span className="shrink-0 text-caption text-text-muted">{formatRelativeShort(conversation.lastMessageAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-caption text-text-muted">
                        {conversation.lastMessageAt ? 'Tap to open the conversation' : 'No messages yet'}
                      </span>
                      {conversation.unread && (
                        <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-info" />
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Middle panel — thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState title="Select a conversation" description="Choose a driver from the list to see the thread." />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="flex items-center gap-2">
                <Avatar name={conversationName(selected)} size="md" />
                <div>
                  <p className="text-body-strong text-text">{conversationName(selected)}</p>
                  <p className="text-caption text-text-muted">
                    {driverUnit ? `Unit ${driverUnit.unitNumber} · ${driverUnit.dutyStatus === 'DRIVING' ? 'Driving' : 'On duty'} · ${formatSpeed(driverUnit.speedMph)}` : 'Status unavailable'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.driver && (
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/hos-logs?driverId=${selected.driver!.id}`)}>
                    View logs
                  </Button>
                )}
                <Can perm="trips" level="FULL">
                  <Button variant="secondary" size="sm" onClick={() => navigate('/trips')}>
                    Assign trip
                  </Button>
                </Can>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {messagesQuery.isLoading ? (
                <LoadingState />
              ) : messagesQuery.isError ? (
                <ErrorState onRetry={() => messagesQuery.refetch()} />
              ) : (
                <div className="flex flex-col gap-2">
                  {(messagesQuery.data?.items ?? [])
                    .slice()
                    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
                    .map((message) => {
                      const outgoing = Boolean(message.senderUserId);
                      return (
                        <div key={message.id} className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[70%] rounded-lg px-3 py-2 text-body ${
                              outgoing ? 'bg-primary text-text-inverse' : 'border border-border bg-bg-surface text-text'
                            }`}
                          >
                            <p>{message.body}</p>
                            <p className={`mt-1 text-right text-caption ${outgoing ? 'text-white/80' : 'text-text-muted'}`}>
                              {formatLocal(message.sentAt, 'time')} {outgoing ? (message.readAt ? '✓✓' : '✓') : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <Can perm="messaging" level="FULL">
              <div className="border-t border-border p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setDraft((prev) => (prev ? `${prev} ${action}` : action))}
                      className="rounded-full border border-border px-3 py-1 text-caption text-text-secondary hover:bg-bg-subtle"
                    >
                      {action}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(draft);
                      }
                    }}
                    placeholder={`Write a message to ${conversationName(selected)}…`}
                    rows={1}
                    className="max-h-32 flex-1 resize-none rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text outline-none"
                  />
                  <Button variant="primary" iconOnly aria-label="Send message" onClick={() => handleSend(draft)}>
                    <Send size={16} strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            </Can>
          </>
        )}
      </div>

      {/* Right panel — driver context */}
      {selected?.driver && (
        <div className="w-message-context shrink-0 overflow-y-auto border-l border-border p-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <Avatar name={conversationName(selected)} size="xl" />
            <p className="text-card-title font-semibold text-text">{conversationName(selected)}</p>
            <p className="text-caption text-text-muted">Unit {driverUnit?.unitNumber ?? '—'} · @{selected.driver.username}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" size="sm" iconLeft={<Phone size={14} strokeWidth={1.75} />}>
                Call
              </Button>
              <Button variant="secondary" size="sm" iconLeft={<User size={14} strokeWidth={1.75} />} onClick={() => navigate(`/drivers/${selected.driver!.id}`)}>
                Profile
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">Live status</h3>
            {driverUnit ? (
              <dl className="flex flex-col gap-1.5 text-body">
                <Row label="Duty status"><Badge tone={driverUnit.dutyStatus === 'DRIVING' ? 'success' : 'danger'} dot>{driverUnit.dutyStatus === 'DRIVING' ? 'Driving' : 'On duty'}</Badge></Row>
                <Row label="Speed">{formatSpeed(driverUnit.speedMph)}</Row>
                <Row label="Location">{driverUnit.locationLabel ?? '—'}</Row>
                <Row label="ELD"><Badge tone={driverUnit.bleState === 'CONNECTED' ? 'success' : 'danger'} dot>{driverUnit.bleState === 'CONNECTED' ? 'Connected' : 'Disconnected'}</Badge></Row>
              </dl>
            ) : (
              <p className="text-caption text-text-muted">Live status unavailable.</p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">Hours of service</h3>
            {driverHos.isLoading ? (
              <LoadingState rows={4} />
            ) : driverHos.isError || !driverHos.data ? (
              <p className="text-caption text-text-muted">HOS data unavailable.</p>
            ) : (
              <dl className="flex flex-col gap-1.5 text-body tabular-nums">
                <Row label="Drive left"><span className="text-danger">{formatHosHours(driverHos.data.driveRemainingSec)}</span></Row>
                <Row label="Shift left"><span className="text-warning">{formatHosHours(driverHos.data.shiftRemainingSec)}</span></Row>
                <Row label="Cycle left">{formatHosHours(driverHos.data.cycleRemainingSec)}</Row>
                <Row label="Break in"><span className="text-danger">{formatHosHours(driverHos.data.breakLimitSec - driverHos.data.breakInSec)}</span></Row>
              </dl>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">Current trip</h3>
            {currentTrip ? (
              <dl className="flex flex-col gap-1.5 text-body">
                <Row label="Trip">{currentTrip.number}</Row>
                <Row label="Destination">{currentTrip.delivery?.name ?? '—'}</Row>
                <Row label="ETA">{currentTrip.etaAt ? formatLocal(currentTrip.etaAt, 'time') : '—'}</Row>
              </dl>
            ) : (
              <p className="text-caption text-text-muted">No active trip.</p>
            )}
          </div>
        </div>
      )}

      {newOpen && <NewConversationModal onClose={() => setNewOpen(false)} onCreated={(id) => setSelectedId(id)} />}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text">{children}</dd>
    </div>
  );
}
