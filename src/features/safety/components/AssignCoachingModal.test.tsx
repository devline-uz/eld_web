// B-43 (shipped 2026-09-24) — coaching is assigned directly by `driverId`; there is no longer an
// open-events picker in this modal (WD-034 workaround retired).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('posts { driverId, note } and closes on success', async () => {
    let body: unknown;
    server.use(
      http.post(url(endpoints.safety.coaching), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(ok({ id: 'evt_1' }));
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <AssignCoachingModal driver={DRIVER as never} onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Note'), 'Follow up next week');
    await user.click(screen.getByRole('button', { name: 'Assign coaching' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toEqual({ driverId: 'drv_1', note: 'Follow up next week' });
  });
});
