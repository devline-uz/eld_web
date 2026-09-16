// The backend envelope, reproduced for MSW so handlers exercise the real unwrapping path
// in client.ts (web/tz.md §6.1).
import { HttpResponse } from 'msw';

let counter = 0;
export const nextTraceId = (): string => `01J8X3QK9Z${String(++counter).padStart(16, '0')}`;

/** `{ data, traceId, timestamp }` */
export function ok<T>(data: T, status = 200) {
  return HttpResponse.json(
    { data, traceId: nextTraceId(), timestamp: new Date().toISOString() },
    { status },
  );
}

/** `{ statusCode, code, message, details, traceId, timestamp }` */
export function fail(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return HttpResponse.json(
    {
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      traceId: nextTraceId(),
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

/** Build a full mock URL from a prefix-free endpoint path. */
export const url = (path: string): string =>
  `${import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:3002/api'}${path}`;

/** Query params the real list DTOs narrow by, applied as exact matches when the row has the field. */
const EXACT_FILTERS = ['status', 'severity', 'repairStatus', 'priority', 'vehicleId', 'driverId', 'bleState'] as const;
const BOOL_FILTERS = ['outOfService', 'enabled'] as const;

/**
 * Answers a list fixture the way the backend does (WD-073): narrowed by the DTO's exact-match
 * params, `q` over the module's `contains` fields, `dueOnly` for schedules, then paged by
 * `page`/`limit` (default 25, max 200). Handlers stay a one-liner and the screens' server-side
 * paging is exercised for real in dev mode and in tests.
 */
type ListFixture = { items: unknown[] } | unknown[] | unknown;

export function serverPage<T extends object>(
  fixturePage: ListFixture,
  request: Request,
  qFields: ReadonlyArray<string> = [],
): { items: T[]; page: number; limit: number; total: number; totalPages: number } {
  const params = new URL(request.url).searchParams;
  const source = fixturePage as { items?: unknown[] } | unknown[];
  let items = (Array.isArray(source) ? source : (source.items ?? [])) as Array<Record<string, unknown>>;
  for (const key of EXACT_FILTERS) {
    const wanted = params.get(key);
    if (wanted !== null && items.some((row) => key in row)) items = items.filter((row) => row[key] === wanted);
  }
  for (const key of BOOL_FILTERS) {
    const wanted = params.get(key);
    if (wanted !== null && items.some((row) => key in row)) items = items.filter((row) => row[key] === (wanted === 'true'));
  }
  if (params.get('dueOnly') === 'true') {
    items = items.filter((row) => {
      const due = row.due as { state?: string } | undefined;
      return due?.state === 'DUE_SOON' || due?.state === 'OVERDUE';
    });
  }
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q && qFields.length) {
    items = items.filter((row) => qFields.some((f) => String(row[f] ?? '').toLowerCase().includes(q)));
  }
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(params.get('limit') ?? 25) || 25));
  const total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit) as unknown as T[],
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
