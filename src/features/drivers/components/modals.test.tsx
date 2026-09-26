// Smoke coverage for the driver overlays (11.7, 11.8). 11.8 is Q-3 — the only place a driver
// account is created.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, delay } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
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

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/First name/), 'Kristin');
  await user.type(screen.getByLabelText(/Last name/), 'Watson');
  await user.type(screen.getByLabelText(/^Username/), 'kwatson');
  await user.type(screen.getByLabelText(/^Password/), 'password1');
  await user.type(screen.getByLabelText(/Email address/), 'kristin.watson@gmail.com');
  await user.type(screen.getByLabelText(/Driver licence number/), 'W1234567');
}

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

  it('WB — a double click on Save driver posts exactly once (mutation.isPending guard)', async () => {
    let posts = 0;
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.post(url(endpoints.drivers.create), async () => {
        posts += 1;
        await delay(60);
        return ok({ id: 'drv_new', username: 'kwatson', status: 'ACTIVE' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    await fillRequiredFields(user);
    const save = screen.getByRole('button', { name: 'Save driver' });
    await user.click(save);
    await user.click(save);

    expect(await screen.findByText('Driver added')).toBeInTheDocument();
    expect(posts).toBe(1);
  });

  it('WB — sends the terminal name in homeTerminalName and the matching IANA zone', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.post(url(endpoints.drivers.create), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ id: 'drv_new', username: 'kwatson', status: 'ACTIVE' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    await fillRequiredFields(user);
    // "Raleigh, NC (Eastern)" used to be sent as `America/Chicago`, and the zone string was
    // written into `homeTerminalName`.
    await user.selectOptions(screen.getByLabelText(/Home terminal/), 'Raleigh, NC');
    await user.click(screen.getByRole('button', { name: 'Save driver' }));

    await waitFor(() => expect(body.homeTerminalName).toBe('Raleigh, NC'));
    expect(body.homeTerminalTimezone).toBe('America/New_York');
  });

  it('WB — a failed POST is visible: banner inside the modal, and the modal stays open', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.post(url(endpoints.drivers.create), () => fail(500, 'INTERNAL_ERROR', 'Server exploded')),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={onClose} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Save driver' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('WB — a 422 maps details onto the field, not onto the banner', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.post(url(endpoints.drivers.create), () =>
        fail(422, 'VALIDATION_ERROR', 'Invalid payload', { cdlNumber: 'This licence number is already on file.' }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Save driver' }));

    expect(await screen.findByText('This licence number is already on file.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('WB — an untouched form closes without the 11.30 confirm', async () => {
    server.use(http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('WB — Cancel on an edited form confirms before discarding', async () => {
    server.use(http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={onClose} />);

    await user.type(screen.getByLabelText(/First name/), 'Kristin');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('WB — a checkbox outside RHF also counts as a real edit', async () => {
    server.use(http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={onClose} />);

    await user.click(screen.getByLabelText('Allow yard move'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('requires an exemption reason once ELD exempt is checked', async () => {
    server.use(http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })));
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    await user.click(screen.getByText('Exempt from ELD (8-day rule)'));
    expect(screen.getByText('Exemption reason')).toBeInTheDocument();
  });

  it('WB-191 — a blank exemption reason is an inline field error, not only a toast', async () => {
    server.use(http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })));
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    await user.click(screen.getByText('Exempt from ELD (8-day rule)'));
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Save driver' }));

    expect(await screen.findByText('An exemption reason is required while ELD exempt is checked.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Exemption reason/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('B-82 shipped — `Send invitation now` is a real toggle, checked by default', async () => {
    server.use(http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })));
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);

    const checkbox = screen.getByLabelText('Send invitation now');
    expect(checkbox).toBeEnabled();
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/No invitation email is sent/)).toBeInTheDocument();
  });

  it('WB-187 — every US state can be chosen as the issuing state', () => {
    renderWithProviders(<AddDriverModal onClose={() => {}} />);
    expect(within(screen.getByLabelText(/Issuing state/)).getAllByRole('option').length).toBeGreaterThan(50);
  });
});

describe('11.8 Add driver — duplicate values and unit assignment', () => {
  const page = <T,>(items: T[]) => ({ items, page: 1, limit: 500, total: items.length, totalPages: 1 });
  const VEHICLES = [
    { id: 'veh_a', unitNumber: '#201' },
    { id: 'veh_b', unitNumber: '#202' },
  ];
  const DRIVERS = [{ id: 'drv_x', username: 'other', cdlNumber: 'Z9999999', assignedVehicleId: 'veh_a' }];

  function stubLists(drivers: unknown[] = DRIVERS) {
    server.use(
      http.get(url(endpoints.vehicles.list), () => ok(page(VEHICLES))),
      http.get(url(endpoints.drivers.list), () => ok(page(drivers))),
    );
  }

  async function submitWithConflict(code: string, message: string, details?: Record<string, unknown>) {
    stubLists();
    server.use(http.post(url(endpoints.drivers.create), () => fail(409, code, message, details)));
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Save driver' }));
  }

  it('a duplicate email is shown on the email field, not on username', async () => {
    await submitWithConflict('DUPLICATE_EMAIL', 'Email taken', { email: 'Email taken' });
    expect(await screen.findByText('A driver with this email address already exists.')).toBeInTheDocument();
    expect(screen.queryByText('A driver with this username already exists.')).not.toBeInTheDocument();
  });

  it('a duplicate username still lands on the username field', async () => {
    await submitWithConflict('DUPLICATE_USERNAME', 'This username is already taken.');
    expect(await screen.findByText('A driver with this username already exists.')).toBeInTheDocument();
  });

  it('a generic CONFLICT naming details.field: phone is shown on the phone field', async () => {
    await submitWithConflict('CONFLICT', 'Conflict', { field: 'phone' });
    expect(await screen.findByText('A driver with this phone number already exists.')).toBeInTheDocument();
  });

  it('a duplicate licence number from the server is shown on the licence field', async () => {
    await submitWithConflict('DUPLICATE_CDL_NUMBER', 'Licence taken');
    expect(await screen.findByText('A driver with this licence number already exists.')).toBeInTheDocument();
  });

  it('an unattributed 409 says the value is in use instead of guessing a field', async () => {
    await submitWithConflict('CONFLICT', 'Unique constraint failed');
    expect(await screen.findByRole('alert')).toHaveTextContent('That value is already in use.');
    expect(screen.queryByText('A driver with this username already exists.')).not.toBeInTheDocument();
  });

  it('a unit that already has a driver is not offered', async () => {
    stubLists();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);
    const select = screen.getByLabelText(/Assigned unit/);
    await waitFor(() => {
      expect(within(select).getByRole('option', { name: '#202' })).toBeInTheDocument();
      expect(within(select).queryByRole('option', { name: '#201' })).not.toBeInTheDocument();
    });
  });

  it('a 409 for an already-assigned unit is shown on the unit field', async () => {
    stubLists([]);
    server.use(
      http.post(url(endpoints.drivers.create), () =>
        fail(409, 'VEHICLE_ALREADY_ASSIGNED', 'This unit already has a driver assigned.'),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);
    await fillRequiredFields(user);
    const select = screen.getByLabelText(/Assigned unit/);
    await waitFor(() => expect(within(select).getByRole('option', { name: '#201' })).toBeInTheDocument());
    await user.selectOptions(select, 'veh_a');
    await user.click(screen.getByRole('button', { name: 'Save driver' }));

    expect(await screen.findByText('This unit already has a driver assigned.')).toBeInTheDocument();
    expect(select).toHaveAttribute('aria-invalid', 'true');
  });

  it('a licence number already on file is caught before the POST', async () => {
    let posts = 0;
    stubLists([{ ...DRIVERS[0], cdlNumber: 'w123-4567' }]);
    server.use(
      http.post(url(endpoints.drivers.create), () => {
        posts += 1;
        return ok({ id: 'drv_new' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddDriverModal onClose={() => {}} />);
    // Both lookups loaded: #202 is listed and the assigned #201 is filtered out.
    await waitFor(() => {
      const select = screen.getByLabelText(/Assigned unit/);
      expect(within(select).getByRole('option', { name: '#202' })).toBeInTheDocument();
      expect(within(select).queryByRole('option', { name: '#201' })).not.toBeInTheDocument();
    });
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Save driver' }));

    expect(await screen.findByText('A driver with this licence number already exists.')).toBeInTheDocument();
    expect(posts).toBe(0);
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

  it('WB — the summary counts rows, not warnings (two warnings on one row is one bad row)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportDriversModal onClose={() => {}} />);

    // Row 2 has no email AND no CDL state: two warnings, one row needing attention. Row 3 is fine.
    const file = new File(
      ['username,email,cdlState\njdoe,,\nasmith,asmith@example.com,OH'],
      'drivers.csv',
      { type: 'text/csv' },
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText(/2 rows detected · 1 valid, 1 need attention/)).toBeInTheDocument();
  });

  it('B-69 shipped — the import options are real controls', async () => {
    renderWithProviders(<ImportDriversModal onClose={() => {}} />);

    expect(screen.getByRole('combobox', { name: 'Duplicate handling' })).toBeEnabled();
    expect(screen.getByLabelText(/Send app invitations after import/)).toBeChecked();
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
