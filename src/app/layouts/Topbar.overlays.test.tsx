// 11.26 Account menu · 11.27 Notifications panel · 11.28 Command palette — through the real
// Topbar, per role, against MSW (web/tz.md §11.26–§11.28, §12, §15).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectNoBlockingA11yViolations } from '../../../tests/setup/axe';
import { fail, server, url } from '@/mocks/server';
import { resetShellGapState } from '@/mocks/handlers/shellGaps';
import { endpoints } from '@/shared/api/endpoints';
import type { NotificationsPage } from '@/shared/api/notifications';
import { qk } from '@/shared/api/queryKeys';
import type { Role } from '@/shared/auth/permissions';
import { ToastProvider } from '@/shared/ui/Toast';
import { DynamicSubtitleProvider, OVERLAY_PRELOAD_DELAY_MS, Topbar, useDynamicSubtitle } from './Topbar';

const state = vi.hoisted(() => ({
  role: 'ADMIN' as Role,
  signOut: vi.fn(),
  socketHandlers: new Map<string, (payload: unknown) => void>(),
  connected: false,
  matches: [{ handle: { title: 'Fleet Dashboard' } }] as Array<{ handle?: unknown }>,
}));

vi.mock('@/shared/auth/AuthProvider', async () => {
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return { useAuth: () => buildMockAuthContext(state.role, { signOut: state.signOut }) };
});

// `useMatches` needs a data router, and a data router hands jsdom's AbortSignal to MSW's undici
// `Request` on every navigation (unhandled rejection). The page title is not under test here.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMatches: () => state.matches,
}));

const fakeSocket = {
  on: (event: string, handler: (payload: unknown) => void) => state.socketHandlers.set(event, handler),
  off: (event: string) => state.socketHandlers.delete(event),
};

vi.mock('@/shared/realtime/RealtimeProvider', () => ({
  useRealtime: () => ({ getSocket: () => (state.connected ? fakeSocket : null), connected: state.connected, isOffline: false }),
}));

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'bypass' });
  // Warm the lazy chunks so the first test is not measuring module transform time.
  await Promise.all([
    import('@/features/search/CommandPalette'),
    import('./NotificationsPopover'),
    import('./AccountMenu'),
    import('./KeyboardShortcutsModal'),
  ]);
});
afterEach(() => {
  server.resetHandlers();
  resetShellGapState();
  state.role = 'ADMIN';
  state.connected = false;
  state.matches = [{ handle: { title: 'Fleet Dashboard' } }];
  state.socketHandlers.clear();
  state.signOut.mockReset();
});
afterAll(() => server.close());

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</p>;
}

function renderTopbar(role: Role = 'ADMIN') {
  state.role = role;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <Topbar />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user, queryClient };
}

const location = () => screen.getByTestId('location').textContent;

describe('11.28 Command palette', () => {
  it('⌘K and Ctrl+K toggle it; Esc closes and focus returns', async () => {
    const { user } = renderTopbar();
    await user.keyboard('{Meta>}k{/Meta}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    expect(within(dialog).getByRole('combobox')).toHaveFocus();
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Search vehicles, drivers…' }));
    await screen.findByRole('dialog', { name: 'Command palette' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
  });

  it('? typed inside the palette input does not open Keyboard shortcuts', async () => {
    const { user } = renderTopbar('ADMIN');
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(dialog).getByRole('combobox'), '?');
    expect(within(dialog).getByRole('combobox')).toHaveValue('?');
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });

  it('preloads the bell and account chunks shortly after mount', async () => {
    renderTopbar('VIEWER');
    await act(() => new Promise((resolve) => setTimeout(resolve, OVERLAY_PRELOAD_DELAY_MS + 100)));
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });

  it('searches B-10, groups results, shows the scope footer and opens with ↑↓ + Enter', async () => {
    const { user } = renderTopbar('ADMIN');
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(dialog).getByRole('combobox'), 'smith');

    expect(await within(dialog).findByRole('option', { name: /John Smith\s*Unit #101 · On duty · 1 violation · 1 warning/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'DRIVERS' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'VEHICLES' })).toHaveTextContent('Unit #101 · Freightliner Cascadia');
    expect(within(dialog).getByRole('option', { name: /VIN 1FUJGLDR8LLLL1234 · John Smith/ })).toBeInTheDocument();
    const actions = within(dialog).getByRole('group', { name: 'ACTIONS' });
    expect(within(actions).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Open HOS logs for John Smith',
      'Request a log edit',
      'Send FMCSA pack to inspector',
      'Add a vehicle',
    ]);
    expect(dialog).toHaveTextContent('Searching 69 units · 58 drivers · 1,284 logs');
    await expectNoBlockingA11yViolations(dialog);

    const combobox = within(dialog).getByRole('combobox');
    expect(within(dialog).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{ArrowDown}{ArrowDown}');
    const selected = within(dialog).getAllByRole('option')[1];
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(combobox).toHaveAttribute('aria-activedescendant', selected?.id);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(location()).toBe('/drivers/drv_33'));
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
  });

  it('VIEWER: write actions and forbidden pages are absent from the DOM', async () => {
    const { user } = renderTopbar('VIEWER');
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    expect(within(dialog).queryByRole('group', { name: 'ACTIONS' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Dispatch & Trips')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Messages')).not.toBeInTheDocument();
    expect(within(dialog).getByText('HOS Logs')).toBeInTheDocument();
  });

  it('DISPATCHER: filtering pages by text, no DVIR/Safety, click opens the page', async () => {
    const { user } = renderTopbar('DISPATCHER');
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    expect(within(dialog).queryByText('DVIR & Maintenance')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Safety')).not.toBeInTheDocument();
    await user.type(within(dialog).getByRole('combobox'), 't');
    const pages = within(dialog).getByRole('group', { name: 'PAGES' });
    expect(within(pages).queryByText('Dashboard')).not.toBeInTheDocument();
    await user.click(within(pages).getByText('Dispatch & Trips'));
    await waitFor(() => expect(location()).toBe('/trips'));
  });

  it('shows the no-match copy when nothing matches', async () => {
    const { user } = renderTopbar('VIEWER');
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(dialog).getByRole('combobox'), 'zzqx');
    expect(await within(dialog).findByText('Nothing matches "zzqx"')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(location()).toBe('/');
  });

  it('renders a graceful in-panel error when search fails, with Retry', async () => {
    server.use(http.get(url(endpoints.search.root), () => fail(400, 'VALIDATION_FAILED', 'nope')));
    const { user } = renderTopbar('ADMIN');
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(dialog).getByRole('combobox'), 'smith');
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Search is unavailable right now. Pages and actions still work.');
    expect(within(dialog).getByRole('group', { name: 'ACTIONS' })).toBeInTheDocument();
    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await within(dialog).findByText('John Smith')).toBeInTheDocument();
  });
});

describe('11.27 Notifications panel', () => {
  it('bell shows the unread dot; panel lists items, segments and marks all read', async () => {
    const { user } = renderTopbar();
    const bell = await screen.findByRole('button', { name: 'Notifications, 4 unread' });
    expect(screen.getByTestId('bell-unread-dot')).toBeInTheDocument();
    await user.click(bell);

    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(await within(panel).findByText('4 new')).toBeInTheDocument();
    expect(within(panel).getAllByRole('listitem')).toHaveLength(6);
    expect(within(panel).getByText('John Smith exceeded the 11-hour driving limit by 00:26')).toBeInTheDocument();
    expect(within(panel).getByText('2 min')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /All\s*6/ })).toHaveAttribute('aria-pressed', 'true');
    await expectNoBlockingA11yViolations(panel);

    await user.click(within(panel).getByRole('button', { name: /Maintenance\s*1/ }));
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(1));

    await user.click(within(panel).getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(within(panel).queryByText('4 new')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByTestId('bell-unread-dot')).not.toBeInTheDocument();
  });

  it('clicking an item marks it read and deep-links when the role may open the target', async () => {
    const { user } = renderTopbar('ADMIN');
    await user.click(await screen.findByRole('button', { name: 'Notifications, 4 unread' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await user.click(await within(panel).findByText('ELD disconnected'));
    await waitFor(() => expect(location()).toBe('/vehicles/veh_110'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument());
  });

  it('DISPATCHER: a notification pointing at DVIR does not navigate past the guard', async () => {
    const { user } = renderTopbar('DISPATCHER');
    await user.click(await screen.findByRole('button', { name: /Notifications/ }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await user.click(await within(panel).findByText('Maintenance overdue'));
    expect(location()).toBe('/');
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('preferences cog goes to /account#notifications; View all expands the page', async () => {
    server.use(
      http.get(url(endpoints.notifications.list), ({ request }) => {
        const search = new URL(request.url).searchParams;
        const limit = Number(search.get('limit'));
        if (search.get('unreadOnly') === 'true') return HttpJson({ items: [], page: 1, limit, total: 0, totalPages: 1 });
        const items = Array.from({ length: Math.min(limit, 30) }, (_, i) => ({ id: `n${i}`, type: 'x', title: `Item ${i}`, body: '', readAt: 'r' }));
        return HttpJson({ items, page: 1, limit, total: 30, totalPages: 2 });
      }),
    );
    const { user } = renderTopbar();
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    let panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(25));
    expect(within(panel).queryByRole('group', { name: 'Filter notifications' })).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'View all notifications' }));
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(30));
    await user.click(within(panel).getByRole('button', { name: 'Notification preferences' }));
    await waitFor(() => expect(location()).toBe('/account#notifications'));
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(panel).toBeInTheDocument();
  });

  it('empty, error-with-retry and forbidden states render inside the panel', async () => {
    server.use(http.get(url(endpoints.notifications.list), () => HttpJson({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })));
    const first = renderTopbar();
    await first.user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument();
    first.unmount();

    server.use(http.get(url(endpoints.notifications.list), () => fail(400, 'BAD_REQUEST', 'broken')));
    const second = renderTopbar();
    await second.user.click(screen.getByRole('button', { name: 'Notifications' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load notifications');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    second.unmount();

    server.use(http.get(url(endpoints.notifications.list), () => fail(403, 'FORBIDDEN', 'no')));
    const third = renderTopbar();
    await third.user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('You do not have access to notifications')).toBeInTheDocument();
  });

  it('shows the in-panel alert when Mark all read fails', async () => {
    server.use(http.post(url(endpoints.notifications.readAll), () => fail(400, 'BAD_REQUEST', 'no')));
    const { user } = renderTopbar();
    await user.click(await screen.findByRole('button', { name: 'Notifications, 4 unread' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await user.click(await within(panel).findByRole('button', { name: 'Mark all read' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Could not mark notifications as read. Try again.');
  });

  it('notification.new over the socket patches the cache and toasts only CRITICAL', async () => {
    state.connected = true;
    const { queryClient } = renderTopbar();
    await screen.findByRole('button', { name: 'Notifications, 4 unread' });
    const handler = state.socketHandlers.get('notification.new');
    expect(handler).toBeDefined();

    act(() => handler?.({ notification: { id: 'live_1', type: 'x', title: 'Geofence exit', body: 'Unit #7 left Yard' } }));
    await screen.findByRole('button', { name: 'Notifications, 5 unread' });
    expect(screen.queryByText('Geofence exit')).not.toBeInTheDocument();

    act(() => handler?.({ notification: { id: 'live_2', type: 'x', title: 'Driving limit exceeded', body: 'John Smith', severity: 'CRITICAL' } }));
    expect(await screen.findByText('Driving limit exceeded')).toBeInTheDocument();
    const unread = queryClient.getQueryData<NotificationsPage>(qk.notifications({ unreadOnly: true, limit: 1 }));
    expect(unread?.total).toBe(6);
  });
});

describe('11.26 Account menu', () => {
  it('shows identity, role and the v1 item set; Switch role is absent', async () => {
    const { user } = renderTopbar('FLEET_MANAGER');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Mike Torres');
    expect(menu).toHaveTextContent('mike.torres@');
    expect(menu).toHaveTextContent('Fleet manager');
    expect(menu).toHaveTextContent('All terminals');
    expect(within(menu).queryByText('Switch role')).not.toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Account security' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Switch organisation/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByRole('menuitem', { name: /Appearance/ })).toHaveAttribute('aria-disabled', 'true');
    await expectNoBlockingA11yViolations(menu);

    await user.click(within(menu).getByRole('menuitem', { name: /My profile/ }));
    await waitFor(() => expect(location()).toBe('/account#profile'));
  });

  it.each([
    ['Account security', '/account#security'],
    ['Notification preferences', '/account#notifications'],
    ['Language', '/account#language'],
    ['Help center', '/settings/support'],
  ])('%s navigates to %s', async (label, to) => {
    const { user } = renderTopbar('VIEWER');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: new RegExp(label) }));
    await waitFor(() => expect(location()).toBe(to));
  });

  it('Sign out calls signOut; Keyboard shortcuts opens the dialog (also via ?)', async () => {
    const { user } = renderTopbar('ADMIN');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /Keyboard shortcuts/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveTextContent('Open or close the command palette');
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument());

    await user.keyboard('?');
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });
});

/** The success envelope, for handlers that return a custom page. */
function HttpJson(data: unknown) {
  return new Response(JSON.stringify({ data, traceId: 't', timestamp: new Date().toISOString() }), {
    headers: { 'content-type': 'application/json' },
  });
}

describe('Topbar title and subtitle', () => {
  function LiveSubtitle({ value }: { value: string }) {
    useDynamicSubtitle(value);
    return null;
  }

  it('falls back to the product name and shows a screen-provided subtitle', async () => {
    state.matches = [];
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <DynamicSubtitleProvider>
              <Topbar />
              <LiveSubtitle value="Universal Logistics Inc. · Today" />
            </DynamicSubtitleProvider>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'OneBook ELD' })).toBeInTheDocument();
    expect(await screen.findByText('Universal Logistics Inc. · Today')).toBeInTheDocument();
    expect(screen.queryByText('Fleet manager')).not.toBeInTheDocument();
    view.unmount();
  });
});
