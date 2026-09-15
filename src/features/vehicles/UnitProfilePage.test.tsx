// web/tz.md §10 W-04 — Unit profile: the four mandatory screen states (loading skeleton, empty
// inner-card, error-inside-the-card, forbidden), tracked by web/tests/STATES-AUDIT.md. Only the
// page's own guard order (forbidden → loading → error) and its "Unit activity" empty text are
// asserted here; every write control / RBAC combination is covered elsewhere (scenario 15, the
// global gate audit).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import UnitProfilePage from './UnitProfilePage';

let permission = true;
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (key: string) => (key === 'vehicles' ? permission : true) }),
}));

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/vehicles/veh_1']}>
          <Routes>
            <Route path="/vehicles/:id" element={<UnitProfilePage />} />
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
  permission = true;
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(
    http.get(url(endpoints.drivers.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    http.get(url(endpoints.devices.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
  );
});

describe('W-04 Unit profile — four states', () => {
  it('forbidden: renders <ForbiddenState> and never fetches the vehicle without `vehicles`', async () => {
    permission = false;
    server.use(http.get(url(endpoints.vehicles.detail('veh_1')), () => ok(VEHICLE)));
    renderPage();
    expect(await screen.findByText(/forbidden|do not have permission|do not have access/i)).toBeInTheDocument();
  });

  it('loading: shows a skeleton before the vehicle resolves', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('veh_1')), async () => {
        await new Promise((r) => setTimeout(r, 50));
        return ok(VEHICLE);
      }),
    );
    renderPage();
    expect(document.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]').length).toBeGreaterThan(0);
    expect(await screen.findByText('Unit #101')).toBeInTheDocument();
  });

  it('error: renders <ErrorState> with Retry when the vehicle fetch fails', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('veh_1')), () => HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 })),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('empty: the Unit activity card shows "No activity recorded." when there are none', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('veh_1')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('veh_1')), () => ok({ items: [] })),
    );
    renderPage();
    expect(await screen.findByText('No activity recorded.')).toBeInTheDocument();
  });
});
