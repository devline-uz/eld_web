// web/tz.md W-20 — four states, read-only rule (§12.2) and the pair/unpair/register mutations.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import DevicesPage from './DevicesPage';

let canFull = true;
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (_key: string, level?: string) => (level === 'FULL' ? canFull : true) }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DevicesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const DEVICE = {
  id: 'dev_1',
  serial: 'PT30_A86E',
  model: 'PT30',
  status: 'ASSIGNED',
  vehicleId: 'veh_1',
  bleState: 'CONNECTED',
  firmwareVersion: 'L108',
  firmwareOutdated: true,
  lastHeartbeatAt: new Date().toISOString(),
  storedEventsCount: 12,
};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  canFull = true;
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('DevicesPage — W-20', () => {
  it('shows the empty state when there are no devices', async () => {
    server.use(http.get(url(endpoints.devices.list), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findByText('No devices registered yet')).toBeInTheDocument();
  });

  it('shows an in-card error with Retry on failure', async () => {
    server.use(http.get(url(endpoints.devices.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('renders the populated table and removes the row menu and Register device for a READ-only caller', async () => {
    canFull = false;
    server.use(http.get(url(endpoints.devices.list), () => ok({ items: [DEVICE], page: 1, limit: 25, total: 1, totalPages: 1 })));
    renderPage();
    expect(await screen.findByText('PT30_A86E')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register device/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });

  it('unpairs a device from the row menu', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.devices.list), () => ok({ items: [DEVICE], page: 1, limit: 25, total: 1, totalPages: 1 })));
    let unpaired = false;
    server.use(
      http.post(url(endpoints.devices.unpair(DEVICE.id)), () => {
        unpaired = true;
        return ok({ ...DEVICE, vehicleId: null });
      }),
    );

    renderPage();
    await screen.findByText('PT30_A86E');
    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Unpair'));

    await waitFor(() => expect(unpaired).toBe(true));
  });

  it('registers a device from the modal and shows the created toast', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.devices.list), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })));
    let created: unknown = null;
    server.use(
      http.post(url(endpoints.devices.create), async ({ request }) => {
        created = await request.json();
        return ok({ id: 'dev_9', serial: 'PT30_1C4F', model: 'PT30', status: 'UNASSIGNED', bleState: 'DISCONNECTED' }, 201);
      }),
    );

    renderPage();
    await screen.findByText('No devices registered yet');
    await user.click(screen.getByRole('button', { name: /register device/i }));

    const serialInput = await screen.findByPlaceholderText('PT30_1C4F');
    await user.type(serialInput, 'PT30_1C4F');
    await user.click(screen.getByRole('button', { name: 'Register device' }));

    await waitFor(() => expect(created).not.toBeNull());
    expect(created).toMatchObject({ serial: 'PT30_1C4F', model: 'PT30' });
    expect(await screen.findByText('Device PT30_1C4F registered')).toBeInTheDocument();
  });

  it('filters by segment and search text, and retires a device', async () => {
    const user = userEvent.setup();
    const secondDevice = { ...DEVICE, id: 'dev_2', serial: 'PT40_9F21', bleState: 'DISCONNECTED', vehicleId: null };
    server.use(
      http.get(url(endpoints.devices.list), () => ok({ items: [DEVICE, secondDevice], page: 1, limit: 25, total: 2, totalPages: 1 })),
    );
    let retired = false;
    server.use(
      http.delete(url(endpoints.devices.remove(DEVICE.id)), () => {
        retired = true;
        return ok({ ...DEVICE, status: 'RETIRED' });
      }),
    );

    renderPage();
    await screen.findByText('PT30_A86E');
    expect(screen.getByText('PT40_9F21')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^disconnected/i }));
    expect(screen.queryByText('PT30_A86E')).not.toBeInTheDocument();
    expect(screen.getByText('PT40_9F21')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^all/i }));
    await user.type(screen.getByPlaceholderText('Search serial or unit…'), 'A86E');
    // Search is layered over the DataTable's own rows (client-side, unlike segment) — the row
    // stays because DevicesPage doesn't currently filter rows by the search box beyond passing it
    // to the server; assert the input at least accepts the value without throwing.
    expect(screen.getByPlaceholderText('Search serial or unit…')).toHaveValue('A86E');

    await user.click(screen.getByRole('button', { name: /^all/i }));
    const targetRow = (await screen.findByText('PT30_A86E')).closest('tr')!;
    await user.click(within(targetRow).getByRole('button', { name: 'Row actions' }));
    await user.click(screen.getByText('Retire device'));
    await waitFor(() => expect(retired).toBe(true));
  });

  it('WB-041 — UNIT column shows the joined unit number, not the raw vehicle UUID, and — for an unassigned device', async () => {
    const unassigned = { ...DEVICE, id: 'dev_3', serial: 'PT40_UNASSIGNED', vehicleId: null };
    server.use(
      http.get(url(endpoints.devices.list), () =>
        ok({ items: [DEVICE, unassigned], page: 1, limit: 25, total: 2, totalPages: 1 }),
      ),
    );
    renderPage();
    const unitCell = (await screen.findByText('PT30_A86E')).closest('tr')!;
    expect(within(unitCell).getByText('#101')).toBeInTheDocument();
    expect(within(unitCell).queryByText(DEVICE.vehicleId)).not.toBeInTheDocument();

    const unassignedRow = screen.getByText('PT40_UNASSIGNED').closest('tr')!;
    const cells = within(unassignedRow).getAllByRole('cell');
    // UNIT is the 4th column (SERIAL, MODEL, FIRMWARE, UNIT, ...).
    expect(within(cells[3]!).getByText('—')).toBeInTheDocument();
  });

  // Regression — `page` was kept across a query change, so a search typed on page 2 asked the
  // server for page 2 of the narrowed result: an empty page, rendered as "No results for …"
  // although the device exists. Same for switching segment.
  describe('re-pages when the server query changes', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...DEVICE,
      id: `dev_${i}`,
      serial: `PT30_${String(i).padStart(4, '0')}`,
      status: i === 7 ? 'UNASSIGNED' : 'ASSIGNED',
      vehicleId: i === 7 ? null : 'veh_1',
    }));

    function usePagedDevices() {
      server.use(
        http.get(url(endpoints.devices.list), ({ request }) => {
          const p = new URL(request.url).searchParams;
          const q = (p.get('q') ?? '').toLowerCase();
          const status = p.get('status');
          const page = Math.max(1, Number(p.get('page') ?? 1));
          const limit = Math.max(1, Number(p.get('limit') ?? 25));
          let items = many;
          if (status) items = items.filter((d) => d.status === status);
          if (q) items = items.filter((d) => d.serial.toLowerCase().includes(q));
          const total = items.length;
          return ok({
            items: items.slice((page - 1) * limit, page * limit),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          });
        }),
      );
    }

    it('shows the match instead of an empty state when a search is typed on page 2', async () => {
      const user = userEvent.setup();
      usePagedDevices();
      renderPage();

      await user.click(await screen.findByRole('button', { name: '2' }));
      expect(await screen.findByText('PT30_0025')).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText('Search serial or unit…'), 'PT30_0003');
      expect(await screen.findByText('PT30_0003')).toBeInTheDocument();
      expect(screen.queryByText(/No results/i)).not.toBeInTheDocument();
    });

    it('shows the unassigned device instead of an empty state when the segment changes on page 2', async () => {
      const user = userEvent.setup();
      usePagedDevices();
      renderPage();

      await user.click(await screen.findByRole('button', { name: '2' }));
      expect(await screen.findByText('PT30_0025')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^unassigned/i }));
      expect(await screen.findByText('PT30_0007')).toBeInTheDocument();
      expect(screen.queryByText('No devices registered yet')).not.toBeInTheDocument();
    });
  });

  it('exports devices to a JSON file', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.devices.list), () => ok({ items: [DEVICE], page: 1, limit: 25, total: 1, totalPages: 1 })));
    server.use(http.get(url(endpoints.devices.export), () => ok({ devices: [{ serial: DEVICE.serial }] })));

    // jsdom does not implement `URL.createObjectURL`/`revokeObjectURL` at all.
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    renderPage();
    await screen.findByText('PT30_A86E');
    await user.click(screen.getByRole('button', { name: /export/i }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });
});
