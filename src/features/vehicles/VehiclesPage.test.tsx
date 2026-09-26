// web/tz.md §10 W-03 — the exact empty-state copy and a populated render with the join columns.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { resetMockState } from '@/mocks/handlers/mockState';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import VehiclesPage from './VehiclesPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntries: string[] = ['/vehicles']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <VehiclesPage />
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
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

const VEHICLE_ROW = {
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

/** Answers like the real `GET /vehicles`: one page, narrowed by `q` and `status` (WD-073). */
function usePopulatedFleet() {
  server.use(
    http.get(url(endpoints.vehicles.list), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = (params.get('q') ?? '').toLowerCase();
      const status = params.get('status');
      const page = {
        items: [VEHICLE_ROW],
        page: 1,
        limit: 500,
        total: 1,
        totalPages: 1,
      };
      const items = page.items.filter(
        (v) =>
          (!status || v.status === status) &&
          (!q || [v.unitNumber, v.vin, v.licensePlate ?? ''].some((t) => t.toLowerCase().includes(q))),
      );
      return ok({ ...page, items, total: items.length });
    }),
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
    expect(await screen.findByText('1 vehicle selected')).toBeInTheDocument();

    // Import and Export are their own header buttons, not a "More" menu
    expect(screen.getByRole('button', { name: 'Export Units' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Units' })).toBeInTheDocument();
  });

  it('B-71 shipped — bulk "Set inactive" calls PATCH /vehicles/bulk-status instead of faking the toast', async () => {
    usePopulatedFleet();
    let body: unknown;
    server.use(
      http.patch(url(endpoints.vehicles.bulkStatus), async ({ request }) => {
        body = await request.json();
        return ok({ updated: ['veh_1'], failed: [] });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await user.click(screen.getAllByRole('checkbox')[1]!);
    await user.click(await screen.findByRole('button', { name: 'Set inactive' }));

    // The real write happened, and the toast is singular ("1 unit", not "1 units").
    expect(await screen.findByText('1 unit set inactive')).toBeInTheDocument();
    expect(body).toEqual({ ids: ['veh_1'], status: 'INACTIVE' });
  });

  it('B-71 shipped — a failing bulk "Set inactive" reports the failure instead of claiming success', async () => {
    usePopulatedFleet();
    server.use(
      http.patch(url(endpoints.vehicles.bulkStatus), () =>
        ok({ updated: [], failed: [{ id: 'veh_1', error: 'VEHICLE_HAS_OPEN_CRITICAL_DEFECTS' }] }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await user.click(screen.getAllByRole('checkbox')[1]!);
    await user.click(await screen.findByRole('button', { name: 'Set inactive' }));

    expect(await screen.findByText('1 of 1 unit could not be set inactive')).toBeInTheDocument();
    expect(screen.queryByText('1 unit set inactive')).not.toBeInTheDocument();
  });

  it('row "Track on map" opens Live fleet with that unit selected; the bulk-bar × is a 32px target (stage 3)', async () => {
    usePopulatedFleet();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await user.click(screen.getAllByRole('checkbox')[1]!);
    const clear = await screen.findByRole('button', { name: 'Clear selection' });
    expect(clear.className).toContain('size-btn-sm');
    await user.click(clear);
    expect(screen.queryByText('1 vehicle selected')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Track on map'));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/live-fleet\?unit=veh_/);
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

  // Regression — a `page` query param that is not a positive integer used to reach `Number()`
  // untouched: `?page=abc` became `NaN` and the footer read `NaN–NaN of 1 vehicles`.
  it('an invalid ?page= renders page 1 instead of a NaN footer', async () => {
    usePopulatedFleet();
    renderPage(['/vehicles?page=abc']);

    expect(await screen.findByText('#101')).toBeInTheDocument();
    expect(screen.getByText('1–1 of 1 vehicles')).toBeInTheDocument();
  });

  // Regression — a bookmarked/back-button `page` past the end of the list returned no items while
  // `total` stayed non-zero, so the card rendered an empty table body under a bogus footer.
  it('a ?page= past the last page snaps back to the last page instead of a blank table', async () => {
    usePopulatedFleet();
    server.use(
      http.get(url(endpoints.vehicles.list), ({ request }) => {
        const requested = Number(new URL(request.url).searchParams.get('page') ?? '1');
        return ok({ items: requested > 1 ? [] : [VEHICLE_ROW], page: requested, limit: 10, total: 1, totalPages: 1 });
      }),
    );

    renderPage(['/vehicles?page=9']);

    expect(await screen.findByText('#101')).toBeInTheDocument();
    expect(screen.getByText('1–1 of 1 vehicles')).toBeInTheDocument();
  });

  // WB-160 — §4.3: the column shows the ECU reading plus the calibration offset, so a successful
  // `Calibrate odometer` is visible here. It used to render the raw stored `odometerMi`.
  it('the ODOMETER column is ECU + offset, not the stored odometerMi', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        ok({
          items: [{ ...VEHICLE_ROW, odometerMi: 900000, deviceOdometerMi: 981109, odometerOffsetMi: 12480 }],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        }),
      ),
      http.get(url(endpoints.drivers.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.devices.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    );
    renderPage();

    expect(await screen.findByText('993,589 mi')).toBeInTheDocument();
    expect(screen.queryByText('900,000 mi')).not.toBeInTheDocument();
  });

  // WB-161 — the bulk-bar button had no onClick at all.
  it('bulk "Assign driver" opens 11.4 for the one selected unit', async () => {
    usePopulatedFleet();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await user.click(screen.getAllByRole('checkbox')[1]!);
    await user.click(await screen.findByRole('button', { name: 'Assign driver' }));

    expect(await screen.findByText('Assign driver to unit #101')).toBeInTheDocument();
  });

  // WB-163 — the bulk `Export` used to call the whole-fleet export endpoint.
  it('bulk "Export" writes the selected units, not the whole fleet', async () => {
    usePopulatedFleet();
    const user = userEvent.setup();
    let csv = '';
    let name = '';
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then((t) => {
        csv = t;
      });
      return 'blob:mock';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    try {
      renderPage();
      await screen.findByText('#101');
      await user.click(screen.getAllByRole('checkbox')[1]!);
      await user.click(await screen.findByRole('button', { name: 'Export' }));

      expect(name).toBe('vehicles-selected.csv');
      await vi.waitFor(() => expect(csv).toContain('unitNumber,status,driver'));
      expect(csv).toContain('#101');
      expect(csv.split('\r\n')).toHaveLength(2);
    } finally {
      click.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  // WB-163 — `?driverId=` with an empty value used to reach W-06 as a driver id.
  it('"Open HOS logs" is disabled on a driverless unit', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok({ items: [VEHICLE_ROW], page: 1, limit: 10, total: 1, totalPages: 1 })),
      http.get(url(endpoints.drivers.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.devices.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    const item = await screen.findByText('Open HOS logs');
    expect(item).toHaveAttribute('data-disabled');
    expect(item).toHaveAttribute('title', 'No driver is assigned to this unit.');
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

// `DELETE /vehicles/:id` is a soft delete: the unit becomes INACTIVE and used to stay in the table.
// A deleted unit now leaves the table and the counters; a unit only "Set inactive" stays listed.
describe('W-03 Vehicles — deleting a unit removes it from the table', () => {
  beforeEach(() => resetMockState());
  afterEach(() => resetMockState());

  const rowOf = (unit: string) => screen.getByText(unit).closest('tr') as HTMLElement;

  async function deleteUnit(user: ReturnType<typeof userEvent.setup>, unit: string) {
    await user.click(within(rowOf(unit)).getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Delete unit'));
    const phrase = `UNIT-${unit.replace('#', '')}`;
    await user.type(await screen.findByPlaceholderText(phrase), phrase);
    await user.click(screen.getByRole('button', { name: 'Delete unit' }));
    expect(await screen.findByText(`Unit ${unit} deleted`)).toBeInTheDocument();
  }

  it('the deleted row is gone and All / Active drop by one (MSW soft delete with deletedAt)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');
    expect(await screen.findByRole('button', { name: 'All 24' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active 19' })).toBeInTheDocument();

    await deleteUnit(user, '#101');

    expect(await screen.findByRole('button', { name: 'All 23' })).toBeInTheDocument();
    expect(screen.queryByText('#101')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active 18' })).toBeInTheDocument();
    // Soft-deleted means INACTIVE server-side, but it is not counted as an inactive unit.
    expect(screen.getByRole('button', { name: 'Inactive 3' })).toBeInTheDocument();
  });

  it('a unit only "Set inactive" stays listed under Inactive while a deleted one does not', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#102');

    await user.click(within(rowOf('#102')).getByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: 'Set inactive' }));
    expect(await screen.findByRole('button', { name: 'Inactive 4' })).toBeInTheDocument();

    await deleteUnit(user, '#101');
    expect(await screen.findByRole('button', { name: 'All 23' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Inactive 4' }));
    expect(await screen.findByText('#102')).toBeInTheDocument();
    expect(screen.queryByText('#101')).not.toBeInTheDocument();
  });

  it('the row stays gone even when the list keeps returning it as a plain INACTIVE row (live API, no deletedAt)', async () => {
    // The live backend today: soft delete flips `status`, and `GET /vehicles` still lists the row.
    let status = 'ACTIVE';
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        ok({ items: [{ ...VEHICLE_ROW, status }], page: 1, limit: 10, total: 1, totalPages: 1 }),
      ),
      http.delete(url(endpoints.vehicles.remove(':id')), () => {
        status = 'INACTIVE';
        return ok({ ...VEHICLE_ROW, status });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('#101');

    await deleteUnit(user, '#101');

    await vi.waitFor(() => expect(screen.queryByText('#101')).not.toBeInTheDocument());
    expect(await screen.findByText(/No vehicles yet|Nothing matches/)).toBeInTheDocument();
  });
});
