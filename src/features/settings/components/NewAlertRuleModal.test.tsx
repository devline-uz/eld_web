// web/tz.md Q-2 / §11.21 — SMS is permanently disabled and never enters the `channels` array
// posted to the server (E2E scenario 16 asserts the same at the network layer).
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
import { NewAlertRuleModal } from './NewAlertRuleModal';

function renderWithClient(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
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

describe('NewAlertRuleModal — Q-2 SMS', () => {
  it('renders the SMS checkbox permanently disabled', () => {
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );
    const sms = screen.getByRole('checkbox', { name: /sms/i });
    expect(sms).toBeDisabled();
    expect(sms).not.toBeChecked();
  });

  it('never sends SMS in the channels array on submit', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        capturedBody = await request.json();
        return ok({ id: 'alr_9' }, 201);
      }),
    );

    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );

    await user.type(screen.getByPlaceholderText('Break required soon'), 'Test rule');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    const body = capturedBody as { channels: string[] };
    expect(body.channels).not.toContain('SMS');
    expect(body.channels).toEqual(expect.arrayContaining(['IN_APP', 'EMAIL']));
  });

  it('lets every other control be toggled and sends the resulting request body', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        capturedBody = await request.json();
        return ok({ id: 'alr_9' }, 201);
      }),
    );

    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );

    await user.type(screen.getByPlaceholderText('Break required soon'), 'Speeding');
    await user.selectOptions(screen.getByDisplayValue('Warning'), 'CRITICAL');
    await user.click(screen.getByRole('checkbox', { name: 'In-app' })); // now off
    await user.click(screen.getByRole('checkbox', { name: 'Webhook' })); // now on
    await user.selectOptions(screen.getByDisplayValue('Fleet managers'), 'Dispatchers');
    await user.click(screen.getByRole('switch')); // Quiet hours off
    await user.click(screen.getByRole('checkbox', { name: 'Enable the rule immediately' })); // off

    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    const body = capturedBody as {
      severity: string;
      channels: string[];
      recipients: { roles: string[] };
      quietHours?: unknown;
      enabled: boolean;
    };
    expect(body.severity).toBe('CRITICAL');
    expect(body.channels).toEqual(['EMAIL', 'WEBHOOK']);
    expect(body.recipients.roles).toEqual(['Dispatchers']);
    expect(body.quietHours).toBeUndefined();
    expect(body.enabled).toBe(false);
  });

  it('shows an error toast when the create request fails', async () => {
    const user = userEvent.setup();
    server.use(http.post(url(endpoints.alertRules.create), () => fail(500, 'INTERNAL_ERROR', 'Boom')));

    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );

    await user.type(screen.getByPlaceholderText('Break required soon'), 'Speeding');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('closes with Cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={onClose} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
