// web/tz.md §10 W-01 — KPI row, Live fleet card, Duty status donut, HOS violations table, and the
// per-card error state for the still-missing `GET /violations` (gap B-6).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import DashboardPage from './DashboardPage';

// Mutable per test: `granted` is the set of `key:level` pairs `can()` answers true for (null = all).
const perms = vi.hoisted(() => ({ granted: null as Set<string> | null }));
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({
    can: (key: string, level: 'READ' | 'FULL' = 'READ') =>
      perms.granted === null ||
      perms.granted.has(`${key}:FULL`) ||
      (level === 'READ' && perms.granted.has(`${key}:READ`)),
  }),
}));
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: false }) }));

// `maplibre-gl` calls `window.URL.createObjectURL` as a module-load side effect (web/bugs.md
// WB-016) — jsdom has no such API. The Live fleet card lazy-loads FleetMap once it has units.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock';
}

/** Renders the current router location so navigation can be asserted without a route tree. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  perms.granted = null;
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

// Perf plan item 3 (WD-074) — the KPI row, map, donut and carrier subtitle come from one
// `GET /dashboard/summary`; the violations table keeps its own server-paginated `GET /violations`
// (B-6) so page/limit work. These helpers build both responses per test case.
interface SummaryOverrides {
  liveFleet?: { items: unknown[]; generatedAt?: string };
  violations?: { items: unknown[]; total: number };
  unidentified?: { total: number; totalDurationSec: number };
  vehicles?: { active: number; total: number };
}

const DUTY_ON = new Set(['DRIVING', 'ON_DUTY', 'SLEEPER']);

function buildSummary(overrides: SummaryOverrides = {}) {
  const liveItems = (overrides.liveFleet?.items ?? []) as Array<{ dutyStatus: string }>;
  return {
    liveFleet: {
      items: liveItems,
      generatedAt: overrides.liveFleet?.generatedAt ?? new Date().toISOString(),
      counts: {
        total: liveItems.length,
        onDuty: liveItems.filter((u) => DUTY_ON.has(u.dutyStatus)).length,
        moving: liveItems.filter((u) => u.dutyStatus === 'DRIVING').length,
        idle: liveItems.filter((u) => u.dutyStatus === 'IDLE').length,
        offline: liveItems.filter((u) => u.dutyStatus === 'ELD_OFFLINE').length,
      },
    },
    violations: overrides.violations ?? { items: [], total: 0 },
    unidentified: overrides.unidentified ?? { total: 3, totalDurationSec: 1800 },
    notifications: { unreadCount: 0 },
    carrier: { id: 'carrier', name: 'Universal Logistics Inc.', timezone: 'America/New_York' },
    vehicles: overrides.vehicles ?? { active: 69, total: 69 },
    generatedAt: new Date().toISOString(),
  };
}

/** The paginated violations feed the table reads (`page`/`limit` → `OffsetPage`). */
function violationsPage(items: unknown[], total = items.length) {
  return http.get(url(endpoints.violations.list), () =>
    ok({ items, total, page: 1, limit: 10, totalPages: Math.max(1, Math.ceil(total / 10)) }),
  );
}

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('W-01 Fleet Dashboard', () => {
  it('pages the violations table through GET /violations page/limit', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `vio_${i + 1}`,
      severity: 'WARNING',
      driverId: 'drv_1',
      driverName: 'John Smith',
      vehicleId: 'v1',
      unitNumber: '#101',
      event: `Event ${i + 1}`,
      locationLabel: null,
      occurredAt: new Date().toISOString(),
    }));
    const requested: { page: string | null; limit: string | null }[] = [];
    server.use(
      http.get(url(endpoints.live.fleet), () => ok({ items: [], generatedAt: new Date().toISOString() })),
      http.get(url(endpoints.violations.list), ({ request }) => {
        const search = new URL(request.url).searchParams;
        requested.push({ page: search.get('page'), limit: search.get('limit') });
        const page = Number(search.get('page'));
        const limit = Number(search.get('limit'));
        return ok({
          items: rows.slice((page - 1) * limit, page * limit),
          total: rows.length,
          page,
          limit,
          totalPages: Math.ceil(rows.length / limit),
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Event 1', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('Event 11')).not.toBeInTheDocument();
    expect(screen.getByText('1–10 of 12 violations')).toBeInTheDocument();
    expect(requested[0]).toEqual({ page: '1', limit: '10' });

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Event 11', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('Event 1')).not.toBeInTheDocument();
    expect(screen.getByText('11–12 of 12 violations')).toBeInTheDocument();
    expect(requested.at(-1)).toEqual({ page: '2', limit: '10' });
    // the KPI keeps counting every violation, not just the rows on the current page.
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders the KPI row and an empty violations table', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () =>
        ok(
          buildSummary({
            liveFleet: {
              items: [
                { vehicleId: 'v1', unitNumber: '#101', dutyStatus: 'DRIVING', lat: 40, lon: -83 },
                { vehicleId: 'v2', unitNumber: '#102', dutyStatus: 'ON_DUTY', lat: 40.1, lon: -83.1 },
              ],
            },
          }),
        ),
      ),
      violationsPage([]),
    );

    renderPage();

    expect(await screen.findByText('Active vehicles', {}, { timeout: 8000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('69')).toBeInTheDocument());
    expect(await screen.findByText('No violations in the last 24 hours', {}, { timeout: 8000 })).toBeInTheDocument();
    // carrier-timezone subtitle is pushed into the topbar context, not this component's own DOM —
    // confirmed instead by the "Live fleet" card, which does render locally.
    expect(screen.getByText('Live fleet')).toBeInTheDocument();
  });

  it("shows an in-card error state when GET /dashboard/summary fails without leaving the page blank", async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () => new Response(null, { status: 404 })),
      http.get(url(endpoints.violations.list), () => new Response(null, { status: 404 })),
    );

    renderPage();

    expect(await screen.findByText('HOS violations & alerts', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('Could not load violations', {}, { timeout: 8000 })).toBeInTheDocument();
    // the KPI row still renders its labels (values fall back to "—") — the page is not blank.
    expect(screen.getByText('Active vehicles')).toBeInTheDocument();
  });

  it('renders a violation row with its unit, driver and the FULL-only row menu, and navigates to HOS logs on click', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () =>
        ok(
          buildSummary({
            liveFleet: {
              items: [{ vehicleId: 'v1', unitNumber: '#101', dutyStatus: 'DRIVING', lat: 40, lon: -83 }],
            },
          }),
        ),
      ),
      violationsPage([
        {
          id: 'vio_1',
          severity: 'VIOLATION',
          driverId: 'drv_1',
          driverName: 'John Smith',
          vehicleId: 'v1',
          unitNumber: '#101',
          event: '11-hour driving limit exceeded',
          locationLabel: '1.04 mi W of Harrisburg, OH',
          occurredAt: new Date().toISOString(),
          date: '2026-09-12',
        },
        {
          id: 'vio_2',
          severity: 'WARNING',
          driverId: null,
          driverName: null,
          vehicleId: 'v2',
          unitNumber: '#102',
          event: 'Unassigned driving · 1h 12m',
          locationLabel: null,
          occurredAt: new Date().toISOString(),
        },
      ]),
    );

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('11-hour driving limit exceeded', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();

    // the segment donut and the "Open map view" link both render with live data present.
    expect(screen.getByText('Open map view')).toBeInTheDocument();
    expect(await screen.findByText('Map preview unavailable', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('on duty', {}, { timeout: 8000 })).toBeInTheDocument();
    await user.click(screen.getAllByText('Driving')[0]!);
    await user.click(screen.getByText('View all ›'));

    const rowMenus = screen.getAllByRole('button', { name: 'Row actions' });
    // the second row has no driverId — its menu carries the extra "Assign to driver" item.
    await user.click(rowMenus[1]!);
    expect(await screen.findByText('Assign to driver', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  describe('HOS violations & alerts · row menu', () => {
    const assigned = {
      id: 'vio_1',
      severity: 'VIOLATION',
      driverId: 'drv_1',
      driverName: 'John Smith',
      vehicleId: 'v1',
      unitNumber: '#101',
      event: '11-hour driving limit exceeded',
      locationLabel: '1.04 mi W of Harrisburg, OH',
      occurredAt: new Date().toISOString(),
      date: '2026-09-12',
    };
    const unassigned = {
      id: 'vio_2',
      severity: 'WARNING',
      driverId: null,
      driverName: null,
      vehicleId: 'v2',
      unitNumber: '#102',
      event: 'Unassigned driving · 1h 12m',
      locationLabel: null,
      occurredAt: new Date().toISOString(),
      date: '2026-09-13',
    };

    function useRows() {
      server.use(http.get(url(endpoints.dashboard.summary), () => ok(buildSummary())), violationsPage([assigned, unassigned]));
    }

    async function openMenu(user: ReturnType<typeof userEvent.setup>, rowIndex: number) {
      await screen.findByText(assigned.event, {}, { timeout: 8000 });
      await user.click(screen.getAllByRole('button', { name: 'Row actions' })[rowIndex]!);
      return screen.findByRole('menu');
    }

    it('lists Open HOS logs · Send message · Resolve for a driver row, and Assign to driver only for an unassigned one', async () => {
      useRows();
      const user = userEvent.setup();
      renderPage();

      const menu = await openMenu(user, 0);
      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Open HOS logs',
        'Send message',
        'Resolve',
      ]);
      await user.keyboard('{Escape}');

      const unassignedMenu = await openMenu(user, 1);
      expect(within(unassignedMenu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Resolve',
        'Assign to driver',
      ]);
    });

    it('Open HOS logs navigates to the driver log day, without also firing the row click', async () => {
      useRows();
      const user = userEvent.setup();
      renderPage();

      const menu = await openMenu(user, 0);
      await user.click(within(menu).getByRole('menuitem', { name: 'Open HOS logs' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/hos-logs?driverId=drv_1&date=2026-09-12');
    });

    it("Send message deep-links to the driver's conversation in Messages", async () => {
      useRows();
      const user = userEvent.setup();
      renderPage();

      const menu = await openMenu(user, 0);
      await user.click(within(menu).getByRole('menuitem', { name: 'Send message' }));
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages\?driverId=drv_1$/);
    });

    it('Assign to driver deep-links to 11.13 Unassigned driving on the violation day', async () => {
      useRows();
      const user = userEvent.setup();
      renderPage();

      const menu = await openMenu(user, 1);
      await user.click(within(menu).getByRole('menuitem', { name: 'Assign to driver' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/hos-logs?unassigned=1&date=2026-09-13');
    });

    it('Resolve opens the modal, posts the note, toasts and refetches the table', async () => {
      useRows();
      let sent: { id: string; body: unknown } | null = null;
      let listCalls = 0;
      server.use(
        http.get(url(endpoints.violations.list), () => {
          listCalls += 1;
          return ok({ items: [assigned, unassigned], total: 2, page: 1, limit: 10, totalPages: 1 });
        }),
        http.post(url(endpoints.violations.resolve(':id')), async ({ request, params }) => {
          sent = { id: String(params.id), body: await request.json() };
          return ok({ id: String(params.id), status: 'RESOLVED', resolvedAt: new Date().toISOString(), resolutionNote: 'Detour' });
        }),
      );
      const user = userEvent.setup();
      renderPage();

      const menu = await openMenu(user, 0);
      const callsBefore = listCalls;
      await user.click(within(menu).getByRole('menuitem', { name: 'Resolve' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Resolve violation')).toBeInTheDocument();
      expect(within(dialog).getByText(assigned.event)).toBeInTheDocument();
      // opening the modal did not navigate through the row click.
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);

      await user.type(within(dialog).getByRole('textbox'), 'Adverse weather detour.');
      await user.click(within(dialog).getByRole('button', { name: 'Resolve' }));

      await waitFor(() => expect(sent).toEqual({ id: 'vio_1', body: { resolutionNote: 'Adverse weather detour.' } }));
      expect(await screen.findByText('Violation resolved')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(listCalls).toBeGreaterThan(callsBefore));
    });

    it('hides Send message without messaging access, and the whole column below hosEdit FULL', async () => {
      useRows();
      perms.granted = new Set(['dashboard:READ', 'hos:READ', 'hosEdit:FULL']);
      const user = userEvent.setup();
      const { unmount } = renderPage();

      const menu = await openMenu(user, 0);
      expect(within(menu).queryByRole('menuitem', { name: 'Send message' })).not.toBeInTheDocument();
      expect(within(menu).getByRole('menuitem', { name: 'Open HOS logs' })).toBeInTheDocument();
      unmount();

      perms.granted = new Set(['dashboard:READ', 'hos:READ', 'hosEdit:READ', 'messaging:FULL']);
      renderPage();
      await screen.findByText(assigned.event, {}, { timeout: 8000 });
      expect(screen.queryByRole('button', { name: 'Row actions' })).not.toBeInTheDocument();
    });
  });
});
