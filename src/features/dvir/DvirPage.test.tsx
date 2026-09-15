// web/tz.md §10 W-09 — smoke test: renders the KPI row, the DVIRs tab and the RBAC-gated
// `+ New work order` control from the real fixture data.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
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
