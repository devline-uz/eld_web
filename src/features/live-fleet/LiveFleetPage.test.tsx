// web/tz.md §10 W-02 — the mandatory keyboard-operable left column (the map has no such
// requirement of its own) and the exact `No units are reporting` empty state.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { qk } from '@/shared/api/queryKeys';
import type { LiveFleetResponse } from '@/shared/api/liveFleet';
import LiveFleetPage from './LiveFleetPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
// Records each room's handlers so a test can play a socket frame into the page.
const roomHandlers = vi.hoisted(() => new Map<string, Record<string, (payload: unknown) => void>>());
vi.mock('@/shared/realtime/useRoom', () => ({
  useRoom: (room: string | null, handlers: Record<string, (payload: unknown) => void> = {}) => {
    if (room) roomHandlers.set(room, handlers);
    return { joined: false };
  },
}));
// The real map needs WebGL + `VITE_MAP_STYLE_URL` (FleetMap.withStyle.test.tsx covers it). Here
// a probe renders the props the page hands the map, so the layer chips have something observable.
vi.mock('@/shared/map/FleetMap', () => ({
  default: (props: {
    layers?: ReadonlySet<string>;
    geofences?: { features: unknown[] };
    trips?: { features: unknown[] };
  }) => (
    <div
      data-testid="fleet-map"
      data-layers={[...(props.layers ?? [])].sort().join(',')}
      data-geofences={props.geofences?.features.length ?? 0}
      data-trips={props.trips?.features.length ?? 0}
    />
  ),
}));

/** Renders the current router location so navigation can be asserted without a route tree. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntry = '/live-fleet', queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <LiveFleetPage />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('W-02 Live Fleet', () => {
  it('renders the exact empty-state copy when no units are reporting', async () => {
    server.use(http.get(url(endpoints.live.fleet), () => ok({ items: [], generatedAt: new Date().toISOString() })));

    renderPage();

    expect(await screen.findByText('No units are reporting', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(
      screen.getByText('Units appear here as soon as a driver connects to an ELD over Bluetooth.'),
    ).toBeInTheDocument();
  });

  it('the left column is a fully keyboard-operable list — no pointer required to select a unit', async () => {
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        ok({
          items: [
            {
              vehicleId: 'veh_1',
              unitNumber: '#101',
              driverId: 'drv_1',
              driverName: 'John Smith',
              driverPhone: '+1 334 765 4888',
              dutyStatus: 'ON_DUTY',
              speedMph: 0,
              lat: 39.96,
              lon: -82.99,
              locationLabel: '0.64 mi N of Florence, KY',
              lastSeenAt: new Date().toISOString(),
              driveRemainingSec: 0,
              shiftEndsAt: new Date(Date.now() + 60_000).toISOString(),
              eldSerial: 'PT30_A86E',
              bleState: 'CONNECTED',
            },
          ],
          generatedAt: new Date().toISOString(),
        }),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    const row = await screen.findByRole('button', { name: /Unit #101/ }, { timeout: 10_000 });
    row.focus();
    expect(row).toHaveFocus();
    await user.keyboard('{Enter}');

    // Selecting the row keyboard-only surfaces the same detail data the map's hover card shows.
    expect(await screen.findByText('View logs', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('John Smith · +1 334 765 4888')).toBeInTheDocument();

    // `Message` deep-links to this driver's conversation (WB-139), not the bare Messages page.
    await user.click(screen.getByRole('button', { name: 'Message' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages\?driverId=drv_1$/);
  });

  it('search, segments, layer toggles, closing the detail card and opening the geofence modal all work', async () => {
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        ok({
          items: [
            {
              vehicleId: 'veh_1',
              unitNumber: '#101',
              driverId: 'drv_1',
              driverName: 'John Smith',
              dutyStatus: 'DRIVING',
              speedMph: 61,
              lat: 39.96,
              lon: -82.99,
              locationLabel: '6 mi NE of Columbus, OH',
              lastSeenAt: new Date().toISOString(),
              driveRemainingSec: 16200,
              shiftEndsAt: new Date(Date.now() + 3_600_000).toISOString(),
              eldSerial: 'PT30_11B2',
              bleState: 'CONNECTED',
            },
            {
              vehicleId: 'veh_2',
              unitNumber: '#104',
              driverId: null,
              driverName: null,
              dutyStatus: 'ELD_OFFLINE',
              speedMph: null,
              lat: null,
              lon: null,
              locationLabel: '2.1 mi W of Dublin, OH',
              lastSeenAt: new Date().toISOString(),
              driveRemainingSec: null,
              shiftEndsAt: null,
              eldSerial: 'PT30_9931',
              bleState: 'DISCONNECTED',
            },
          ],
          generatedAt: new Date().toISOString(),
        }),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    // ELD-offline units render `—` for speed instead of a bogus 0 mph.
    expect(await screen.findByText('Unit #104', {}, { timeout: 8000 })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search unit, driver, plate…'), 'John');
    expect(screen.getByText('Unit #101')).toBeInTheDocument();
    expect(screen.queryByText('Unit #104')).not.toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText('Search unit, driver, plate…'));

    await user.click(screen.getByRole('button', { name: /Driving 1/ }));
    expect(screen.getByRole('button', { name: /Unit #101/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /All 2/ }));

    // Layer chips drive the map's `layers` prop (not just their own styling).
    const map = screen.getByTestId('fleet-map');
    expect(map).toHaveAttribute('data-layers', 'Vehicles');
    await user.click(screen.getByRole('button', { name: 'Trips' }));
    expect(screen.getByRole('button', { name: 'Trips' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Geofences' }));
    expect(map).toHaveAttribute('data-layers', 'Geofences,Trips,Vehicles');
    await user.click(screen.getByRole('button', { name: 'Trips' }));
    await user.click(screen.getByRole('button', { name: 'Geofences' }));
    expect(map).toHaveAttribute('data-layers', 'Vehicles');

    await user.click(screen.getByRole('button', { name: /Unit #101/ }));
    expect(await screen.findByText('Shift ends in', {}, { timeout: 8000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Shift ends in')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /New geofence/ }));
    expect(await screen.findByText('Create a geofence', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('layer chips: Vehicles hides units on the map only, Geofences loads and draws geofences, Traffic needs a tile URL', async () => {
    let geofenceRequests = 0;
    server.use(
      http.get(url(endpoints.live.fleet), () => ok({ items: [], generatedAt: new Date().toISOString() })),
      http.get(url(endpoints.geofences.list), () => {
        geofenceRequests += 1;
        return ok({
          items: [
            { id: 'gf_1', name: 'Columbus Terminal', type: 'CIRCLE', radiusMi: 1, alertOnEnter: true, centerLat: 39.96, centerLng: -82.99 },
            // No geometry in the payload → not drawn (never a shape at 0,0).
            { id: 'gf_2', name: 'Unknown', type: 'CIRCLE', radiusMi: 1, alertOnEnter: true },
          ],
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    const map = await screen.findByTestId('fleet-map', {}, { timeout: 8000 });

    // Traffic has no tile URL in this environment: disabled and says why.
    const traffic = screen.getByRole('button', { name: 'Traffic' });
    expect(traffic).toBeDisabled();
    expect(traffic).toHaveAttribute('aria-pressed', 'false');
    expect(traffic).toHaveAttribute('title', expect.stringMatching(/VITE_TRAFFIC_TILES_URL/));

    await user.click(screen.getByRole('button', { name: 'Vehicles' }));
    expect(screen.getByRole('button', { name: 'Vehicles' })).toHaveAttribute('aria-pressed', 'false');
    expect(map).toHaveAttribute('data-layers', '');

    // Geofences are fetched only once the layer is switched on.
    expect(geofenceRequests).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Geofences' }));
    await vi.waitFor(() => expect(map).toHaveAttribute('data-geofences', '1'), { timeout: 8000 });
    expect(geofenceRequests).toBe(1);
    expect(map).toHaveAttribute('data-layers', 'Geofences');
  });

  it('Traffic chip is enabled and toggles the layer once VITE_TRAFFIC_TILES_URL is set', async () => {
    vi.stubEnv('VITE_TRAFFIC_TILES_URL', 'https://tiles.example.com/traffic/{z}/{x}/{y}.png');
    server.use(http.get(url(endpoints.live.fleet), () => ok({ items: [], generatedAt: new Date().toISOString() })));

    const user = userEvent.setup();
    renderPage();
    const map = await screen.findByTestId('fleet-map', {}, { timeout: 8000 });

    const traffic = screen.getByRole('button', { name: 'Traffic' });
    expect(traffic).toBeEnabled();
    expect(traffic).not.toHaveAttribute('title');
    await user.click(traffic);
    expect(traffic).toHaveAttribute('aria-pressed', 'true');
    expect(map).toHaveAttribute('data-layers', 'Traffic,Vehicles');
  });

  it('error: renders <ErrorState> with Retry when the fleet feed fails', async () => {
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    // The map itself also falls back to its own "Map could not be loaded" `<ErrorState>` in this
    // jsdom environment (no `VITE_MAP_STYLE_URL`, see the file-level comment above) — two
    // independent Retry buttons is expected, not a leak.
    const retries = await screen.findAllByRole('button', { name: /retry/i }, { timeout: 8000 });
    expect(retries.length).toBeGreaterThanOrEqual(1);
  });
});

// Stage 3 — search name, detail-card close target, `View logs` for a driverless unit, and the
// `?unit=` deep link Vehicles → `Track on map` uses.
describe('W-02 Live Fleet — stage 3', () => {
  const unitRow = (vehicleId: string, unitNumber: string, driverId: string | null) => ({
    vehicleId,
    unitNumber,
    driverId,
    driverName: driverId ? 'John Smith' : null,
    dutyStatus: driverId ? 'DRIVING' : 'INACTIVE',
    speedMph: 0,
    lat: 39.96,
    lon: -82.99,
    locationLabel: 'Columbus, OH',
    lastSeenAt: new Date().toISOString(),
    driveRemainingSec: null,
    shiftEndsAt: null,
    eldSerial: 'PT30_1',
    bleState: 'CONNECTED',
  });

  beforeEach(() => {
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        ok({
          items: [unitRow('veh_1', '#101', 'drv_1'), unitRow('veh_2', '#104', null)],
          generatedAt: new Date().toISOString(),
        }),
      ),
    );
  });

  it('names the unit search box', async () => {
    renderPage();
    expect(await screen.findByRole('searchbox', { name: 'Search units' })).toBeInTheDocument();
  });

  it('`?unit=` opens that unit; a driverless unit disables View logs with the reason; Close is a 32px target and drops the param', async () => {
    const user = userEvent.setup();
    renderPage('/live-fleet?unit=veh_2');

    expect(await screen.findByRole('heading', { name: 'Unit #104' }, { timeout: 8000 })).toBeInTheDocument();
    const viewLogs = screen.getByRole('button', { name: 'View logs' });
    expect(viewLogs).toBeDisabled();
    expect(viewLogs).toHaveAccessibleDescription('No driver assigned — there are no logs to open.');

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.className).toContain('size-btn-sm');
    await user.click(close);
    expect(screen.queryByRole('heading', { name: 'Unit #104' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/live-fleet$/);
  });

  it('View logs for a unit with a driver opens that driver\'s logs', async () => {
    const user = userEvent.setup();
    renderPage('/live-fleet?unit=veh_1');
    await user.click(await screen.findByRole('button', { name: 'View logs' }, { timeout: 8000 }));
    expect(screen.getByTestId('location')).toHaveTextContent('/hos-logs?driverId=drv_1');
  });
});

// WB-257 / WB-258 — stress-test regressions: telemetry storms, 1 000-unit fleets.
describe('W-02 Live Fleet — performance', () => {
  const row = (i: number) => ({
    vehicleId: `veh_${i}`,
    unitNumber: `#${1000 + i}`,
    driverId: null,
    driverName: null,
    driverPhone: null,
    dutyStatus: 'DRIVING',
    speedMph: 50,
    headingDeg: null,
    odometerMi: null,
    lat: 39.96,
    lon: -82.99,
    locationLabel: 'Columbus, OH',
    lastSeenAt: new Date().toISOString(),
    driveRemainingSec: null,
    shiftEndsAt: null,
    eldSerial: null,
    bleState: 'CONNECTED',
  });

  it('telemetry.point is throttled: a mappable frame is patched with setQueryData, an unmappable burst refetches once', async () => {
    let fleetRequests = 0;
    server.use(
      http.get(url(endpoints.live.fleet), () => {
        fleetRequests += 1;
        return ok({ items: [row(1), row(2)], generatedAt: new Date().toISOString() });
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderPage('/live-fleet?unit=veh_1', queryClient);
    await screen.findByRole('heading', { name: 'Unit #1001' }, { timeout: 8000 });
    const requestsBefore = fleetRequests;
    const telemetry = roomHandlers.get('vehicle:veh_1')!['telemetry.point']!;

    // A frame with a fix patches only that unit, in place — no invalidate, no refetch.
    act(() => telemetry({ vehicleId: 'veh_1', count: 1, latitude: 41.5, longitude: -84, speedMph: 63 }));
    const cached = queryClient.getQueryData<LiveFleetResponse>(qk.liveFleet());
    expect(cached?.items.find((u) => u.vehicleId === 'veh_1')).toMatchObject({ lat: 41.5, speedMph: 63 });
    expect(invalidate).not.toHaveBeenCalled();

    // Today's `{ vehicleId, count }` frames: 50 in a burst → one leading invalidate + one trailing.
    act(() => {
      for (let i = 0; i < 50; i += 1) telemetry({ vehicleId: 'veh_1', count: 1 });
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await vi.waitFor(() => expect(fleetRequests).toBeGreaterThan(requestsBefore), { timeout: 4000 });
    expect(fleetRequests - requestsBefore).toBeLessThanOrEqual(2);
  });

  it('windows the unit list above 500 rows and keeps list semantics', async () => {
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        ok({ items: Array.from({ length: 600 }, (_, i) => row(i)), generatedAt: new Date().toISOString() }),
      ),
    );
    // jsdom lays nothing out — give the scroll container a real viewport so a window is computed.
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
    renderPage();
    expect(await screen.findByRole('button', { name: /All 600/ }, { timeout: 8000 })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Fleet units' });
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeLessThan(600);
    expect(items[0]).toHaveAttribute('aria-setsize', '600');
    expect(items[0]).toHaveAttribute('aria-posinset', '1');
    height.mockRestore();
    width.mockRestore();
  });

  it('ArrowDown / End move focus through the rows', async () => {
    server.use(
      http.get(url(endpoints.live.fleet), () => ok({ items: [row(1), row(2), row(3)], generatedAt: new Date().toISOString() })),
    );
    const user = userEvent.setup();
    renderPage();
    const first = await screen.findByRole('button', { name: /Unit #1001/ }, { timeout: 8000 });
    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /Unit #1002/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: /Unit #1003/ })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: /Unit #1002/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: /Unit #1001/ })).toHaveFocus();
  });
});
