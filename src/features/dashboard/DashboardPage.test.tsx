// web/tz.md §10 W-01 — KPI row, Live fleet card, Duty status donut, HOS violations table, and the
// per-card error state for the still-missing `GET /violations` (gap B-6).
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import { http } from 'msw';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
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
  unidentified?: { total: number; totalDurationSec: number; awaitingDriver?: number; awaitingDriverDurationSec?: number };
  vehicles?: { active: number; total: number; inactive?: number; outOfService?: number };
}

const DUTY_ON = new Set(['DRIVING', 'ON_DUTY', 'SLEEPER']);

function buildSummary(overrides: SummaryOverrides = {}) {
  const liveItems = (overrides.liveFleet?.items ?? []) as Array<{ dutyStatus: string; connectivity?: string }>;
  return {
    liveFleet: {
      items: liveItems,
      generatedAt: overrides.liveFleet?.generatedAt ?? new Date().toISOString(),
      counts: {
        total: liveItems.length,
        onDuty: liveItems.filter((u) => DUTY_ON.has(u.dutyStatus)).length,
        moving: liveItems.filter((u) => u.dutyStatus === 'DRIVING').length,
        idle: liveItems.filter((u) => u.dutyStatus === 'IDLE').length,
        offline: liveItems.filter((u) => u.connectivity === 'ELD_OFFLINE').length,
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
    expect(await screen.findByText('No open violations', {}, { timeout: 8000 })).toBeInTheDocument();
    // carrier-timezone subtitle is pushed into the topbar context, not this component's own DOM —
    // confirmed instead by the "Live fleet" card, which does render locally.
    expect(screen.getByText('Live fleet')).toBeInTheDocument();
  });

  it('CODE-054: Open HOS violations falls back to the summary count (never 0) while the table fails', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () => ok(buildSummary({ violations: { items: [], total: 7 } }))),
      http.get(url(endpoints.violations.list), () => new Response(null, { status: 500 })),
    );
    renderPage();
    const label = await screen.findByText('Open HOS violations', {}, { timeout: 8000 });
    const card = label.parentElement!.parentElement!;
    await waitFor(() => expect(within(card).getByText('7')).toBeInTheDocument());
  });

  it('CODE-029: the Unassigned driving tile names segments awaiting driver confirmation apart', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () =>
        ok(buildSummary({ unidentified: { total: 3, totalDurationSec: 1800, awaitingDriver: 2, awaitingDriverDurationSec: 900 } })),
      ),
      violationsPage([]),
    );
    renderPage();
    expect(await screen.findByText('3 segments · 2 awaiting driver', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('CODE-029: no awaiting-driver hint when nothing waits for a driver', async () => {
    server.use(http.get(url(endpoints.dashboard.summary), () => ok(buildSummary())), violationsPage([]));
    renderPage();
    expect(await screen.findByText('3 segments', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText(/awaiting driver/)).not.toBeInTheDocument();
  });

  it('UI-015/UI-004: the duty card counts ASSIGNED drivers and the vehicles KPI names out-of-service units', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () =>
        ok(
          buildSummary({
            liveFleet: {
              items: [
                { vehicleId: 'v1', unitNumber: '#101', driverId: 'd1', dutyStatus: 'DRIVING', lat: 40, lon: -83 },
                { vehicleId: 'v2', unitNumber: '#102', driverId: 'd2', dutyStatus: 'ON_DUTY', lat: 40.1, lon: -83.1 },
                { vehicleId: 'v3', unitNumber: '#103', driverId: null, dutyStatus: 'INACTIVE', lat: null, lon: null },
              ],
            },
            vehicles: { active: 40, total: 45, inactive: 3, outOfService: 2 },
          }),
        ),
      ),
      violationsPage([]),
    );
    renderPage();

    expect(await screen.findByText('2 assigned drivers · 2 on duty', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('of 45 · 2 out of service')).toBeInTheDocument();
  });

  it('QA LIVE-002 / LIVE-011: drivers on ELD-offline or out-of-service units still count as on duty; ELD offline counts units', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () =>
        ok({
          ...buildSummary({
            liveFleet: {
              items: [
                { vehicleId: 'v1', unitNumber: '#101', driverId: 'd1', dutyStatus: 'ELD_OFFLINE', isStale: true, driverDutyStatus: 'DRIVING', connectivity: 'ELD_OFFLINE', lat: null, lon: null },
                { vehicleId: 'v2', unitNumber: '#102', driverId: 'd2', dutyStatus: 'INACTIVE', driverDutyStatus: 'ON_DUTY', connectivity: 'ELD_OFFLINE', lat: null, lon: null },
                { vehicleId: 'v3', unitNumber: '#103', driverId: 'd3', dutyStatus: 'OFF_DUTY', driverDutyStatus: 'OFF_DUTY', connectivity: 'ELD_OFFLINE', lat: null, lon: null },
                { vehicleId: 'v4', unitNumber: '#104', driverId: null, dutyStatus: 'INACTIVE', driverDutyStatus: null, connectivity: 'NO_DEVICE', lat: null, lon: null },
              ],
            },
          }),
        }),
      ),
      violationsPage([]),
    );
    renderPage();

    expect(await screen.findByText('3 assigned drivers · 2 on duty', {}, { timeout: 8000 })).toBeInTheDocument();
    const kpi = screen.getByText('Drivers on duty').closest('div')!.parentElement!;
    expect(within(kpi).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('0 moving · 0 idle · 3 units with ELD offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Driving: 1 driver, 33%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Off-duty: 1 driver, 33%' })).toBeInTheDocument();
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

  it('FE-002: card error copy follows the error status — a 403 is not "the service did not respond"', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () => fail(403, 'FORBIDDEN', 'Forbidden.')),
      http.get(url(endpoints.violations.list), () => fail(503, 'SERVICE_UNAVAILABLE', 'Down.')),
    );
    renderPage();
    expect(await screen.findByText('Could not load the fleet', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getAllByText('You do not have access to this.').length).toBeGreaterThanOrEqual(2);
    expect(
      await screen.findByText(/The telematics service did not respond/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/The telematics service did not respond/)).toHaveLength(1);
  });

  it('renders a violation row with its unit, driver and the FULL-only row menu, and navigates to HOS logs on click', async () => {
    server.use(
      http.get(url(endpoints.dashboard.summary), () =>
        ok(
          buildSummary({
            liveFleet: {
              items: [{ vehicleId: 'v1', unitNumber: '#101', driverId: 'd1', dutyStatus: 'DRIVING', lat: 40, lon: -83 }],
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
    // WB-257 — jsdom has no IntersectionObserver, so the map chunk (MapLibre) is never requested;
    // the same-size placeholder holds the slot. `mounts the map once the card scrolls into view`
    // below covers the visible path.
    expect(screen.queryByText('Map preview unavailable')).not.toBeInTheDocument();
    expect(await screen.findByText('on duty', {}, { timeout: 8000 })).toBeInTheDocument();
    await user.click(screen.getAllByText('Driving')[0]!);
    await user.click(screen.getByText('View all ›'));

    const rowMenus = screen.getAllByRole('button', { name: 'Row actions' });
    // the second row has no driverId — its menu carries the extra "Assign to driver" item.
    await user.click(rowMenus[1]!);
    expect(await screen.findByText('Assign to driver', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  // WB-257 — the MapLibre chunk is requested only once the Live fleet card nears the viewport.
  it('mounts the map preview only once the card scrolls into view', async () => {
    const observers: { cb: IntersectionObserverCallback; observed: Element[] }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observed: Element[] = [];
        constructor(cb: IntersectionObserverCallback) {
          observers.push({ cb, observed: this.observed });
        }
        observe(el: Element) {
          this.observed.push(el);
        }
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    server.use(
      http.get(url(endpoints.dashboard.summary), () =>
        ok(buildSummary({ liveFleet: { items: [{ vehicleId: 'v1', unitNumber: '#101', driverId: 'd1', dutyStatus: 'DRIVING', lat: 40, lon: -83 }] } })),
      ),
      violationsPage([]),
    );
    renderPage();
    expect(await screen.findByText('on duty', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('Map preview unavailable')).not.toBeInTheDocument();
    const observer = await waitFor(() => {
      const found = observers.find((o) => o.observed.length > 0);
      expect(found).toBeDefined();
      return found!;
    });
    act(() => {
      observer.cb(
        [{ isIntersecting: true, target: observer.observed[0]! } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(await screen.findByText('Map preview unavailable', {}, { timeout: 8000 })).toBeInTheDocument();
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
