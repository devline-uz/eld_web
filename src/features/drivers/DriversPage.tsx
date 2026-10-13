// owner: web-vehicles-drivers — W-06 Drivers (web/tz.md §10 W-06).
// Design: web/roles and screens/admin panel/Driver roster with live HOS clocks and violations.jpg
//
// B-1 `GET /drivers/roster` shipped 2026-09-14 (server-paginated, server filters per B-55).
import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, Plus, Download, Filter, Upload, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { usePageHeader } from '@/app/layouts/Topbar';
import {
  useDriverRoster,
  useDriverRosterCounts,
  useDriverRosterWindow,
  useResetDriverPassword,
  type DriverRosterEntry,
} from '@/shared/api/drivers';
import { useQueueReport } from '@/shared/api/reports';
import { client } from '@/shared/api/client';
import { ApiError, NetworkError, formErrorMessage } from '@/shared/api/errors';
import { qkRoot } from '@/shared/api/queryKeys';
import { endpoints } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/Button';
import { Badge, DutyBadge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { HosMeter } from '@/shared/ui/HosMeter';
import { EldStaleBadge, ELD_STALE_LABEL } from '@/shared/ui/EldStale';
import { hosClockNotes } from '@/shared/format/hos';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { Card } from '@/shared/ui/Card';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { AddDriverModal } from './components/AddDriverModal';
import { AssignUnitModal } from './components/AssignUnitModal';
import { BulkMessageModal } from './components/BulkMessageModal';
import { ImportDriversModal } from './components/ImportDriversModal';
import { DriverFiltersDrawer, DriverFilterChips } from './components/DriverFiltersDrawer';
import {
  parseDriverFilters,
  writeDriverFilters,
  matchesDriverFilters,
  EMPTY_DRIVER_FILTERS,
  countActiveDriverFilters,
} from './lib/filters';
import { DRIVER_TOAST } from './lib/copy';
import { messagesHref } from '@/shared/lib/messagesHref';
import { tripsHrefForDriver } from './lib/links';

type Segment = 'ALL' | 'ON_DUTY' | 'OFF_DUTY' | 'VIOLATIONS';
const LIMIT_SEC = { drive: 39600, shift: 50400, cycle: 252000 };

/** BUG-001 — each row's own ruleset limits (adverse +2 h only on an invoked day); 70/8 property if absent. */
function rowLimits(entry: DriverRosterEntry): NonNullable<DriverRosterEntry['limits']> {
  return entry.limits ?? { driveLimitSec: LIMIT_SEC.drive, shiftLimitSec: LIMIT_SEC.shift, cycleLimitSec: LIMIT_SEC.cycle };
}

/** BUG-001 — `DRIVE LEFT · 11H` only when every row on screen shares that limit; mixed rulesets drop the suffix. */
function limitHeader(label: string, rows: DriverRosterEntry[], key: keyof NonNullable<DriverRosterEntry['limits']>): string {
  const limits = new Set(rows.map((r) => rowLimits(r)[key]));
  const [sec] = [...limits];
  return limits.size === 1 && sec !== undefined ? `${label} · ${Math.round(sec / 3600)}H` : label;
}

/** BUG-002 — a stale status (ELD connection lost) has no meaningful clock: a dash, never 00:00. */
function StaleClock() {
  return (
    <span className="tabular text-text-muted" title={`${ELD_STALE_LABEL} — clocks paused`}>
      —
    </span>
  );
}

/** `?page=abc` is `NaN` and `?page=0` / `?page=-3` are pages no server can answer — both reached
 * `GET /drivers/roster` verbatim and rendered a `NaN–NaN of 58` footer. Anything that is not a
 * positive integer falls back to the default. */
function positiveIntParam(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export default function DriversPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const canFull = can('drivers', 'FULL');

  const segment = (params.get('segment') as Segment) ?? 'ALL';
  const q = params.get('q') ?? '';
  const page = positiveIntParam(params.get('page'), 1);
  const limit = positiveIntParam(params.get('limit'), 10);


  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const filters = useMemo(() => parseDriverFilters(params), [params]);

  // QA FE-003 — the box owns its text; the URL (and the roster request) follow 250 ms after the
  // last keystroke. Driving the input straight from `?q=` dropped characters on fast typing and
  // fired two requests per key.
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  useEffect(() => {
    const next = debouncedSearch.trim();
    if (next === q) return;
    setParam('q', next || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a settled keystroke writes the URL
  }, [debouncedSearch]);
  // A `q` this box did not write (back button, a Clear elsewhere) replaces the typed text; the
  // box's own debounced write lands equal to `debouncedSearch` and leaves the text alone.
  const [syncedQ, setSyncedQ] = useState(q);
  if (syncedQ !== q) {
    setSyncedQ(q);
    if (q !== debouncedSearch.trim()) setSearchInput(q);
  }
  function clearSearch() {
    setSearchInput('');
    setParam('q', null);
  }

  // WB-103 — the duty-status `status` field, every exemption but `eldExempt`, and the ON_DUTY /
  // OFF_DUTY segment tabs have no server param on `GET /drivers/roster` (extends B-55,
  // web/backend-gaps.md): the server-filtered page cannot answer them. `VIOLATIONS` reuses the
  // real `hasOpenViolation` param instead of narrowing in memory. While one of the unsupported
  // groups is active the page switches to the reference-cached roster window
  // (`useDriverRosterWindow`) — the same trade-off `features/vehicles/lib/filters.ts` documents
  // for W-03/B-54 — instead of presenting the ~10 loaded rows as the complete filtered roster.
  const useWindow =
    segment === 'ON_DUTY' ||
    segment === 'OFF_DUTY' ||
    filters.status.length > 0 ||
    filters.exemptions.some((e) => e !== 'eldExempt');
  const serverFilters = useMemo(
    () => ({
      q: q || undefined,
      terminal: filters.terminal ?? undefined,
      hasOpenViolation: (filters.violationsOnly || segment === 'VIOLATIONS'
        ? 'true'
        : undefined) as 'true' | undefined,
      exempt: (filters.exemptions.includes('eldExempt') ? 'true' : undefined) as 'true' | undefined,
    }),
    [q, filters, segment],
  );
  const rosterQuery = useDriverRoster({ page, limit, ...serverFilters }, { enabled: !useWindow });
  const windowQuery = useDriverRosterWindow(serverFilters, useWindow);
  const entries = useMemo(
    () => (useWindow ? windowQuery.data?.items : rosterQuery.data?.items) ?? [],
    [useWindow, windowQuery.data, rosterQuery.data],
  );
  const terminalOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.driver.homeTerminalName).filter(Boolean))).sort(),
    [entries],
  );

  // Duty status still narrows in memory (no server param either way); `VIOLATIONS` is already
  // applied at the fetch layer via `hasOpenViolation` above.
  const filtered = useMemo(() => {
    let rows = entries;
    if (segment === 'ON_DUTY') rows = rows.filter((r) => r.dutyStatus !== 'OFF_DUTY');
    if (segment === 'OFF_DUTY') rows = rows.filter((r) => r.dutyStatus === 'OFF_DUTY');
    rows = rows.filter((r) => matchesDriverFilters(r, filters));
    return rows;
  }, [entries, segment, filters]);

  // The headline and the segment tabs describe the roster the tabs narrow — the whole
  // server-filtered roster, not the ~10 rows of the current server page. Counting `entries` put
  // `All 10 | On duty 8 | Off duty 2` under a `115 drivers` headline that was itself half
  // page-scoped (`total` for the first number, the page for the other two).
  // QA UI-006 — the tabs count the roster the search/drawer filters describe, independent of the
  // selected tab (clicking `Violations 1` must not turn `All` into 1); the page header counts
  // the whole fleet and never moves with a search or a tab.
  const chipFilters = useMemo(
    () => ({
      ...serverFilters,
      hasOpenViolation: (filters.violationsOnly ? 'true' : undefined) as 'true' | undefined,
    }),
    [serverFilters, filters.violationsOnly],
  );
  const counts = useDriverRosterCounts(chipFilters);
  const fleetCounts = useDriverRosterCounts();

  // Server mode: the roster page and its `total`/`totalPages` already describe the whole
  // server-filtered roster. Window mode: `filtered` is every match inside the reference-cached
  // window, paged in memory — honest against the window (its size is recorded per gap), not
  // against only the rows that happened to be on screen.
  const totalPages = useWindow
    ? Math.max(1, Math.ceil(filtered.length / limit))
    : Math.max(1, rosterQuery.data?.totalPages ?? 1);
  const shownPage = Math.min(page, totalPages);
  const pageTotal = useWindow ? filtered.length : (rosterQuery.data?.total ?? filtered.length);
  const pageRows = useWindow
    ? filtered.slice((shownPage - 1) * limit, shownPage * limit)
    : filtered;

  // A `page` past the end of the roster (a bookmark, the back button, or drivers deactivated since
  // the link was made) came back with no items at all — the card then showed the "No drivers yet"
  // empty state over a full roster. Snap back to the last page that exists.
  useEffect(() => {
    const dataReady = useWindow ? Boolean(windowQuery.data) : Boolean(rosterQuery.data);
    if (!dataReady || page <= totalPages) return;
    setParam('page', String(totalPages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages, useWindow, rosterQuery.data, windowQuery.data]);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [assignUnitTarget, setAssignUnitTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [bulkMessageIds, setBulkMessageIds] = useState<string[] | null>(null);
  const [deactivateTargets, setDeactivateTargets] = useState<string[] | null>(null);

  const queryClient = useQueryClient();
  const queueReport = useQueueReport();

  function applyFilters(next: typeof filters) {
    setParams(writeDriverFilters(params, next), { replace: true });
  }

  async function handleExport() {
    // WB-181 — the download used to reject into an unhandled promise: a failing
    // `GET /drivers/export` left the button silent and the user with no file and no reason.
    if (exporting) return;
    setExporting(true);
    try {
      const data = await client.get(endpoints.drivers.export);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'drivers-export.json';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({
        kind: 'error',
        title: formErrorMessage(error),
      });
    } finally {
      setExporting(false);
    }
  }

  /** The §395.8 retention window the roadside inspector asks for: today and the previous 7 days. */
  function rodsRange(): { from: string; to: string } {
    const now = new Date();
    return {
      from: new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }

  // WB-182 — `Export 8-day RODS` and the bulk `Export logs` used to fire a success toast and make
  // no request at all. Both now queue the real FMCSA pack job (`GET /reports/fmcsa-pack`, the same
  // shortcut W-15 uses) per driver; there is no bulk report endpoint, so a multi-row selection fans
  // out and `allSettled` reports a partial failure honestly.
  const exportRodsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { from, to } = rodsRange();
      const results = await Promise.allSettled(
        ids.map((driverId) =>
          queueReport.mutateAsync({ kind: 'fmcsaPack', params: { from, to, driverId } }),
        ),
      );
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      return {
        total: ids.length,
        succeeded: ids.length - rejected.length,
        firstError: rejected[0]?.reason as unknown,
      };
    },
    onSuccess: ({ total, succeeded, firstError }) => {
      if (succeeded === total) {
        toast({ kind: 'success', ...DRIVER_TOAST.rodsExportQueued(succeeded) });
        return;
      }
      toast({
        kind: 'error',
        ...DRIVER_TOAST.rodsExportFailed(total - succeeded, total),
        description:
          firstError instanceof ApiError || firstError instanceof NetworkError
            ? formErrorMessage(firstError)
            : DRIVER_TOAST.rodsExportFailed(total - succeeded, total).description,
      });
    },
    onError: (error) =>
      toast({
        kind: 'error',
        title: formErrorMessage(error),
      }),
  });

  // WB-183 — `Deactivate driver` (row menu) and the bulk `Deactivate` had no handler at all. There
  // is no bulk driver-status endpoint (gap B-71's driver twin), so this fans out
  // `PATCH /drivers/:id { status: 'INACTIVE' }`, one request per driver, and never claims more than
  // the server confirmed.
  const deactivateMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => client.patch(endpoints.drivers.update(id), { status: 'INACTIVE' })),
      );
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      return {
        total: ids.length,
        succeeded: ids.length - rejected.length,
        firstError: rejected[0]?.reason as unknown,
      };
    },
    onSuccess: ({ total, succeeded, firstError }) => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.drivers });
      setDeactivateTargets(null);
      if (succeeded > 0) setSelection([]);
      if (succeeded === total) {
        toast({ kind: 'success', ...DRIVER_TOAST.driversDeactivated(succeeded) });
        return;
      }
      toast({
        kind: 'error',
        ...DRIVER_TOAST.driversDeactivateFailed(total - succeeded, total),
        description:
          firstError instanceof ApiError || firstError instanceof NetworkError
            ? formErrorMessage(firstError)
            : DRIVER_TOAST.driversDeactivateFailed(total - succeeded, total).description,
      });
    },
    onError: (error) => {
      setDeactivateTargets(null);
      toast({
        kind: 'error',
        title: formErrorMessage(error),
      });
    },
  });

  // B-81 shipped — `POST /drivers/:id/reset-password`, `drivers` FULL, audited.
  const resetPassword = useResetDriverPassword();
  function runResetPassword(driverId: string) {
    if (resetPassword.isPending) return;
    resetPassword.mutate(driverId, {
      onSuccess: (result) => toast({ kind: 'success', ...DRIVER_TOAST.passwordReset(result) }),
      onError: (error) =>
        toast({
          kind: 'error',
          title: formErrorMessage(error),
        }),
    });
  }

  const canExportRods = can('reportsTransfer');
  const canBroadcast = can('messaging', 'FULL');

  const columns: ColumnDef<DriverRosterEntry, unknown>[] = [
    {
      id: 'driver',
      header: 'DRIVER',
      cell: ({ row }) => {
        const d = row.original.driver;
        const name = `${d.firstName} ${d.lastName}`;
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} size="md" />
            <span>
              <span className="flex items-center gap-1.5 whitespace-nowrap text-body-strong text-text">
                {name}
                {row.original.emailVerified === false && (
                  <Badge tone="warning" dot className="whitespace-nowrap">
                    Email not verified
                  </Badge>
                )}
              </span>
              <span className="block text-caption text-text-muted">
                @{d.username}
                {d.appVersion ? ` · ${d.appVersion}` : ''}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'STATUS',
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-1">
          <DutyBadge status={row.original.dutyStatus} className="whitespace-nowrap" />
          {row.original.isStale && <EldStaleBadge className="whitespace-nowrap" />}
        </span>
      ),
    },
    {
      id: 'unit',
      header: 'UNIT',
      cell: ({ row }) => <span className="text-text">{row.original.unit?.unitNumber ?? '—'}</span>,
    },
    {
      id: 'driveLeft',
      header: limitHeader('DRIVE LEFT', pageRows, 'driveLimitSec'),
      cell: ({ row }) =>
        row.original.isStale ? (
          <StaleClock />
        ) : (
          <HosMeter
            label=""
            remainingSec={row.original.hos.driveRemainingSec}
            limitSec={rowLimits(row.original).driveLimitSec}
            zeroNote={hosClockNotes({ dutyStatus: row.original.dutyStatus, ...row.original.hos }).drive}
          />
        ),
    },
    {
      id: 'shiftLeft',
      header: limitHeader('SHIFT LEFT', pageRows, 'shiftLimitSec'),
      cell: ({ row }) =>
        row.original.isStale ? (
          <StaleClock />
        ) : (
          <HosMeter
            label=""
            remainingSec={row.original.hos.shiftRemainingSec}
            limitSec={rowLimits(row.original).shiftLimitSec}
            zeroNote={hosClockNotes({ dutyStatus: row.original.dutyStatus, ...row.original.hos }).shift}
          />
        ),
    },
    {
      id: 'cycleLeft',
      header: limitHeader('CYCLE LEFT', pageRows, 'cycleLimitSec'),
      cell: ({ row }) =>
        row.original.isStale ? (
          <StaleClock />
        ) : (
          <HosMeter
            label=""
            remainingSec={row.original.hos.cycleRemainingSec}
            limitSec={rowLimits(row.original).cycleLimitSec}
            zeroNote={hosClockNotes({ dutyStatus: row.original.dutyStatus, ...row.original.hos }).cycle}
          />
        ),
    },
    {
      id: 'violations',
      header: 'VIOLATIONS',
      cell: ({ row }) =>
        row.original.openViolations > 0 ? (
          <Badge tone="danger">{row.original.openViolations} open</Badge>
        ) : (
          <Badge tone="success">None</Badge>
        ),
    },
    {
      id: 'terminal',
      header: 'HOME TERMINAL',
      cell: ({ row }) => (
        <span className="text-text-secondary">{row.original.driver.homeTerminalName}</span>
      ),
    },
    {
      id: 'logs',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/hos-logs?driverId=${row.original.driver.id}`);
          }}
        >
          Logs
        </Button>
      ),
    },
  ];

  const isLoading = useWindow ? windowQuery.isLoading : rosterQuery.isLoading;
  const isError = useWindow ? windowQuery.isError : rosterQuery.isError;
  const refetch = () => (useWindow ? windowQuery.refetch() : rosterQuery.refetch());

  usePageHeader({
    title: 'Drivers',
    subtitle: `${fleetCounts.all} ${fleetCounts.all === 1 ? 'driver' : 'drivers'} · ${fleetCounts.onDuty} on duty · ${fleetCounts.violations} with active violations`,
  });

  return (
    <div className="flex flex-col gap-4 xl:max-h-content-h">
      <div className="flex items-center justify-end xl:shrink-0">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex h-input w-full items-center gap-2 rounded-md border border-border bg-bg-surface px-3 sm:w-auto">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={searchInput}
              aria-label="Search drivers"
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchInput) clearSearch();
              }}
              placeholder="Search driver, username…"
              className="w-full min-w-0 bg-transparent text-body outline-none sm:w-56"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clearSearch}
                className="flex size-5 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle hover:text-text"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
          <Button
            variant="secondary"
            iconLeft={<Filter size={16} strokeWidth={1.75} />}
            onClick={() => {
              setFiltersRevision((r) => r + 1);
              setFiltersOpen(true);
            }}
          >
            Filters
            {countActiveDriverFilters(filters) > 0 ? ` · ${countActiveDriverFilters(filters)}` : ''}
          </Button>
          <Button
            variant="secondary"
            className="sm:w-btn-wide"
            iconLeft={<Upload size={16} strokeWidth={1.75} />}
            loading={exporting}
            disabled={exporting}
            onClick={handleExport}
          >
            Export Drivers
          </Button>
          <Can perm="drivers" level="FULL">
            <Button
              variant="secondary"
              className="sm:w-btn-wide"
              iconLeft={<Download size={16} strokeWidth={1.75} />}
              onClick={() => setImportOpen(true)}
            >
              Import Drivers
            </Button>
            <Button
              variant="primary"
              className="sm:w-btn-add"
              iconLeft={<Plus size={16} strokeWidth={1.75} />}
              onClick={() => setAddOpen(true)}
            >
              Add driver
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex h-9 w-fit max-w-full overflow-x-auto rounded-md border border-border xl:shrink-0">
        {(
          [
            ['ALL', `All ${counts.all}`],
            ['ON_DUTY', `On duty ${counts.onDuty}`],
            ['OFF_DUTY', `Off duty ${counts.offDuty}`],
            ['VIOLATIONS', `Violations ${counts.violations}`],
          ] as [Segment, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={segment === value}
            onClick={() => setParam('segment', value === 'ALL' ? null : value)}
            className={
              segment === value
                ? 'shrink-0 whitespace-nowrap bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : 'shrink-0 whitespace-nowrap bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="xl:shrink-0">
        <DriverFilterChips
          filters={filters}
          onRemove={(patch) => applyFilters({ ...filters, ...patch })}
          onClearAll={() => applyFilters(EMPTY_DRIVER_FILTERS)}
        />
      </div>

      <Card padded={false} className="xl:flex xl:min-h-0 xl:flex-col">
        {isLoading ? (
          <LoadingState className="p-4" />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : filtered.length === 0 ? (
          q || countActiveDriverFilters(filters) > 0 ? (
            <EmptyState
              {...searchEmptyState(q || 'these filters')}
              actions={[
                {
                  label: q ? 'Clear search' : 'Clear filters',
                  onClick: () => (q ? clearSearch() : applyFilters(EMPTY_DRIVER_FILTERS)),
                },
              ]}
            />
          ) : (
            <EmptyState
              {...EMPTY_STATE_COPY.drivers}
              actions={
                canFull
                  ? [
                      {
                        label: 'Import CSV',
                        variant: 'secondary',
                        onClick: () => setImportOpen(true),
                      },
                      { label: 'Add driver', onClick: () => setAddOpen(true) },
                    ]
                  : undefined
              }
            />
          )
        ) : (
          <>
            {/* Desktop only (xl:): the results list scrolls inside the card so the page itself
                never grows past the viewport — same pattern as Vehicles. */}
            <div className="xl:min-h-0 xl:overflow-y-auto">
              <DataTable
                data={pageRows}
                columns={columns}
                caption="Drivers"
                getRowId={(r) => r.driver.id}
                selectable={canFull}
                selection={selection}
                onSelectionChange={setSelection}
                onRowClick={(row) => navigate(`/drivers/${row.driver.id}`)}
                rowActions={
                  canFull
                    ? (row) => (
                        <>
                          <DropdownMenu.Item
                            onSelect={() => navigate(`/drivers/${row.driver.id}`)}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                          >
                            View driver profile
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onSelect={() => navigate(`/hos-logs?driverId=${row.driver.id}`)}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                          >
                            Open HOS logs
                          </DropdownMenu.Item>
                          <Can perm="messaging">
                            <DropdownMenu.Item
                              onSelect={() => navigate(messagesHref(row.driver.id))}
                              className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                            >
                              Send message
                            </DropdownMenu.Item>
                          </Can>
                          <Can perm="trips" level="FULL">
                            <DropdownMenu.Item
                              onSelect={() => navigate(tripsHrefForDriver(row.driver.id))}
                              className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                            >
                              Assign trip
                            </DropdownMenu.Item>
                          </Can>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <p className="px-2 py-1 text-caption font-semibold uppercase tracking-wide text-text-muted">
                            Compliance
                          </p>
                          <Can perm="hosEdit" level="FULL">
                            <DropdownMenu.Item
                              onSelect={() => navigate(`/hos-logs?driverId=${row.driver.id}`)}
                              className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                            >
                              Request log edit
                            </DropdownMenu.Item>
                          </Can>
                          <Can perm="hosCertifyOnBehalf" level="FULL">
                            <DropdownMenu.Item
                              onSelect={() => navigate(`/hos-logs?driverId=${row.driver.id}`)}
                              className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                            >
                              Certify on behalf
                            </DropdownMenu.Item>
                          </Can>
                          <Can perm="reportsTransfer">
                            <DropdownMenu.Item
                              onSelect={() => exportRodsMutation.mutate([row.driver.id])}
                              className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                            >
                              Export 8-day RODS
                            </DropdownMenu.Item>
                          </Can>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Item
                            onSelect={() => runResetPassword(row.driver.id)}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                          >
                            Reset app password
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onSelect={() => setDeactivateTargets([row.driver.id])}
                            className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                          >
                            Deactivate driver
                          </DropdownMenu.Item>
                        </>
                      )
                    : undefined
                }
              />
            </div>
            <Pagination
              page={shownPage}
              limit={limit}
              total={pageTotal}
              totalPages={totalPages}
              itemLabel="drivers"
              onPageChange={(p) => setParam('page', String(p))}
              onLimitChange={(l) => setParam('limit', String(l))}
            />
          </>
        )}
      </Card>

      {selection.length > 0 && canFull && (
        <div className="fixed inset-x-4 bottom-6 z-30 mx-auto flex min-h-14 w-fit flex-wrap items-center gap-3 py-2 sm:inset-x-0 sm:h-14 sm:min-w-bulk-bar sm:flex-nowrap sm:py-0 rounded-lg bg-bg-inverse px-4 shadow-pop">
          <span className="text-body-strong text-text-inverse">
            {selection.length} drivers selected
          </span>
          {/* WB-184 — all four buttons used to have no `onClick` whatsoever. A unit carries exactly
              one driver (`POST /vehicles/:id/assign-driver` moves the link), so `Assign unit` is a
              single-row action and says so instead of pretending to fan out. */}
          <Button
            variant="ghost"
            className="text-text-inverse hover:bg-white/10"
            disabled={selection.length !== 1}
            onClick={() => {
              const id = selection[0];
              const entry = entries.find((e) => e.driver.id === id);
              if (!id) return;
              setAssignUnitTarget({
                id,
                name: entry ? `${entry.driver.firstName} ${entry.driver.lastName}` : 'This driver',
              });
            }}
          >
            Assign unit
          </Button>
          {selection.length !== 1 && (
            <span className="text-caption text-text-inverse/70">
              A unit takes one driver — select a single row.
            </span>
          )}
          {canBroadcast && (
            <Button
              variant="ghost"
              className="text-text-inverse hover:bg-white/10"
              onClick={() => {
                if (selection.length === 1 && selection[0]) {
                  navigate(messagesHref(selection[0]));
                  return;
                }
                setBulkMessageIds(selection);
              }}
            >
              Send message
            </Button>
          )}
          {canExportRods && (
            <Button
              variant="ghost"
              className="text-text-inverse hover:bg-white/10"
              loading={exportRodsMutation.isPending}
              onClick={() => exportRodsMutation.mutate(selection)}
            >
              Export logs
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-text-inverse hover:bg-white/10"
            loading={deactivateMutation.isPending}
            onClick={() => setDeactivateTargets(selection)}
          >
            Deactivate
          </Button>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setSelection([])}
            className="ml-auto text-text-inverse"
          >
            ×
          </button>
        </div>
      )}

      {assignUnitTarget && (
        <AssignUnitModal
          driverId={assignUnitTarget.id}
          driverName={assignUnitTarget.name}
          onClose={() => setAssignUnitTarget(null)}
          onAssigned={() => setSelection([])}
        />
      )}
      {bulkMessageIds && bulkMessageIds.length > 0 && (
        <BulkMessageModal
          driverIds={bulkMessageIds}
          onClose={() => setBulkMessageIds(null)}
          onSent={() => setSelection([])}
        />
      )}
      <ConfirmDelete
        open={Boolean(deactivateTargets && deactivateTargets.length > 0)}
        onClose={() => setDeactivateTargets(null)}
        onConfirm={() => deactivateTargets && deactivateMutation.mutate(deactivateTargets)}
        title={
          deactivateTargets && deactivateTargets.length > 1
            ? `Deactivate ${deactivateTargets.length} drivers?`
            : 'Deactivate this driver?'
        }
        description="They can no longer sign in to the mobile app. Their logs, DVIRs and certifications stay available for audits."
        confirmLabel="Deactivate"
        loading={deactivateMutation.isPending}
      />

      {addOpen && <AddDriverModal onClose={() => setAddOpen(false)} />}
      {importOpen && <ImportDriversModal onClose={() => setImportOpen(false)} />}
      <DriverFiltersDrawer
        key={filtersRevision}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
        terminalOptions={terminalOptions}
      />
    </div>
  );
}
