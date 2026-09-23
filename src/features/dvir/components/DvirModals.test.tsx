// web/tz.md §11.16/§11.17 · §11.30 — the four DVIR overlays: what they actually put on the wire,
// what they no longer pretend to collect, and that no route out of a dirty one skips the confirm.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import type { DefectTableRow, ScheduleTableRow, WorkOrderTableRow } from '@/shared/api/dvir';
import { DvirDrawer } from './DvirDrawer';
import { ResolveDefectModal } from './ResolveDefectModal';
import { CreateWorkOrderModal } from './CreateWorkOrderModal';
import { EditWorkOrderModal } from './EditWorkOrderModal';
import { EditScheduleModal } from './EditScheduleModal';

// The drawer (11.15) reads `dvir`/`maintenance` permissions; the four modals do not.
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/shared/auth/Can', () => ({ Can: ({ children }: { children: React.ReactNode }) => children }));

function renderModal(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
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

const DEFECT: DefectTableRow = {
  id: 'def_1',
  dvirId: 'dvir_1',
  vehicleId: 'veh_1',
  category: 'Brake pads',
  part: 'TRUCK',
  severity: 'CRITICAL',
  description: 'Worn past the wear line',
  status: 'OPEN',
  outOfService: false,
  workOrderId: null,
  resolvedAt: null,
  resolvedById: null,
  resolutionNote: null,
  createdAt: '2026-09-10T12:00:00.000Z',
  vehicle: null,
};

const WORK_ORDER: WorkOrderTableRow = {
  id: 'wo_1',
  number: 'WO-1001',
  vehicleId: 'veh_1',
  title: 'Brake repair',
  description: 'Replace pads',
  priority: 'NORMAL',
  status: 'OPEN',
  vendor: 'Shop A',
  costUsd: 250,
  odometerMi: 120000,
  openedById: 'usr_1',
  openedAt: '2026-09-10T12:00:00.000Z',
  dueAt: '2026-09-20T00:00:00.000Z',
  closedAt: null,
  vehicle: null,
};

const SCHEDULE: ScheduleTableRow = {
  id: 'sch_1',
  vehicleId: 'veh_1',
  name: 'Oil & filter',
  intervalMi: 15000,
  intervalDays: 180,
  lastServiceMi: 100000,
  lastServiceAt: '2026-03-01T00:00:00.000Z',
  nextDueMi: 115000,
  nextDueAt: '2026-09-01T00:00:00.000Z',
  enabled: true,
  due: { state: 'DUE_SOON', nextDueMi: 115000, nextDueAt: '2026-09-01T00:00:00.000Z', milesRemaining: 500, daysRemaining: 10 },
  vehicle: null,
};

function workOrdersListHandler() {
  return http.get(url(endpoints.workOrders.list), () =>
    ok({ items: [{ ...WORK_ORDER, vehicle: undefined }], page: 1, limit: 50, total: 1, totalPages: 1 }),
  );
}

/* ------------------------------------------------------------------ 11.17 Resolve defect */

describe('ResolveDefectModal — 11.17', () => {
  it('sends exactly what `DefectResolveDto` accepts and nothing else', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      workOrdersListHandler(),
      http.patch(url(endpoints.defects.resolve('def_1')), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'def_1', status: 'REPAIRED' });
      }),
    );
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Repair notes/i), 'Replaced pads');
    await user.click(screen.getByRole('button', { name: 'Mark as resolved' }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ status: 'REPAIRED', resolutionNote: 'Replaced pads' });
  });

  it('groups the three resolutions under one name so arrow keys move between them (stage 3)', async () => {
    server.use(workOrdersListHandler());
    const user = userEvent.setup();
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={vi.fn()} />);

    const group = screen.getByRole('radiogroup', { name: 'Resolution' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radios[0]!.name).not.toBe('');

    radios[0]!.focus();
    await user.keyboard('{ArrowDown}');
    expect(radios[1]).toBeChecked();
  });

  it('no longer collects the four fields the DTO cannot carry', () => {
    server.use(workOrdersListHandler());
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={vi.fn()} />);

    expect(screen.queryByText(/Corrected by/)).not.toBeInTheDocument();
    expect(screen.queryByText('Completed on')).not.toBeInTheDocument();
    expect(screen.queryByText('Labour hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Parts cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Mechanic signature')).not.toBeInTheDocument();
  });

  it('WB-137 · the `reported` stamp is en-US 24-hour in carrier.timezone, never the browser zone', async () => {
    server.use(
      workOrdersListHandler(),
      http.get(url(endpoints.carrier.root), () => ok({ name: 'Universal Logistics', timezone: 'America/Denver' })),
    );
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={vi.fn()} />);

    // 2026-09-10T12:00Z is 06:00 MDT — 24-hour, no AM/PM, zone named.
    expect(await screen.findByText('Unit — · Brake pads · reported Sep 10, 06:00 MT')).toBeInTheDocument();
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument();
  });

  it('WB-137 · without the carrier profile the stamp falls back to Eastern and says so', async () => {
    server.use(
      workOrdersListHandler(),
      http.get(url(endpoints.carrier.root), () =>
        HttpResponse.json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'nope' }, { status: 500 }),
      ),
    );
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={vi.fn()} />);

    expect(await screen.findByText('Unit — · Brake pads · reported Sep 10, 08:00 ET')).toBeInTheDocument();
  });

  it('applies the chosen work order through PATCH /defects/:id/work-order', async () => {
    const user = userEvent.setup();
    let linkBody: unknown;
    let resolveBody: unknown;
    server.use(
      workOrdersListHandler(),
      http.patch(url(endpoints.defects.workOrder('def_1')), async ({ request }) => {
        linkBody = await request.json();
        return ok({ id: 'def_1', workOrderId: 'wo_1' });
      }),
      http.patch(url(endpoints.defects.resolve('def_1')), async ({ request }) => {
        resolveBody = await request.json();
        return ok({ id: 'def_1', status: 'REPAIRED' });
      }),
    );
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={vi.fn()} />);

    await screen.findByRole('option', { name: 'WO-1001' });
    await user.selectOptions(screen.getByLabelText('Work order'), 'wo_1');
    await user.type(screen.getByLabelText(/Repair notes/i), 'Replaced pads');
    await user.click(screen.getByRole('button', { name: 'Mark as resolved' }));

    await waitFor(() => expect(resolveBody).toBeTruthy());
    expect(linkBody).toEqual({ workOrderId: 'wo_1' });
  });

  it('closes straight away when untouched, and confirms after an edit (Esc and Cancel alike)', async () => {
    const user = userEvent.setup();
    server.use(workOrdersListHandler());
    const onClose = vi.fn();
    const { unmount } = renderModal(<ResolveDefectModal defect={DEFECT} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    unmount();

    const onClose2 = vi.fn();
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={onClose2} />);
    await user.type(screen.getByLabelText(/Repair notes/i), 'Replaced pads');

    await user.keyboard('{Escape}');
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose2).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose2).not.toHaveBeenCalled();
  });

  it('surfaces a failed resolve in an in-modal banner instead of silence', async () => {
    const user = userEvent.setup();
    server.use(
      workOrdersListHandler(),
      http.patch(url(endpoints.defects.resolve('def_1')), () => HttpResponse.json({ statusCode: 500 }, { status: 500 })),
    );
    const onClose = vi.fn();
    renderModal(<ResolveDefectModal defect={DEFECT} onClose={onClose} />);

    await user.type(screen.getByLabelText(/Repair notes/i), 'Replaced pads');
    await user.click(screen.getByRole('button', { name: 'Mark as resolved' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------- 11.16 Create work order */

describe('CreateWorkOrderModal — 11.16', () => {
  it('sends exactly the fields `CreateWorkOrderDto` accepts', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.get(url(endpoints.defects.list), () => ok({ items: [], page: 1, limit: 200, total: 0, totalPages: 1 })),
      http.post(url(endpoints.workOrders.create), async ({ request }) => {
        body = await request.json();
        return ok({ ...WORK_ORDER, vehicle: undefined }, 201);
      }),
    );
    renderModal(<CreateWorkOrderModal vehicleId="veh_1" onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Title/), 'Brake repair');
    await user.click(screen.getByRole('button', { name: 'Create work order' }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toEqual({ vehicleId: 'veh_1', title: 'Brake repair', priority: 'NORMAL' });
  });

  it('drops the ticked defects when the unit changes, so another unit\'s defect is never sent (stage 3)', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    const vehicle = (id: string, unitNumber: string) => ({ id, unitNumber, vin: `VIN${id}`, status: 'ACTIVE' });
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        ok({ items: [vehicle('veh_1', '101'), vehicle('veh_2', '102')], page: 1, limit: 1000, total: 2, totalPages: 1 }),
      ),
      http.get(url(endpoints.defects.list), ({ request }) => {
        const vehicleId = new URL(request.url).searchParams.get('vehicleId');
        const items = vehicleId === 'veh_1' ? [{ ...DEFECT, vehicle: undefined }] : [];
        return ok({ items, page: 1, limit: 200, total: items.length, totalPages: 1 });
      }),
      http.post(url(endpoints.workOrders.create), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ ...WORK_ORDER, vehicle: undefined }, 201);
      }),
    );
    renderModal(<CreateWorkOrderModal onClose={vi.fn()} />);

    const unit = screen.getByRole('combobox', { name: /Unit/ });
    await screen.findByRole('option', { name: 'Unit 102' });
    await user.selectOptions(unit, 'veh_1');
    await user.click(await screen.findByRole('checkbox', { name: /Brake pads/ }));
    await user.selectOptions(unit, 'veh_2');
    await user.type(screen.getByLabelText(/Title/), 'Brake repair');
    await user.click(screen.getByRole('button', { name: 'Create work order' }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toMatchObject({ vehicleId: 'veh_2' });
    expect(body).not.toHaveProperty('defectIds');
  });

  it('no longer offers controls the request cannot carry', () => {
    server.use(http.get(url(endpoints.defects.list), () => ok({ items: [], page: 1, limit: 200, total: 0, totalPages: 1 })));
    renderModal(<CreateWorkOrderModal vehicleId="veh_1" onClose={vi.fn()} />);

    expect(screen.queryByText('Estimated labour')).not.toBeInTheDocument();
    expect(screen.queryByText('Notify the driver')).not.toBeInTheDocument();
    expect(screen.queryByText('Keep the unit out of service until closed')).not.toBeInTheDocument();
    expect(screen.queryByText('Block dispatch assignment')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as draft' })).not.toBeInTheDocument();
  });

  it('closes untouched without a confirm and confirms once a field is filled', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.defects.list), () => ok({ items: [], page: 1, limit: 200, total: 0, totalPages: 1 })));
    const onClose = vi.fn();
    const { unmount } = renderModal(<CreateWorkOrderModal vehicleId="veh_1" onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    unmount();

    const onClose2 = vi.fn();
    renderModal(<CreateWorkOrderModal vehicleId="veh_1" onClose={onClose2} />);
    await user.type(screen.getByLabelText(/Title/), 'Brake repair');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose2).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------------- Edit work order (clear) */

describe('EditWorkOrderModal — clearing a field clears it', () => {
  it('sends null for every field the user emptied', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.patch(url(endpoints.workOrders.update('wo_1')), async ({ request }) => {
        body = await request.json();
        return ok({ ...WORK_ORDER, vehicle: undefined });
      }),
    );
    renderModal(<EditWorkOrderModal workOrder={WORK_ORDER} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Assign to/));
    await user.clear(screen.getByLabelText(/Parts cost/));
    await user.clear(screen.getByLabelText(/Work to perform/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toMatchObject({ vendor: null, costUsd: null, description: null, title: 'Brake repair' });
  });

  it('is not dirty until something changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = renderModal(<EditWorkOrderModal workOrder={WORK_ORDER} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    unmount();

    const onClose2 = vi.fn();
    renderModal(<EditWorkOrderModal workOrder={WORK_ORDER} onClose={onClose2} />);
    await user.clear(screen.getByLabelText(/Assign to/));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose2).not.toHaveBeenCalled();
  });

  it('shows a failed save in an in-modal banner', async () => {
    const user = userEvent.setup();
    server.use(http.patch(url(endpoints.workOrders.update('wo_1')), () => HttpResponse.json({ statusCode: 500 }, { status: 500 })));
    renderModal(<EditWorkOrderModal workOrder={WORK_ORDER} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/Assign to/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ Edit schedule (clear) */

describe('EditScheduleModal — clearing a field clears it', () => {
  it('sends null for the emptied interval instead of keeping the old one', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.patch(url(endpoints.maintenanceSchedules.update('sch_1')), async ({ request }) => {
        body = await request.json();
        return ok({ ...SCHEDULE, vehicle: undefined });
      }),
    );
    renderModal(<EditScheduleModal schedule={SCHEDULE} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText('Interval (miles)'));
    await user.clear(screen.getByLabelText('Last service odometer'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(body).toBeTruthy());
    expect(body).toMatchObject({ name: 'Oil & filter', intervalMi: null, intervalDays: 180, lastServiceMi: null });
  });

  it('is not dirty until something changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = renderModal(<EditScheduleModal schedule={SCHEDULE} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    unmount();

    const onClose2 = vi.fn();
    renderModal(<EditScheduleModal schedule={SCHEDULE} onClose={onClose2} />);
    await user.clear(screen.getByLabelText('Interval (miles)'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose2).not.toHaveBeenCalled();
  });
});


// WB-159 — 11.15 DVIR detail: `Export PDF` had no handler, `Print` printed the whole application
// and the photo tiles were buttons that did nothing.
describe('DvirDrawer — 11.15', () => {
  function renderDrawer() {
    return renderModal(<DvirDrawer dvirId="dvir_1" onClose={() => {}} onCreateWorkOrder={() => {}} />);
  }

  it('labels the mechanic name and repair status, and confirms before dropping a typed name (stage 3)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(<DvirDrawer dvirId="dvir_1" onClose={onClose} onCreateWorkOrder={() => {}} />);
    await screen.findByText(/Inspection/);

    const name = await screen.findByRole('textbox', { name: 'Mechanic name' });
    expect(screen.getByRole('combobox', { name: 'Repair status' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    await user.type(name, 'J. Alvarez');
    await user.keyboard('{Escape}');
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables Export PDF with the reason on screen (B-75)', async () => {
    renderDrawer();
    await screen.findByText(/Inspection/);
    const pdf = screen.getByRole('button', { name: 'Export PDF' });
    expect(pdf).toBeDisabled();
    expect(screen.getByText('PDF export is not available yet.')).toBeInTheDocument();
  });

  it('Print renders the inspection into its own document instead of window.print()', async () => {
    const appPrint = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    renderDrawer();
    await screen.findByText(/Inspection/);

    await user.click(screen.getByRole('button', { name: 'Print' }));

    expect(appPrint).not.toHaveBeenCalled();
    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.contentDocument?.body.textContent).toContain('DVIR #dvir_1');
    appPrint.mockRestore();
  });

  it('photo tiles are no longer clickable buttons and say why (B-41)', async () => {
    server.use(
      http.get(url(endpoints.dvir.detail(':id')), () =>
        ok({
          id: 'dvir_1',
          vehicleId: 'veh_1',
          type: 'PRE_TRIP',
          submittedAt: '2026-09-10T12:00:00.000Z',
          odometerMi: 993589,
          defects: [],
          photos: [{ id: 'att_1', key: 'x/y.jpg' }],
        }),
      ),
    );
    renderDrawer();
    await screen.findByText(/Photos · /);

    expect(screen.queryByRole('button', { name: 'View photo' })).not.toBeInTheDocument();
    expect(screen.getByText('Photos were uploaded by the driver but cannot be shown here yet.')).toBeInTheDocument();
  });
});
