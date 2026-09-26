// web/tz.md W-22 — connected/available catalogue states, connect/disconnect/revoke mutations, and
// the "shown once" API key secret.
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
import IntegrationsPage from './IntegrationsPage';

let canFull = true;
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => canFull }) }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <IntegrationsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  canFull = true;
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(
    http.get(url(endpoints.integrations.list), () =>
      ok([{ id: 'int_1', provider: 'mcleod', enabled: true, status: 'CONNECTED', lastSyncAt: new Date().toISOString() }]),
    ),
  );
});

describe('IntegrationsPage — W-22', () => {
  it('shows an in-card error for the catalogue when the integrations list fails', async () => {
    server.resetHandlers();
    server.use(http.get(url(endpoints.integrations.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    server.use(http.get(url(endpoints.apiKeys.list), () => ok([])));
    renderPage();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('hides Connect and the API-keys row menu for a READ-only caller', async () => {
    canFull = false;
    server.use(
      http.get(url(endpoints.apiKeys.list), () =>
        ok([{ id: 'key_1', name: 'McLeod TMS', prefix: 'obk_ABCD', scopes: ['reports:read'], lastUsedAt: null, expiresAt: null, revokedAt: null }]),
      ),
    );
    renderPage();
    await screen.findByText('McLeod TMS');
    expect(screen.queryByRole('button', { name: /^connect$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create key/i })).not.toBeInTheDocument();
  });

  it('shows an in-card error for the API keys card on failure', async () => {
    server.use(http.get(url(endpoints.apiKeys.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('shows the empty state for API keys, then Connected for McLeod', async () => {
    server.use(http.get(url(endpoints.apiKeys.list), () => ok([])));
    renderPage();
    expect(await screen.findByText('No API keys yet')).toBeInTheDocument();
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  // WB-232 — the status lines come from the API record only; no invented figures.
  it('derives each card status line from the integration record, with no hardcoded figures', async () => {
    server.use(
      http.get(url(endpoints.integrations.list), () =>
        ok([
          { id: 'int_1', provider: 'mcleod', enabled: true, status: 'CONNECTED', lastSyncAt: new Date(Date.now() - 4 * 60_000).toISOString() },
          { id: 'int_2', provider: 'slack', enabled: true, status: 'CONNECTED', lastSyncAt: null },
        ]),
      ),
      http.get(url(endpoints.apiKeys.list), () => ok([])),
    );
    renderPage();
    expect(await screen.findByText('Last sync · 4 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('Connected · no sync yet')).toBeInTheDocument();
    // wex, quickbooks, webhook, Pacific Track, DAT, Geotab, Zapier have no record (backend D-107
    // made the last four connectable).
    expect(screen.getAllByText('Not connected')).toHaveLength(7);
    expect(screen.queryByText(/has no connector yet/)).not.toBeInTheDocument();
    for (const fake of [/devices syncing/, /receipts this quarter/, /Last export/, /Last sync 4 minutes ago/]) {
      expect(screen.queryByText(fake)).not.toBeInTheDocument();
    }
  });

  it('creates an API key and shows the plaintext secret exactly once', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.apiKeys.list), () => ok([])));
    server.use(
      http.post(url(endpoints.apiKeys.create), () =>
        ok({ apiKey: { id: 'key_1', prefix: 'obk_ABCD' }, plaintextKey: 'obk_live_full_secret_value' }, 201),
      ),
    );

    renderPage();
    await user.click(await screen.findByRole('button', { name: /create key/i }));
    await user.type(screen.getByPlaceholderText('McLeod TMS'), 'My integration key');
    // Toggle a second scope on, then back off, to exercise both branches of the scope checkbox.
    const vehiclesScope = screen.getByRole('checkbox', { name: 'vehicles:read' });
    await user.click(vehiclesScope);
    await user.click(vehiclesScope);
    await user.click(screen.getByRole('button', { name: 'Create key' }));

    expect(await screen.findByText('obk_live_full_secret_value')).toBeInTheDocument();
    expect(screen.getByText('Copy this key now — it will not be shown again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
  });

  it('connects an available provider (Slack)', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.apiKeys.list), () => ok([])));
    let enabled: unknown = null;
    server.use(
      http.put(url(endpoints.integrations.update('slack')), async ({ request }) => {
        enabled = (await request.json()) as { enabled: boolean };
        return ok({ id: 'int_2', provider: 'slack', enabled: true, status: 'CONNECTED' });
      }),
    );

    renderPage();
    await screen.findByText('McLeod PowerBroker');
    const slackCard = screen.getByText('Slack').closest('div.rounded-lg')!;
    await userEventClickWithin(slackCard, /connect/i, user);

    await waitFor(() => expect(enabled).toMatchObject({ enabled: true }));
  });

  it('disconnects a connected provider (McLeod)', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.apiKeys.list), () => ok([])));
    let disconnected = false;
    server.use(
      http.delete(url(endpoints.integrations.remove('mcleod')), () => {
        disconnected = true;
        return ok({ id: 'int_1', provider: 'mcleod', enabled: false, status: 'DISCONNECTED' });
      }),
    );

    renderPage();
    const mcleodCard = (await screen.findByText('McLeod PowerBroker')).closest('div.rounded-lg')!;
    await userEventClickWithin(mcleodCard, /disconnect/i, user);

    // WB — `Manage` used to disconnect on the first click; it now says `Disconnect` and confirms.
    expect(await screen.findByText('Disconnect McLeod PowerBroker?')).toBeInTheDocument();
    expect(disconnected).toBe(false);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(disconnected).toBe(true));
  });

  it('revokes an API key from the row menu', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.apiKeys.list), () =>
        ok([{ id: 'key_1', name: 'McLeod TMS', prefix: 'obk_ABCD', scopes: ['reports:read'], lastUsedAt: null, expiresAt: null, revokedAt: null }]),
      ),
    );
    let revoked = false;
    server.use(
      http.delete(url(endpoints.apiKeys.remove('key_1')), () => {
        revoked = true;
        return ok({ success: true });
      }),
    );

    renderPage();
    await screen.findByText('McLeod TMS');
    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(screen.getByText('Revoke'));

    // Irreversible — the row menu only opens a confirm; nothing is sent until it is accepted.
    expect(await screen.findByText('Revoke McLeod TMS?')).toBeInTheDocument();
    expect(revoked).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Revoke key' }));

    await waitFor(() => expect(revoked).toBe(true));
    expect(await screen.findByText('API key McLeod TMS revoked')).toBeInTheDocument();
  });

  it('cancelling the revoke confirm sends nothing', async () => {
    const user = userEvent.setup();
    let revoked = false;
    server.use(
      http.get(url(endpoints.apiKeys.list), () =>
        ok([{ id: 'key_1', name: 'McLeod TMS', prefix: 'obk_ABCD', scopes: ['reports:read'], lastUsedAt: null, expiresAt: null, revokedAt: null }]),
      ),
      http.delete(url(endpoints.apiKeys.remove('key_1')), () => {
        revoked = true;
        return ok({ success: true });
      }),
    );
    renderPage();
    await screen.findByText('McLeod TMS');
    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(screen.getByText('Revoke'));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Revoke McLeod TMS?')).not.toBeInTheDocument());
    expect(revoked).toBe(false);
  });
});

/** Scopes a button click to one catalogue card without over-fetching by exact label text. */
async function userEventClickWithin(container: Element, name: RegExp, user: ReturnType<typeof userEvent.setup>) {
  const button = Array.from(container.querySelectorAll('button')).find((b) => name.test(b.textContent ?? ''));
  if (!button) throw new Error(`No button matching ${name} inside the card`);
  await user.click(button);
}

/* ------------------------------------------------------------------ stage-2 */

describe('IntegrationsPage — stage-2', () => {
  // Backend D-107 — Pacific Track / DAT / Geotab / Zapier are real providers now.
  it.each([
    ['Pacific Track', 'pacific-track'],
    ['DAT load board', 'dat'],
    ['Geotab', 'geotab'],
    ['Zapier', 'zapier'],
  ])('connects %s through PUT /integrations/%s', async (name, provider) => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.apiKeys.list), () => ok([])));
    let sent: unknown = null;
    server.use(
      http.put(url(endpoints.integrations.update(provider)), async ({ request }) => {
        sent = await request.json();
        return ok({ id: 'int_9', provider, enabled: true, status: 'CONNECTED' });
      }),
    );

    renderPage();
    await screen.findByText('McLeod PowerBroker');
    const card = screen.getByText(name).closest('div.rounded-lg')!;
    await userEventClickWithin(card, /connect/i, user);

    await waitFor(() => expect(sent).toMatchObject({ enabled: true }));
  });

  it('Browse marketplace opens the catalog modal (B-89, shipped)', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.get(url(endpoints.integrations.catalog), () =>
        ok([
          { provider: 'mcleod', name: 'McLeod PowerBroker', description: 'TMS', category: 'Dispatch', available: true },
          { provider: 'geotab', name: 'Geotab', description: 'Telematics', category: 'ELD', available: false },
        ]),
      ),
    );
    renderPage();
    await user.click(await screen.findByRole('button', { name: /browse marketplace/i }));
    const dialog = await screen.findByRole('dialog', { name: /integration marketplace/i });
    expect(within(dialog).getByText('Geotab')).toBeInTheDocument();
    const geotabConnect = within(dialog)
      .getAllByRole('button', { name: 'Connect' })
      .find((b) => b.closest('div')?.textContent?.includes('Geotab'));
    expect(geotabConnect).toBeDisabled();
  });

  it('Edit scopes PATCHes the new scope set and refuses an empty one', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get(url(endpoints.apiKeys.list), () =>
        ok([{ id: 'key_1', name: 'McLeod TMS', prefix: 'obk_ABCD', scopes: ['reports:read'], lastUsedAt: null, expiresAt: null, revokedAt: null }]),
      ),
      http.patch(url(endpoints.apiKeys.scopes('key_1')), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'key_1', scopes: ['reports:read', 'drivers:read'] });
      }),
    );
    renderPage();
    await screen.findByText('McLeod TMS');

    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Edit scopes'));

    await user.click(await screen.findByRole('checkbox', { name: /Read reports/ }));
    await user.click(screen.getByRole('button', { name: 'Save scopes' }));
    expect(await screen.findByText('Choose at least one scope.')).toBeInTheDocument();
    expect(body).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: /Read drivers/ }));
    await user.click(screen.getByRole('button', { name: 'Save scopes' }));
    await waitFor(() => expect(body).toEqual({ scopes: ['drivers:read'] }));
  });
});

/* ------------------------------------------------------------------ WB-251 Custom webhook */

describe('IntegrationsPage — Custom webhook (WB-251)', () => {
  const WEBHOOK_URL = 'https://hooks.example.com/onebook';

  function webhookCard() {
    return screen.getByText('Custom webhook').closest('div.rounded-lg')!;
  }

  it('Connect opens the webhook modal instead of connecting blind', async () => {
    const user = userEvent.setup();
    let putCalled = false;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.put(url(endpoints.integrations.update('webhook')), () => {
        putCalled = true;
        return ok({ id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED' });
      }),
    );
    renderPage();
    await screen.findByText('Custom webhook');
    await userEventClickWithin(webhookCard(), /connect/i, user);

    const dialog = await screen.findByRole('dialog', { name: 'Connect Custom webhook' });
    expect(within(dialog).getByLabelText(/Endpoint URL/)).toHaveValue('');
    expect(within(dialog).getByLabelText(/Signing secret/)).toHaveAttribute('type', 'password');
    expect(putCalled).toBe(false);
  });

  it('shows validation errors and sends nothing for an empty or non-http URL and an empty secret', async () => {
    const user = userEvent.setup();
    let putCalled = false;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.put(url(endpoints.integrations.update('webhook')), () => {
        putCalled = true;
        return ok({});
      }),
    );
    renderPage();
    await screen.findByText('Custom webhook');
    await userEventClickWithin(webhookCard(), /connect/i, user);
    const dialog = await screen.findByRole('dialog', { name: 'Connect Custom webhook' });

    await user.click(within(dialog).getByRole('button', { name: 'Connect' }));
    expect(await within(dialog).findByText('Enter a full URL starting with https:// (or http://).')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a signing secret, or generate one.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Signing secret/)).toHaveAttribute('aria-invalid', 'true');

    await user.type(within(dialog).getByLabelText(/Endpoint URL/), 'ftp://files.example.com/hook');
    await user.type(within(dialog).getByLabelText(/Signing secret/), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Connect' }));
    expect(await within(dialog).findByText('Enter a full URL starting with https:// (or http://).')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a signing secret, or generate one.')).toBeInTheDocument();
    expect(putCalled).toBe(false);
  });

  it('submits { enabled: true, config: { url, secret } } and toasts', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.put(url(endpoints.integrations.update('webhook')), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED' });
      }),
    );
    renderPage();
    await screen.findByText('Custom webhook');
    await userEventClickWithin(webhookCard(), /connect/i, user);
    const dialog = await screen.findByRole('dialog', { name: 'Connect Custom webhook' });

    await user.type(within(dialog).getByLabelText(/Endpoint URL/), WEBHOOK_URL);
    await user.type(within(dialog).getByLabelText(/Signing secret/), 'whsec_test_value');
    await user.click(within(dialog).getByRole('button', { name: 'Show secret' }));
    expect(within(dialog).getByLabelText(/Signing secret/)).toHaveAttribute('type', 'text');
    await user.click(within(dialog).getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(body).toEqual({ enabled: true, config: { url: WEBHOOK_URL, secret: 'whsec_test_value' } }),
    );
    expect(await screen.findByText('Custom webhook connected')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Connect Custom webhook' })).not.toBeInTheDocument());
  });

  it('Generate fills a 64-character hex secret and reveals it', async () => {
    const user = userEvent.setup();
    let body: { config?: { secret?: string } } | null = null;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.put(url(endpoints.integrations.update('webhook')), async ({ request }) => {
        body = (await request.json()) as typeof body;
        return ok({ id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED' });
      }),
    );
    renderPage();
    await screen.findByText('Custom webhook');
    await userEventClickWithin(webhookCard(), /connect/i, user);
    const dialog = await screen.findByRole('dialog', { name: 'Connect Custom webhook' });

    await user.type(within(dialog).getByLabelText(/Endpoint URL/), WEBHOOK_URL);
    await user.click(within(dialog).getByRole('button', { name: 'Generate' }));
    const secretInput = within(dialog).getByLabelText(/Signing secret/);
    expect(secretInput).toHaveAttribute('type', 'text');
    expect((secretInput as HTMLInputElement).value).toMatch(/^[0-9a-f]{64}$/);
    await user.click(within(dialog).getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(body?.config?.secret).toBe((secretInput as HTMLInputElement).value));
  });

  it('Configure re-opens the modal with the stored URL, a blank secret, and requires the secret again', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.get(url(endpoints.integrations.list), () =>
        ok([
          {
            id: 'int_6',
            provider: 'webhook',
            enabled: true,
            status: 'CONNECTED',
            lastSyncAt: null,
            config: { url: WEBHOOK_URL, secret: '[REDACTED]' },
          },
        ]),
      ),
      http.put(url(endpoints.integrations.update('webhook')), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED' });
      }),
    );
    renderPage();
    await screen.findByText('Custom webhook');
    await userEventClickWithin(webhookCard(), /configure/i, user);

    const dialog = await screen.findByRole('dialog', { name: 'Configure Custom webhook' });
    expect(within(dialog).getByLabelText(/Endpoint URL/)).toHaveValue(WEBHOOK_URL);
    const secretInput = within(dialog).getByLabelText(/Signing secret/);
    expect(secretInput).toHaveValue('');
    expect(within(dialog).queryByDisplayValue('[REDACTED]')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Saving replaces the whole webhook configuration/)).toBeInTheDocument();

    // The backend replaces the whole config, so an edit without the secret is refused client-side.
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Enter a signing secret, or generate one.')).toBeInTheDocument();
    expect(body).toBeNull();

    const urlInput = within(dialog).getByLabelText(/Endpoint URL/);
    await user.clear(urlInput);
    await user.type(urlInput, 'https://hooks.example.com/v2');
    await user.type(secretInput, 'rotated-secret');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(body).toEqual({ enabled: true, config: { url: 'https://hooks.example.com/v2', secret: 'rotated-secret' } }),
    );
    expect(await screen.findByText('Custom webhook updated')).toBeInTheDocument();
  });

  it('Send test posts to /integrations/webhook/test and toasts; a 409 shows the mapped message', async () => {
    const user = userEvent.setup();
    let calls = 0;
    let body: unknown = null;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.get(url(endpoints.integrations.list), () =>
        ok([{ id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED', lastSyncAt: null, config: { url: WEBHOOK_URL, secret: '[REDACTED]' } }]),
      ),
      http.post(url(endpoints.integrations.testWebhook), async ({ request }) => {
        calls += 1;
        body = await request.json();
        return calls === 1
          ? ok({ id: 'whd_1', status: 'QUEUED', attempts: 0 }, 201)
          : fail(409, 'INTEGRATION_NOT_CONFIGURED', "No enabled 'webhook' integration configured.");
      }),
    );
    renderPage();
    await screen.findByText('Custom webhook');
    await userEventClickWithin(webhookCard(), /send test/i, user);
    await waitFor(() => expect(calls).toBe(1));
    expect(body).toEqual({ eventType: 'test.ping' });
    expect(await screen.findByText('Test event queued')).toBeInTheDocument();

    await userEventClickWithin(webhookCard(), /send test/i, user);
    expect(await screen.findByText('This integration is not configured yet.')).toBeInTheDocument();
  });

  it('flags a connected webhook with no endpoint URL', async () => {
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.get(url(endpoints.integrations.list), () =>
        ok([{ id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED', lastSyncAt: null, config: {} }]),
      ),
    );
    renderPage();
    expect(await screen.findByText('Connected · no endpoint set')).toBeInTheDocument();
  });

  it('hides Configure and Send test for a READ-only caller', async () => {
    canFull = false;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.get(url(endpoints.integrations.list), () =>
        ok([{ id: 'int_6', provider: 'webhook', enabled: true, status: 'CONNECTED', lastSyncAt: null, config: { url: WEBHOOK_URL, secret: '[REDACTED]' } }]),
      ),
    );
    renderPage();
    await screen.findByText('Custom webhook');
    expect(screen.queryByRole('button', { name: /configure/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send test/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument();
  });

  it('other providers still connect in one click with an empty config (Slack)', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.get(url(endpoints.apiKeys.list), () => ok([])),
      http.put(url(endpoints.integrations.update('slack')), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'int_2', provider: 'slack', enabled: true, status: 'CONNECTED' });
      }),
    );
    renderPage();
    await screen.findByText('McLeod PowerBroker');
    await userEventClickWithin(screen.getByText('Slack').closest('div.rounded-lg')!, /connect/i, user);
    await waitFor(() => expect(body).toEqual({ enabled: true, config: {} }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
