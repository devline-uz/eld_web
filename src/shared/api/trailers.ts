// Trailers — `GET /trailers` is a server-paged list (`page`, `limit` ≤ 200, `sort=number|vin|status:asc|desc`,
// `q` = substring on number or VIN, `status`) in the usual `{ items, page, limit, total, totalPages }`
// envelope; soft-deleted trailers are never listed. The Trailers screen pages through it and the
// Create trip picker searches it with `q` (never a fetch-everything list). Every write invalidates
// the `trailers` root so both refresh.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { compactParams, pagePolicy, type PageQueryOptions } from './paging';
import type { ImportSummary } from './vehicles';
import type { OffsetPage } from './types';

export type TrailerStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE';

/** The raw `Trailer` row (`GET /trailers` — `TrailersListResponse`). */
export interface TrailerRow {
  id: string;
  number: string;
  vin: string | null;
  status: TrailerStatus;
  /** Soft delete marker — listed rows always carry `null`. */
  deletedAt?: string | null;
}

/** Exactly what `TrailerListQueryDto` accepts. */
export interface TrailersPageParams {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  limit?: number;
  q?: string;
  status?: TrailerStatus;
  sort?: string;
}

/**
 * WB — a backend build older than the paged `GET /trailers` answers with a bare `TrailerRow[]`
 * (no `q`/`status`/`page` support). Every caller reads `data.items`, so a bare array crashed the
 * Create trip modal (`data.items.length` on `undefined`). Normalise it here, once, into the same
 * `OffsetPage` the current backend returns — applying the params the old build ignored.
 */
export function toTrailerPage(body: OffsetPage<TrailerRow> | TrailerRow[] | null | undefined, params: TrailersPageParams): OffsetPage<TrailerRow> {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 25);
  if (body && !Array.isArray(body) && Array.isArray(body.items)) return body;
  const q = (params.q ?? '').trim().toLowerCase();
  const [field, dir] = (params.sort ?? 'number:asc').split(':') as ['number' | 'vin' | 'status', string];
  const rows = (Array.isArray(body) ? body : [])
    .filter((t) => !t.deletedAt)
    .filter((t) => !params.status || t.status === params.status)
    .filter((t) => !q || t.number.toLowerCase().includes(q) || (t.vin ?? '').toLowerCase().includes(q))
    .sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * (dir === 'desc' ? -1 : 1));
  return {
    items: rows.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / limit)),
  };
}

export const trailersPageQuery = (params: TrailersPageParams): PageQueryOptions<TrailerRow> => ({
  queryKey: qk.trailers(compactParams(params)),
  queryFn: async ({ signal }) =>
    toTrailerPage(
      (await client.list<TrailerRow>(endpoints.trailers.list, compactParams(params), { signal })) as
        | OffsetPage<TrailerRow>
        | TrailerRow[],
      params,
    ),
  ...pagePolicy('list'),
});

/** One server page; the previous page stays on screen while the next one (search, sort, filter) loads. */
export function useTrailersPage(params: TrailersPageParams, options: { enabled?: boolean } = {}) {
  return useQuery({ ...trailersPageQuery(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });
}

/** `CreateTrailerDto` — `number` 1–40 chars, `vin` optional ≤ 17. */
export interface TrailerPayload {
  number: string;
  vin?: string;
}
/** `UpdateTrailerDto` — partial of the above plus `status`. */
export type TrailerUpdatePayload = Partial<TrailerPayload> & { status?: TrailerStatus };

const invalidateTrailers = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: qkRoot.trailers });

export function useCreateTrailer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TrailerPayload) => client.post<TrailerRow>(endpoints.trailers.create, payload),
    onSuccess: () => invalidateTrailers(queryClient),
  });
}

export function useUpdateTrailer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TrailerUpdatePayload) => client.patch<TrailerRow>(endpoints.trailers.update(id), payload),
    onSuccess: () => invalidateTrailers(queryClient),
  });
}

/** `DELETE /trailers/:id` is a soft delete (`deletedAt` set, status `INACTIVE`): it succeeds even
 * with DVIR / trip references, history is kept, and the number becomes reusable. A second delete
 * answers 404. */
export function useDeleteTrailer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete(endpoints.trailers.remove(id)),
    onSuccess: () => invalidateTrailers(queryClient),
  });
}

/** `POST /trailers/import` — upserts by `number`; row failures come back in `failed`, not as a 4xx. */
export function useImportTrailers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { trailers: TrailerPayload[] }) =>
      client.post<ImportSummary>(endpoints.trailers.import, payload),
    onSuccess: () => invalidateTrailers(queryClient),
  });
}

/** `GET /trailers/export` — the same shape `POST /trailers/import` accepts. */
export const fetchTrailersExport = () => client.get<unknown>(endpoints.trailers.export);
