// web/tz.md §6.4 — the cache table, and the visibility gate on every poll.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Query } from '@tanstack/react-query';
import {
  cachePolicy,
  defaultQueryClientOptions,
  isDocumentVisible,
  isSilentError,
  POLL,
  REPORT_TERMINAL_STATUSES,
  STALE,
  TRANSFER_TERMINAL_STATUSES,
} from './cache';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiError } from './errors';

const query = (data: unknown) => ({ state: { data } }) as Query<unknown, Error, unknown, readonly unknown[]>;

const hide = (state: DocumentVisibilityState) =>
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);

afterEach(() => vi.restoreAllMocks());

describe('§6.4 cache policies', () => {
  it('holds reference data 10 min, lists 60 s, live 10 s (WD-073)', () => {
    expect(STALE.reference).toBe(10 * 60_000);
    expect(STALE.list).toBe(60_000);
    expect(STALE.live).toBe(10_000);
    expect(defaultQueryClientOptions?.queries?.gcTime).toBeGreaterThanOrEqual(STALE.reference);
  });

  it('matches the table row for row', () => {
    expect(cachePolicy('reference').staleTime).toBe(STALE.reference);
    expect(cachePolicy('list').staleTime).toBe(STALE.list);
    expect(cachePolicy('slowList').staleTime).toBe(STALE.slowList);
    expect(cachePolicy('live').staleTime).toBe(STALE.live);
    expect(cachePolicy('hosDay').staleTime).toBe(STALE.hosDay);
    expect(cachePolicy('reportStatus').staleTime).toBe(0);
    expect(cachePolicy('transferStatus').staleTime).toBe(0);
    expect(cachePolicy('conversation').staleTime).toBe(0);
  });

  it('refetches lists on window focus, and reference data only on reconnect', () => {
    expect(cachePolicy('list').refetchOnWindowFocus).toBe(true);
    expect(cachePolicy('slowList').refetchOnWindowFocus).toBe(true);
    expect(cachePolicy('reference').refetchOnWindowFocus).toBe(false);
    expect(cachePolicy('conversation').refetchInterval).toBeUndefined();
    expect(cachePolicy('hosDay').refetchInterval).toBeUndefined();
  });

  it('polls Live Fleet every 30 s — but never in a background tab', () => {
    const interval = cachePolicy('live').refetchInterval as (q: unknown) => number | false;
    expect(interval(query(null))).toBe(POLL.live);
    hide('hidden');
    expect(interval(query(null))).toBe(false);
  });

  const reportInterval = () =>
    cachePolicy('reportStatus').refetchInterval as (q: unknown) => number | false;
  const transferInterval = () =>
    cachePolicy('transferStatus').refetchInterval as (q: unknown) => number | false;

  it.each(['QUEUED', 'RUNNING'])('keeps polling a report every 3 s while %s', (status) => {
    expect(reportInterval()(query({ status }))).toBe(POLL.reportStatus);
  });

  it.each(['READY', 'FAILED'])('stops polling a report at %s', (status) => {
    expect(reportInterval()(query({ status }))).toBe(false);
  });

  it('keeps polling a report with no status yet, and never in a background tab', () => {
    expect(reportInterval()(query(undefined))).toBe(POLL.reportStatus);
    expect(reportInterval()(query({ status: 7 }))).toBe(POLL.reportStatus);
    hide('hidden');
    expect(reportInterval()(query({ status: 'RUNNING' }))).toBe(false);
  });

  it('keeps polling a transfer every 5 s while QUEUED', () => {
    expect(transferInterval()(query({ status: 'QUEUED' }))).toBe(POLL.transferStatus);
  });

  // WB-028 — TEST_ONLY is where every dev (eRODS TEST mode) transfer ends; it used to poll forever.
  it.each(['TEST_ONLY', 'SENT', 'ACCEPTED', 'REJECTED', 'FAILED'])(
    'stops polling a transfer at %s',
    (status) => {
      expect(transferInterval()(query({ status }))).toBe(false);
    },
  );

  it('never treats a status the backend does not have as terminal', () => {
    for (const invented of ['DELIVERED', 'CONFIRMED', 'SENDING']) {
      expect(transferInterval()(query({ status: invented })), invented).toBe(POLL.transferStatus);
    }
  });

  it('matches the backend Prisma enums — an enum change must fail here, not poll forever', () => {
    // Resolved from the Vitest project root (`web/`), not `import.meta.url`: under the jsdom
    // environment that is not a file:// URL, so `fileURLToPath` throws before anything is compared.
    const schemaPath = resolve(process.cwd(), '../backend/prisma/schema.prisma');
    if (!existsSync(schemaPath)) throw new Error(`backend Prisma schema not found at ${schemaPath}`);
    const schema = readFileSync(schemaPath, 'utf8');
    const members = (name: string) => {
      const block = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));
      if (!block?.[1]) throw new Error(`enum ${name} not found in schema.prisma`);
      return block[1].split(/\s+/).filter(Boolean);
    };

    const inProgress = { ReportStatus: ['QUEUED', 'RUNNING'], TransferStatus: ['QUEUED'] };
    expect([...REPORT_TERMINAL_STATUSES].sort()).toEqual(
      members('ReportStatus').filter((m) => !inProgress.ReportStatus.includes(m)).sort(),
    );
    expect([...TRANSFER_TERMINAL_STATUSES].sort()).toEqual(
      members('TransferStatus').filter((m) => !inProgress.TransferStatus.includes(m)).sort(),
    );
  });

  it('treats an unknown visibility API as visible', () => {
    expect(isDocumentVisible()).toBe(true);
    hide('visible');
    expect(isDocumentVisible()).toBe(true);
  });
});

describe('query client defaults', () => {
  it('leaves retries to client.ts so they are not multiplied', () => {
    expect(defaultQueryClientOptions?.queries?.retry).toBe(false);
    expect(defaultQueryClientOptions?.queries?.staleTime).toBe(STALE.list);
    expect(defaultQueryClientOptions?.queries?.refetchOnWindowFocus).toBe(true);
    expect(defaultQueryClientOptions?.mutations?.retry).toBe(false);
  });

  it('keeps 403 and 422 out of the global toast', () => {
    expect(isSilentError(new ApiError(403, { code: 'FORBIDDEN' }))).toBe(true);
    expect(isSilentError(new ApiError(422, { code: 'VALIDATION_FAILED' }))).toBe(true);
    expect(isSilentError(new ApiError(500, { code: 'INTERNAL_ERROR' }))).toBe(false);
    expect(isSilentError(new Error('x'))).toBe(false);
  });
});
