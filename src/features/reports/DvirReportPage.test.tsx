// web/tz.md §10 W-14 Reports · DVIR report — joined rows, KPI row, RBAC, refusals, states.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { ReactElement } from 'react';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { reportDvirs, reportScreenHandlers } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import type { Role } from '@/shared/auth/permissions';
import { EMPTY_STATE_COPY } from '@/shared/ui/copy';
import { ToastProvider } from '@/shared/ui/Toast';
import DvirReportPage from './DvirReportPage';
import { DVIR_EXPORT_SCOPE, DVIR_WINDOW_NOTE } from './reportMeta';
import { resetAnnouncedReports } from './useReportJobs';

const mocks = vi.hoisted(() => ({ role: 'FLEET_MANAGER' as string }));

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext(mocks.role as Role) };
});
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: true }) }));

function renderPage(ui: ReactElement, route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const ROUTE = '/reports/dvir?from=2026-09-01&to=2026-09-12';
const kpi = (label: string) => within(screen.getByText(label).closest('.rounded-lg') as HTMLElement);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(
    ...reportScreenHandlers,
    http.get(url(endpoints.dvir.compliance), () => ok({ expected: 2, submitted: 2, compliancePct: 100, missing: [] })),
  );
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

describe('W-14 Reports · DVIR report', () => {
  it('joins inspections, defects, units and drivers in the drawn columns (carrier zone)', async () => {
    renderPage(<DvirReportPage />, ROUTE);
    const withDefects = await screen.findByRole('row', { name: /#110/ });
    for (const text of ['Sep 10, 05:12', 'John Smith', 'Pre-trip', 'Brakes · Lights', 'Critical', 'Unassigned', 'Not fixed']) {
      expect(within(withDefects).getByText(text)).toBeInTheDocument();
    }
    expect(within(withDefects).getByText('Unassigned')).toHaveClass('text-warning');
    const clean = screen.getByRole('row', { name: /#101/ });
    for (const text of ['Sep 09, 18:40', 'William Bond', 'Post-trip', 'None', 'Mike Rowan · Shop A', 'No defects']) {
      expect(within(clean).getByText(text)).toBeInTheDocument();
    }
    // `dvir_old` (July) falls outside the range.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    for (const header of ['Date & time', 'Unit', 'Driver', 'Type', 'Defects', 'Severity', 'Corrected by', 'Status']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText('Driver and mechanic signatures are attached to every record')).toBeInTheDocument();
    expect(screen.getByText('2 records · showing 2')).toBeInTheDocument();
  });

  it('computes the KPI row from the rows and the compliance schedule (B-47)', async () => {
    renderPage(<DvirReportPage />, ROUTE);
    await screen.findByRole('row', { name: /#110/ });
    expect(kpi('Inspections submitted').getByText('2')).toBeInTheDocument();
    expect(kpi('Inspections submitted').getByText('100% compliance')).toBeInTheDocument();
    expect(kpi('With defects').getByText('1')).toBeInTheDocument();
    expect(kpi('With defects').getByText('1 critical')).toBeInTheDocument();
    expect(kpi('Average time to fix').getByText('1.0 days')).toBeInTheDocument();
    expect(kpi('Missing pre-trip').getByText('0')).toBeInTheDocument();
  });

  it('B-47 — each missing pre-trip is a Missing / Not submitted row and counts in the KPI', async () => {
    const seen: { query?: URLSearchParams } = {};
    server.use(
      http.get(url(endpoints.dvir.compliance), ({ request }) => {
        seen.query = new URL(request.url).searchParams;
        return ok({
          expected: 4,
          submitted: 2,
          compliancePct: 50,
          missing: [
            { vehicleId: 'veh_101', unitNumber: '101', date: '2026-09-07' },
            { vehicleId: 'veh_101', unitNumber: '101', date: '2026-09-08' },
          ],
        });
      }),
    );
    renderPage(<DvirReportPage />, ROUTE);
    await screen.findByRole('row', { name: /#110/ });
    await waitFor(() => expect(kpi('Missing pre-trip').getByText('2')).toBeInTheDocument());
    expect(seen.query?.get('from')).toBe('2026-09-01');
    expect(seen.query?.get('to')).toBe('2026-09-12');
    expect(kpi('Missing pre-trip').getByText('1 unit')).toBeInTheDocument();
    expect(kpi('Inspections submitted').getByText('50% compliance')).toBeInTheDocument();
    const missing = screen.getByRole('row', { name: /Sep 07, —/ });
    for (const text of ['#101', 'Pre-trip', 'Not submitted', 'Missing']) {
      expect(within(missing).getByText(text)).toBeInTheDocument();
    }
    expect(within(missing).getByText('Not submitted')).toHaveClass('text-warning');
    expect(screen.getByText('4 records · showing 4')).toBeInTheDocument();
  });

  it('filters by defect type and passes the unit filter to the server', async () => {
    let vehicleId: string | null = null;
    server.use(
      http.get(url(endpoints.dvir.list), ({ request }) => {
        vehicleId = new URL(request.url).searchParams.get('vehicleId');
        return ok({ items: [], page: 1, limit: 200, total: 0, totalPages: 0 });
      }),
    );
    renderPage(<DvirReportPage />, `${ROUTE}&unit=veh_101`);
    expect(await screen.findByText(EMPTY_STATE_COPY.dvir.title)).toBeInTheDocument();
    expect(vehicleId).toBe('veh_101');
  });

  it('narrows to one defect type', async () => {
    renderPage(<DvirReportPage />, `${ROUTE}&defect=Brakes`);
    expect(await screen.findByRole('row', { name: /#110/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /#101/ })).toBeNull();
  });

  it('states that the defect filter does not reach the exported file (WB-097)', async () => {
    renderPage(<DvirReportPage />, `${ROUTE}&defect=Brakes`);
    await screen.findByRole('row', { name: /#110/ });
    expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveAccessibleDescription(DVIR_EXPORT_SCOPE);
  });

  it('adds no export note without a defect filter', async () => {
    renderPage(<DvirReportPage />, ROUTE);
    await screen.findByRole('row', { name: /#110/ });
    expect(screen.queryByText(DVIR_EXPORT_SCOPE)).toBeNull();
  });

  it('labels the counts as a lower bound when the DVIR walk is capped before `from` (WB-096)', async () => {
    const recent = { ...reportDvirs[0]!, submittedAt: '2026-09-11T12:00:00.000Z' };
    server.use(
      // Every page is full and still newer than `from`, so the walk hits DVIR_REPORT_MAX_PAGES.
      http.get(url(endpoints.dvir.list), ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        const items = Array.from({ length: 200 }, (_, i) => ({ ...recent, id: `dvir_${page}_${i}` }));
        return ok({ items, page, limit: 200, total: 10_000, totalPages: 50 });
      }),
    );
    renderPage(<DvirReportPage />, ROUTE);
    expect(await screen.findByText(DVIR_WINDOW_NOTE)).toBeInTheDocument();
    expect(screen.getByText('2,000+ records · showing 10')).toBeInTheDocument();
  });

  it('removes Schedule for VIEWER (reports FULL) but keeps Export CSV and Download PDF (B-96, READ shortcut)', async () => {
    mocks.role = 'VIEWER';
    renderPage(<DvirReportPage />, ROUTE);
    await screen.findByRole('row', { name: /#110/ });
    expect(screen.queryByRole('button', { name: 'Schedule' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('shows the Download PDF refusal verbatim and exports the CSV through the shortcut', async () => {
    let exported: Record<string, string> = {};
    let pdfParams: Record<string, string> = {};
    server.use(
      http.get(url(endpoints.reports.dvir), ({ request }) => {
        const params = Object.fromEntries(new URL(request.url).searchParams);
        if (params.format === 'PDF') {
          pdfParams = params;
          return fail(422, 'VALIDATION_FAILED', 'DVIR reports are generated as CSV in this version (streaming export, TZ §15).');
        }
        exported = params;
        return ok({ reportId: 'rpt_export_dvir', status: 'QUEUED' }, 202);
      }),
    );
    renderPage(<DvirReportPage />, `${ROUTE}&unit=veh_110`);
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(
      await screen.findByText('DVIR reports are generated as CSV in this version (streaming export, TZ §15).'),
    ).toBeInTheDocument();
    expect(pdfParams).toEqual({ from: '2026-09-01', to: '2026-09-12', vehicleId: 'veh_110', format: 'PDF' });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
    expect(exported).toEqual({ from: '2026-09-01', to: '2026-09-12', vehicleId: 'veh_110' });
  });

  it('opens the schedule modal for reports FULL', async () => {
    renderPage(<DvirReportPage />, ROUTE);
    await userEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('DVIR report · delivered by email')).toBeInTheDocument();
  });

  it('renders the error in the card for a failed list and ForbiddenState for a 403', async () => {
    server.use(http.get(url(endpoints.dvir.list), () => fail(404, 'NOT_FOUND', 'Not found')));
    const { unmount } = renderPage(<DvirReportPage />, ROUTE);
    expect(await screen.findByText('Could not load inspections')).toBeInTheDocument();
    expect(kpi('Inspections submitted').getByText('—')).toBeInTheDocument();
    unmount();

    server.use(http.get(url(endpoints.dvir.list), () => fail(403, 'FORBIDDEN', 'Insufficient permission.')));
    renderPage(<DvirReportPage />, ROUTE);
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });

  // Rows are paged client-side: a refetch that returns fewer inspections must not leave the open
  // page past the last one, with an empty table and `11–3 of 3` under it.
  it('steps back to the last page with rows when the inspection list shrinks', async () => {
    let rowCount = 15;
    server.use(
      http.get(url(endpoints.dvir.list), () => {
        const items = Array.from({ length: rowCount }, (_, i) => ({ ...reportDvirs[0], id: `dvir_${i}` }));
        return ok({ items, page: 1, limit: 200, total: items.length, totalPages: 1 });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <MemoryRouter initialEntries={[ROUTE]}>
            <DvirReportPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('15 records · showing 10')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('11–15 of 15 inspections')).toBeInTheDocument();

    rowCount = 3;
    void client.invalidateQueries();
    await waitFor(() => expect(screen.getByText('3 records · showing 3')).toBeInTheDocument());
    expect(screen.getByText('1–3 of 3 inspections')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
  });
});
