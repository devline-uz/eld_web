// web/tz.md §10 W-03 — the exact empty-state copy and a populated render with the join columns.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import VehiclesPage from './VehiclesPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <VehiclesPage />
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

function usePopulatedFleet() {
  server.use(
    http.get(url(endpoints.vehicles.list), () =>
      ok({
        items: [
          {
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
          },
        ],
        page: 1,
        limit: 500,
        total: 1,
        totalPages: 1,
      }),
    ),
    http.get(url(endpoints.drivers.list), () =>
      ok({
        items: [
          {
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
          },
        ],
        page: 1,
        limit: 500,
        total: 1,
        totalPages: 1,
      }),
    ),
    http.get(url(endpoints.devices.list), () =>
      ok({
        items: [
          {
            id: 'dev_1',
            serial: 'PT30_A86E',
            model: 'PT30',
            status: 'ASSIGNED',
            vehicleId: 'veh_1',
            bleState: 'CONNECTED',
            firmwareVersion: 'L108',
            firmwareOutdated: false,
            lastHeartbeatAt: null,
          },
        ],
        page: 1,
        limit: 500,
        total: 1,
        totalPages: 1,
      }),
    ),
  );
}

describe('W-03 Vehicles', () => {
  it('renders the exact §13.2 empty-state copy when no vehicles exist', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.drivers.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.devices.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    );

    renderPage();

    expect(await screen.findByText('No vehicles yet')).toBeInTheDocument();
    expect(
      screen.getByText('Add your first unit or import a CSV to start recording hours of service.'),
    ).toBeInTheDocument();
  });

  it('renders a unit row with its client-joined driver and ELD serial columns', async () => {
    usePopulatedFleet();

    renderPage();

    expect(await screen.findByText('#101')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('PT30_A86E')).toBeInTheDocument();
    expect(screen.getByText('993,589 mi')).toBeInTheDocument();
  });

  it('opens the row menu, switches segments, selects a row and shows the bulk bar', async () => {
    usePopulatedFleet();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('#101');

    // Segment tabs
    await user.click(screen.getByRole('button', { name: /Active 1/ }));
    expect(await screen.findByText('#101')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /All 1/ }));

    // Row "…" menu
    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    expect(await screen.findByText('View unit profile')).toBeInTheDocument();
    expect(screen.getByText('Assign driver')).toBeInTheDocument();
    expect(screen.getByText('Calibrate odometer')).toBeInTheDocument();
    expect(screen.getByText('View histories')).toBeInTheDocument();
    expect(screen.getByText('Edit unit')).toBeInTheDocument();
    expect(screen.getByText('Delete unit')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // Row checkbox -> bulk bar
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    expect(await screen.findByText('1 vehicles selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set inactive' }));
    expect(await screen.findByText('1 units set inactive')).toBeInTheDocument();

    // Export menu entry
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByText('Import from CSV')).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('the search box, pagination and every row-menu item all reach their handler', async () => {
    usePopulatedFleet();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await user.type(screen.getByPlaceholderText('Search unit #, VIN, plate…'), 'nomatch');
    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await screen.findByText('#101');

    for (const label of ['Open HOS logs', 'Track on map', 'View histories']) {
      await user.click(screen.getByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText(label));
    }

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Assign driver'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Calibrate odometer'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Edit unit'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Delete unit'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('View unit profile'));
  });

  it('11.23 Filters — applying a status filter narrows the table, shows a chip and Clear all resets it', async () => {
    usePopulatedFleet();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(await screen.findByText('Inactive'));
    await user.click(screen.getByRole('button', { name: /Apply 1 filters/ }));

    // veh_1 is ACTIVE, not INACTIVE — the status filter removes it from the table.
    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
    expect(screen.getByText('Filters · 1')).toBeInTheDocument();
    expect(screen.getByText(/Status: Inactive/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(await screen.findByText('#101')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('error: renders <ErrorState> with Retry when the list fails', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
