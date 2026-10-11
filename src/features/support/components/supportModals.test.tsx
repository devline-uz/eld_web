// owner: web-settings-admin — 11.22 New support ticket / W-24 Start chat: a 400/422 lands on the
// field it is about, the rest is spelled out in the modal, and an incomplete form says what is
// missing instead of sitting behind a silently disabled button.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { NewTicketModal } from './NewTicketModal';
import { StartChatModal } from './StartChatModal';

vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: () => true }),
}));

function renderModal(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>,
  );
}

function issues(...list: Array<[string, string]>) {
  return { issues: list.map(([path, message]) => ({ path: [path], code: 'custom', message })) };
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

describe('NewTicketModal', () => {
  it('puts a 422 on `body` under Description and spells out `vehicleId` in the banner', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.support.createTicket), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['body', 'Body is too long'], ['vehicleId', 'Invalid uuid'])),
      ),
    );
    const onClose = vi.fn();
    renderModal(<NewTicketModal contactEmail="support@example.com" onClose={onClose} />);
    await user.type(screen.getByRole('textbox', { name: /subject/i }), 'Tablet will not pair');
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'It keeps failing at the BLE step.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    expect(await screen.findByText('Body is too long')).toBeInTheDocument();
    expect(screen.getByText('Vehicle: Invalid uuid.')).toBeInTheDocument();
    expect(screen.queryByText('Check the highlighted fields and try again.')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('StartChatModal', () => {
  it('says a message is needed instead of sitting disabled', async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.post(url(endpoints.support.chats), () => {
        posts += 1;
        return ok({ id: 'c1' }, 201);
      }),
    );
    renderModal(<StartChatModal onClose={() => {}} />);
    const start = screen.getByRole('button', { name: 'Start chat' });
    expect(start).toBeEnabled();
    await user.click(start);
    expect(await screen.findByText('Enter a message.')).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it('puts a 422 on the message under the field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(endpoints.support.chats), () =>
        fail(422, 'VALIDATION_FAILED', 'Validation failed', issues(['message', 'Message is too long'])),
      ),
    );
    renderModal(<StartChatModal onClose={() => {}} />);
    await user.type(screen.getByRole('textbox'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Start chat' }));
    expect(await screen.findByText('Message is too long')).toBeInTheDocument();
    expect(screen.queryByText('Check the highlighted fields and try again.')).not.toBeInTheDocument();
  });
});
