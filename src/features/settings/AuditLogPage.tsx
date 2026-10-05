// owner: web-settings-admin — W-23 Settings · Audit log (web/tz.md §10 W-23).
// Design: web/roles and screens/admin panel/Settings — immutable audit trail.jpg
// `GET /audit-log` is cursor-only (`{ items, nextCursor }`, no offset/total — web/backend-gaps.md),
// and action/date/search have no server param (B-64). WB-270: the page loads a bounded window of
// cursor chunks and pages the filtered window client-side with the shared `Pagination`
// (`?page=&limit=`, ≤ 100 rows a page, so no row virtualisation — WD-102). Timestamps render in
// the carrier's own timezone (§8.3).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { endOfDay, startOfDay } from 'date-fns';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Search, Upload, Filter } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { Button } from '@/shared/ui/Button';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { Drawer } from '@/shared/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { formatCarrier } from '@/shared/format/datetime';
import { toCsv } from '@/shared/lib/csv';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { typedCachePolicy } from '@/shared/api/queryPolicy';
import { useCarrier, useUsersList, type AuditEntry } from '@/shared/api/settingsAdmin';
import { DateRangePicker, resolvePreset, type DateRange, type DateRangePreset } from '@/shared/ui/DateRangePicker';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';
import { Pagination } from '@/shared/ui/Pagination';
import { AUDIT_SEARCH_COPY } from './lib/copy';
import { usePageHeader } from '@/app/layouts/Topbar';

const ACTION_TONE: Record<string, BadgeTone> = { CREATE: 'success', UPDATE: 'info', DELETE: 'danger', VIEW: 'neutral' };
const ACTION_LABEL: Record<string, string> = { CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted', VIEW: 'Viewed' };
const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VIEW'] as const;
const AUDIT_COLUMNS = ['TIMESTAMP', 'USER', 'ACTION', 'OBJECT', 'DETAILS', 'IP ADDRESS'] as const;

/** `UPDATE_SCOPES` → `Update scopes` — the server writes ~40 verbs beyond the four above. */
function actionLabel(action: string): string {
  const known = ACTION_LABEL[action];
  if (known) return known;
  const words = action.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const TRACE_ID_DETAIL = /^traceId=([\w-]+)$/;

/** `detail` often only carries `traceId=…` (the `@Audit` decorator default) — that is not a detail. */
function detailOf(entry: AuditEntry): string | null {
  const text = entry.details ?? entry.detail ?? null;
  return text && !TRACE_ID_DETAIL.test(text) ? text : null;
}

function traceIdOf(entry: AuditEntry): string | null {
  return entry.traceId ?? TRACE_ID_DETAIL.exec(entry.detail ?? '')?.[1] ?? null;
}

function ipOf(entry: AuditEntry): string | null {
  return entry.ipAddress ?? entry.ip ?? null;
}

const LABEL_KEYS = ['name', 'unitNumber', 'number', 'serial', 'subject', 'email'] as const;

/** `Role · QA Auditor`, as drawn — the server sends no `objectLabel`, so take the record's name. */
function objectOf(entry: AuditEntry): string {
  if (entry.objectLabel) return entry.objectLabel;
  for (const snapshot of [entry.after, entry.before]) {
    if (typeof snapshot !== 'object' || snapshot === null) continue;
    const record = snapshot as Record<string, unknown>;
    const key = LABEL_KEYS.find((k) => typeof record[k] === 'string' && record[k] !== '');
    if (key) return `${entry.objectType} · ${String(record[key])}`;
  }
  return entry.objectType;
}

type AuditPage = { items: AuditEntry[]; nextCursor: string | null };

/** One cursor request — the server's own `limit` ceiling (`audit.controller.ts`). */
const CHUNK_SIZE = 200;
/**
 * WB-270 / B-64 — the cursor chunks are walked automatically up to this many entries (5 requests
 * of 200), stopping early once a chunk reaches past the start of the date range. The table pages
 * over that bounded window; `Load older entries` extends it by another window on request.
 */
export const AUDIT_WINDOW_ENTRIES = 1000;
const WINDOW_CHUNKS = AUDIT_WINDOW_ENTRIES / CHUNK_SIZE;
/** The shared Pagination offers 10/25/50/100; a hand-written `?limit=500` is capped here. */
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/** Same guard as Vehicles/Drivers/DVIR: `?page=abc`, `?page=0` or `?limit=-3` fall back to the default. */
function positiveIntParam(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

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
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState('');
  // WB-043 — the filter row §10 W-23 draws: `All users ▾` (`actorId` IS a real server-side param
  // on `GET /audit-log`, web/backend-gaps.md — `objectType`/`objectId`/`actorId` only) · `All
  // actions ▾` and the `Last 30 days ▾` date range (both gap B-64 — no server support, filtered
  // over the loaded window only, same limitation `search` already has) · `Filters`
  // (opens the drawer for `Object type`, the other server-supported param).
  const [actorId, setActorId] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>(() => resolvePreset('last30'));
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last30');
  const [objectType, setObjectType] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The filter signature the user pressed `Stop` on — a new search/filter starts a new walk.
  const [stoppedFor, setStoppedFor] = useState<string | null>(null);
  // `Load older entries` widens the window for the filter signature it was pressed under.
  const [windowFor, setWindowFor] = useState<{ signature: string; chunks: number } | null>(null);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const queryClient = useQueryClient();

  // WB-270 — `?page=&limit=` in the URL, like Vehicles/Drivers/Trips/DVIR. A page size above
  // 100 is capped, so a page never needs row virtualisation (WD-102).
  const page = positiveIntParam(params.get('page'), 1);
  const limit = Math.min(positiveIntParam(params.get('limit'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  function setPaging(key: 'page' | 'limit', value: number) {
    const next = new URLSearchParams(params);
    next.set(key, String(value));
    if (key === 'limit' || value === 1) next.delete('page');
    setParams(next, { replace: true });
  }
  /** Every filter, the search and the date range re-page from page 1. */
  function resetPage() {
    if (!params.has('page')) return;
    const next = new URLSearchParams(params);
    next.delete('page');
    setParams(next, { replace: true });
  }
  function changeSearch(next: string) {
    setSearch(next);
    resetPage();
  }
  function changeAction(next: string) {
    setAction(next);
    resetPage();
  }
  function changeDateRange(range: DateRange, preset: DateRangePreset) {
    setDateRange(range);
    setDatePreset(preset);
    resetPage();
  }
  // actorId/objectType are real server params — changing either starts a new cursor chain.
  function setActorFilter(next: string) {
    setActorId(next);
    resetPage();
  }
  function setObjectTypeFilter(next: string) {
    setObjectType(next);
    resetPage();
  }

  const rangeStartMs = startOfDayMs(dateRange.from);
  const rangeEndMs = endOfDayMs(dateRange.to);
  const serverParams = { limit: CHUNK_SIZE, actorId: actorId || undefined, objectType: objectType || undefined };
  const filterSignature = JSON.stringify([search.trim(), action, rangeStartMs, rangeEndMs, actorId, objectType]);
  const localFilterActive = Boolean(search.trim()) || Boolean(action) || datePreset !== 'last30';
  const walking = stoppedFor !== filterSignature;
  const windowChunks = windowFor?.signature === filterSignature ? windowFor.chunks : WINDOW_CHUNKS;
  // Entries arrive newest first, so once a chunk reaches past the start of the date range no older
  // chunk can match any filter (the date range always applies).
  const pastRange = (chunk: AuditPage) => chunk.items.some((e) => new Date(e.createdAt).getTime() < rangeStartMs);

  // The cursor chain is walked through the query cache: up to the window, stopping past the start
  // of the date range or on `Stop`, and over any chunk already cached (so `Stop` or clearing the
  // search never hides loaded rows).
  const chunkCursors: (string | undefined)[] = [undefined];
  for (;;) {
    const chunk = queryClient.getQueryData<AuditPage>(qk.audit({ ...serverParams, cursor: chunkCursors[chunkCursors.length - 1] }));
    // A cursor already in the chain would loop forever — the server never repeats one, but guard.
    if (!chunk?.nextCursor || chunkCursors.includes(chunk.nextCursor)) break;
    const nextCached = queryClient.getQueryData<AuditPage>(qk.audit({ ...serverParams, cursor: chunk.nextCursor })) !== undefined;
    const wanted = walking && chunkCursors.length < windowChunks && !pastRange(chunk);
    if (!wanted && !nextCached) break;
    chunkCursors.push(chunk.nextCursor);
  }

  const chunkQueries = useQueries({
    queries: chunkCursors.map((cursor) => ({
      queryKey: qk.audit({ ...serverParams, cursor }),
      queryFn: () => client.get<AuditPage>(endpoints.auditLog.list, { params: { ...serverParams, cursor } }),
      ...typedCachePolicy<AuditPage>('slowList'),
    })),
  });

  const firstQuery = chunkQueries[0];
  const lastQuery = chunkQueries[chunkQueries.length - 1];
  const isLoading = firstQuery?.isLoading ?? true;
  const isError = chunkQueries.some((q) => q.isError);
  const isFetching = chunkQueries.some((q) => q.isFetching);
  // A later chunk still in flight means older entries exist even though its cursor is not known yet.
  const hasOlder = lastQuery?.data ? Boolean(lastQuery.data.nextCursor) : chunkQueries.length > 1;
  // Every entry that could match is loaded: no older chunk, or the loaded chunks reach past the
  // start of the date range.
  const rangeCovered = !hasOlder || chunkQueries.some((q) => q.data !== undefined && pastRange(q.data));
  const windowFull = chunkCursors.length >= windowChunks;
  const walkInProgress = walking && !isError && !rangeCovered && !windowFull;

  // `useQueries` returns a new array every render, so the dependency is each chunk's own
  // `dataUpdatedAt` (changes exactly when a chunk's data actually changes), not array identity.
  const dataFingerprint = chunkQueries.map((q) => q.dataUpdatedAt).join(',');
  const items = useMemo(
    () => chunkQueries.flatMap((q) => q.data?.items ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataFingerprint],
  );

  // WB-043 — `action` and the date range have no server-side param (web/backend-gaps.md B-64), so
  // both narrow the loaded window, exactly like `search`.
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
          actionLabel(e.action).toLowerCase().includes(needle) ||
          objectOf(e).toLowerCase().includes(needle) ||
          (detailOf(e) ?? '').toLowerCase().includes(needle) ||
          (e.actorName ?? '').toLowerCase().includes(needle),
      );
    }
    return out;
  }, [items, search, action, rangeStartMs, rangeEndMs]);

  // WB-270 — client-side paging over the filtered window (the server has no offset/total, and a
  // cursor page could not honour the B-64 filters).
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const shownPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => filtered.slice((shownPage - 1) * limit, shownPage * limit), [filtered, shownPage, limit]);
  // A `page` past the end (a bookmark, the back button, a narrower filter) snaps back to the last
  // page once the window has settled — not while chunks are still arriving.
  const settled = !isLoading && !isFetching && !isError && !walkInProgress;
  useEffect(() => {
    if (!settled || page <= totalPages) return;
    setPaging('page', totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, page, totalPages]);

  const objectTypeOptions = useMemo(
    () => Array.from(new Set([...KNOWN_OBJECT_TYPES, ...items.map((e) => e.objectType)])).sort(),
    [items],
  );

  function clearAllFilters() {
    setActorId('');
    setAction('');
    setObjectType('');
    setDatePreset('last30');
    setDateRange(resolvePreset('last30'));
    setSearch('');
    resetPage();
  }

  function loadOlder() {
    setStoppedFor(null);
    setWindowFor({ signature: filterSignature, chunks: chunkCursors.length + WINDOW_CHUNKS });
  }

  function retry() {
    for (const q of chunkQueries) void q.refetch();
  }

  function handleExportCsv() {
    // WB-270 — exports the page shown (every active filter already applied), as DVIR does (WB-268).
    // WB-135 — every field goes through the RFC 4180 escaper: the 'MMM dd, HH:mm:ss' timestamp
    // and actor/object names can contain commas, quotes or line breaks.
    const csv = toCsv([
      ['timestamp', 'user', 'action', 'object', 'ip'],
      ...pageRows.map((e) => [formatCarrier(e.createdAt, timezone, 'dateTimeSeconds'), e.actorName, actionLabel(e.action), objectOf(e), ipOf(e)]),
    ]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'audit-log.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  usePageHeader({ title: 'Settings · Audit log', subtitle: 'Every change made in the back office · retained 24 months' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Can perm="auditLog" level="READ">
          <Button variant="secondary" iconLeft={<Upload size={16} strokeWidth={1.75} />} onClick={handleExportCsv}>
            Export CSV
          </Button>
        </Can>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-input flex-1 items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
          <Search size={16} strokeWidth={1.75} className="text-text-muted" />
          <input
            type="search"
            aria-label="Search action, object or user"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
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
          onChange={(e) => changeAction(e.target.value)}
          className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
        <DateRangePicker value={dateRange} preset={datePreset} onChange={changeDateRange} />
        <Button
          variant="secondary"
          iconLeft={<Filter size={16} strokeWidth={1.75} />}
          onClick={() => setFiltersOpen(true)}
        >
          Filters{objectType ? ' · 1' : ''}
        </Button>
      </div>

      {/* B-64 / WB-270 — the window is walked automatically (live count + Stop). Whenever entries in
          the date range remain outside it (window limit or Stop) it is said on screen, with
          `Load older entries`, so a short or empty result is not read as "nothing happened". */}
      {walkInProgress ? (
        <div role="status" className="flex items-center gap-3 text-caption text-text-muted">
          <span className="tabular-nums">{AUDIT_SEARCH_COPY.searching(items.length)}</span>
          <Button variant="secondary" size="sm" onClick={() => setStoppedFor(filterSignature)}>
            Stop
          </Button>
        </div>
      ) : !rangeCovered && !isError ? (
        <div className="flex items-center gap-3 text-caption text-text-muted">
          <span className="tabular-nums">
            {walking ? AUDIT_SEARCH_COPY.windowLimit(items.length) : AUDIT_SEARCH_COPY.stopped(items.length)}
          </span>
          <Button variant="secondary" size="sm" onClick={loadOlder}>
            Load older entries
          </Button>
        </div>
      ) : localFilterActive && hasOlder ? (
        <p className="text-caption tabular-nums text-text-muted">{AUDIT_SEARCH_COPY.rangeCovered(items.length)}</p>
      ) : null}

      {/* flex-1 lets the table area absorb any spare card height, so Pagination sits at the card
          bottom (the WB-264 pattern). */}
      <Card padded={false} className="flex flex-col">
        <div className="flex-1">
          {isLoading && items.length === 0 ? (
            <LoadingState className="p-4" />
          ) : isError ? (
            <ErrorState
              title="Could not load the audit log"
              description="The audit trail did not respond. Nothing was lost — every recorded event is still stored."
              onRetry={retry}
            />
          ) : filtered.length === 0 ? (
            <EmptyState {...EMPTY_STATE_COPY.auditLog} actions={[{ label: 'Reset filters', onClick: clearAllFilters }]} />
          ) : (
            <table className="w-full border-collapse text-body">
              <thead className="h-table-head">
                <tr className="border-b border-border">
                  {AUDIT_COLUMNS.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 text-left text-table-head font-semibold uppercase tracking-wide text-text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((entry) => (
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
                        <span className="flex flex-col">
                          <span className="text-text">{entry.actorName ?? entry.actorType}</span>
                          {entry.actorEmail && <span className="text-caption text-text-muted">{entry.actorEmail}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-3">
                      <Badge tone={ACTION_TONE[entry.action] ?? 'neutral'}>{actionLabel(entry.action)}</Badge>
                    </td>
                    <td className="px-3 text-text">{objectOf(entry)}</td>
                    <td className="max-w-64 truncate px-3 text-caption text-text-muted">{detailOf(entry) ?? '—'}</td>
                    <td className="px-3 text-right tabular-nums text-text-secondary">{ipOf(entry) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!isLoading && !isError && filtered.length > 0 && (
          <Pagination
            page={shownPage}
            limit={limit}
            total={filtered.length}
            totalPages={totalPages}
            itemLabel="entries"
            onPageChange={(p) => setPaging('page', p)}
            onLimitChange={(l) => setPaging('limit', l)}
          />
        )}
      </Card>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Audit entry" subtitle={selected ? objectOf(selected) : undefined}>
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
            <p className="text-caption text-text-muted">Trace ID: {traceIdOf(selected) ?? '—'}</p>
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
