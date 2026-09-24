// web/tz.md §10 W-11 — KPI row, trip selection updating the route timeline, the exact empty
// states, and `POST /trips/auto-assign`'s exact toast wording.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { tripsActiveSliceQuery, tripsKpiQuery } from '@/shared/api/trips';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import * as RealtimeProviderModule from '@/shared/realtime/RealtimeProvider';
import TripsPage from './TripsPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));

function fakeSocket() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    emit: vi.fn((event: string, ...args: unknown[]) => {
      if (event === 'subscribe') {
        const [, ack] = args as [string, (a: { ok: boolean }) => void];
        ack({ ok: true });
      }
    }),
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    }),
    off: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    trigger(event: string, payload: unknown) {
      listeners.get(event)?.forEach((l) => l(payload));
    },
  };
}

function renderPage(socket: ReturnType<typeof fakeSocket> | null = null) {
  vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
    getSocket: () => socket as never,
    connected: Boolean(socket),
    isOffline: false,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { queryClient, ...render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <TripsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  ) };
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
});

const DRIVER = {
  id: 'drv_1',
  username: 'johnsmith',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  phone: null,
  cdlNumber: 'W8569238',
  cdlState: 'OH',
  status: 'ACTIVE',
  homeTerminalName: 'Columbus, OH',
  homeTerminalTimezone: 'America/New_York',
  fleetManagerId: null,
  assignedVehicleId: 'veh_1',
  allowPersonalConveyance: true,
  allowYardMove: true,
  adverseDrivingEnabled: false,
  shortHaulException: false,
  splitSleeperEnabled: false,
  eldExempt: false,
  eldExemptReason: null,
  appVersion: 'v2.24',
  appPlatform: 'Android',
  registeredAt: '2025-04-18T00:00:00.000Z',
};

const VEHICLE = {
  id: 'veh_1',
  unitNumber: '101',
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

const TRIP = {
  id: 'trp_1',
  number: 'TR-4821',
  driverId: 'drv_1',
  vehicleId: 'veh_1',
  trailerId: null,
  status: 'IN_PROGRESS',
  shippingDocument: 'BOL #4821-A',
  commodity: null,
  weightLbs: 38500,
  pieces: null,
  plannedStartAt: '2026-09-10T05:30:00.000Z',
  plannedEndAt: null,
  startedAt: '2026-09-10T05:30:00.000Z',
  completedAt: null,
  etaAt: '2026-01-01T00:00:00.000Z', // far in the past relative to `now` → Late
  onTime: false,
  notes: null,
  createdById: 'usr_1',
  createdAt: '2026-09-09T00:00:00.000Z',
  stops: [
    { id: 'stp_1', tripId: 'trp_1', sequence: 1, type: 'PICKUP', name: 'Columbus, OH', address: null, latitude: null, longitude: null, scheduledAt: null, arrivedAt: '2026-09-10T05:30:00.000Z', departedAt: '2026-09-10T05:41:00.000Z', status: 'COMPLETED', note: null },
    { id: 'stp_2', tripId: 'trp_1', sequence: 2, type: 'DELIVERY', name: 'Florence, KY', address: null, latitude: null, longitude: null, scheduledAt: '2026-09-10T17:40:00.000Z', arrivedAt: null, departedAt: null, status: 'PENDING', note: null },
  ],
};

/** Answers like the real `GET /trips`: one page, narrowed by the `status` param (WD-073). */
function usePopulatedTrips() {
  server.use(
    http.get(url(endpoints.trips.list), ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      const items = !status || status === TRIP.status ? [TRIP] : [];
      return ok({ items, page: 1, limit: 25, total: items.length, totalPages: 1 });
    }),
    http.get(url(endpoints.drivers.list), () => ok({ items: [DRIVER], page: 1, limit: 500, total: 1, totalPages: 1 })),
    http.get(url(endpoints.vehicles.list), () => ok({ items: [VEHICLE], page: 1, limit: 500, total: 1, totalPages: 1 })),
    http.get(url(endpoints.trips.unassignedLoads), () => ok({ items: [] })),
  );
}

describe('W-11 Dispatch & Trips', () => {
  it('renders the exact §13.2 empty-state copy when there are no active trips', async () => {
    server.use(
      http.get(url(endpoints.trips.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.drivers.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.trips.unassignedLoads), () => ok({ items: [] })),
    );

    renderPage();

    expect(await screen.findByText('No active trips')).toBeInTheDocument();
    expect(screen.getByText('Create a trip to dispatch a load to a driver.')).toBeInTheDocument();
  });

  it('renders the 4 KPI cards and a Late (red) ETA for a trip past its ETA', async () => {
    usePopulatedTrips();
    renderPage();

    expect(await screen.findByText('On-time delivery')).toBeInTheDocument();
    expect(screen.getAllByText('Active trips').length).toBeGreaterThan(0);
    expect(screen.getByText('Running late')).toBeInTheDocument();
    expect(screen.getByText('Unassigned loads')).toBeInTheDocument();

    expect(await screen.findByText('TR-4821')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  it('selecting a trip updates the route timeline card', async () => {
    usePopulatedTrips();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('TR-4821');
    expect(await screen.findByText('Route · TR-4821')).toBeInTheDocument();
    expect(screen.getByText('Florence, KY')).toBeInTheDocument();

    await user.click(screen.getByText('TR-4821'));
    expect(screen.getByText('Route · TR-4821')).toBeInTheDocument();
  });

  it('shows the "No loads waiting" empty state on the Unassigned segment', async () => {
    usePopulatedTrips();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('TR-4821');
    await user.click(screen.getByRole('button', { name: /Unassigned 0/ }));
    expect(await screen.findByText('No loads waiting')).toBeInTheDocument();
    expect(screen.getByText('Every load has a driver assigned.')).toBeInTheDocument();
  });

  it('Auto-assign shows the exact §10 toast wording', async () => {
    usePopulatedTrips();
    server.use(
      http.post(url(endpoints.trips.autoAssign), () => ok({ assigned: [{ tripId: 'trp_2', driverId: 'drv_1' }], skipped: 1 })),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('TR-4821');
    await user.click(screen.getByRole('button', { name: /Unassigned 0/ }));
    await user.click(await screen.findByRole('button', { name: 'Auto-assign' }));

    expect(await screen.findByText('1 loads assigned · 1 skipped (no driver with enough hours)')).toBeInTheDocument();
  });

  it('a `trip.status_changed` event on the `fleet` room patches the row immediately and invalidates the KPI/count queries so they settle correctly (WB-114)', async () => {
    // A mutable mock — the backend's row has already moved to its new status by the time the
    // event arrives, so a refetch of the invalidated slices must reflect that move too, not
    // just the immediate client-side patch.
    let currentStatus: string = TRIP.status;
    server.use(
      http.get(url(endpoints.trips.list), ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        const items = !status || status === currentStatus ? [{ ...TRIP, status: currentStatus }] : [];
        return ok({ items, page: 1, limit: 25, total: items.length, totalPages: 1 });
      }),
      http.get(url(endpoints.drivers.list), () => ok({ items: [DRIVER], page: 1, limit: 500, total: 1, totalPages: 1 })),
      http.get(url(endpoints.vehicles.list), () => ok({ items: [VEHICLE], page: 1, limit: 500, total: 1, totalPages: 1 })),
      http.get(url(endpoints.trips.unassignedLoads), () => ok({ items: [] })),
    );
    const socket = fakeSocket();
    const { queryClient } = renderPage(socket);

    await screen.findByText('TR-4821');
    expect(screen.getByText('Late')).toBeInTheDocument();
    expect(socket.emit).toHaveBeenCalledWith('subscribe', 'fleet', expect.any(Function));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    currentStatus = 'ASSIGNED';
    socket.trigger('trip.status_changed', { tripId: 'trp_1', status: 'ASSIGNED', eta: '2099-06-15T13:37:00.000Z' });

    // The row is patched in place via `setQueryData` — immediate, synchronous, no round trip.
    const patchedImmediately = queryClient.getQueryData<{ items: Array<{ id: string; status: string; etaAt: string }> }>(
      tripsActiveSliceQuery('IN_PROGRESS').queryKey,
    );
    expect(patchedImmediately?.items.find((t) => t.id === 'trp_1')?.status).toBe('ASSIGNED');
    expect(patchedImmediately?.items.find((t) => t.id === 'trp_1')?.etaAt).toBe('2099-06-15T13:37:00.000Z');

    // A status change can move a trip between the status-filtered KPI/count slices, so those
    // exact keys must be invalidated — never the whole `trips` list (§16.3).
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        tripsActiveSliceQuery('ASSIGNED').queryKey,
        tripsActiveSliceQuery('IN_PROGRESS').queryKey,
        tripsActiveSliceQuery('DRAFT').queryKey,
        tripsActiveSliceQuery('PLANNED').queryKey,
        tripsKpiQuery().queryKey,
      ]),
    );

    // Once those queries refetch, the trip has moved slices entirely — the KPI/count numbers
    // this fix protects are correct, not just the row's own fields.
    await waitFor(() => {
      const assigned = queryClient.getQueryData<{ items: Array<{ id: string }> }>(tripsActiveSliceQuery('ASSIGNED').queryKey);
      expect(assigned?.items.some((t) => t.id === 'trp_1')).toBe(true);
    });
    const inProgressAfter = queryClient.getQueryData<{ items: Array<{ id: string }> }>(tripsActiveSliceQuery('IN_PROGRESS').queryKey);
    expect(inProgressAfter?.items.some((t) => t.id === 'trp_1')).toBe(false);
  });

  it('names the search box and clears it with the × button (stage 3)', async () => {
    usePopulatedTrips();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('TR-4821');
    const search = screen.getByRole('textbox', { name: 'Search trips' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    await user.type(search, 'TR-48');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('opens the Create trip modal', async () => {
    usePopulatedTrips();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('TR-4821');
    await user.click(screen.getByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText('Dispatch a load to a driver and unit')).toBeInTheDocument();
  });

  it('error: renders <ErrorState> with Retry when the trips list fails', async () => {
    server.use(
      http.get(url(endpoints.trips.list), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
