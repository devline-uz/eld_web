// web/tz.md W-17 — four states, `Save changes` gating, and the exact `Settings saved` toast.
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
  eldIdentifier: 'OBK001',
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

  it('rejects an ELD identifier that is not exactly 6 [A-Z0-9] characters', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();

    const eldInputs = await screen.findAllByDisplayValue('OBK001');
    const eldInput = eldInputs[0]!;
    await user.clear(eldInput);
    await user.type(eldInput, 'AB');
    // WB — validated on blur (11.30), not on every keystroke.
    expect(screen.queryByText(/The ELD identifier/)).not.toBeInTheDocument();
    await user.tab();

    expect(
      await screen.findByText('The ELD identifier is exactly 6 characters, letters and digits only.'),
    ).toBeInTheDocument();
  });

  it('WB-112 — a lowercase ELD identifier is kept exactly as typed, never auto-corrected to uppercase', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();

    const eldInputs = await screen.findAllByDisplayValue('OBK001');
    const eldInput = eldInputs[0]!;
    await user.clear(eldInput);
    await user.type(eldInput, 'obk001');
    await user.tab();

    expect(eldInput).toHaveValue('obk001');
    // WB — the message names the real fault (casing), not a wrong length.
    expect(await screen.findByText('The ELD identifier must be uppercase — enter OBK001.')).toBeInTheDocument();
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
    await user.click(screen.getByRole('combobox', { name: /^State/ }));
    await user.click(screen.getByRole('option', { name: 'NY' }));
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

    const eldRegInput = await screen.findByDisplayValue('OBK1');
    await user.clear(eldRegInput);
    await user.type(eldRegInput, 'OBK2');

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
    expect(await typeInto('+1 614 555 0104', '+1 six 614')).toHaveValue('+1 614');
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

/* ------------------------------------------------------------------ field-level save errors */

/** The `<label>` wrapping the field whose caption starts with `caption`. */
function fieldOf(caption: string) {
  const escaped = caption.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const label = screen.getByText(new RegExp(`^${escaped}`), { selector: 'span.text-label' }).closest('label');
  if (!label) throw new Error(`No field labelled ${caption}`);
  return label;
}

/** Asserts `message` is the error shown under `caption`, and that its control is marked invalid. */
function expectFieldError(caption: string, message: string) {
  const label = fieldOf(caption);
  expect(within(label).getByRole('alert')).toHaveTextContent(message);
  expect(label.querySelector('input, select, [role="combobox"]')).toHaveAttribute('aria-invalid', 'true');
}

/** Loads a carrier with `overrides`, makes the form dirty, and presses Save. */
async function saveWith(overrides: Record<string, unknown>, onPatch: (body: unknown) => Response | Promise<Response> = () => ok(CARRIER)) {
  const user = userEvent.setup();
  server.use(http.get(url(endpoints.carrier.root), () => ok({ ...CARRIER, ...overrides })));
  server.use(http.patch(url(endpoints.carrier.root), async ({ request }) => onPatch(await request.json())));
  renderPage();
  const name = await screen.findByDisplayValue(String(overrides.name ?? CARRIER.name));
  await user.type(name, ' II');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  return user;
}

describe('CompanyProfilePage — every save error is shown under its own field', () => {
  it.each([
    ['US DOT number', { dotNumber: '12AB45' }, 'A USDOT number is 1 to 8 digits.'],
    ['MC number', { mcNumber: 'MC-12AB' }, 'An MC number is 1 to 8 digits, optionally after MC-.'],
    ['EIN / Tax ID', { ein: '12-345' }, 'Enter the EIN as 12-3456789.'],
    ['Compliance email', { complianceEmail: 'ops@acme' }, 'Enter a valid email address.'],
    ['State', { state: 'XX' }, 'Select a state from the list.'],
    ['ZIP', { zip: '4321' }, 'Enter a 5-digit ZIP or ZIP+4 (43215-1234).'],
  ])('%s — an invalid value is named under the field and not sent', async (caption, overrides, message) => {
    let patched = false;
    await saveWith(overrides, () => {
      patched = true;
      return ok(CARRIER);
    });
    await waitFor(() => expectFieldError(caption, message));
    expect(patched).toBe(false);
  });

  it('an empty US DOT number and company name each say what is missing', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();
    await user.clear(await screen.findByDisplayValue('Universal Logistics Inc.'));
    await user.clear(screen.getByDisplayValue('1234567'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expectFieldError('Company name', 'Enter the company name.'));
    expectFieldError('US DOT number', 'A USDOT number is 1 to 8 digits.');
  });

  it('shows every invalid field at once', async () => {
    await saveWith({ dotNumber: '12AB', mcNumber: 'MC-X', ein: '1234', complianceEmail: 'nope', state: 'XX', zip: '123' });
    await waitFor(() => expectFieldError('US DOT number', 'A USDOT number is 1 to 8 digits.'));
    expectFieldError('MC number', 'An MC number is 1 to 8 digits, optionally after MC-.');
    expectFieldError('EIN / Tax ID', 'Enter the EIN as 12-3456789.');
    expectFieldError('Compliance email', 'Enter a valid email address.');
    expectFieldError('State', 'Select a state from the list.');
    expectFieldError('ZIP', 'Enter a 5-digit ZIP or ZIP+4 (43215-1234).');
    // Valid fields stay clean.
    expect(within(fieldOf('Main phone')).queryByRole('alert')).toBeNull();
  });

  it('puts a backend 422 (ZodValidationPipe issues) under the mapped fields and lists unmapped ones', async () => {
    await saveWith({}, () =>
      fail(422, 'VALIDATION_FAILED', 'Request validation failed.', {
        issues: [
          { path: 'complianceEmail', code: 'invalid_string', message: 'Invalid email' },
          { path: 'mcNumber', code: 'too_big', message: 'String must contain at most 20 character(s)' },
          { path: 'address.zip', code: 'custom', message: 'ZIP 43004 is not in NY.' },
          { path: 'us_dot_number', code: 'custom', message: 'USDOT 1234567 is inactive at FMCSA.' },
          { path: 'logoUrl', code: 'invalid_type', message: 'Expected string, received null' },
        ],
      }),
    );
    await waitFor(() => expectFieldError('Compliance email', 'Enter a valid email address.'));
    expectFieldError('MC number', 'String must contain at most 20 character(s)');
    expectFieldError('ZIP', 'ZIP 43004 is not in NY.');
    expectFieldError('US DOT number', 'USDOT 1234567 is inactive at FMCSA.');
    // Not a field on this form — shown in the banner, never swallowed.
    expect(screen.getByText('logoUrl: Expected string, received null')).toBeInTheDocument();
    expect(await screen.findByText('Check the highlighted fields and try again.')).toBeInTheDocument();
  });

  it('puts a service-rule 422 that names its field in `details.field` under that field', async () => {
    await saveWith({ eldRegistrationId: null }, () =>
      fail(422, 'TRANSFER_VALIDATION_FAILED', 'erodsMode=PRODUCTION requires a 4-character eldRegistrationId (§395 Appendix A header segment).', {
        field: 'eldRegistrationId',
      }),
    );
    await waitFor(() =>
      expectFieldError(
        'ELD registration ID',
        'erodsMode=PRODUCTION requires a 4-character eldRegistrationId (§395 Appendix A header segment).',
      ),
    );
  });

  it('shows a 4xx that names no field as a form banner', async () => {
    await saveWith({}, () => fail(409, 'CONFLICT', 'The carrier profile was changed by someone else.'));
    expect(await screen.findByText('The carrier profile was changed by someone else.')).toBeInTheDocument();
  });

  it('never sends the null columns of the loaded row (they were a 422 on untouched fields)', async () => {
    let body: Record<string, unknown> | null = null;
    await saveWith({ ein: null, eldRegistrationId: null, logoUrl: null, updatedAt: '2026-09-01T00:00:00Z' }, (sent) => {
      body = sent as Record<string, unknown>;
      return ok(CARRIER);
    });
    await waitFor(() => expect(body).not.toBeNull());
    expect(Object.values(body!)).not.toContain(null);
    expect(body).not.toHaveProperty('logoUrl');
    expect(body).not.toHaveProperty('id');
    expect(body).toMatchObject({ name: 'Universal Logistics Inc. II', dotNumber: '1234567' });
  });
});

/* ------------------------------------------------------------------ State dropdown */

describe('CompanyProfilePage — State dropdown', () => {
  async function openStateMenu(overrides: Record<string, unknown> = {}) {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok({ ...CARRIER, ...overrides })));
    renderPage();
    await screen.findByDisplayValue(CARRIER.name);
    const trigger = screen.getByRole('combobox', { name: /^State/ });
    await user.click(trigger);
    return { user, trigger, listbox: await screen.findByRole('listbox') };
  }

  it('lists every US state (50 + DC) plus the empty choice, in a scrolling menu', async () => {
    const { listbox } = await openStateMenu();
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(52);
    expect(options[0]).toHaveTextContent('—');
    for (const code of ['AL', 'AK', 'CA', 'DC', 'TX', 'WY', 'OH']) {
      expect(within(listbox).getByRole('option', { name: code })).toBeInTheDocument();
    }
    // Ontario is not a US state — it is no longer offered.
    expect(within(listbox).queryByRole('option', { name: 'ON' })).toBeNull();
    expect(within(listbox).getByRole('option', { name: 'OH' })).toHaveAttribute('aria-selected', 'true');
    // The menu scrolls itself instead of growing the page.
    expect(listbox).toHaveClass('max-h-72', 'overflow-y-auto');
  });

  it('selecting a state updates the field and enables Save', async () => {
    const { user, trigger } = await openStateMenu();
    await user.click(screen.getByRole('option', { name: 'TX' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveTextContent('TX');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('supports the keyboard: arrows move, Enter picks, Esc closes', async () => {
    const { user, trigger, listbox } = await openStateMenu();
    expect(listbox).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(trigger).toHaveTextContent('OK'); // OH → next option
    await user.keyboard('{ArrowDown}');
    const reopened = await screen.findByRole('listbox');
    await user.keyboard('w');
    expect(reopened.getAttribute('aria-activedescendant')).toBe(
      within(reopened).getByRole('option', { name: 'WA' }).id,
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveTextContent('OK');
  });

  it('keeps showing a stored state that is not in the list', async () => {
    const { listbox, trigger } = await openStateMenu({ state: 'ZZ' });
    expect(trigger).toHaveTextContent('ZZ');
    expect(within(listbox).getByRole('option', { name: 'ZZ' })).toHaveAttribute('aria-selected', 'true');
  });

  it('an out-of-list state is flagged under the field on save', async () => {
    await saveWith({ state: 'ZZ' });
    await waitFor(() => expectFieldError('State', 'Select a state from the list.'));
  });

  it('clearing the state to the empty choice is allowed (the field is optional)', async () => {
    const { user, trigger } = await openStateMenu();
    await user.click(screen.getByRole('option', { name: '—' }));
    expect(trigger).toHaveTextContent('—');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument());
    expect(within(fieldOf('State')).queryByRole('alert')).toBeNull();
  });
});

/* ------------------------------------------------------------------ Country */

describe('CompanyProfilePage — Country', () => {
  async function pickCountry(user: ReturnType<typeof userEvent.setup>, search: string, name: RegExp) {
    await user.click(screen.getByRole('combobox', { name: /^Country/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search countries' }), search);
    await user.click(screen.getByRole('option', { name }));
  }

  it('opens in the country the stored data implies, with that country’s labels', async () => {
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();
    await screen.findByDisplayValue(CARRIER.name);
    expect(screen.getByRole('combobox', { name: /^Country/ })).toHaveTextContent('United States (+1)');
    expect(fieldOf('State')).toBeInTheDocument();
    expect(fieldOf('ZIP')).toBeInTheDocument();
    expect(fieldOf('EIN / Tax ID')).toBeInTheDocument();
  });

  it('the country list is searchable', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();
    await screen.findByDisplayValue(CARRIER.name);
    await user.click(screen.getByRole('combobox', { name: /^Country/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search countries' }), 'uzbek');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Uzbekistan (+998)');
  });

  it('switching to Uzbekistan swaps labels and rules, keeps what was typed, and flags what no longer fits', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();
    await screen.findByDisplayValue(CARRIER.name);
    await pickCountry(user, 'uzb', /Uzbekistan/);

    expect(screen.getByRole('combobox', { name: /^Country/ })).toHaveTextContent('Uzbekistan (+998)');
    // Labels follow the country.
    expect(fieldOf('Region')).toBeInTheDocument();
    expect(fieldOf('Postal code')).toBeInTheDocument();
    expect(fieldOf('Tax ID / Business ID')).toBeInTheDocument();
    expect(screen.queryByText(/^ZIP/, { selector: 'span.text-label' })).toBeNull();
    // Nothing typed was thrown away…
    expect(screen.getByDisplayValue('43004')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+1 614 555 0104')).toBeInTheDocument();
    // …but what no longer fits says so.
    expectFieldError('Region', 'Select a region from the list.');
    expectFieldError('Postal code', 'Enter a valid postal code, e.g. 100000.');
    expectFieldError('Main phone', 'Please enter a valid phone number for the selected country.');
    // The phone placeholder is an Uzbek number now.
    expect(within(fieldOf('Main phone')).getByRole('textbox')).toHaveAttribute('placeholder', expect.stringMatching(/^\+998 /));
  });

  it('an Uzbek number gets its + by itself, is formatted, validated and saved as E.164 with the country', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    server.use(
      http.patch(url(endpoints.carrier.root), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(CARRIER);
      }),
    );
    renderPage();
    await screen.findByDisplayValue(CARRIER.name);
    await pickCountry(user, 'uzb', /Uzbekistan/);

    const phone = within(fieldOf('Main phone')).getByRole('textbox');
    await user.clear(phone);
    await user.type(phone, '998901234567');
    expect(phone).toHaveValue('+998 90 123 45 67');
    await user.tab();
    expect(phone).toHaveValue('+998 90 123 45 67');
    expect(within(fieldOf('Main phone')).queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('combobox', { name: /^Region/ }));
    await user.click(screen.getByRole('option', { name: 'Toshkent (city)' }));
    const postal = within(fieldOf('Postal code')).getByRole('textbox');
    await user.clear(postal);
    await user.type(postal, '100000');
    const city = screen.getByDisplayValue('Columbus');
    await user.clear(city);
    await user.type(city, 'Toshkent');
    const name = screen.getByDisplayValue(CARRIER.name);
    await user.clear(name);
    await user.type(name, '  O‘zbekiston Logistics ');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      country: 'UZ',
      phone: '+998901234567',
      state: 'TK',
      zip: '100000',
      city: 'Toshkent',
      name: 'O‘zbekiston Logistics',
    });
  });

  it('a UK profile takes a free-text county and a UK postcode', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(url(endpoints.carrier.root), () =>
        ok({ ...CARRIER, phone: '+44 20 7946 0958', state: 'Greater London', zip: 'sw1a1aa', ein: 'SC123456' }),
      ),
    );
    server.use(
      http.patch(url(endpoints.carrier.root), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(CARRIER);
      }),
    );
    renderPage();
    await screen.findByDisplayValue(CARRIER.name);
    expect(screen.getByRole('combobox', { name: /^Country/ })).toHaveTextContent('United Kingdom (+44)');
    expect(within(fieldOf('Region/County')).getByRole('textbox')).toHaveValue('Greater London');

    await user.type(screen.getByDisplayValue(CARRIER.name), ' Ltd');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ country: 'GB', phone: '+442079460958', zip: 'SW1A 1AA', state: 'Greater London', ein: 'SC123456' });
  });

  it('an empty phone is flagged as required on save', async () => {
    await saveWith({ phone: '' });
    await waitFor(() => expectFieldError('Main phone', 'Phone number is required.'));
  });

  it('a field error appears only after the field is left, and clears as soon as the value is valid', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.carrier.root), () => ok(CARRIER)));
    renderPage();
    await screen.findByDisplayValue(CARRIER.name);
    const zip = screen.getByDisplayValue('43004');
    await user.clear(zip);
    await user.type(zip, '432');
    expect(within(fieldOf('ZIP')).queryByRole('alert')).toBeNull();
    await user.tab();
    expectFieldError('ZIP', 'Enter a 5-digit ZIP or ZIP+4 (43215-1234).');
    await user.type(zip, '15');
    expect(within(fieldOf('ZIP')).queryByRole('alert')).toBeNull();
  });
});
