// web/tz.md §10 W-10 — smoke test: KPI row, safety-events empty state verbatim, and the
// RBAC-gated `Assign coaching` control.
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
