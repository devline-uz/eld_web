// W-07 Edit driver — the international phone field and the licence rules it shares with 11.8.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import type { DriverRow } from '@/shared/api/drivers';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { EditDriverModal } from './EditDriverModal';

const DRIVER = {
  id: 'drv_1',
  username: 'jsmith',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  phone: '6145550100',
  cdlNumber: 'W8569238',
  cdlState: 'OH',
  status: 'ACTIVE',
  homeTerminalName: 'Columbus, OH',
  homeTerminalTimezone: 'America/New_York',
  fleetManagerId: null,
  assignedVehicleId: null,
  allowPersonalConveyance: true,
  allowYardMove: true,
  adverseDrivingEnabled: false,
  shortHaulException: false,
  splitSleeperEnabled: false,
  eldExempt: false,
  eldExemptReason: null,
  appVersion: null,
  appPlatform: null,
  registeredAt: '2025-04-18T00:00:00.000Z',
  emailVerifiedAt: '2025-04-19T00:00:00.000Z',
} as unknown as DriverRow;

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

function renderModal(driver: Partial<DriverRow> = {}, onClose = () => {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <EditDriverModal driver={{ ...DRIVER, ...driver } as DriverRow} onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function capturePatch() {
  const patched: { body: Record<string, unknown> | null } = { body: null };
  server.use(
    http.patch(url(endpoints.drivers.update('drv_1')), async ({ request }) => {
      patched.body = (await request.json()) as Record<string, unknown>;
      return ok({ ...DRIVER, ...patched.body });
    }),
  );
  return patched;
}

const phoneInput = () => screen.getByLabelText(/Phone number/) as HTMLInputElement;
const licenceInput = () => screen.getByLabelText(/Driver licence number/) as HTMLInputElement;
const save = () => screen.getByRole('button', { name: 'Save changes' });

describe('UI-005 Edit driver — HOS ruleset', () => {
  it('shows the driver\'s ruleset and leaves it out of the PATCH when untouched', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal({ hosRuleset: 'US_60_7_PROPERTY' });
    expect(screen.getByLabelText('HOS ruleset')).toHaveValue('US_60_7_PROPERTY');
    await user.clear(screen.getByLabelText(/First name/));
    await user.type(screen.getByLabelText(/First name/), 'Johnny');
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body).not.toHaveProperty('hosRuleset');
  });

  it('sends a changed ruleset', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal({ hosRuleset: 'US_70_8_PROPERTY' });
    await user.selectOptions(screen.getByLabelText('HOS ruleset'), 'US_70_8_PASSENGER');
    await user.click(save());
    await waitFor(() => expect(patched.body?.hosRuleset).toBe('US_70_8_PASSENGER'));
  });

  it('a row without a ruleset offers "Company default" and sends nothing for it', async () => {
    renderModal({ hosRuleset: undefined });
    expect(screen.getByLabelText('HOS ruleset')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Company default' })).toBeInTheDocument();
  });
});

describe('W-07 Edit driver — phone', () => {
  it('loads a legacy stored phone formatted, without making the form dirty', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({}, onClose);
    expect(phoneInput()).toHaveValue('+1 614 555 0100');
    // Untouched → Cancel closes straight away, no "Discard changes?" confirm.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('loads an international E.164 value formatted', () => {
    renderModal({ phone: '+998901234567' });
    expect(phoneInput()).toHaveValue('+998 90 123 45 67');
  });

  it('an edited phone is formatted as typed and submitted as E.164', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.clear(phoneInput());
    await user.type(phoneInput(), '998901234567');
    expect(phoneInput()).toHaveValue('+998 90 123 45 67');
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body!.phone).toBe('+998901234567');
  });

  it('an untouched legacy phone is normalized to E.164 on save', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body!.phone).toBe('+16145550100');
  });

  it('an untouched stored phone these rules reject does not block an unrelated edit', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal({ phone: '+1-555-0100' });
    await user.clear(screen.getByLabelText(/First name/));
    await user.type(screen.getByLabelText(/First name/), 'Johnny');
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body!.firstName).toBe('Johnny');
    expect(patched.body!.phone).toBeUndefined();
  });

  it('an incomplete phone is flagged on blur and blocks the save', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.clear(phoneInput());
    await user.type(phoneInput(), '+998 90 12');
    await user.tab();
    expect(await screen.findByText('This phone number is incomplete.')).toBeInTheDocument();
    await user.click(save());
    expect(patched.body).toBeNull();
  });
});

describe('W-07 Edit driver — licence', () => {
  it('submits the licence number trimmed and upper-cased', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.clear(licenceInput());
    await user.type(licenceInput(), ' w1234567 ');
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body!.cdlNumber).toBe('W1234567');
  });

  it('an empty licence number is required', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.clear(licenceInput());
    await user.tab();
    expect(await screen.findByText('Enter the driver licence number.')).toBeInTheDocument();
  });

  it('rejects invalid characters and a too-short number', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.clear(licenceInput());
    await user.type(licenceInput(), 'W12 345');
    await user.tab();
    expect(await screen.findByText('Use only letters, digits and hyphens.')).toBeInTheDocument();
    await user.clear(licenceInput());
    await user.type(licenceInput(), 'W12');
    await user.tab();
    expect(await screen.findByText('A licence number is 4 to 20 characters.')).toBeInTheDocument();
  });

  it('checks the number against a changed issuing state on blur', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.selectOptions(screen.getByLabelText(/Issuing state/), 'TX');
    await user.click(licenceInput());
    await user.tab();
    expect(
      await screen.findByText('This does not match the TX licence number format.'),
    ).toBeInTheDocument();
    await user.click(save());
    expect(patched.body).toBeNull();
  });

  it('an unchanged stored licence in an older format does not block an unrelated edit', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal({ cdlNumber: 'OH-W8569238' });
    await user.clear(screen.getByLabelText(/First name/));
    await user.type(screen.getByLabelText(/First name/), 'Johnny');
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body!.cdlNumber).toBe('OH-W8569238');
  });
});

describe('W-07 Edit driver — duplicate values (B-100)', () => {
  it.each([
    ['EMAIL_TAKEN', { email: 'x' }, 'A driver with this email address already exists.'],
    ['PHONE_TAKEN', { phone: 'x' }, 'A driver with this phone number already exists.'],
    ['CDL_NUMBER_TAKEN', { cdlNumber: 'x' }, 'A driver with this licence number already exists.'],
    ['CONFLICT', { field: 'phone' }, 'A driver with this phone number already exists.'],
  ])('a 409 %s lands on its field, not a toast', async (code, details, message) => {
    server.use(http.patch(url(endpoints.drivers.update('drv_1')), () => fail(409, code, 'Conflict', details)));
    const user = userEvent.setup();
    renderModal();
    await user.clear(licenceInput());
    await user.type(licenceInput(), 'W1234567');
    await user.click(save());
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('That value is already in use.')).not.toBeInTheDocument();
  });
});

describe('W-07 Edit driver — cached duplicate pre-check', () => {
  const OTHER = { id: 'drv_2', username: 'other', email: 'taken@example.com', phone: null, cdlNumber: 'T7654321', status: 'ACTIVE' };

  function renderWithList(list: unknown[]) {
    server.use(
      http.get(url(endpoints.drivers.list), () => ok({ items: list, page: 1, limit: 500, total: list.length, totalPages: 1 })),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <EditDriverModal driver={DRIVER as DriverRow} onClose={() => {}} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    return queryClient;
  }
  const loaded = (qc: QueryClient) => waitFor(() => expect(qc.getQueriesData({ queryKey: ['drivers'] }).some(([, d]) => d)).toBe(true));

  it("another driver's email blocks the save with no PATCH", async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    const qc = renderWithList([OTHER]);
    await loaded(qc);
    const email = screen.getByLabelText(/Email/);
    await user.clear(email);
    await user.type(email, ' TAKEN@example.com ');
    await user.click(save());
    expect(await screen.findByText('A driver with this email address already exists.')).toBeInTheDocument();
    expect(patched.body).toBeNull();
  });

  it('saving with its own values (it is in the list itself) is allowed', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    const qc = renderWithList([{ ...DRIVER, status: 'ACTIVE' }, OTHER]);
    await loaded(qc);
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
  });
});

describe('W-07 Edit driver — refusals are never silent', () => {
  it('a 422 on a rendered field goes on it; one on a field the form lacks is named in the banner', async () => {
    server.use(
      http.patch(url(endpoints.drivers.update('drv_1')), () =>
        fail(422, 'VALIDATION_FAILED', 'Invalid payload', {
          issues: [
            { path: ['firstName'], code: 'too_big', message: 'String must contain at most 80 character(s)' },
            { path: ['hosRuleset'], code: 'invalid_enum_value', message: 'Invalid enum value' },
          ],
        }),
      ),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({}, onClose);

    await user.click(save());

    expect(await screen.findByText('String must contain at most 80 character(s)')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('HOS ruleset: Invalid enum value.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('caps the name and terminal inputs at the UpdateDriverDto limits', () => {
    renderModal();
    expect(screen.getByLabelText(/First name/)).toHaveAttribute('maxLength', '80');
    expect(screen.getByLabelText(/Last name/)).toHaveAttribute('maxLength', '80');
    expect(screen.getByLabelText(/^Home terminal(?! time zone)/)).toHaveAttribute('maxLength', '120');
  });
});

describe('W-07 Edit driver — email change needs the acting user\'s password', () => {
  const emailInput = () => screen.getByLabelText(/Email address/) as HTMLInputElement;
  const passwordInput = () => screen.queryByLabelText(/Your password/) as HTMLInputElement | null;

  it('an unchanged email (any case / spaces) is not sent and asks for no password', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.clear(emailInput());
    await user.type(emailInput(), '  John.Smith@Example.com ');
    expect(passwordInput()).toBeNull();
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body).not.toHaveProperty('email');
    expect(patched.body).not.toHaveProperty('currentPassword');
  });

  it('a changed email shows the password prompt and blocks the save until it is filled', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.clear(emailInput());
    await user.type(emailInput(), 'new@example.com');
    expect(passwordInput()).not.toBeNull();

    await user.click(save());
    expect(await screen.findByText('Enter your password to change the email.')).toBeInTheDocument();
    expect(patched.body).toBeNull();

    await user.type(passwordInput() as HTMLInputElement, 'my-password');
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body).toMatchObject({ email: 'new@example.com', currentPassword: 'my-password' });
  });

  it('email is optional: a driver with none saves other fields with it blank, no password, no email sent', async () => {
    const patched = capturePatch();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ email: null } as Partial<DriverRow>, onClose);
    expect(emailInput()).toHaveValue('');
    expect(screen.getByText('Email address').parentElement?.textContent).not.toContain('*');
    await user.clear(screen.getByLabelText(/First name/));
    await user.type(screen.getByLabelText(/First name/), 'Johnny');
    expect(passwordInput()).toBeNull();
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body).toMatchObject({ firstName: 'Johnny' });
    expect(patched.body).not.toHaveProperty('email');
    expect(patched.body).not.toHaveProperty('currentPassword');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('a typed address is still validated', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal({ email: null } as Partial<DriverRow>);
    await user.type(emailInput(), 'not-an-email');
    await user.click(save());
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(patched.body).toBeNull();
  });

  it('clearing an existing email asks for the password, then sends email "" with it', async () => {
    const patched = capturePatch();
    const user = userEvent.setup();
    renderModal();
    await user.clear(emailInput());
    expect(passwordInput()).not.toBeNull();
    expect(screen.getByText(/Removing the driver.s email needs your own password/)).toBeInTheDocument();

    await user.click(save());
    expect(await screen.findByText('Enter your password to remove the email.')).toBeInTheDocument();
    expect(patched.body).toBeNull();

    await user.type(passwordInput() as HTMLInputElement, 'my-password');
    await user.click(save());
    await waitFor(() => expect(patched.body).not.toBeNull());
    expect(patched.body).toMatchObject({ email: '', currentPassword: 'my-password' });
  });

  it('a wrong password (401 REAUTH_FAILED) is shown on the password field and keeps the modal open', async () => {
    server.use(
      http.patch(url(endpoints.drivers.update('drv_1')), () =>
        fail(401, 'REAUTH_FAILED', 'Password is incorrect.', { currentPassword: 'Password is incorrect.' }),
      ),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({}, onClose);
    await user.clear(emailInput());
    await user.type(emailInput(), 'new@example.com');
    await user.type(passwordInput() as HTMLInputElement, 'nope');
    await user.click(save());
    expect(await screen.findByText('Password is incorrect.')).toBeInTheDocument();
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
    expect(onClose).not.toHaveBeenCalled();
  });
});
