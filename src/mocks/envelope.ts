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
