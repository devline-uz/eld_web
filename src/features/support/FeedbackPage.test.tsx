// web/tz.md W-25 — feedback submission, its success state, and the inline 403 (support:FULL gap).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import FeedbackPage from './FeedbackPage';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FeedbackPage />
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

describe('FeedbackPage — W-25', () => {
  it('submits feedback and shows the thank-you success state with Send another', async () => {
    const user = userEvent.setup();
    let submitted: unknown = null;
    server.use(
      http.post(url(endpoints.support.feedback), async ({ request }) => {
        submitted = await request.json();
        return ok({ id: 'fbk_1' }, 201);
      }),
    );

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Very easy' }));
    await user.click(screen.getByRole('button', { name: 'Very satisfied' }));
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    await waitFor(() => expect(submitted).not.toBeNull());
    expect(await screen.findByText('Thank you — your feedback was sent.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send another' }));
    expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeInTheDocument();
  });

  it('shows the forbidden banner inline on a 403 rather than replacing the page', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.support.feedback), () => fail(403, 'FORBIDDEN', 'You do not have access to this.')));

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to this.');
    expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeInTheDocument();
  });

  it('switches to the driver feedback and feature request tabs', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /driver feedback/i }));
    expect(screen.getByText('John Smith')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /feature requests/i }));
    expect(screen.getByText(/collected in the mobile app/i)).toBeInTheDocument();
  });
});
