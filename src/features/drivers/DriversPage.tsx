// owner: web-vehicles-drivers — W-06 Drivers (web/tz.md §10 W-06).
// Design: web/roles and screens/admin panel/Driver roster with live HOS clocks and violations.jpg
//
// B-1 `GET /drivers/roster` shipped 2026-09-14 (server-paginated, server filters per B-55).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, Plus, Download, Filter, Upload } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { useDriverRoster, useDriverRosterCounts, type DriverRosterEntry } from '@/shared/api/drivers';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/Button';
import { Badge, DutyBadge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { HosMeter } from '@/shared/ui/HosMeter';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { AddDriverModal } from './components/AddDriverModal';
import { ImportDriversModal } from './components/ImportDriversModal';
import { DriverFiltersDrawer, DriverFilterChips } from './components/DriverFiltersDrawer';
import { parseDriverFilters, writeDriverFilters, matchesDriverFilters, EMPTY_DRIVER_FILTERS, countActiveDriverFilters } from './lib/filters';

type Segment = 'ALL' | 'ON_DUTY' | 'OFF_DUTY' | 'VIOLATIONS';
const LIMIT_SEC = { drive: 39600, shift: 50400, cycle: 252000 };

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

  useDynamicSubtitle(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const filters = useMemo(() => parseDriverFilters(params), [params]);
  // The roster is server-paginated: filters the backend supports (B-55) go to the server so they
  // apply to every driver, not only the loaded page. The client-side match below stays as-is.
  const serverFilters = useMemo(
    () => ({
      q: q || undefined,
      terminal: filters.terminal ?? undefined,
      hasOpenViolation: (filters.violationsOnly ? 'true' : undefined) as 'true' | undefined,
      exempt: (filters.exemptions.includes('eldExempt') ? 'true' : undefined) as 'true' | undefined,
    }),
    [q, filters],
  );
  const rosterQuery = useDriverRoster({ page, limit, ...serverFilters });
  const entries = useMemo(() => rosterQuery.data?.items ?? [], [rosterQuery.data]);
  const terminalOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.driver.homeTerminalName).filter(Boolean))).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    let rows = entries;
    if (segment === 'ON_DUTY') rows = rows.filter((r) => r.dutyStatus !== 'OFF_DUTY');
    if (segment === 'OFF_DUTY') rows = rows.filter((r) => r.dutyStatus === 'OFF_DUTY');
    if (segment === 'VIOLATIONS') rows = rows.filter((r) => r.openViolations > 0);
    rows = rows.filter((r) => matchesDriverFilters(r, filters));
    return rows;
  }, [entries, segment, filters]);

  // The headline and the segment tabs describe the roster the tabs narrow — the whole
  // server-filtered roster, not the ~10 rows of the current server page. Counting `entries` put
  // `All 10 | On duty 8 | Off duty 2` under a `115 drivers` headline that was itself half
  // page-scoped (`total` for the first number, the page for the other two).
  const counts = useDriverRosterCounts(serverFilters);

  // The segment tabs and the 11.23 groups the roster API has no params for (B-55) narrow the
  // *current server page* in memory, so the server's `total`/`totalPages` describe a different set
  // than the table renders: picking `Off duty` left 3 rows on screen under a `1–10 of 58 drivers`
  // footer that offered 6 pages, each one re-filtering a different slice. While an in-memory
  // narrowing is in effect the footer counts exactly the rows that are on screen.
  const clientNarrowed = filtered.length !== entries.length;
  const serverLastPage = Math.max(1, rosterQuery.data?.totalPages ?? 1);
  const pageTotal = clientNarrowed ? filtered.length : (rosterQuery.data?.total ?? filtered.length);
  const pageTotalPages = clientNarrowed ? 1 : serverLastPage;
  const shownPage = clientNarrowed ? 1 : Math.min(page, serverLastPage);

  // A `page` past the end of the roster (a bookmark, the back button, or drivers deactivated since
  // the link was made) came back with no items at all — the card then showed the "No drivers yet"
  // empty state over a full roster. Snap back to the last page that exists.
  useEffect(() => {
    if (!rosterQuery.data || page <= serverLastPage) return;
    setParam('page', String(serverLastPage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, serverLastPage, rosterQuery.data]);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersRevision, setFiltersRevision] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);

  function applyFilters(next: typeof filters) {
    setParams(writeDriverFilters(params, next), { replace: true });
  }

  async function handleExport() {
    const data = await client.get(endpoints.drivers.export);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'drivers-export.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

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
              <span className="flex items-center gap-1.5 text-body-strong text-text">
                {name}
                {row.original.emailVerified === false && (
                  <Badge tone="warning" dot>
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
    { id: 'status', header: 'STATUS', cell: ({ row }) => <DutyBadge status={row.original.dutyStatus} /> },
    { id: 'unit', header: 'UNIT', cell: ({ row }) => <span className="text-text">{row.original.unit?.unitNumber ?? '—'}</span> },
    {
      id: 'driveLeft',
      header: 'DRIVE LEFT · 11H',
      cell: ({ row }) => <HosMeter label="" remainingSec={row.original.hos.driveRemainingSec} limitSec={LIMIT_SEC.drive} />,
    },
    {
      id: 'shiftLeft',
      header: 'SHIFT LEFT · 14H',
      cell: ({ row }) => <HosMeter label="" remainingSec={row.original.hos.shiftRemainingSec} limitSec={LIMIT_SEC.shift} />,
    },
    {
      id: 'cycleLeft',
      header: 'CYCLE LEFT · 70H',
      cell: ({ row }) => <HosMeter label="" remainingSec={row.original.hos.cycleRemainingSec} limitSec={LIMIT_SEC.cycle} />,
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
    { id: 'terminal', header: 'HOME TERMINAL', cell: ({ row }) => <span className="text-text-secondary">{row.original.driver.homeTerminalName}</span> },
    {
      id: 'logs',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/hos-logs?driverId=${row.original.driver.id}`); }}>
          Logs
        </Button>
      ),
    },
  ];

  const isLoading = rosterQuery.isLoading;

  return (
    <div className="flex flex-col gap-4 xl:max-h-content-h">
      <div className="flex items-center justify-between xl:shrink-0">
        <div>
          <h1 className="text-page-title text-text">Drivers</h1>
          <p className="text-page-sub text-text-muted">
            {counts.all} drivers · {counts.onDuty} on duty · {counts.violations} with active violations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={q}
              onChange={(e) => setParam('q', e.target.value || null)}
              placeholder="Search driver, username…"
              className="w-56 bg-transparent text-body outline-none"
            />
          </div>
          <Button
            variant="secondary"
            iconLeft={<Filter size={16} strokeWidth={1.75} />}
            onClick={() => {
              setFiltersRevision((r) => r + 1);
              setFiltersOpen(true);
            }}
          >
            Filters{countActiveDriverFilters(filters) > 0 ? ` · ${countActiveDriverFilters(filters)}` : ''}
          </Button>
          <Can perm="drivers" level="FULL">
            <Button variant="secondary" iconLeft={<Upload size={16} strokeWidth={1.75} />} onClick={() => setImportOpen(true)}>
              Import
            </Button>
          </Can>
          <Button variant="secondary" iconLeft={<Download size={16} strokeWidth={1.75} />} onClick={handleExport}>
            Export
          </Button>
          <Can perm="drivers" level="FULL">
            <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setAddOpen(true)}>
              Add driver
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border xl:shrink-0">
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
                ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse'
                : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
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
        ) : rosterQuery.isError ? (
          <ErrorState onRetry={() => rosterQuery.refetch()} />
        ) : filtered.length === 0 ? (
          q || countActiveDriverFilters(filters) > 0 ? (
            <EmptyState
              {...searchEmptyState(q || 'these filters')}
              actions={[
                {
                  label: q ? 'Clear search' : 'Clear filters',
                  onClick: () => (q ? setParam('q', null) : applyFilters(EMPTY_DRIVER_FILTERS)),
                },
              ]}
            />
          ) : (
            <EmptyState
              {...EMPTY_STATE_COPY.drivers}
              actions={
                canFull
                  ? [
                      { label: 'Import CSV', variant: 'secondary', onClick: () => setImportOpen(true) },
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
                data={filtered}
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
                          <DropdownMenu.Item onSelect={() => navigate(`/drivers/${row.driver.id}`)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            View driver profile
                          </DropdownMenu.Item>
                          <DropdownMenu.Item onSelect={() => navigate(`/hos-logs?driverId=${row.driver.id}`)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Open HOS logs
                          </DropdownMenu.Item>
                          <Can perm="messaging">
                            <DropdownMenu.Item onSelect={() => navigate('/messages')} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                              Send message
                            </DropdownMenu.Item>
                          </Can>
                          <Can perm="trips" level="FULL">
                            <DropdownMenu.Item onSelect={() => navigate('/trips')} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                              Assign trip
                            </DropdownMenu.Item>
                          </Can>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <p className="px-2 py-1 text-caption font-semibold uppercase tracking-wide text-text-muted">Compliance</p>
                          <Can perm="hosEdit" level="FULL">
                            <DropdownMenu.Item onSelect={() => navigate(`/hos-logs?driverId=${row.driver.id}`)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                              Request log edit
                            </DropdownMenu.Item>
                          </Can>
                          <Can perm="hosCertifyOnBehalf" level="FULL">
                            <DropdownMenu.Item onSelect={() => navigate(`/hos-logs?driverId=${row.driver.id}`)} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                              Certify on behalf
                            </DropdownMenu.Item>
                          </Can>
                          <DropdownMenu.Item onSelect={() => toast({ kind: 'success', title: 'Export started' })} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Export 8-day RODS
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Item onSelect={() => toast({ kind: 'success', title: 'Password reset' })} className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">
                            Reset app password
                          </DropdownMenu.Item>
                          <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft">
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
              totalPages={pageTotalPages}
              itemLabel="drivers"
              onPageChange={(p) => setParam('page', String(p))}
              onLimitChange={(l) => setParam('limit', String(l))}
            />
          </>
        )}
      </Card>

      {selection.length > 0 && canFull && (
        <div className="fixed inset-x-0 bottom-6 z-30 mx-auto flex h-14 w-fit min-w-bulk-bar items-center gap-3 rounded-lg bg-bg-inverse px-4 shadow-pop">
          <span className="text-body-strong text-text-inverse">{selection.length} drivers selected</span>
          <Button variant="ghost" className="text-text-inverse hover:bg-white/10">
            Assign unit
          </Button>
          <Button variant="ghost" className="text-text-inverse hover:bg-white/10">
            Send message
          </Button>
          <Button variant="ghost" className="text-text-inverse hover:bg-white/10">
            Export logs
          </Button>
          <Button variant="ghost" className="text-text-inverse hover:bg-white/10">
            Deactivate
          </Button>
          <button type="button" aria-label="Clear selection" onClick={() => setSelection([])} className="ml-auto text-text-inverse">
            ×
          </button>
        </div>
      )}

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
