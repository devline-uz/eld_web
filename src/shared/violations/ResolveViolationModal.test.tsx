// WB-165 — the footer `Cancel` called `onClose` directly, so it walked past the 11.30 discard
// confirm that Esc and X honour and dropped a typed compliance reason with no prompt.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { ResolveViolationModal } from './ResolveViolationModal';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

function renderModal(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ResolveViolationModal violationId="vio_1" subtitle="11-hour driving limit" onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onClose;
}

describe('ResolveViolationModal', () => {
  it('Cancel on a typed reason raises the 11.30 discard confirm instead of closing', async () => {
    const user = userEvent.setup();
    const onClose = renderModal();

    await user.type(screen.getByRole('textbox'), 'Dispatcher error, corrected.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('textbox')).toHaveValue('Dispatcher error, corrected.');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('Cancel on an untouched form closes straight away', async () => {
    const user = userEvent.setup();
    const onClose = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Discard changes?')).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('still resolves and closes on success', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.violations.resolve('vio_1')), () => ok({ id: 'vio_1', status: 'RESOLVED' })));
    const onClose = renderModal();

    await user.type(screen.getByRole('textbox'), 'Dispatcher error, corrected.');
    await user.click(screen.getByRole('button', { name: 'Resolve' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });
});
