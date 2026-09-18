// ⭐ web/tz.md §10 W-15 Reports · FMCSA / DOT audit pack — acceptance list, test mode, transfers, RBAC.
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
import { reportScreenHandlers } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import type { AuthContextValue } from '@/shared/auth/AuthProvider';
import type { Role } from '@/shared/auth/permissions';
import { ToastProvider } from '@/shared/ui/Toast';
import { ROLE_PERMISSIONS } from '../../../tests/fixtures/rolePermissions';
import FmcsaPackPage from './FmcsaPackPage';
import { resetAnnouncedReports } from './useReportJobs';

const mocks = vi.hoisted(() => ({ role: 'FLEET_MANAGER' as string, overrides: {} as Record<string, unknown> }));

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return {
    ...actual,
    useAuth: () => buildMockAuthContext(mocks.role as Role, mocks.overrides as Partial<AuthContextValue>),
  };
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

const ROUTE = '/reports/fmcsa?from=2026-09-01&to=2026-09-12';
const kpi = (label: string) => within(screen.getByText(label).closest('.rounded-lg') as HTMLElement);
const card = (title: string) => within(screen.getByText(title).closest('.rounded-lg') as HTMLElement);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(...reportScreenHandlers);
  mocks.role = 'FLEET_MANAGER';
  mocks.overrides = {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:csv'), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  resetAnnouncedReports();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('W-15 Reports · FMCSA / DOT audit pack', () => {
  it('builds the KPI row from one summary request (no per-driver ranges), DVIRs and pending unassigned segments', async () => {
    const ranges: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (/\/logs\/[^/]+\/range/.test(request.url)) ranges.push(request.url);
    });
    renderPage(<FmcsaPackPage />, ROUTE);
    // dailyLogs = Σ days (2 + 0); uncertified over Sep 01–12 = 12 − 1 certified (drv_1) + 12 − 0 (drv_2).
    await waitFor(() => expect(kpi('Daily logs included').getByText('2')).toBeInTheDocument());
    expect(kpi('Daily logs included').getByText('2 drivers')).toBeInTheDocument();
    expect(kpi('DVIRs included').getByText('2')).toBeInTheDocument();
    expect(kpi('DVIRs included').getByText('1 with defects')).toBeInTheDocument();
    expect(kpi('Unassigned segments').getByText('3')).toBeInTheDocument();
    expect(kpi('Unassigned segments').getByText('must be resolved')).toBeInTheDocument();
    expect(kpi('Uncertified logs').getByText('23')).toBeInTheDocument();
    expect(kpi('Uncertified logs').getByText('2 drivers')).toBeInTheDocument();
    expect(ranges).toEqual([]);
    server.events.removeAllListeners('request:start');
  });

  it('reads only the picked driver\'s range when one driver is selected', async () => {
    const ranges: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (/\/logs\/[^/]+\/range/.test(request.url)) ranges.push(request.url);
    });
    renderPage(<FmcsaPackPage />, `${ROUTE}&driver=drv_1`);
    await waitFor(() => expect(kpi('Daily logs included').getByText('3')).toBeInTheDocument());
    // WB-095 — the same count the fleet view shows for drv_1 and the backend's pre-send check:
    // 12 days in range − 1 certified = 11, not the 2 persisted-but-uncertified logs.
    expect(kpi('Uncertified logs').getByText('11')).toBeInTheDocument();
    expect(new Set(ranges.map((u) => new URL(u).pathname))).toEqual(new Set(['/api/logs/drv_1/range']));
    server.events.removeAllListeners('request:start');
  });

  it('⬜ lists the six pack contents with the exact text and checked state', () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    expect(screen.getByText('FMCSA 49 CFR §395.8 output file format')).toBeInTheDocument();
    const rows: [string, string, boolean][] = [
      ['Records of duty status (RODS)', 'Graph grid + event list for every driver and day', true],
      ['Unidentified driving records', 'All unassigned segments and their resolution', true],
      ['Driver log edits and annotations', 'Original value, edited value, reason and approver', true],
      ['Vehicle and ELD identification', 'VIN, unit number, ELD serial and firmware version', true],
      ['DVIRs and defect corrections', 'Pre-trip, post-trip and mechanic signatures', true],
      ['Malfunction and diagnostic events', 'Power, engine sync, timing and data-recording events', false],
    ];
    for (const [name, description, checked] of rows) {
      const box = screen.getByRole('checkbox', { name });
      if (checked) expect(box).toBeChecked();
      else expect(box).not.toBeChecked();
      expect(screen.getByText(description)).toBeInTheDocument();
    }
  });

  it('⬜ Resolve now goes to the unassigned-driving flow', async () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    expect(
      await screen.findByText(
        '3 unassigned driving segments and 23 uncertified logs will be flagged in the pack. Resolve them before a roadside inspection.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resolve now ›' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/hos-logs?unassigned=1');
  });

  it('⬜ shows the TEST banner when eRODS mode is not readable (FLEET_MANAGER, B-45)', () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    expect(card('Data transfer').getByText('eRODS · TEST mode')).toBeInTheDocument();
  });

  it('hides the banner only when the carrier is positively PRODUCTION (ADMIN)', async () => {
    mocks.role = 'ADMIN';
    renderPage(<FmcsaPackPage />, ROUTE);
    await waitFor(() => expect(screen.queryByText('eRODS · TEST mode')).toBeNull());
  });

  it('⬜ counts the output file comment to 60 and ⬜ accepts fmcsa.dot.gov addresses only', async () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    const transfer = card('Data transfer');
    expect(transfer.getByText('Given to you by the safety official. Max 60 characters.')).toBeInTheDocument();
    expect(transfer.getByText('0/60')).toBeInTheDocument();
    await userEvent.type(transfer.getByPlaceholderText('ROADSIDE INSPECTION 2025-09-10'), 'ROADSIDE INSPECTION 2026-09-10 · UNIT 101 · OH-4471');
    expect(transfer.getByText('51/60')).toBeInTheDocument();
    await userEvent.type(transfer.getByPlaceholderText('ROADSIDE INSPECTION 2025-09-10'), '0123456789');
    expect(transfer.getByText('61/60')).toHaveClass('text-danger');

    await userEvent.click(transfer.getByRole('radio', { name: /Email to inspector/ }));
    await userEvent.type(transfer.getByPlaceholderText('name@fmcsa.dot.gov'), 'officer@gmail.com');
    expect(transfer.getByText('Only fmcsa.dot.gov addresses are accepted.')).toBeInTheDocument();
    await userEvent.clear(transfer.getByPlaceholderText('name@fmcsa.dot.gov'));
    await userEvent.type(transfer.getByPlaceholderText('name@fmcsa.dot.gov'), 'j.doe@fmcsa.dot.gov');
    expect(transfer.queryByText('Only fmcsa.dot.gov addresses are accepted.')).toBeNull();
  });

  it('lists previous transfers — Test only is never hidden; Failed offers Retry', async () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    const test = await screen.findByRole('row', { name: /ROADSIDE INSPECTION 2026-09-10/ });
    for (const text of ['Sep 10, 2026 11:41', 'Web services (eRODS)', 'Sep 03 – Sep 10, 2026', 'Mike Torres', 'Test only']) {
      expect(within(test).getByText(text)).toBeInTheDocument();
    }
    const failed = screen.getByRole('row', { name: /ROADSIDE OH-4471/ });
    expect(within(failed).getByText('Email to inspector')).toBeInTheDocument();
    expect(within(failed).getByText('Failed')).toBeInTheDocument();
    expect(within(failed).getByText('—')).toBeInTheDocument();
    for (const header of ['Sent at', 'Method', 'Comment', 'Period', 'Sent by', 'Result']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: 'View all' }));
    expect(screen.queryByRole('button', { name: 'View all' })).toBeNull();
  });

  it('opens transfer detail from the comment and downloads the file', async () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    await userEvent.click(await screen.findByRole('button', { name: 'ROADSIDE INSPECTION 2026-09-10' }));
    // Role queries over this large page outlast findBy's 1 s budget; anchor on a drawer-only label.
    const drawer = (await screen.findByText('eRODS mode')).closest('[role="dialog"]') as HTMLElement;
    expect(within(drawer).getByText('SMITH38018.csv')).toBeInTheDocument();
    expect(within(drawer).getByText('TEST')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Download a copy' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('Retry reopens 11.14 pre-filled and sends nothing by itself', async () => {
    let posts = 0;
    server.use(http.post(url(endpoints.transfers.create), () => {
      posts += 1;
      return ok({});
    }));
    renderPage(<FmcsaPackPage />, ROUTE);
    const failed = await screen.findByRole('row', { name: /ROADSIDE OH-4471/ });
    await userEvent.click(within(failed).getByRole('button', { name: 'Retry' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('FMCSA §395.34 data transfer · 8 days ending Aug 27, 2026')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('ROADSIDE OH-4471')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: /Inspector email address/ })).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it('Send to inspector opens 11.14 with the page range narrowed to 8 days', async () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    await userEvent.type(screen.getByPlaceholderText('ROADSIDE INSPECTION 2025-09-10'), 'TERMINAL AUDIT');
    await userEvent.click(screen.getByRole('button', { name: 'Send to inspector' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Send logs to a safety official')).toBeInTheDocument();
    expect(within(dialog).getByText('FMCSA §395.34 data transfer · 8 days ending Sep 12, 2026')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('TERMINAL AUDIT')).toBeInTheDocument();
  });

  it('opens 11.14 from the hos-logs deep link and clears it on close', async () => {
    renderPage(<FmcsaPackPage />, `${ROUTE}&transfer=1&driverId=drv_1&date=2026-09-10`);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('FMCSA §395.34 data transfer · 8 days ending Sep 10, 2026')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('location')).toHaveTextContent('/reports/fmcsa?from=2026-09-01&to=2026-09-12');
  });

  it('Generate pack follows the job to READY: Report ready toast, Validated chip, Preview', async () => {
    renderPage(<FmcsaPackPage />, ROUTE);
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Generate pack' }));
    expect((await screen.findAllByText('FMCSA audit pack · 2.4 MB')).length).toBeGreaterThan(0);
    expect(await card('What the pack contains').findByText('Validated')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
  });

  it('shows a Generate pack refusal verbatim', async () => {
    server.use(http.get(url(endpoints.reports.fmcsaPack), () => fail(422, 'VALIDATION_FAILED', 'Invalid FMCSA_PACK report params.')));
    renderPage(<FmcsaPackPage />, ROUTE);
    await userEvent.click(screen.getByRole('button', { name: 'Generate pack' }));
    expect(await screen.findByText('Invalid FMCSA_PACK report params.')).toBeInTheDocument();
  });

  it('marks a failed pack for this range as Validation failed', async () => {
    server.use(
      http.get(url(endpoints.reports.list), () =>
        ok({ items: [{ id: 'rpt_f', type: 'FMCSA_PACK', format: 'PDF', status: 'FAILED', params: { from: '2026-09-01', to: '2026-09-12' }, requestedById: 'x', requestedAt: '2026-09-12T10:00:00.000Z' }], page: 1, limit: 10, total: 1, totalPages: 1 }),
      ),
    );
    renderPage(<FmcsaPackPage />, ROUTE);
    expect(await screen.findByText('Validation failed')).toBeInTheDocument();
  });

  it('⬜ reportsTransfer gates every transfer control (READ keeps the history, drops the actions)', async () => {
    mocks.overrides = { permissions: { ...ROLE_PERMISSIONS.FLEET_MANAGER, reportsTransfer: 'READ' } };
    renderPage(<FmcsaPackPage />, ROUTE);
    const failed = await screen.findByRole('row', { name: /ROADSIDE OH-4471/ });
    expect(within(failed).queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send to inspector' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Generate pack' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Previous transfers' })).toBeInTheDocument();
  });

  it('renders ForbiddenState for a plain 403', async () => {
    server.use(http.get(url(endpoints.drivers.list), () => fail(403, 'FORBIDDEN', 'Insufficient permission.')));
    renderPage(<FmcsaPackPage />, ROUTE);
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });

  it('shows dashes when a KPI source fails, and the transfer list error in its card', async () => {
    server.use(
      http.get(url(endpoints.unidentified.list), () => fail(404, 'NOT_FOUND', 'Not found')),
      http.get(url(endpoints.transfers.list), () => fail(404, 'NOT_FOUND', 'Not found')),
    );
    renderPage(<FmcsaPackPage />, `${ROUTE}&driver=drv_1`);
    await waitFor(() => expect(kpi('Unassigned segments').getByText('—')).toBeInTheDocument());
    expect(await screen.findByText('Could not load transfers')).toBeInTheDocument();
    expect(kpi('Daily logs included').getByText('3')).toBeInTheDocument();
  });
});
