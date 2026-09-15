// web/tz.md §10 W-12 Reports · IFTA — acceptance, RBAC (§12.2), states (§13), async generation.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { ReactElement } from 'react';
import { http } from 'msw';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { iftaSummaryFixture, reportScreenHandlers } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import type { AuthContextValue } from '@/shared/auth/AuthProvider';
import type { Role } from '@/shared/auth/permissions';
import { ToastProvider } from '@/shared/ui/Toast';
import IftaReportPage from './IftaReportPage';
import { ApiError } from '@/shared/api/errors';
import { quarterLabel, quarterOf, refusalText, todayKey } from './reportMeta';
import { resetAnnouncedReports } from './useReportJobs';

const mocks = vi.hoisted(() => ({
  role: 'FLEET_MANAGER' as string,
  overrides: {} as Record<string, unknown>,
  room: null as string | null,
  handlers: {} as Record<string, (payload: unknown) => void>,
}));

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return {
    ...actual,
    useAuth: () => buildMockAuthContext(mocks.role as Role, mocks.overrides as Partial<AuthContextValue>),
  };
});
vi.mock('@/shared/realtime/useRoom', () => ({
  useRoom: (room: string | null, handlers: Record<string, (payload: unknown) => void>) => {
    mocks.room = room;
    mocks.handlers = handlers ?? {};
    return { joined: true };
  },
}));

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

const cardOf = (title: string) => screen.getByText(title).closest('.rounded-lg') as HTMLElement;
const ROUTE = '/reports/ifta?quarter=2026-Q3';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(...reportScreenHandlers);
  mocks.role = 'FLEET_MANAGER';
  mocks.overrides = {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  resetAnnouncedReports();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('W-12 Reports · IFTA', () => {
  it('renders the drawn toolbar, KPI row, both cards and the six library entries', async () => {
    renderPage(<IftaReportPage />, ROUTE);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeInTheDocument();
    expect(screen.getByText('Miles by jurisdiction')).toBeInTheDocument();
    expect(screen.getByText('Q3 2026 · IFTA-ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download IFTA PDF' })).toBeInTheDocument();
    await screen.findByRole('row', { name: /Ohio/ });
    // Labels appear once as KPI and (for `Total miles`) again as a column header.
    for (const label of ['Total miles', 'Taxable miles', 'Fuel purchased', 'Fleet MPG']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText('Could not load jurisdiction totals')).toBeNull();

    const library = within(cardOf('Report library'));
    const entries: [string, string][] = [
      ['IFTA mileage report', 'Quarterly fuel tax by jurisdiction'],
      ['FMCSA / DOT audit pack', 'Logs, DVIRs and unassigned driving'],
      ['Activity report', 'Duty status totals per driver'],
      ['DVIR report', 'Inspections and defect history'],
      ['Driver logs (RODS)', 'Printable 8-day log sheets'],
      ['Idle & fuel report', 'Idle time, fuel burn and MPG'],
    ];
    for (const [name, description] of entries) {
      expect(library.getByText(name)).toBeInTheDocument();
      expect(library.getByText(description)).toBeInTheDocument();
    }
    expect(mocks.room).toBe('user:usr_fleet_manager');
  });

  describe('B-46 · GET /reports/ifta/summary', () => {
    const kpiCard = (label: string) =>
      screen.getAllByText(label).map((el) => el.closest('.rounded-lg') as HTMLElement).find((card) => !card.querySelector('table')) as HTMLElement;

    it('asks for the selected quarter and fills the KPI row with its chips', async () => {
      let quarter: string | null = null;
      server.use(
        http.get(url(endpoints.reports.iftaSummary), ({ request }) => {
          quarter = new URL(request.url).searchParams.get('quarter');
          return ok({ ...iftaSummaryFixture, quarter: '2026-Q2' });
        }),
      );
      renderPage(<IftaReportPage />, '/reports/ifta?quarter=2026-Q2');
      await screen.findByRole('row', { name: /Ohio/ });
      expect(quarter).toBe('2026-Q2');
      expect(within(kpiCard('Total miles')).getByText('314,560')).toBeInTheDocument();
      // `Qn to date` only for the current quarter.
      expect(within(kpiCard('Total miles')).queryByText(/to date/)).toBeNull();
      expect(within(kpiCard('Taxable miles')).getByText('300,170')).toBeInTheDocument();
      expect(within(kpiCard('Taxable miles')).getByText('95.4%')).toBeInTheDocument();
      expect(within(kpiCard('Fuel purchased')).getByText('47,900 gal')).toBeInTheDocument();
      expect(within(kpiCard('Fuel purchased')).getByText('1,842 receipts')).toBeInTheDocument();
      expect(within(kpiCard('Fleet MPG')).getByText('6.6')).toBeInTheDocument();
      expect(within(kpiCard('Fleet MPG')).getByText('↑ 0.2 vs Q1')).toBeInTheDocument();
    });

    it('renders the drawn columns right-aligned and tabular, and the totals row last', async () => {
      renderPage(<IftaReportPage />, ROUTE);
      const ohio = await screen.findByRole('row', { name: /Ohio/ });
      const table = ohio.closest('table') as HTMLTableElement;
      expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
        'Jurisdiction', 'Total miles', 'Taxable miles', 'Fuel (gal)', 'MPG', 'Tax due',
      ]);
      const cells = within(ohio).getAllByRole('cell');
      expect(cells.map((td) => td.textContent)).toEqual(['Ohio', '96,420', '92,110', '14,980', '6.4', '$2,184.30']);
      for (const td of cells.slice(1)) expect(td).toHaveClass('tabular', 'text-right');
      const rows = within(table).getAllByRole('row');
      const total = rows[rows.length - 1] as HTMLElement;
      expect(within(total).getAllByRole('cell').map((td) => td.textContent)).toEqual([
        'Total', '314,560', '300,170', '47,900', '6.6', '$7,296.80',
      ]);
      expect(total).toHaveClass('bg-bg-subtle', 'font-semibold');
    });

    it('renders null fuel, MPG and tax as the empty dash — never 0 — and drops their chips', async () => {
      server.use(
        http.get(url(endpoints.reports.iftaSummary), () =>
          ok({
            ...iftaSummaryFixture,
            kpis: { ...iftaSummaryFixture.kpis, taxablePct: null, fuelGal: null, receiptCount: null, fleetMpg: null, fleetMpgPrev: 6.4 },
            rows: [{ jurisdiction: 'Ohio', totalMiles: 96_420, taxableMiles: 92_110, fuelGal: null, mpg: null, taxDueUsd: null }],
            totals: { totalMiles: 96_420, taxableMiles: 92_110, fuelGal: null, mpg: null, taxDueUsd: null },
          }),
        ),
      );
      renderPage(<IftaReportPage />, ROUTE);
      const ohio = await screen.findByRole('row', { name: /Ohio/ });
      expect(within(ohio).getAllByRole('cell').map((td) => td.textContent)).toEqual(['Ohio', '96,420', '92,110', '—', '—', '—']);
      expect(within(ohio).getAllByText('—')[0]).toHaveClass('text-text-muted');
      expect(within(kpiCard('Fuel purchased')).getByText('—')).toBeInTheDocument();
      expect(within(kpiCard('Fuel purchased')).queryByText(/receipts/)).toBeNull();
      expect(within(kpiCard('Fleet MPG')).getByText('—')).toBeInTheDocument();
      expect(within(kpiCard('Fleet MPG')).queryByText(/vs Q/)).toBeNull();
      expect(within(kpiCard('Taxable miles')).queryByText(/%/)).toBeNull();
      expect(screen.queryByText('0 gal')).toBeNull();
    });

    it('marks a falling fleet MPG with the danger arrow', async () => {
      server.use(
        http.get(url(endpoints.reports.iftaSummary), () =>
          ok({ ...iftaSummaryFixture, kpis: { ...iftaSummaryFixture.kpis, fleetMpg: 6.1, fleetMpgPrev: 6.4 } }),
        ),
      );
      renderPage(<IftaReportPage />, ROUTE);
      await screen.findByRole('row', { name: /Ohio/ });
      expect(within(kpiCard('Fleet MPG')).getByText('↓ 0.3 vs Q2')).toBeInTheDocument();
    });

    it('shows skeletons while loading, not the error state', () => {
      server.use(http.get(url(endpoints.reports.iftaSummary), () => new Promise(() => undefined)));
      renderPage(<IftaReportPage />, ROUTE);
      expect(screen.queryByText('Fleet MPG')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByText('Could not load jurisdiction totals')).toBeNull();
    });

    it('shows the empty state when the quarter has no jurisdiction rows', async () => {
      server.use(
        http.get(url(endpoints.reports.iftaSummary), () =>
          ok({ ...iftaSummaryFixture, rows: [], totals: { totalMiles: 0, taxableMiles: 0, fuelGal: null, mpg: null, taxDueUsd: null } }),
        ),
      );
      renderPage(<IftaReportPage />, ROUTE);
      expect(await screen.findByText('No jurisdiction miles for this quarter')).toBeInTheDocument();
      expect(screen.queryByText('Could not load jurisdiction totals')).toBeNull();
    });

    it('renders the error inside the jurisdiction card only when the request fails, with Retry', async () => {
      let calls = 0;
      server.use(
        http.get(url(endpoints.reports.iftaSummary), () => {
          calls += 1;
          // Not a 5xx: the client retries GETs on 5xx (§6.2 rule 7), which would hide the first failure.
          return calls === 1 ? fail(409, 'IFTA_SUMMARY_UNAVAILABLE', 'IFTA summary failed.') : ok(iftaSummaryFixture);
        }),
      );
      renderPage(<IftaReportPage />, ROUTE);
      const title = await screen.findByText('Could not load jurisdiction totals');
      const card = title.closest('.rounded-lg') as HTMLElement;
      expect(within(card).getByText('Miles by jurisdiction')).toBeInTheDocument();
      expect(within(kpiCard('Fleet MPG')).getByText('—')).toBeInTheDocument();
      expect(screen.getByText('Report library')).toBeInTheDocument();
      await userEvent.click(within(card).getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('row', { name: /Ohio/ })).toBeInTheDocument();
    });
  });

  it('lists recently generated reports with period, requester, carrier-zone time and download', async () => {
    renderPage(<IftaReportPage />, ROUTE);
    expect(screen.getByText('Kept for 24 months')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule a report' })).toBeInTheDocument();
    const row = await screen.findByRole('row', { name: /IFTA mileage report/ });
    expect(within(row).getByText('Q2 2026')).toBeInTheDocument();
    expect(within(row).getByText('Mike Torres')).toBeInTheDocument();
    expect(within(row).getByText('Jul 03, 2026 09:12')).toBeInTheDocument();
    expect(within(row).getByText('CSV')).toBeInTheDocument();
    expect(within(row).getByText('Ready')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Download IFTA mileage report' }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
  });

  it('follows a queued job to READY and announces it with the Report ready toast', async () => {
    renderPage(<IftaReportPage />, ROUTE);
    const row = await screen.findByRole('row', { name: /FMCSA audit pack/ });
    expect(within(row).getByText('Jun 01 – Jun 30, 2026')).toBeInTheDocument();
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect((await screen.findAllByText('Report ready')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('FMCSA audit pack · 2.4 MB')).length).toBeGreaterThan(0);
    await waitFor(() => expect(within(row).getByText('Ready')).toBeInTheDocument());

    // Poll-fallback path: the same toast carries `Download` and requests this report's file.
    const downloads: string[] = [];
    server.use(
      http.get(url(endpoints.reports.download(':id')), ({ params }) => {
        downloads.push(String(params.id));
        return ok({ downloadUrl: 'http://127.0.0.1:19000/onebook-dev/reports/pack.pdf', expiresAt: '2026-09-19T00:00:00.000Z', fileName: 'pack.pdf' });
      }),
    );
    const [action] = await screen.findAllByRole('button', { name: /^Download( FMCSA audit pack)?$/ });
    await userEvent.click(action as HTMLElement);
    await waitFor(() => expect(downloads).toEqual(['rpt_queued']));
  });

  it('turns report.ready on user:{id} into the Report ready toast', async () => {
    server.use(http.get(url(endpoints.reports.list), () => ok({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 })));
    renderPage(<IftaReportPage />, ROUTE);
    await screen.findByText('No reports generated yet');
    const downloads: string[] = [];
    server.use(
      http.get(url(endpoints.reports.download(':id')), ({ params }) => {
        downloads.push(String(params.id));
        return ok({ downloadUrl: 'http://127.0.0.1:19000/onebook-dev/reports/rpt_ready.csv', expiresAt: '2026-09-19T00:00:00.000Z', fileName: 'rpt_ready.csv' });
      }),
    );
    act(() => mocks.handlers['report.ready']?.({ reportId: 'rpt_ready', type: 'IFTA', status: 'READY' }));
    expect((await screen.findAllByText('IFTA mileage report · 2.4 MB')).length).toBeGreaterThan(0);
    // §13.3 — the toast carries `Download`, and activating it requests the presigned download.
    const action = await screen.findByRole('button', { name: /^Download( IFTA mileage report)?$/ });
    await userEvent.click(action);
    await waitFor(() => expect(downloads).toEqual(['rpt_ready']));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('removes Generate report, Schedule a report and Download IFTA PDF for VIEWER, keeps Export CSV', async () => {
    mocks.role = 'VIEWER';
    renderPage(<IftaReportPage />, ROUTE);
    await screen.findByRole('row', { name: /IFTA mileage report/ });
    expect(screen.queryByRole('button', { name: 'Generate report' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Schedule a report' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download IFTA PDF' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    // reportsTransfer NONE — the pack entry is absent, not disabled.
    expect(within(cardOf('Report library')).queryByText('FMCSA / DOT audit pack')).toBeNull();
  });

  it.each(['FLEET_MANAGER', 'VIEWER'])('shows the §13.2 empty state verbatim (%s)', async (role) => {
    mocks.role = role;
    server.use(http.get(url(endpoints.reports.list), () => ok({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 })));
    renderPage(<IftaReportPage />, ROUTE);
    expect(await screen.findByText('No reports generated yet')).toBeInTheDocument();
    expect(screen.getByText('Generated reports are kept for 24 months.')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Generate report' })).toHaveLength(role === 'VIEWER' ? 0 : 2);
  });

  it('renders the error inside the Recently generated card only', async () => {
    server.use(http.get(url(endpoints.reports.list), () => fail(404, 'NOT_FOUND', 'Not found')));
    renderPage(<IftaReportPage />, ROUTE);
    expect(await screen.findByText('Could not load reports')).toBeInTheDocument();
    expect(within(cardOf('Recently generated')).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText('Report library')).toBeInTheDocument();
  });

  it('queues the IFTA CSV with the quarter and shows a refusal verbatim', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(url(endpoints.reports.generate), async ({ request }) => {
        const body = (await request.json()) as { format: string };
        bodies.push(body);
        return body.format === 'PDF'
          ? fail(422, 'VALIDATION_FAILED', 'IFTA reports are generated as CSV in this version (streaming export, TZ §15).')
          : ok({ reportId: 'rpt_generated', status: 'QUEUED' }, 202);
      }),
    );
    renderPage(<IftaReportPage />, ROUTE);
    await userEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    await waitFor(() => expect(bodies).toEqual([{ type: 'IFTA', format: 'CSV', params: { quarter: '2026-Q3' } }]));

    await userEvent.click(screen.getByRole('button', { name: 'Download IFTA PDF' }));
    expect(
      await screen.findByText('IFTA reports are generated as CSV in this version (streaming export, TZ §15).'),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(2);
  });

  it('Export CSV queues through the READ shortcut and saves the file once READY', async () => {
    let quarter: string | null = null;
    server.use(
      http.get(url(endpoints.reports.ifta), ({ request }) => {
        quarter = new URL(request.url).searchParams.get('quarter');
        return ok({ reportId: 'rpt_export_ifta', status: 'QUEUED' }, 202);
      }),
    );
    renderPage(<IftaReportPage />, ROUTE);
    await screen.findByRole('row', { name: /IFTA mileage report/ });
    vi.mocked(HTMLAnchorElement.prototype.click).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));
    expect(quarter).toBe('2026-Q3');
  });

  it('shows a refused download in place', async () => {
    server.use(http.get(url(endpoints.reports.download(':id')), () => fail(409, 'REPORT_NOT_READY', 'Report is not ready for download yet.')));
    renderPage(<IftaReportPage />, ROUTE);
    const row = await screen.findByRole('row', { name: /IFTA mileage report/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Download IFTA mileage report' }));
    const alert = (await screen.findByText('The report is still being generated.')).closest('[role="alert"]') as HTMLElement;
    // Toasts carry their own "Dismiss"; this is the in-place alert's.
    await userEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('The report is still being generated.')).toBeNull();
  });

  it('opens the Activity report for Driver logs (RODS) and keeps Idle & fuel inert (B-14)', async () => {
    renderPage(<IftaReportPage />, ROUTE);
    const library = within(cardOf('Report library'));
    const idle = library.getByText('Idle & fuel report').closest('button') as HTMLButtonElement;
    expect(idle).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(idle);
    expect(screen.getByTestId('location')).toHaveTextContent(ROUTE);
    await userEvent.click(library.getByText('Driver logs (RODS)'));
    expect(screen.getByTestId('location')).toHaveTextContent('/reports/activity');
  });

  it('falls back to the current carrier-zone quarter for a malformed ?quarter=', () => {
    renderPage(<IftaReportPage />, '/reports/ifta?quarter=bogus');
    const current = quarterLabel(quarterOf(todayKey('America/New_York')));
    expect(screen.getByText(`${current} · IFTA-ready`)).toBeInTheDocument();
  });

  it('schedules a report by email only, validating the recipients', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(url(endpoints.reports.schedules), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ id: 'sch_1' }, 201);
      }),
    );
    renderPage(<IftaReportPage />, ROUTE);
    await userEvent.click(screen.getByRole('button', { name: 'Schedule a report' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('IFTA mileage report · delivered by email')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();

    const input = within(dialog).getByRole('textbox');
    await userEvent.type(input, 'ops@universal-logistics.example, nope');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    expect(await within(dialog).findByText('Enter a valid email address.')).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'ops@universal-logistics.example, safety@universal-logistics.example');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(body).toEqual({
      reportType: 'IFTA',
      format: 'CSV',
      params: { quarter: '2026-Q3' },
      cron: '0 6 * * 1',
      timezone: 'America/New_York',
      recipients: ['ops@universal-logistics.example', 'safety@universal-logistics.example'],
      enabled: true,
    });
  });

  it('confirms before discarding a dirty schedule, and shows a refusal in the modal', async () => {
    server.use(http.post(url(endpoints.reports.schedules), () => fail(422, 'INVALID_CRON_EXPRESSION', '"0 6 * * 1" is not a valid 5-field cron expression.')));
    renderPage(<IftaReportPage />, ROUTE);
    await userEvent.click(screen.getByRole('button', { name: 'Schedule a report' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'ops@universal-logistics.example');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    // Same rule as every refusal: a mapped code shows its §14.3 sentence, otherwise the server's.
    const expected = refusalText(
      new ApiError(422, { code: 'INVALID_CRON_EXPRESSION', message: '"0 6 * * 1" is not a valid 5-field cron expression.' }),
    );
    expect(await within(dialog).findByText(expected)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
