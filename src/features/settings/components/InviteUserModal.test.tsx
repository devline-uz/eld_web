// web/tz.md §11.18 — role selection, the 409 conflict message, and the exact invite request body.
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
import { InviteUserModal } from './InviteUserModal';

const ROLES = [
  { id: 'rol_admin', key: 'ADMIN', name: 'Admin', isSystem: true, permissions: {}, userCount: 3 },
  { id: 'rol_fm', key: 'FLEET_MANAGER', name: 'Fleet manager', isSystem: true, permissions: {}, userCount: 5 },
  { id: 'rol_disp', key: 'DISPATCHER', name: 'Dispatcher', isSystem: true, permissions: {}, userCount: 3 },
  { id: 'rol_view', key: 'VIEWER', name: 'Viewer', isSystem: true, permissions: {}, userCount: 1 },
] as never;

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <InviteUserModal roles={ROLES} onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    ),
  };
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

describe('InviteUserModal — 11.18', () => {
  it('defaults to Dispatcher selected and Fleet manager selectable', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.getByText('Dispatcher').closest('button')).toHaveClass('border-primary');

    await user.click(screen.getByText('Fleet manager'));
    expect(screen.getByText('Fleet manager').closest('button')).toHaveClass('border-primary');
  });

  it('sends the invite with the selected role id and shows the sent toast', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.users.create), async ({ request }) => {
        body = await request.json();
        return ok({ user: { id: 'usr_9', status: 'INVITED' }, inviteToken: 'tok' }, 201);
      }),
    );

    renderModal();
    await user.click(screen.getByText('Fleet manager'));
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(screen.getByPlaceholderText('anna.weiss@example.com'), 'anna.weiss@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ email: 'anna.weiss@example.com', firstName: 'Anna', lastName: 'Weiss', roleId: 'rol_fm' });
    expect(await screen.findByText('Invitation sent')).toBeInTheDocument();
  });

  it('maps a 409 conflict onto the email field', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.users.create), () => fail(409, 'CONFLICT', 'A user with this email already exists.')));

    renderModal();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(screen.getByPlaceholderText('anna.weiss@example.com'), 'anna.weiss@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument();
  });

  it('maps a 422 field error onto the matching input', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.users.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', { fields: { email: 'Enter a valid email address.' } }),
      ),
    );

    renderModal();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(screen.getByPlaceholderText('anna.weiss@example.com'), 'anna.weiss@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('shows a generic error toast for a non-conflict failure', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.users.create), () => fail(500, 'INTERNAL_ERROR', 'Boom')));

    renderModal();
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna Weiss');
    await user.type(screen.getByPlaceholderText('anna.weiss@example.com'), 'anna.weiss@example.com');
    await user.selectOptions(screen.getByDisplayValue('All terminals'), 'Barrie, ON');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('closes through the discard-changes confirmation once the form is dirty', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.type(screen.getByPlaceholderText('Anna Weiss'), 'Anna');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });
});
