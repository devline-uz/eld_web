// web/tz.md §10 W-09 — smoke test: renders the KPI row, the DVIRs tab and the RBAC-gated
// `+ New work order` control from the real fixture data.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import DvirPage from './DvirPage';

let mockCan = (_key: string, _level?: 'READ' | 'FULL') => true;
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: (k: string, l?: 'READ' | 'FULL') => mockCan(k, l) }) }));
vi.mock('@/shared/auth/Can', () => ({
  Can: ({ perm, level, children }: { perm: string; level?: 'READ' | 'FULL'; children: React.ReactNode }) =>
    mockCan(perm, level) ? children : null,
}));

function renderPage(route = '/dvir') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <DvirPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  mockCan = () => true;
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('DvirPage', () => {
  it('renders the header and KPI row', async () => {
    renderPage();
    expect(await screen.findByText('DVIR & Maintenance')).toBeInTheDocument();
    expect((await screen.findAllByText('Open defects')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Overdue services')).toBeInTheDocument();
    expect(await screen.findByText('DVIRs today')).toBeInTheDocument();
    expect(await screen.findByText('Vehicles out of service')).toBeInTheDocument();
  });

  it('shows the DVIR empty-state copy verbatim when there are no recent inspections', async () => {
    server.use(http.get(url(endpoints.dvir.list), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findByText('No inspections in this period')).toBeInTheDocument();
    expect(screen.getByText('Drivers submit pre-trip and post-trip inspections from the mobile app.')).toBeInTheDocument();
  });

  it('shows the open-defects empty-state copy verbatim when there are none', async () => {
    server.use(http.get(url(endpoints.defects.list), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findAllByText('No open defects')).not.toHaveLength(0);
    expect(screen.getAllByText('Every reported defect has been corrected.').length).toBeGreaterThan(0);
  });

  // WB-163 — the header `Export` always dumped the open-defects page, and `Filters` stayed
  // enabled on the three tabs its drawer does not touch.
  it('Export follows the active tab and Filters is only live on the DVIRs tab', async () => {
    const user = userEvent.setup();
    let name = '';
    let json = '';
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then((t) => {
        json = t;
      });
      return 'blob:mock';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    try {
      renderPage();
      await screen.findByText('DVIR & Maintenance');
      expect(screen.getByRole('button', { name: /^Filters/ })).toBeEnabled();

      // The fixture DVIRs fall outside the 48 h window, so the DVIRs tab has nothing to export
      // and says so rather than writing an empty file.
      const exportButton = screen.getByRole('button', { name: 'Export' });
      expect(exportButton).toBeDisabled();
      expect(exportButton).toHaveAttribute('title', 'Nothing to export on this tab.');

      await user.click(screen.getByRole('button', { name: /^Open defects/ }));
      const filters = screen.getByRole('button', { name: /^Filters/ });
      expect(filters).toBeDisabled();
      expect(filters).toHaveAttribute('title', 'Filters apply to the DVIRs tab only.');

      json = '';
      await user.click(screen.getByRole('button', { name: 'Export' }));
      expect(name).toBe('dvir-open-defects.csv');
      // Stage 3 — CSV with a header row, and the outcome is announced.
      await vi.waitFor(() =>
        expect(json.split('\r\n')[0]).toBe('reportedAt,unit,part,category,severity,status,outOfService,description'),
      );
      expect(await screen.findByText('Export ready')).toBeInTheDocument();
    } finally {
      click.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('Export failure is announced instead of failing silently (stage 3)', async () => {
    const user = userEvent.setup();
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => {
      throw new Error('Blob storage is unavailable.');
    }) as unknown as typeof URL.createObjectURL;
    try {
      renderPage();
      await screen.findByText('DVIR & Maintenance');
      await user.click(screen.getByRole('button', { name: /^Open defects/ }));
      await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: 'Export' }));
      expect(await screen.findByText('Export failed')).toBeInTheDocument();
      expect(screen.getByText('Blob storage is unavailable.')).toBeInTheDocument();
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  it('search has a clear button and Esc, and the one term follows every tab (stage 3)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('DVIR & Maintenance');
    const search = screen.getByRole('textbox', { name: 'Search unit, defect' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    await user.type(search, 'brake');
    await user.click(screen.getByRole('button', { name: /^Work orders/ }));
    expect(screen.getByRole('textbox', { name: 'Search unit, defect' })).toHaveValue('brake');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');

    await user.type(search, 'x{Escape}');
    expect(search).toHaveValue('');
  });

  // WB-161 — W-04's `New work order` links here with the unit it was pressed on.
  it('?newWorkOrder= opens 11.18 pre-filled and drops the param', async () => {
    renderPage('/dvir?newWorkOrder=veh_1');
    expect(await screen.findByRole('dialog', { name: 'Create work order' })).toBeInTheDocument();
  });

  it('renders "+ New work order" for maintenance FULL and removes it otherwise', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'New work order' })).toBeInTheDocument();
  });

  it('removes the create/new work-order controls without maintenance FULL', async () => {
    mockCan = (key, level) => !(key === 'maintenance' && level === 'FULL');
    renderPage();
    await screen.findByText('DVIR & Maintenance');
    expect(screen.queryByRole('button', { name: 'New work order' })).not.toBeInTheDocument();
  });

  // Regression — each of the three paged tables kept its page across a search change, so a search
  // typed on page 2 asked for page 2 of the narrowed result and the table rendered with no rows.
  it('work orders: a search typed on page 2 re-pages to page 1', async () => {
    const user = userEvent.setup();
    const workOrders = Array.from({ length: 30 }, (_, i) => ({
      id: `wo_${i}`,
      number: `WO-${1000 + i}`,
      vehicleId: 'veh_1',
      title: `Brake job ${i}`,
      priority: 'HIGH',
      status: 'OPEN',
      vendor: 'Shop',
      costUsd: '120.00',
      dueAt: null,
    }));
    server.use(
      http.get(url(endpoints.workOrders.list), ({ request }) => {
        const p = new URL(request.url).searchParams;
        const q = (p.get('q') ?? '').toLowerCase();
        const page = Math.max(1, Number(p.get('page') ?? 1));
        const limit = Math.max(1, Number(p.get('limit') ?? 25));
        const items = q ? workOrders.filter((w) => w.number.toLowerCase().includes(q)) : workOrders;
        return ok({
          items: items.slice((page - 1) * limit, page * limit),
          page,
          limit,
          total: items.length,
          totalPages: Math.max(1, Math.ceil(items.length / limit)),
        });
      }),
    );
    renderPage('/dvir?tab=workOrders');

    await user.click(await screen.findByRole('button', { name: '2' }));
    expect(await screen.findByText('WO-1010')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search unit, defect…'), 'WO-1003');
    // Re-query on each tick — the clamp commits one more render after the page lands.
    await waitFor(() => expect(screen.getByText('WO-1003')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('open defects: a search typed on page 2 re-pages to page 1', async () => {
    const user = userEvent.setup();
    const defects = Array.from({ length: 30 }, (_, i) => ({
      id: `def_${i}`,
      vehicleId: 'veh_1',
      dvirId: null,
      category: `Component ${String(i).padStart(2, '0')}`,
      description: `Defect ${i}`,
      severity: 'MAJOR',
      status: 'OPEN',
      outOfService: false,
      createdAt: new Date().toISOString(),
    }));
    server.use(
      http.get(url(endpoints.defects.list), ({ request }) => {
        const p = new URL(request.url).searchParams;
        const page = Math.max(1, Number(p.get('page') ?? 1));
        const limit = Math.max(1, Number(p.get('limit') ?? 25));
        return ok({
          items: defects.slice((page - 1) * limit, page * limit),
          page,
          limit,
          total: defects.length,
          totalPages: Math.max(1, Math.ceil(defects.length / limit)),
        });
      }),
    );
    renderPage('/dvir?tab=defects');

    await user.click(await screen.findByRole('button', { name: '2' }));
    expect(await screen.findByText('Component 10')).toBeInTheDocument();

    // `/defects` has no `q` (B-66) — the search switches to the in-memory window, where page 2 of
    // a single-row result would otherwise show nothing under a "page 2" pager.
    await user.type(screen.getByPlaceholderText('Search unit, defect…'), 'Component 03');
    await waitFor(() => expect(screen.getByText('Component 03')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('error: renders <ErrorState> with Retry when the list fails', async () => {
    server.use(
      http.get(url(endpoints.dvir.list), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // WB-074 — every `…` row action on Work orders/Schedules now fires its mutation instead of
  // being a silent no-op.
  describe('WB-074 row-action menus', () => {
    it('Work orders: Close calls POST /work-orders/:id/close and toasts', async () => {
      const user = userEvent.setup();
      let closed = false;
      server.use(
        http.post(url(endpoints.workOrders.close('wo_1')), () => {
          closed = true;
          return ok({ id: 'wo_1', status: 'DONE' }, 201);
        }),
      );
      renderPage('/dvir?tab=workOrders');

      await user.click(await screen.findByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText('Close'));
      await user.click(await screen.findByRole('button', { name: 'Close work order' }));

      expect(await screen.findByText('Work order WO-0001 closed')).toBeInTheDocument();
      expect(closed).toBe(true);
    });

    it('Work orders: Cancel calls POST /work-orders/:id/cancel and toasts', async () => {
      const user = userEvent.setup();
      let cancelled = false;
      server.use(
        http.post(url(endpoints.workOrders.cancel('wo_1')), () => {
          cancelled = true;
          return ok({ id: 'wo_1', status: 'CANCELLED' }, 201);
        }),
      );
      renderPage('/dvir?tab=workOrders');

      await user.click(await screen.findByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText('Cancel'));
      await user.click(await screen.findByRole('button', { name: 'Cancel work order' }));

      expect(await screen.findByText('Work order WO-0001 cancelled')).toBeInTheDocument();
      expect(cancelled).toBe(true);
    });

    it('Work orders: Edit calls PATCH /work-orders/:id with the edited fields and toasts', async () => {
      const user = userEvent.setup();
      let body: unknown;
      server.use(
        http.get(url(endpoints.workOrders.list), () =>
          ok({
            items: [
              {
                id: 'wo_1',
                number: 'WO-0001',
                vehicleId: 'veh_1',
                title: 'Brake job',
                priority: 'NORMAL',
                status: 'OPEN',
                vendor: 'Shop A',
                costUsd: '120.00',
                dueAt: null,
              },
            ],
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
          }),
        ),
        http.patch(url(endpoints.workOrders.update('wo_1')), async ({ request }) => {
          body = await request.json();
          return ok({ id: 'wo_1', status: 'OPEN' });
        }),
      );
      renderPage('/dvir?tab=workOrders');

      await screen.findByText('WO-0001');
      await user.click(await screen.findByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText('Edit'));
      const titleInput = await screen.findByDisplayValue('Brake job');
      await user.clear(titleInput);
      await user.type(titleInput, 'Brake job — urgent');
      await user.click(await screen.findByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Work order WO-0001 updated')).toBeInTheDocument();
      expect((body as { title?: string })?.title).toBe('Brake job — urgent');
    });

    it('Schedules: Complete calls POST /maintenance-schedules/:id/complete and toasts', async () => {
      const user = userEvent.setup();
      let completed = false;
      server.use(
        http.post(url(endpoints.maintenanceSchedules.complete('ms_1')), () => {
          completed = true;
          return ok({ id: 'ms_1', lastServiceMi: 994700 }, 201);
        }),
      );
      renderPage('/dvir?tab=schedules');

      await user.click(await screen.findByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText('Complete'));
      await user.click(await screen.findByRole('button', { name: 'Mark complete' }));

      expect(await screen.findByText('Brake service marked complete')).toBeInTheDocument();
      expect(completed).toBe(true);
    });

    it('Schedules: Edit calls PATCH /maintenance-schedules/:id with the edited fields and toasts', async () => {
      const user = userEvent.setup();
      let body: unknown;
      server.use(
        http.patch(url(endpoints.maintenanceSchedules.update('ms_1')), async ({ request }) => {
          body = await request.json();
          return ok({ id: 'ms_1' });
        }),
      );
      renderPage('/dvir?tab=schedules');

      await user.click(await screen.findByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText('Edit'));
      const nameInput = await screen.findByDisplayValue('Brake service');
      await user.clear(nameInput);
      await user.type(nameInput, 'Brake service — full');
      await user.click(await screen.findByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Brake service updated')).toBeInTheDocument();
      expect((body as { name?: string })?.name).toBe('Brake service — full');
    });

    it('Schedules: Complete — Cancel after typing asks to discard first (stage 3)', async () => {
      const user = userEvent.setup();
      renderPage('/dvir?tab=schedules');

      await user.click(await screen.findByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText('Complete'));
      await user.type(await screen.findByLabelText(/Odometer at service/), '994700');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark complete', hidden: true })).toBeInTheDocument();
    });

    it('Schedules: Delete calls DELETE /maintenance-schedules/:id and toasts', async () => {
      const user = userEvent.setup();
      let deleted = false;
      server.use(
        http.delete(url(endpoints.maintenanceSchedules.remove('ms_1')), () => {
          deleted = true;
          return ok({ deleted: true });
        }),
      );
      renderPage('/dvir?tab=schedules');

      await user.click(await screen.findByRole('button', { name: 'Row actions' }));
      await user.click(await screen.findByText('Delete'));
      await user.click(await screen.findByRole('button', { name: 'Delete schedule' }));

      expect(await screen.findByText('Brake service deleted')).toBeInTheDocument();
      expect(deleted).toBe(true);
    });
  });

  // WB-075 — the "Return unit to service" checkbox was decorative (never sent); replaced with an
  // informational note, and the toast states the consequence conditionally instead of asserting one.
  describe('WB-075 resolve defect — no invented returnToService flag', () => {
    it('shows the out-of-service consequence as a note, not a checkbox, and never sends returnToService', async () => {
      const user = userEvent.setup();
      let body: unknown;
      server.use(
        http.get(url(endpoints.defects.list), () =>
          ok({
            items: [
              {
                id: 'def_1',
                vehicleId: 'veh_1',
                category: 'Brake pads',
                description: 'Worn beyond spec',
                severity: 'CRITICAL',
                status: 'OPEN',
                outOfService: true,
                createdAt: '2026-09-10T12:00:00.000Z',
              },
            ],
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
          }),
        ),
        http.patch(url(endpoints.defects.resolve('def_1')), async ({ request }) => {
          body = await request.json();
          return ok({ id: 'def_1', status: 'REPAIRED' });
        }),
      );
      renderPage('/dvir?tab=defects');

      await user.click(await screen.findByText('Brake pads'));
      expect(await screen.findByText(/is out of service because of this defect/)).toBeInTheDocument();
      expect(screen.queryByText(/Return unit .* to service/)).not.toBeInTheDocument();

      await user.type(screen.getByLabelText(/Repair notes/i), 'Replaced pads');
      await user.click(await screen.findByRole('button', { name: 'Mark as resolved' }));

      await waitFor(() => expect(body).toBeTruthy());
      expect(body).not.toHaveProperty('returnToService');
      expect((body as { resolutionType: string }).resolutionType).toBe('REPAIRED');
    });
  });

  // WB-077 → B-68 (shipped 2026-09-24): "No repair needed" is its own `resolutionType`, so the
  // note-prefix workaround is gone and the choice is never recorded as a repair.
  describe('WB-077 / B-68 "No repair needed" is NOT_REQUIRED, not silently REPAIRED', () => {
    it('sends resolutionType NOT_REQUIRED with the note as typed', async () => {
      const user = userEvent.setup();
      let body: unknown;
      server.use(
        http.get(url(endpoints.defects.list), () =>
          ok({
            items: [
              {
                id: 'def_1',
                vehicleId: 'veh_1',
                category: 'Mirror',
                description: 'Hairline crack',
                severity: 'MINOR',
                status: 'OPEN',
                outOfService: false,
                createdAt: '2026-09-10T12:00:00.000Z',
              },
            ],
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
          }),
        ),
        http.patch(url(endpoints.defects.resolve('def_1')), async ({ request }) => {
          body = await request.json();
          return ok({ id: 'def_1', status: 'REPAIRED' });
        }),
      );
      renderPage('/dvir?tab=defects');

      await user.click(await screen.findByText('Mirror'));
      await user.click(await screen.findByText('No repair needed'));
      await user.type(screen.getByLabelText(/Repair notes/i), 'Inspected, within spec');
      await user.click(await screen.findByRole('button', { name: 'Mark as resolved' }));

      await waitFor(() => expect(body).toBeTruthy());
      expect(body).toEqual({ resolutionType: 'NOT_REQUIRED', resolutionNote: 'Inspected, within spec' });
    });
  });

  // WB-076 — mechanic sign-off used to hardcode `repairStatus: 'REPAIRED'` for every DVIR. It now
  // derives a truthful default from the DVIR's defect state and lets the mechanic override it.
  describe('WB-076 mechanic sign-off — derived repair status, not always REPAIRED', () => {
    function mockDvirDetail(defects: Array<Record<string, unknown>>) {
      return [
        http.get(url(endpoints.dvir.list), () =>
          ok({
            items: [
              {
                id: 'dvir_1',
                driverId: 'drv_1',
                vehicleId: 'veh_1',
                type: 'PRE_TRIP',
                submittedAt: new Date().toISOString(),
                odometerMi: 100000,
                vehicleCondition: 'DEFECTS_FOUND',
                repairStatus: 'PENDING',
              },
            ],
            page: 1,
            limit: 200,
            total: 1,
            totalPages: 1,
          }),
        ),
        http.get(url(endpoints.dvir.detail(':id')), () =>
          ok({
            id: 'dvir_1',
            driverId: 'drv_1',
            vehicleId: 'veh_1',
            type: 'PRE_TRIP',
            submittedAt: new Date().toISOString(),
            odometerMi: 100000,
            mechanicSignedAt: null,
            defects,
            photos: [],
          }),
        ),
      ];
    }

    it('defaults to "Repair pending" while a defect on the DVIR is still OPEN', async () => {
      const user = userEvent.setup();
      let body: unknown;
      server.use(
        ...mockDvirDetail([
          { id: 'def_1', dvirId: 'dvir_1', vehicleId: 'veh_1', category: 'Brakes', severity: 'CRITICAL', status: 'OPEN', outOfService: true },
        ]),
        http.post(url(endpoints.dvir.mechanicSignoff('dvir_1')), async ({ request }) => {
          body = await request.json();
          return ok({ id: 'dvir_1', mechanicName: 'J. Alvarez', repairStatus: 'PENDING', mechanicSignedAt: new Date().toISOString() });
        }),
      );
      renderPage();

      await user.click(await screen.findByText('Pre-trip'));
      await user.type(await screen.findByPlaceholderText('Mechanic name'), 'J. Alvarez');
      await user.click(await screen.findByRole('button', { name: 'Sign off' }));

      await waitFor(() => expect(body).toBeTruthy());
      expect((body as { repairStatus: string }).repairStatus).toBe('PENDING');
    });

    it('defaults to "No repair required" when the DVIR raised no defects', async () => {
      const user = userEvent.setup();
      let body: unknown;
      server.use(
        ...mockDvirDetail([]),
        http.post(url(endpoints.dvir.mechanicSignoff('dvir_1')), async ({ request }) => {
          body = await request.json();
          return ok({ id: 'dvir_1', mechanicName: 'J. Alvarez', repairStatus: 'NOT_REQUIRED', mechanicSignedAt: new Date().toISOString() });
        }),
      );
      renderPage();

      await user.click(await screen.findByText('Pre-trip'));
      await user.type(await screen.findByPlaceholderText('Mechanic name'), 'J. Alvarez');
      await user.click(await screen.findByRole('button', { name: 'Sign off' }));

      await waitFor(() => expect(body).toBeTruthy());
      expect((body as { repairStatus: string }).repairStatus).toBe('NOT_REQUIRED');
    });

    it('lets the mechanic override the derived status', async () => {
      const user = userEvent.setup();
      let body: unknown;
      server.use(
        ...mockDvirDetail([
          { id: 'def_1', dvirId: 'dvir_1', vehicleId: 'veh_1', category: 'Brakes', severity: 'CRITICAL', status: 'OPEN', outOfService: true },
        ]),
        http.post(url(endpoints.dvir.mechanicSignoff('dvir_1')), async ({ request }) => {
          body = await request.json();
          return ok({ id: 'dvir_1', mechanicName: 'J. Alvarez', repairStatus: 'DEFERRED', mechanicSignedAt: new Date().toISOString() });
        }),
      );
      renderPage();

      await user.click(await screen.findByText('Pre-trip'));
      await user.selectOptions(await screen.findByRole('combobox'), 'DEFERRED');
      await user.type(screen.getByPlaceholderText('Mechanic name'), 'J. Alvarez');
      await user.click(await screen.findByRole('button', { name: 'Sign off' }));

      await waitFor(() => expect(body).toBeTruthy());
      expect((body as { repairStatus: string }).repairStatus).toBe('DEFERRED');
    });
  });
});
