// 11.4 Assign driver to unit — a refusal is stated in the modal in the server's own words.
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
import type { VehicleRow } from '@/shared/api/vehicles';
import { AssignDriverModal } from './AssignDriverModal';

const VEHICLE = { id: 'veh_1', unitNumber: '#101', status: 'ACTIVE', make: 'Freightliner', model: 'Cascadia', year: 2021 } as VehicleRow;

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AssignDriverModal vehicle={VEHICLE} onClose={() => {}} />
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
        items: [{ id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH', assignedVehicleId: null }],
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
      }),
    ),
  );
});

async function assignAndFail(status: number, code: string, message: string) {
  server.use(http.post(url(endpoints.vehicles.assignDriver('veh_1')), () => fail(status, code, message)));
  const user = userEvent.setup();
  renderModal();
  await user.click(await screen.findByText('John Smith'));
  await user.click(screen.getByRole('button', { name: 'Assign driver' }));
  return screen.findByRole('alert');
}

describe('AssignDriverModal — refusals', () => {
  it('409 on an inactive unit reads the server sentence, not "That value is already in use."', async () => {
    const alert = await assignAndFail(409, 'CONFLICT', 'Vehicle is inactive and cannot be assigned a driver.');
    expect(alert).toHaveTextContent('Vehicle is inactive and cannot be assigned a driver.');
    expect(screen.queryByText('That value is already in use.')).not.toBeInTheDocument();
  });

  it('404 on a deleted driver says so', async () => {
    const alert = await assignAndFail(404, 'DRIVER_NOT_FOUND', 'Driver not found.');
    expect(alert).toHaveTextContent('This driver was deleted or no longer exists. Pick another driver.');
  });
});
