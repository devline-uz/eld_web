// 11.4 `Co-driver ▾` — B-7 pairing write: the primary driver is never offered, the body matches
// `CreateCoDriverPairingDto`, and a 409 is stated in the server's own words.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import type { DriverRow, VehicleRow } from '@/shared/api/vehicles';
import { AssignCoDriverModal } from './AssignCoDriverModal';

const VEHICLE = { id: 'veh_1', unitNumber: '#101', status: 'ACTIVE', make: 'Freightliner', model: 'Cascadia', year: 2021 } as VehicleRow;
const PRIMARY = { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith' } as DriverRow;

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AssignCoDriverModal vehicle={VEHICLE} primaryDriver={PRIMARY} onClose={() => {}} />
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
  server.use(
    http.get(url(endpoints.drivers.list), () =>
      ok({
        items: [
          { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH', assignedVehicleId: 'veh_1' },
          { id: 'drv_2', username: 'mwebb', firstName: 'Marcus', lastName: 'Webb', status: 'ACTIVE', homeTerminalName: 'Columbus, OH', assignedVehicleId: null },
        ],
        page: 1,
        limit: 25,
        total: 2,
        totalPages: 1,
      }),
    ),
  );
});

describe('AssignCoDriverModal', () => {
  it('never offers the primary driver and posts the pairing DTO', async () => {
    let sent: unknown = null;
    server.use(
      http.post(url(endpoints.coDriverPairings.create), async ({ request }) => {
        sent = await request.json();
        return ok({ id: 'pair_1', primaryDriverId: 'drv_1', coDriverId: 'drv_2', vehicleId: 'veh_1', startedAt: new Date().toISOString(), endedAt: null }, 201);
      }),
    );
    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByText('Marcus Webb'));
    expect(screen.queryByRole('button', { name: /John Smith/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Assign co-driver' }));
    expect(await screen.findByText('Co-driver assigned')).toBeInTheDocument();
    expect(sent).toEqual({ primaryDriverId: 'drv_1', coDriverId: 'drv_2', vehicleId: 'veh_1' });
  });

  it('409 reads the server sentence, not "That value is already in use."', async () => {
    server.use(
      http.post(url(endpoints.coDriverPairings.create), () =>
        fail(409, 'CONFLICT', 'This co-driver already has an active pairing on this unit.'),
      ),
    );
    const user = userEvent.setup();
    renderModal();
    await user.click(await screen.findByText('Marcus Webb'));
    await user.click(screen.getByRole('button', { name: 'Assign co-driver' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This co-driver already has an active pairing on this unit.');
  });
});
