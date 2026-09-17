// W-26 My profile — four states, profile save, sessions.
// MSW against the real response shapes observed on the dev API (2026-09-13).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, ok, url } from '@/mocks/envelope';
import { server } from '@/mocks/server';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { AuthContextValue } from '@/shared/auth/AuthProvider';
import { ToastProvider } from '@/shared/ui/Toast';
import { buildMockAuthContext } from '../../../tests/fixtures/mockAuth';
import AccountPage from './AccountPage';
import { ACCOUNT_SECTIONS } from './sections';

// This box runs several agents' suites at once (load average ~40): each case passes in 0.1–8 s on
// its own but can take several times that inside the full suite, so the wait budgets are generous.
configure({ asyncUtilTimeout: 20_000 });
vi.setConfig({ testTimeout: 120_000 });

let auth: AuthContextValue;
vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthProviderModule>()),
  useAuth: () => auth,
}));

const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const PROFILE = {
  id: 'usr_fleet_manager',
  email: 'mike.torres@universal-logistics.example',
  googleUid: null,
  authProvider: 'PASSWORD',
  firstName: 'Mike',
  lastName: 'Torres',
  jobTitle: 'Fleet Manager',
  phone: null,
  roleId: 'role_fm',
  status: 'ACTIVE',
  role: { id: 'role_fm', key: 'FLEET_MANAGER', name: 'Fleet Manager' },
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const SESSIONS = [
  {
    id: 'ses_mac',
    userId: 'usr_fleet_manager',
    refreshHash: 'never-render-this-hash',
    userAgent: MAC_CHROME,
    ip: '10.14.2.88',
    deviceLabel: null,
    lastSeenAt: hoursAgo(2),
    expiresAt: '2026-10-13T09:01:52.710Z',
    revokedAt: null,
  },
  {
    id: 'ses_iphone',
    userId: 'usr_fleet_manager',
    refreshHash: 'another-hash',
    userAgent: IPHONE,
    ip: '98.44.21.7',
    deviceLabel: null,
    lastSeenAt: hoursAgo(5),
    expiresAt: '2026-10-13T09:01:52.710Z',
    revokedAt: null,
  },
];

function api({
  profile = PROFILE as Record<string, unknown>,
  sessions = SESSIONS as unknown[],
}: { profile?: Record<string, unknown>; sessions?: unknown[] } = {}) {
  const calls = { profileGets: 0, patches: [] as unknown[], deletes: [] as string[] };
  server.use(
    http.get(url(endpoints.me.profile), () => {
      calls.profileGets += 1;
      return ok(profile);
    }),
    http.get(url(endpoints.me.sessions), () => ok(sessions)),
    http.patch(url(endpoints.me.profile), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.patches.push(body);
      return ok({ ...profile, ...body });
    }),
    http.delete(url(endpoints.me.session(':id')), ({ params }) => {
      calls.deletes.push(String(params.id));
      return ok({ success: true });
    }),
  );
  return calls;
}

function renderPage(route = '/account') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <AccountPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const card = (title: string) => screen.getByRole('region', { name: title });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  auth = buildMockAuthContext('FLEET_MANAGER');
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('W-26 — states', () => {
  it('shows skeletons first, then the three cards with the real profile and no password grid', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'dev');
    api();
    renderPage();
    expect(screen.getAllByText('Loading').length).toBeGreaterThanOrEqual(2);

    expect(await screen.findByLabelText(/First name/)).toHaveValue('Mike');
    expect(screen.getByLabelText(/Last name/)).toHaveValue('Torres');
    expect(screen.getByLabelText('Job title')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Work email')).toBeDisabled();
    expect(screen.getByText('Managed by your administrator')).toBeInTheDocument();
    expect(screen.getByText('Shown to your team and on records you sign')).toBeInTheDocument();
    expect(screen.getByText('PNG or JPG, at least 256 × 256 px. Appears on your signature block.')).toBeInTheDocument();

    // Q-1: no password fields; B-51: no Upload/Remove; no Save until something changes.
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();

    const security = card('Security & sign-in');
    expect(within(security).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(security).getByText('Email and password')).toBeInTheDocument();
    expect(
      within(security).getByText('Development mode — password sign-in is disabled in production.'),
    ).toBeInTheDocument();
    expect(await within(card('Active sessions')).findByText('Mac · Chrome 129')).toBeInTheDocument();
  });

  it('describes Google sign-in outside the dev build', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'production');
    api({ profile: { ...PROFILE, authProvider: 'GOOGLE', googleUid: 'g-1' } });
    renderPage();
    const security = await screen.findByRole('region', { name: 'Security & sign-in' });
    expect(await within(security).findByText('Google account')).toBeInTheDocument();
    expect(within(security).getByText('Connected')).toBeInTheDocument();
    expect(
      within(security).getByText('Your password and account recovery are managed by Google.'),
    ).toBeInTheDocument();
  });

  it('keeps an error inside the failing cards; sessions still load', async () => {
    api();
    server.use(http.get(url(endpoints.me.profile), () => fail(404, 'NOT_FOUND', 'User not found.')));
    renderPage();
    expect(await screen.findByText('Could not load your profile')).toBeInTheDocument();
    expect(screen.getByText('Could not load your security settings')).toBeInTheDocument();
    expect(await within(card('Active sessions')).findByText('iPhone · Safari 17')).toBeInTheDocument();
  });

  it('renders the forbidden state on a plain 403', async () => {
    api();
    server.use(http.get(url(endpoints.me.profile), () => fail(403, 'FORBIDDEN', 'Forbidden.')));
    renderPage();
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });

  it('scrolls to the anchor in the URL hash', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    api();
    renderPage('/account#sessions');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('account-section-sessions'));
  });
});

describe('W-26 — section anchors (11.26 Account menu, Notifications panel)', () => {
  it('renders every anchored section in sub-nav order', async () => {
    api();
    const { container } = renderPage();
    await screen.findByLabelText(/First name/);
    expect([...container.querySelectorAll('section[id]')].map((s) => s.id)).toEqual(
      ACCOUNT_SECTIONS.map((id) => `account-section-${id}`),
    );
  });

  it.each(ACCOUNT_SECTIONS)('focuses #%s when the URL names it', async (id) => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    api();
    renderPage(`/account#${id}`);
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById(`account-section-${id}`)),
    );
    expect(scroll).toHaveBeenCalled();
  });

  it('ignores a hash that names no section', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    api();
    renderPage('/account#nowhere');
    await screen.findByLabelText(/First name/);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('states what Notifications and Language & region really do, with nothing to save (B-11)', async () => {
    api();
    renderPage();
    const notifications = card('Notifications');
    expect(
      within(notifications).getByText('Personal notification settings are not available yet'),
    ).toBeInTheDocument();
    expect(within(notifications).queryByRole('checkbox')).not.toBeInTheDocument();

    const language = card('Language & region');
    expect(within(language).getByLabelText('Language')).toHaveValue('English');
    expect(within(language).getByLabelText('Distance unit')).toHaveValue('Miles');
    expect(within(language).getByLabelText('Date format')).toHaveValue('MMM D, YYYY');
    expect(within(language).getByLabelText('Time zone')).toHaveAttribute('readonly');
    expect(within(language).queryByRole('button')).not.toBeInTheDocument();
    expect(within(language).queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('W-26 — Profile card', () => {
  it('saves first name, last name and phone, then toasts `Settings saved`', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderPage();
    const first = await screen.findByLabelText(/First name/);
    await user.clear(first);
    await user.type(first, 'Michael');
    await user.type(screen.getByLabelText('Mobile number'), '+16145550104');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(calls.patches).toEqual([{ firstName: 'Michael', lastName: 'Torres', phone: '+16145550104' }]);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument(),
    );
  });

  it('validates on blur and never sends an invalid form', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderPage();
    const first = await screen.findByLabelText(/First name/);
    await user.clear(first);
    await user.tab();
    expect(await screen.findByText('This field is required.')).toBeInTheDocument();
    expect(first).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Mobile number'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a valid phone number.')).toBeInTheDocument();
    expect(calls.patches).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText(/First name/)).toHaveValue('Mike');
  });

  it('maps a 422 onto its field and anything else into a banner', async () => {
    const user = userEvent.setup();
    api();
    server.use(
      http.patch(url(endpoints.me.profile), () =>
        fail(422, 'VALIDATION_FAILED', 'Invalid.', { fields: { lastName: 'Last name is too long.' } }),
      ),
    );
    renderPage();
    await user.type(await screen.findByLabelText(/Last name/), 'x');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Last name is too long.')).toBeInTheDocument();

    server.use(http.patch(url(endpoints.me.profile), () => fail(404, 'NOT_FOUND', 'User not found.')));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(errorMessage('NOT_FOUND'))).toBeInTheDocument();
  });
});

describe('W-26 — Active sessions', () => {
  it('lists devices with the drawn columns, never rendering the refresh hash', async () => {
    api();
    const { container } = renderPage();
    const sessions = card('Active sessions');
    expect(await within(sessions).findByText('Mac · Chrome 129')).toBeInTheDocument();
    expect(
      within(sessions)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['DEVICE', 'LOCATION', 'IP ADDRESS', 'LAST ACTIVE', 'Actions']);
    expect(within(sessions).getByText('10.14.2.88')).toHaveClass('tabular');
    expect(within(sessions).getByText('2 h')).toBeInTheDocument();
    expect(within(sessions).getAllByText('—')).toHaveLength(2); // LOCATION — B-50
    // B-50: without a `current` flag every row can be signed out.
    expect(within(sessions).getAllByRole('button', { name: /^Sign out (Mac|iPhone)/ })).toHaveLength(2);
    expect(container.innerHTML).not.toContain('never-render-this-hash');
  });

  it('marks the current session once the backend sends `current`', async () => {
    api({ sessions: [{ ...SESSIONS[0], current: true, location: 'Columbus, OH, US' }, SESSIONS[1]] });
    renderPage();
    const sessions = card('Active sessions');
    expect(await within(sessions).findByText('Now · this device')).toBeInTheDocument();
    expect(within(sessions).getByText('Current')).toBeInTheDocument();
    expect(within(sessions).getByText('Columbus, OH, US')).toBeInTheDocument();
    expect(within(sessions).getAllByRole('button', { name: /^Sign out (Mac|iPhone)/ })).toHaveLength(1);
  });

  it('`Sign out` revokes one session and drops its row', async () => {
    const user = userEvent.setup();
    const calls = api();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Sign out iPhone · Safari 17' }));
    await waitFor(() => expect(screen.queryByText('iPhone · Safari 17')).not.toBeInTheDocument());
    expect(calls.deletes).toEqual(['ses_iphone']);
  });

  it('a failed revoke keeps the row and shows the error', async () => {
    const user = userEvent.setup();
    api();
    server.use(
      http.delete(url(endpoints.me.session(':id')), () => fail(404, 'NOT_FOUND', 'Session not found.')),
    );
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Sign out iPhone · Safari 17' }));
    expect(await screen.findByText(errorMessage('NOT_FOUND'))).toBeInTheDocument();
    expect(screen.getByText('iPhone · Safari 17')).toBeInTheDocument();
  });

  it('`Sign out everywhere` confirms, revokes every session, then signs out here', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();
    auth = buildMockAuthContext('FLEET_MANAGER', { signOut });
    const calls = api();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out everywhere?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(calls.deletes).toEqual(['ses_mac', 'ses_iphone']);
  });

  it('a failed `Sign out everywhere` keeps the session and reports it', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();
    auth = buildMockAuthContext('FLEET_MANAGER', { signOut });
    api();
    server.use(http.delete(url(endpoints.me.session(':id')), () => fail(404, 'NOT_FOUND', 'Gone.')));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out everywhere?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));
    expect(await screen.findByText(errorMessage('NOT_FOUND'))).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('shows the empty state when no session is listed', async () => {
    api({ sessions: [] });
    renderPage();
    expect(await screen.findByText('No active sessions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out everywhere' })).not.toBeInTheDocument();
  });

  it('keeps a sessions error inside its card and retries from it', async () => {
    const user = userEvent.setup();
    api();
    server.use(http.get(url(endpoints.me.sessions), () => fail(404, 'NOT_FOUND', 'Nope.')));
    renderPage();
    expect(await screen.findByText('Could not load your sessions')).toBeInTheDocument();
    expect(await screen.findByLabelText(/First name/)).toHaveValue('Mike');

    server.resetHandlers();
    api();
    await user.click(within(card('Active sessions')).getByRole('button', { name: /retry/i }));
    expect(await within(card('Active sessions')).findByText('Mac · Chrome 129')).toBeInTheDocument();
  });

  it('`Cancel` and Esc close the `Sign out everywhere` confirmation without revoking anything', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();
    auth = buildMockAuthContext('FLEET_MANAGER', { signOut });
    const calls = api();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign out everywhere?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }));
    await screen.findByRole('dialog', { name: 'Sign out everywhere?' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(calls.deletes).toEqual([]);
    expect(signOut).not.toHaveBeenCalled();
  });
});
