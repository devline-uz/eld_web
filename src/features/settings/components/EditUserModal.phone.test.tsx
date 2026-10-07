// Edit user — the Phone field sends E.164 (backend CreateUserDto/UpdateUserDto accept only "" or
// E.164), shows stored numbers formatted, and blocks invalid input before any request.
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
import type { UserRow } from '@/shared/api/settingsAdmin';
import { EditUserModal } from './EditUserModal';

vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'me', email: 'me@example.com', roleKey: 'SUPER_ADMIN' } }),
}));

const USER: UserRow = {
  id: 'usr_5',
  email: 'jo@example.com',
  firstName: 'Jo',
  lastName: 'Park',
  status: 'ACTIVE',
  role: { id: 'rol_disp', key: 'DISPATCHER', name: 'Dispatcher' },
};

function renderModal(user: UserRow = USER) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <EditUserModal user={user} roles={[]} mode="profile" activeAdminCount={2} onClose={vi.fn()} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function capture() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.patch(url(endpoints.users.update('usr_5')), async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return ok(USER);
    }),
  );
  return bodies;
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

describe('EditUserModal phone', () => {
  it('typing 998… is grouped and sent as E.164', async () => {
    const user = userEvent.setup();
    const bodies = capture();
    renderModal();
    const phone = screen.getByRole('textbox', { name: /phone/i });
    await user.type(phone, '998901234567');
    expect(phone).toHaveValue('+998 90 123 45 67');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.phone).toBe('+998901234567');
  });

  it('an invalid number shows an error and sends nothing', async () => {
    const user = userEvent.setup();
    const bodies = capture();
    renderModal();
    await user.type(screen.getByRole('textbox', { name: /phone/i }), '99890');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('shows a stored number formatted, and omits phone when left empty', async () => {
    const user = userEvent.setup();
    const bodies = capture();
    renderModal({ ...USER, phone: '+998901234567' });
    const phone = screen.getByRole('textbox', { name: /phone/i });
    expect(phone).toHaveValue('+998 90 123 45 67');
    await user.clear(phone);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect('phone' in bodies[0]!).toBe(false);
  });

  it('maps a 422 issue on `phone` to the field', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(url(endpoints.users.update('usr_5')), () =>
        fail(422, 'VALIDATION_FAILED', 'Invalid', {
          issues: [{ path: ['phone'], code: 'custom', message: 'Server says bad phone.' }],
        }),
      ),
    );
    renderModal();
    await user.type(screen.getByRole('textbox', { name: /phone/i }), '998901234567');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Server says bad phone.')).toBeInTheDocument();
  });
});
