// owner: web-api-client — server-side paging with an explicit, bounded client fallback (WD-073).
//
// Every list screen asks the backend for exactly one page (`page`, `limit`, `q`, `status`…) and
// renders `items`/`total` from that page. The 11.23 filter drawers, however, draw groups the
// backend has no params for (B-54/B-59/B-60). Rather than silently filtering a single server page
// (wrong: matches on other pages vanish) or fetching the whole table on every visit (the ~10 s
// screens this replaces), a screen switches to the *window* mode only while such a filter is
// active: it loads the newest `FILTER_WINDOW` rows once (parallel 200-row pages), filters them in
// memory and pages the result. The cap is recorded per gap; the total shown is the window's.
import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { cachePolicy, type CachePolicyName } from './cache';
import type { OffsetPage } from './types';

/** Plain, serialisable query options — usable by `useQuery`, `prefetchQuery` and this hook alike. */
export interface PageQueryOptions<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<OffsetPage<T>>;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}

/** `cachePolicy()` narrowed to the static fields a page/list query uses (no poll functions). */
export function pagePolicy(name: CachePolicyName): Pick<PageQueryOptions<unknown>, 'staleTime' | 'refetchOnWindowFocus' | 'refetchOnReconnect'> {
  const policy = cachePolicy(name);
  return {
    staleTime: typeof policy.staleTime === 'number' ? policy.staleTime : undefined,
    refetchOnWindowFocus: policy.refetchOnWindowFocus === true,
    refetchOnReconnect: policy.refetchOnReconnect === true,
  };
}

export interface PagedQueryInput<T> {
  /** The one-request-per-page query — already carries `page`/`limit` and the server filters. */
  server: PageQueryOptions<T>;
  /** The bounded newest-first window used only while `useWindow` is true. */
  window: PageQueryOptions<T>;
  useWindow: boolean;
  page: number;
  limit: number;
  /** Runs against the window rows only (client-only filter groups, free-text the API lacks). */
  filter: (rows: T[]) => T[];
  /** Both modes turned off — e.g. the tab is not mounted. */
  enabled?: boolean;
}

export interface PagedQueryResult<T> {
  items: T[];
  /** Every matching row in server mode; matching rows *inside the window* in window mode. */
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  mode: 'server' | 'window';
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  /** The raw server page (server mode) — `total` for segment counters etc. */
  serverPage: OffsetPage<T> | undefined;
  /** Every window row before `filter` (window mode) — for KPI-style derivations. */
  windowRows: T[];
}

export function usePagedQuery<T>(input: PagedQueryInput<T>): PagedQueryResult<T> {
  const enabled = input.enabled ?? true;
  // `keepPreviousData` — moving to the next page or typing in the search keeps the current rows on
  // screen until the new page lands, instead of swapping the table for a skeleton on every key.
  const serverQuery = useQuery({ ...input.server, enabled: enabled && !input.useWindow, placeholderData: keepPreviousData });
  const windowQuery = useQuery({ ...input.window, enabled: enabled && input.useWindow, placeholderData: keepPreviousData });

  const { useWindow, filter } = input;
  const windowRows = useMemo(() => windowQuery.data?.items ?? [], [windowQuery.data]);
  const filtered = useMemo(() => (useWindow ? filter(windowRows) : []), [useWindow, windowRows, filter]);

  if (input.useWindow) {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / input.limit));
    const page = Math.min(input.page, totalPages);
    return {
      items: filtered.slice((page - 1) * input.limit, page * input.limit),
      total,
      totalPages,
      page,
      limit: input.limit,
      mode: 'window',
      isLoading: windowQuery.isLoading,
      isFetching: windowQuery.isFetching,
      isError: windowQuery.isError && !windowQuery.data,
      error: windowQuery.error,
      refetch: () => void windowQuery.refetch(),
      serverPage: undefined,
      windowRows,
    };
  }

  const data = serverQuery.data;
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    page: data?.page ?? input.page,
    limit: input.limit,
    mode: 'server',
    isLoading: serverQuery.isLoading,
    isFetching: serverQuery.isFetching,
    isError: serverQuery.isError && !data,
    error: serverQuery.error,
    refetch: () => void serverQuery.refetch(),
    serverPage: data,
    windowRows,
  };
}

/** Removes `undefined`/empty params so query keys stay stable and URLs stay short. */
export function compactParams<P extends Record<string, string | number | boolean | undefined>>(params: P): P {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === null) continue;
    out[key] = value;
  }
  return out as P;
}
