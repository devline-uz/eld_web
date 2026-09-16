// owner: web-api-client — the §6.4 cache table, expressed once. A screen declares its policy by
// name (`...cachePolicy('live')`), never by a magic number:
//
//   me / carrier / roles      10 min  —      (raised from 5 min — WD-073, perf plan item 4)
//   lists                     60 s    —      (raised from 30 s — WD-073; window focus still refetches)
//   Live Fleet, Dashboard     10 s    30 s
//   HOS daily log             15 s    —      (invalidated by eld.events_ingested)
//   report status             0       3 s    stops at READY / FAILED
//   transfer status           0       5 s    stops at a terminal status
//   audit log, report list    60 s    —
//   open conversation         0       —      (WS only)
//
// Every refetchInterval is gated on `document.visibilityState === 'visible'` so a background tab
// never polls, and `refetchOnWindowFocus` is on for every list (§6.4).
import type { Query, QueryClientConfig, UseQueryOptions } from '@tanstack/react-query';
import { ApiError } from './errors';

export const STALE = {
  // WD-073 — reference lookups (drivers/vehicles/devices name joins) and lists are held longer so
  // hovering between screens does not refetch on every visit; `live` stays 10 s and every list
  // still refetches on window focus (§6.4). gcTime must stay ≥ the longest staleTime.
  reference: 10 * 60_000,
  list: 60_000,
  slowList: 60_000,
  live: 10_000,
  hosDay: 15_000,
  none: 0,
} as const;

export const POLL = {
  live: 30_000,
  reportStatus: 3_000,
  transferStatus: 5_000,
} as const;

/**
 * Terminal sets, taken from `backend/prisma/schema.prisma` — `cache.test.ts` re-reads that file, so
 * an enum change fails the suite instead of polling forever (web/bugs.md WB-028).
 *
 * `ReportStatus` = QUEUED | RUNNING | READY | FAILED — the worker ends at READY or FAILED.
 */
export const REPORT_TERMINAL_STATUSES = ['READY', 'FAILED'] as const;
/**
 * `TransferStatus` = QUEUED | TEST_ONLY | SENT | ACCEPTED | REJECTED | FAILED. Only QUEUED is in
 * progress: `fmcsa-transfer.service.ts` finishes every send at TEST_ONLY (eRODS TEST mode), SENT or
 * FAILED, and nothing on the backend moves a SENT row to ACCEPTED/REJECTED today — polling a SENT
 * row for a verdict nothing writes would be the endless poll again.
 */
export const TRANSFER_TERMINAL_STATUSES = ['TEST_ONLY', 'SENT', 'ACCEPTED', 'REJECTED', 'FAILED'] as const;

/** A background tab must not poll (§6.4). */
export function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function statusOf(data: unknown): string | null {
  if (data && typeof data === 'object' && 'status' in data) {
    const status = (data as { status: unknown }).status;
    return typeof status === 'string' ? status : null;
  }
  return null;
}

/** Polls every `ms` while the tab is visible and the record has not reached a terminal status. */
function untilTerminal(ms: number, terminal: readonly string[]) {
  return (query: Query<unknown, Error, unknown, readonly unknown[]>): number | false => {
    if (!isDocumentVisible()) return false;
    const status = statusOf(query.state.data);
    if (status && terminal.includes(status)) return false;
    return ms;
  };
}

function whileVisible(ms: number) {
  return (): number | false => (isDocumentVisible() ? ms : false);
}

export type CachePolicyName =
  | 'reference'
  | 'list'
  | 'slowList'
  | 'live'
  | 'hosDay'
  | 'reportStatus'
  | 'transferStatus'
  | 'conversation';

type PolicyOptions = Pick<
  UseQueryOptions,
  'staleTime' | 'refetchInterval' | 'refetchOnWindowFocus' | 'refetchOnReconnect'
>;

const POLICIES: Record<CachePolicyName, PolicyOptions> = {
  reference: { staleTime: STALE.reference, refetchOnWindowFocus: false, refetchOnReconnect: true },
  list: { staleTime: STALE.list, refetchOnWindowFocus: true, refetchOnReconnect: true },
  slowList: { staleTime: STALE.slowList, refetchOnWindowFocus: true, refetchOnReconnect: true },
  live: {
    staleTime: STALE.live,
    refetchInterval: whileVisible(POLL.live),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  hosDay: { staleTime: STALE.hosDay, refetchOnWindowFocus: true, refetchOnReconnect: true },
  reportStatus: {
    staleTime: STALE.none,
    refetchInterval: untilTerminal(POLL.reportStatus, REPORT_TERMINAL_STATUSES),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  transferStatus: {
    staleTime: STALE.none,
    refetchInterval: untilTerminal(POLL.transferStatus, TRANSFER_TERMINAL_STATUSES),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  conversation: { staleTime: STALE.none, refetchOnWindowFocus: false, refetchOnReconnect: true },
};

/** `useQuery({ queryKey: qk.vehicles(p), queryFn, ...cachePolicy('list') })`. */
export function cachePolicy(name: CachePolicyName): PolicyOptions {
  return POLICIES[name];
}

/**
 * Retries live in `client.ts` (GET twice, 1 s then 3 s — §6.2 rule 7), so TanStack Query must not
 * multiply them. `retry: false` here is deliberate, not an oversight (web/decisions.md WD-006).
 */
export const defaultQueryClientOptions: QueryClientConfig['defaultOptions'] = {
  queries: {
    staleTime: STALE.list,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
    throwOnError: false,
  },
  mutations: { retry: false },
};

/** A 403 or a 422 is rendered in place; only 5xx/network reaches the global error toast. */
export function isSilentError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 422);
}
