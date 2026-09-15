// B-46 activity half — `GET /api/reports/activity/summary` (shipped in backend source 2026-09-14,
// regenerated openapi.json; the :3002 dev API is not rebuilt yet). The MSW handler, called through the
// real client, is validated against the documented example. openapi examples cannot say "nullable",
// so the two deltas the backend declares `number | null` are checked against an explicit allow-list
// (same approach as shipped-gaps, WD-069). This is the data source that replaced the per-driver
// `GET /logs/:driverId/range` fan-out (web/bugs.md WB-048).
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { client } from '../../src/shared/api/client';
import { endpoints } from '../../src/shared/api/endpoints';
import type { ActivitySummary } from '../../src/shared/api/reports';
import { server } from '../../src/mocks/server';
import { ok, url } from '../../src/mocks/envelope';
import { activitySummaryFixture } from '../../src/mocks/handlers/reports';
import { assertMatchesOpenApi, documentedExample } from './openapi';

const PATH = '/api/reports/activity/summary';
const NULLABLE_KPIS = new Set(['drivingDeltaPct', 'violationsDelta']);

describe(`GET ${PATH} (B-46)`, () => {
  const example = documentedExample('GET', PATH) as ActivitySummary;

  it('the MSW handler matches the documented summary, paged by page/limit', async () => {
    const withDeltas = (body: ReturnType<typeof activitySummaryFixture>) => ({
      ...body,
      kpis: { ...body.kpis, drivingDeltaPct: 6, violationsDelta: -8 },
    });
    server.use(
      http.get(url(endpoints.reports.activitySummary), ({ request }) =>
        ok(withDeltas(activitySummaryFixture(new URL(request.url).searchParams))),
      ),
    );
    const first = await client.get<ActivitySummary>(endpoints.reports.activitySummary, {
      params: { from: '2026-09-01', to: '2026-09-12', page: 1, limit: 1, sort: 'name:asc' },
    });
    assertMatchesOpenApi('GET', PATH, first);
    expect(first).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    const second = await client.get<ActivitySummary>(endpoints.reports.activitySummary, {
      params: { from: '2026-09-01', to: '2026-09-12', page: 2, limit: 1, sort: 'name:asc' },
    });
    assertMatchesOpenApi('GET', PATH, second);
    expect(second.items[0]?.driverId).not.toBe(first.items[0]?.driverId);
  });

  it('the default handler (null deltas) differs from the example only on the nullable kpis', async () => {
    const summary = await client.get<ActivitySummary>(endpoints.reports.activitySummary, {
      params: { from: '2026-09-01', to: '2026-09-12', page: 1, limit: 25 },
    });
    const nulls = Object.entries(summary.kpis).filter(([, v]) => v === null).map(([k]) => k);
    expect(nulls.filter((k) => !NULLABLE_KPIS.has(k))).toEqual([]);
    const filled = { ...summary, kpis: { ...summary.kpis, drivingDeltaPct: 0, violationsDelta: 0 } };
    assertMatchesOpenApi('GET', PATH, filled);
  });

  it('reads the same object whether the body is enveloped `{ data }` (real backend) or not', async () => {
    server.use(http.get(url(endpoints.reports.activitySummary), () => ok(example)));
    const wrapped = await client.get<ActivitySummary>(endpoints.reports.activitySummary);
    server.use(http.get(url(endpoints.reports.activitySummary), () => HttpResponse.json(example)));
    const raw = await client.get<ActivitySummary>(endpoints.reports.activitySummary);
    expect(wrapped).toEqual(example);
    expect(raw).toEqual(example);
    expect(wrapped).not.toHaveProperty('data');
  });
});
