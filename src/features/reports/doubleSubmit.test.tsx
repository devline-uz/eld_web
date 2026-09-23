// WB-146 — a double click on any report-queueing button must queue exactly ONE job.
// Every case below clicks twice back-to-back (no await between the two clicks, the way a real
// double click lands) and asserts the request count, not the button's disabled attribute.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import type { ReactElement } from 'react';
import { http } from 'msw';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { reportScreenHandlers } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import type { Role } from '@/shared/auth/permissions';
import { ToastProvider } from '@/shared/ui/Toast';
import DvirReportPage from './DvirReportPage';
import FmcsaPackPage from './FmcsaPackPage';
import IftaReportPage from './IftaReportPage';
import { ScheduleReportModal } from './components/ScheduleReportModal';
import { SendLogsModal } from './components/SendLogsModal';
import { resetAnnouncedReports } from './useReportJobs';

const mocks = vi.hoisted(() => ({ role: 'ADMIN' as string }));

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext(mocks.role as Role) };
});
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: true }) }));

function renderPage(ui: ReactElement, route = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Counts the calls that reach `method path`, answering slowly so the second click races the first. */
function countSlow(method: 'get' | 'post', path: string, body: unknown) {
  const calls: unknown[] = [];
  server.use(
    http[method](url(path), async ({ request }) => {
      calls.push(request.method === 'POST' ? await request.json() : request.url);
      await new Promise((resolve) => setTimeout(resolve, 40));
      return ok(body);
    }),
  );
  return calls;
}

const QUEUED = { reportId: 'rep_double', status: 'QUEUED' };

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(...reportScreenHandlers);
  mocks.role = 'ADMIN';
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

describe('WB-146 · one click, one report', () => {
  it('W-12 IFTA `Generate report` queues once on a double click', async () => {
    const calls = countSlow('post', endpoints.reports.generate, QUEUED);
    renderPage(<IftaReportPage />, '/reports/ifta');
    const button = await screen.findByRole('button', { name: 'Generate report' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(calls).toHaveLength(1);
  });

  it('W-12 IFTA `Download IFTA PDF` queues once on a double click', async () => {
    const calls = countSlow('post', endpoints.reports.generate, QUEUED);
    renderPage(<IftaReportPage />, '/reports/ifta');
    const button = await screen.findByRole('button', { name: 'Download IFTA PDF' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(calls).toHaveLength(1);
  });

  it('W-14 DVIR `Download PDF` queues once on a double click', async () => {
    const calls = countSlow('post', endpoints.reports.generate, QUEUED);
    renderPage(<DvirReportPage />, '/reports/dvir');
    const button = await screen.findByRole('button', { name: 'Download PDF' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(calls).toHaveLength(1);
  });

  it('W-15 FMCSA `Generate pack` queues once on a double click', async () => {
    const calls = countSlow('get', endpoints.reports.fmcsaPack, QUEUED);
    renderPage(<FmcsaPackPage />, '/reports/fmcsa');
    const button = await screen.findByRole('button', { name: 'Generate pack' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(calls).toHaveLength(1);
  });

  it('`Schedule a report` posts one schedule on a double click', async () => {
    const calls = countSlow('post', endpoints.reports.schedules, { id: 'sch_1' });
    renderPage(
      <ScheduleReportModal open onClose={vi.fn()} reportType="IFTA" params={{ quarter: '2026-Q3' }} timezone="America/New_York" />,
    );
    fireEvent.change(screen.getByLabelText(/Recipients/), { target: { value: 'ops@example.com' } });
    const button = screen.getByRole('button', { name: 'Schedule' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(calls).toHaveLength(1);
  });

  it('11.14 `Send transfer` creates one transfer on a double click', async () => {
    const calls = countSlow('post', endpoints.transfers.create, {
      transfer: { id: 'trf_1', status: 'SENT', fileName: 'f.csv', erodsMode: 'TEST' },
      warnings: [],
      counts: { events: 1 },
    });
    renderPage(
      <SendLogsModal
        open
        onClose={vi.fn()}
        erodsMode={undefined}
        eldIdentifier="OBK1"
        timezone="America/New_York"
        initial={{ driverId: 'drv_1', from: '2026-09-03', to: '2026-09-10', outputFileComment: 'ROADSIDE INSPECTION' }}
      />,
    );
    const button = await screen.findByRole('button', { name: 'Send transfer' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(calls).toHaveLength(1);
  });
});
