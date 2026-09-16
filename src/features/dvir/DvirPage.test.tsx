// web/tz.md §10 W-09 — smoke test: renders the KPI row, the DVIRs tab and the RBAC-gated
// `+ New work order` control from the real fixture data.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import DvirPage from './DvirPage';

let mockCan = (_key: string, _level?: 'READ' | 'FULL') => true;
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: (k: string, l?: 'READ' | 'FULL') => mockCan(k, l) }) }));
vi.mock('@/shared/auth/Can', () => ({
  Can: ({ perm, level, children }: { perm: string; level?: 'READ' | 'FULL'; children: React.ReactNode }) =>
    mockCan(perm, level) ? children : null,
}));

function renderPage(route = '/dvir') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <DvirPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  mockCan = () => true;
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('DvirPage', () => {
  it('renders the header and KPI row', async () => {
    renderPage();
    expect(await screen.findByText('DVIR & Maintenance')).toBeInTheDocument();
    expect((await screen.findAllByText('Open defects')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Overdue services')).toBeInTheDocument();
    expect(await screen.findByText('DVIRs today')).toBeInTheDocument();
    expect(await screen.findByText('Vehicles out of service')).toBeInTheDocument();
  });

  it('shows the DVIR empty-state copy verbatim when there are no recent inspections', async () => {
    server.use(http.get(url(endpoints.dvir.list), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findByText('No inspections in this period')).toBeInTheDocument();
    expect(screen.getByText('Drivers submit pre-trip and post-trip inspections from the mobile app.')).toBeInTheDocument();
  });

  it('shows the open-defects empty-state copy verbatim when there are none', async () => {
    server.use(http.get(url(endpoints.defects.list), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findAllByText('No open defects')).not.toHaveLength(0);
    expect(screen.getAllByText('Every reported defect has been corrected.').length).toBeGreaterThan(0);
  });

  it('renders "+ New work order" for maintenance FULL and removes it otherwise', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'New work order' })).toBeInTheDocument();
  });

  it('removes the create/new work-order controls without maintenance FULL', async () => {
    mockCan = (key, level) => !(key === 'maintenance' && level === 'FULL');
    renderPage();
    await screen.findByText('DVIR & Maintenance');
    expect(screen.queryByRole('button', { name: 'New work order' })).not.toBeInTheDocument();
  });

  // Regression — each of the three paged tables kept its page across a search change, so a search
  // typed on page 2 asked for page 2 of the narrowed result and the table rendered with no rows.
  it('work orders: a search typed on page 2 re-pages to page 1', async () => {
    const user = userEvent.setup();
    const workOrders = Array.from({ length: 30 }, (_, i) => ({
      id: `wo_${i}`,
      number: `WO-${1000 + i}`,
      vehicleId: 'veh_1',
      title: `Brake job ${i}`,
      priority: 'HIGH',
      status: 'OPEN',
      vendor: 'Shop',
      costUsd: '120.00',
      dueAt: null,
    }));
    server.use(
      http.get(url(endpoints.workOrders.list), ({ request }) => {
        const p = new URL(request.url).searchParams;
        const q = (p.get('q') ?? '').toLowerCase();
        const page = Math.max(1, Number(p.get('page') ?? 1));
        const limit = Math.max(1, Number(p.get('limit') ?? 25));
        const items = q ? workOrders.filter((w) => w.number.toLowerCase().includes(q)) : workOrders;
        return ok({
          items: items.slice((page - 1) * limit, page * limit),
          page,
          limit,
          total: items.length,
          totalPages: Math.max(1, Math.ceil(items.length / limit)),
        });
      }),
    );
    renderPage('/dvir?tab=workOrders');

    await user.click(await screen.findByRole('button', { name: '2' }));
    expect(await screen.findByText('WO-1010')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search unit, defect…'), 'WO-1003');
    // Re-query on each tick — the clamp commits one more render after the page lands.
    await waitFor(() => expect(screen.getByText('WO-1003')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('open defects: a search typed on page 2 re-pages to page 1', async () => {
    const user = userEvent.setup();
    const defects = Array.from({ length: 30 }, (_, i) => ({
      id: `def_${i}`,
      vehicleId: 'veh_1',
      dvirId: null,
      category: `Component ${String(i).padStart(2, '0')}`,
      description: `Defect ${i}`,
      severity: 'MAJOR',
      status: 'OPEN',
      outOfService: false,
      createdAt: new Date().toISOString(),
    }));
    server.use(
      http.get(url(endpoints.defects.list), ({ request }) => {
        const p = new URL(request.url).searchParams;
        const page = Math.max(1, Number(p.get('page') ?? 1));
        const limit = Math.max(1, Number(p.get('limit') ?? 25));
        return ok({
          items: defects.slice((page - 1) * limit, page * limit),
          page,
          limit,
          total: defects.length,
          totalPages: Math.max(1, Math.ceil(defects.length / limit)),
        });
      }),
    );
    renderPage('/dvir?tab=defects');

    await user.click(await screen.findByRole('button', { name: '2' }));
    expect(await screen.findByText('Component 10')).toBeInTheDocument();

    // `/defects` has no `q` (B-66) — the search switches to the in-memory window, where page 2 of
    // a single-row result would otherwise show nothing under a "page 2" pager.
    await user.type(screen.getByPlaceholderText('Search unit, defect…'), 'Component 03');
    await waitFor(() => expect(screen.getByText('Component 03')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('error: renders <ErrorState> with Retry when the list fails', async () => {
    server.use(
      http.get(url(endpoints.dvir.list), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
