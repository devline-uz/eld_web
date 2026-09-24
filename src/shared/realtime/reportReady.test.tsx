// owner: web-realtime — shell-level `report.ready` (WD-094): invalidates reports on every screen,
// toasts once outside `/reports/*`, stays silent inside it (the report screens own that toast).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, server, url } from '@/mocks/server';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { fileSizeLabel, reportTypeLabel } from '@/shared/api/reportFiles';
import { ToastProvider } from '@/shared/ui/Toast';
import * as RealtimeProviderModule from './RealtimeProvider';
import { resetShellReportAnnouncements, useReportReadyShell } from './reportReady';

const handlers = new Map<string, (payload: unknown) => void>();
const socket = {
  on: (event: string, listener: (payload: unknown) => void) => handlers.set(event, listener),
  off: (event: string) => handlers.delete(event),
};

const READY = {
  id: 'rep_9',
  type: 'IFTA',
  format: 'PDF',
  params: {},
  status: 'READY',
  fileKey: 'k',
  fileSizeBytes: 2_516_582,
  rowCount: 10,
  error: null,
  requestedById: 'u1',
  requestedAt: '2026-09-24T10:00:00Z',
  completedAt: '2026-09-24T10:01:00Z',
  expiresAt: null,
};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  resetShellReportAnnouncements();
  handlers.clear();
  vi.spyOn(RealtimeProviderModule, 'useRealtime').mockReturnValue({
    getSocket: () => socket as never,
    connected: true,
    isOffline: false,
  });
  server.use(http.get(url(endpoints.reports.detail(':id')), () => ok(READY)));
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function Probe() {
  useReportReadyShell();
  return null;
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  render(<Probe />, { wrapper });
  return { queryClient, invalidate };
}

const fire = () =>
  act(() => handlers.get('report.ready')?.({ reportId: 'rep_9', type: 'IFTA', status: 'READY' }));

describe('useReportReadyShell', () => {
  it('outside /reports: invalidates, seeds the report and toasts once with Download', async () => {
    const { queryClient, invalidate } = renderAt('/');
    fire();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reports'] });
    expect(await screen.findByText('Report ready')).toBeInTheDocument();
    expect(screen.getByText(`${reportTypeLabel('IFTA')} · ${fileSizeLabel(READY.fileSizeBytes)}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(queryClient.getQueryData(qk.report('rep_9'))).toMatchObject({ status: 'READY' });

    fire();
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('Report ready')).toHaveLength(1);
  });

  it('inside /reports/*: invalidates and seeds, but the screen owns the toast', async () => {
    const { queryClient, invalidate } = renderAt('/reports/ifta');
    fire();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reports'] });
    await waitFor(() => expect(queryClient.getQueryData(qk.report('rep_9'))).toBeDefined());
    expect(screen.queryByText('Report ready')).not.toBeInTheDocument();
  });
});
