// owner: web-vehicles-drivers — Trailers (sits beside W-03 Vehicles; same gate: `vehicles`).
// `GET /trailers` is server-paged: `page`/`limit`/`sort`/`q`/`status` live in the URL and in the
// query key, one request per page.
import { useEffect, useMemo, useState } from 'react';
import type { SortingState } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Search, Plus, Download, Upload } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { useIsOffline, OFFLINE_TOOLTIP } from '@/shared/realtime/RealtimeProvider';
import { usePageHeader } from '@/app/layouts/Topbar';
import { fetchTrailersExport, useTrailersPage, type TrailerRow, type TrailerStatus } from '@/shared/api/trailers';
import { ApiError } from '@/shared/api/errors';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { InventoryTabs } from '@/shared/ui/InventoryTabs';
import { DataTable } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { EMPTY_STATE_COPY, searchEmptyState } from '@/shared/ui/copy';
import { useToast } from '@/shared/ui/Toast';
import { TrailerModal } from './components/TrailerModal';
import { DeleteTrailerModal } from './components/DeleteTrailerModal';
import { ImportTrailersModal } from './components/ImportTrailersModal';

type Segment = 'ALL' | TrailerStatus;
const SEGMENTS: Array<[Segment, string]> = [
  ['ALL', 'All'],
  ['ACTIVE', 'Active'],
  ['INACTIVE', 'Inactive'],
  ['OUT_OF_SERVICE', 'Out of service'],
];
/** Columns `TrailerListQueryDto.sort` accepts. */
const SORT_FIELDS = new Set(['number', 'vin', 'status']);

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** `?sort=number:desc` → TanStack sorting state; anything the API would 422 on is ignored. */
function parseSort(raw: string | null): SortingState {
  const [id, dir] = (raw ?? '').split(':');
  return id && SORT_FIELDS.has(id) && (dir === 'asc' || dir === 'desc') ? [{ id, desc: dir === 'desc' }] : [];
}

const positiveIntParam = (raw: string | null, fallback: number): number => {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

function StatusBadge({ status }: { status: TrailerRow['status'] }) {
  if (status === 'OUT_OF_SERVICE') return <Badge tone="danger" dot>Out of service</Badge>;
  if (status === 'INACTIVE') return <Badge tone="neutral" dot>Inactive</Badge>;
  return <Badge tone="success" dot>Active</Badge>;
}

const menuItem = 'cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle';

export default function TrailersPage() {
  const { can } = usePermission();
  const isOffline = useIsOffline();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const canFull = can('vehicles', 'FULL');

  const q = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebounced(searchInput.trim(), 300);
  const rawSegment = params.get('status');
  const segment: Segment = SEGMENTS.some(([value]) => value === rawSegment) ? (rawSegment as Segment) : 'ALL';
  const sorting = useMemo(() => parseSort(params.get('sort')), [params]);
  const page = positiveIntParam(params.get('page'), 1);
  const limit = positiveIntParam(params.get('limit'), 10);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  const list = useTrailersPage({
    page,
    limit,
    q: debouncedSearch || undefined,
    status: segment === 'ALL' ? undefined : segment,
    sort: sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : undefined,
  });
  const pageRows = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const totalPages = list.data?.totalPages ?? 1;
  const lastPage = Math.max(1, totalPages);

  // A bookmarked page past the end (or trailers deleted since) snaps back to the last real page.
  useEffect(() => {
    if (!list.data || list.isPlaceholderData || page <= lastPage) return;
    setParam('page', String(lastPage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage, list.data, list.isPlaceholderData]);

  const [addOpen, setAddOpen] = useState(false);
  const [editTrailer, setEditTrailer] = useState<TrailerRow | null>(null);
  const [deleteTrailer, setDeleteTrailer] = useState<TrailerRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await fetchTrailersExport();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.download = 'trailers-export.json';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
    } finally {
      setExporting(false);
    }
  }

  const columns: ColumnDef<TrailerRow, unknown>[] = [
    {
      accessorKey: 'number',
      header: 'TRAILER #',
      cell: ({ row }) => <span className="tabular-nums font-semibold text-text">{row.original.number}</span>,
    },
    {
      accessorKey: 'vin',
      header: 'VIN',
      cell: ({ row }) => <span className="text-text-secondary">{row.original.vin || '—'}</span>,
    },
    { id: 'status', header: 'STATUS', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];

  usePageHeader({
    title: 'Trailers',
    subtitle: list.isSuccess && !debouncedSearch && segment === 'ALL' ? `${total} trailer${total === 1 ? '' : 's'}` : undefined,
  });

  return (
    <div className="flex flex-col gap-4 xl:max-h-content-h">
      <div className="flex items-center justify-between xl:shrink-0">
        <InventoryTabs />
        <div className="flex items-center gap-2">
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setParam('q', e.target.value || null);
              }}
              placeholder="Search trailer #, VIN…"
              aria-label="Search trailer #, VIN"
              className="w-56 bg-transparent text-body outline-none"
            />
          </div>
          <Button variant="secondary" className="w-btn-wide" iconLeft={<Upload size={16} strokeWidth={1.75} />} onClick={handleExport} loading={exporting}>
            Export Trailers
          </Button>
          <Can perm="vehicles" level="FULL">
            <Button variant="secondary" className="w-btn-wide" iconLeft={<Download size={16} strokeWidth={1.75} />} onClick={() => setImportOpen(true)}>
              Import Trailers
            </Button>
            <Button
              variant="primary"
              className="w-btn-add"
              iconLeft={<Plus size={16} strokeWidth={1.75} />}
              onClick={() => setAddOpen(true)}
              disabled={isOffline}
              title={isOffline ? OFFLINE_TOOLTIP : undefined}
            >
              Add trailer
            </Button>
          </Can>
        </div>
      </div>

      <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border xl:shrink-0">
        {SEGMENTS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={segment === value}
            onClick={() => setParam('status', value === 'ALL' ? null : value)}
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

      <Card padded={false} className="xl:flex xl:min-h-0 xl:flex-col">
        {list.isPending ? (
          <LoadingState className="p-4" />
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : total === 0 ? (
          debouncedSearch || segment !== 'ALL' ? (
            <EmptyState
              {...searchEmptyState(debouncedSearch || SEGMENTS.find(([v]) => v === segment)![1])}
              actions={[
                {
                  label: debouncedSearch ? 'Clear search' : 'Clear filters',
                  onClick: () => {
                    if (!debouncedSearch) return setParam('status', null);
                    setSearchInput('');
                    setParam('q', null);
                  },
                },
              ]}
            />
          ) : (
            <EmptyState
              {...EMPTY_STATE_COPY.trailers}
              actions={
                canFull
                  ? [
                      { label: 'Import CSV', variant: 'secondary', onClick: () => setImportOpen(true) },
                      { label: 'Add trailer', onClick: () => setAddOpen(true) },
                    ]
                  : undefined
              }
            />
          )
        ) : (
          <>
            <div className="xl:min-h-0 xl:overflow-y-auto">
              <DataTable
                data={pageRows}
                columns={columns}
                caption="Trailers"
                getRowId={(r) => r.id}
                sorting={sorting}
                onSortingChange={(next) => setParam('sort', next[0] ? `${next[0].id}:${next[0].desc ? 'desc' : 'asc'}` : null)}
                rowActions={
                  canFull
                    ? (row) => (
                        <>
                          <DropdownMenu.Item onSelect={() => setEditTrailer(row)} className={menuItem}>
                            Edit trailer
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Item onSelect={() => setDeleteTrailer(row)} className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft">
                            Delete trailer
                          </DropdownMenu.Item>
                        </>
                      )
                    : undefined
                }
              />
            </div>
            <Pagination
              page={Math.min(page, lastPage)}
              limit={limit}
              total={total}
              totalPages={totalPages}
              itemLabel="trailers"
              onPageChange={(p) => setParam('page', String(p))}
              onLimitChange={(l) => setParam('limit', String(l))}
            />
          </>
        )}
      </Card>

      {addOpen && <TrailerModal onClose={() => setAddOpen(false)} />}
      {editTrailer && <TrailerModal trailer={editTrailer} onClose={() => setEditTrailer(null)} />}
      {deleteTrailer && <DeleteTrailerModal trailer={deleteTrailer} onClose={() => setDeleteTrailer(null)} />}
      {importOpen && <ImportTrailersModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
