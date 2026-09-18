// web/tz.md §10 W-04 — Unit profile: the four mandatory screen states (loading skeleton, empty
// inner-card, error-inside-the-card, forbidden), tracked by web/tests/STATES-AUDIT.md. Only the
// page's own guard order (forbidden → loading → error) and its "Unit activity" empty text are
// asserted here; every write control / RBAC combination is covered elsewhere (scenario 15, the
// global gate audit).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// Regression: a long detail value (VIN, make/model, ELD serial) used to run into its label and
// spill past the "Unit details" card — the value cell could not shrink below its content (flex
// `min-width: auto`) and had no wrap rule. The row now gaps the pair, pins the label, and lets
// the value wrap instead of truncating, so the whole value stays readable. Mirrors W-07.
describe('W-04 Unit profile — long values stay inside the unit details card', () => {
  const LONG_MODEL = 'Cascadia-Evolution-Sleeper-XT-126BBC-LongTrimPackage';

  it('wraps a long make / model inside its row instead of overflowing the card', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('veh_1')), () => ok({ ...VEHICLE, model: LONG_MODEL })),
      http.get(url(endpoints.vehicles.activities('veh_1')), () => ok({ items: [] })),
    );
    renderPage();
    await screen.findByText('Unit #101');

    const value = await screen.findByText(`Freightliner ${LONG_MODEL}`);
    expect(value.className).toContain('min-w-0');
    expect(value.className).toContain('break-words');

    const row = value.parentElement as HTMLElement;
    expect(row.className).toContain('gap-4');

    const label = screen.getByText('Make / model');
    expect(label.className).toContain('shrink-0');
    expect(label.parentElement).toBe(row);
  });

  it('leaves short values untouched in the same row layout', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('veh_1')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('veh_1')), () => ok({ items: [] })),
    );
    renderPage();
    await screen.findByText('Unit #101');

    const plate = await screen.findByText('4821-JG');
    expect(plate.className).toContain('text-right');
    expect((plate.parentElement as HTMLElement).className).toContain('justify-between');
  });
});

// WB-104 — the header `Assign driver` button used to disable itself (no `title`) for an
// OUT_OF_SERVICE unit, silently defeating `AssignDriverModal`, whose own contract is to state the
// CRITICAL-defect refusal instead of a silent 409. The button must stay clickable and open the
// modal, exactly like the Vehicles table row action (`VehiclesPage.tsx`).
describe('W-04 Unit profile — Assign driver stays clickable when OUT_OF_SERVICE', () => {
  it('opens AssignDriverModal, which states the refusal, instead of disabling the button', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.vehicles.detail('veh_1')), () => ok({ ...VEHICLE, status: 'OUT_OF_SERVICE' })),
      http.get(url(endpoints.vehicles.activities('veh_1')), () => ok({ items: [] })),
    );
    renderPage();
    await screen.findByText('Unit #101');

    const assignButton = screen.getByRole('button', { name: 'Assign driver' });
    expect(assignButton).not.toBeDisabled();

    await user.click(assignButton);
    expect(
      await screen.findByText(/is out of service\. Close the critical defect before assigning/),
    ).toBeInTheDocument();
  });
});

// WB-105 — `activeDtcCount` used to be a dead `const activeDtcCount = 0`, so the header's
// "N active DTCs" badge never rendered even once the Diagnostics tab had loaded uncleared DTCs.
describe('W-04 Unit profile — active DTC badge (WB-105)', () => {
  it('shows the count of uncleared DTCs once the Diagnostics tab has loaded them', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.vehicles.detail('veh_1')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('veh_1')), () => ok({ items: [] })),
      http.get(url(endpoints.vehicles.dtc('veh_1')), () =>
        ok({
          items: [
            { id: 'dtc_1', vehicleId: 'veh_1', spn: 100, fmi: 1, occurrence: 1, source: 'ENGINE', description: null, firstSeenAt: '2025-04-18T00:00:00.000Z', lastSeenAt: '2025-04-18T00:00:00.000Z', clearedAt: null },
            { id: 'dtc_2', vehicleId: 'veh_1', spn: 101, fmi: 2, occurrence: 1, source: 'ENGINE', description: null, firstSeenAt: '2025-04-18T00:00:00.000Z', lastSeenAt: '2025-04-18T00:00:00.000Z', clearedAt: '2025-04-19T00:00:00.000Z' },
          ],
        }),
      ),
    );
    renderPage();
    await screen.findByText('Unit #101');
    expect(screen.queryByText(/active DTCs/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Diagnostics' }));
    expect(await screen.findByText('1 active DTCs')).toBeInTheDocument();
  });
});
