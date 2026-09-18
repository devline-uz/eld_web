// web/tz.md §11.10 Create trip — B-31: an unverified driver's e-mail must block `Create trip`,
// not just show the warning (WB-115).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import { CreateTripModal } from './CreateTripModal';

const UNVERIFIED_DRIVER = {
  id: 'drv_unverified',
  firstName: 'Uma',
  lastName: 'Unverified',
  homeTerminalName: 'Columbus, OH',
  emailVerified: false,
};

const VERIFIED_DRIVER = {
  id: 'drv_verified',
  firstName: 'Vera',
  lastName: 'Verified',
  homeTerminalName: 'Columbus, OH',
  emailVerified: true,
};

function renderModal() {
  server.use(
    http.get(url(endpoints.drivers.list), () =>
      ok({ items: [UNVERIFIED_DRIVER, VERIFIED_DRIVER], page: 1, limit: 200, total: 2, totalPages: 1 }),
    ),
    http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    http.get(url(endpoints.drivers.hos(':id')), () =>
      ok({ driveRemainingSec: 36000, shiftRemainingSec: 39600, cycleRemainingSec: 180000, breakInSec: 7200, onDutySince: null }),
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateTripModal onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

// The trigger's own text changes once a driver is picked (placeholder → the driver's name), so
// it is located via the "Driver" field label rather than by its current label text.
function driverTriggerButton() {
  const label = screen
    .getByText((content, element) => element?.tagName === 'SPAN' && element.classList.contains('text-label') && content.trim().startsWith('Driver'))
    .closest('label');
  if (!label) throw new Error('Driver field label not found');
  return within(label).getByRole('button');
}

async function selectDriver(name: string) {
  const user = userEvent.setup();
  await user.click(driverTriggerButton());
  await user.click(await screen.findByText(name));
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CreateTripModal — WB-115 assignment block', () => {
  it('disables `Create trip` once an e-mail-unverified driver is picked', async () => {
    renderModal();

    await selectDriver('Uma Unverified');

    expect(await screen.findByText(/e-mail is not verified/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create trip' })).toBeDisabled();
  });

  it('leaves `Create trip` enabled for a verified driver', async () => {
    renderModal();

    await selectDriver('Vera Verified');

    expect(screen.queryByText(/e-mail is not verified/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create trip' })).not.toBeDisabled();
  });

  it('re-enables `Create trip` after swapping to a verified driver', async () => {
    renderModal();

    await selectDriver('Uma Unverified');
    expect(screen.getByRole('button', { name: 'Create trip' })).toBeDisabled();

    await selectDriver('Vera Verified');
    expect(screen.getByRole('button', { name: 'Create trip' })).not.toBeDisabled();
  });
});
