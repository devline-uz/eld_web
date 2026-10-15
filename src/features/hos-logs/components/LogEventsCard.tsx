// owner: web-hos-logs — W-08 `Log events`.
//
// ⭐ `GET /logs/:driverId/events` deliberately returns superseded (2), proposed (3) and rejected
// (4) records as well. §395.8 forbids hiding the audit trail — but it must not be the default
// view either, or the inspector reads the same duty change three times. Default: recordStatus = 1.
// The checkbox reveals the rest: superseded struck through and muted, proposed on `--info-soft`.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Badge, DutyBadge, type DutyStatus } from '@/shared/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { cn } from '@/shared/ui/cn';
import { useToast } from '@/shared/ui/Toast';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { EMPTY, formatEngineHours, formatOdometer } from '@/shared/format';
import { formatNumber } from '@/shared/format/numbers';
import { EVENT_WINDOW, eventWindowSize } from '../eventWindow';
import {
  RECORD_ORIGIN,
  RECORD_STATUS,
  isInactiveReviewRecord,
  isReplacedDeviceRecord,
  type LogEventView,
} from '@/shared/api/hosLogs';
import { LogRecordModal } from './LogRecordModal';
import { telemetryFlags } from '../telemetryChecks';

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

/** D-163 — the exact tooltip agreed with the mobile team (2026-10-15). */
function replacedDeviceTooltip(event: Pick<LogEventView, 'reviewDeviceLabel'>): string {
  return `Sent from ${event.reviewDeviceLabel?.trim() || 'a replaced device'} after the driver signed in on another device. Needs review.`;
}

/** D-163 — `Replaced device` on every flagged row; `Not counted` when the record is stored inert. */
function ReviewBadges({ event }: { event: LogEventView }) {
  if (!isReplacedDeviceRecord(event)) return null;
  const tooltip = replacedDeviceTooltip(event);
  return (
    <>
      <span title={tooltip} className="inline-flex">
        <Badge tone="warning" dot>
          Replaced device
        </Badge>
        <span className="sr-only">{tooltip}</span>
      </span>
      {isInactiveReviewRecord(event) && (
        <span title="Inactive record — not drawn on the graph and not counted toward hours." className="inline-flex">
          <Badge outline>Not counted</Badge>
        </span>
      )}
    </>
  );
}

/** D-163 — the `Needs review` filter (`GET /logs/:driverId/events?review=REPLACED_DEVICE`). */
export interface LogEventsReviewFilter {
  /** The filter is on: the table lists the server's flagged records only, every record status. */
  active: boolean;
  onToggle: (next: boolean) => void;
  /** Flagged records of the day (from the unfiltered list) — the count indicator. */
  count: number;
  events: LogEventView[];
  carriedIn?: LogEventView | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export interface LogEventsCardProps {
  events: LogEventView[];
  /**
   * The record in force at 00:00 that began on an earlier day (`GET /logs/:id/events`
   * `carriedIn`). The grid draws its status from midnight, so the table shows it as the day's
   * first row — never "No ELD records for this day" under a full graph.
   */
  carriedIn?: LogEventView | null;
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
  /** D-163 — re-enter a replaced device's inert record as a new §395.30 proposal. */
  onReenter?: (event: LogEventView) => void;
  /** D-163 — absent ⇒ no `Needs review` control (older callers). */
  review?: LogEventsReviewFilter;
  onViewAll: () => void;
  /** LIVE-017 — "today" or "on Oct 8" (`dayPhrase`); defaults to "today". */
  dayLabel?: string;
}

export function LogEventsCard({
  events,
  carriedIn = null,
  timezone,
  isLoading,
  isError,
  onRetry,
  showAllRecords,
  onToggleShowAll,
  pendingEditCount,
  highlightedEventId,
  onRequestEdit,
  onReenter,
  review,
  onViewAll,
  dayLabel = 'today',
}: LogEventsCardProps) {
  const { toast } = useToast();
  const { can } = usePermission();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // WB-196 — `View full record` used to be a dead `#event-…` anchor; it opens the record instead.
  const [recordEvent, setRecordEvent] = useState<LogEventView | null>(null);

  const reviewOnly = Boolean(review?.active);
  const reviewEvents = review?.events;
  const reviewCarriedIn = review?.carriedIn ?? null;
  const visible = useMemo(() => {
    // D-163 — flagged records are mostly inert (status 3): the filter shows them whatever the
    // `Show superseded…` checkbox says, or the manager could never see what needs review.
    if (reviewOnly) {
      const flagged = reviewEvents ?? [];
      return reviewCarriedIn ? [reviewCarriedIn, ...flagged] : flagged;
    }
    const inDay = showAllRecords
      ? events
      : events.filter((event) => event.recordStatus === RECORD_STATUS.active);
    return carriedIn ? [carriedIn, ...inDay] : inDay;
  }, [events, carriedIn, showAllRecords, reviewOnly, reviewEvents, reviewCarriedIn]);
  const carriedId = (reviewOnly ? reviewCarriedIn : carriedIn)?.id ?? null;
  const loading = reviewOnly ? review!.isLoading : isLoading;
  const failed = reviewOnly ? review!.isError : isError;
  // LIVE-015 — impossible odometer / engine-hour readings are flagged, never silently shown.
  const flags = useMemo(() => telemetryFlags(carriedIn ? [carriedIn, ...events] : events), [events, carriedIn]);
  const [requestedRows, setRequestedRows] = useState(EVENT_WINDOW);
  const highlightIndex = useMemo(
    () => (highlightedEventId ? visible.findIndex((event) => event.id === highlightedEventId) : -1),
    [visible, highlightedEventId],
  );
  const shownCount = eventWindowSize(visible.length, requestedRows, highlightIndex);
  const windowed = shownCount < visible.length;
  const shown = useMemo(
    () => (windowed ? visible.slice(0, shownCount) : visible),
    [visible, windowed, shownCount],
  );

  useEffect(() => {
    if (!highlightedEventId) return;
    const row = bodyRef.current?.querySelector(`[data-row-id="${CSS.escape(highlightedEventId)}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedEventId, visible]);

  /** QA FE-013 — with "Show superseded…" already ticked the button did nothing visible. It now
   * also lifts the row window (every event, not the first page) and brings the list into view. */
  function viewAll() {
    onViewAll();
    setRequestedRows(Number.POSITIVE_INFINITY);
    bodyRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  const columns = useMemo<ColumnDef<LogEventView, unknown>[]>(
    () => [
      {
        id: 'time',
        header: 'TIME',
        // Sorting a partial window would misorder the day; rows arrive in chronological order.
        enableSorting: !windowed,
        accessorFn: (row) => row.eventDateTime,
        cell: ({ row }) =>
          row.original.id === carriedId ? (
            // Began on an earlier day: the date is part of the time, or it reads as today's.
            <span className="tabular font-semibold text-text-muted">
              {formatInTimeZone(new Date(row.original.eventDateTime), timezone, 'MMM d, HH:mm:ss')}
            </span>
          ) : (
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
        cell: ({ row }) =>
          row.original.locationName ?? <span className="text-text-muted">{EMPTY.dash}</span>,
      },
      {
        id: 'odometer',
        header: 'ODOMETER',
        meta: { numeric: true },
        enableSorting: false,
        cell: ({ row }) =>
          row.original.totalVehicleMiles === null || row.original.totalVehicleMiles === undefined ? (
            EMPTY.dash
          ) : (
            <TelemetryValue warning={flags.get(row.original.id)?.odometer}>
              {`${formatOdometer(row.original.totalVehicleMiles)} mi`}
            </TelemetryValue>
          ),
      },
      {
        id: 'engineHours',
        header: 'ENGINE HRS',
        meta: { numeric: true },
        enableSorting: false,
        // B-38 (shipped) — Appendix A total engine hours; `—` only when the record has none.
        cell: ({ row }) => (
          <TelemetryValue warning={flags.get(row.original.id)?.engineHours}>
            {formatEngineHours(row.original.totalEngineHours ?? null)}
          </TelemetryValue>
        ),
      },
      {
        id: 'origin',
        header: 'ORIGIN',
        enableSorting: false,
        cell: ({ row }) =>
          isReplacedDeviceRecord(row.original) ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {originCell(row.original)}
              <ReviewBadges event={row.original} />
            </span>
          ) : (
            originCell(row.original)
          ),
      },
      {
        id: 'notes',
        header: 'NOTES',
        enableSorting: false,
        cell: ({ row }) => {
          const note = row.original.annotation ?? row.original.comment;
          if (row.original.id === carriedId) {
            return (
              <span className="text-text-muted">
                {note ? `Carried over from the previous day · ${note}` : 'Carried over from the previous day'}
              </span>
            );
          }
          return note ?? <span className="text-text-muted">{EMPTY.dash}</span>;
        },
      },
    ],
    [timezone, windowed, carriedId, flags],
  );

  return (
    <Card padded={false} className="print:shadow-none">
      <div className="p-card">
        <SectionHeader
          title="Log events"
          subtitle={`${events.filter((event) => event.recordStatus === RECORD_STATUS.active).length} events ${dayLabel} · ${pendingEditCount} driver edit${pendingEditCount === 1 ? '' : 's'} pending review`}
          action={
            <Button variant="secondary" onClick={viewAll} data-print-hide="">
              <ChevronRight size={16} strokeWidth={1.75} />
              View all events
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-print-hide="">
          <label className="flex items-center gap-2 text-body text-text-secondary">
            <input
              type="checkbox"
              checked={showAllRecords}
              disabled={reviewOnly}
              onChange={(event) => onToggleShowAll(event.target.checked)}
            />
            Show superseded and proposed records
          </label>
          {review && (
            <Button
              variant={reviewOnly ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={reviewOnly}
              onClick={() => review.onToggle(!reviewOnly)}
            >
              <AlertTriangle size={16} strokeWidth={1.75} />
              Needs review
              {review.count > 0 && (
                <span
                  className={cn(
                    'tabular-nums rounded-full px-1.5 text-badge',
                    reviewOnly ? 'bg-bg-surface text-primary' : 'bg-warning-soft text-warning',
                  )}
                  aria-label={`${review.count} record${review.count === 1 ? '' : 's'} from a replaced device`}
                >
                  {formatNumber(review.count)}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
      <div ref={bodyRef} className="px-card pb-card">
        {loading ? (
          <LoadingState />
        ) : failed ? (
          <ErrorState
            title="Could not load log events"
            description="The §395 record list did not respond. Your data is safe — try again in a moment."
            onRetry={reviewOnly ? review!.onRetry : onRetry}
          />
        ) : (
          <>
            <DataTable<LogEventView>
              data={shown}
              columns={columns}
              getRowId={(row) => row.id}
              caption="Log events for this RODS day"
              rowClassName={(row) =>
                cn(
                  row.recordStatus === RECORD_STATUS.superseded &&
                    'line-through text-text-muted opacity-70',
                  row.recordStatus === RECORD_STATUS.rejected &&
                    'line-through text-text-muted opacity-70',
                  // D-163 — an inert replaced-device record is no proposal: muted, never `--info-soft`.
                  row.recordStatus === RECORD_STATUS.proposed && !isReplacedDeviceRecord(row) && 'bg-info-soft',
                  isInactiveReviewRecord(row) && 'text-text-muted opacity-70',
                  row.id === carriedId && 'bg-bg-subtle',
                  row.id === highlightedEventId && 'bg-primary-soft',
                )
              }
              rowActions={
                can('hosEdit', 'FULL')
                  ? (row) => (
                      <RowMenu
                        // QA CODE-027 — only a live duty-status record can be edited; a retired
                        // original, a proposal or a non-duty event would fork the record chain.
                        onRequestEdit={
                          row.recordStatus === RECORD_STATUS.active && row.status !== null ? () => onRequestEdit(row) : undefined
                        }
                        onReenter={onReenter && isInactiveReviewRecord(row) ? () => onReenter(row) : undefined}
                        onCopyId={() => {
                          void navigator.clipboard?.writeText(row.id);
                          toast({ kind: 'success', title: 'Event ID copied' });
                        }}
                        onViewRecord={() => setRecordEvent(row)}
                      />
                    )
                  : undefined
              }
              emptyState={
                reviewOnly ? (
                  <EmptyState
                    title="No records need review"
                    description="Nothing on this day was sent from a replaced device."
                  />
                ) : (
                <EmptyState
                  className="print:gap-1 print:py-3 [&>span:first-child]:print:hidden"
                  title={EMPTY_STATE_COPY.hosLogsDay.title}
                  description={EMPTY_STATE_COPY.hosLogsDay.description}
                />
                )
              }
            />
            {windowed && (
              <div className="flex items-center justify-center gap-3 border-t border-border pt-3">
                <span role="status" className="text-caption tabular-nums text-text-muted">
                  {`Showing ${formatNumber(shownCount)} of ${formatNumber(visible.length)} events`}
                </span>
                <Button
                  variant="secondary"
                  data-print-hide=""
                  onClick={() => setRequestedRows(shownCount + EVENT_WINDOW)}
                >
                  Show more events
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {recordEvent && (
        <LogRecordModal
          event={recordEvent}
          timezone={timezone}
          onClose={() => setRecordEvent(null)}
        />
      )}
    </Card>
  );
}

const menuItemClass =
  'flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-body text-text outline-none data-[highlighted]:bg-bg-subtle';

/** LIVE-015 — a recorded reading with a data-inconsistency warning next to it. */
function TelemetryValue({ warning, children }: { warning?: string; children: ReactNode }) {
  if (!warning) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1 text-danger" title={warning}>
      {children}
      <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only">{`Data inconsistency: ${warning}`}</span>
    </span>
  );
}

function RowMenu({
  onRequestEdit,
  onReenter,
  onCopyId,
  onViewRecord,
}: {
  /** Absent when the row cannot be edited (QA CODE-027). */
  onRequestEdit?: () => void;
  /** D-163 — only on a replaced device's inert record. */
  onReenter?: () => void;
  onCopyId: () => void;
  onViewRecord: () => void;
}) {
  return (
    <Can perm="hosEdit" level="FULL">
      {onRequestEdit && (
        <button type="button" className={menuItemClass} onClick={onRequestEdit}>
          Request an edit
        </button>
      )}
      {onReenter && (
        <button type="button" className={menuItemClass} onClick={onReenter}>
          Re-enter as a new record
        </button>
      )}
      <button type="button" className={menuItemClass} onClick={onViewRecord}>
        View full record
      </button>
      <button type="button" className={menuItemClass} onClick={onCopyId}>
        Copy event ID
      </button>
    </Can>
  );
}
