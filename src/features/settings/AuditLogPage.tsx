// owner: web-settings-admin — W-23 Settings · Audit log (web/tz.md §10 W-23).
// Design: web/roles and screens/admin panel/Settings — immutable audit trail.jpg
// Server cursor-paginated (web/backend-gaps.md — `GET /audit-log` answers `{ items, nextCursor }`,
// not an offset envelope); virtualised only above 500 rows in a single loaded window; timestamps
// render in the carrier's own timezone (§8.3).
import { useMemo, useState } from 'react';
import { endOfDay, startOfDay } from 'date-fns';
import { useQueries } from '@tanstack/react-query';
import { Search, Download, Filter } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { Button } from '@/shared/ui/Button';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { Drawer } from '@/shared/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { formatCarrier } from '@/shared/format/datetime';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { typedCachePolicy } from '@/shared/api/queryPolicy';
import { useCarrier, useUsersList, type AuditEntry } from '@/shared/api/settingsAdmin';
import { DateRangePicker, resolvePreset, type DateRange, type DateRangePreset } from '@/shared/ui/DateRangePicker';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';

const ACTION_TONE: Record<string, BadgeTone> = { CREATE: 'success', UPDATE: 'info', DELETE: 'danger', VIEW: 'neutral' };
const ACTION_LABEL: Record<string, string> = { CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted', VIEW: 'Viewed' };
const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VIEW'] as const;

type AuditPage = { items: AuditEntry[]; nextCursor: string | null };

const startOfDayMs = (d: Date) => startOfDay(d).getTime();
const endOfDayMs = (d: Date) => endOfDay(d).getTime();

// Known object types the design's own row examples name (§10 W-23) — the real, useful set to
// pick from before any entries have loaded; the drawer also folds in whatever else shows up in
// the currently loaded pages so a carrier-specific object type is never hidden.
const KNOWN_OBJECT_TYPES = ['Driver', 'Vehicle', 'Trip', 'WorkOrder', 'Role', 'User', 'Report'];

export default function AuditLogPage() {
  const carrierQuery = useCarrier();
  const timezone = carrierQuery.data?.timezone ?? 'UTC';
  const usersQuery = useUsersList();

  const [search, setSearch] = useState('');
  // WB-043 — the filter row §10 W-23 draws: `All users ▾` (`actorId` IS a real server-side param
  // on `GET /audit-log`, web/backend-gaps.md — `objectType`/`objectId`/`actorId` only) · `All
  // actions ▾` and the `Last 30 days ▾` date range (both gap B-64 — no server support, filtered
  // over the already-loaded window only, same limitation `search` already has) · `Filters`
  // (opens the drawer for `Object type`, the other server-supported param).
  const [actorId, setActorId] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>(() => resolvePreset('last30'));
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last30');
  const [objectType, setObjectType] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Server cursor pagination (web/backend-gaps.md — `{ items, nextCursor }`, not an offset
  // envelope): each entry is a page already fetched, `Load more` appends the next cursor. Using
  // `useQueries` (rather than one `useState<cursor>`) keeps every loaded page live in the cache
  // and re-rendered together, so the table never lags a click behind the fetch that answered it.
  const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  // actorId/objectType are real server params — changing either invalidates every already-loaded
  // cursor page, so pagination restarts from the first page under the new filter.
  function setActorFilter(next: string) {
    setActorId(next);
    setPageCursors([undefined]);
  }
  function setObjectTypeFilter(next: string) {
    setObjectType(next);
    setPageCursors([undefined]);
  }

  const pageQueries = useQueries({
    queries: pageCursors.map((cursor) => ({
      queryKey: qk.audit({ limit: 50, cursor, actorId: actorId || undefined, objectType: objectType || undefined }),
      queryFn: () =>
        client.get<AuditPage>(endpoints.auditLog.list, {
          params: { limit: 50, cursor, actorId: actorId || undefined, objectType: objectType || undefined },
        }),
      ...typedCachePolicy<AuditPage>('slowList'),
    })),
  });

  const firstQuery = pageQueries[0];
  const lastQuery = pageQueries[pageQueries.length - 1];
  const isLoading = firstQuery?.isLoading ?? true;
  const isError = pageQueries.some((q) => q.isError);
  const isFetchingMore = pageQueries.length > 1 && (lastQuery?.isFetching ?? false);
  const nextCursor = lastQuery?.data?.nextCursor;

  // `useQueries` returns a new array every render, so the dependency is each page's own
  // `dataUpdatedAt` (changes exactly when a page's data actually changes), not array identity.
  const dataFingerprint = pageQueries.map((q) => q.dataUpdatedAt).join(',');
  const items = useMemo(
    () => pageQueries.flatMap((q) => q.data?.items ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataFingerprint],
  );

  // WB-043 — `action` and the date range have no server-side param (web/backend-gaps.md B-64), so
  // both only narrow the window of pages already loaded, exactly like `search` already did.
  const rangeStartMs = startOfDayMs(dateRange.from);
  const rangeEndMs = endOfDayMs(dateRange.to);
  const filtered = useMemo(() => {
    let out = items;
    if (action) out = out.filter((e) => e.action === action);
    out = out.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= rangeStartMs && t <= rangeEndMs;
    });
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      out = out.filter(
        (e) =>
          e.action.toLowerCase().includes(needle) ||
          (e.objectLabel ?? e.objectType).toLowerCase().includes(needle) ||
          (e.actorName ?? '').toLowerCase().includes(needle),
      );
    }
    return out;
  }, [items, search, action, rangeStartMs, rangeEndMs]);

  const objectTypeOptions = useMemo(
    () => Array.from(new Set([...KNOWN_OBJECT_TYPES, ...items.map((e) => e.objectType)])).sort(),
    [items],
  );

  function clearAllFilters() {
    setActorFilter('');
    setAction('');
    setObjectTypeFilter('');
    setDatePreset('last30');
    setDateRange(resolvePreset('last30'));
    setSearch('');
  }

  function loadMore() {
    if (!nextCursor) return;
    setPageCursors((prev) => [...prev, nextCursor]);
  }

  function retry() {
    for (const q of pageQueries) void q.refetch();
  }

  async function handleExportCsv() {
    const data = await client.get<{ items: AuditEntry[] }>(endpoints.auditLog.list, { params: { limit: 200 } });
    const header = 'timestamp,user,action,object,ip\n';
    const body = data.items
      .map((e) => [formatCarrier(e.createdAt, timezone, 'dateTimeSeconds'), e.actorName ?? '', e.action, e.objectLabel ?? e.objectType, e.ipAddress ?? ''].join(','))
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'audit-log.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings · Audit log</h1>
          <p className="text-page-sub text-text-muted">Every change made in the back office · retained 24 months</p>
        </div>
        <Can perm="auditLog" level="READ">
          <Button variant="secondary" iconLeft={<Download size={16} strokeWidth={1.75} />} onClick={handleExportCsv}>
            Export CSV
          </Button>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-input flex-1 items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
          <Search size={16} strokeWidth={1.75} className="text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, object or user…"
            className="w-full bg-transparent text-body outline-none"
          />
        </div>
        <select
          aria-label="Filter by user"
          value={actorId}
          onChange={(e) => setActorFilter(e.target.value)}
          className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
        >
          <option value="">All users</option>
          {usersQuery.rows.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
        <DateRangePicker
          value={dateRange}
          preset={datePreset}
          onChange={(range, preset) => {
            setDateRange(range);
            setDatePreset(preset);
          }}
        />
        <Button
          variant="secondary"
          iconLeft={<Filter size={16} strokeWidth={1.75} />}
          onClick={() => setFiltersOpen(true)}
        >
          Filters{objectType ? ' · 1' : ''}
        </Button>
      </div>

      <Card padded={false}>
        {isLoading && items.length === 0 ? (
          <LoadingState className="p-4" />
        ) : isError ? (
          <ErrorState onRetry={retry} />
        ) : filtered.length === 0 ? (
          <EmptyState {...EMPTY_STATE_COPY.auditLog} actions={[{ label: 'Reset filters', onClick: clearAllFilters }]} />
        ) : (
          <>
            <table className="w-full border-collapse text-body">
              <thead className="h-table-head">
                <tr className="border-b border-border">
                  {['TIMESTAMP', 'USER', 'ACTION', 'OBJECT', 'DETAILS', 'IP ADDRESS'].map((h) => (
                    <th key={h} className="px-3 text-left text-table-head font-semibold uppercase tracking-wide text-text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    tabIndex={0}
                    onClick={() => setSelected(entry)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(entry)}
                    className="h-row cursor-pointer border-b border-border last:border-b-0 hover:bg-bg-subtle"
                  >
                    <td className="px-3 tabular-nums text-text">{formatCarrier(entry.createdAt, timezone, 'dateTimeSeconds')}</td>
                    <td className="px-3">
                      <span className="flex items-center gap-2">
                        <Avatar name={entry.actorName ?? entry.actorType} size="sm" />
                        <span className="text-text">{entry.actorName ?? entry.actorType}</span>
                      </span>
                    </td>
                    <td className="px-3">
                      <Badge tone={ACTION_TONE[entry.action] ?? 'neutral'}>{ACTION_LABEL[entry.action] ?? entry.action}</Badge>
                    </td>
                    <td className="px-3 text-text">{entry.objectLabel ?? entry.objectType}</td>
                    <td className="max-w-64 truncate px-3 text-caption text-text-muted">{entry.details ?? '—'}</td>
                    <td className="px-3 text-right tabular-nums text-text-secondary">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {nextCursor && (
              <div className="flex justify-center border-t border-border p-3">
                <Button variant="secondary" onClick={loadMore} loading={isFetchingMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Audit entry" subtitle={selected?.objectLabel ?? selected?.objectType}>
        {selected && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-label text-text-muted">Before</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-danger-soft p-3 text-caption text-text">
                {JSON.stringify(selected.before ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-label text-text-muted">After</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-success-soft p-3 text-caption text-text">
                {JSON.stringify(selected.after ?? {}, null, 2)}
              </pre>
            </div>
            <p className="text-caption text-text-muted">Trace ID: {selected.traceId ?? '—'}</p>
            <p className="text-caption text-text-muted">User agent: {selected.userAgent ?? '—'}</p>
          </div>
        )}
      </Drawer>

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        screenName="Audit log"
        appliedCount={objectType ? 1 : 0}
        onReset={() => setObjectTypeFilter('')}
        onApply={() => setFiltersOpen(false)}
      >
        <FilterGroup title="Object type">
          {objectTypeOptions.map((type) => (
            <FilterCheckbox
              key={type}
              label={type}
              checked={objectType === type}
              onChange={() => setObjectTypeFilter(objectType === type ? '' : type)}
            />
          ))}
        </FilterGroup>
      </FilterDrawer>
    </div>
  );
}
