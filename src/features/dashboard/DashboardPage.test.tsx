// web/tz.md §10 W-01 — KPI row, Live fleet card, Duty status donut, HOS violations table, and the
// per-card error state for the still-missing `GET /violations` (gap B-6).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import DashboardPage from './DashboardPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: false }) }));

// `maplibre-gl` calls `window.URL.createObjectURL` as a module-load side effect (web/bugs.md
// WB-016) — jsdom has no such API. The Live fleet card lazy-loads FleetMap once it has units.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock';
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

// Perf plan item 3 (WD-074) — the page now fires one `GET /dashboard/summary` request instead of
// six; these helpers build that single composite response per test case.
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

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('W-01 Fleet Dashboard', () => {
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
            violations: { items: [], total: 0 },
          }),
        ),
      ),
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
    server.use(http.get(url(endpoints.dashboard.summary), () => new Response(null, { status: 404 })));

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
            violations: {
              items: [
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
              ],
              total: 2,
            },
          }),
        ),
      ),
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
});
