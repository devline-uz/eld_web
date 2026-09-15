// web/tz.md §10 W-05 — Unit histories / route replay: loading skeleton and error-inside-the-card,
// tracked by web/tests/STATES-AUDIT.md. There is no dedicated §13.2 empty-state copy for this
// screen — a day with zero segments renders the same KPI/table shell with a 0-row table, which
// this suite also exercises — and no in-page forbidden render (the route guard owns it, see the
// generic RBAC route tests; `vehicles` is never `NONE` for any role so it is unreachable here).
// web/backend-gaps.md B-4 — `GET /vehicles/:id/histories` is MSW-only.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import UnitHistoriesPage from './UnitHistoriesPage';

const VEHICLE = {
  id: 'veh_1',
  unitNumber: '#101',
  vin: '1FUJGLDR8LLLL1234',
  make: 'Freightliner',
  model: 'Cascadia',
  year: 2021,
  licensePlate: '4821-JG',
  plateState: 'OH',
  fuelType: 'DIESEL',
  sleeperBerth: true,
  odometerMi: 993589,
  deviceOdometerMi: 981109,
  odometerOffsetMi: 12480,
  odometerCalibratedAt: null,
  engineHours: '1070.2',
  busType: null,
  status: 'ACTIVE',
  notes: null,
  activatedAt: '2025-04-18T00:00:00.000Z',
  createdAt: '2025-04-18T00:00:00.000Z',
};

function emptyHistories() {
  return {
    distanceMi: 0,
    driveSegments: 0,
    driveTimeSec: 0,
    avgSpeedMph: 0,
    stopCount: 0,
    stopTimeSec: 0,
    idleTimeSec: 0,
    idleFuelWastedGal: 0,
    firstMovementAt: '2026-09-01T08:00:00.000Z',
    lastMovementAt: '2026-09-01T08:00:00.000Z',
    engineOnSec: 0,
    engineOffSec: 0,
    longestDrive: { label: '—', durationSec: 0 },
    longestStop: { label: '—', durationSec: 0 },
    maxSpeedMph: 0,
    maxSpeedAt: '2026-09-01T08:00:00.000Z',
    segments: [],
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/vehicles/veh_1/histories']}>
          <Routes>
            <Route path="/vehicles/:id/histories" element={<UnitHistoriesPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(http.get(url(endpoints.vehicles.detail('veh_1')), () => ok(VEHICLE)));
});

describe('W-05 Unit histories — states', () => {
  it('loading: shows a skeleton before the day resolves', async () => {
    server.use(
      http.get(url(endpoints.vehicles.histories('veh_1')), async () => {
        await new Promise((r) => setTimeout(r, 50));
        return ok(emptyHistories());
      }),
    );
    renderPage();
    expect(document.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]').length).toBeGreaterThan(0);
    await screen.findByText('Route replay');
  });

  it('error: renders <ErrorState> with Retry when the day fetch fails', async () => {
    server.use(
      http.get(url(endpoints.vehicles.histories('veh_1')), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('a day with zero segments renders the 0-row table shell instead of crashing', async () => {
    server.use(http.get(url(endpoints.vehicles.histories('veh_1')), () => ok(emptyHistories())));
    renderPage();
    expect(await screen.findByText(/0 segments today/)).toBeInTheDocument();
  });
});
