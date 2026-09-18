// web/tz.md W-21 — four states, the permanently-disabled SMS channel (Q-2), and the enable/mute
// toggle mutation.
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
import AlertRulesPage from './AlertRulesPage';

let canFull = true;
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (_key: string, level?: string) => (level === 'FULL' ? canFull : true) }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AlertRulesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const RULE = {
  id: 'alr_1',
  key: 'hos_violation',
  name: 'HOS violation',
  severity: 'CRITICAL',
  conditions: [{ event: 'hos_violation' }],
  channels: ['IN_APP', 'EMAIL'],
  recipients: { roles: ['Fleet managers'] },
  enabled: true,
};

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
});

describe('AlertRulesPage — W-21', () => {
  it('the SMS channel card is always rendered disabled regardless of permission', async () => {
    server.use(http.get(url(endpoints.alertRules.list), () => ok([])));
    renderPage();
    await screen.findByText('No alert rules yet');
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText(/SMS is not part of this product/)).toBeInTheDocument();
  });

  it('shows the empty state, then an error state on failure', async () => {
    server.use(http.get(url(endpoints.alertRules.list), () => ok([])));
    renderPage();
    expect(await screen.findByText('No alert rules yet')).toBeInTheDocument();

    server.resetHandlers();
    server.use(http.get(url(endpoints.alertRules.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('filters by segment and by search text', async () => {
    const user = userEvent.setup();
    const mutedRule = { ...RULE, id: 'alr_2', name: 'Speeding', enabled: false };
    server.use(http.get(url(endpoints.alertRules.list), () => ok([RULE, mutedRule])));
    renderPage();
    await screen.findByText('HOS violation');
    expect(screen.getByText('Speeding')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^active/i }));
    expect(screen.queryByText('Speeding')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^muted/i }));
    expect(screen.getByText('Speeding')).toBeInTheDocument();
    expect(screen.queryByText('HOS violation')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^all/i }));
    await user.type(screen.getByPlaceholderText('Search rule…'), 'Speeding');
    expect(screen.getByText('Speeding')).toBeInTheDocument();
    expect(screen.queryByText('HOS violation')).not.toBeInTheDocument();
  });

  it('renders a muted rule with no recipients as "—" and Muted', async () => {
    const mutedRule = { ...RULE, id: 'alr_2', enabled: false, recipients: {} };
    server.use(http.get(url(endpoints.alertRules.list), () => ok([mutedRule])));
    renderPage();
    await screen.findByText('HOS violation');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Muted')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders a populated rule and removes the toggle/menu for a READ-only caller', async () => {
    canFull = false;
    server.use(http.get(url(endpoints.alertRules.list), () => ok([RULE])));
    renderPage();
    expect(await screen.findByText('HOS violation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new rule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('toggles a rule enabled/disabled', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.alertRules.list), () => ok([RULE])));
    let patched: unknown = null;
    server.use(
      http.patch(url(endpoints.alertRules.update(RULE.id)), async ({ request }) => {
        patched = await request.json();
        return ok({ ...RULE, enabled: false });
      }),
    );

    renderPage();
    await screen.findByText('HOS violation');
    await user.click(screen.getByRole('switch'));

    await waitFor(() => expect(patched).toEqual({ enabled: false }));
  });

  it('deletes a rule from the row actions menu', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.alertRules.list), () => ok([RULE])));
    let deleted = false;
    server.use(
      http.delete(url(endpoints.alertRules.remove(RULE.id)), () => {
        deleted = true;
        return ok({ success: true });
      }),
    );

    renderPage();
    await screen.findByText('HOS violation');
    await user.click(screen.getByRole('button', { name: 'Rule actions' }));
    await user.click(screen.getByText('Delete'));

    // WB-110 — the row menu only opens the confirm modal; nothing is sent until confirmed.
    const dialog = await screen.findByRole('dialog', { name: /delete hos violation\?/i });
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('WB-110 — deleting a rule requires confirmation and cancel sends nothing', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.alertRules.list), () => ok([RULE])));
    let deleted = false;
    server.use(
      http.delete(url(endpoints.alertRules.remove(RULE.id)), () => {
        deleted = true;
        return ok({ success: true });
      }),
    );

    renderPage();
    await screen.findByText('HOS violation');
    await user.click(screen.getByRole('button', { name: 'Rule actions' }));
    await user.click(screen.getByText('Delete'));

    const dialog = await screen.findByRole('dialog', { name: /delete hos violation\?/i });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleted).toBe(false);
  });

  it('opens the New alert rule modal and creates a rule without SMS in the payload', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.alertRules.list), () => ok([])));
    let created: unknown = null;
    server.use(
      http.post(url(endpoints.alertRules.create), async ({ request }) => {
        created = await request.json();
        return ok({ id: 'alr_9' }, 201);
      }),
    );

    renderPage();
    await user.click(await screen.findByRole('button', { name: /new rule/i }));
    await user.type(screen.getByPlaceholderText('Break required soon'), 'Speeding');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(created).not.toBeNull());
    const body = created as { channels: string[] };
    expect(body.channels).not.toContain('SMS');
  });
});
