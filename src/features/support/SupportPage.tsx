// owner: web-settings-admin — W-24 Settings · Support (web/tz.md §10 W-24). Perm `support`,
// visible to every role.
// Design: web/roles and screens/admin panel/Settings — support channels and tickets.jpg
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, MessageSquare, Mail, Phone, Download } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Button } from '@/shared/ui/Button';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { DataTable } from '@/shared/ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { toCsv } from '@/shared/lib/csv';
import { formatRelative } from '@/shared/format/relative';
import { useTicketsList, type TicketRow, type TicketStatus, type TicketPriority } from '@/shared/api/settingsAdmin';
import { NewTicketModal } from './components/NewTicketModal';
import { StartChatModal } from './components/StartChatModal';

type Segment = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

const PRIORITY_TONE: Record<TicketPriority, BadgeTone> = { URGENT: 'danger', HIGH: 'warning', NORMAL: 'neutral', LOW: 'neutral' };
const STATUS_TONE: Record<TicketStatus, BadgeTone> = { OPEN: 'info', IN_PROGRESS: 'warning', RESOLVED: 'success', CLOSED: 'neutral' };
const STATUS_LABEL: Record<TicketStatus, string> = { OPEN: 'New', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };

export default function SupportPage() {
  const { user } = useAuth();
  const [segment, setSegment] = useState<Segment>('ALL');
  const [search, setSearch] = useState('');
  const [ticketOpen, setTicketOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const ticketsQuery = useTicketsList({ page: 1, limit: 50, q: search || undefined });
  const rows = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data]);

  const counts = useMemo(
    () => ({
      open: rows.filter((r) => r.status === 'OPEN').length,
      inProgress: rows.filter((r) => r.status === 'IN_PROGRESS').length,
      resolved: rows.filter((r) => r.status === 'RESOLVED').length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    if (segment === 'ALL') return rows;
    if (segment === 'OPEN') return rows.filter((r) => r.status === 'OPEN');
    if (segment === 'IN_PROGRESS') return rows.filter((r) => r.status === 'IN_PROGRESS');
    return rows.filter((r) => r.status === 'RESOLVED');
  }, [rows, segment]);

  /**
   * WB-229 — `Export` had no handler at all. There is no `GET /support/tickets/export`, so the
   * CSV is built from exactly the rows on screen (the same segment and search the table shows)
   * rather than claiming a server-side export of everything.
   */
  function handleExport() {
    if (filtered.length === 0) return;
    const csv = toCsv([
      ['ticket', 'subject', 'priority', 'status', 'opened by', 'created', 'updated'],
      ...filtered.map((t) => [
        `#${t.number}`,
        t.subject,
        t.priority,
        t.status,
        t.requesterName ?? '',
        t.createdAt,
        t.updatedAt ?? t.createdAt,
      ]),
    ]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'support-tickets.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const columns: ColumnDef<TicketRow, unknown>[] = [
    { accessorKey: 'number', header: 'TICKET', cell: ({ row }) => <span className="text-primary">#{row.original.number}</span> },
    { accessorKey: 'subject', header: 'SUBJECT', cell: ({ row }) => <span className="line-clamp-2 text-text">{row.original.subject}</span> },
    { id: 'priority', header: 'PRIORITY', cell: ({ row }) => <Badge tone={PRIORITY_TONE[row.original.priority]}>{row.original.priority}</Badge> },
    {
      id: 'openedBy',
      header: 'OPENED BY',
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <Avatar name={row.original.requesterName ?? 'User'} size="sm" />
          <span className="text-text">{row.original.requesterName ?? '—'}</span>
        </span>
      ),
    },
    { id: 'updated', header: 'UPDATED', cell: ({ row }) => <span className="text-text-secondary">{formatRelative(row.original.updatedAt ?? row.original.createdAt)}</span> },
    { id: 'status', header: 'STATUS', cell: ({ row }) => <Badge tone={STATUS_TONE[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings · Support</h1>
          <p className="text-page-sub text-text-muted">{counts.open} open tickets</p>
        </div>
        <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setTicketOpen(true)}>
          New ticket
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary">
              <MessageSquare size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-body-strong text-text">Live chat</p>
              <p className="text-caption text-text-muted">Mon–Fri, 07:00–21:00 ET</p>
            </div>
          </div>
          {/* B-90 (shipped 2026-09-24) — `POST /support/chats`. */}
          <Button variant="primary" className="mt-3 w-full" onClick={() => setChatOpen(true)}>
            › Start chat
          </Button>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-info-soft text-info">
              <Mail size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-body-strong text-text">Email support</p>
              <p className="text-caption text-text-muted">support@onebookeld.com · replies in ~4 h</p>
            </div>
          </div>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => window.open('mailto:support@onebookeld.com')}>
            › Send email
          </Button>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-danger-soft text-danger">
              <Phone size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-body-strong text-text">24/7 roadside line</p>
              <p className="text-caption text-text-muted">+1 800 555 0142 · ELD failures only</p>
            </div>
          </div>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => window.open('tel:+18005550142')}>
            › Call now
          </Button>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
          {(
            [
              ['ALL', `All ${rows.length}`],
              ['OPEN', `Open ${counts.open}`],
              ['IN_PROGRESS', `In progress ${counts.inProgress}`],
              ['RESOLVED', `Resolved ${counts.resolved}`],
            ] as [Segment, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={segment === value}
              onClick={() => setSegment(value)}
              className={segment === value ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse' : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
          <Search size={16} strokeWidth={1.75} className="text-text-muted" />
          <input
            type="search"
            aria-label="Search ticket"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket…"
            className="w-56 bg-transparent text-body outline-none"
          />
        </div>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between p-card">
          <SectionHeader title="Your tickets" subtitle={`${rows.length} tickets in total`} />
          <Button
            variant="secondary"
            iconLeft={<Download size={16} strokeWidth={1.75} />}
            disabled={filtered.length === 0}
            title={filtered.length === 0 ? 'There are no tickets to export' : undefined}
            onClick={handleExport}
          >
            Export
          </Button>
        </div>
        {ticketsQuery.isLoading ? (
          <LoadingState className="p-4" />
        ) : ticketsQuery.isError ? (
          <ErrorState
            title="Could not load your tickets"
            description="The support desk did not respond. Any ticket you have opened is still there — try again in a moment."
            onRetry={() => ticketsQuery.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState {...EMPTY_STATE_COPY.support} actions={[{ label: 'New ticket', onClick: () => setTicketOpen(true) }]} />
        ) : (
          <DataTable data={filtered} columns={columns} caption="Support tickets" getRowId={(r) => r.id} />
        )}
      </Card>

      {ticketOpen && <NewTicketModal contactEmail={user?.email ?? 'support@onebookeld.com'} onClose={() => setTicketOpen(false)} />}
      {chatOpen && <StartChatModal onClose={() => setChatOpen(false)} />}
    </div>
  );
}
