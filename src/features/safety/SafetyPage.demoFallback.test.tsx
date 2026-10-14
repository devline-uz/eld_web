// `VITE_DEMO_FALLBACK=fallback` (dev only — production builds force it off): with no scorecard rows
// the Safety page shows the demo scorecard. The flag-off side (ErrorState / EmptyState) is covered in
// `SafetyPage.test.tsx`.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { PageHeaderProvider, PageHeading } from '@/app/layouts/Topbar';
import SafetyPage from './SafetyPage';

vi.hoisted(() => {
  vi.stubEnv('VITE_DEMO_FALLBACK', 'fallback');
});

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/shared/auth/Can', () => ({ Can: ({ children }: { children: React.ReactNode }) => children }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <PageHeaderProvider>
            <PageHeading />
            <SafetyPage />
          </PageHeaderProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

describe('SafetyPage demo fallback — flag on', () => {
  it('shows the demo scorecard instead of the empty state when the API has no rows', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.safety.scorecard), () => ok({ items: [], periodStart: '2026-08-12', periodEnd: '2026-09-11' })));
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /^Scorecards/ }));
    expect((await screen.findAllByText(/Marcus Johnson/)).length).toBeGreaterThan(0);
    expect(screen.queryByText('No scorecards yet')).toBeNull();
  });

  it('CODE-086: keeps the real error state (no demo rows) when the request fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.safety.scorecard), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /^Scorecards/ }));
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/Marcus Johnson/)).toBeNull();
  });
});
