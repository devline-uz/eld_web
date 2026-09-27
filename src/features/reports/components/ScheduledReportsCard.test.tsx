// QA fix — `Scheduled reports` list / edit / pause / delete (GET/PATCH/DELETE /reports/schedules).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import type { ReportScheduleRow } from '@/shared/api/reports';
import type { Role } from '@/shared/auth/permissions';
import { ToastProvider } from '@/shared/ui/Toast';
import { ScheduleReportModal } from './ScheduleReportModal';
import { ScheduledReportsCard } from './ScheduledReportsCard';

const mocks = vi.hoisted(() => ({ role: 'ADMIN' as string }));
vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext(mocks.role as Role) };
});

const IFTA: ReportScheduleRow = {
  id: 'sch_ifta',
  reportType: 'IFTA',
  format: 'PDF',
  params: { window: 'PREVIOUS_QUARTER' },
  cron: '0 6 1 * *',
  timezone: 'America/New_York',
  recipients: ['fleet.ops@example.test', 'ifta.filing@example.test'],
  enabled: true,
  lastRunAt: null,
  nextRunAt: '2026-10-01T10:00:00.000Z',
};
const DVIR: ReportScheduleRow = {
  ...IFTA,
  id: 'sch_dvir',
  reportType: 'DVIR',
  format: 'CSV',
  params: { window: 'PREVIOUS_WEEK' },
  cron: '0 6 * * 1',
  recipients: ['safety.lead@example.test'],
  enabled: false,
};

function renderUi(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  mocks.role = 'ADMIN';
  server.use(http.get(url(endpoints.reports.schedules), () => ok({ items: [IFTA, DVIR] })));
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

describe('ScheduledReportsCard', () => {
  it('lists every schedule with report, format, frequency, recipients, next run and status', async () => {
    renderUi(<ScheduledReportsCard timezone="America/New_York" />);
    expect(await screen.findByText('IFTA mileage report')).toBeInTheDocument();
    expect(screen.getByText('The 1st of every month at 06:00')).toBeInTheDocument();
    expect(screen.getByText('Every Monday at 06:00')).toBeInTheDocument();
    expect(screen.getByText('fleet.ops@example.test, ifta.filing@example.test')).toBeInTheDocument();
    expect(screen.getByText('Oct 01, 2026 06:00')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Row actions' })).toHaveLength(2);
  });

  it('shows the empty state when no schedule exists', async () => {
    server.use(http.get(url(endpoints.reports.schedules), () => ok({ items: [] })));
    renderUi(<ScheduledReportsCard timezone="America/New_York" />);
    expect(await screen.findByText('No scheduled reports')).toBeInTheDocument();
  });

  it('renders no row actions without reports FULL (VIEWER)', async () => {
    mocks.role = 'VIEWER';
    renderUi(<ScheduledReportsCard timezone="America/New_York" />);
    expect(await screen.findByText('IFTA mileage report')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Row actions' })).not.toBeInTheDocument();
  });

  it('Pause sends PATCH { enabled: false } and toasts', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(url(endpoints.reports.schedule(IFTA.id)), async ({ request }) => {
        bodies.push(await request.json());
        return ok({ ...IFTA, enabled: false });
      }),
    );
    const user = userEvent.setup();
    renderUi(<ScheduledReportsCard timezone="America/New_York" />);
    await screen.findByText('IFTA mileage report');
    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Edit', 'Pause', 'Delete']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Pause' }));
    await waitFor(() => expect(bodies).toEqual([{ enabled: false }]));
    expect(await screen.findByText('IFTA mileage report schedule paused')).toBeInTheDocument();
    // Let the menu finish closing so no Radix layer outlives the test.
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('Delete asks for confirmation, then sends DELETE and toasts', async () => {
    let deleted = 0;
    server.use(
      http.delete(url(endpoints.reports.schedule(DVIR.id)), () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderUi(<ScheduledReportsCard timezone="America/New_York" />);
    await screen.findByText('DVIR report');
    // Keyboard-open: after an earlier test's Radix menu, jsdom pointer-opening is unreliable (the
    // known "menu item not found" row-menu flake); Enter on the trigger is the same user path.
    screen.getAllByRole('button', { name: 'Row actions' })[1]!.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Resume' })).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(deleted).toBe(0);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(1));
    expect(await screen.findByText('DVIR report schedule deleted')).toBeInTheDocument();
  });
});

describe('ScheduleReportModal · edit mode', () => {
  it('prefills from the schedule and PATCHes the change without touching enabled', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.patch(url(endpoints.reports.schedule(IFTA.id)), async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return ok(IFTA);
      }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderUi(
      <ScheduleReportModal open onClose={onClose} reportType="IFTA" params={IFTA.params} timezone={IFTA.timezone} schedule={IFTA} />,
    );
    expect(screen.getByText('Edit scheduled report')).toBeInTheDocument();
    const recipients = screen.getByLabelText(/Recipients/);
    expect(recipients).toHaveValue('fleet.ops@example.test, ifta.filing@example.test');
    expect(screen.getByLabelText(/Format/)).toHaveValue('PDF');
    expect(screen.getByLabelText(/Frequency/)).toHaveValue('MONTHLY');
    await user.selectOptions(screen.getByLabelText(/Format/), 'CSV');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      reportType: 'IFTA',
      format: 'CSV',
      params: { window: 'PREVIOUS_QUARTER' },
      cron: '0 6 1 * *',
      timezone: 'America/New_York',
      recipients: ['fleet.ops@example.test', 'ifta.filing@example.test'],
    });
    expect(await screen.findByText('IFTA mileage report schedule updated')).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
