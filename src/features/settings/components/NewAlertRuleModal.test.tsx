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

describe('NewAlertRuleModal — double submit', () => {
  it('creates exactly one rule on a double click', async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        posts.push(await request.json());
        await gate;
        return ok({ id: 'alr_9' }, 201);
      }),
    );

    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Test rule');
    const submit = screen.getByRole('button', { name: 'Create rule' });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts).toHaveLength(1);
    release();
  });
});

/* ------------------------------------------- stage-2: real conditions, Repeat and edit mode */

const RULE = {
  id: 'alr_7',
  key: 'geofence_exit',
  name: 'Geofence exit',
  severity: 'INFO' as const,
  conditions: [{ event: 'geofence.exit' }],
  channels: ['IN_APP' as const, 'WEBHOOK' as const],
  recipients: { roles: ['Dispatchers'] },
  enabled: false,
};

describe('NewAlertRuleModal — conditions, Repeat and edit mode', () => {
  it('+ Add a condition adds a row and every condition reaches the payload', async () => {
    const user = userEvent.setup();
    let body: { conditions?: unknown[] } | null = null;
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        body = (await request.json()) as { conditions?: unknown[] };
        return ok({ id: 'alr_9' }, 201);
      }),
    );
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );

    await user.type(screen.getByPlaceholderText('Break required soon'), 'Two conditions');
    await user.click(screen.getByRole('button', { name: '+ Add a condition' }));
    expect(screen.getAllByRole('combobox', { name: /condition .* event/i })).toHaveLength(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Condition 2 event' }), 'maintenance.overdue');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await waitFor(() =>
      expect(body!.conditions).toEqual([{ event: 'hos.break_due', params: { minutes: 30 } }, { event: 'maintenance.overdue' }]),
    );
  });

  it('a condition row can be removed, and the last one cannot', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Remove condition 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '+ Add a condition' }));
    await user.click(screen.getByRole('button', { name: 'Remove condition 2' }));
    expect(screen.queryByRole('button', { name: 'Remove condition 2' })).not.toBeInTheDocument();
  });

  it('Repeat is controlled and reaches the throttle field', async () => {
    const user = userEvent.setup();
    let body: { throttle?: unknown } | null = null;
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        body = (await request.json()) as { throttle?: unknown };
        return ok({ id: 'alr_9' }, 201);
      }),
    );
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Throttled');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Repeat' }), 'once-per-hour');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(body!.throttle).toEqual({ cooldownMin: 60 }));
  });

  it('edit mode seeds from the rule and PATCHes it', async () => {
    const user = userEvent.setup();
    let patched: { name?: string; conditions?: unknown } | null = null;
    server.use(
      http.patch(url(endpoints.alertRules.update('alr_7')), async ({ request }) => {
        patched = (await request.json()) as { name?: string };
        return ok(RULE);
      }),
    );
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal rule={RULE} mode="edit" onClose={() => {}} />
      </ToastProvider>,
    );
    expect(screen.getByDisplayValue('Geofence exit')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Condition event' })).toHaveValue('geofence.exit');

    await user.clear(screen.getByDisplayValue('Geofence exit'));
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Geofence exit v2');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patched!.name).toBe('Geofence exit v2'));
    expect(patched!.conditions).toEqual([{ event: 'geofence.exit' }]);
  });

  it('duplicate mode seeds a copy and POSTs a new rule', async () => {
    const user = userEvent.setup();
    let body: { name?: string } | null = null;
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        body = (await request.json()) as { name?: string };
        return ok({ id: 'alr_9' }, 201);
      }),
    );
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal rule={RULE} mode="duplicate" onClose={() => {}} />
      </ToastProvider>,
    );
    expect(screen.getByDisplayValue('Geofence exit (copy)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create copy' }));

    await waitFor(() => expect(body!.name).toBe('Geofence exit (copy)'));
  });
});

/* ------------------------------------------- stage-2: payload honesty and validation */

describe('NewAlertRuleModal — payload honesty', () => {
  it('an edit never re-keys the rule and keeps its own quiet-hours window', async () => {
    const user = userEvent.setup();
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.patch(url(endpoints.alertRules.update('alr_7')), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return ok(RULE);
      }),
    );
    const quietHours = { from: '20:00', to: '05:00', timezone: 'America/Chicago' };
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal rule={{ ...RULE, quietHours }} mode="edit" onClose={() => {}} />
      </ToastProvider>,
    );
    await user.clear(screen.getByDisplayValue('Geofence exit'));
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Renamed rule');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patched).not.toBeNull());
    expect(patched).not.toHaveProperty('key');
    expect(patched!.quietHours).toEqual(quietHours);
  });

  it('refuses a rule with no delivery channel and sends nothing', async () => {
    const user = userEvent.setup();
    let sent = false;
    server.use(
      http.post(url(endpoints.alertRules.create), () => {
        sent = true;
        return ok({ id: 'alr_9' }, 201);
      }),
    );
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Silent rule');
    await user.click(screen.getByRole('checkbox', { name: 'In-app' }));
    await user.click(screen.getByRole('checkbox', { name: 'Email' }));
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    expect(await screen.findByText('Choose at least one delivery channel.')).toBeInTheDocument();
    expect(sent).toBe(false);
  });

  it('refuses a zero-minute threshold and sends nothing', async () => {
    const user = userEvent.setup();
    let sent = false;
    server.use(
      http.post(url(endpoints.alertRules.create), () => {
        sent = true;
        return ok({ id: 'alr_9' }, 201);
      }),
    );
    renderWithClient(
      <ToastProvider>
        <NewAlertRuleModal onClose={() => {}} />
      </ToastProvider>,
    );
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Zero minutes');
    await user.clear(screen.getByRole('textbox', { name: 'Condition 1 minutes' }));
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    expect(await screen.findByText(/greater than 0/)).toBeInTheDocument();
    expect(sent).toBe(false);
  });
});
