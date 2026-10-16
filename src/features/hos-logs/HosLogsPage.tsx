// owner: web-hos-logs — ⭐ W-08 HOS Logs · Driver log (web/tz.md §10 W-08).
// Design: web/roles and screens/admin panel/24-hour ELD graph grid, available hours, certification.jpg
//
// This is the compliance core: an FMCSA inspector reads this screen at the roadside. Three rules
// that are not negotiable anywhere below:
//   • every timestamp is in `driver.homeTerminalTimezone` — `formatLocal` is an ESLint error here;
//   • CODE-029 — no web certification: the driver certifies in the app (§395.8(e));
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
import { useRoom } from '@/shared/realtime/useRoom';
import { HOS_LOGS_POLL_MS, useVisiblePolling } from '@/shared/realtime/polling';
import { EMPTY } from '@/shared/format';
import { recordedBySubtitle } from './recordedBy';
import { dayPhrase } from './dayPhrase';
import { qk, qkRoot } from '@/shared/api/queryKeys';
import { useDriver, useDriversList, type DriverRow } from '@/shared/api/drivers';
import { ApiError } from '@/shared/api/errors';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import {
  RECORD_STATUS,
  REVIEW_REASON,
  isReplacedDeviceRecord,
  useDriverOpenViolations,
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
import { UnassignedDrivingModal } from './components/UnassignedDrivingModal';
import {
  certificationLabel,
  certificationNote,
  driverDayVehicleIds,
  rodsDayStart,
  unassignedForVehicles,
  unassignedInDay,
  validDayKey,
  zoneLabel,
} from './grid';
import { usePageHeader } from '@/app/layouts/Topbar';

const DAY_MS = 86_400_000;

/** `Export PDF` opens the browser print dialog on the log region only (`shared/ui/print.css`). */
const PRINT_LOG_HINT = 'Prints this driver log only — choose "Save as PDF" in the print dialog.';

/** `2026-09-12` in a given zone — never the browser's. */
function dayKeyIn(timezone: string, at: Date = new Date()): string {
  return formatInTimeZone(at, timezone, 'yyyy-MM-dd');
}

/** LIVE-019 — a driver id that is not a UUID is never sent to the API (it would only 422/404). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Drivers who are no longer ACTIVE keep their logs (§395.8(k) retention) and stay pickable. */
function driverStatusLabel(status: DriverRow['status']): string | undefined {
  if (status === 'TERMINATED') return 'Terminated';
  if (status === 'INACTIVE') return 'Inactive';
  return undefined;
}

function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export default function HosLogsPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const queryClient = useQueryClient();

  const driversQuery = useDriversList({ limit: 200, status: 'ACTIVE' });
  // Inactive and terminated drivers stay in the picker (listed after the active ones): their
  // RODS stay reviewable for the retention period even though they no longer drive.
  const allDriversQuery = useDriversList({ limit: 200 });
  const drivers = useMemo(() => {
    const active = driversQuery.data?.items ?? [];
    const seen = new Set(active.map((candidate) => candidate.id));
    const inactive = (allDriversQuery.data?.items ?? []).filter(
      (candidate) => candidate.status !== 'ACTIVE' && !seen.has(candidate.id),
    );
    return [...active, ...inactive];
  }, [driversQuery.data, allDriversQuery.data]);

  const driverIdParam = params.get('driverId') ?? '';
  // LIVE-019 — a malformed id shows "Driver not found" without calling the API.
  const invalidDriverId = Boolean(driverIdParam) && !UUID_RE.test(driverIdParam);
  const driverId = invalidDriverId ? '' : driverIdParam || drivers[0]?.id || '';
  const listedDriver = drivers.find((candidate) => candidate.id === driverId);
  // CODE-064 — a deep-linked driver outside the first 200 is loaded on its own, so the page uses
  // HIS home terminal zone instead of silently falling back to UTC.
  const driverDetailQuery = useDriver(driverId && !listedDriver && driversQuery.isFetched ? driverId : undefined);
  const driver: DriverRow | undefined = listedDriver ?? driverDetailQuery.data;
  const driverNotFound = invalidDriverId || isNotFound(driverDetailQuery.error);
  const timezone = driver?.homeTerminalTimezone ?? 'UTC';
  const zone = zoneLabel(timezone);
  // Until the driver (and so the zone) is known, nothing is fetched in the UTC fallback zone.
  const driverResolved = Boolean(driver) || driverDetailQuery.isFetched;
  const queryDriverId = driverId && driverResolved && !driverNotFound ? driverId : '';

  const todayKey = dayKeyIn(timezone);
  const rawDate = params.get('date');
  const date = validDayKey(rawDate, todayKey);

  const dayQuery = useLogDay(queryDriverId || undefined, date);
  // BUG-003 — the driver's active violations on ANY day (`GET /violations`, the same backend
  // definition the dashboard and the Drivers roster count), so the card can reconcile with them.
  const openViolationsQuery = useDriverOpenViolations(queryDriverId || undefined);
  const eventsQuery = useLogEvents(queryDriverId || undefined, date);
  // D-163 — `?review=REPLACED_DEVICE` (deep-linkable) narrows the table to the records a replaced
  // device delivered late; the server filters, so the request carries the same query param.
  const reviewOnly = params.get('review') === REVIEW_REASON.replacedDevice;
  const reviewQuery = useLogEvents(reviewOnly ? queryDriverId || undefined : undefined, date, REVIEW_REASON.replacedDevice);
  const rangeQuery = useLogRange(queryDriverId || undefined, shiftDay(date, -7), date);
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
    // Wait for the driver, so the window is never first built in the `UTC` fallback zone.
    Boolean(queryDriverId),
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
  const [editPrefill, setEditPrefill] = useState<LogEventView | null>(null);
  const [editOpen, setEditOpen] = useState(false);
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

  // LIVE-031 — a future or impossible `?date=` is shown as today; the URL is corrected to match,
  // so a shared or bookmarked link never claims a day the page is not showing. Waits for the zone.
  useEffect(() => {
    if (!rawDate || rawDate === date || !driverResolved) return;
    const next = new URLSearchParams(params);
    next.set('date', date);
    setParams(next, { replace: true });
  }, [rawDate, date, driverResolved, params, setParams]);

  function setParam(next: Record<string, string>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) merged.set(key, value);
    setParams(merged, { replace: true });
  }

  const day = dayQuery.data;
  const notFound = driverNotFound || isNotFound(dayQuery.error);
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
  // The record a proposal is made against: the day's latest active duty change (WB-147). With none,
  // `Add / edit event` proposes a new record instead (B-72) — still only a §395.30 suggestion.
  const editableEvent = activeDutyEvents[activeDutyEvents.length - 1] ?? null;
  // D-163 — a replaced device's inert record is stored as 3 too, but it is not a proposal.
  const pendingEditCount = useMemo(
    () => events.filter((event) => event.recordStatus === RECORD_STATUS.proposed && !isReplacedDeviceRecord(event)).length,
    [events],
  );
  const reviewCount = useMemo(() => events.filter(isReplacedDeviceRecord).length, [events]);

  const locationAt = useCallback(
    (startAt: string) =>
      activeDutyEvents.find((event) => event.eventDateTime === startAt)?.locationName ?? null,
    [activeDutyEvents],
  );

  const dateLabel = formatInTimeZone(fromZonedTime(`${date}T12:00:00`, timezone), timezone, 'EEE, MMM d, yyyy');
  const isFuture = date >= todayKey;
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const driverOptions: PickerOption[] = drivers.map((candidate) => ({
    id: candidate.id,
    name: `${candidate.firstName} ${candidate.lastName}`,
    context: candidate.homeTerminalName ?? EMPTY.dash,
    hosSummary: driverStatusLabel(candidate.status),
    hosTone: candidate.status === 'TERMINATED' ? ('danger' as const) : candidate.status === 'INACTIVE' ? ('warning' as const) : undefined,
  }));
  // A deep-linked driver outside the list still shows as the picker's value.
  if (driver && !driverOptions.some((option) => option.id === driver.id)) {
    driverOptions.push({
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
      context: driver.homeTerminalName ?? EMPTY.dash,
      hosSummary: driverStatusLabel(driver.status),
    });
  }
  const driverName = driver ? `${driver.firstName} ${driver.lastName}` : '';
  const unitNumber = driver?.assignedVehicleId ? unitLabel(driver.assignedVehicleId) : EMPTY.unassigned;

  // WB-058 — the request deliberately spans three days (WB-057), so everything that counts or
  // renders a segment keeps only what overlaps `[dayStart, dayStart + dayLengthSec)`. Without this
  // the chip and the 11.13 subtitle report yesterday's and tomorrow's segments on this day.
  const dayLengthSec = day?.summary?.dayLengthSec ?? 86_400;
  // QA CODE-031 — the request is fleet-wide (a segment can sit on any unit the driver used that
  // day); only segments on this driver's units are shown, counted and offered for assignment.
  const driverVehicleIds = driverDayVehicleIds(
    [...(rawEvents ?? []), ...(eventsQuery.data?.carriedIn ? [eventsQuery.data.carriedIn] : [])],
    [driver?.assignedVehicleId, ...(day?.recordedBy ?? []).map((eld) => eld.vehicleId)],
  );
  const unassignedSegments = unassignedForVehicles(
    unassignedInDay(unassignedQuery.data?.items ?? [], dayStartMs, dayLengthSec),
    driverVehicleIds,
  );

  // WB-073 — the same full-page forbidden state as every other screen, not an error.
  const statusSuffix = driver ? driverStatusLabel(driver.status) : undefined;
  const headerSubtitle = notFound
    ? 'Driver not found'
    : driver
      ? `${driverName}${statusSuffix ? ` (${statusSuffix})` : ''} · ${unitNumber} · Home terminal: ${driver.homeTerminalName} (${zone})`
      : 'Select a driver to view their log';
  usePageHeader({ title: 'Hours of Service · Driver log', subtitle: headerSubtitle });
  if (!can('hos')) {
    return <ForbiddenState screenName="HOS Logs" />;
  }

  return (
    // Stage 3 — `Export PDF` used to `window.print()` the whole app (sidebar, topbar, toolbar).
    // The page root is now the print region; its controls carry `data-print-hide`.
    <div ref={printRef} className="flex flex-col gap-card-gap p-page print:gap-3">
      {/* The on-screen title lives in the top bar (outside the print region); the printout
          still needs it, so it is repeated here for print only (display:none on screen). */}
      {/* WB-283 — on paper the driver picker, day arrows and toolbar are replaced by this static
          header: driver, RODS date and certification status as plain text. */}
      <header className="hidden print:block">
        <p className="text-page-title text-text">Hours of Service · Driver log</p>
        <p className="text-page-sub text-text-muted">{headerSubtitle}</p>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-body text-text">
          <div className="flex gap-1">
            <dt className="text-text-muted">Driver:</dt>
            <dd className="font-medium">{driverName || EMPTY.dash}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-text-muted">Date:</dt>
            <dd className="tabular font-medium">{`${dateLabel} · all times ${zone}`}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-text-muted">Certification:</dt>
            <dd className="font-medium">
              {certification ? certificationLabel(certification) : EMPTY.dash}
            </dd>
          </div>
        </dl>
      </header>

      {/* control row — interactive only, dropped from the printout */}
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide="">
        <div className="flex flex-wrap items-center gap-3">
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
            {/* QA FE-013 — the calendar was decorative; it now opens the native date picker. */}
            <span className="relative flex items-center">
              <button
                type="button"
                aria-label={`Pick a date, ${dateLabel}`}
                onClick={() => {
                  const input = datePickerRef.current;
                  if (!input) return;
                  try {
                    input.showPicker();
                  } catch {
                    input.focus();
                  }
                }}
                className="flex h-8 items-center gap-2 rounded-md px-1 hover:bg-bg-subtle"
              >
                <Calendar size={16} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
                <span className="tabular text-body font-medium text-text">{dateLabel}</span>
              </button>
              <input
                ref={datePickerRef}
                type="date"
                aria-label="Log date"
                tabIndex={-1}
                value={date}
                max={todayKey}
                onChange={(event) => {
                  if (event.target.value) setParam({ date: event.target.value });
                }}
                className="pointer-events-none absolute bottom-0 left-0 size-px opacity-0"
              />
            </span>
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
            <Badge
              tone={certification.certified ? 'success' : certification.recertificationRequired ? 'danger' : 'warning'}
              dot
            >
              {certificationLabel(certification)}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Can perm="hosEdit" level="FULL">
            <Button
              variant="secondary"
              disabled={!queryDriverId || notFound}
              onClick={() => {
                setEditTarget(editableEvent);
                setEditPrefill(null);
                setEditOpen(true);
              }}
            >
              <Plus size={16} strokeWidth={1.75} />
              Add / edit event
            </Button>
          </Can>
          <Button
            variant="secondary"
            disabled={!queryDriverId || notFound}
            title={PRINT_LOG_HINT}
            onClick={() => printRegion(printRef.current)}
          >
            <Upload size={16} strokeWidth={1.75} />
            Export PDF
          </Button>
          <Can perm="reportsTransfer" level="FULL">
            <Button variant="primary" disabled={!queryDriverId || notFound} onClick={() =>
                // WD-037 — 11.14 lives in features/reports; the URL is the seam (no cross-feature import).
                navigate(`/reports/fmcsa?${new URLSearchParams({ transfer: '1', driverId, date }).toString()}`)
              }>
              <FileText size={16} strokeWidth={1.75} />
              Send to inspector
            </Button>
          </Can>
        </div>
      </div>

      {notFound ? (
        <Card>
          <EmptyState
            title="Driver not found"
            description="This driver does not exist or was deleted. Pick another driver above."
          />
        </Card>
      ) : !driverId ? (
        <Card>
          <EmptyState title={EMPTY_STATE_COPY.hosLogsNoDriver.title} />
        </Card>
      ) : (
        <>
          {/* ⭐ 24-hour graph grid */}
          <Card className="print:break-inside-avoid print:shadow-none">
            <SectionHeader
              title="24-hour graph grid"
              subtitle={recordedBySubtitle(day?.recordedBy, zone)}
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
              ) : !day || !dayIsUsable ? (
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
                    ongoingViolations={day.ongoingViolations}
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
          <div className="grid grid-cols-1 gap-card-gap lg:grid-cols-3 print:grid-cols-3 print:break-inside-avoid [&>*]:min-w-0 [&>*]:print:shadow-none">
            <AvailableHoursCard driverId={driverId} />
            <ViolationsCard
              driverId={driverId}
              date={date}
              timezone={timezone}
              violations={day?.violations ?? []}
              ongoing={day?.ongoingViolations ?? []}
              openTotal={openViolationsQuery.data?.total}
              isLoading={!day && (dayQuery.isLoading || !queryDriverId)}
              isError={(dayQuery.isError && !day) || Boolean(day && !dayIsUsable)}
            />
            <CertificationCard
              days={rangeQuery.data?.days ?? []}
              isLoading={rangeQuery.isLoading}
              // F3-03 — a failed background refetch keeps the loaded days on screen.
              isError={rangeQuery.isError && !rangeQuery.data}
              onRetry={() => void rangeQuery.refetch()}
              onSelectDate={(next) => setParam({ date: next })}
              reminderNote={certificationNote(rangeQuery.data?.days ?? [], timezone)}
            />
          </div>

          <LogEventsCard
            events={events}
            dayLabel={dayPhrase(date, todayKey)}
            // Only the dedicated records endpoint resolves the record in force at 00:00.
            carriedIn={rawEvents ? (eventsQuery.data?.carriedIn ?? null) : null}
            timezone={timezone}
            isLoading={eventsQuery.isLoading}
            isError={eventsQuery.isError && !eventsQuery.data}
            onRetry={() => void eventsQuery.refetch()}
            showAllRecords={showAllRecords}
            onToggleShowAll={setShowAllRecords}
            // WB-065 — only genuinely proposed records (recordStatus = 3) are pending review; an
            // accepted driver edit (status 1, origin 2) is already applied and never counted here.
            pendingEditCount={pendingEditCount}
            highlightedEventId={highlightedEventId}
            onRequestEdit={(event) => {
              setEditTarget(event);
              setEditPrefill(null);
              setEditOpen(true);
            }}
            // D-163 — an inert record cannot be edited; it is re-entered as a new proposal (B-72).
            onReenter={(event) => {
              setEditTarget(null);
              setEditPrefill(event);
              setEditOpen(true);
            }}
            review={{
              active: reviewOnly,
              onToggle: (next) => {
                const merged = new URLSearchParams(params);
                if (next) merged.set('review', REVIEW_REASON.replacedDevice);
                else merged.delete('review');
                setParams(merged, { replace: true });
              },
              count: reviewCount,
              events: reviewQuery.data?.events ?? [],
              carriedIn: reviewQuery.data?.carriedIn ?? null,
              isLoading: reviewQuery.isLoading,
              isError: reviewQuery.isError,
              onRetry: () => void reviewQuery.refetch(),
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
          prefill={editPrefill}
          graph={day?.graph ?? []}
          onClose={() => setEditOpen(false)}
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
