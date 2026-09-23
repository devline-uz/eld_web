// WB-167 — the event picker printed the raw enum and a bare `—` (`HARSH_BRAKING · —`) because it
// kept its own formatting instead of the label map the W-10 table already uses.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { AssignCoachingModal } from './AssignCoachingModal';

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

const DRIVER = {
  driverId: 'drv_1',
  rank: 3,
  score: 68,
  harshCount: 4,
  speedingCount: 1,
  milesDriven: 3400,
  driver: { id: 'drv_1', firstName: 'John', lastName: 'Smith' },
};

describe('AssignCoachingModal', () => {
  it('labels each event instead of showing the raw enum', async () => {
    server.use(
      http.get(url(endpoints.safety.events), () =>
        ok({
          items: [
            { id: 'evt_1', type: 'HARSH_BRAKING', status: 'NEW', occurredAt: null, vehicleId: 'veh_1', driverId: 'drv_1' },
            { id: 'evt_2', type: 'SPEEDING', status: 'REVIEWED', occurredAt: '2026-09-12T15:00:00.000Z', vehicleId: 'veh_1', driverId: 'drv_1' },
          ],
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <AssignCoachingModal driver={DRIVER as never} onClose={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('option', { name: /^Harsh braking · / })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^Speeding · / })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /HARSH_BRAKING/ })).toBeNull();
  });
});
