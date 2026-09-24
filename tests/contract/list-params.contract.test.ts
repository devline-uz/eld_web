// WD-073 — every query parameter a server-paged list sends must be one the backend documents.
// If a DTO drops or renames a param this fails; if the web ever sends a client-only filter as a
// query param (B-54/B-59/B-60 groups) this fails too.
import { describe, expect, it } from 'vitest';
import { server } from '../../src/mocks/server';
import { client } from '../../src/shared/api/client';
import { endpoints } from '../../src/shared/api/endpoints';
import type { OffsetPage } from '../../src/shared/api/types';
import { vehiclesCountQuery, vehiclesPageQuery, VEHICLES_DEFAULT_PAGE } from '../../src/shared/api/vehicles';
import { tripsActiveSliceQuery, tripsCountQuery, tripsKpiQuery, tripsPageQuery } from '../../src/shared/api/trips';
import {
  defectsPageQuery,
  dueSchedulesQuery,
  recentDefectsQuery,
  recentDvirsQuery,
  schedulesPageQuery,
  workOrdersPageQuery,
} from '../../src/shared/api/dvir';
import { devicesLookupQuery, driversLookupQuery, vehiclesLookupQuery } from '../../src/shared/api/lookups';
import { assertMatchesOpenApi, operation } from './openapi';

/** Params the running API accepts (zod DTO) that its `@ApiQuery` list omits. Empty since backend
 * Phase 13B (2026-09-24) documents every `@Query(zodBody)` param — B-59 `GET /trips` `q`/`driverId`
 * included. Add an entry only with a web/backend-gaps.md id; remove it the moment openapi.json has it. */
const ACCEPTED_BUT_UNDOCUMENTED: Record<string, string[]> = {};

function documentedQueryParams(path: string): Set<string> {
  const op = operation('GET', path) as { parameters?: Array<{ name: string; in: string }> } | null;
  if (!op) throw new Error(`GET ${path} is not documented in openapi.json`);
  return new Set([...(op.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name), ...(ACCEPTED_BUT_UNDOCUMENTED[path] ?? [])]);
}

/** Runs a page query through the real client + MSW and records the query string it sent. */
async function sentParams(query: { queryFn: (context: { signal: AbortSignal }) => Promise<unknown> }): Promise<{ path: string; keys: string[]; page: OffsetPage<unknown> }> {
  let seen: URL | null = null;
  const listener = ({ request }: { request: Request }) => {
    seen = new URL(request.url);
  };
  server.events.on('request:start', listener);
  try {
    const page = (await query.queryFn({ signal: new AbortController().signal })) as OffsetPage<unknown>;
    if (!seen) throw new Error('no request was sent');
    const sent = seen as URL;
    return { path: sent.pathname, keys: Array.from(sent.searchParams.keys()), page };
  } finally {
    server.events.removeListener('request:start', listener);
  }
}

const CASES: Array<[string, { queryFn: (context: { signal: AbortSignal }) => Promise<unknown> }]> = [
  ['/api/vehicles', vehiclesPageQuery({ ...VEHICLES_DEFAULT_PAGE, q: '101', status: 'ACTIVE' })],
  ['/api/vehicles', vehiclesCountQuery('INACTIVE')],
  ['/api/vehicles', vehiclesLookupQuery()],
  ['/api/drivers', driversLookupQuery()],
  ['/api/devices', devicesLookupQuery()],
  ['/api/trips', tripsPageQuery({ page: 2, limit: 25, status: 'DELIVERED', q: 'TR-' })],
  ['/api/trips', tripsActiveSliceQuery('ASSIGNED')],
  ['/api/trips', tripsCountQuery('PLANNED')],
  ['/api/trips', tripsKpiQuery()],
  ['/api/dvir', recentDvirsQuery()],
  ['/api/defects', recentDefectsQuery()],
  ['/api/defects', defectsPageQuery({ page: 1, limit: 10, status: 'OPEN', severity: 'CRITICAL' })],
  ['/api/work-orders', workOrdersPageQuery({ page: 1, limit: 10, q: 'brake' })],
  ['/api/maintenance-schedules', schedulesPageQuery({ page: 1, limit: 10 })],
  ['/api/maintenance-schedules', dueSchedulesQuery()],
];

describe('server-paged list queries send only documented query params (WD-073)', () => {
  it.each(CASES)('%s', async (path, query) => {
    const { path: sentPath, keys, page } = await sentParams(query);
    expect(sentPath).toBe(path);
    const documented = documentedQueryParams(path);
    for (const key of keys) expect(documented, `${path}?${key} is not a documented query param`).toContain(key);
    expect(keys).toContain('limit');
    assertMatchesOpenApi('GET', path, page);
  });

  it('never sends limit above the API maximum of 200', async () => {
    const { keys } = await sentParams({ queryFn: () => client.list(endpoints.vehicles.list, { limit: 25 }) });
    expect(keys).toContain('limit');
    let over = false;
    const listener = ({ request }: { request: Request }) => {
      if (Number(new URL(request.url).searchParams.get('limit')) > 200) over = true;
    };
    server.events.on('request:start', listener);
    await vehiclesLookupQuery().queryFn({ signal: new AbortController().signal });
    server.events.removeListener('request:start', listener);
    expect(over).toBe(false);
  });
});
