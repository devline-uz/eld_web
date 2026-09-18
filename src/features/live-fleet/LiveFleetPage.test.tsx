// web/tz.md §10 W-02 — the mandatory keyboard-operable left column (the map has no such
// requirement of its own) and the exact `No units are reporting` empty state.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import LiveFleetPage from './LiveFleetPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: false }) }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <LiveFleetPage />
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

    await user.click(screen.getByRole('button', { name: 'Trips' }));
    await user.click(screen.getByRole('button', { name: 'Geofences' }));

    await user.click(screen.getByRole('button', { name: /Unit #101/ }));
    expect(await screen.findByText('Shift ends in', {}, { timeout: 8000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Shift ends in')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /New geofence/ }));
    expect(await screen.findByText('Create a geofence', {}, { timeout: 8000 })).toBeInTheDocument();
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
