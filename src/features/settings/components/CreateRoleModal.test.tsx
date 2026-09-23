// web/tz.md §11.19 — template copy, permission segment toggles, checkboxes, and the request body.
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
import { CreateRoleModal } from './CreateRoleModal';

const TEMPLATES = [
  {
    id: 'rol_fm',
    key: 'FLEET_MANAGER',
    name: 'Fleet manager',
    isSystem: true,
    permissions: { ...NO_PERMISSIONS, vehicles: 'FULL', drivers: 'FULL', carrierSettings: 'READ' },
  },
] as never;

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateRoleModal templates={TEMPLATES} onClose={() => {}} />
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
});

describe('CreateRoleModal — 11.19', () => {
  it('copies permission levels from a template', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.selectOptions(screen.getByDisplayValue('— Start from scratch —'), 'rol_fm');
    // Vehicles is FULL on the template — its segment control shows Full selected.
    const vehiclesRow = screen.getByText('Vehicles').closest('div')!;
    expect(within(vehiclesRow).getByRole('button', { name: 'Full' })).toHaveClass('bg-bg-inverse');
  });

  it('creates a role with the segment levels and checkboxes as `reportsTransfer`', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.roles.create), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'rol_9' }, 201);
      }),
    );

    renderModal();
    await user.type(screen.getByPlaceholderText('Compliance auditor'), 'Compliance auditor');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    await waitFor(() => expect(body).not.toBeNull());
    const payload = body as { key: string; name: string; permissions: Record<string, string> };
    expect(payload.name).toBe('Compliance auditor');
    expect(payload.permissions.reports).toBe('FULL'); // default segment level, checkbox on
    expect(payload.permissions.users).toBe('NONE');
    expect(await screen.findByText('Role created')).toBeInTheDocument();
  });

  // WB-234 — one checkbox for the one `reportsTransfer` key; there is no separate transfers checkbox.
  it('shows a single FMCSA export / data transfers checkbox that drives reportsTransfer', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.roles.create), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'rol_11' }, 201);
      }),
    );

    renderModal();
    expect(screen.queryByRole('checkbox', { name: 'Can send data transfers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Can export FMCSA / DOT pack' })).not.toBeInTheDocument();
    const merged = screen.getByRole('checkbox', { name: 'Can export FMCSA / DOT pack and send data transfers' });
    expect(merged).toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);

    await user.click(merged);
    await user.type(screen.getByPlaceholderText('Compliance auditor'), 'No transfers');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect((body as { permissions: Record<string, string> }).permissions.reportsTransfer).toBe('NONE');
  });

  it('submits with the template as the permission base when one is selected', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.roles.create), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'rol_10' }, 201);
      }),
    );

    renderModal();
    await user.selectOptions(screen.getByDisplayValue('— Start from scratch —'), 'rol_fm');
    await user.type(screen.getByPlaceholderText('Compliance auditor'), 'FM copy');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    await waitFor(() => expect(body).not.toBeNull());
    const payload = body as { permissions: Record<string, string> };
    // `vehicles`/`drivers` are overwritten by the segment control, but a template key the
    // segments don't touch (e.g. `carrierSettings`) must come from the template, not NO_PERMISSIONS.
    expect(payload.permissions.carrierSettings).toBe('READ');
  });

  it('maps a 409 conflict onto the role name field', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.roles.create), () => fail(409, 'CONFLICT', 'A role with this name already exists.')));

    renderModal();
    await user.type(screen.getByPlaceholderText('Compliance auditor'), 'Dispatcher');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByText('A role with this name already exists.')).toBeInTheDocument();
  });
});

describe('CreateRoleModal — double submit and dirty close', () => {
  it('creates exactly one role on a double click', async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.post(url(endpoints.roles.create), async ({ request }) => {
        posts.push(await request.json());
        await gate;
        return ok({ id: 'rol_9' }, 201);
      }),
    );

    renderModal();
    await user.type(screen.getByPlaceholderText('Compliance auditor'), 'Compliance auditor');
    const submit = screen.getByRole('button', { name: 'Create role' });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts).toHaveLength(1);
    release();
  });

  it('closes an untouched form silently but confirms after a permission change', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CreateRoleModal templates={TEMPLATES} onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    unmount();

    onClose.mockClear();
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CreateRoleModal templates={TEMPLATES} onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    // A permission segment lives outside react-hook-form — it still has to count as an edit.
    const driversRow = screen.getByText('Drivers').closest('div')!;
    await user.click(within(driversRow).getByRole('button', { name: 'Full' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
