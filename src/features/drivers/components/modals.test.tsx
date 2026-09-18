// Smoke coverage for the driver overlays (11.7, 11.8). 11.8 is Q-3 — the only place a driver
// account is created.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { AddDriverModal } from './AddDriverModal';
import { ImportDriversModal } from './ImportDriversModal';

function renderWithProviders(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
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

describe('11.8 Add driver (Q-3)', () => {
  it('creates a driver account and fires the exact §13.3 toast with the invitation email', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.post(url(endpoints.drivers.create), () => ok({ id: 'drv_new', username: 'kwatson', status: 'ACTIVE' })),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    await user.type(screen.getByLabelText(/First name/), 'Kristin');
    await user.type(screen.getByLabelText(/Last name/), 'Watson');
    await user.type(screen.getByLabelText(/^Username/), 'kwatson');
    await user.type(screen.getByLabelText(/^Password/), 'password1');
    await user.type(screen.getByLabelText(/Email address/), 'kristin.watson@gmail.com');
    await user.type(screen.getByLabelText(/Driver licence number/), 'W1234567');
    await user.click(screen.getByRole('button', { name: 'Save driver' }));

    expect(await screen.findByText('Driver added')).toBeInTheDocument();
    expect(screen.getByText('An invitation was sent to kristin.watson@gmail.com.')).toBeInTheDocument();
  });

  it('requires an exemption reason once ELD exempt is checked', async () => {
    server.use(http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })));
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    await user.click(screen.getByText('Exempt from ELD (8-day rule)'));
    expect(screen.getByText('Exemption reason')).toBeInTheDocument();
  });
});

describe('11.7 Import drivers', () => {
  it('flags a missing email as a per-row warning (SMS is never mentioned, Q-2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportDriversModal onClose={() => {}} />);

    const file = new File(['username,email,cdlState\njdoe,,OH'], 'drivers.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText(/Missing or duplicate email/)).toBeInTheDocument();
    expect(screen.getByText(/one-time sign-in code/)).toBeInTheDocument();
    expect(screen.queryByText(/SMS/)).not.toBeInTheDocument();
  });

  it('WB-106 — does not shift columns on a quoted field containing a comma', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportDriversModal onClose={() => {}} />);

    const file = new File(
      ['username,email,address,cdlState\njdoe,jdoe@example.com,"123 Main St, Suite 4",OH'],
      'drivers.csv',
      { type: 'text/csv' },
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('drivers.csv')).toBeInTheDocument();
    // The row is valid: no "missing CDL state" warning, because the comma inside the quoted
    // address never bled into the cdlState column.
    expect(screen.queryByText(/Missing CDL issuing state/)).not.toBeInTheDocument();
  });

  it('WB-107 — flags a duplicate (non-empty) email across rows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportDriversModal onClose={() => {}} />);

    const file = new File(
      ['username,email,cdlState\njdoe,dup@example.com,OH\nasmith,dup@example.com,OH'],
      'drivers.csv',
      { type: 'text/csv' },
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('2 warnings')).toBeInTheDocument();
  });

  it('WB-108 — rejects a file over the advertised 500-row maximum', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportDriversModal onClose={() => {}} />);

    const body = Array.from({ length: 501 }, (_, i) => `jdoe${i},jdoe${i}@example.com,OH`).join('\n');
    const file = new File([`username,email,cdlState\n${body}`], 'drivers.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText(/File has 501 rows — 500 rows maximum\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import drivers' })).toBeDisabled();
  });
});
