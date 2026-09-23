// web/tz.md W-17 — four states, `Save changes` gating, and the exact `Settings saved` toast.
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
import CompanyProfilePage from './CompanyProfilePage';

let canFull = true;
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => canFull }) }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CompanyProfilePage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const CARRIER = {
  id: 'carrier',
  name: 'Universal Logistics Inc.',
  dotNumber: '1234567',
  mcNumber: 'MC-892014',
  ein: '88-4192055',
  timezone: 'America/New_York',
  hosRuleset: 'US_70_8_PROPERTY',
  distanceUnit: 'MILES',
  cycleRestart: true,
  unassignedThresholdMin: 3,
  dvirRetentionMonths: 24,
  allowPersonalConveyance: true,
  allowYardMove: true,
  addressLine1: '4517 Washington Ave.',
  city: 'Columbus',
  state: 'OH',
  zip: '43004',
  phone: '+1 614 555 0104',
  complianceEmail: 'compliance@universal-logistics.example',
  eldIdentifier: 'OBK1',
  eldRegistrationId: 'OBK1',
  erodsMode: 'TEST',
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

describe('CompanyProfilePage — W-17', () => {
  it('shows a loading skeleton, then an error state on failure', async () => {
    server.use(http.get(url(endpoints.carrier.root), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('renders the loaded profile with Save changes disabled until dirty, then saves', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    let patched: unknown = null;
    server.use(
      http.patch(url(endpoints.carrier.root), async ({ request }) => {
        patched = await request.json();
        return ok({ ...CARRIER, name: 'Acme Trucking' });
      }),
    );

    renderPage();
    const saveButton = await screen.findByRole('button', { name: 'Save changes' });
    expect(saveButton).toBeDisabled();

    const nameInput = screen.getByDisplayValue('Universal Logistics Inc.');
    await user.clear(nameInput);
    await user.type(nameInput, 'Acme Trucking');

    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => expect(patched).not.toBeNull());
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it('rejects an ELD identifier that is not exactly 4 [A-Z0-9] characters', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();

    const eldInputs = await screen.findAllByDisplayValue('OBK1');
    const eldInput = eldInputs[0]!;
    await user.clear(eldInput);
    await user.type(eldInput, 'AB');
    // WB — validated on blur (11.30), not on every keystroke.
    expect(screen.queryByText(/The ELD identifier/)).not.toBeInTheDocument();
    await user.tab();

    expect(
      await screen.findByText('The ELD identifier is exactly 4 characters, letters and digits only.'),
    ).toBeInTheDocument();
  });

  it('WB-112 — a lowercase ELD identifier is kept exactly as typed, never auto-corrected to uppercase', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();

    const eldInputs = await screen.findAllByDisplayValue('OBK1');
    const eldInput = eldInputs[0]!;
    await user.clear(eldInput);
    await user.type(eldInput, 'obk1');
    await user.tab();

    expect(eldInput).toHaveValue('obk1');
    // WB — the message names the real fault (casing), not a wrong length.
    expect(await screen.findByText('The ELD identifier must be uppercase — enter OBK1.')).toBeInTheDocument();
  });

  it('touches every remaining field once', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();
    await screen.findByDisplayValue('Universal Logistics Inc.');

    async function retype(currentValue: string, nextValue: string) {
      const field = screen.getByDisplayValue(currentValue);
      await user.clear(field);
      await user.type(field, nextValue);
    }

    await retype('1234567', '7654321');
    await retype('MC-892014', 'MC-100000');
    await retype('88-4192055', '99-0000000');
    await retype('+1 614 555 0104', '+1 555 000 0000');
    await retype('compliance@universal-logistics.example', 'ops@example.com');
    await retype('4517 Washington Ave.', '1 Main St.');
    await retype('Columbus', 'Dayton');
    await user.selectOptions(screen.getByDisplayValue('OH'), 'NY');
    await retype('43004', '10001');

    await user.selectOptions(screen.getByDisplayValue('US 70 hr / 8 day — Property carrying'), 'US_60_7_PROPERTY');
    await user.selectOptions(screen.getByDisplayValue('34-hour restart'), 'none');
    await user.selectOptions(screen.getByDisplayValue('America/New_York (Eastern)'), 'America/Chicago');
    await user.selectOptions(screen.getByDisplayValue('Miles'), 'KILOMETERS');

    await retype('3', '5');
    await retype('24', '36');

    const pcToggle = screen.getByText('Allow personal conveyance').closest('div')!.parentElement!.querySelector('button')!;
    const ymToggle = screen.getByText('Allow yard move').closest('div')!.parentElement!.querySelector('button')!;
    await user.click(pcToggle);
    await user.click(ymToggle);

    const eldRegInputs = await screen.findAllByDisplayValue('OBK1');
    await user.clear(eldRegInputs[1]!);
    await user.type(eldRegInputs[1]!, 'OBK2');

    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('each field only takes its own kind of data as typed', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();
    await screen.findByDisplayValue('Universal Logistics Inc.');

    async function typeInto(currentValue: string, typed: string) {
      const field = screen.getByDisplayValue(currentValue);
      await user.clear(field);
      await user.type(field, typed);
      return field;
    }

    expect(await typeInto('1234567', 'abc12x3')).toHaveValue('123');
    expect(await typeInto('MC-892014', 'mc55z1')).toHaveValue('MC-551');
    expect(await typeInto('88-4192055', 'ab123456789')).toHaveValue('12-3456789');
    expect(await typeInto('+1 614 555 0104', '+1 six 614')).toHaveValue('+1  614');
    expect(await typeInto('compliance@universal-logistics.example', 'ops @acme.com')).toHaveValue('ops@acme.com');
    expect(await typeInto('Columbus', 'Dayton 45')).toHaveValue('Dayton ');
    expect(await typeInto('43004', '4321a51234')).toHaveValue('43215-1234');
    expect(await typeInto('24', '3x6')).toHaveValue('36');
  });

  it('never saves an incomplete value — the field shows why', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    let patched = false;
    server.use(
      http.patch(url(endpoints.carrier.root), () => {
        patched = true;
        return ok(CARRIER);
      }),
    );
    renderPage();
    await screen.findByDisplayValue('Universal Logistics Inc.');

    const email = screen.getByDisplayValue('compliance@universal-logistics.example');
    await user.clear(email);
    await user.type(email, 'ops@acme');
    const zip = screen.getByDisplayValue('43004');
    await user.clear(zip);
    await user.type(zip, '4321');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter a 5-digit ZIP or ZIP+4 (43215-1234).')).toBeInTheDocument();
    expect(patched).toBe(false);

    await user.type(zip, '5');
    expect(screen.queryByText('Enter a 5-digit ZIP or ZIP+4 (43215-1234).')).toBeNull();
  });

  it('confirms before switching eRODS to production, then saves', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    let patched: unknown = null;
    server.use(
      http.patch(url(endpoints.carrier.root), async ({ request }) => {
        patched = await request.json();
        return ok({ ...CARRIER, erodsMode: 'PRODUCTION' });
      }),
    );

    renderPage();
    await screen.findByDisplayValue('Universal Logistics Inc.');
    await user.selectOptions(screen.getByDisplayValue('TEST'), 'PRODUCTION');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Switch to production eRODS?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to production' }));

    await waitFor(() => expect(patched).not.toBeNull());
    expect((patched as { erodsMode: string }).erodsMode).toBe('PRODUCTION');
  });

  it('shows an error toast when the save fails', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    server.use(http.patch(url(endpoints.carrier.root), () => fail(500, 'INTERNAL_ERROR', 'Boom')));

    renderPage();
    const nameInput = await screen.findByDisplayValue('Universal Logistics Inc.');
    await user.type(nameInput, ' II');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('renders every field read-only and removes Save changes for a READ-only caller', async () => {
    canFull = false;
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();

    const nameInput = await screen.findByDisplayValue('Universal Logistics Inc.');
    expect(nameInput).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('US 70 hr / 8 day — Property carrying')).toBeDisabled();
    expect(screen.getByDisplayValue('TEST')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();

    const pcToggle = screen.getByText('Allow personal conveyance').closest('div')!.parentElement!.querySelector('button')!;
    expect(pcToggle).toBeDisabled();
  });
});

/* ------------------------------------------------------------------ stage-2 */

describe('CompanyProfilePage — onBlur validation', () => {
  it('flags a bad DOT number when the field is left, not only on Save', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();

    const dot = await screen.findByDisplayValue('1234567');
    await user.clear(dot);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.tab();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('clears the field error as soon as the value is corrected', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();

    const dot = await screen.findByDisplayValue('1234567');
    await user.clear(dot);
    await user.tab();
    await screen.findByRole('alert');

    await user.type(dot, '7654321');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
