// W-06 bulk bar `Send message` (two or more drivers → `POST /messages/broadcast`): validation,
// the §13.3 "Message sent to …" toast, the error path, the double-submit guard and 11.30 dirty-close.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { BulkMessageModal } from './BulkMessageModal';

function renderModal(props: Partial<React.ComponentProps<typeof BulkMessageModal>> = {}) {
  const onClose = vi.fn();
  const onSent = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BulkMessageModal driverIds={['drv_1', 'drv_2']} onClose={onClose} onSent={onSent} {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose, onSent };
}

const messageBox = () => screen.getByRole('textbox', { name: /Message/ });
const sendButton = () => screen.getByRole('button', { name: 'Send message' });

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

describe('W-06 bulk Send message', () => {
  it('names the recipient count in the subtitle', () => {
    renderModal({ driverIds: ['drv_1', 'drv_2', 'drv_3'] });
    expect(screen.getByText('3 drivers · each one receives it in their own conversation')).toBeInTheDocument();
  });

  it('blocks an empty (or whitespace-only) message with the §14.2 copy and posts nothing', async () => {
    let posts = 0;
    server.use(
      http.post(url(endpoints.conversations.broadcast), () => {
        posts += 1;
        return ok({ sent: 2, deliveries: [] });
      }),
    );
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(sendButton());
    expect(await screen.findByText('Messages are limited to 2,000 characters.')).toBeInTheDocument();
    expect(messageBox()).toHaveAttribute('aria-invalid', 'true');

    await user.type(messageBox(), '   ');
    await user.click(sendButton());
    expect(await screen.findByText('Messages are limited to 2,000 characters.')).toBeInTheDocument();
    expect(posts).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rejects a message over 2,000 characters', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(messageBox());
    await user.paste('x'.repeat(2001));
    await user.click(sendButton());
    expect(await screen.findByText('Messages are limited to 2,000 characters.')).toBeInTheDocument();
  });

  it('sends the body to every selected driver, fires the "Message sent to …" toast and closes', async () => {
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.conversations.broadcast), async ({ request }) => {
        body = await request.json();
        return ok({ sent: 2, deliveries: [] });
      }),
    );
    const user = userEvent.setup();
    const { onClose, onSent } = renderModal();

    await user.type(messageBox(), 'Weigh station on I-70 is open.');
    await user.click(sendButton());

    expect(await screen.findByText('Message sent to 2 drivers')).toBeInTheDocument();
    expect(screen.getByText('It appears in each driver conversation in Messages.')).toBeInTheDocument();
    expect(body).toEqual({ body: 'Weigh station on I-70 is open.', driverIds: ['drv_1', 'drv_2'] });
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the toast counts what the backend actually delivered, not what was selected', async () => {
    server.use(http.post(url(endpoints.conversations.broadcast), () => ok({ sent: 1, deliveries: [] })));
    const user = userEvent.setup();
    renderModal();
    await user.type(messageBox(), 'Hello');
    await user.click(sendButton());
    expect(await screen.findByText('Message sent to 1 driver')).toBeInTheDocument();
  });

  it('shows the §14.3 error toast on failure and keeps the modal open with the draft', async () => {
    server.use(http.post(url(endpoints.conversations.broadcast), () => fail(500, 'INTERNAL_ERROR', 'boom')));
    const user = userEvent.setup();
    const { onClose, onSent } = renderModal();

    await user.type(messageBox(), 'Hello');
    await user.click(sendButton());

    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
    expect(onSent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(messageBox()).toHaveValue('Hello');
    await waitFor(() => expect(sendButton()).toBeEnabled());
  });

  it('a network failure shows the no-connection copy, not a generic fallback', async () => {
    server.use(http.post(url(endpoints.conversations.broadcast), () => HttpResponse.error()));
    const user = userEvent.setup();
    renderModal();
    await user.type(messageBox(), 'Hello');
    await user.click(sendButton());
    expect(await screen.findByText('No connection. Check your network and try again.')).toBeInTheDocument();
  });

  it('a double click on Send message posts exactly once', async () => {
    let posts = 0;
    server.use(
      http.post(url(endpoints.conversations.broadcast), async () => {
        posts += 1;
        await delay(60);
        return ok({ sent: 2, deliveries: [] });
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(messageBox(), 'Hello');
    await user.dblClick(sendButton());

    expect(await screen.findByText('Message sent to 2 drivers')).toBeInTheDocument();
    expect(posts).toBe(1);
  });

  it('closes straight away when nothing was typed', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
  });

  it('11.30 · closing a typed draft asks to discard; Keep editing keeps it, Discard closes', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(messageBox(), 'Half a thought');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(messageBox()).toHaveValue('Half a thought');

    await user.keyboard('{Escape}');
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
