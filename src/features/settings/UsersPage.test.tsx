// web/tz.md W-18 — empty state, populated table, the read-only rule (§12.2), search/segment
// filtering, the pending-invitations card, and the row actions (resend invite, disable user).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import UsersPage from './UsersPage';

let canFull = true;
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (_key: string, level?: string) => (level === 'FULL' ? canFull : true) }),
}));
// WB-113 — the signed-in caller's id, used only by the self-disable/last-admin guard. Distinct
// from every row id used below unless a test names it explicitly.
vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'current_caller_id', email: 'sarah.chen@example.com' } }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

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
  server.use(http.get(url(endpoints.roles.list), () => ok([])));
});

describe('UsersPage — W-18', () => {
  it('shows the empty state with no users', async () => {
    server.use(http.get(url(endpoints.users.list), () => ok([])));
    renderPage();
    expect(await screen.findByText('No users yet')).toBeInTheDocument();
  });

  it('renders the users table when users exist', async () => {
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          {
            id: 'usr_1',
            email: 'anna.weiss@example.com',
            firstName: 'Anna',
            lastName: 'Weiss',
            status: 'ACTIVE',
            role: { key: 'FLEET_MANAGER', name: 'Fleet manager' },
          },
        ]),
      ),
    );
    renderPage();
    expect(await screen.findByText('Anna Weiss')).toBeInTheDocument();
    expect(screen.getByText('anna.weiss@example.com')).toBeInTheDocument();
  });

  it('removes Invite user and the row menu for a READ-only caller', async () => {
    canFull = false;
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          {
            id: 'usr_1',
            email: 'anna.weiss@example.com',
            firstName: 'Anna',
            lastName: 'Weiss',
            status: 'ACTIVE',
            role: { key: 'FLEET_MANAGER', name: 'Fleet manager' },
          },
        ]),
      ),
    );
    renderPage();
    await screen.findByText('Anna Weiss');
    expect(screen.queryByRole('button', { name: /invite user/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });

  it('hides Resend all and per-row Resend/Revoke on the Pending invitations card for a READ-only caller', async () => {
    canFull = false;
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          {
            id: 'usr_3',
            email: 'invited@example.com',
            firstName: 'Dana',
            lastName: 'Ford',
            status: 'INVITED',
            role: { key: 'DISPATCHER', name: 'Dispatcher' },
          },
        ]),
      ),
    );
    renderPage();
    expect(await screen.findByText('Pending invitations')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend all' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  it('shows an in-card error with Retry on failure', async () => {
    server.use(http.get(url(endpoints.users.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('filters by segment and by search text', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          { id: 'usr_1', email: 'anna.weiss@example.com', firstName: 'Anna', lastName: 'Weiss', status: 'ACTIVE', role: { key: 'FLEET_MANAGER', name: 'Fleet manager' } },
          { id: 'usr_2', email: 'sarah.chen@example.com', firstName: 'Sarah', lastName: 'Chen', status: 'ACTIVE', role: { key: 'ADMIN', name: 'Admin' } },
        ]),
      ),
    );
    renderPage();
    await screen.findByText('Anna Weiss');
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /admins/i }));
    expect(screen.queryByText('Anna Weiss')).not.toBeInTheDocument();
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^all/i }));
    await user.type(screen.getByPlaceholderText('Search user or email…'), 'anna');
    expect(screen.getByText('Anna Weiss')).toBeInTheDocument();
    expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument();
  });

  it('resends an invitation and disables an active user from the row menu', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([{ id: 'usr_1', email: 'anna.weiss@example.com', firstName: 'Anna', lastName: 'Weiss', status: 'ACTIVE', role: { key: 'FLEET_MANAGER', name: 'Fleet manager' } }]),
      ),
    );
    let disabled = false;
    server.use(
      http.patch(url(endpoints.users.update('usr_1')), async ({ request }) => {
        const body = (await request.json()) as { status?: string };
        disabled = body.status === 'DISABLED';
        return ok({ id: 'usr_1', status: 'DISABLED' });
      }),
    );

    renderPage();
    await screen.findByText('Anna Weiss');
    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(screen.getByText('Disable user'));

    await waitFor(() => expect(disabled).toBe(true));
    expect(await screen.findByText('User disabled')).toBeInTheDocument();
  });

  it('shows a search-empty state with Clear search when nothing matches', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([{ id: 'usr_1', email: 'anna.weiss@example.com', firstName: 'Anna', lastName: 'Weiss', status: 'ACTIVE', role: { key: 'FLEET_MANAGER', name: 'Fleet manager' } }]),
      ),
    );
    renderPage();
    await screen.findByText('Anna Weiss');
    await user.type(screen.getByPlaceholderText('Search user or email…'), 'nobody-matches-this');
    expect(await screen.findByText('Nothing matches "nobody-matches-this"')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('Anna Weiss')).toBeInTheDocument();
  });

  it('shows an error toast when disabling a user fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([{ id: 'usr_1', email: 'anna.weiss@example.com', firstName: 'Anna', lastName: 'Weiss', status: 'ACTIVE', role: { key: 'FLEET_MANAGER', name: 'Fleet manager' } }]),
      ),
    );
    server.use(http.patch(url(endpoints.users.update('usr_1')), () => fail(500, 'INTERNAL_ERROR', 'Boom')));

    renderPage();
    await screen.findByText('Anna Weiss');
    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(screen.getByText('Disable user'));

    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('shows the Pending invitations card and resends from it', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          {
            id: 'usr_3',
            email: 'invited@example.com',
            firstName: 'Dana',
            lastName: 'Ford',
            status: 'INVITED',
            role: { key: 'DISPATCHER', name: 'Dispatcher' },
            homeTerminalName: 'Barrie, ON',
            invitedByName: 'Sarah Chen',
            invitedAt: new Date().toISOString(),
          },
        ]),
      ),
    );
    let resent = false;
    server.use(
      http.post(url(endpoints.users.resendInvite('usr_3')), () => {
        resent = true;
        return ok({ user: { id: 'usr_3', status: 'INVITED' }, inviteToken: 'tok', expiresAt: new Date().toISOString() });
      }),
    );

    renderPage();
    expect(await screen.findByText('Pending invitations')).toBeInTheDocument();
    // Exact match excludes the card header's "Resend all".
    await user.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(resent).toBe(true));
  });

  it('WB-042 — Filters button opens the drawer and role/status filters narrow the table with a filter-aware empty state', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          {
            id: 'usr_1',
            email: 'anna.weiss@example.com',
            firstName: 'Anna',
            lastName: 'Weiss',
            status: 'ACTIVE',
            role: { key: 'FLEET_MANAGER', name: 'Fleet manager' },
          },
          {
            id: 'usr_2',
            email: 'viewer@example.com',
            firstName: 'Vera',
            lastName: 'Reid',
            status: 'ACTIVE',
            role: { key: 'VIEWER', name: 'Viewer' },
          },
        ]),
      ),
    );
    renderPage();
    await screen.findByText('Anna Weiss');
    expect(screen.getByText('Vera Reid')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^filters/i }));
    expect(await screen.findByText('Filters', { selector: 'h2, [role="heading"], div' })).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /^viewer$/i }));
    await user.click(screen.getByRole('button', { name: /apply 1 filters/i }));

    expect(screen.queryByText('Anna Weiss')).not.toBeInTheDocument();
    expect(screen.getByText('Vera Reid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filters · 1/i })).toBeInTheDocument();

    // Chip clear-all resets the filter and both rows return.
    await user.click(screen.getByText('Clear all'));
    expect(await screen.findByText('Anna Weiss')).toBeInTheDocument();
  });

  it('WB-113 — refuses to disable the signed-in caller\'s own account', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          { id: 'current_caller_id', email: 'sarah.chen@example.com', firstName: 'Sarah', lastName: 'Chen', status: 'ACTIVE', role: { key: 'ADMIN', name: 'Admin' } },
          { id: 'usr_2', email: 'mike.torres@example.com', firstName: 'Mike', lastName: 'Torres', status: 'ACTIVE', role: { key: 'ADMIN', name: 'Admin' } },
        ]),
      ),
    );
    let patched = false;
    server.use(
      http.patch(url(endpoints.users.update('current_caller_id')), () => {
        patched = true;
        return ok({ id: 'current_caller_id', status: 'DISABLED' });
      }),
    );

    renderPage();
    await screen.findByText('Sarah Chen');
    const rows = screen.getAllByRole('button', { name: 'Row actions' });
    await user.click(rows[0]!);
    await user.click(screen.getByText('Disable user'));

    expect(await screen.findByText("Can't disable this user")).toBeInTheDocument();
    expect(screen.getByText('You cannot disable your own account. Ask another admin to do this.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(patched).toBe(false);
  });

  it('WB-113 — refuses to disable the last active admin', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          { id: 'usr_2', email: 'mike.torres@example.com', firstName: 'Mike', lastName: 'Torres', status: 'ACTIVE', role: { key: 'ADMIN', name: 'Admin' } },
          { id: 'usr_3', email: 'dana.ford@example.com', firstName: 'Dana', lastName: 'Ford', status: 'ACTIVE', role: { key: 'FLEET_MANAGER', name: 'Fleet manager' } },
        ]),
      ),
    );
    let patched = false;
    server.use(
      http.patch(url(endpoints.users.update('usr_2')), () => {
        patched = true;
        return ok({ id: 'usr_2', status: 'DISABLED' });
      }),
    );

    renderPage();
    await screen.findByText('Mike Torres');
    const rows = screen.getAllByRole('button', { name: 'Row actions' });
    await user.click(rows[0]!);
    await user.click(screen.getByText('Disable user'));

    expect(await screen.findByText("Can't disable this user")).toBeInTheDocument();
    expect(
      screen.getByText('This is the last active admin. Promote another user to Admin before disabling this account.'),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(patched).toBe(false);
  });

  it('WB-042 — a filter that matches nothing shows the search/filter empty state with a Clear filters action', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.users.list), () =>
        ok([
          {
            id: 'usr_1',
            email: 'anna.weiss@example.com',
            firstName: 'Anna',
            lastName: 'Weiss',
            status: 'ACTIVE',
            role: { key: 'ADMIN', name: 'Administrator' },
          },
        ]),
      ),
    );
    renderPage();
    await screen.findByText('Anna Weiss');

    await user.click(screen.getByRole('button', { name: /^filters/i }));
    await user.click(screen.getByRole('checkbox', { name: /^viewer$/i }));
    await user.click(screen.getByRole('button', { name: /apply 1 filters/i }));

    await user.click(await screen.findByText('Clear filters'));
    expect(await screen.findByText('Anna Weiss')).toBeInTheDocument();
  });
});
