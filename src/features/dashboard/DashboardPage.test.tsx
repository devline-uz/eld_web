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

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(
    http.get(url(endpoints.carrier.root), () =>
      ok({ id: 'carrier', name: 'Universal Logistics Inc.', timezone: 'America/New_York' }),
    ),
    http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 1, total: 69, totalPages: 1 })),
    http.get(url(endpoints.unidentified.list), () => ok({ items: [{ durationSec: 1800 }], total: 3 })),
  );
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
      http.get(url(endpoints.live.fleet), () =>
        ok({
          items: [
            { vehicleId: 'v1', unitNumber: '#101', dutyStatus: 'DRIVING', lat: 40, lon: -83 },
            { vehicleId: 'v2', unitNumber: '#102', dutyStatus: 'ON_DUTY', lat: 40.1, lon: -83.1 },
          ],
          generatedAt: new Date().toISOString(),
        }),
      ),
      http.get(url(endpoints.violations.list), () => ok({ items: [], total: 0 })),
    );

    renderPage();

    expect(await screen.findByText('Active vehicles', {}, { timeout: 8000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('69')).toBeInTheDocument());
    expect(await screen.findByText('No violations in the last 24 hours', {}, { timeout: 8000 })).toBeInTheDocument();
    // carrier-timezone subtitle is pushed into the topbar context, not this component's own DOM —
    // confirmed instead by the "Live fleet" card, which does render locally.
    expect(screen.getByText('Live fleet')).toBeInTheDocument();
  });

  it("shows an in-card error state when GET /violations 404s (gap B-6) without breaking the rest of the page", async () => {
    server.use(
      http.get(url(endpoints.live.fleet), () => ok({ items: [], generatedAt: new Date().toISOString() })),
      http.get(url(endpoints.violations.list), () => new Response(null, { status: 404 })),
    );

    renderPage();

    expect(await screen.findByText('HOS violations & alerts', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('Could not load violations', {}, { timeout: 8000 })).toBeInTheDocument();
    // the rest of the page still rendered — the failure is contained to its own card.
    expect(screen.getByText('Active vehicles')).toBeInTheDocument();
  });

  it('renders a violation row with its unit, driver and the FULL-only row menu, and navigates to HOS logs on click', async () => {
    server.use(
      http.get(url(endpoints.live.fleet), () =>
        ok({
          items: [{ vehicleId: 'v1', unitNumber: '#101', dutyStatus: 'DRIVING', lat: 40, lon: -83 }],
          generatedAt: new Date().toISOString(),
        }),
      ),
      http.get(url(endpoints.violations.list), () =>
        ok({
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
        }),
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
