// pt30_pt40/tz.md §10.1 — Test PT30/40 mode card: availability, RBAC, confirm, errors.
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
import { VirtualEldCard } from './VirtualEldCard';

let canFull = true;
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (_key: string, level?: string) => (level === 'FULL' ? canFull : true) }),
}));

const BASE = { id: 'carrier', name: 'Acme', dotNumber: '1234567', timezone: 'America/New_York', erodsMode: 'TEST' as const };

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <VirtualEldCard />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function carrier(extra: Record<string, unknown>) {
  server.use(http.get(url(endpoints.carrier.root), () => ok({ ...BASE, ...extra })));
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
});

describe('VirtualEldCard', () => {
  it('is absent when virtualEldAvailable is false', async () => {
    carrier({ virtualEldEnabled: false, virtualEldAvailable: false });
    renderCard();
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByTestId('virtual-eld-card')).toBeNull();
  });

  it('shows Off, then confirms before enabling and fires the Settings saved toast', async () => {
    const user = userEvent.setup();
    carrier({ virtualEldEnabled: false, virtualEldAvailable: true });
    let patched: unknown = null;
    server.use(
      http.patch(url(endpoints.carrier.root), async ({ request }) => {
        patched = await request.json();
        return ok({ ...BASE, virtualEldEnabled: true, virtualEldUpdatedAt: '2026-10-12T13:14:00Z' });
      }),
    );
    renderCard();
    const sw = await screen.findByRole('switch', { name: 'Test PT30/40 mode (Emulator)' });
    expect(screen.getByRole('status')).toHaveTextContent('Off');
    await user.click(sw);
    expect(patched).toBeNull(); // nothing sent before the confirmation
    expect(await screen.findByText('Turn on test mode?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(patched).toEqual({ virtualEldEnabled: true }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it('shows who/when when enabled and turns off without a confirmation', async () => {
    const user = userEvent.setup();
    carrier({ virtualEldEnabled: true, virtualEldAvailable: true, virtualEldUpdatedAt: '2026-10-12T13:14:00Z', virtualEldUpdatedBy: 'Sarah Chen' });
    let patched: unknown = null;
    server.use(
      http.patch(url(endpoints.carrier.root), async ({ request }) => {
        patched = await request.json();
        return ok({ ...BASE, virtualEldEnabled: false });
      }),
    );
    renderCard();
    const sw = await screen.findByRole('switch');
    expect(screen.getByRole('status')).toHaveTextContent(/enabled by Sarah Chen on .*09:14/);
    await user.click(sw);
    await waitFor(() => expect(patched).toEqual({ virtualEldEnabled: false }));
  });

  it('toasts the TEST-eRODS guidance on VIRTUAL_ELD_REQUIRES_TEST_ERODS', async () => {
    const user = userEvent.setup();
    carrier({ virtualEldEnabled: false, virtualEldAvailable: true, erodsMode: 'PRODUCTION' });
    server.use(http.patch(url(endpoints.carrier.root), () => fail(409, 'VIRTUAL_ELD_REQUIRES_TEST_ERODS', 'x')));
    renderCard();
    await user.click(await screen.findByRole('switch'));
    await user.click(await screen.findByRole('button', { name: 'Turn on' }));
    expect(await screen.findByText('Set eRODS mode to TEST first.')).toBeInTheDocument();
  });

  it('RBAC: a role without carrierSettings FULL sees a disabled switch with a tooltip, never a PATCH', async () => {
    canFull = false;
    carrier({ virtualEldEnabled: false, virtualEldAvailable: true });
    renderCard();
    const sw = await screen.findByRole('switch');
    expect(sw).toBeDisabled();
    expect(sw.parentElement).toHaveAttribute('title', expect.stringContaining('carrier settings'));
  });
});
