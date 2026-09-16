// web/tz.md §10 W-13 Reports · Activity — one summary request (B-46, WB-048), RBAC, states.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { ReactElement } from 'react';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { activitySummaryFixture, reportScreenHandlers } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import type { Role } from '@/shared/auth/permissions';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { ToastProvider } from '@/shared/ui/Toast';
import ActivityReportPage from './ActivityReportPage';
import { resetAnnouncedReports } from './useReportJobs';

const mocks = vi.hoisted(() => ({ role: 'FLEET_MANAGER' as string }));

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext(mocks.role as Role) };
});
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: true }) }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderPage(ui: ReactElement, route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          {ui}
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const ROUTE = '/reports/activity?from=2026-09-01&to=2026-09-12';
const kpi = (label: string) => within(screen.getAllByText(label)[0]!.closest('.rounded-lg') as HTMLElement);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(...reportScreenHandlers);
  mocks.role = 'FLEET_MANAGER';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  resetAnnouncedReports();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('W-13 Reports · Activity report', () => {
  it('renders the summary rows in the drawn columns without any per-driver range request', async () => {
    const ranges: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (/\/logs\/[^/]+\/range/.test(request.url)) ranges.push(request.url);
    });
    renderPage(<ActivityReportPage />, ROUTE);
    const smith = await screen.findByRole('row', { name: /John Smith/ });
    for (const text of ['2', '28:00', '00:00', '17:00', '03:00', '850 mi', '1', '1 / 2']) {
      expect(within(smith).getByText(text)).toBeInTheDocument();
    }
    expect(within(smith).getByText('1 / 2')).toHaveClass('text-warning');
    const bond = screen.getByRole('row', { name: /William Bond/ });
    expect(within(bond).getByText('None')).toBeInTheDocument();
    expect(within(bond).getByText('0 / 0')).toHaveClass('text-success');
    expect(screen.queryByText('Retired Driver')).toBeNull();
    for (const header of ['Driver', 'Days', 'Off', 'SB', 'Driving', 'On', 'Distance', 'Certified']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText('Totals are calculated from certified and uncertified logs')).toBeInTheDocument();
    expect(screen.getByText('2 drivers · showing 2')).toBeInTheDocument();
    expect(ranges).toEqual([]);
    server.events.removeAllListeners('request:start');
  });

  it('asks the server for the page, limit, sort and range, and pages server-side', async () => {
    const requests: Record<string, string>[] = [];
    server.use(
      http.get(url(endpoints.reports.activitySummary), ({ request }) => {
        const search = new URL(request.url).searchParams;
        requests.push(Object.fromEntries(search));
        const body = activitySummaryFixture(search);
        return ok({ ...body, total: 25, totalPages: 3 });
      }),
    );
    renderPage(<ActivityReportPage />, ROUTE);
    await screen.findByRole('row', { name: /John Smith/ });
    expect(requests[0]).toEqual({ from: '2026-09-01', to: '2026-09-12', page: '1', limit: '10', sort: 'name:asc', status: 'ACTIVE' });
    expect(screen.getByText('25 drivers · showing 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(requests.at(-1)).toMatchObject({ page: '2', limit: '10' }));
  });

  it('builds the KPI row from the server kpis; a null vs-prev delta is a dash', async () => {
    renderPage(<ActivityReportPage />, ROUTE);
    await screen.findByRole('row', { name: /John Smith/ });
    expect(kpi('Total driving').getByText('17 h')).toBeInTheDocument();
    expect(kpi('Total driving').getByText('—')).toBeInTheDocument();
    expect(kpi('Total on-duty').getByText('3 h')).toBeInTheDocument();
    expect(kpi('Total on-duty').getByText('15% of total')).toBeInTheDocument();
    expect(kpi('Distance driven').getByText('850 mi')).toBeInTheDocument();
    expect(screen.queryByText(/mi\/day/)).toBeNull();
    expect(kpi('Violations').getByText('1')).toBeInTheDocument();
    expect(kpi('Violations').getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/vs prev\./)).toBeNull();
  });

  it('draws the vs-prev chips the server sends', async () => {
    server.use(
      http.get(url(endpoints.reports.activitySummary), ({ request }) => {
        const body = activitySummaryFixture(new URL(request.url).searchParams);
        return ok({ ...body, kpis: { ...body.kpis, drivingDeltaPct: 6, violationsDelta: -8 } });
      }),
    );
    renderPage(<ActivityReportPage />, ROUTE);
    await screen.findByRole('row', { name: /John Smith/ });
    expect(await kpi('Total driving').findByText('↑ 6% vs prev.')).toBeInTheDocument();
    expect(kpi('Violations').getByText('↓ 8 vs prev.')).toBeInTheDocument();
  });

  it('opens the driver log for the last day of the range', async () => {
    renderPage(<ActivityReportPage />, ROUTE);
    await userEvent.click(await screen.findByRole('button', { name: 'Open logs for John Smith' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/hos-logs?driverId=drv_1&date=2026-09-12');
  });

  it('filters by home terminal from the URL, server-side', async () => {
    let terminal: string | null = null;
    server.use(
      http.get(url(endpoints.reports.activitySummary), ({ request }) => {
        const search = new URL(request.url).searchParams;
        terminal = search.get('terminal');
        return ok(activitySummaryFixture(search));
      }),
    );
    renderPage(<ActivityReportPage />, `${ROUTE}&terminal=Dayton%2C+OH`);
    expect(await screen.findByRole('row', { name: /William Bond/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /John Smith/ })).toBeNull();
    expect(screen.getByText('1 drivers · showing 1')).toBeInTheDocument();
    expect(terminal).toBe('Dayton, OH');
  });

  it.each(['DISPATCHER', 'VIEWER'])('removes Schedule for %s, keeps Export CSV and Print', async (role) => {
    mocks.role = role;
    const print = vi.fn();
    window.print = print;
    renderPage(<ActivityReportPage />, ROUTE);
    await screen.findByRole('row', { name: /John Smith/ });
    expect(screen.queryByRole('button', { name: 'Schedule' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
  });

  it('opens the schedule modal for reports FULL', async () => {
    renderPage(<ActivityReportPage />, ROUTE);
    await userEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('Activity report · delivered by email')).toBeInTheDocument();
  });

  it('exports the range as CSV and shows a worker failure verbatim', async () => {
    let params: Record<string, string> = {};
    server.use(
      http.get(url(endpoints.reports.activity), ({ request }) => {
        params = Object.fromEntries(new URL(request.url).searchParams);
        return ok({ reportId: 'rpt_export_activity', status: 'QUEUED' }, 202);
      }),
      http.get(url(endpoints.reports.detail(':id')), ({ params: p }) =>
        ok({ id: String(p.id), type: 'ACTIVITY', format: 'CSV', params: {}, status: 'FAILED', error: 'Storage is unavailable.' }),
      ),
    );
    renderPage(<ActivityReportPage />, ROUTE);
    await screen.findByRole('row', { name: /John Smith/ });
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('Storage is unavailable.')).toBeInTheDocument();
    expect(params).toEqual({ from: '2026-09-01', to: '2026-09-12' });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Storage is unavailable.')).toBeNull());
  });

  it('renders the refusal inside the table card and dashes in the KPI row', async () => {
    server.use(http.get(url(endpoints.reports.activitySummary), () => fail(422, 'RANGE_TOO_LARGE', 'too large')));
    renderPage(<ActivityReportPage />, ROUTE);
    expect(await screen.findByText('Could not load duty totals')).toBeInTheDocument();
    expect(screen.getByText('The selected range is too large.')).toBeInTheDocument();
    expect(kpi('Total driving').getByText('—')).toBeInTheDocument();
  });

  it('shows the drivers empty state when no driver is active', async () => {
    server.use(
      http.get(url(endpoints.reports.activitySummary), ({ request }) =>
        ok({ ...activitySummaryFixture(new URL(request.url).searchParams), items: [], total: 0, totalPages: 0 }),
      ),
    );
    renderPage(<ActivityReportPage />, ROUTE);
    expect(await screen.findByText(EMPTY_STATE_COPY.drivers.title)).toBeInTheDocument();
  });

  it('renders ForbiddenState for a plain 403', async () => {
    server.use(http.get(url(endpoints.reports.activitySummary), () => fail(403, 'FORBIDDEN', 'Insufficient permission.')));
    renderPage(<ActivityReportPage />, ROUTE);
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });

  it('defaults to month-to-date when the URL has no valid range', async () => {
    renderPage(<ActivityReportPage />, '/reports/activity?from=2026-09-12&to=2026-09-01');
    expect(await screen.findByRole('row', { name: /John Smith/ })).toBeInTheDocument();
  });

  // The server can answer the open page with nothing left on it (drivers deactivated between two
  // requests): the screen must ask for the last page that still has rows, not sit on the empty one.
  it('asks for the last page with rows when the server total shrinks under the open page', async () => {
    const requested: string[] = [];
    let calls = 0;
    server.use(
      http.get(url(endpoints.reports.activitySummary), ({ request }) => {
        const search = new URL(request.url).searchParams;
        requested.push(search.get('page') ?? '');
        calls += 1;
        const body = activitySummaryFixture(search);
        // The first answer has three pages; by the time page 3 is asked for, only one is left.
        if (calls === 1) return ok({ ...body, total: 25, totalPages: 3 });
        return ok({ ...body, items: [], total: 2, totalPages: 1 });
      }),
    );
    renderPage(<ActivityReportPage />, ROUTE);
    await screen.findByRole('row', { name: /John Smith/ });

    await userEvent.click(screen.getByRole('button', { name: '3' }));

    // Page 3 came back empty, so the screen goes back to page 1 — whose rows are still cached —
    // instead of leaving an empty table under `21–2 of 2 drivers`.
    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'));
    expect(screen.getByRole('row', { name: /John Smith/ })).toBeInTheDocument();
    expect(requested).toEqual(['1', '3']);
  });
});
