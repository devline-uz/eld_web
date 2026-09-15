// web/bugs.md WB-048 — regression guard: no screen may fan `GET /logs/:driverId/range` out per driver.
// QA saw 308 of them in one session (one per driver, uncancelled). W-13 and W-15 read the fleet from
// `GET /reports/activity/summary` (B-46); W-15 reads one driver's range only when one driver is picked;
// W-01 never reads RODS ranges. Each screen is rendered against a 50-driver fleet and the peak number
// of concurrent range requests, and their total, must stay at or below MAX_RANGE_REQUESTS.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { ReactElement } from 'react';
import { http } from 'msw';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { reportDrivers, reportScreenHandlers } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import ActivityReportPage from '@/features/reports/ActivityReportPage';
import FmcsaPackPage from '@/features/reports/FmcsaPackPage';
import DashboardPage from '@/features/dashboard/DashboardPage';

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext('ADMIN') };
});
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: true }) }));

if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock';

const MAX_RANGE_REQUESTS = 5;
const FLEET = Array.from({ length: 50 }, (_, i) => ({
  ...reportDrivers[0]!,
  id: `drv_fan_${i}`,
  firstName: `Driver${i}`,
}));

let inFlight = 0;
let peak = 0;
let total = 0;

function render_(ui: ReactElement, route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Every MSW request, not only ranges: a range fan-out starts only after the drivers list resolves. */
let anyRequests = 0;
server.events.on('request:start', () => {
  anyRequests += 1;
});

/** Waits for 800 ms with no new request of any kind and no range request in flight (max 10 s). */
async function settle() {
  const deadline = Date.now() + 10_000;
  let seen = -1;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800));
    if (anyRequests === seen && inFlight === 0) return;
    seen = anyRequests;
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  inFlight = 0;
  peak = 0;
  total = 0;
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  // First match wins inside one `server.use` — the counting handlers must precede the screen set.
  server.use(
    http.get(url(endpoints.drivers.list), () => ok({ items: FLEET, page: 1, limit: 200, total: FLEET.length, totalPages: 1 })),
    http.get(url(endpoints.logs.range(':driverId')), async ({ params }) => {
      total += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 25));
      inFlight -= 1;
      return ok({ driverId: params.driverId, from: '2026-09-01', to: '2026-09-08', days: [] });
    }),
    ...reportScreenHandlers,
  );
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

describe(`no screen issues more than ${MAX_RANGE_REQUESTS} /logs/*/range requests (WB-048)`, () => {
  it.each([
    ['W-13 Activity', <ActivityReportPage key="a" />, '/reports/activity?from=2026-09-01&to=2026-09-08'],
    ['W-15 FMCSA pack · all drivers', <FmcsaPackPage key="f" />, '/reports/fmcsa?from=2026-09-01&to=2026-09-08'],
    ['W-15 FMCSA pack · one driver', <FmcsaPackPage key="f1" />, '/reports/fmcsa?from=2026-09-01&to=2026-09-08&driver=drv_fan_3'],
    ['W-01 Dashboard', <DashboardPage key="d" />, '/'],
  ])('%s', async (_name, ui, route) => {
    render_(ui, route);
    await settle();
    console.info(`[WB-048] ${_name}: ${total} range requests, peak ${peak} in flight`);
    expect(peak).toBeLessThanOrEqual(MAX_RANGE_REQUESTS);
    expect(total).toBeLessThanOrEqual(MAX_RANGE_REQUESTS);
  });
});
