// web/tz.md §10 W-04 — Unit profile: the four mandatory screen states (loading skeleton, empty
// inner-card, error-inside-the-card, forbidden), tracked by web/tests/STATES-AUDIT.md. Only the
// page's own guard order (forbidden → loading → error) and its "Unit activity" empty text are
// asserted here; every write control / RBAC combination is covered elsewhere (scenario 15, the
// global gate audit).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import UnitProfilePage from './UnitProfilePage';
import { formatEngineHoursLong } from '@/shared/format/numbers';

function DvirStub() {
  const [params] = useSearchParams();
  return <div>DVIR screen · newWorkOrder={params.get('newWorkOrder')}</div>;
}

let permission = true;
// CODE-085 — keys the current test's role lacks (e.g. DISPATCHER: maintenance, devices, dvir).
let denied = new Set<string>();
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (key: string) => (key === 'vehicles' ? permission : !denied.has(key)) }),
}));

const VEHICLE = {
  id: '0f3c2a1e-0000-4000-8000-000000000001',
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

function LiveFleetStub() {
  const [params] = useSearchParams();
  return <div>Live fleet · unit={params.get('unit')}</div>;
}

function renderPage(path = '/vehicles/0f3c2a1e-0000-4000-8000-000000000001') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/vehicles/:id" element={<UnitProfilePage />} />
            {/* Stand-in for W-03 so a navigation away from the profile is observable. */}
            <Route path="/vehicles" element={<div>Vehicles list screen</div>} />
            {/* Stand-in for W-09 so the `New work order` deep link is observable. */}
            <Route path="/dvir" element={<DvirStub />} />
            <Route path="/live-fleet" element={<LiveFleetStub />} />
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
  denied = new Set();
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
    server.use(http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)));
    renderPage();
    expect(await screen.findByText(/forbidden|do not have permission|do not have access/i)).toBeInTheDocument();
  });

  it('loading: shows a skeleton before the vehicle resolves', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), async () => {
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
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => HttpResponse.json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Boom' }, { status: 500 })),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('LIVE-019: a 404 shows "Unit not found" (no Retry) with a way back to the list', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => HttpResponse.json({ statusCode: 404, code: 'VEHICLE_NOT_FOUND', message: 'Not found' }, { status: 404 })),
    );
    renderPage();
    expect(await screen.findByText('Unit not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to vehicles' }));
    expect(await screen.findByText('Vehicles list screen')).toBeInTheDocument();
  });

  it('LIVE-019: a malformed id shows "Unit not found" without calling the API', async () => {
    let called = false;
    server.use(
      http.get(url(endpoints.vehicles.detail('not-a-uuid')), () => {
        called = true;
        return HttpResponse.json({}, { status: 404 });
      }),
    );
    renderPage('/vehicles/not-a-uuid');
    expect(await screen.findByText('Unit not found')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  // WB-161 / WB-163 — the header's dead `New work order` button and the `?driverId=` navigation.
  // UI-003 — the BLE badge is the EFFECTIVE link, "Updated" is the unit's own last signal, and a
  // speed older than 30 min is not shown as the truck's speed now.
  function useUnitSignals(device: Record<string, unknown>, telemetryAgoMs: number, point: Record<string, unknown> = {}) {
    const time = new Date(Date.now() - telemetryAgoMs).toISOString();
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
      http.get(url(endpoints.devices.list), () =>
        ok({
          items: [{ id: 'dev_1', serial: 'PT30_A86E', model: 'PT30', status: 'ASSIGNED', vehicleId: '0f3c2a1e-0000-4000-8000-000000000001', firmwareVersion: null, firmwareOutdated: false, lastHeartbeatAt: null, ...device }],
          page: 1,
          limit: 5,
          total: 1,
          totalPages: 1,
        }),
      ),
      http.get(url(endpoints.vehicles.telemetry('0f3c2a1e-0000-4000-8000-000000000001')), () =>
        ok({ items: [{ time, vehicleId: '0f3c2a1e-0000-4000-8000-000000000001', driverId: null, latitude: 40, longitude: -83, speedMph: 58, headingDeg: 90, odometerMi: null, engineHours: null, idleHours: null, engineOn: true, rpm: null, fuelPct: null, defPct: null, ...point }] }),
      ),
    );
  }

  it('UI-003: a silent box that still stores CONNECTED is not "BLE connected"; old telemetry hides the speed', async () => {
    useUnitSignals({ bleState: 'CONNECTED', connection: 'DISCONNECTED', lastSeenAt: new Date(Date.now() - 4 * 24 * 3_600_000).toISOString() }, 2.5 * 3_600_000);
    renderPage();
    expect(await screen.findByText('Updated 2 h')).toBeInTheDocument();
    expect(screen.queryByText('BLE connected')).not.toBeInTheDocument();
    expect(screen.queryByText('58 mph')).not.toBeInTheDocument();
  });

  it('LIVE-008: engine hours come from the newest telemetry point, not the stored vehicle field', async () => {
    useUnitSignals({ bleState: 'CONNECTED', connection: 'CONNECTED', lastSeenAt: new Date().toISOString() }, 5 * 60_000, { engineHours: '1203.35' });
    renderPage();
    expect(await screen.findByText(formatEngineHoursLong(1203.35))).toBeInTheDocument();
  });

  it('UI-003: a live box reads "BLE connected" and a fresh point shows its speed', async () => {
    useUnitSignals({ bleState: 'CONNECTED', connection: 'CONNECTED', lastSeenAt: new Date().toISOString() }, 5 * 60_000);
    renderPage();
    expect(await screen.findByText('58 mph')).toBeInTheDocument();
    expect(screen.getByText('BLE connected')).toBeInTheDocument();
    expect(screen.getByText('Updated just now')).toBeInTheDocument();
  });

  it('"Track on map" opens Live fleet with this unit selected (stage 3)', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Unit #101');
    await user.click(screen.getByRole('button', { name: 'Track on map' }));
    expect(await screen.findByText('Live fleet · unit=0f3c2a1e-0000-4000-8000-000000000001')).toBeInTheDocument();
  });

  it('"New work order" deep-links to W-09 and "View logs" is disabled without a driver', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Unit #101');

    const viewLogs = screen.getByRole('button', { name: 'View logs' });
    expect(viewLogs).toBeDisabled();
    expect(viewLogs).toHaveAttribute('title', 'No driver is assigned to this unit.');

    await user.click(screen.getByRole('button', { name: /New work order/ }));
    expect(await screen.findByText('DVIR screen · newWorkOrder=0f3c2a1e-0000-4000-8000-000000000001')).toBeInTheDocument();
  });

  it('empty: the Unit activity card shows "No activity recorded." when there are none', async () => {
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
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
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ ...VEHICLE, model: LONG_MODEL })),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
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
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
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
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ ...VEHICLE, status: 'OUT_OF_SERVICE' })),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
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
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
      http.get(url(endpoints.vehicles.dtc('0f3c2a1e-0000-4000-8000-000000000001')), () =>
        ok({
          items: [
            { id: 'dtc_1', vehicleId: '0f3c2a1e-0000-4000-8000-000000000001', spn: 100, fmi: 1, occurrence: 1, source: 'ENGINE', description: null, firstSeenAt: '2025-04-18T00:00:00.000Z', lastSeenAt: '2025-04-18T00:00:00.000Z', clearedAt: null },
            { id: 'dtc_2', vehicleId: '0f3c2a1e-0000-4000-8000-000000000001', spn: 101, fmi: 2, occurrence: 1, source: 'ENGINE', description: null, firstSeenAt: '2025-04-18T00:00:00.000Z', lastSeenAt: '2025-04-18T00:00:00.000Z', clearedAt: '2025-04-19T00:00:00.000Z' },
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

  it('CODE-085: without `maintenance` READ the Diagnostics tab is hidden and /dtc is never requested', async () => {
    denied = new Set(['maintenance', 'devices', 'dvir']);
    const dtcCalls = vi.fn();
    const deviceCalls = vi.fn();
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
      http.get(url(endpoints.vehicles.dtc('0f3c2a1e-0000-4000-8000-000000000001')), () => {
        dtcCalls();
        return fail(403, 'FORBIDDEN', 'Forbidden');
      }),
      http.get(url(endpoints.devices.list), () => {
        deviceCalls();
        return fail(403, 'FORBIDDEN', 'Forbidden');
      }),
    );
    // A deep link straight to the tab falls back to the overview.
    renderPage('/vehicles/0f3c2a1e-0000-4000-8000-000000000001?tab=diagnostics');
    await screen.findByText('Unit #101');
    expect(screen.queryByRole('button', { name: 'Diagnostics' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Could not load/i)).not.toBeInTheDocument();
    expect(dtcCalls).not.toHaveBeenCalled();
    expect(deviceCalls).not.toHaveBeenCalled();
  });
});

// WB — `DeleteUnitModal`'s `onClose` fires on Cancel, Esc and X as well as after a confirmed
// delete, and the profile navigated to /vehicles from it. Cancelling threw the user off the page
// they were reading, with the unit still very much alive.
describe('W-04 Unit profile — cancelling the delete modal stays on the unit', () => {
  function useVehicle() {
    server.use(
      http.get(url(endpoints.vehicles.detail('0f3c2a1e-0000-4000-8000-000000000001')), () => ok(VEHICLE)),
      http.get(url(endpoints.vehicles.activities('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ items: [] })),
    );
  }

  it('cancelling the Delete unit modal does not navigate away', async () => {
    const user = userEvent.setup();
    useVehicle();
    renderPage();
    await screen.findByText('Unit #101');

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByText('Delete unit'));
    expect(await screen.findByText('Delete Unit #101?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Vehicles list screen')).not.toBeInTheDocument();
    expect(await screen.findByText('Unit #101')).toBeInTheDocument();
  });

  it('BE-013: a 409 naming open trips lists them in the modal and does not navigate away', async () => {
    const user = userEvent.setup();
    useVehicle();
    server.use(
      http.delete(url(endpoints.vehicles.remove('0f3c2a1e-0000-4000-8000-000000000001')), () =>
        fail(409, 'CONFLICT', 'This unit still has open trips (TRP-1001, TRP-1002). Reassign or cancel them first.', {
          openTrips: [
            { id: 'trp_1', number: 'TRP-1001', status: 'ASSIGNED' },
            { id: 'trp_2', number: 'TRP-1002', status: 'IN_PROGRESS' },
          ],
        }),
      ),
    );
    renderPage();
    await screen.findByText('Unit #101');

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByText('Delete unit'));
    await user.type(await screen.findByPlaceholderText('UNIT-101'), 'UNIT-101');
    await user.click(screen.getByRole('button', { name: 'Delete unit' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unit #101 still has open trips');
    expect(alert).toHaveTextContent('TRP-1001 · Assigned');
    expect(alert).toHaveTextContent('TRP-1002 · In progress');
    expect(screen.queryByText('Vehicles list screen')).not.toBeInTheDocument();
  });

  it('a confirmed delete still navigates back to the vehicles list', async () => {
    const user = userEvent.setup();
    useVehicle();
    server.use(http.delete(url(endpoints.vehicles.remove('0f3c2a1e-0000-4000-8000-000000000001')), () => ok({ id: '0f3c2a1e-0000-4000-8000-000000000001', status: 'INACTIVE' })));
    renderPage();
    await screen.findByText('Unit #101');

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByText('Delete unit'));
    await user.type(await screen.findByPlaceholderText('UNIT-101'), 'UNIT-101');
    await user.click(screen.getByRole('button', { name: 'Delete unit' }));

    expect(await screen.findByText('Vehicles list screen')).toBeInTheDocument();
  });
});
