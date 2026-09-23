// owner: web-hos-logs — ⭐ W-08 HOS Logs · Driver log (web/tz.md §10 W-08).
// Design: web/roles and screens/admin panel/24-hour ELD graph grid, available hours, certification.jpg
//
// This is the compliance core: an FMCSA inspector reads this screen at the roadside. Three rules
// that are not negotiable anywhere below:
//   • every timestamp is in `driver.homeTerminalTimezone` — `formatLocal` is an ESLint error here;
//   • `Certify all` needs `hosCertifyOnBehalf` FULL (ADMIN); a fleet manager never sees it;
//   • the §395 audit trail is never hidden, and it is never the default view either.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, FileText, Plus, Upload } from 'lucide-react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { DriverPicker, type PickerOption } from '@/shared/ui/DriverPicker';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useRoom } from '@/shared/realtime/useRoom';
import { HOS_LOGS_POLL_MS, useVisiblePolling } from '@/shared/realtime/polling';
import { EMPTY } from '@/shared/format';
import { qk, qkRoot } from '@/shared/api/queryKeys';
import { useDriversList } from '@/shared/api/drivers';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import {
  RECORD_STATUS,
  useLogDay,
  useLogEvents,
  useLogRange,
  useUnidentifiedSegments,
  type LogEventView,
} from '@/shared/api/hosLogs';
import { printRegion } from '@/shared/lib/printRegion';
import { GraphGrid } from './components/GraphGrid';
import { AvailableHoursCard } from './components/AvailableHoursCard';
import { ViolationsCard } from './components/ViolationsCard';
import { CertificationCard } from './components/CertificationCard';
import { LogEventsCard } from './components/LogEventsCard';
import { RequestLogEditModal } from './components/RequestLogEditModal';
import { CertifyLogsModal } from './components/CertifyLogsModal';
import { UnassignedDrivingModal } from './components/UnassignedDrivingModal';
import { certificationNote, rodsDayStart, unassignedInDay, validDayKey, zoneLabel } from './grid';

const DAY_MS = 86_400_000;

/** Shown under the toolbar when there is no record to propose an edit against (WB-147). */
/** `Export PDF` opens the browser print dialog on the log region only (`shared/ui/print.css`). */
const PRINT_LOG_HINT = 'Prints this driver log only — choose "Save as PDF" in the print dialog.';

const EDIT_NEEDS_A_RECORD =
  'A log edit is proposed against an existing record (49 CFR §395.30). This day has no duty record yet.';

/** `2026-09-12` in a given zone — never the browser's. */
function dayKeyIn(timezone: string, at: Date = new Date()): string {
  return formatInTimeZone(at, timezone, 'yyyy-MM-dd');
}

function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export default function HosLogsPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const auth = useAuth();
  const queryClient = useQueryClient();

  const driversQuery = useDriversList({ limit: 200, status: 'ACTIVE' });
  const drivers = driversQuery.data?.items ?? [];

  const driverIdParam = params.get('driverId') ?? '';
  const driverId = driverIdParam || drivers[0]?.id || '';
  const driver = drivers.find((candidate) => candidate.id === driverId);
  const timezone = driver?.homeTerminalTimezone ?? 'UTC';
  const zone = zoneLabel(timezone);

  const todayKey = dayKeyIn(timezone);
  const date = validDayKey(params.get('date'), todayKey);

  const dayQuery = useLogDay(driverId || undefined, date);
  const eventsQuery = useLogEvents(driverId || undefined, date);
  const rangeQuery = useLogRange(driverId || undefined, shiftDay(date, -7), date);
  // WB-057 — the window is the driver's RODS day ± one day, built from `rodsDayStart` (the helper
  // the grid plots against), never from UTC midnights: for an Eastern terminal the old window
  // ended at 20:00 ET and a 21:30 ET unidentified segment on the viewed day was never fetched.
  // `+ 2 days` from the day start clears the end of every RODS day, 23-, 24- or 25-hour (§23).
  const dayStartMs = rodsDayStart(date, timezone);
  const unassignedQuery = useUnidentifiedSegments(
    {
      status: 'PENDING',
      from: new Date(dayStartMs - DAY_MS).toISOString(),
      to: new Date(dayStartMs + 2 * DAY_MS).toISOString(),
      limit: 200,
    },
    // Wait for the driver list, so the window is never first built in the `UTC` fallback zone.
    Boolean(driverId) && (Boolean(driver) || driversQuery.isFetched),
  );

  const vehiclesQuery = useVehiclesPicker();
  const unitLabel = useCallback(
    (vehicleId: string) => {
      const unit = vehiclesQuery.data?.items?.find((candidate) => candidate.id === vehicleId);
      // WB-195 — unit numbers come back both as `101` and as `#101`, and the label added a second
      // `#`: the header read `Unit ##101`. The prefix is rendered exactly once.
      return unit ? `Unit #${unit.unitNumber.replace(/^#+/, '')}` : EMPTY.unassigned;
    },
    [vehiclesQuery.data],
  );

  const [showAllRecords, setShowAllRecords] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<LogEventView | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [certifyOpen, setCertifyOpen] = useState(false);
  const [unassignedChipOpen, setUnassignedChipOpen] = useState(false);
  // WD-037 — W-15 `Resolve now ›` deep-links to `/hos-logs?unassigned=1`. The param opens 11.13
  // only for `hosEdit` FULL; everyone else gets the normal page, no modal, no error.
  const unassignedOpen =
    unassignedChipOpen || (params.get('unassigned') === '1' && can('hosEdit', 'FULL'));

  function closeUnassigned() {
    setUnassignedChipOpen(false);
    if (params.has('unassigned')) {
      const next = new URLSearchParams(params);
      next.delete('unassigned');
      // Replace, so neither a refresh nor Back reopens the modal.
      setParams(next, { replace: true });
    }
  }

  // §7.5 — `driver:{id}` and `violations`; `eld.events_ingested` invalidates the day and its
  // events. There is no `hos.updated` event yet (§7.4), so the documented poll stands in.
  useRoom(driverId ? `driver:${driverId}` : null, {
    'eld.events_ingested': () => {
      void queryClient.invalidateQueries({ queryKey: qk.logDay(driverId, date) });
      void queryClient.invalidateQueries({ queryKey: qk.logEvents(driverId, date) });
    },
  });
  useRoom(driverId ? 'violations' : null);
  useVisiblePolling(
    HOS_LOGS_POLL_MS,
    () => void queryClient.invalidateQueries({ queryKey: qkRoot.logs }),
    Boolean(driverId),
  );

  useEffect(() => {
    if (!highlightedEventId) return;
    const timer = setTimeout(() => setHighlightedEventId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedEventId]);

  function setParam(next: Record<string, string>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) merged.set(key, value);
    setParams(merged, { replace: true });
  }

  const day = dayQuery.data;
  // WB-049 — a partial payload (a stub fixture, an older server) must degrade to the card's own
  // error state, never to React Router's boundary: nothing below dereferences `day` unguarded.
  const dayIsUsable = Boolean(day?.summary?.dayLengthSec && day?.graph);
  const certification = day?.certification;
  const dayEvents = day?.events;
  const rawEvents = eventsQuery.data?.events;
  const events = useMemo(() => rawEvents ?? dayEvents ?? [], [rawEvents, dayEvents]);
  const activeDutyEvents = useMemo(
    () => events.filter((event) => event.recordStatus === RECORD_STATUS.active && event.status !== null),
    [events],
  );
  // The record a proposal is made against: the day's latest active duty change (WB-147).
  const editableEvent = activeDutyEvents[activeDutyEvents.length - 1] ?? null;
  const pendingEditCount = useMemo(
    () => events.filter((event) => event.recordStatus === RECORD_STATUS.proposed).length,
    [events],
  );

  const locationAt = useCallback(
    (startAt: string) =>
      activeDutyEvents.find((event) => event.eventDateTime === startAt)?.locationName ?? null,
    [activeDutyEvents],
  );

  const dateLabel = formatInTimeZone(fromZonedTime(`${date}T12:00:00`, timezone), timezone, 'EEE, MMM d, yyyy');
  const isFuture = date >= todayKey;

  const driverOptions: PickerOption[] = drivers.map((candidate) => ({
    id: candidate.id,
    name: `${candidate.firstName} ${candidate.lastName}`,
    context: candidate.homeTerminalName ?? EMPTY.dash,
  }));
  const driverName = driver ? `${driver.firstName} ${driver.lastName}` : '';
  const unitNumber = driver?.assignedVehicleId ? unitLabel(driver.assignedVehicleId) : EMPTY.unassigned;

  // WB-058 — the request deliberately spans three days (WB-057), so everything that counts or
  // renders a segment keeps only what overlaps `[dayStart, dayStart + dayLengthSec)`. Without this
  // the chip and the 11.13 subtitle report yesterday's and tomorrow's segments on this day.
  const dayLengthSec = day?.summary?.dayLengthSec ?? 86_400;
  const unassignedSegments = unassignedInDay(unassignedQuery.data?.items ?? [], dayStartMs, dayLengthSec);

  // WB-073 — the same full-page forbidden state as every other screen, not an error.
  if (!can('hos')) {
    return <ForbiddenState screenName="HOS Logs" />;
  }

  return (
    // Stage 3 — `Export PDF` used to `window.print()` the whole app (sidebar, topbar, toolbar).
    // The page root is now the print region; its controls carry `data-print-hide`.
    <div ref={printRef} className="flex flex-col gap-card-gap p-page">
      <header>
        <h1 className="text-page-title text-text">Hours of Service · Driver log</h1>
        <p className="text-page-sub text-text-muted">
          {driver
            ? `${driverName} · ${unitNumber} · Home terminal: ${driver.homeTerminalName} (${zone})`
            : 'Select a driver to view their log'}
        </p>
      </header>

      {/* control row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DriverPicker
            value={driverOptions.find((option) => option.id === driverId)}
            options={driverOptions}
            onSelect={(option) => setParam({ driverId: option.id })}
            placeholder="Select a driver"
          />
          <div className="flex h-input items-center gap-2 rounded-md border border-border px-2">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setParam({ date: shiftDay(date, -1) })}
              className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <Calendar size={16} strokeWidth={1.75} className="text-text-muted" />
            <span className="tabular text-body font-medium text-text">{dateLabel}</span>
            <button
              type="button"
              aria-label="Next day"
              disabled={isFuture}
              onClick={() => setParam({ date: shiftDay(date, 1) })}
              className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
          {certification && (
            <Badge tone={certification.certified ? 'success' : 'warning'} dot>
              {certification.certified ? 'Certified' : 'Uncertified'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2" data-print-hide="">
          <Can perm="hosEdit" level="FULL">
            <Button
              variant="secondary"
              disabled={!editableEvent}
              aria-describedby={editableEvent ? undefined : 'hos-edit-unavailable'}
              onClick={() => {
                if (!editableEvent) return;
                setEditTarget(editableEvent);
                setEditOpen(true);
              }}
            >
              <Plus size={16} strokeWidth={1.75} />
              Add / edit event
            </Button>
          </Can>
          <Button
            variant="secondary"
            title={PRINT_LOG_HINT}
            onClick={() => printRegion(printRef.current)}
          >
            <Upload size={16} strokeWidth={1.75} />
            Export PDF
          </Button>
          <Can perm="reportsTransfer" level="FULL">
            <Button variant="primary" onClick={() =>
                // WD-037 — 11.14 lives in features/reports; the URL is the seam (no cross-feature import).
                navigate(`/reports/fmcsa?${new URLSearchParams({ transfer: '1', driverId, date }).toString()}`)
              }>
              <FileText size={16} strokeWidth={1.75} />
              Send to inspector
            </Button>
          </Can>
        </div>
      </div>

      {/* WB-147 — §395.30 lets a carrier only PROPOSE a change to an existing record, and
          `POST /logs/:driverId/edit-requests` requires `originalEventId`. With no record on the
          day there is nothing to propose against, so the action is disabled with its reason
          rather than opening a form that can never be sent (backend gap B-39). */}
      {driverId && can('hosEdit', 'FULL') && !editableEvent && (
        <p id="hos-edit-unavailable" className="text-caption text-text-muted">
          {EDIT_NEEDS_A_RECORD}
        </p>
      )}

      {!driverId ? (
        <Card>
          <EmptyState title={EMPTY_STATE_COPY.hosLogsNoDriver.title} />
        </Card>
      ) : (
        <>
          {/* ⭐ 24-hour graph grid */}
          <Card>
            <SectionHeader
              title="24-hour graph grid"
              subtitle={`Recorded by ELD ${EMPTY.notAssigned} · all times ${zone}`}
              action={
                // Never claim "No unassigned segments" before the answer is in: while the query is
                // pending the chip is a skeleton, and a failed query says the count is unknown.
                unassignedQuery.isPending ? (
                  <span
                    aria-busy="true"
                    data-testid="unassigned-chip-loading"
                    className="inline-block h-5 w-40 animate-pulse rounded-full bg-bg-subtle"
                  >
                    <span className="sr-only">Checking for unassigned segments</span>
                  </span>
                ) : unassignedQuery.isError && !unassignedQuery.data ? (
                  <button type="button" onClick={() => void unassignedQuery.refetch()}>
                    <Badge tone="warning" dot>
                      Unassigned segments unavailable · Retry
                    </Badge>
                  </button>
                ) : unassignedSegments.length === 0 ? (
                  <Badge tone="success" dot>
                    No unassigned segments
                  </Badge>
                ) : can('hosEdit', 'FULL') ? (
                  <button type="button" onClick={() => setUnassignedChipOpen(true)}>
                    <Badge tone="warning" dot>
                      {`${unassignedSegments.length} unassigned segment${unassignedSegments.length === 1 ? '' : 's'}`}
                    </Badge>
                  </button>
                ) : (
                  // Dispatcher sees the chip but cannot open it (§10 W-08 role table).
                  <Badge tone="warning" dot>
                    {`${unassignedSegments.length} unassigned segment${unassignedSegments.length === 1 ? '' : 's'}`}
                  </Badge>
                )
              }
            />
            <div className="mt-4">
              {dayQuery.isLoading ? (
                <LoadingState rows={4} />
              ) : dayQuery.isError || !day || !dayIsUsable ? (
                <ErrorState
                  title="Could not load this RODS day"
                  description="The log service did not respond. Your data is safe — try again in a moment."
                  onRetry={() => void dayQuery.refetch()}
                />
              ) : (
                <>
                  <GraphGrid
                    summary={day.summary}
                    graph={day.graph}
                    violations={day.violations ?? []}
                    unassigned={unassignedSegments}
                    timezone={day.timezone ?? timezone}
                    dateLabel={dateLabel}
                    zone={zone}
                    locationAt={locationAt}
                    onSelectSegment={(startAt) => {
                      const match = activeDutyEvents.find((event) => event.eventDateTime === startAt);
                      if (match) setHighlightedEventId(match.id);
                    }}
                  />
                  {day.graph.length === 0 && (
                    <p className="mt-3 rounded-md bg-bg-subtle p-3 text-body text-text-secondary">
                      No ELD records for this day. The driver may have been off duty or the app was
                      not signed in.
                    </p>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* three-card row */}
          <div className="grid grid-cols-3 gap-card-gap">
            <AvailableHoursCard driverId={driverId} />
            <ViolationsCard
              driverId={driverId}
              date={date}
              timezone={timezone}
              violations={day?.violations ?? []}
            />
            <CertificationCard
              days={rangeQuery.data?.days ?? []}
              isLoading={rangeQuery.isLoading}
              isError={rangeQuery.isError}
              onRetry={() => void rangeQuery.refetch()}
              onSelectDate={(next) => setParam({ date: next })}
              onCertifyAll={() => setCertifyOpen(true)}
              reminderNote={certificationNote(rangeQuery.data?.days ?? [], timezone)}
            />
          </div>

          <LogEventsCard
            events={events}
            timezone={timezone}
            isLoading={eventsQuery.isLoading}
            isError={eventsQuery.isError}
            onRetry={() => void eventsQuery.refetch()}
            showAllRecords={showAllRecords}
            onToggleShowAll={setShowAllRecords}
            // WB-065 — only genuinely proposed records (recordStatus = 3) are pending review; an
            // accepted driver edit (status 1, origin 2) is already applied and never counted here.
            pendingEditCount={pendingEditCount}
            highlightedEventId={highlightedEventId}
            onRequestEdit={(event) => {
              setEditTarget(event);
              setEditOpen(true);
            }}
            onViewAll={() => setShowAllRecords(true)}
          />
        </>
      )}

      {editOpen && (
        <RequestLogEditModal
          driverId={driverId}
          driverName={driverName}
          date={date}
          dateLabel={dateLabel}
          timezone={timezone}
          event={editTarget}
          graph={day?.graph ?? []}
          onClose={() => setEditOpen(false)}
        />
      )}

      {certifyOpen && (
        <CertifyLogsModal
          driverId={driverId}
          driverName={driverName}
          signerName={auth.user?.fullName ?? 'Administrator'}
          timezone={timezone}
          days={rangeQuery.data?.days ?? []}
          recertificationDates={certification?.recertificationRequired ? [date] : []}
          onClose={() => setCertifyOpen(false)}
        />
      )}

      {unassignedOpen && (
        <UnassignedDrivingModal
          segments={unassignedSegments}
          drivers={driverOptions.map((option) => ({ id: option.id, name: option.name }))}
          unitLabel={unitLabel}
          timezone={timezone}
          onClose={closeUnassigned}
        />
      )}
    </div>
  );
}
