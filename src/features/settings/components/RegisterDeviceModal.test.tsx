// web/tz.md §11.20 — the QR banner, both toggles, the pair-on-register branch, and the 409 conflict.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { RegisterDeviceModal } from './RegisterDeviceModal';

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RegisterDeviceModal onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    ),
  };
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

describe('RegisterDeviceModal — 11.20', () => {
  it('shows the pairing success banner after Open scanner', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Open scanner' }));
    expect(await screen.findByText(/Device responded to the pairing request/)).toBeInTheDocument();
  });

  it('toggles both preference switches', async () => {
    const user = userEvent.setup();
    renderModal();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    await user.click(switches[0]!);
    await user.click(switches[1]!);
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    expect(switches[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('registers and pairs to a unit in one submit, sending the picker-selected vehicle id', async () => {
    const user = userEvent.setup();
    let paired: unknown = null;
    server.use(
      http.post(url(endpoints.devices.create), () =>
        ok({ id: 'dev_9', serial: 'PT30_1C4F', model: 'PT30', status: 'UNASSIGNED', bleState: 'DISCONNECTED' }, 201),
      ),
      http.post(url(endpoints.devices.pair('dev_9')), async ({ request }) => {
        paired = await request.json();
        return ok({ id: 'dev_9', status: 'ASSIGNED' }, 201);
      }),
    );

    renderModal();
    await user.type(screen.getByPlaceholderText('PT30_1C4F'), 'PT30_1C4F');
    // WB-109 — "Assign to unit" is a `useVehiclesPicker()`-sourced <select>, never free text; the
    // option value is the vehicle's real id (`veh_1`), not whatever an admin might type.
    const unitPicker = await screen.findByLabelText('Assign to unit');
    expect(unitPicker.tagName).toBe('SELECT');
    await user.selectOptions(unitPicker, await screen.findByRole('option', { name: '#101' }));
    await user.click(screen.getByRole('button', { name: 'Register device' }));

    await waitFor(() => expect(paired).toEqual({ vehicleId: 'veh_1' }));
    expect(await screen.findByText('Device PT30_1C4F registered')).toBeInTheDocument();
  });

  it('never renders a free-text input for the assigned unit', async () => {
    renderModal();
    expect(screen.queryByPlaceholderText('Unit 126')).not.toBeInTheDocument();
  });

  it('maps a 409 conflict onto the serial field', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.devices.create), () => fail(409, 'CONFLICT', 'A device with this serial is already registered.')));

    renderModal();
    await user.type(screen.getByPlaceholderText('PT30_1C4F'), 'PT30_A86E');
    await user.click(screen.getByRole('button', { name: 'Register device' }));

    expect(await screen.findByText('A device with this serial is already registered.')).toBeInTheDocument();
  });

  it('closes with Cancel', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
