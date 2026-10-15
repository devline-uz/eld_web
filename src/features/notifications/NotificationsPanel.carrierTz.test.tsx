// FE-07 — a notification older than 7 days shows its date, and that date is the carrier's calendar
// day (the rest of the panel uses the carrier zone), not the browser's.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { server, url } from '@/mocks/server';
import { ok } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import NotificationsPanel from './NotificationsPanel';

// UTC+14: an instant at 12:00Z is already the next calendar day there, in any test-runner zone.
vi.mock('@/shared/auth/useCarrierTimezone', () => ({ useCarrierTimezone: () => 'Pacific/Kiritimati' }));

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('dates an old row in the carrier zone', async () => {
  server.use(
    http.get(url(endpoints.notifications.list), () =>
      ok({
        items: [
          {
            id: 'ntf_old', kind: 'OTHER', severity: 'INFO', type: 'report_ready', category: null, title: 'Old report',
            body: 'Done', objectType: 'Report', objectId: 'rpt_1', readAt: null, createdAt: '2025-03-04T12:00:00.000Z',
          },
        ],
        page: 1, limit: 25, total: 1, totalPages: 1,
        counts: { all: 1, violations: 0, maintenance: 0, connectivity: 0 },
        unreadCount: 1,
      }),
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <NotificationsPanel onClose={() => {}} isPathAllowed={() => true} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByText('Old report');
  expect(screen.getByText('Mar 05, 2025')).toBeInTheDocument();
});
