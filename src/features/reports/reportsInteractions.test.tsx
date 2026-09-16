// W-12…W-15 + 11.14 — real user interactions: toolbar menus, date-range apply, rows per page,
// drawer close/retry, driver picker, keyboard submit, dismissing refusals.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { ReactElement } from 'react';
import { http } from 'msw';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { reportRows, reportScreenHandlers, transferRows } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import type { Role } from '@/shared/auth/permissions';
import { ToastProvider } from '@/shared/ui/Toast';
import ActivityReportPage from './ActivityReportPage';
import DvirReportPage from './DvirReportPage';
import FmcsaPackPage from './FmcsaPackPage';
import IftaReportPage from './IftaReportPage';
import { SelectMenu } from './components/SelectMenu';
import { SendLogsModal } from './components/SendLogsModal';
import { previousQuarters, quarterLabel, quarterOf, todayKey } from './reportMeta';
import { resetAnnouncedReports } from './useReportJobs';

const mocks = vi.hoisted(() => ({ role: 'FLEET_MANAGER' as string }));

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext(mocks.role as Role) };
});
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: true }) }));

// Radix dialogs/menus set `pointer-events: none` outside their content; the check is a jsdom artefact.
const user = userEvent.setup({ pointerEventsCheck: 0 });

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderPage(ui: ReactElement, route = '/') {
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

const location = () => screen.getByTestId('location').textContent ?? '';

async function pick(menu: string, option: string) {
  const trigger = screen.getByRole('button', { name: new RegExp(`^${menu}:`) });
  trigger.focus();
  await user.keyboard('{Enter}');
  await user.click(await screen.findByRole('menuitem', { name: option }));
}

/** Opens the DateRangePicker whose trigger shows `label`, picks `Last 7 days`, applies. */
async function applyLast7(label: RegExp) {
  await user.click(screen.getByRole('button', { name: label }));
  await user.click(await screen.findByText('Last 7 days'));
  await user.click(screen.getByText('✓ Apply range'));
}

async function changeRowsPerPage() {
  const select = screen.getByLabelText('Rows per page:') as HTMLSelectElement;
  const next = [...select.options].map((o) => o.value).find((v) => v !== select.value) as string;
  await user.selectOptions(select, next);
  await waitFor(() => expect(select.value).toBe(next));
}

const alertWith = async (text: string) =>
  (await screen.findByText(text)).closest('[role="alert"]') as HTMLElement;

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(...reportScreenHandlers);
  mocks.role = 'FLEET_MANAGER';
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

describe('SelectMenu', () => {
  it('opens from the keyboard and selects; a disabled filter is an inert trigger with no menu', async () => {
    const onSelect = vi.fn();
    renderPage(
      <>
        <SelectMenu name="Quarter" value="a" options={[{ value: 'a', label: 'Q3 2026' }, { value: 'b', label: 'Q2 2026' }]} onSelect={onSelect} />
        <SelectMenu name="Unit" value="all" options={[{ value: 'all', label: 'All units' }]} disabled />
      </>,
    );
    await pick('Quarter', 'Q2 2026');
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(screen.getByRole('button', { name: 'Unit: All units' })).toBeDisabled();
  });
});

describe('W-12 interactions', () => {
  it('changes quarter and report from the toolbar menus', async () => {
    renderPage(<IftaReportPage />, '/reports/ifta');
    const previous = previousQuarters(quarterOf(todayKey('America/New_York')), 2)[1] as string;
    await pick('Quarter', quarterLabel(previous));
    await waitFor(() => expect(location()).toContain(`quarter=${previous}`));
    await pick('Report', 'Activity report');
    expect(location()).toBe('/reports/activity');
  });

  it('shows and dismisses Generate report, Download IFTA PDF and Export CSV refusals', async () => {
    server.use(
      http.post(url(endpoints.reports.generate), () => fail(403, 'FORBIDDEN', 'Insufficient permission.')),
      http.get(url(endpoints.reports.ifta), () => fail(422, 'VALIDATION_FAILED', 'quarter must look like 2026-Q3.')),
    );
    renderPage(<IftaReportPage />, '/reports/ifta?quarter=2026-Q3');

    await user.click(screen.getByRole('button', { name: 'Generate report' }));
    const generateAlert = await alertWith('You do not have access to this.');
    await user.click(within(generateAlert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('You do not have access to this.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Download IFTA PDF' }));
    const pdfAlert = await alertWith('You do not have access to this.');
    await user.click(within(pdfAlert).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('You do not have access to this.')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('quarter must look like 2026-Q3.')).toBeInTheDocument();
  });

  it('retries a failed report list and pages a long one', async () => {
    let calls = 0;
    server.use(
      http.get(url(endpoints.reports.list), () => {
        calls += 1;
        return calls === 1 ? fail(404, 'NOT_FOUND', 'Not found') : ok({ items: reportRows, page: 1, limit: 10, total: 30, totalPages: 3 });
      }),
    );
    renderPage(<IftaReportPage />, '/reports/ifta?quarter=2026-Q3');
    await screen.findByText('Could not load reports');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('row', { name: /IFTA mileage report/ })).toBeInTheDocument();
    await changeRowsPerPage();
  });

  it('submits the schedule form with Enter', async () => {
    let posted = false;
    server.use(http.post(url(endpoints.reports.schedules), () => {
      posted = true;
      return ok({ id: 'sch_1' }, 201);
    }));
    renderPage(<IftaReportPage />, '/reports/ifta?quarter=2026-Q3');
    await user.click(screen.getByRole('button', { name: 'Schedule a report' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'ops@universal-logistics.example{Enter}');
    await waitFor(() => expect(posted).toBe(true));
  });
});

describe('W-13 interactions', () => {
  it('filters by terminal, applies a date range, pages, closes Schedule and switches report', async () => {
    renderPage(<ActivityReportPage />, '/reports/activity?from=2026-09-01&to=2026-09-12');
    await screen.findByRole('row', { name: /John Smith/ });

    await pick('Terminal', 'Dayton, OH');
    await waitFor(() => expect(location()).toContain('terminal=Dayton'));

    await changeRowsPerPage();

    await applyLast7(/^Sep 01 – Sep 12, 2026$/);
    await waitFor(() => expect(location()).not.toContain('from=2026-09-01'));

    await user.click(screen.getByRole('button', { name: 'Schedule' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await pick('Report', 'DVIR report');
    expect(location()).toBe('/reports/dvir');
  });

  it('retries failed duty totals', async () => {
    let calls = 0;
    server.use(
      http.get(url(endpoints.reports.activitySummary), () => {
        calls += 1;
        return fail(422, 'RANGE_TOO_LARGE', 'too large');
      }),
    );
    renderPage(<ActivityReportPage />, '/reports/activity?from=2026-09-01&to=2026-09-12');
    await screen.findByText('Could not load duty totals');
    const before = calls;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });
});

describe('W-14 interactions', () => {
  it('filters by unit and defect type, applies a date range, pages and closes Schedule', async () => {
    renderPage(<DvirReportPage />, '/reports/dvir?from=2026-09-01&to=2026-09-12');
    await screen.findByRole('row', { name: /#110/ });

    await pick('Defect type', 'Brakes');
    await waitFor(() => expect(location()).toContain('defect=Brakes'));
    await pick('Unit', '#110');
    await waitFor(() => expect(location()).toContain('unit=veh_110'));

    await changeRowsPerPage();
    await applyLast7(/^Sep 01 – Sep 12, 2026$/);
    await waitFor(() => expect(location()).not.toContain('from=2026-09-01'));

    await user.click(screen.getByRole('button', { name: 'Schedule' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('retries a failed inspection list', async () => {
    let calls = 0;
    server.use(http.get(url(endpoints.dvir.list), () => {
      calls += 1;
      return fail(404, 'NOT_FOUND', 'Not found');
    }));
    renderPage(<DvirReportPage />, '/reports/dvir?from=2026-09-01&to=2026-09-12');
    await screen.findByText('Could not load inspections');
    const before = calls;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });
});

describe('W-15 interactions', () => {
  it('filters by driver, applies a date range and dismisses a Generate pack refusal', async () => {
    server.use(http.get(url(endpoints.reports.fmcsaPack), () => fail(422, 'VALIDATION_FAILED', 'Invalid FMCSA_PACK report params.')));
    renderPage(<FmcsaPackPage />, '/reports/fmcsa?from=2026-09-01&to=2026-09-12');

    await waitFor(() => expect(screen.getByRole('button', { name: /^Driver:/ })).toBeInTheDocument());
    await screen.findByRole('row', { name: /ROADSIDE OH-4471/ });
    await pick('Driver', 'John Smith');
    await waitFor(() => expect(location()).toContain('driver=drv_1'));

    await applyLast7(/^Sep 01 – Sep 12, 2026$/);
    await waitFor(() => expect(location()).not.toContain('from=2026-09-01'));

    await user.click(screen.getByRole('button', { name: 'Generate pack' }));
    const alert = await alertWith('Invalid FMCSA_PACK report params.');
    await user.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Invalid FMCSA_PACK report params.')).toBeNull();
  });

  it('opens the transfer drawer, downloads the file and closes it; retries a failed detail', async () => {
    let detailCalls = 0;
    server.use(
      http.get(url(endpoints.transfers.detail(':id')), ({ params }) => {
        detailCalls += 1;
        return params.id === 'trf_failed' ? fail(404, 'NOT_FOUND', 'Transfer not found.') : ok(transferRows[0]);
      }),
    );
    renderPage(<FmcsaPackPage />, '/reports/fmcsa?from=2026-09-01&to=2026-09-12');

    await user.click(await screen.findByRole('button', { name: 'ROADSIDE INSPECTION 2026-09-10' }));
    const drawer = (await screen.findByText('eRODS mode')).closest('[role="dialog"]') as HTMLElement;
    await user.click(within(drawer).getByRole('button', { name: 'Download a copy' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('eRODS mode')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'ROADSIDE OH-4471' }));
    await screen.findByText('Could not load the transfer');
    const before = detailCalls;
    const failedDrawer = screen.getByText('Could not load the transfer').closest('[role="dialog"]') as HTMLElement;
    await user.click(within(failedDrawer).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(detailCalls).toBeGreaterThan(before));
  });

  it('retries a failed transfer list and pages the full history', async () => {
    let calls = 0;
    server.use(
      http.get(url(endpoints.transfers.list), () => {
        calls += 1;
        return calls === 1 ? fail(404, 'NOT_FOUND', 'Not found') : ok({ items: transferRows, page: 1, limit: 25, total: 2, totalPages: 1 });
      }),
    );
    renderPage(<FmcsaPackPage />, '/reports/fmcsa?from=2026-09-01&to=2026-09-12');
    await screen.findByText('Could not load transfers');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('row', { name: /ROADSIDE OH-4471/ });
    await user.click(screen.getByRole('button', { name: 'View all' }));
    await changeRowsPerPage();
  });
});

describe('a list that shrinks under the open page', () => {
  /** `n` rows of the same shape, paged the way the server pages them. */
  const pageOf = <T,>(all: T[], search: URLSearchParams, limit: number) => {
    const page = Number(search.get('page')) || 1;
    return {
      items: all.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
    };
  };

  it('W-12 Recently generated steps back when the reports list shrinks between two page requests', async () => {
    let calls = 0;
    server.use(
      http.get(url(endpoints.reports.list), ({ request }) => {
        calls += 1;
        const all = Array.from({ length: calls === 1 ? 30 : 3 }, (_, i) => ({ ...reportRows[0], id: `rpt_${i}` }));
        return ok(pageOf(all, new URL(request.url).searchParams, 10));
      }),
    );
    renderPage(<IftaReportPage />, '/reports/ifta?quarter=2026-Q3');
    await screen.findAllByRole('row', { name: /IFTA mileage report/ });

    await user.click(screen.getByRole('button', { name: '2' }));

    // Page 2 came back empty; the card must land on a page that still has rows, not on the
    // "no reports yet" empty state with the pager hidden.
    await waitFor(() => expect(screen.getAllByRole('row', { name: /IFTA mileage report/ }).length).toBeGreaterThan(0));
    expect(screen.queryByText('No reports generated yet')).toBeNull();
  });

  it('W-15 Previous transfers steps back when the history shrinks between two page requests', async () => {
    let calls = 0;
    server.use(
      http.get(url(endpoints.transfers.list), ({ request }) => {
        calls += 1;
        const all = Array.from({ length: calls <= 2 ? 60 : 2 }, (_, i) => ({ ...transferRows[0], id: `trf_${i}` }));
        return ok(pageOf(all, new URL(request.url).searchParams, calls === 1 ? 5 : 25));
      }),
    );
    renderPage(<FmcsaPackPage />, '/reports/fmcsa?from=2026-09-01&to=2026-09-12');
    await screen.findAllByRole('row', { name: /ROADSIDE INSPECTION 2026-09-10/ });
    await user.click(screen.getByRole('button', { name: 'View all' }));
    await screen.findByRole('button', { name: '3' });

    await user.click(screen.getByRole('button', { name: '3' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page'));
    expect(screen.getAllByRole('row', { name: /ROADSIDE INSPECTION 2026-09-10/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText('No transfers yet')).toBeNull();
  });
});

describe('11.14 interactions', () => {
  function renderModal(onClose = vi.fn()) {
    renderPage(
      <SendLogsModal open onClose={onClose} erodsMode={undefined} eldIdentifier="OBK1" timezone="America/New_York"
        initial={{ from: '2026-09-03', to: '2026-09-10', outputFileComment: 'ROADSIDE INSPECTION 2026-09-10' }} />,
    );
    return onClose;
  }

  it('picks a driver and a range, then submits with Enter', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(url(endpoints.transfers.create), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ transfer: { ...transferRows[0], id: 'trf_enter', status: 'QUEUED' }, warnings: [], counts: {} }, 201);
      }),
    );
    renderModal();
    await user.click(await screen.findByText('Select a driver'));
    await user.click((await screen.findByText('William Bond')).closest('button') as HTMLElement);
    // The picker closed on the choice and its trigger now names the driver.
    await waitFor(() => expect(screen.queryByText('Select a driver')).toBeNull());
    expect(screen.getByText('William Bond')).toBeInTheDocument();

    await applyLast7(/^Sep 03 – Sep 10, 2026$/);
    expect(await screen.findByText(/FMCSA §395\.34 data transfer · 7 days ending /)).toBeInTheDocument();

    fireEvent.submit(screen.getByRole('textbox', { name: /Output file comment/ }).closest('form') as HTMLFormElement);
    await waitFor(() => expect(body).toMatchObject({ driverId: 'drv_2', method: 'WEB_SERVICES', outputFileComment: 'ROADSIDE INSPECTION 2026-09-10' }));
  });

  it('Keep editing returns to a dirty form without closing', async () => {
    const onClose = renderModal();
    await user.type(await screen.findByRole('textbox', { name: /Output file comment/ }), '!');
    const dialog = screen.getAllByRole('dialog')[0] as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByText('Keep editing'));
    await waitFor(() => expect(screen.queryByText('Discard changes?')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Send logs to a safety official')).toBeInTheDocument();
  });
});
