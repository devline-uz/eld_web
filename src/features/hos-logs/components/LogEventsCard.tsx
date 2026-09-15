// owner: web-hos-logs — W-08 `Log events`.
//
// ⭐ `GET /logs/:driverId/events` deliberately returns superseded (2), proposed (3) and rejected
// (4) records as well. §395.8 forbids hiding the audit trail — but it must not be the default
// view either, or the inspector reads the same duty change three times. Default: recordStatus = 1.
// The checkbox reveals the rest: superseded struck through and muted, proposed on `--info-soft`.
import { useEffect, useMemo, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { DutyBadge, type DutyStatus } from '@/shared/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { cn } from '@/shared/ui/cn';
import { useToast } from '@/shared/ui/Toast';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { EMPTY, formatEngineHours, formatOdometer } from '@/shared/format';
import { RECORD_ORIGIN, RECORD_STATUS, type LogEventView } from '@/shared/api/hosLogs';

const DUTY_BADGE: Record<string, DutyStatus> = {
  OFF: 'OFF_DUTY',
  SB: 'SLEEPER',
  D: 'DRIVING',
  ON: 'ON_DUTY',
};

/** §395.8 record origin → the exact `ORIGIN` strings from the design. */
function originCell(event: LogEventView) {
  if (event.recordOrigin === RECORD_ORIGIN.driver) {
    return <span className="text-warning">Driver · edited</span>;
  }
  if (event.recordOrigin === RECORD_ORIGIN.carrier) {
    return <span className="text-info">Carrier · proposed</span>;
  }
  if (event.recordOrigin === RECORD_ORIGIN.unidentified) {
    return <span className="text-text-muted">Unidentified</span>;
  }
  return <span className="text-text-muted">ELD · automatic</span>;
}

export interface LogEventsCardProps {
  events: LogEventView[];
  timezone: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  showAllRecords: boolean;
  onToggleShowAll: (next: boolean) => void;
  pendingEditCount: number;
  /** Set by a click on the 24-hour grid — the row scrolls into view and highlights. */
  highlightedEventId: string | null;
  onRequestEdit: (event: LogEventView) => void;
  onViewAll: () => void;
}

export function LogEventsCard({
  events,
  timezone,
  isLoading,
  isError,
  onRetry,
  showAllRecords,
  onToggleShowAll,
  pendingEditCount,
  highlightedEventId,
  onRequestEdit,
  onViewAll,
}: LogEventsCardProps) {
  const { toast } = useToast();
  const { can } = usePermission();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(
    () => (showAllRecords ? events : events.filter((event) => event.recordStatus === RECORD_STATUS.active)),
    [events, showAllRecords],
  );

  useEffect(() => {
    if (!highlightedEventId) return;
    const row = bodyRef.current?.querySelector(`[data-row-id="${CSS.escape(highlightedEventId)}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedEventId, visible]);

  const columns = useMemo<ColumnDef<LogEventView, unknown>[]>(
    () => [
      {
        id: 'time',
        header: 'TIME',
        accessorFn: (row) => row.eventDateTime,
        cell: ({ row }) => (
          <span className="tabular font-semibold">
            {formatInTimeZone(new Date(row.original.eventDateTime), timezone, 'HH:mm:ss')}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'STATUS',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status && DUTY_BADGE[row.original.status] ? (
            <DutyBadge status={DUTY_BADGE[row.original.status]!} />
          ) : (
            <span className="text-text-muted">{EMPTY.dash}</span>
          ),
      },
      {
        id: 'location',
        header: 'LOCATION',
        enableSorting: false,
        cell: ({ row }) => row.original.locationName ?? <span className="text-text-muted">{EMPTY.dash}</span>,
      },
      {
        id: 'odometer',
        header: 'ODOMETER',
        meta: { numeric: true },
        enableSorting: false,
        cell: ({ row }) =>
          row.original.totalVehicleMiles === null || row.original.totalVehicleMiles === undefined
            ? EMPTY.dash
            : `${formatOdometer(row.original.totalVehicleMiles)} mi`,
      },
      {
        id: 'engineHours',
        header: 'ENGINE HRS',
        meta: { numeric: true },
        enableSorting: false,
        // ⛔ B-38 — `toEventView()` drops `totalEngineHours`; the column shows `—` until it ships.
        cell: ({ row }) => formatEngineHours(row.original.totalEngineHours ?? null),
      },
      { id: 'origin', header: 'ORIGIN', enableSorting: false, cell: ({ row }) => originCell(row.original) },
      {
        id: 'notes',
        header: 'NOTES',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.annotation ?? row.original.comment ?? <span className="text-text-muted">{EMPTY.dash}</span>,
      },
    ],
    [timezone],
  );

  return (
    <Card padded={false}>
      <div className="p-card">
        <SectionHeader
          title="Log events"
          subtitle={`${events.filter((event) => event.recordStatus === RECORD_STATUS.active).length} events today · ${pendingEditCount} driver edit${pendingEditCount === 1 ? '' : 's'} pending review`}
          action={
            <Button variant="secondary" onClick={onViewAll}>
              <ChevronRight size={16} strokeWidth={1.75} />
              View all events
            </Button>
          }
        />
        <label className="mt-3 flex items-center gap-2 text-body text-text-secondary">
          <input
            type="checkbox"
            checked={showAllRecords}
            onChange={(event) => onToggleShowAll(event.target.checked)}
          />
          Show superseded and proposed records
        </label>
      </div>
      <div ref={bodyRef} className="px-card pb-card">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState
            title="Could not load log events"
            description="The §395 record list did not respond. Your data is safe — try again in a moment."
            onRetry={onRetry}
          />
        ) : (
          <DataTable<LogEventView>
            data={visible}
            columns={columns}
            getRowId={(row) => row.id}
            caption="Log events for this RODS day"
            rowClassName={(row) =>
              cn(
                row.recordStatus === RECORD_STATUS.superseded && 'line-through text-text-muted opacity-70',
                row.recordStatus === RECORD_STATUS.rejected && 'line-through text-text-muted opacity-70',
                row.recordStatus === RECORD_STATUS.proposed && 'bg-info-soft',
                row.id === highlightedEventId && 'bg-primary-soft',
              )
            }
            rowActions={
              can('hosEdit', 'FULL')
                ? (row) => (
                    <RowMenu
                      event={row}
                      onRequestEdit={() => onRequestEdit(row)}
                      onCopyId={() => {
                        void navigator.clipboard?.writeText(row.id);
                        toast({ kind: 'success', title: 'Event ID copied' });
                      }}
                    />
                  )
                : undefined
            }
            emptyState={
              <EmptyState
                title={EMPTY_STATE_COPY.hosLogsDay.title}
                description={EMPTY_STATE_COPY.hosLogsDay.description}
              />
            }
          />
        )}
      </div>
    </Card>
  );
}

const menuItemClass =
  'flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-body text-text outline-none data-[highlighted]:bg-bg-subtle';

function RowMenu({
  event,
  onRequestEdit,
  onCopyId,
}: {
  event: LogEventView;
  onRequestEdit: () => void;
  onCopyId: () => void;
}) {
  return (
    <Can perm="hosEdit" level="FULL">
      <button type="button" className={menuItemClass} onClick={onRequestEdit}>
        Request an edit
      </button>
      <a className={menuItemClass} href={`#event-${event.id}`}>
        View full record
      </a>
      <button type="button" className={menuItemClass} onClick={onCopyId}>
        Copy event ID
      </button>
    </Can>
  );
}
