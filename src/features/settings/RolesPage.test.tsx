// web/tz.md W-19 — the ADMIN column is never editable and shows the sanctioned disabled chip,
// plus the Roles tab, the Access log tab, cell cycling, search filtering and role deletion.
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
import { NO_PERMISSIONS } from '@/shared/auth/permissions';
import RolesPage from './RolesPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RolesPage />
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
    http.get(url(endpoints.roles.list), () =>
      ok([
        { id: 'rol_admin', key: 'ADMIN', name: 'Admin', isSystem: true, permissions: { ...NO_PERMISSIONS, vehicles: 'FULL' }, userCount: 3 },
        { id: 'rol_fm', key: 'FLEET_MANAGER', name: 'Fleet manager', isSystem: true, permissions: { ...NO_PERMISSIONS, vehicles: 'FULL' }, userCount: 5 },
        { id: 'rol_disp', key: 'DISPATCHER', name: 'Dispatcher', isSystem: true, permissions: { ...NO_PERMISSIONS, vehicles: 'READ' }, userCount: 3 },
        { id: 'rol_view', key: 'VIEWER', name: 'Viewer', isSystem: true, permissions: { ...NO_PERMISSIONS, vehicles: 'READ' }, userCount: 1 },
        {
          id: 'rol_auditor',
          key: 'AUDITOR',
          name: 'Compliance auditor',
          description: 'Read-only access for internal audits.',
          isSystem: false,
          permissions: { ...NO_PERMISSIONS, reports: 'READ' },
          userCount: 0,
        },
      ]),
    ),
    http.get(url(endpoints.carrier.root), () => ok({ id: 'carrier', name: 'Acme', timezone: 'America/New_York', erodsMode: 'TEST' })),
    http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })),
  );
});

describe('RolesPage — W-19 permission matrix', () => {
  it('shows the "Admin cannot be edited" chip and disables the ADMIN column', async () => {
    renderPage();
    expect(await screen.findByText('Admin cannot be edited')).toBeInTheDocument();

    const adminHeader = await screen.findByText('ADMIN');
    expect(adminHeader).toBeInTheDocument();

    // Every button in the ADMIN column carries the disabled attribute.
    const adminButtons = screen.getAllByTitle('Admin cannot be edited');
    expect(adminButtons.length).toBeGreaterThan(0);
    for (const button of adminButtons) {
      expect(button).toBeDisabled();
    }
  });

  it('filters the matrix by search text', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    await user.type(screen.getByPlaceholderText('Search permission…'), 'Carrier settings');
    expect(screen.queryByText('View vehicles / Add & edit vehicles')).not.toBeInTheDocument();
    expect(screen.getByText('Carrier settings')).toBeInTheDocument();
  });

  it('cycles a non-ADMIN cell through NONE → READ → FULL and PATCHes the full permission set', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.patch(url(endpoints.roles.update('rol_disp')), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'rol_disp' });
      }),
    );

    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    // Dispatcher's `vehicles` cell starts at READ; the fixture seeds it that way. Row buttons
    // follow ROLE_COLUMNS order: [ADMIN, FLEET MANAGER, DISPATCHER, VIEWER].
    const row = screen.getByText('View vehicles / Add & edit vehicles').closest('tr')!;
    const rowButtons = within(row).getAllByRole('button');
    await user.click(rowButtons[2]!);

    await waitFor(() => expect(body).not.toBeNull());
    expect((body as { permissions: Record<string, string> }).permissions.vehicles).toBe('FULL');
  });

  it('switches to the Roles tab, shows a system-role chip and deletes a custom role', async () => {
    const user = userEvent.setup();
    let deleted = false;
    server.use(
      http.delete(url(endpoints.roles.remove('rol_auditor')), () => {
        deleted = true;
        return ok({ success: true });
      }),
    );

    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    await user.click(screen.getByRole('button', { name: 'Roles' }));
    expect(await screen.findByText('Compliance auditor')).toBeInTheDocument();
    expect(screen.getAllByText('System role').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete Compliance auditor?')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleted).toBe(true));
    expect(await screen.findByText('Role Compliance auditor deleted')).toBeInTheDocument();
  });

  it('shows the §13.2 empty copy on the Access log tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    await user.click(screen.getByRole('button', { name: 'Access log' }));
    expect(await screen.findByText('No events match these filters')).toBeInTheDocument();
  });

  it('renders populated Access log entries', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.auditLog.list), () =>
        ok({
          items: [
            {
              id: '1',
              createdAt: new Date().toISOString(),
              actorType: 'USER',
              action: 'UPDATE',
              objectType: 'Role',
              objectLabel: 'Role · Dispatcher',
            },
            { id: '2', createdAt: new Date().toISOString(), actorType: 'USER', action: 'CREATE', objectType: 'Role' },
            { id: '3', createdAt: new Date().toISOString(), actorType: 'USER', action: 'DELETE', objectType: 'Role' },
          ],
          nextCursor: null,
        }),
      ),
    );

    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    await user.click(screen.getByRole('button', { name: 'Access log' }));
    expect(await screen.findByText('Role · Dispatcher')).toBeInTheDocument();
  });

  it('shows an in-card error for the Access log tab when the audit fetch fails, and Retry re-fetches', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.auditLog.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    await user.click(screen.getByRole('button', { name: 'Access log' }));
    const retryButton = await screen.findByText('Retry', {}, { timeout: 8000 });

    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })));
    await user.click(retryButton);
    expect(await screen.findByText('No events match these filters')).toBeInTheDocument();
  });

  it('shows an error toast when role deletion fails', async () => {
    const user = userEvent.setup();
    server.use(http.delete(url(endpoints.roles.remove('rol_auditor')), () => fail(500, 'INTERNAL_ERROR', 'Boom')));

    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    await user.click(screen.getByRole('button', { name: 'Roles' }));
    await screen.findByText('Compliance auditor');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('opens and closes the Create role modal from the page header', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Start from a template and adjust the permissions')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows an in-card error for a failed roles fetch', async () => {
    server.use(http.get(url(endpoints.roles.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ stage-2 */

describe('RolesPage — stage-2', () => {
  it('gives the permission search box an accessible name', async () => {
    renderPage();
    expect(await screen.findByRole('searchbox', { name: 'Search permission' })).toBeInTheDocument();
  });

  it('Reset to defaults confirms, then PATCHes the three editable built-in roles only', async () => {
    const user = userEvent.setup();
    const patched: string[] = [];
    server.use(
      http.patch(url(endpoints.roles.update(':id')), async ({ params, request }) => {
        patched.push(String(params.id));
        await request.json();
        return ok({ id: String(params.id) });
      }),
    );
    renderPage();
    await screen.findByRole('searchbox', { name: 'Search permission' });

    await user.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(await screen.findByText('Reset permissions to defaults?')).toBeInTheDocument();
    expect(patched).toEqual([]);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset to defaults' }));
    await waitFor(() => expect(patched.sort()).toEqual(['rol_disp', 'rol_fm', 'rol_view']));
    expect(await screen.findByText('Permissions reset to defaults')).toBeInTheDocument();
  });

  it('a custom role card Edit opens the modal prefilled and PATCHes the role', async () => {
    const user = userEvent.setup();
    let patched: { name?: string } | null = null;
    server.use(
      http.patch(url(endpoints.roles.update('rol_auditor')), async ({ request }) => {
        patched = (await request.json()) as { name?: string };
        return ok({ id: 'rol_auditor' });
      }),
    );
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Roles' }));

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const name = await screen.findByDisplayValue('Compliance auditor');
    await user.clear(name);
    await user.type(name, 'Internal auditor');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patched!.name).toBe('Internal auditor'));
  });

  // WB-233 — the footer used to say "Last changed by Acme · <today>", invented from `new Date()`.
  it('shows no fabricated "Last changed by" footer under the matrix', async () => {
    renderPage();
    await screen.findByText('View vehicles / Add & edit vehicles');
    expect(screen.getByText('Full access')).toBeInTheDocument();
    expect(screen.queryByText(/Last changed by/)).not.toBeInTheDocument();
  });

  // B-95 (shipped) — `dataTransfer` is its own 23rd key; the matrix carries a separate row.
  it('shows separate rows for the pack export and data transfer keys', async () => {
    renderPage();
    expect(await screen.findByText('Export FMCSA / DOT pack')).toBeInTheDocument();
    expect(screen.getByText('Send data transfers to an inspector')).toBeInTheDocument();
  });
});
