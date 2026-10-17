// web/tz.md §10 W-02 — the mandatory keyboard-operable left column (the map has no such
// requirement of its own) and the exact `No units are reporting` empty state.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { qk } from '@/shared/api/queryKeys';
import type { LiveFleetResponse, LiveFleetUnit } from '@/shared/api/liveFleet';
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

/** `GET /live/fleet/:vehicleId` (the selected-unit card) served from the same rows a test's list
 * returns, so the card and the list describe the same fixture unit. */
const detailFrom = (items: Array<{ vehicleId: string }>) =>
  http.get(url(endpoints.live.unit(':vehicleId')), ({ params }) => {
    const unit = items.find((u) => u.vehicleId === params.vehicleId);
    return unit ? ok(unit) : fail(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
  });

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
  it('UI-003/UI-004: a stale unit is marked with its last update; an OOS record and a box-less unit say so', async () => {
    const base = {
      driverPhone: null, speedMph: null, headingDeg: null, odometerMi: null, lat: null, lon: null, locationLabel: null,
      driveRemainingSec: null, shiftEndsAt: null, eldSerial: null, bleState: null,
    };
    const staleSince = new Date(Date.now() - 4 * 24 * 3_600_000 - 60_000).toISOString();
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        ok({
          generatedAt: new Date().toISOString(),
          items: [
            { ...base, vehicleId: 'v_stale', unitNumber: '#201', driverId: 'drv_9', driverName: 'Stale Driver', dutyStatus: 'ELD_OFFLINE', lastSeenAt: staleSince, eldSerial: 'PT30_X', bleState: 'DISCONNECTED', recordStatus: 'ACTIVE', connectivity: 'ELD_OFFLINE', isStale: true, staleSince },
            { ...base, vehicleId: 'v_oos', unitNumber: '#202', driverId: null, driverName: null, dutyStatus: 'INACTIVE', lastSeenAt: null, recordStatus: 'OUT_OF_SERVICE', connectivity: 'NO_DEVICE', isStale: false, staleSince: null },
          ],
        }),
      ),
    );
    renderPage();

    const stale = (await screen.findByText('Unit #201')).closest('button')!;
    expect(stale).toHaveAttribute('data-stale', 'true');
    expect(within(stale).getByText('Last update 4 d ago')).toBeInTheDocument();
    expect(within(stale).getByText('ELD offline')).toBeInTheDocument();

    const oos = screen.getByText('Unit #202').closest('button')!;
    expect(within(oos).getByText('Out of service')).toBeInTheDocument();
    expect(within(oos).queryByText('Inactive')).not.toBeInTheDocument();
    expect(within(oos).getByText('No device')).toBeInTheDocument();
  });

  it('F3-03: a failed 30 s poll keeps the map mounted and the unit list, with a non-blocking notice', async () => {
    let failNow = false;
    const unit = {
      vehicleId: 'v1', unitNumber: '101', driverId: 'd1', driverName: 'John Smith', driverPhone: null,
      dutyStatus: 'DRIVING', speedMph: 55, headingDeg: 90, odometerMi: 1000, lat: 40, lon: -90,
      locationLabel: 'Somewhere', lastSeenAt: new Date().toISOString(), driveRemainingSec: 3600, shiftEndsAt: null,
      eldSerial: 'PT30_1', bleState: 'CONNECTED', recordStatus: 'ACTIVE', connectivity: 'ONLINE', isStale: false, staleSince: null,
    };
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        failNow ? fail(503, 'SERVICE_UNAVAILABLE', 'Down.') : ok({ items: [unit], generatedAt: new Date().toISOString() }),
      ),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage('/live-fleet', queryClient);
    expect(await screen.findByText('Unit 101')).toBeInTheDocument();
    const map = await screen.findByTestId('fleet-map');
    failNow = true;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: qk.liveFleet() }).catch(() => {});
    });
    expect(
      await screen.findByText('Could not refresh — showing the last loaded data.', {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('fleet-map')).toBe(map);
    expect(screen.getByText('Unit 101')).toBeInTheDocument();
    expect(screen.queryByText('Map could not be loaded')).toBeNull();
  }, 20000);

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
    // UI-017 — user-facing copy, never the env-var name.
    expect(traffic).toHaveAttribute('title', 'Traffic layer not available');

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
    const items = [unitRow('veh_1', '#101', 'drv_1'), unitRow('veh_2', '#104', null)];
    server.use(
      http.get(url(endpoints.live.fleet), () => ok({ items, generatedAt: new Date().toISOString() })),
      detailFrom(items),
    );
  });

  it('names the unit search box', async () => {
    renderPage();
    expect(await screen.findByRole('searchbox', { name: 'Search units' })).toBeInTheDocument();
  });

  it('FE-006: "Unit 104" and the plate find the unit; no match is a search empty state; chips count the matches', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        ok({
          items: [
            { id: 'veh_1', unitNumber: '101', licensePlate: 'OH-1234' },
            { id: 'veh_2', unitNumber: '104', licensePlate: 'KY 9876' },
          ],
          page: 1,
          limit: 200,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    const box = await screen.findByRole('searchbox', { name: 'Search units' });
    await screen.findByRole('button', { name: 'All 2' });

    await user.type(box, 'Unit 104');
    expect(await screen.findByRole('button', { name: 'All 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Driving 0' })).toBeInTheDocument();

    await user.clear(box);
    await user.type(box, 'oh1234');
    expect(await screen.findByRole('button', { name: 'All 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Driving 1' })).toBeInTheDocument();

    await user.clear(box);
    await user.type(box, 'Volvo');
    expect(await screen.findByText('Nothing matches "Volvo"')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_STATE_COPY.liveFleet.title)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(box).toHaveValue('');
    expect(await screen.findByRole('button', { name: 'All 2' })).toBeInTheDocument();
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

  it('F3-25: selecting a unit, searching and picking a segment are kept in the URL; a reload restores them', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage('/live-fleet?unit=veh_2');
    expect(await screen.findByRole('heading', { name: 'Unit #104' }, { timeout: 8000 })).toBeInTheDocument();

    await user.click(screen.getByText('Unit #101').closest('button')!);
    expect(await screen.findByRole('heading', { name: 'Unit #101' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('unit=veh_1');

    await user.click(screen.getByRole('button', { name: /^Driving/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search units' }), '101');
    const location = screen.getByTestId('location').textContent!;
    expect(location).toContain('segment=DRIVING');
    expect(location).toContain('q=101');

    // Closing the card drops only `unit`, never the search or the segment.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('location')).not.toHaveTextContent('unit=');
    expect(screen.getByTestId('location')).toHaveTextContent('segment=DRIVING');
    unmount();

    renderPage('/live-fleet?unit=veh_1&q=101&segment=DRIVING');
    expect(await screen.findByRole('heading', { name: 'Unit #101' }, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search units' })).toHaveValue('101');
    expect(screen.getByRole('button', { name: /^Driving/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('F3-24: the detail card shows no live speed or countdowns for a stale or ELD-offline unit', async () => {
    const full = { ...unitRow('veh_9', '#109', 'drv_9'), speedMph: 61, odometerMi: 1200, driveRemainingSec: 3600,
      shiftEndsAt: new Date(Date.now() + 3 * 3_600_000).toISOString(), isStale: true, connectivity: 'ELD_OFFLINE' };
    const { odometerMi: _o, driveRemainingSec: _d, shiftEndsAt: _s, eldSerial: _e, ...slim } = full;
    server.use(
      http.get(url(endpoints.live.fleet), () => ok({ items: [slim], generatedAt: new Date().toISOString() })),
      detailFrom([full]),
    );
    renderPage('/live-fleet?unit=veh_9');
    await screen.findByRole('heading', { name: 'Unit #109' }, { timeout: 8000 });
    const speed = screen.getByText('Speed / Odometer').nextElementSibling!;
    // The odometer is detail-only: it arrives with `GET /live/fleet/veh_9`.
    await vi.waitFor(() => expect(speed).toHaveTextContent('— · 1,200 mi'));
    expect(screen.getByText('Drive time left').nextElementSibling).toHaveTextContent('—');
    expect(screen.getByText('Shift ends in').nextElementSibling).toHaveTextContent('—');
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
      detailFrom([row(1), row(2)]),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderPage('/live-fleet?unit=veh_1', queryClient);
    await screen.findByRole('heading', { name: 'Unit #1001' }, { timeout: 8000 });
    const requestsBefore = fleetRequests;
    const telemetry = roomHandlers.get('fleet')!['telemetry.point']!;

    // A frame with a fix patches only that unit, in place — no invalidate, no refetch.
    act(() => telemetry({ vehicleId: 'veh_1', count: 1, latitude: 41.5, longitude: -84, speedMph: 63 }));
    const cached = queryClient.getQueryData<LiveFleetResponse>(qk.liveFleet());
    expect(cached?.items.find((u) => u.vehicleId === 'veh_1')).toMatchObject({ lat: 41.5, speedMph: 63 });
    expect(invalidate).not.toHaveBeenCalled();

    // Fix-less `{ vehicleId, count }` frames: 50 in a burst → one leading invalidate + one trailing.
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

// The fleet poll carries only the list/map fields (`?view=list`); the selected-unit card reads its
// full row from `GET /live/fleet/:vehicleId`, fetched only while a unit is selected.
describe('W-02 Live Fleet — slim list + selected-unit detail', () => {
  const full = (vehicleId: string, unitNumber: string): LiveFleetUnit => ({
    vehicleId,
    unitNumber,
    driverId: `drv_${vehicleId}`,
    driverName: 'John Smith',
    driverPhone: '+1 614 555 0142',
    dutyStatus: 'DRIVING',
    driverDutyStatus: 'DRIVING',
    speedMph: 55,
    headingDeg: 90,
    odometerMi: 741_220,
    lat: 39.96,
    lon: -82.99,
    locationLabel: 'Columbus, OH',
    lastSeenAt: new Date().toISOString(),
    driveRemainingSec: 2 * 3600,
    shiftEndsAt: new Date(Date.now() + 5 * 3_600_000).toISOString(),
    eldSerial: 'PT30_11B2',
    bleState: 'CONNECTED',
    recordStatus: 'ACTIVE',
    connectivity: 'ONLINE',
    isStale: false,
    staleSince: null,
  });
  const slim = (unit: LiveFleetUnit) => {
    const { driverPhone: _p, odometerMi: _o, driveRemainingSec: _d, shiftEndsAt: _s, eldSerial: _e, ...rest } = unit;
    return rest;
  };

  function serve(units: LiveFleetUnit[]) {
    const listViews: Array<string | null> = [];
    const detailRequests: string[] = [];
    server.use(
      http.get(url(endpoints.live.fleet), ({ request }) => {
        listViews.push(new URL(request.url).searchParams.get('view'));
        return ok({ items: units.map(slim), generatedAt: new Date().toISOString() });
      }),
      http.get(url(endpoints.live.unit(':vehicleId')), ({ params }) => {
        detailRequests.push(String(params.vehicleId));
        const unit = units.find((u) => u.vehicleId === params.vehicleId);
        return unit ? ok(unit) : fail(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
      }),
    );
    return { listViews, detailRequests };
  }

  it('polls the slim list and requests no unit detail while nothing is selected', async () => {
    const { listViews, detailRequests } = serve([full('veh_1', '#101'), full('veh_2', '#102')]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage('/live-fleet', queryClient);
    expect(await screen.findByRole('button', { name: /Unit #101/ }, { timeout: 8000 })).toBeInTheDocument();
    expect(listViews).toEqual(['list']);
    expect(detailRequests).toEqual([]);
    expect(queryClient.getQueryData(qk.liveFleetUnit('veh_1'))).toBeUndefined();
  });

  it('selecting a unit fetches its full row; the card shows the detail-only fields; closing stops it', async () => {
    const { detailRequests } = serve([full('veh_1', '#101'), full('veh_2', '#102')]);
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage('/live-fleet', queryClient);
    await user.click(await screen.findByRole('button', { name: /Unit #102/ }, { timeout: 8000 }));

    expect(await screen.findByRole('heading', { name: 'Unit #102' })).toBeInTheDocument();
    await vi.waitFor(() => expect(detailRequests).toEqual(['veh_2']));
    // Phone, odometer, HOS clocks and the ELD serial come only from `GET /live/fleet/veh_2`.
    expect(await screen.findByText(/\+1 614 555 0142/)).toBeInTheDocument();
    expect(screen.getByText('Speed / Odometer').nextElementSibling).toHaveTextContent('741,220 mi');
    // The countdown hook re-targets on its next 1 s tick (useCountdown.ts).
    await vi.waitFor(() => expect(screen.getByText('Drive time left').nextElementSibling).toHaveTextContent(/^0[12]:\d{2}:\d{2}$/), { timeout: 2500 });
    expect(screen.getByText('ELD').nextElementSibling).toHaveTextContent('PT30_11B2 · Connected');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Unit #102' })).not.toBeInTheDocument();
    const observed = queryClient.getQueryCache().find({ queryKey: qk.liveFleetUnit('veh_2'), exact: true });
    expect(observed?.getObserversCount() ?? 0).toBe(0);
    expect(detailRequests).toEqual(['veh_2']);
  });

  it('a telemetry.point frame for the selected unit patches both the list row and the detail row', async () => {
    serve([full('veh_1', '#101'), full('veh_2', '#102')]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage('/live-fleet?unit=veh_1', queryClient);
    await screen.findByRole('heading', { name: 'Unit #101' }, { timeout: 8000 });
    await vi.waitFor(() => expect(queryClient.getQueryData(qk.liveFleetUnit('veh_1'))).toBeDefined());
    const telemetry = roomHandlers.get('fleet')!['telemetry.point']!;

    const at = new Date().toISOString();
    act(() => telemetry({ vehicleId: 'veh_1', count: 1, latitude: 41.5, longitude: -84, speedMph: 63, headingDeg: 180, time: at }));
    const patched = { lat: 41.5, lon: -84, speedMph: 63, headingDeg: 180, lastSeenAt: at };
    expect(queryClient.getQueryData<LiveFleetResponse>(qk.liveFleet())?.items.find((u) => u.vehicleId === 'veh_1')).toMatchObject(patched);
    expect(queryClient.getQueryData<LiveFleetUnit>(qk.liveFleetUnit('veh_1'))).toMatchObject({ ...patched, driveRemainingSec: 7200 });

    // An unselected unit only moves on the map: its frame never touches the open card's row.
    act(() => telemetry({ vehicleId: 'veh_2', count: 1, latitude: 30, longitude: -90, speedMph: 10 }));
    await vi.waitFor(() =>
      expect(queryClient.getQueryData<LiveFleetResponse>(qk.liveFleet())?.items.find((u) => u.vehicleId === 'veh_2')).toMatchObject({ lat: 30 }),
    );
    expect(queryClient.getQueryData<LiveFleetUnit>(qk.liveFleetUnit('veh_1'))).toMatchObject(patched);
    expect(queryClient.getQueryData(qk.liveFleetUnit('veh_2'))).toBeUndefined();
    expect(screen.getByText('Speed / Odometer').nextElementSibling).toHaveTextContent('63 mph');
  });
});
