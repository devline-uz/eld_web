// web/tz.md §10 W-10 — smoke test: KPI row, safety-events empty state verbatim, and the
// RBAC-gated `Assign coaching` control, and the Events / Coaching / Scorecards tabs.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import SafetyPage from './SafetyPage';

let mockCan = (_key: string, _level?: 'READ' | 'FULL') => true;
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: (k: string, l?: 'READ' | 'FULL') => mockCan(k, l) }) }));
vi.mock('@/shared/auth/Can', () => ({
  Can: ({ perm, level, children }: { perm: string; level?: 'READ' | 'FULL'; children: React.ReactNode }) =>
    mockCan(perm, level) ? children : null,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <SafetyPage />
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

describe('SafetyPage', () => {
  it('renders the header and KPI row', async () => {
    renderPage();
    expect(await screen.findByText('Safety')).toBeInTheDocument();
    expect(await screen.findByText('Fleet safety score')).toBeInTheDocument();
    expect(await screen.findByText('Harsh events')).toBeInTheDocument();
    expect(await screen.findByText('Speeding events')).toBeInTheDocument();
    expect(await screen.findByText('Coaching sessions')).toBeInTheDocument();
  });

  it('shows the safety empty-state copy verbatim when there are no events', async () => {
    server.use(
      http.get(url(endpoints.safety.events), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })),
      http.get(url(endpoints.safety.scorecard), () => ok({ items: [], periodStart: '2026-08-12', periodEnd: '2026-09-11' })),
    );
    renderPage();
    expect((await screen.findAllByText('No safety events')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Harsh braking, acceleration and speeding events appear here as they are detected.').length).toBeGreaterThan(0);
  });

  it('removes `Assign coaching` without safety FULL', async () => {
    mockCan = (key, level) => !(key === 'safety' && level === 'FULL');
    renderPage();
    await screen.findByText('Safety');
    expect(screen.queryByRole('button', { name: 'Assign coaching' })).not.toBeInTheDocument();
  });

  it('shows `Assign coaching` with safety FULL', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Assign coaching' })).toBeInTheDocument();
  });

  // Regression — `onLimitChange` used to be `setLimit` alone, so raising `Rows per page` while on
  // page 3 kept page 3: the client-side slice ran past the end and the table body went blank.
  it('resets to page 1 when rows-per-page changes', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 35 }, (_, i) => ({
      id: `evt_${i}`,
      type: 'SPEEDING',
      status: 'NEW',
      occurredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      vehicleId: 'veh_1',
      driverId: null,
      speedMph: 70 + i,
      speedLimitMph: 65,
      locationName: 'I-80',
    }));
    server.use(
      http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 35, totalPages: 1 })),
    );
    renderPage();

    await user.click(await screen.findByRole('button', { name: '4' }));
    // Header + the 5 rows left over on page 4 of 10-row pages.
    const rows = () => within(screen.getByRole('table', { name: 'Safety events' })).getAllByRole('row');
    expect(rows()).toHaveLength(6);

    await user.selectOptions(screen.getByLabelText('Rows per page:'), '100');
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(rows()).toHaveLength(36);
  });

  // Regression — the drawer filters live in the URL and never reset the page, so narrowing the
  // result set from page 4 left the table body empty with Pagination still on page 4.
  it('clamps the page when a filter shrinks the result set', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 35 }, (_, i) => ({
      id: `evt_${i}`,
      // Only 3 rows survive the `type=SEATBELT` filter below.
      type: i < 3 ? 'SEATBELT' : 'SPEEDING',
      status: 'NEW',
      occurredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      vehicleId: 'veh_1',
      driverId: null,
      locationName: 'I-80',
    }));
    server.use(
      http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 35, totalPages: 1 })),
    );
    renderPage();

    await user.click(await screen.findByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    await user.click(await screen.findByLabelText('Seatbelt'));
    await user.click(screen.getByRole('button', { name: /Apply 1 filters/ }));

    // Header + the 3 surviving rows — before the clamp this table body was empty on page 4.
    const eventsTable = await screen.findByRole('table', { name: 'Safety events' });
    expect(within(eventsTable).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
  });

  describe('tabs', () => {
    const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const items = [
      { id: 'evt_new', type: 'SPEEDING', status: 'NEW', occurredAt: hourAgo(), vehicleId: 'veh_1', driverId: null, locationName: 'I-80', coachedAt: null, coachingNote: null },
      { id: 'evt_coached', type: 'HARSH_BRAKING', status: 'COACHED', occurredAt: hourAgo(), vehicleId: 'veh_1', driverId: null, locationName: 'I-75', coachedAt: hourAgo(), coachingNote: 'Keep distance' },
      // Outside the 30-day window — must not count towards `Events`.
      { id: 'evt_old', type: 'SPEEDING', status: 'NEW', occurredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), vehicleId: 'veh_1', driverId: null, locationName: 'I-10', coachedAt: null, coachingNote: null },
    ];

    it('defaults to Events and counts the 30-day window, not the server total', async () => {
      server.use(http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 17440, totalPages: 1 })));
      renderPage();
      const events = await screen.findByRole('tab', { name: /^Events/ });
      expect(events).toHaveAttribute('aria-selected', 'true');
      await within(events).findByText('2');
      expect(within(screen.getByRole('tab', { name: /^Coaching/ })).getByText('1')).toBeInTheDocument();
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'safety-tab-events');
      expect(await screen.findByText('2 events · 1 need review')).toBeInTheDocument();
    });

    it('switches to Coaching on click and lists only coached events', async () => {
      const user = userEvent.setup();
      server.use(http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 3, totalPages: 1 })));
      renderPage();
      await user.click(await screen.findByRole('tab', { name: /^Coaching/ }));
      expect(screen.getByRole('tab', { name: /^Coaching/ })).toHaveAttribute('aria-selected', 'true');
      const table = await screen.findByRole('table', { name: 'Coaching sessions' });
      expect(within(table).getAllByRole('row')).toHaveLength(2);
      expect(within(table).getByText('Keep distance')).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: 'Safety events' })).not.toBeInTheDocument();
    });

    it('moves between tabs with the arrow keys', async () => {
      const user = userEvent.setup();
      renderPage();
      const events = await screen.findByRole('tab', { name: /^Events/ });
      events.focus();
      await user.keyboard('{ArrowLeft}');
      const scorecards = screen.getByRole('tab', { name: /^Scorecards/ });
      expect(scorecards).toHaveAttribute('aria-selected', 'true');
      expect(scorecards).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /^Events/ })).toHaveFocus();
    });

    it('shows the scorecard empty state on the Scorecards tab', async () => {
      const user = userEvent.setup();
      server.use(http.get(url(endpoints.safety.scorecard), () => ok({ items: [], periodStart: '2026-08-12', periodEnd: '2026-09-11' })));
      renderPage();
      await user.click(await screen.findByRole('tab', { name: /^Scorecards/ }));
      expect(await screen.findByText('No scorecards yet')).toBeInTheDocument();
      expect(screen.queryByText('Harsh events')).not.toBeInTheDocument();
    });
  });

  it('error: renders <ErrorState> with Retry when the list fails', async () => {
    server.use(
      http.get(url(endpoints.safety.events), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
